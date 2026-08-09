import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/// Social auth has one entry point: /signup handles both new and returning
/// users, because Google's redirect can only come back to one page.
export default function LoginPage() {
  useEffect(() => {
    window.location.replace("/signup");
  }, []);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
      <Loader2 size={24} className="text-[#7c3aed] animate-spin" />
    </div>
  );
}
