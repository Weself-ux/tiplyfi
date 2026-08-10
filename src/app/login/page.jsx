import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { initSdk, startGoogleLogin } from "../../utils/circleSdk";

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
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3FF] via-white to-[#EFF6FF] font-inter flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm w-full max-w-[400px] p-8">
        <h1 className="text-2xl font-bold text-[#111827] mb-1">Welcome back</h1>
        <p className="text-sm text-[#6B7280] mb-7">
          Sign in to your Tiplyfi account.
        </p>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 break-words">
            {error}
          </p>
        )}

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

        <p className="text-xs text-[#9CA3AF] text-center mt-6">
          New to Tiplyfi?{" "}
          <button
            onClick={() => (window.location.href = "/signup")}
            className="text-[#7c3aed] font-medium hover:text-[#6d28d9]"
          >
            Create your page
          </button>
        </p>
      </div>
    </div>
  );
}
