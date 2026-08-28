import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, Pencil } from "lucide-react";
import useSession from "../../utils/useSession";

const ACCENTS = [
  "#7c3aed", "#2563eb", "#0891b2", "#059669",
  "#ca8a04", "#ea580c", "#dc2626", "#db2777",
  "#4f46e5", "#111827",
];

const SOCIALS = [
  ["x", "X"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["twitch", "Twitch"],
  ["website", "Website"],
];

/// Always-visible labeled field. Blur commits, same as before -- just no
/// click-to-reveal step. A label sits above every input, always.
function LabeledField({
  label,
  value,
  placeholder,
  onSave,
  multiline = false,
  maxLength = 200,
  disabled = false,
  hint = "",
}) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  function commit() {
    if (!disabled && (draft || "") !== (value || "")) onSave(draft);
  }

  const shared = {
    value: draft,
    maxLength,
    disabled,
    placeholder,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    className:
      "w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] outline-none transition-colors focus:border-[#7c3aed] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]",
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea rows={4} {...shared} />
      ) : (
        <input
          type="text"
          {...shared}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</p>}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#F3F4F6] last:border-0">
      <span className="text-sm text-[#6B7280] flex-shrink-0">{label}</span>
      <div className="text-sm text-[#111827] text-right min-w-0">{children}</div>
    </div>
  );
}

function SoonRow({ label }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
      <span className="text-sm text-[#9CA3AF]">{label}</span>
      <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded uppercase tracking-wider">
        Soon
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useSession();
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("tiplyfi_token");
    if (!token) return;
    fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setProfile(d);
        setCategories(d.categories || []);
      })
      .catch(() => {});
  }, []);

  async function save(patch) {
    // Optimistic, but reconciled below — the server rejects some values
    // (a link with no dot in the hostname, for one) and the UI must not
    // keep showing something that wasn't stored.
    setProfile((p) => ({ ...p, ...patch }));
    try {
      const token = localStorage.getItem("tiplyfi_token");
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();

      const fresh = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null));
      if (fresh) setProfile((p) => ({ ...p, ...fresh }));

      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      alert("Could not save. Please try again.");
    }
  }

  function saveSocial(key, value) {
    const next = { ...(profile?.socialLinks || {}) };
    if (value && value.trim()) next[key] = value.trim();
    else delete next[key];
    save({ socialLinks: next });
  }

  if (loading || (user && !profile)) {
    return (
      <div className="page-light flex items-center justify-center">
        <Loader2 size={24} className="text-[#7c3aed] animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  const accent = profile.accentColor || "#7c3aed";
  const initial = user.username ? user.username[0].toUpperCase() : "?";
  const shortLink =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/" +
    user.username;
  const socialLinks = profile.socialLinks || {};

  return (
    <div className="page-light">
      <nav className="nav-light sticky top-0 z-50">
        <div className="max-w-[980px] mx-auto px-6 flex items-center gap-3 h-14">
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="display-md text-[17px] text-[#111827]">Your page</span>
          <div
            className={`ml-auto flex items-center gap-1.5 text-sm font-medium transition-opacity duration-500 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
            style={{ color: "var(--violet)" }}
          >
            <Check size={14} /> Saved
          </div>
        </div>
      </nav>

      <div className="max-w-[980px] mx-auto px-6 py-8">
        <div
          className="rounded-2xl overflow-hidden mb-6 flex items-center gap-4 px-6 py-4"
          style={{ background: `linear-gradient(90deg, ${accent}, #3b82f6)` }}
        >
          <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">
              {profile.displayName || user.fullName || user.username}
            </p>
            <p className="text-white/70 text-xs truncate">
              @{user.username}
              {profile.category ? ` · ${profile.category}` : ""}
            </p>
          </div>
          <button
            onClick={() => window.open(shortLink, "_blank", "noopener,noreferrer")}
            className="flex-shrink-0 text-xs font-medium text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors"
          >
            View as supporter →
          </button>
        </div>

        <div className="grid md:grid-cols-[240px_1fr] gap-6 items-start">
          {/* Left rail — photo, always vertical */}
          <div className="card p-6 flex flex-col items-center text-center">
            <div
              className="w-28 h-28 rounded-2xl flex items-center justify-center text-4xl font-bold text-white mb-4"
              style={{ background: `linear-gradient(135deg, ${accent}, #3b82f6)` }}
            >
              {initial}
            </div>
            <button
              onClick={() =>
                alert("Profile photos are coming soon. Your initial is used for now.")
              }
              className="w-full py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:border-[#7c3aed] transition-colors mb-2"
            >
              Upload photo
            </button>
            <span className="text-[11px] text-[#9CA3AF]">Coming soon</span>

            <div className="w-full mt-6 pt-5 border-t border-[#F3F4F6]">
              <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3 text-left">
                Accent colour
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => save({ accentColor: c })}
                    aria-label={c}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      accent.toLowerCase() === c
                        ? "ring-2 ring-offset-2 ring-[#111827] scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="w-full mt-6 pt-5 border-t border-[#F3F4F6] text-left">
              <SoonRow label="Dark mode" />
            </div>
          </div>

          {/* Right — everything else, horizontal grid within each section */}
          <div className="flex flex-col gap-4">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-[#111827] mb-4">
                Profile information
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <LabeledField
                  label="Username"
                  value={user.username}
                  disabled
                  hint="Set at signup, can't be changed."
                />
                <LabeledField
                  label="Display name"
                  value={profile.displayName || user.fullName || ""}
                  placeholder="Your name"
                  onSave={(v) => save({ displayName: v })}
                  maxLength={50}
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
                  Category
                </label>
                <select
                  value={profile.category || ""}
                  onChange={(e) => save({ category: e.target.value })}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#7c3aed] transition-colors"
                >
                  <option value="">Add a category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                <LabeledField
                  label="Bio"
                  value={profile.bio}
                  placeholder="Tell supporters about yourself"
                  onSave={(v) => save({ bio: v })}
                  multiline
                  maxLength={280}
                />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-[#111827] mb-4">Links</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {SOCIALS.map(([key, label]) => (
                  <LabeledField
                    key={key}
                    label={label}
                    value={socialLinks[key] || ""}
                    placeholder="Add link"
                    onSave={(v) => saveSocial(key, v)}
                  />
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-[#111827] mb-1">
                Custom message
              </h2>
              <p className="text-sm text-[#6B7280] mb-3">
                Shown to a supporter right after they tip you.
              </p>
              <LabeledField
                label="Thank-you message"
                value={profile.thankYouMessage}
                placeholder="Tip Sent! 🎉"
                onSave={(v) => save({ thankYouMessage: v })}
                maxLength={200}
              />
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-[#111827] mb-3">
                Your link
              </h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-[#374151] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2.5 truncate">
                  {shortLink}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shortLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="px-3 py-2.5 text-sm font-medium text-white bg-[#7c3aed] rounded-xl hover:bg-[#6d28d9] transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => window.open(shortLink, "_blank", "noopener,noreferrer")}
                className="mt-3 text-sm text-[#7c3aed] font-medium hover:text-[#6d28d9]"
              >
                View your page as a supporter →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
