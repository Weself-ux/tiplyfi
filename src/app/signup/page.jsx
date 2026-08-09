import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { loginWithGoogle, executeChallenge } from "../../utils/circleSdk";

export default function SignupPage() {
  const [step, setStep] = useState("start"); // start | username | securing
  const [auth, setAuth] = useState(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      setAuth(result);

      const res = await fetch("/api/auth/circle/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: result.userToken,
          provider: result.provider,
          socialUserUUID: result.socialUserUUID,
          email: result.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed.");

      if (data.registered) {
        localStorage.setItem("tipjar_token", data.token);
        window.location.href = "/dashboard";
        return;
      }
      setStep("username");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setError("");
    const clean = username.toLowerCase().trim();
    if (clean.length < 3) {
      setError("Usernames need at least 3 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/circle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: auth.userToken,
          provider: auth.provider,
          socialUserUUID: auth.socialUserUUID,
          email: auth.email,
          name: auth.name,
          username: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create account.");

      localStorage.setItem("tipjar_token", data.token);
      setStep("securing");

      // Circle's own screens collect the PIN and security questions. The
      // wallet does not exist until this challenge completes.
      if (data.challengeId) {
        await executeChallenge({
          challengeId: data.challengeId,
          userToken: auth.userToken,
          encryptionKey: auth.encryptionKey,
        });
      }

      const done = await fetch("/api/auth/circle/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ userToken: auth.userToken }),
      });
      if (!done.ok) {
        const d = await done.json();
        throw new Error(d.error || "Wallet setup did not finish.");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message);
      setStep("username");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3FF] via-white to-[#EFF6FF] font-inter flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm w-full max-w-[400px] p-8">

        {step === "start" && (
          <>
            <h1 className="text-2xl font-bold text-[#111827] mb-1">
              Start accepting tips
            </h1>
            <p className="text-sm text-[#6B7280] mb-7">
              Create your page in under a minute. No crypto wallet needed.
            </p>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-[#111827] border border-[#E5E7EB] rounded-xl hover:border-[#C4B5FD] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <span className="text-base font-bold">G</span>
              )}
              Continue with Google
            </button>

            <div className="mt-6 space-y-2 text-xs text-[#6B7280]">
              <p className="flex items-start gap-2">
                <Check size={13} className="text-[#7c3aed] mt-0.5 flex-shrink-0" />
                A USDC wallet is created for you automatically
              </p>
              <p className="flex items-start gap-2">
                <Check size={13} className="text-[#7c3aed] mt-0.5 flex-shrink-0" />
                Only you can move your money — not even we can
              </p>
              <p className="flex items-start gap-2">
                <Check size={13} className="text-[#7c3aed] mt-0.5 flex-shrink-0" />
                Tips arrive in under a second
              </p>
            </div>
          </>
        )}

        {step === "username" && (
          <>
            <h1 className="text-2xl font-bold text-[#111827] mb-1">
              Pick your username
            </h1>
            <p className="text-sm text-[#6B7280] mb-6">
              This is your tip link. Supporters will see it.
            </p>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <div className="flex items-center border border-[#E5E7EB] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#7c3aed] mb-2">
              <span className="pl-3 text-sm text-[#9CA3AF] select-none">
                tiplyfi.app/
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="yourname"
                maxLength={30}
                autoFocus
                className="flex-1 px-1 py-3 text-sm text-[#111827] outline-none"
              />
            </div>
            <p className="text-xs text-[#9CA3AF] mb-6">
              Letters, numbers and underscores. This can't be changed later.
            </p>

            <button
              onClick={handleCreate}
              disabled={busy || username.length < 3}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight size={15} />
                </>
              )}
            </button>
          </>
        )}

        {step === "securing" && (
          <div className="text-center py-6">
            <Loader2 size={28} className="text-[#7c3aed] animate-spin mx-auto mb-5" />
            <h1 className="text-xl font-bold text-[#111827] mb-2">
              Securing your wallet
            </h1>
            <p className="text-sm text-[#6B7280] mb-4">
              Set a PIN and answer your security questions. This is the only way
              back into your account if you ever lose access to Google.
            </p>
            <p className="text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3 text-left">
              Write these down somewhere safe. Nobody — not Tiplyfi, not Circle —
              can recover your account or your money without them.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
