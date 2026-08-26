import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";

function authedFetch(url, opts = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("tiplyfi_token") : null;
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function fetchState() {
  const res = await authedFetch("/api/tipsplit/state");
  if (!res.ok) return { cohosts: [], primaryPct: 100 };
  return res.json();
}

export default function TipSplitCard() {
  const { data, refetch } = useQuery({
    queryKey: ["tipsplitState"],
    queryFn: fetchState,
  });

  const [cohosts, setCohosts] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPct, setNewPct] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.cohosts) setCohosts(data.cohosts);
  }, [data]);

  const cohostTotal = cohosts.reduce((s, c) => s + Number(c.pct || 0), 0);
  const primaryPct = Math.max(0, 100 - cohostTotal);

  function addCohost() {
    const uname = newUsername.trim().toLowerCase();
    const pct = Number(newPct);
    if (!uname) {
      setStatus("Enter a username.");
      return;
    }
    if (!(pct > 0) || pct >= 100) {
      setStatus("Enter a share between 0 and 100.");
      return;
    }
    if (cohosts.some((c) => c.username === uname)) {
      setStatus(`${uname} is already added.`);
      return;
    }
    if (cohostTotal + pct >= 100) {
      setStatus("That leaves nothing for you -- lower the shares.");
      return;
    }
    setCohosts([...cohosts, { username: uname, pct }]);
    setNewUsername("");
    setNewPct("");
    setStatus("");
  }

  function removeCohost(uname) {
    setCohosts(cohosts.filter((c) => c.username !== uname));
  }

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const res = await authedFetch("/api/tipsplit/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohosts }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Couldn't save.");
      setStatus("Saved.");
      refetch();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-[#6B7280] mb-4">
        Split every tip you receive with collaborators — co-hosts, bandmates,
        guests. They need a Tiplyfi account. You keep whatever's left over.
      </p>

      <div className="flex items-center justify-between bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg px-4 py-3 mb-4">
        <span className="text-sm font-medium text-[#5B21B6]">You keep</span>
        <span className="text-sm font-bold text-[#5B21B6]">
          {primaryPct.toFixed(0)}%
        </span>
      </div>

      {cohosts.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {cohosts.map((c) => (
            <div
              key={c.username}
              className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-lg px-3 py-2"
            >
              <span className="text-sm text-[#374151]">@{c.username}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[#111827]">
                  {c.pct}%
                </span>
                <button
                  onClick={() => removeCohost(c.username)}
                  className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="username"
          className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#7c3aed]"
        />
        <input
          value={newPct}
          onChange={(e) => setNewPct(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="%"
          className="w-16 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#7c3aed]"
        />
        <button
          onClick={addCohost}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#F5F3FF] text-[#7c3aed] hover:bg-[#EDE9FE] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-3 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving..." : "Save split"}
      </button>

      {status && <p className="mt-2 text-xs text-[#6B7280]">{status}</p>}
    </div>
  );
}
