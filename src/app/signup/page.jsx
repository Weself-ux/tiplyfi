import { useEffect, useRef, useState } from "react";
import Atmosphere from "../../utils/Atmosphere";
import Logo from "../../utils/Logo";
import { track } from "../../utils/track";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import {
  initSdk,
  startGoogleLogin,
  isOauthReturn,
  prepareDeviceSession,
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
  const [username, setUsername] = useState(() => {
    // Carried from the landing page's claim field.
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("u") || "";
  });

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

      // The SDK types spell this oAuthInfo with a capital A; Circle's own
      // docs write oauthInfo. Read both so a doc fix can't break sign-in.
      const oauth = result.oAuthInfo || result.oauthInfo || {};
      authRef.current = {
        userToken: result.userToken,
        encryptionKey: result.encryptionKey,
        refreshToken: result.refreshToken,
        provider: oauth.provider || "google",
        socialUserUUID: oauth.socialUserUUID || null,
        email: oauth.socialUserInfo?.email || null,
        name: oauth.socialUserInfo?.name || null,
      };

      if (!authRef.current.socialUserUUID) {
        setError(
          `Google returned no user id. Fields: ${Object.keys(oauth).join(",") || "none"}`,
        );
        setBusy(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/circle/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userToken: authRef.current.userToken,
            refreshToken: authRef.current.refreshToken,
            encryptionKey: authRef.current.encryptionKey,
            provider: authRef.current.provider,
            socialUserUUID: authRef.current.socialUserUUID,
            email: authRef.current.email,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || data.error || "Sign-in failed.");
        }


        if (data.registered) {
          localStorage.setItem("tiplyfi_token", data.token);
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
        // Warm the device session while the page is being read, so the click
        // only has to redirect.
        // Never while Google's response is being processed — a new token
        // would invalidate the one it's being checked against.
        if (!isOauthReturn()) prepareDeviceSession(sdk).catch(() => {});
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
    track("signup_started");
    setError("");
    setBusy(true);
    try {
      await startGoogleLogin(sdkRef.current); // navigates away
    } catch (e) {
      // Temporary: the stack names the failing frame. Trim once sign-in works.
      setError(e.message);
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
          refreshToken: auth.refreshToken,
          encryptionKey: auth.encryptionKey,
          provider: auth.provider,
          socialUserUUID: auth.socialUserUUID,
          email: auth.email,
          name: auth.name,
          username: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Could not create account.");
      }

      localStorage.setItem("tiplyfi_token", data.token);
      track("signup_username_set", {}, clean);
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

      track("signup_completed", {}, clean);
      clearDeviceSession();
      // Small settle before a full page navigation, so the session write is
      // visible to the dashboard's first render.
      await new Promise((r) => setTimeout(r, 300));
      window.location.replace("/dashboard");
    } catch (e) {
      setError(e.message);
      setStep("username");
      setBusy(false);
    }
  }

 return (
    <Atmosphere>
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <button
          onClick={() => (window.location.href = "/")}
          className="mb-8 rise"
          style={{ "--d": "0.05s" }}
        >
          <Logo size={30} showWord className="text-white" />
        </button>

        <div
          className="glass glass-lit rounded-[26px] w-full max-w-[400px] p-8 rise"
          style={{ "--d": "0.15s", boxShadow: "0 50px 110px -45px rgba(0,0,0,0.95)" }}
        >
          {(initError || error) && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 break-words">
              {initError || error}
            </p>
          )}

          {/* Returning from Google. Both /login and /signup come back here,
              so the form must not flash while we work out which you are. */}
          {step === "start" && busy && (
            <div className="text-center py-6">
              <Loader2
                size={26}
                className="text-[var(--violet-lo)] animate-spin mx-auto mb-5"
              />
              <h1 className="display-md text-white text-xl mb-1">
                Signing you in
              </h1>
              <p className="text-sm text-[var(--muted)]">One moment.</p>
            </div>
          )}

          {step === "start" && !busy && (
            <>
              <h1 className="display-lg text-white text-[26px] mb-2">
                Start accepting tips
              </h1>
              <p className="text-sm text-[var(--muted)] mb-7">
                Set up in two minutes. No crypto wallet needed.
              </p>

              <button
                onClick={handleGoogle}
                disabled={!ready || busy}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-semibold text-white rounded-xl border border-[var(--line)] hover:border-[rgba(255,255,255,0.24)] hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
              >
                {busy || !ready ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span className="text-base font-bold">G</span>
                )}
                Continue with Google
              </button>

              <div className="mt-7 space-y-2.5">
                {[
                  "A USDC wallet is created for you automatically",
                  "Only you can move your money — not even we can",
                  "Tips arrive in under a second",
                ].map((t) => (
                  <p key={t} className="flex items-start gap-2.5 text-xs text-[var(--muted)]">
                    <Check size={13} className="text-settle mt-0.5 flex-shrink-0" />
                    {t}
                  </p>
                ))}
              </div>
            </>
          )}

          {step === "username" && (
            <>
              <h1 className="display-lg text-white text-[26px] mb-2">
                Pick your username
              </h1>
              <p className="text-sm text-[var(--muted)] mb-6">
                This is your tip link. Supporters will see it.
              </p>

              <div className="flex items-center rounded-xl border border-[var(--line)] bg-white/[0.04] overflow-hidden focus-within:border-[rgba(167,139,250,0.5)] transition-colors mb-2">
                <span className="pl-4 font-mono-t text-sm text-[var(--muted)] select-none">
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
                  className="flex-1 px-1 py-3.5 bg-transparent font-mono-t text-sm text-white placeholder:text-[rgba(139,138,165,0.5)] min-w-0"
                />
              </div>
              <p className="text-xs text-[var(--violet-lo)] mb-1.5">
                Use the name your fans already know you by — on Twitch,
                TikTok, X, wherever they found you.
              </p>
              <p className="text-xs text-[rgba(139,138,165,0.7)] mb-6">
                Letters, numbers and underscores. This can't be changed later.
              </p>

              <button
                onClick={handleCreate}
                disabled={busy || username.length < 3}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold disabled:opacity-40"
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
            <div className="text-center py-4">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <span
                  className="absolute inset-0 rounded-full settle-pulse"
                  style={{ background: "rgba(45,212,167,0.16)" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={24} className="text-settle animate-spin" />
                </div>
              </div>
              <h1 className="display-md text-white text-xl mb-2">
                Creating your wallet
              </h1>
              <p className="text-xs text-amber-200/85 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-left mt-5">
                Keep access to this Google account. It's how you get back into
                your wallet, and nobody — not Tiplyfi, not Circle — can restore
                it for you.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-[rgba(139,138,165,0.6)] mt-6">
          Wallets powered by Circle
        </p>
      </div>
    </Atmosphere>
  );
}

export function meta() {
  return [
    { title: "Start accepting tips — Tiplyfi" },
    { name: "description", content: "Set up in two minutes. No crypto wallet needed." },
    { name: "robots", content: "noindex" },
  ];
}
