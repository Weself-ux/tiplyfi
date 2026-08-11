import { ArrowRight, Check } from "lucide-react";
import Atmosphere from "../../utils/Atmosphere";
import Logo from "../../utils/Logo";

const CREATOR_STEPS = [
  {
    n: "01",
    t: "Claim your link",
    d: "Sign in with Google and pick a username. A USDC wallet is created for you — nothing to install, no seed phrase to write down, no network to configure.",
  },
  {
    n: "02",
    t: "Share it anywhere",
    d: "Your link works in a bio, a video description, a stream overlay, a group chat. Anywhere you can paste a URL, you can take payments.",
  },
  {
    n: "03",
    t: "Get paid, then withdraw",
    d: "Tips land in your wallet in under a second. Move them out whenever you like — the money was never held anywhere else.",
  },
];

const FAN_STEPS = [
  {
    n: "01",
    t: "They open your link",
    d: "No account, no signup, no app. Your page loads with your name, your bio and your links.",
  },
  {
    n: "02",
    t: "They pick an amount",
    d: "A preset or their own number, plus a message if they want to say something.",
  },
  {
    n: "03",
    t: "It arrives",
    d: "One confirmation and the USDC is yours. They see the transaction on Arc's explorer if they want to check.",
  },
];

export default function HowItWorks() {
  return (
    <Atmosphere>
      <nav className="max-w-[1000px] mx-auto px-6 h-20 flex items-center justify-between">
        <button onClick={() => (window.location.href = "/")}>
          <Logo size={30} showWord className="text-white" />
        </button>
        <button
          onClick={() => (window.location.href = "/signup")}
          className="btn-primary text-sm font-semibold px-5 py-2.5 rounded-full"
        >
          Get your link
        </button>
      </nav>

      <div className="max-w-[1000px] mx-auto px-6 pt-12 pb-24">
        <p className="eyebrow text-[var(--violet-lo)] rise" style={{ "--d": "0.1s" }}>
          How it works
        </p>
        <h1
          className="display-xl text-white text-[clamp(2.4rem,5.2vw,4rem)] mt-5 max-w-[720px] rise"
          style={{ "--d": "0.2s" }}
        >
          Payments without the payment company.
        </h1>
        <p
          className="text-[var(--muted)] text-[17px] leading-relaxed mt-6 max-w-[520px] rise"
          style={{ "--d": "0.3s" }}
        >
          Tiplyfi isn't a middleman holding your earnings until payout day.
          Money goes from your supporter to you, and a contract takes our 6%
          on the way past.
        </p>

        {/* Creator */}
        <section className="mt-20">
          <p className="eyebrow text-[var(--muted)] mb-6">For you</p>
          <div className="grid md:grid-cols-3 gap-5">
            {CREATOR_STEPS.map((s) => (
              <div key={s.n} className="glass glass-lit rounded-2xl p-7">
                <span className="font-mono-t text-xs text-[var(--violet-lo)]">
                  {s.n}
                </span>
                <h3 className="display-md text-white text-[18px] mt-4 mb-2">
                  {s.t}
                </h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Supporter */}
        <section className="mt-16">
          <p className="eyebrow text-[var(--muted)] mb-6">For your supporters</p>
          <div className="grid md:grid-cols-3 gap-5">
            {FAN_STEPS.map((s) => (
              <div key={s.n} className="glass rounded-2xl p-7">
                <span className="font-mono-t text-xs text-settle">{s.n}</span>
                <h3 className="display-md text-white text-[18px] mt-4 mb-2">
                  {s.t}
                </h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Under the hood */}
        <section className="mt-20 grid lg:grid-cols-[42%_58%] gap-14 items-start">
          <div>
            <p className="eyebrow text-[var(--muted)] mb-5">Under the hood</p>
            <h2 className="display-lg text-white text-[clamp(1.7rem,3.2vw,2.4rem)]">
              Where the money actually goes.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed mt-5">
              Every tip is one transaction on Arc, Circle's blockchain for
              stablecoin payments. USDC is both the money and the gas, so
              there's no second token to hold.
            </p>
          </div>

          <div className="glass glass-lit rounded-2xl p-7">
            {[
              ["Supporter sends", "$5.00", "from their wallet"],
              ["You receive", "$4.70", "straight to your address"],
              ["Tiplyfi takes", "$0.30", "6%, capped at 10% in code"],
            ].map(([k, v, note], i) => (
              <div
                key={k}
                className={`flex items-start justify-between gap-6 py-4 ${
                  i < 2 ? "border-b border-[var(--line)]" : ""
                }`}
              >
                <div>
                  <p className="text-sm text-white">{k}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{note}</p>
                </div>
                <span
                  className={`font-mono-t text-[17px] ${i === 1 ? "text-settle" : "text-white"}`}
                >
                  {v}
                </span>
              </div>
            ))}
            <div className="mt-5 pt-5 border-t border-[var(--line)]">
              <p className="text-xs text-[var(--muted)] mb-2">
                The contract, if you'd like to read it
              </p>
              <code className="font-mono-t text-xs text-[var(--violet-lo)] break-all">
                0x707BBFCE1Ca35e72Bd40B1B6671b0807896a2f98
              </code>
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section className="mt-20">
          <p className="eyebrow text-[var(--muted)] mb-6">What we can't do</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              "Take money out of your wallet",
              "Change the rules after the fact",
              "Raise the fee above 10%",
            ].map((t) => (
              <div key={t} className="glass rounded-2xl p-6 flex items-start gap-3">
                <Check size={15} className="text-settle mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white leading-snug">{t}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[rgba(139,138,165,0.7)] mt-5 max-w-[620px]">
            None of these are promises. The contract has no function that would
            let us do any of them, and it can't be upgraded to add one.
          </p>
        </section>

        <section className="mt-24 text-center">
          <h2 className="display-lg text-white text-[clamp(1.8rem,4vw,2.8rem)]">
            Ready when you are.
          </h2>
          <button
            onClick={() => (window.location.href = "/signup")}
            className="btn-primary text-[15px] font-bold px-9 py-4 rounded-full inline-flex items-center gap-2 mt-8"
          >
            Get your link <ArrowRight size={17} />
          </button>
        </section>
      </div>

      <footer className="border-t border-[var(--line)]">
        <div className="max-w-[1000px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full settle-pulse"
              style={{ background: "var(--settle)" }}
            />
            <span className="font-mono-t text-[11px] text-settle">
              Live on Arc Testnet
            </span>
          </div>
          <span className="font-mono-t text-[11px] text-[rgba(139,138,165,0.6)]">
            Built on Arc &amp; Circle
          </span>
        </div>
      </footer>
    </Atmosphere>
  );
}

export function meta() {
  const title = "How Tiplyfi works";
  const description =
    "Payments without the payment company. Your supporters send USDC straight to your wallet, and it arrives in under a second.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://tiplyfi.vercel.app/howitworks" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: "https://tiplyfi.vercel.app/og-image.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: "https://tiplyfi.vercel.app/og-image.png" },
  ];
}
