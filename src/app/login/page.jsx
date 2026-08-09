import { useState } from "react";
import { Loader2 } from "lucide-react";
import { loginWithGoogle } from "../../utils/circleSdk";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const result = await loginWithGoogle();

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

      // No account for this Google identity yet — send them to pick a username.
      if (!data.registered) {
        window.location.href = "/signup";
        return;
      }

      localStorage.setItem("tipjar_token", data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message);
    } finally {
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
