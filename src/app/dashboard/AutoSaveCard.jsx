import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useSession from "../../utils/useSession";

const PRESETS = [10, 25, 50];
const MIN_USDC = 0.5;

async function fetchState(token) {
  const res = await fetch("/api/autosave/state", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export default function AutoSaveCard() {
  const { user } = useSession();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("tiplyfi_token")
      : null;

  const { data: state, refetch } = useQuery({
    queryKey: ["autosaveState"],
    queryFn: () => fetchState(token),
    enabled: Boolean(token),
  });

  const { data: balanceData } = useQuery({
    queryKey: ["balance", user?.walletAddress],
    queryFn: async () => {
      if (!user?.walletAddress) return null;
      const res = await fetch(
        `/api/wallet/balance?address=${user.walletAddress}`,
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(user?.walletAddress),
  });
  const usdcBalance = balanceData?.balanceUsdc;

  const [pct, setPct] = useState(25);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const enabled = state?.enabled === true;
  const funded = Number(usdcBalance || 0) >= MIN_USDC;

  async function enable() {
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/autosave/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pct }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couldn't turn auto-save on.");
      }

      // Circle's own confirmation UI opens here. Nothing registers without it.
      setStatus("Approve auto-save to continue...");
      const { getCircleSession, executeChallenge, initSdk } = await import(
        "../../utils/circleSdk"
      );
      const session = await getCircleSession();
      const sdk = await initSdk(() => {});
      const result = await executeChallenge(sdk, {
        challengeId: data.challengeId,
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
      });

      const hash = result?.data?.txHash || "";
      if (!hash) {
        throw new Error("Approval didn't complete. Nothing was changed.");
      }

      const confirm = await fetch("/api/autosave/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txHash: hash }),
      });
      if (!confirm.ok) {
        const c = await confirm.json();
        throw new Error(c.error || "Couldn't confirm auto-save.");
      }

      setStatus(`Auto-save on. ${pct}% of every tip now goes to savings.`);
      refetch();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/autosave/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couldn't turn auto-save off.");
      }

      setStatus("Approve to turn auto-save off...");
      const { getCircleSession, executeChallenge, initSdk } = await import(
        "../../utils/circleSdk"
      );
      const session = await getCircleSession();
      const sdk = await initSdk(() => {});
      const result = await executeChallenge(sdk, {
        challengeId: data.challengeId,
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
      });
      if (!result?.data?.txHash) {
        throw new Error("Approval didn't complete.");
      }

      await fetch("/api/autosave/confirm-disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txHash: result.data.txHash }),
      });

      setStatus("Auto-save off.");
      refetch();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-[#6B7280] mb-4">
        Send a share of every tip straight to a savings vault on Arc. One
        approval, non-custodial, and you can turn it off anytime.
      </p>

      {enabled ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-[#166534]">
              On — saving {state.pct}% of each tip
            </span>
          </div>
          <button
            onClick={disable}
            disabled={busy}
            className="w-full py-3 text-sm font-semibold text-[#7c3aed] border border-[#7c3aed] rounded-xl hover:bg-[#F5F3FF] disabled:opacity-50 transition-colors"
          >
            {busy ? "Working..." : "Turn off"}
          </button>
        </div>
      ) : !funded ? (
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-4 py-3">
          <p className="text-sm text-[#9A3412]">
            Add a little USDC first — auto-save needs to cover network fees on
            Arc, where gas is paid in USDC.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs text-[#6B7280] mb-2">Save this much of each tip</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPct(p)}
                  className={`py-2.5 text-sm font-semibold rounded-lg border transition-colors ${
                    pct === p
                      ? "bg-[#7c3aed] text-white border-[#7c3aed]"
                      : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#7c3aed]"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy ? "Working..." : `Turn on auto-save`}
          </button>
        </div>
      )}

      {status && (
        <p className="mt-3 text-xs text-[#6B7280] break-words">{status}</p>
      )}
    </div>
  );
}
