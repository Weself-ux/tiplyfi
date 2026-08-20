import { useEffect, useState } from "react";
import { track } from "../../../utils/track";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Wallet, X, Zap } from "lucide-react";
import {
  formatAddress,
  ARC_EXPLORER,
  computeTipAmounts,
  tipViaRouter,
  weiToDisplay,
} from "../../../utils/arc-config";
import WalletPicker from "../../../utils/WalletPicker";
import { confirmTip, flushTipQueue } from "../../../utils/tipQueue";
import Logo from "../../../utils/Logo";

/// No loader: this codebase's layout plugin can't forward server-only route
/// exports without pulling them into the client graph. meta receives params
/// directly, which is enough for a valid preview card — the thing that
/// actually costs conversions when a creator shares their link.
export function meta({ params }) {
  const handle = String(params?.username || "").toLowerCase();
  const url = `https://tiplyfi.vercel.app/${handle}`;
  const title = handle ? `Support @${handle} on Tiplyfi` : "Tiplyfi";
  const description = handle
    ? `Send @${handle} a tip in USDC. It arrives in under a second, straight to their wallet — no account needed.`
    : "Get paid in USDC, in under a second.";

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "profile" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "Tiplyfi" },
    // WhatsApp renders no card at all without an image, unlike X and Discord
    // which will show title and description alone.
    { property: "og:image", content: "https://tiplyfi.vercel.app/og-image.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Tiplyfi — get paid in USDC" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: "https://tiplyfi.vercel.app/og-image.png" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

const AMOUNTS = ["1", "5", "10", "25"];

const NETWORKS = [
  { id: "arc", label: "Arc", available: true },
  { id: "base", label: "Base", available: false },
  { id: "polygon", label: "Polygon", available: false },
  { id: "arbitrum", label: "Arbitrum", available: false },
  { id: "op", label: "OP", available: false },
  { id: "sepolia", label: "Ethereum", available: false },
  { id: "avalanche", label: "Avalanche", available: false },
  { id: "solana", label: "Solana", available: false },
];

 /// Defined at module level, not inside TipPage. A component declared inside
/// another is a new function on every render, so React remounts the whole
/// tree and any focused input loses focus after one keystroke.
function Shell({ accent, children }) {
  return (
    <div className="relative min-h-screen bg-ink overflow-hidden flex flex-col items-center justify-center px-4 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[26%] left-1/2 -translate-x-1/2 w-[85vw] h-[70vw] rounded-full drift"
        style={{
          background: `radial-gradient(circle, ${accent}55 0%, ${accent}00 66%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[30%] -right-[18%] w-[55vw] h-[55vw] rounded-full drift-slow"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.30) 0%, rgba(59,130,246,0) 70%)",
          filter: "blur(50px)",
        }}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full grid-mask"
        style={{ opacity: 0.45 }}
      >
        <defs>
          <pattern id="tip-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tip-grid)" />
      </svg>
      <div className="relative z-10 w-full flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}

export default function TipPage({ params }) {
  const { username } = params;
  const [mode, setMode] = useState("wallet");
  const [network, setNetwork] = useState("arc");
  const [wallet, setWallet] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [amount, setAmount] = useState("5");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [sentAmount, setSentAmount] = useState("");
  const [supportTiplyfi, setSupportTiplyfi] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("impersonation");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    flushTipQueue();
    track("tip_page_view", {}, username);
  }, [username]);

  const {
    data: creator,
    isLoading: creatorLoading,
    error: creatorError,
  } = useQuery({
    queryKey: ["creator", username],
    queryFn: async () => {
      const res = await fetch(`/api/user/${username}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("not_found");
        throw new Error("Failed to load creator");
      }
      return res.json();
    },
  });

  const finalAmount = customAmount || amount;
  const routerAddress = creator?.tipRouterAddress || "";
  const underReview = creator?.status === "under_review";
  const accent = creator?.accentColor || "#7c3aed";
  const socials = creator?.socialLinks || {};
  const socialEntries = Object.entries(socials).filter(([, v]) => v);
  const feePaidByFan = creator?.feeMode === "fan_pays";

  const validAmount =
    finalAmount && !isNaN(finalAmount) && Number(finalAmount) > 0;
  const amounts = validAmount
    ? computeTipAmounts(finalAmount, feePaidByFan, supportTiplyfi)
    : null;

  async function submitReport() {
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          reason: reportReason,
          detail: reportDetail || null,
        }),
      });
    } catch {}
    setReportSent(true);
  }

  async function handleWalletTip() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!amounts) {
      setStatus("Enter a valid amount.");
      return;
    }

    const clientRef =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const routed = Boolean(routerAddress);
    const netUsdc = routed ? weiToDisplay(amounts.netWei) : finalAmount;
    const grossUsdc = routed ? weiToDisplay(amounts.tipTotalWei) : finalAmount;
    const platformTipUsdc = routed ? weiToDisplay(amounts.platformTipWei) : "0";
    const feeUsdc = routed ? weiToDisplay(amounts.feeWei) : "0";

    let tipId = null;

    try {
      setLoading(true);

      setStatus("Preparing...");
      try {
        const prep = await fetch("/api/tips/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRef,
            creatorUsername: username,
            creatorAddress: creator.walletAddress,
            tipperAddress: wallet.address,
            amount: netUsdc,
            amountUsdc: parseFloat(netUsdc),
            grossUsdc: parseFloat(grossUsdc),
            feeUsdc: parseFloat(feeUsdc),
            platformTipUsdc: parseFloat(platformTipUsdc),
            message: message || null,
          }),
        });
        if (prep.ok) {
          const data = await prep.json();
          tipId = data.tipId ?? null;
        } else {
          console.error("[tiplyfi] prepare failed", prep.status);
          setStatus("Could not save your message. Continuing...");
        }
      } catch (prepErr) {
        console.warn("[tiplyfi] prepare failed", prepErr);
      }

      // Never fall back to a direct transfer. It would pay no fee, emit no
      // Tipped event, and leave the creator's dashboard empty.
      if (!routed) {
        console.error("[tiplyfi] no router address; refusing to send");
        throw new Error("Tipping is temporarily unavailable. Nothing was sent.");
      }

      setStatus("Confirm in your wallet...");
      track("tip_started", { amount: Number(netUsdc) }, username);
      const hash = await tipViaRouter({
        creatorAddress: creator.walletAddress,
        routerAddress,
        platformTipWei: amounts.platformTipWei,
        valueWei: amounts.valueWei,
        feeWei: amounts.feeWei,
        message: message || null,
        provider: wallet.provider,
      });
      setTxHash(hash);

      await confirmTip({ tipId, clientRef, txHash: hash });

      track(
        "tip_completed",
        { amount: Number(netUsdc), supportedPlatform: supportTiplyfi },
        username,
      );
      setShowSuccess(true);
      setSentAmount(netUsdc);
      setAmount("5");
      setCustomAmount("");
      setMessage("");
      setStatus("");
      setSupportTiplyfi(false);
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (creatorError?.message === "not_found") {
    return (
       <Shell accent={accent}>
        <div className="glass glass-lit rounded-3xl p-10 max-w-[400px] w-full text-center rise">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
            <X size={22} className="text-[var(--muted)]" />
          </div>
          <h2 className="display-md text-white text-xl mb-2">Nobody here yet</h2>
          <p className="text-sm text-[var(--muted)] mb-7">
            tiplyfi.app/{username} hasn't been claimed. It could be yours.
          </p>
          <button
            onClick={() => (window.location.href = `/signup?u=${username}`)}
            className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
          >
            Claim this link
          </button>
        </div>
      </Shell>
    );
  }

  if (creatorError) {
    return (
      	<Shell accent={accent}>
        <div className="glass glass-lit rounded-3xl p-10 max-w-[400px] w-full text-center rise">
          <h2 className="display-md text-white text-xl mb-2">
            Couldn't load this page
          </h2>
          <p className="text-sm text-[var(--muted)] mb-7">
            Something went wrong on our side.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (creatorLoading || !creator) {
    return (
      	<Shell accent={accent}>
        <Loader2 size={24} className="text-[var(--violet-lo)] animate-spin" />
      </Shell>
    );
  }

  const initial = creator.username ? creator.username[0].toUpperCase() : "?";
  const longBio = (creator.bio || "").length > 150;

  return (
    	<Shell accent={accent}>
      {showPicker && (
        <WalletPicker
          accent={accent}
          onConnect={(result) => {
            setWallet(result);
            setShowPicker(false);
            setStatus("");
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div
        className="glass glass-lit rounded-[26px] w-full max-w-[880px] overflow-hidden rise grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]"
        style={{ boxShadow: "0 50px 110px -45px rgba(0,0,0,0.95)" }}
      >
        {/* ── Creator ───────────────────────────────────────────── */}
        <div
          className="p-6 md:p-7 flex flex-col justify-center"
          style={{
            background: `linear-gradient(155deg, ${accent}E6, ${accent}59 55%, rgba(59,130,246,0.35))`,
          }}
        >
          {/* Compact on mobile so the form sits near the fold */}
          <div className="flex md:block items-center gap-4 md:text-center">
            <div
              className="w-14 h-14 md:w-[132px] md:h-[132px] rounded-full flex items-center justify-center display-md text-white text-xl md:text-[54px] md:mx-auto md:mb-5 flex-shrink-0 border border-white/25 md:border-white/15"
              style={{
                // Soft-edged so it melts into the gradient rather than
                // sitting on top of it as a hard disc.
                background:
                  "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.26), rgba(255,255,255,0.06) 62%, rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 22px 60px -24px rgba(0,0,0,0.55)",
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <h1 className="display-md text-white text-lg md:text-[22px] truncate md:whitespace-normal">
                {creator.displayName || creator.username}
              </h1>
              <p className="font-mono-t text-white/65 text-[12px] md:text-[13px] mt-0.5">
                @{creator.username}
              </p>
            </div>
          </div>

          {creator.category && (
            <span className="hidden md:inline-block mt-3 mx-auto text-[11px] font-medium text-white/90 bg-white/15 px-3 py-1 rounded-full">
              {creator.category}
            </span>
          )}

          {creator.bio && (
            <div className="mt-4 md:text-center">
              <p
                className="text-white/85 text-[13px] md:text-sm leading-relaxed"
                style={
                  bioOpen
                    ? undefined
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }
                }
              >
                {creator.bio}
              </p>
              {longBio && (
                <button
                  onClick={() => setBioOpen((o) => !o)}
                  className="text-[11px] text-white/60 hover:text-white transition-colors mt-1.5"
                >
                  {bioOpen ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {socialEntries.length > 0 && (
            <div className="flex flex-wrap md:justify-center gap-x-4 gap-y-1.5 mt-4">
              {socialEntries.map(([key, url]) => (
                <button
                  key={key}
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  className="text-[11px] font-medium text-white/70 hover:text-white capitalize transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          )}

          {creator.tipCount > 0 && (
            <div className="hidden md:flex items-center justify-center gap-6 mt-6 pt-5 border-t border-white/15">
              <div className="text-center">
                <p className="font-mono-t text-white text-lg">
                  {creator.tipCount}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">
                  {creator.tipCount === 1 ? "tip" : "tips"}
                </p>
              </div>
              {creator.supporterCount > 0 && (
                <div className="text-center">
                  <p className="font-mono-t text-white text-lg">
                    {creator.supporterCount}
                  </p>
                  <p className="text-[10px] text-white/60 mt-0.5">
                    {creator.supporterCount === 1 ? "supporter" : "supporters"}
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="font-mono-t text-white text-lg">
                  {new Date(creator.createdAt).getFullYear()}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">since</p>
              </div>
            </div>
          )}

          <div className="hidden md:flex items-center justify-center gap-2 mt-5 pt-4 border-t border-white/15">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--settle)] settle-pulse" />
            <span className="font-mono-t text-[10px] text-white/75">
              settles in under a second
            </span>
          </div>
        </div>

        {/* ── Tip ───────────────────────────────────────────────── */}
        <div className="flex flex-col border-t md:border-t-0 md:border-l border-[var(--line)]">
          <div className="flex border-b border-[var(--line)]">
            {[
              { id: "wallet", label: "Wallet", icon: Wallet },
              { id: "sponsored", label: "Card & bank", icon: Zap },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id);
                  setStatus("");
                  if (t.id === "sponsored") setWallet(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                  mode === t.id
                    ? "text-white"
                    : "text-[var(--muted)] hover:text-white/80"
                }`}
              >
                <t.icon size={15} />
                {t.label}
                {mode === t.id && (
                  <span
                    className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                    style={{ background: accent }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="p-5 flex-1 flex flex-col">
            {mode === "sponsored" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
                >
                  <Zap size={22} style={{ color: accent }} />
                </div>
                <h3 className="display-md text-white text-lg mb-2">
                  Card and bank, coming soon
                </h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed max-w-[260px]">
                  Supporters will be able to tip with a card or bank transfer —
                  no wallet, no crypto. It still lands in @{creator.username}'s
                  wallet as USDC.
                </p>
                <span className="mt-5 text-[10px] font-semibold text-[var(--muted)] bg-white/[0.06] px-2.5 py-1 rounded uppercase tracking-wider">
                  In development
                </span>
              </div>
            )}

            {mode === "wallet" && underReview && (
              <div className="mb-4 px-3 py-2.5 text-[13px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg">
                This page is being reviewed. Tipping is paused.
              </div>
            )}

            {mode === "wallet" && (
              <>
            {!wallet && (
              <div className="mb-4">
                <p className="eyebrow text-[var(--muted)] mb-2">Network</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {NETWORKS.map((n) => (
                    <button
                      key={n.id}
                      disabled={!n.available}
                      onClick={() => n.available && setNetwork(n.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                        network === n.id
                          ? "text-white"
                          : n.available
                            ? "text-[var(--muted)] border-[var(--line)] hover:text-white"
                            : "text-[rgba(139,138,165,0.4)] border-[var(--line)] cursor-not-allowed"
                      }`}
                      style={
                        network === n.id
                          ? { borderColor: accent, background: `${accent}22` }
                          : undefined
                      }
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg border border-[var(--line)] hover:border-[rgba(255,255,255,0.22)] hover:bg-white/[0.03] transition-colors"
                >
                  <Wallet size={15} />
                  Connect wallet
                </button>
              </div>
            )}

            {mode === "wallet" && wallet && (
              <div className="mb-4 flex items-center justify-between glass rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--settle)] settle-pulse" />
                  <span className="font-mono-t text-[12px] text-white">
                    {formatAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={() => setWallet(null)}
                  className="text-[11px] text-[var(--muted)] hover:text-white transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}

                        {mode === "wallet" && wallet && (
              <div className="mb-4 -mt-2 flex items-center justify-between px-1">
                <span className="text-[11px] text-[var(--muted)]">
                  On Arc Testnet. Need USDC to tip?
                </span>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      "https://faucet.circle.com",
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="text-[11px] text-[var(--settle)] hover:underline"
                >
                  Get testnet USDC
                </button>
              </div>
            )}

            <p className="eyebrow text-[var(--muted)] mb-2">Amount</p>
            <div className="grid grid-cols-4 gap-1.5 mb-1.5">
              {AMOUNTS.map((a) => {
                const active = amount === a && !customAmount;
                return (
                  <button
                    key={a}
                    onClick={() => {
                      setAmount(a);
                      setCustomAmount("");
                      setStatus("");
                    }}
                    className={`py-2.5 font-mono-t text-sm rounded-lg border transition-all duration-300 ${
                      active
                        ? "text-white"
                        : "text-[var(--muted)] border-[var(--line)] hover:text-white hover:border-[rgba(255,255,255,0.2)]"
                    }`}
                    style={
                      active
                        ? { borderColor: accent, background: `${accent}26` }
                        : undefined
                    }
                  >
                    ${a}
                  </button>
                );
              })}
            </div>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setAmount("");
                setStatus("");
              }}
              placeholder="Other amount"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 font-mono-t text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-lg placeholder:text-[rgba(139,138,165,0.5)] focus:border-[rgba(255,255,255,0.2)] transition-colors mb-4"
            />

            <p className="eyebrow text-[var(--muted)] mb-2">Message</p>
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setStatus("");
              }}
              placeholder="Say something nice"
              maxLength={200}
              className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-lg placeholder:text-[rgba(139,138,165,0.5)] focus:border-[rgba(255,255,255,0.2)] transition-colors mb-4"
            />

            {mode === "wallet" && amounts && routerAddress && (
              <div className="glass rounded-lg p-3 mb-4 text-[12px]">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[var(--muted)]">
                    Tip to @{creator.username}
                  </span>
                  <span className="font-mono-t text-white">
                    ${weiToDisplay(amounts.netWei)}
                  </span>
                </div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[var(--muted)]">Tiplyfi fee</span>
                  <span className="font-mono-t text-white">
                    ${weiToDisplay(amounts.feeWei)}
                  </span>
                </div>
                {supportTiplyfi && (
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[var(--muted)]">Support Tiplyfi</span>
                    <span className="font-mono-t text-white">
                      ${weiToDisplay(amounts.platformTipWei)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[var(--line)] font-semibold text-white">
                  <span>You pay</span>
                  <span className="font-mono-t">
                    ${weiToDisplay(amounts.valueWei)}
                  </span>
                </div>
                <label className="flex items-start gap-2 mt-2.5 pt-2.5 border-t border-[var(--line)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supportTiplyfi}
                    onChange={(e) => setSupportTiplyfi(e.target.checked)}
                    className="mt-0.5 accent-[var(--violet)]"
                  />
                  <span className="text-[var(--muted)] leading-snug text-[11px]">
                    {/* Show what ticking it would cost, not the current value,
                        which is zero while the box is unticked. */}
                    Add ${weiToDisplay(computeTipAmounts(finalAmount, feePaidByFan, true).platformTipWei)}{" "}
                    to support Tiplyfi
                  </span>
                </label>
              </div>
            )}

            {status && (
              <div className="mb-4 px-3 py-2.5 text-[13px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg break-words">
                {status}
              </div>
            )}

            <button
              onClick={handleWalletTip}
              disabled={
                loading ||
                underReview ||
                mode === "sponsored" ||
                !wallet
              }
              className="btn-primary w-full py-3 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  {status || "Sending..."}
                </span>
              ) : (
                `Send ${validAmount ? `$${finalAmount}` : ""} USDC`
              )}
            </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2.5">
        <button
          onClick={() => (window.location.href = "/signup")}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          <Logo size={20} />
          Get your own Tiplyfi link
        </button>
        <button
          onClick={() => setReportOpen(true)}
          className="text-[11px] text-[rgba(139,138,165,0.55)] hover:text-[var(--muted)] transition-colors"
        >
          Report this page
        </button>
      </div>

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(5,4,15,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}
        >
          <div className="glass glass-lit rounded-2xl w-full max-w-[380px] p-6 rise">
            {reportSent ? (
              <div className="text-center py-4">
                <p className="display-md text-white text-base mb-1">
                  Thanks for telling us
                </p>
                <p className="text-xs text-[var(--muted)] mb-6">
                  We review every report.
                </p>
                <button
                  onClick={() => {
                    setReportOpen(false);
                    setReportSent(false);
                    setReportDetail("");
                  }}
                  className="w-full py-2.5 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="display-md text-white text-base mb-1">
                  Report this page
                </h3>
                <p className="text-xs text-[var(--muted)] mb-5">
                  You don't need an account.
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    ["impersonation", "Pretending to be someone else"],
                    ["illegal", "Illegal or harmful content"],
                    ["spam", "Spam or a scam"],
                    ["other", "Something else"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setReportReason(value)}
                      className={`w-full text-left px-4 py-2.5 text-sm rounded-xl border transition-colors ${
                        reportReason === value
                          ? "border-[var(--violet-lo)] bg-[rgba(124,58,237,0.16)] text-white"
                          : "border-[var(--line)] text-[var(--muted)] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="Anything else we should know?"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 text-sm text-white bg-white/[0.04] border border-[var(--line)] rounded-xl placeholder:text-[rgba(139,138,165,0.5)] resize-none mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportOpen(false)}
                    className="flex-1 py-2.5 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    className="btn-primary flex-1 py-2.5 text-sm font-semibold rounded-xl"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(5,4,15,0.8)", backdropFilter: "blur(10px)" }}
        >
          <div className="glass glass-lit rounded-3xl w-full max-w-[400px] p-9 text-center relative rise">
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-5 right-5 text-[var(--muted)] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="relative w-20 h-20 mx-auto mb-6">
              <span
                className="absolute inset-0 rounded-full settle-pulse"
                style={{ background: "rgba(45,212,167,0.18)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Check size={30} className="text-settle" />
              </div>
            </div>

            <h2 className="display-lg text-white text-2xl mb-2">
              {creator.thankYouMessage || "Sent."}
            </h2>
            <p className="text-sm text-[var(--muted)] mb-7">
              <span className="font-mono-t text-white">${sentAmount} USDC</span>{" "}
              is in @{creator.username}'s wallet.
            </p>

            {txHash && (
              <button
                onClick={() =>
                  window.open(
                    `${ARC_EXPLORER}/tx/${txHash}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs text-[var(--violet-lo)] hover:text-white transition-colors mb-7"
              >
                View on Arc Explorer <ExternalLink size={11} />
              </button>
            )}

            <div className="space-y-2">
              <button
                onClick={() => (window.location.href = "/signup")}
                className="btn-primary w-full py-3 rounded-xl text-sm font-bold"
              >
                Get your own link
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full py-3 text-sm text-[var(--muted)] border border-[var(--line)] rounded-xl hover:text-white transition-colors"
              >
                Send another
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
