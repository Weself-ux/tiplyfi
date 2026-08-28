import { useState, useEffect } from "react";

function authedFetch(url, opts = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("tiplyfi_token") : null;
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
}

export default function LiveStreamToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authedFetch("/api/livestream/toggle")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEnabled(d.enabled === true))
      .catch(() => {});
  }, []);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    try {
      const res = await authedFetch("/api/livestream/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (res.ok) setEnabled(data.enabled === true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3.5 py-3">
      <div>
        <p className="text-sm text-[#111827] font-medium">Live stream mode</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">
          {enabled ? "On — flagged for overlay tools" : "Off"}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${
          enabled ? "bg-[#7c3aed]" : "bg-[#E5E7EB]"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
