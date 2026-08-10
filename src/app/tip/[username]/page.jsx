import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Wallet, X, Zap } from "lucide-react";
import {
  sendUsdc,
  formatAddress,
  ARC_EXPLORER,
  computeTipAmounts,
  tipViaRouter,
  weiToDisplay,
} from "../../../utils/arc-config";
import WalletPicker from "../../../utils/WalletPicker";
import { confirmTip, flushTipQueue } from "../../../utils/tipQueue";
import Logo from "../../../utils/Logo";

const AMOUNTS = ["1", "5", "10", "25"];

// Networks reachable via Circle CCTP V2 / Gateway. Arc is native; the rest
// light up as bridge and swap support lands.
const NETWORKS = [
  { id: "arc", label: "Arc", available: true },
  { id: "base", label: "Base", available: false },
  { id: "polygon", label: "Polygon", available: false },
  { id: "arbitrum", label: "Arbitrum", available: false },
  { id: "op", label: "OP", available: false },
  { id: "sepolia", label: "Ethereum", available: false },
  { id: "avalanche", label: "Avalanche", available: false },
  { id: "solana", label: "Solana", available: false },
];

export default function TipPage({ params }) {
  const { username } = params;
  const [mode, setMode] = useState("wallet");
  const [network, setNetwork] = useState("arc");
  const [wallet, setWallet] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [amount, setAmount] = useState("5");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [tipperEmail, setTipperEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMode, setSuccessMode] = useState("");
  const [sentAmount, setSentAmount] = useState("");
  const [supportTiplyfi, setSupportTiplyfi] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("impersonation");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    flushTipQueue();
  }, []);

  const {
    data: creator,
    isLoading: creatorLoading,
    error: creatorError,
  } = useQuery({
    queryKey: ["creator", username],
    queryFn: async () => {
      const res = await fetch(`/api/user/${username}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("not_found");
        throw new Error("Failed to load creator");
      }
      return res.json();
    },
  });

  const finalAmount = customAmount || amount;
  const routerAddress = creator?.tipRouterAddress || "";
  const underReview = creator?.status === "under_review";
  const accent = creator?.accentColor || "#7c3aed";
  const socials = creator?.socialLinks || {};
  const socialEntries = Object.entries(socials).filter(([, v]) => v);
  // The creator's setting is the only input. Fans don't choose who pays.
  const feePaidByFan = creator?.feeMode === "fan_pays";

  const validAmount =
    finalAmount && !isNaN(finalAmount) && Number(finalAmount) > 0;
  const amounts = validAmount
    ? computeTipAmounts(finalAmount, feePaidByFan, supportTiplyfi)
    : null;

  async function submitReport() {
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          reason: reportReason,
          detail: reportDetail || null,
        }),
      });
    } catch {}
    setReportSent(true);
  }

  async function handleWalletTip() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!amounts) {
      setStatus("Enter a valid amount.");
      return;
    }

    const clientRef =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const routed = Boolean(routerAddress);
    const netUsdc = routed ? weiToDisplay(amounts.netWei) : finalAmount;
    // The Tipped event reports the tip only — the platform tip is separate,
    // so verification must compare against tipTotal, not the full debit.
    const grossUsdc = routed ? weiToDisplay(amounts.tipTotalWei) : finalAmount;
    const platformTipUsdc = routed ? weiToDisplay(amounts.platformTipWei) : "0";
    const feeUsdc = routed ? weiToDisplay(amounts.feeWei) : "0";

    let tipId = null;

    try {
      setLoading(true);

      // 1. Persist the tip (including the message) BEFORE going on-chain.
      setStatus("Preparing...");
      try {
        const prep = await fetch("/api/tips/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRef,
            creatorUsername: username,
            creatorAddress: creator.walletAddress,
            tipperAddress: wallet.address,
            amount: netUsdc,
            amountUsdc: parseFloat(netUsdc),
            grossUsdc: parseFloat(grossUsdc),
            feeUsdc: parseFloat(feeUsdc),
            platformTipUsdc: parseFloat(platformTipUsdc),
            message: message || null,
          }),
        });
        if (prep.ok) {
          const data = await prep.json();
          tipId = data.tipId ?? null;
        } else {
          console.error("[tiplyfi] prepare failed", prep.status);
          setStatus("Could not save your message. Continuing...");
        }
      } catch (prepErr) {
        console.warn("[tiplyfi] prepare failed", prepErr);
      }

      // 2. Send on-chain.
      setStatus("Confirm in your wallet...");
      const hash = routed
        ? await tipViaRouter({
            creatorAddress: creator.walletAddress,
            routerAddress,
            platformTipWei: amounts.platformTipWei,
            valueWei: amounts.valueWei,
            feeWei: amounts.feeWei,
            message: message || null,
            provider: wallet.provider,
          })
        : await sendUsdc(creator.walletAddress, finalAmount, wallet.provider);
      setTxHash(hash);

      // 3. Confirm. On failure this queues to localStorage — never silent.
      await confirmTip({ tipId, clientRef, txHash: hash });

      setSuccessMode("wallet");
      setShowSuccess(true);
      setSentAmount(netUsdc);
      setAmount("5");
      setCustomAmount("");
      setMessage("");
      setStatus("");
      setSupportTiplyfi(false);
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSponsoredTip() {
    if (!validAmount) {
      setStatus("Enter a valid amount.");
      return;
    }
    if (Number(finalAmount) > 100) {
      setStatus("Sponsored tips are limited to 100 USDC.");
      return;
    }
    try {
      setLoading(true);
      setStatus("Processing your tip on Arc...");
      const res = await fetch("/api/tips/sponsored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorUsername: username,
          amountUsdc: parseFloat(finalAmount),
          message: message || null,
          tipperEmail: tipperEmail || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tip failed.");
      setTxHash(data.txId || "");
      setSuccessMode("sponsored");
      setShowSuccess(true);
      setSentAmount(finalAmount);
      setAmount("5");
      setCustomAmount("");
      setMessage("");
      setTipperEmail("");
      setStatus("");
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  function Shell({ children }) {
    return (
      <div className="relative min-h-screen bg-ink overflow-hidden flex flex-col items-center justify-center px-4 py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[26%] left-1/2 -translate-x-1/2 w-[85vw] h-[70vw] rounded-full drift"
          style={{
            background: `radial-gradient(circle, ${accent}55 0%, ${accent}00 66%)`,
            filter: "blur(50px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-[30%] -right-[18%] w-[55vw] h-[55vw] rounded-full drift-slow"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.30) 0%, rgba(59,130,246,0) 70%)",
            filter: "blur(50px)",
          }}
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full grid-mask"
          style={{ opacity: 0.45 }}
        >
          <defs>
            <pattern id="tip-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tip-grid)" />
        </svg>
        <div className="relative z-10 w-full flex flex-col items-center">
          {children}
        </div>
      </div>
    );
  }

  if (creatorError?.message === "not_found") {
    return (
      <Shell>
        <div className="glass glass-lit rounded-3xl p-10 max-w-[400px] w-full text-center rise">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
            <X size={22} className="text-[var(--muted)]" />
          </div>
          <h2 className="display-md text-white text-xl mb-2">Nobody here yet</h2>
          <p className="text-sm text-[var(--muted)] mb-7">
            tiplyfi.app/{username} hasn't been claimed. It could be yours.
          </p>
          <button
            onClick={() => (window.location.href = `/signup?u=${username}`)}
            className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
          >
            Claim this link
          </button>
        </div>
      </Shell>
    );
  }

  if (creatorError) {
    return (
      <Shell>
        <div className="glass glass-lit rounded-3xl p-10 max-w-[400px] w-full text-center rise">
          <h2 className="display-md text-white text-xl mb-2">
            Couldn't load this page
          </h2>
          <p className="text-sm text-[var(--muted)] mb-7">
            Something went wrong on our side.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (creatorLoading || !creator) {
    return (
      <Shell>
        <Loader2 size={24} className="text-[var(--violet-lo)] animate-spin" />
      </Shell>
    );
  }

  const initial = creator.username ? creator.username[0].toUpperCase() : "?";

  return (
    <Shell>
      {showPicker && (
        <WalletPicker
          accent={accent}
          onConnect={(result) => {
            setWallet(result);
            setShowPicker(false);
            setStatus("");
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div
        className="glass glass-lit rounded-[28px] w-full max-w-[440px] overflow-hidden rise"
        style={{ boxShadow: "0 50px 110px -45px rgba(0,0,0,0.95)" }}
      >
        {/* Creator */}
        <div
          className="px-8 py-9 text-center"
          style={{
            background: `linear-gradient(140deg, ${accent}, ${accent}66 60%, rgba(59,130,246,0.55))`,
          }}
        >
          <div className="w-[68px] h-[68px] rounded-full bg-white/20 border border-white/35 flex items-center justify-center display-md text-white text-2xl mx-auto mb-4 backdrop-blur-sm">
            {initial}
          </div>
          <h1 className="display-md text-white text-[21px]">
            {creator.displayName || creator.username}
          </h1>
          <p className="font-mono-t text-white/65 text-[13px] mt-1">
            @{creator.username}
          </p>

          {creator.category && (
            <span className="inline-block mt-3 text-[11px] font-medium text-white/90 bg-white/15 px-3 py-1 rounded-full">
              {creator.category}
            </span>
          )}

          {creator.bio && (
            <p className="text-white/85 text-sm leading-relaxed mt-4 max-w-[320px] mx-auto">
              {creator.bio}
            </p>
          )}

          {socialEntries.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              {socialEntries.map(([key, url]) => (
                <button
                  key={key}
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  className="text-[11px] font-medium text-white/70 hover:text-white capitalize transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode */}
        <div className="flex border-b border-[var(--line)]">
          {[
            { id: "wallet", label: "Wallet", icon: Wallet },
            { id: "sponsored", label: "No wallet", icon: Zap },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id);
                setStatus("");
                if (t.id === "sponsored") setWallet(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors relative ${
                mode === t.id
                  ? "text-white"
                  : "text-[var(--muted)] hover:text-white/80"
              }`}
            >
              <t.icon size={15} />
              {t.label}
              {mode === t.id && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                  style={{ background: accent }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-7">
          {underReview && (
            <div className="mb-6 px-4 py-3 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl">
              This page is being reviewed. Tipping is paused until we're done.
            </div>
          )}

          {mode === "wallet" && !wallet && (
            <div className="mb-6">
              <p className="eyebrow text-[var(--muted)] mb-3">Network</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    disabled={!n.available}
                    onClick={() => n.available && setNetwork(n.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      network === n.id
                        ? "text-white"
                        : n.available
                          ? "text-[var(--muted)] border-[var(--line)] hover:text-white"
                          : "text-[rgba(139,138,165,0.4)] border-[var(--line)] cursor-not-allowed"
                    }`}
                    style={
                      network === n.id
                        ? { borderColor: accent, background: `${accent}22` }
                        : undefined
                    }
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white rounded-xl border border-[var(--line)] hover:border-[rgba(255,255,255,0.22)] hover:bg-white/[0.03] transition-colors"
              >
                <Wallet size={16} />
                Connect wallet
              </button>
            </div>
          )}

          {mode === "wallet" && wallet && (
            <div className="mb-6 flex items-center justify-between glass rounded-xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--settle)] settle-pulse" />
                <span className="font-mono-t text-[13px] text-white">
                  {formatAddress(wallet.address)}
                </span>
              </div>
              <button
                onClick={() => setWallet(null)}
                className="text-xs text-[var(--muted)] hover:text-white transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}

          {mode === "sponsored" && (
            <div className="mb-5">
              <p className="eyebrow text-[var(--muted)] mb-2">
                Email for a receipt (optional)
              </p>
              <input
                type="email"
                value={tipperEmail}
                onChange={(e) => {
                  setTipperEmail(e.target.value);
                  setStatus("");
                }}
                placeholder="you@example.com"
                className="w-full px-4 py-3 text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-xl placeholder:text-[rgba(139,138,165,0.5)] focus:border-[rgba(255,255,255,0.2)] transition-colors"
              />
            </div>
          )}

          {/* Amount */}
          <p className="eyebrow text-[var(--muted)] mb-3">Amount</p>
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {AMOUNTS.map((a) => {
              const active = amount === a && !customAmount;
              return (
                <button
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount("");
                    setStatus("");
                  }}
                  className={`py-3 font-mono-t text-sm rounded-xl border transition-all duration-300 ${
                    active
                      ? "text-white"
                      : "text-[var(--muted)] border-[var(--line)] hover:text-white hover:border-[rgba(255,255,255,0.2)]"
                  }`}
                  style={
                    active
                      ? { borderColor: accent, background: `${accent}26` }
                      : undefined
                  }
                >
                  ${a}
                </button>
              );
            })}
          </div>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setAmount("");
              setStatus("");
            }}
            placeholder="Other amount"
            min="0"
            step="0.01"
            className="w-full px-4 py-3 font-mono-t text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-xl placeholder:text-[rgba(139,138,165,0.5)] focus:border-[rgba(255,255,255,0.2)] transition-colors mb-5"
          />

          {/* Message */}
          <p className="eyebrow text-[var(--muted)] mb-3">Message (optional)</p>
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setStatus("");
            }}
            placeholder="Say something nice"
            maxLength={200}
            className="w-full px-4 py-3 text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-xl placeholder:text-[rgba(139,138,165,0.5)] focus:border-[rgba(255,255,255,0.2)] transition-colors mb-5"
          />

          {/* Breakdown */}
          {mode === "wallet" && amounts && routerAddress && (
            <div className="glass rounded-xl p-4 mb-5 text-[13px]">
              <div className="flex justify-between mb-2">
                <span className="text-[var(--muted)]">
                  Tip to @{creator.username}
                </span>
                <span className="font-mono-t text-white">
                  ${weiToDisplay(amounts.netWei)}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-[var(--muted)]">Tiplyfi fee</span>
                <span className="font-mono-t text-white">
                  ${weiToDisplay(amounts.feeWei)}
                </span>
              </div>
              {supportTiplyfi && (
                <div className="flex justify-between mb-2">
                  <span className="text-[var(--muted)]">Support Tiplyfi</span>
                  <span className="font-mono-t text-white">
                    ${weiToDisplay(amounts.platformTipWei)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-[var(--line)] font-semibold text-white">
                <span>You pay</span>
                <span className="font-mono-t">
                  ${weiToDisplay(amounts.valueWei)}
                </span>
              </div>

              <label className="flex items-start gap-2.5 mt-4 pt-4 border-t border-[var(--line)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportTiplyfi}
                  onChange={(e) => setSupportTiplyfi(e.target.checked)}
                  className="mt-0.5 accent-[var(--violet)]"
                />
                <span className="text-[var(--muted)] leading-snug text-xs">
                  Add ${weiToDisplay(amounts.platformTipWei)} to support Tiplyfi
                </span>
              </label>
            </div>
          )}

          {status && (
            <div className="mb-5 px-4 py-3 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl break-words">
              {status}
            </div>
          )}

          <button
            onClick={mode === "wallet" ? handleWalletTip : handleSponsoredTip}
            disabled={loading || underReview || (mode === "wallet" && !wallet)}
            className="btn-primary w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {status || "Sending..."}
              </span>
            ) : (
              `Send ${validAmount ? `$${finalAmount}` : ""} USDC`
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--settle)] settle-pulse" />
            <span className="font-mono-t text-[11px] text-settle">
              settles in under a second
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={() => (window.location.href = "/signup")}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          <Logo size={20} />
          Get your own Tiplyfi link
        </button>
        <button
          onClick={() => setReportOpen(true)}
          className="text-[11px] text-[rgba(139,138,165,0.55)] hover:text-[var(--muted)] transition-colors"
        >
          Report this page
        </button>
      </div>

      {/* Report */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(5,4,15,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}
        >
          <div className="glass glass-lit rounded-2xl w-full max-w-[380px] p-6 rise">
            {reportSent ? (
              <div className="text-center py-4">
                <p className="display-md text-white text-base mb-1">
                  Thanks for telling us
                </p>
                <p className="text-xs text-[var(--muted)] mb-6">
                  We review every report.
                </p>
                <button
                  onClick={() => {
                    setReportOpen(false);
                    setReportSent(false);
                    setReportDetail("");
                  }}
                  className="w-full py-2.5 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="display-md text-white text-base mb-1">
                  Report this page
                </h3>
                <p className="text-xs text-[var(--muted)] mb-5">
                  You don't need an account.
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    ["impersonation", "Pretending to be someone else"],
                    ["illegal", "Illegal or harmful content"],
                    ["spam", "Spam or a scam"],
                    ["other", "Something else"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setReportReason(value)}
                      className={`w-full text-left px-4 py-2.5 text-sm rounded-xl border transition-colors ${
                        reportReason === value
                          ? "border-[var(--violet-lo)] bg-[rgba(124,58,237,0.16)] text-white"
                          : "border-[var(--line)] text-[var(--muted)] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="Anything else we should know?"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-xl placeholder:text-[rgba(139,138,165,0.5)] resize-none mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportOpen(false)}
                    className="flex-1 py-2.5 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    className="btn-primary flex-1 py-2.5 text-sm font-semibold rounded-xl"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(5,4,15,0.8)", backdropFilter: "blur(10px)" }}
        >
          <div className="glass glass-lit rounded-3xl w-full max-w-[400px] p-9 text-center relative rise">
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-5 right-5 text-[var(--muted)] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="relative w-20 h-20 mx-auto mb-6">
              <span
                className="absolute inset-0 rounded-full settle-pulse"
                style={{ background: "rgba(45,212,167,0.18)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Check size={30} className="text-settle" />
              </div>
            </div>

            <h2 className="display-lg text-white text-2xl mb-2">
              {creator.thankYouMessage || "Sent."}
            </h2>
            <p className="text-sm text-[var(--muted)] mb-7">
              <span className="font-mono-t text-white">${sentAmount} USDC</span>{" "}
              is in @{creator.username}'s wallet.
            </p>

            {txHash && successMode === "wallet" && (
              <button
                onClick={() =>
                  window.open(
                    `${ARC_EXPLORER}/tx/${txHash}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs text-[var(--violet-lo)] hover:text-white transition-colors mb-7"
              >
                View on Arc Explorer <ExternalLink size={11} />
              </button>
            )}

            <div className="space-y-2">
              <button
                onClick={() => (window.location.href = "/signup")}
                className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
              >
                Get your own link
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full py-3 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
              >
                Send another
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
