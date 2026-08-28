import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import useSession from "../../utils/useSession";
import AutoSaveCard from "../dashboard/AutoSaveCard";
import TipSplitCard from "./TipSplitCard";
import LiveStreamToggle from "./LiveStreamToggle";

const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "NGN", label: "Nigerian Naira" },
  { code: "KES", label: "Kenyan Shilling" },
  { code: "GHS", label: "Ghanaian Cedi" },
  { code: "ZAR", label: "South African Rand" },
  { code: "INR", label: "Indian Rupee" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "PHP", label: "Philippine Peso" },
  { code: "IDR", label: "Indonesian Rupiah" },
  { code: "CAD", label: "Canadian Dollar" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "sw", label: "Kiswahili" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "id", label: "Bahasa Indonesia" },
];

function Section({ title, children }) {
  return (
    <div className="card p-6 mb-4">
      <h2 className="text-base font-semibold text-[#111827] mb-4">{title}</h2>
      {children}
    </div>
  );
}

// Self-contained grid cells -- each renders its own border, so a group of
// them can sit two-across in a grid instead of stacking one full-width row
// per item.
function InfoCell({ label, value }) {
  return (
    <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3.5 py-3">
      <p className="text-xs text-[#9CA3AF] mb-0.5">{label}</p>
      <p className="text-sm text-[#111827] font-medium truncate">{value}</p>
    </div>
  );
}

function SoonRow({ label }) {
  return (
    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3.5 py-3">
      <span className="text-sm text-[#9CA3AF]">{label}</span>
      <span className="text-[10px] font-semibold text-[#6B7280] bg-white px-2 py-1 rounded uppercase tracking-wider flex-shrink-0 ml-2">
        Soon
      </span>
    </div>
  );
}

function LiveRow({ label }) {
  return (
    <div className="flex items-center justify-between bg-[rgba(45,212,167,0.06)] border border-[rgba(45,212,167,0.25)] rounded-lg px-3.5 py-3">
      <span className="text-sm text-[#111827]">{label}</span>
      <span className="text-[10px] font-semibold text-[#059669] bg-[rgba(45,212,167,0.15)] px-2 py-1 rounded uppercase tracking-wider flex-shrink-0 ml-2">
        Live
      </span>
    </div>
  );
}

function LinkRow({ label, href, cta }) {
  return (
    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3.5 py-3">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <button
        onClick={() => (window.location.href = href)}
        className="text-sm text-[#7c3aed] font-medium hover:text-[#6d28d9] flex-shrink-0 ml-2"
      >
        {cta}
      </button>
    </div>
  );
}

function FeeToggle() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["feeMode"],
    queryFn: async () => {
      const token = localStorage.getItem("tiplyfi_token");
      if (!token) return null;
      const res = await fetch("/api/user/fee-mode", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const fanPays = data?.feeMode === "fan_pays";

  async function toggle() {
    if (saving) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("tiplyfi_token");
      const res = await fetch("/api/user/fee-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          feeMode: fanPays ? "creator_absorbs" : "fan_pays",
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["feeMode"] });
    } catch {
      alert("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#111827] mb-0.5">
          {fanPays ? "Supporter covers the fee" : "Recommended"}
        </p>
        <p className="text-sm text-[#6B7280]">
          {fanPays
            ? "Your supporters pay the fee on top of their tip, so you receive the full amount."
            : "The fee comes out of each tip."}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={fanPays}
        className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
          fanPays ? "bg-[#7c3aed]" : "bg-[#E5E7EB]"
        }`}
      >
        <span
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
            fanPays ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function PreferenceSelect({ label, note, options, value, onChange, saving }) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="block text-sm font-medium text-[#111827] mb-1">
        {label}
      </label>
      <p className="text-xs text-[#6B7280] mb-2">{note}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        className="w-full px-3 py-2.5 text-sm text-[#111827] bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#7c3aed] disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: prefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const token = localStorage.getItem("tiplyfi_token");
      if (!token) return null;
      const res = await fetch("/api/user/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  async function savePreference(patch) {
    setSaving(true);
    setSaved(false);
    try {
      const token = localStorage.getItem("tiplyfi_token");
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="page-light">
      <nav className="nav-light sticky top-0 z-50">
        <div className="max-w-[900px] mx-auto px-6 flex items-center gap-3 h-14">
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="display-md text-[17px] text-[#111827]">Settings</span>
          {saved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-[900px] mx-auto px-6 py-8">
        <Section title="Account">
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoCell label="Email" value={user.email} />
            <InfoCell label="Username" value={`@${user.username}`} />
            <InfoCell label="Member since" value={memberSince} />
            <SoonRow label="Change password" />
            <SoonRow label="Change email" />
            <SoonRow label="Delete account" />
          </div>
        </Section>

        <Section title="Fee">
          <FeeToggle />
          <div className="grid sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-[#F3F4F6]">
            <SoonRow label="Withdraw to bank account" />
            <SoonRow label="Accept card and bank tips" />
            <LiveRow label="Accept tips from any chain" />
            <SoonRow label="Accept tips in any token" />
          </div>
        </Section>

        <Section title="Preferences">
          <div className="grid sm:grid-cols-2 gap-x-6">
            <PreferenceSelect
              label="Currency"
              note="Choose how amounts are shown to you. Tips are always sent and held in USDC."
              options={CURRENCIES}
              value={prefs?.currency || "USD"}
              onChange={(v) => savePreference({ currency: v })}
              saving={saving}
            />
            <PreferenceSelect
              label="Language"
              note="Translations are rolling out soon. Your choice is saved now."
              options={LANGUAGES}
              value={prefs?.language || "en"}
              onChange={(v) => savePreference({ language: v })}
              saving={saving}
            />
          </div>
        </Section>

        <Section title="Notifications">
          <div className="grid sm:grid-cols-2 gap-3">
            <SoonRow label="Email me about new tips" />
            <SoonRow label="Minimum amount for notifications" />
            <SoonRow label="Webhook URL" />
          </div>
        </Section>

        <Section title="Security">
          <div className="grid sm:grid-cols-2 gap-3">
            <LinkRow label="Wallet key" href="/dashboard" cta="Manage in Wallet" />
            <SoonRow label="PIN and recovery" />
            <SoonRow label="Linked accounts" />
          </div>
        </Section>

        <Section title="Automation">
          <div className="pb-4 mb-4 border-b border-[#F3F4F6]">
            <p className="text-sm font-medium text-[#111827] mb-3">
              Auto-save a share of every tip
            </p>
            <AutoSaveCard />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <SoonRow label="Auto-withdraw above a threshold" />
          </div>
        </Section>

        <Section title="Tip split">
          <TipSplitCard />
        </Section>

        <Section title="Integrations">
          <div className="grid sm:grid-cols-2 gap-3">
            <SoonRow label="Embedded tip widget" />
            <SoonRow label="Recurring tips" />
            <LiveStreamToggle />
            <SoonRow label="Creator API" />
          </div>
        </Section>
      </div>
    </div>
  );
}
