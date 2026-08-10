import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import Logo from "../utils/Logo";
import Atmosphere from "../utils/Atmosphere";
import { track } from "../utils/track";

/// Pulls the button a few pixels toward the cursor. CSS does the movement;
/// this only writes the offset.
function useMagnet(strength = 0.28) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function move(e) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - (r.left + r.width / 2)) * strength);
      el.style.setProperty("--my", (e.clientY - (r.top + r.height / 2)) * strength);
    }
    function reset() {
      el.style.setProperty("--mx", 0);
      el.style.setProperty("--my", 0);
    }
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", reset);
    };
  }, [strength]);
  return ref;
}

/// Reveals children once they scroll into view. One observer, no library.
function useReveal() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setSeen(true),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

function Section({ children, className = "" }) {
  const [ref, seen] = useReveal();
  return (
    <section
      ref={ref}
      className={`max-w-[1180px] mx-auto px-6 ${className}`}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.9s var(--ease-out-expo), transform 0.9s var(--ease-out-expo)",
      }}
    >
      {children}
    </section>
  );
}

export default function LandingPage() {
  const [handle, setHandle] = useState("");
  const magnetRef = useMagnet();

  useEffect(() => {
    track("landing_view");
  }, []);

  const shown = handle || "yourname";

  function claim() {
    const clean = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
    track("claim_submitted", { hasHandle: Boolean(clean) });
    window.location.href = clean ? `/signup?u=${clean}` : "/signup";
  }

  return (
    <Atmosphere>
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="max-w-[1180px] mx-auto px-6 h-20 flex items-center justify-between fade" style={{ "--d": "0.1s" }}>
        <div className="flex items-center gap-4">
          <Logo size={30} showWord className="text-white" />
          <span className="hidden sm:flex items-center gap-1.5 glass rounded-full px-3 py-1">
            <span
              className="w-1.5 h-1.5 rounded-full settle-pulse"
              style={{ background: "var(--settle)" }}
            />
            <span className="font-mono-t text-[10px] text-settle">
              Live on Arc Testnet
            </span>
          </span>
        </div>
        <div className="flex items-center gap-7">
          <button
            onClick={() => (window.location.href = "/howitworks")}
            className="text-sm text-[var(--muted)] hover:text-white transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => (window.location.href = "/login")}
            className="text-sm text-[var(--muted)] hover:text-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => (window.location.href = "/signup")}
            className="btn-primary text-sm font-semibold px-5 py-2.5 rounded-full"
          >
            Get your link
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="max-w-[1180px] mx-auto px-6 pt-16 pb-28 grid lg:grid-cols-[58%_42%] gap-14 items-center">
        <div>
          <p className="eyebrow text-[var(--violet-lo)] rise" style={{ "--d": "0.15s" }}>
            USDC on Arc
            <span className="mx-2 text-[var(--muted)]">·</span>
            <span className="text-settle">settles in under a second</span>
          </p>

          <h1 className="display-xl text-white text-[clamp(2.9rem,6.2vw,5rem)] mt-6">
            <span className="block overflow-hidden">
              <span className="reveal-line" style={{ "--d": "0.25s" }}>
                Every tip lands
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="reveal-line" style={{ "--d": "0.38s" }}>
                in your wallet.
              </span>
            </span>
            <span className="block overflow-hidden">
              <span
                className="reveal-line bg-gradient-to-r from-[var(--violet-lo)] to-[var(--azure)] bg-clip-text text-transparent"
                style={{ "--d": "0.51s" }}
              >
                Not ours.
              </span>
            </span>
          </h1>

          <p
            className="text-[var(--muted)] text-[17px] leading-relaxed mt-7 max-w-[440px] rise"
            style={{ "--d": "0.7s" }}
          >
            Share one link. Supporters send USDC straight to you — no account,
            no card processor, no waiting for a payout.
          </p>

          {/* The signature: claim your link */}
          <div className="mt-9 rise" style={{ "--d": "0.85s" }}>
            <div className="glass glass-lit rounded-2xl p-1.5 flex items-center gap-2 max-w-[520px] focus-within:border-[rgba(167,139,250,0.5)] transition-colors">
              <span className="font-mono-t text-[15px] text-[var(--muted)] pl-4 select-none whitespace-nowrap">
                tiplyfi.app/
              </span>
              <input
                value={handle}
                onFocus={() => track("claim_started")}
                onChange={(e) =>
                  setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && claim()}
                placeholder="yourname"
                maxLength={30}
                aria-label="Choose your Tiplyfi username"
                className="flex-1 bg-transparent font-mono-t text-[15px] text-white placeholder:text-[rgba(139,138,165,0.5)] py-3 min-w-0"
              />
              <button
                onClick={claim}
                className="btn-primary text-sm font-semibold px-5 py-3 rounded-xl flex items-center gap-1.5 flex-shrink-0"
              >
                Claim <ArrowRight size={15} />
              </button>
            </div>
            <p className="text-xs text-[rgba(139,138,165,0.75)] mt-3 pl-1">
              Free. Sign in with Google and your wallet is created for you.
            </p>
            <p className="text-xs text-[rgba(139,138,165,0.55)] mt-2 pl-1">
              Running on Arc Testnet — tips use test USDC with no real value.
            </p>
          </div>
        </div>

        {/* Live preview of the page being claimed */}
        <div className="rise lg:mt-10" style={{ "--d": "0.55s" }}>
          <div
            className="glass glass-lit rounded-[26px] overflow-hidden max-w-[380px] mx-auto"
            style={{
              transform: "rotate(1.6deg)",
              boxShadow: "0 50px 100px -40px rgba(0,0,0,0.9)",
            }}
          >
            <div
              className="px-7 py-8 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.9), rgba(59,130,246,0.75))",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center display-md text-white text-xl mx-auto mb-3 backdrop-blur-sm">
                {shown[0].toUpperCase()}
              </div>
              <p className="display-md text-white text-[17px]">@{shown}</p>
              <p className="text-white/65 text-xs mt-1">Support my work</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {["1", "5", "10", "25"].map((a, i) => (
                  <div
                    key={a}
                    className={`py-2.5 rounded-xl text-center font-mono-t text-sm border transition-colors ${
                      i === 1
                        ? "border-[var(--violet-lo)] bg-[rgba(124,58,237,0.18)] text-white"
                        : "border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    ${a}
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-[13px] mb-5">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Tip to @{shown}</span>
                  <span className="font-mono-t text-white">$4.70</span>
                </div>
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Tiplyfi fee</span>
                  <span className="font-mono-t text-white">$0.30</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[var(--line)] text-white font-semibold">
                  <span>They pay</span>
                  <span className="font-mono-t">$5.00</span>
                </div>
              </div>

              <div className="btn-primary rounded-xl py-3 text-center text-sm font-bold">
                Send $5 USDC
              </div>

              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--settle)] settle-pulse" />
                <span className="font-mono-t text-[11px] text-settle">
                  arrives in 0.4s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── The claim nobody else can make ──────────────────────── */}
      <Section className="py-24">
        <p className="eyebrow text-[var(--muted)] mb-5">Built so we can't</p>
        <h2 className="display-lg text-white text-[clamp(1.9rem,3.6vw,2.9rem)] max-w-[620px]">
          Other platforms promise they won't touch your money.
          <span className="text-settle"> We can't.</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {[
            {
              t: "No withdrawal function",
              d: "The contract pays whoever signs the transaction, and that's only ever you. There is no admin path to your funds — not for us, not under pressure.",
            },
            {
              t: "The rules can't change",
              d: "It isn't upgradeable. Whatever the contract does today is what it will still do in five years, regardless of who runs Tiplyfi.",
            },
            {
              t: "The fee is capped in code",
              d: "6% today, and a hard ceiling of 10% compiled into the bytecode. We can lower it. We can never raise it past that.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="glass glass-lit rounded-2xl p-6 hover:border-[rgba(167,139,250,0.35)] transition-colors duration-500"
            >
              <Check size={16} className="text-settle mb-4" />
              <h3 className="display-md text-white text-[16px] mb-2">{c.t}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl px-6 py-4 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs text-[var(--muted)]">Read it yourself</span>
          <code className="font-mono-t text-xs text-[var(--violet-lo)] break-all">
            0x707BBFCE1Ca35e72Bd40B1B6671b0807896a2f98
          </code>
        </div>
      </Section>

      {/* ── The maths ───────────────────────────────────────────── */}
      <Section className="py-24">
        <div className="grid lg:grid-cols-[42%_58%] gap-14 items-center">
          <div>
            <p className="eyebrow text-[var(--muted)] mb-5">One fee, no stack</p>
            <h2 className="display-lg text-white text-[clamp(1.9rem,3.6vw,2.9rem)]">
              Small tips are
              <br />
              where fees hurt.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed mt-6 max-w-[380px]">
              Card platforms take a percentage, then a payment processor takes
              another percentage plus a flat charge. That flat charge doesn't
              care that the tip was small — which is why a few dollars can
              lose most of its value on the way to you.
            </p>
            <p className="text-[var(--muted)] leading-relaxed mt-4 max-w-[380px]">
              Tiplyfi has one fee and no processor. Nothing is added on top.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-6">
              <p className="eyebrow text-[var(--muted)] mb-5">
                A typical card platform
              </p>
              {[
                ["Platform fee", "−$0.25"],
                ["Processor fee", "−$0.15"],
                ["Fixed charge", "−$0.30"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 text-sm">
                  <span className="text-[var(--muted)]">{k}</span>
                  <span className="font-mono-t text-[var(--muted)]">{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 mt-2 border-t border-[var(--line)]">
                <span className="text-sm text-white">You keep</span>
                <span className="font-mono-t text-[17px] text-white">$4.30</span>
              </div>
            </div>

            <div className="glass glass-lit rounded-2xl p-6 border-[rgba(45,212,167,0.28)]">
              <p className="eyebrow text-settle mb-5">Tiplyfi</p>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-[var(--muted)]">Tiplyfi fee</span>
                <span className="font-mono-t text-[var(--muted)]">−$0.30</span>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-[var(--muted)]">Processor fee</span>
                <span className="font-mono-t text-[var(--muted)]">none</span>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-[var(--muted)]">Fixed charge</span>
                <span className="font-mono-t text-[var(--muted)]">none</span>
              </div>
              <div className="flex justify-between pt-3 mt-2 border-t border-[var(--line)]">
                <span className="text-sm text-white">You keep</span>
                <span className="font-mono-t text-[17px] text-settle">$4.70</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[rgba(139,138,165,0.7)] mt-6 max-w-[620px]">
          Based on a $5 tip, with card processing at 2.9% plus a flat 30 cents —
          the standard rate most creator platforms pass through. Your own
          platform's rates may differ.
        </p>
      </Section>

      {/* ── Steps ───────────────────────────────────────────────── */}
      <Section className="py-24">
        <p className="eyebrow text-[var(--muted)] mb-5">Three steps</p>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              n: "01",
              t: "Claim your link",
              d: "Sign in with Google. A USDC wallet is created for you — nothing to install, no seed phrase to write down.",
            },
            {
              n: "02",
              t: "Share it anywhere",
              d: "X, YouTube, TikTok, Discord, your stream overlay, your bio. Supporters open it, pick an amount, and send — no account, no signup, no app.",
            },
            {
              n: "03",
              t: "Get paid instantly",
              d: "Tips land in your wallet in under a second. Withdraw whenever you want — it was never held anywhere else.",
            },
          ].map((s) => (
            <div key={s.n} className="glass rounded-2xl p-7">
              <span className="font-mono-t text-xs text-[var(--violet-lo)]">
                {s.n}
              </span>
              <h3 className="display-md text-white text-[18px] mt-4 mb-2">
                {s.t}
              </h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Questions ───────────────────────────────────────────── */}
      <Section className="py-24">
        <p className="eyebrow text-[var(--muted)] mb-5">Questions</p>
        <div className="grid lg:grid-cols-[38%_62%] gap-14">
          <h2 className="display-lg text-white text-[clamp(1.9rem,3.6vw,2.6rem)]">
            The ones people
            <br />
            actually ask.
          </h2>

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              {
                q: "Do my supporters need a crypto wallet?",
                a: "Not for long. Card and bank payments are coming, and supporters never create a Tiplyfi account either way — they open your link, pick an amount, and send.",
              },
              {
                q: "Do I need to know anything about crypto?",
                a: "No. Sign in with Google and a wallet is created for you. There's no seed phrase, no extension to install, and no network to configure.",
              },
              {
                q: "What is USDC?",
                a: "A dollar-backed stablecoin. A $5 tip is worth $5 — it doesn't move up or down. On Arc it's also what pays for the transaction, so there's no second token to hold.",
              },
              {
                q: "Where does Tiplyfi work?",
                a: "Anywhere. Card platforms need a payout provider that supports your country, which locks out most of Africa, South Asia and Southeast Asia. Tiplyfi needs a Google account.",
              },
              {
                q: "Can Tiplyfi freeze or take my money?",
                a: "No. The contract has no function that would let us, and it can't be upgraded to add one. If we ever remove your page for breaking our rules, your money stays exactly where it is — in your wallet.",
              },
              {
                q: "Is this real money right now?",
                a: "Not yet. Tiplyfi runs on Arc Testnet, where USDC is a test token with no monetary value. Mainnet comes after the contract is audited.",
              },
            ].map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-start justify-between gap-6 cursor-pointer list-none text-white text-[15px] font-medium marker:hidden">
                  {f.q}
                  <span className="text-[var(--violet-lo)] text-xl leading-none flex-shrink-0 transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-sm text-[var(--muted)] leading-relaxed mt-3 pr-10">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Close ───────────────────────────────────────────────── */}
      <Section className="py-28 text-center">
        <h2 className="display-xl text-white text-[clamp(2.2rem,5vw,3.8rem)] max-w-[760px] mx-auto">
          Your link is waiting.
        </h2>
        <p className="text-[var(--muted)] mt-5 max-w-[420px] mx-auto">
          Set up in two minutes. Free to start, free to keep.
        </p>
        <p className="font-mono-t text-[11px] text-[rgba(139,138,165,0.6)] mt-3">
          Wallets powered by Circle
        </p>
        <div ref={magnetRef} className="magnetic inline-block mt-9">
          <button
            onClick={() => (window.location.href = "/signup")}
            className="btn-primary text-[15px] font-bold px-9 py-4 rounded-full inline-flex items-center gap-2"
          >
            Get your link <ArrowRight size={17} />
          </button>
        </div>
      </Section>

      <footer className="border-t border-[var(--line)] mt-10">
        <div className="max-w-[1180px] mx-auto px-6 py-10 flex flex-wrap justify-between gap-y-8">
          <div>
            <Logo size={28} showWord className="text-white" />
            <div className="flex items-center gap-2 mt-3">
              <span
                className="w-1.5 h-1.5 rounded-full settle-pulse"
                style={{ background: "var(--settle)" }}
              />
              <span className="font-mono-t text-[11px] text-settle">
                Live on Arc Testnet
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="flex flex-wrap items-center justify-end gap-7">
              <button
                onClick={() => (window.location.href = "/howitworks")}
                className="text-sm text-[var(--muted)] hover:text-white transition-colors"
              >
                How it works
              </button>
              <button
                onClick={() => window.open("mailto:tipjar011@gmail.com", "_self")}
                className="text-sm text-[var(--muted)] hover:text-white transition-colors"
              >
                Contact us
              </button>
              <button
                onClick={() => (window.location.href = "/signup")}
                className="text-sm text-[var(--muted)] hover:text-white transition-colors"
              >
                Get your link
              </button>
            </div>
            <p className="font-mono-t text-[11px] text-[rgba(139,138,165,0.6)] mt-3">
              Built on Arc &amp; Circle
            </p>
          </div>
        </div>
      </footer>
    </Atmosphere>
  );
}
