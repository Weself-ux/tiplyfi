import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import {
  initSdk,
  startGoogleLogin,
  executeChallenge,
  isLoginPending,
  clearLoginPending,
  clearDeviceSession,
} from "../../utils/circleSdk";

export default function SignupPage() {
  // start -> username -> securing
  const [step, setStep] = useState("start");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Kept separate so a later action can't clear it.
  const [initError, setInitError] = useState("");
  const [username, setUsername] = useState("");

  const sdkRef = useRef(null);
  const authRef = useRef(null);

  // Google redirects the whole page, so the login result arrives here on the
  // next load rather than from a promise.
  useEffect(() => {
    let cancelled = false;

    async function onLoginComplete(err, result) {
      if (cancelled) return;
      clearLoginPending();

      if (err || !result?.userToken) {
        setError(err?.message || "Sign-in was cancelled.");
        setBusy(false);
        return;
      }

      authRef.current = {
        userToken: result.userToken,
        encryptionKey: result.encryptionKey,
        provider: result.oauthInfo?.provider || "google",
        socialUserUUID: result.oauthInfo?.socialUserUUID || null,
        email: result.oauthInfo?.socialUserInfo?.email || null,
        name: result.oauthInfo?.socialUserInfo?.name || null,
      };

      try {
        const res = await fetch("/api/auth/circle/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userToken: authRef.current.userToken,
            provider: authRef.current.provider,
            socialUserUUID: authRef.current.socialUserUUID,
            email: authRef.current.email,
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
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }

    (async () => {
      try {
        const sdk = await initSdk(onLoginComplete);
        if (cancelled) return;
        sdkRef.current = sdk;
        // A pending flag means we have just come back from Google and the
        // callback is about to fire — keep the spinner up until it does.
        if (isLoginPending()) {
          setBusy(true);
          // The callback fires on its own; this only stops a silent hang.
          setTimeout(() => {
            if (cancelled) return;
            clearLoginPending();
            setBusy(false);
            setError("Sign-in didn't complete. Please try again.");
          }, 30000);
        }
        setReady(true);
      } catch (e) {
        console.error("[tiplyfi] SDK init failed", e);
        setInitError(
          `${e.message} — ${String(e.stack || "").split("\n")[1] || ""}`,
        );
        // Deliberately not setting ready: a null SDK must not be clickable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await startGoogleLogin(sdkRef.current); // navigates away
    } catch (e) {
      // Temporary: the stack names the failing frame. Trim once sign-in works.
      console.error("[tiplyfi] google login failed", e);
      setError(`${e.message} — ${String(e.stack || "").split("\n")[1] || ""}`);
      setBusy(false);
    }
  }

  async function handleCreate() {
    const clean = username.toLowerCase().trim();
    if (clean.length < 3) {
      setError("Usernames need at least 3 characters.");
      return;
    }
    setError("");
    setBusy(true);

    try {
      const auth = authRef.current;
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

      // Circle's hosted screens collect the PIN and security questions.
      // The wallet does not exist until this challenge completes.
      if (data.challengeId) {
        await executeChallenge(sdkRef.current, {
          challengeId: data.challengeId,
          userToken: auth.userToken,
          encryptionKey: auth.encryptionKey,
        });
        // Circle needs a moment to index the new wallet.
        await new Promise((r) => setTimeout(r, 2000));
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

      clearDeviceSession();
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e.message);
      setStep("username");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3FF] via-white to-[#EFF6FF] font-inter flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm w-full max-w-[400px] p-8">

        {(initError || error) && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 break-words">
            {initError || error}
          </p>
        )}

        {step === "start" && (
          <>
            <h1 className="text-2xl font-bold text-[#111827] mb-1">
              Start accepting tips
            </h1>
            <p className="text-sm text-[#6B7280] mb-7">
              Create your page in under a minute. No crypto wallet needed.
            </p>

            <button
              onClick={handleGoogle}
              disabled={!ready || busy}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-[#111827] border border-[#E5E7EB] rounded-xl hover:border-[#C4B5FD] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
            >
              {busy || !ready ? (
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
                onKeyDown={(e) => e.key === "Enter" && !busy && handleCreate()}
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
              Set a PIN and answer your security questions.
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
