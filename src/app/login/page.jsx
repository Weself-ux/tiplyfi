import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { initSdk, startGoogleLogin } from "../../utils/circleSdk";
import Atmosphere from "../../utils/Atmosphere";
import Logo from "../../utils/Logo";

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sdkRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sdk = await initSdk(() => {});
        if (cancelled) return;
        sdkRef.current = sdk;
        setReady(true);
      } catch (e) {
        setError(e.message);
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
      // Google returns to /signup, which handles both branches — a returning
      // creator lands straight on the dashboard.
      await startGoogleLogin(sdkRef.current);
    } catch (e) {
      setError(e.message);
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
          <h1 className="display-lg text-white text-[26px] mb-2">Welcome back</h1>
          <p className="text-sm text-[var(--muted)] mb-7">
            Sign in to your Tiplyfi account.
          </p>

          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 break-words">
              {error}
            </p>
          )}

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

          <p className="text-xs text-[var(--muted)] text-center mt-7">
            New to Tiplyfi?{" "}
            <button
              onClick={() => (window.location.href = "/signup")}
              className="text-[var(--violet-lo)] font-medium hover:text-white transition-colors"
            >
              Create your page
            </button>
          </p>
        </div>

        <p className="text-xs text-[rgba(139,138,165,0.6)] mt-6">
          Wallets powered by Circle
        </p>
      </div>
    </Atmosphere>
  );
}
