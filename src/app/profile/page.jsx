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

/// Click to edit, blur to save. Renders as plain text until clicked, so the
/// page reads the way a supporter sees it.
function Editable({
  value,
  placeholder,
  onSave,
  multiline = false,
  maxLength = 200,
  className = "",
  inputClassName = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  function commit() {
    setEditing(false);
    if ((draft || "") !== (value || "")) onSave(draft);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`group inline-flex items-start gap-1.5 text-left ${className}`}
      >
        <span className={value ? "" : "opacity-60 italic"}>
          {value || placeholder}
        </span>
        <Pencil
          size={12}
          className="opacity-0 group-hover:opacity-60 mt-1 flex-shrink-0"
        />
      </button>
    );
  }

  const shared = {
    autoFocus: true,
    value: draft,
    maxLength,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    className: `w-full bg-white/95 text-[#111827] rounded-lg px-3 py-2 text-sm outline-none ${inputClassName}`,
  };

  return multiline ? (
    <textarea rows={3} {...shared} />
  ) : (
    <input
      type="text"
      {...shared}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value || "");
          setEditing(false);
        }
      }}
    />
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
    const token = localStorage.getItem("tipjar_token");
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
    setProfile((p) => ({ ...p, ...patch }));
    try {
      const token = localStorage.getItem("tipjar_token");
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
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
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#F9FAFB] font-inter">
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[560px] mx-auto px-6 flex items-center gap-3 h-14">
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-lg font-semibold text-[#111827] tracking-tight">
            Your page
          </span>
          {saved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-[560px] mx-auto px-6 py-8">
        <p className="text-sm text-[#6B7280] mb-4">
          This is how supporters see you. Click anything to edit it.
        </p>

        {/* Mirrors the supporter-facing header on /:username */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden mb-6">
          <div
            className="px-8 py-7 text-center"
            style={{ background: `linear-gradient(90deg, ${accent}, #3b82f6)` }}
          >
            <button
              onClick={() =>
                alert("Profile photos are coming soon. Your initial is used for now.")
              }
              className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3 backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              {initial}
            </button>

            <h1 className="text-white font-semibold text-xl">
              {user.fullName || user.username}
            </h1>
            <p className="text-white/70 text-sm mt-0.5">@{user.username}</p>

            <div className="mt-2">
              <select
                value={profile.category || ""}
                onChange={(e) => save({ category: e.target.value })}
                className="text-[11px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full outline-none cursor-pointer appearance-none text-center"
              >
                <option value="" className="text-[#111827]">
                  Add a category
                </option>
                {categories.map((c) => (
                  <option key={c} value={c} className="text-[#111827]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 max-w-[340px] mx-auto text-white/85 text-sm leading-relaxed">
              <Editable
                value={profile.bio}
                placeholder="Tell supporters about yourself"
                onSave={(v) => save({ bio: v })}
                multiline
                maxLength={280}
                className="w-full justify-center"
              />
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
              Links
            </p>
            {SOCIALS.map(([key, label]) => (
              <Row key={key} label={label}>
                <Editable
                  value={socialLinks[key] || ""}
                  placeholder="Add link"
                  onSave={(v) => saveSocial(key, v)}
                  className="max-w-[280px] truncate"
                />
              </Row>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
          <h2 className="text-base font-semibold text-[#111827] mb-4">
            Appearance
          </h2>
          <p className="text-sm text-[#6B7280] mb-3">Accent colour</p>
          <div className="flex flex-wrap gap-2 mb-1">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => save({ accentColor: c })}
                aria-label={c}
                className={`w-8 h-8 rounded-full transition-transform ${
                  accent.toLowerCase() === c
                    ? "ring-2 ring-offset-2 ring-[#111827] scale-110"
                    : "hover:scale-105"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-4">
            <SoonRow label="Profile photo" />
            <SoonRow label="Dark mode" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4">
          <h2 className="text-base font-semibold text-[#111827] mb-1">
            Custom message
          </h2>
          <p className="text-sm text-[#6B7280] mb-3">
            Shown to a supporter right after they tip you.
          </p>
          <div className="text-sm text-[#111827]">
            <Editable
              value={profile.thankYouMessage}
              placeholder="Tip Sent! 🎉"
              onSave={(v) => save({ thankYouMessage: v })}
              maxLength={200}
              className="w-full"
              inputClassName="border border-[#E5E7EB]"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
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
  );
}
