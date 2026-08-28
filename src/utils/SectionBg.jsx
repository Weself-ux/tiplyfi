// Per-section background wash. Atmosphere renders the shared ink base, grid,
// and noise once for the whole page; this renders on top of it, giving each
// section its own subtle identity so the page doesn't read as one flat
// backdrop from hero to footer. Same three tokens throughout -- violet,
// azure, settle -- just weighted differently per section, so it stays one
// coherent system rather than becoming five different pages.
export default function SectionBg({ tone = "none", position = "center" }) {
  if (tone === "none") return null;

  const WASH = {
    // Hero: boldest moment, concentrated violet -- already handled by
    // Atmosphere's corner orbs, so this tone is intentionally unused there.
    violet: "radial-gradient(circle, rgba(124,58,237,0.65) 0%, rgba(124,58,237,0) 70%)",
    // Fee comparison: cooler, "look closely at these numbers" register.
    azure: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0) 70%)",
    // Three steps: the one section that earns --settle, the money-lands colour.
    settle: "radial-gradient(circle, rgba(45,212,167,0.45) 0%, rgba(45,212,167,0) 70%)",
    // Close/CTA: mirrors the hero, bookending the page.
    mix: "linear-gradient(180deg, rgba(124,58,237,1.35) 0%, rgba(59,130,246,0.28) 100%)",
  };

  const POS = {
    center: { top: "10%", left: "20%", width: "60%", height: "80%" },
    left: { top: "5%", left: "-10%", width: "55%", height: "90%" },
    right: { top: "5%", left: "55%", width: "55%", height: "90%" },
    full: { top: "0%", left: "0%", width: "100%", height: "100%" },
  };
  const p = POS[position] || POS.center;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        top: p.top,
        left: p.left,
        width: p.width,
        height: p.height,
        background: WASH[tone],
        filter: "blur(30px)",
      }}
    />
  );
}
