/// Background layer for the dark surfaces. Two drifting radials for depth,
/// a hairline grid for ledger precision, and a fine noise wash so the
/// gradients don't band on wide screens.
export default function Atmosphere({ children }) {
  return (
    <div className="relative min-h-screen bg-ink overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[22%] -left-[12%] w-[62vw] h-[62vw] rounded-full drift"
        style={{
          background:
            "radial-gradient(circle, rgba(124,58,237,0.42) 0%, rgba(124,58,237,0) 68%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[28%] -right-[16%] w-[58vw] h-[58vw] rounded-full drift-slow"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.34) 0%, rgba(59,130,246,0) 70%)",
          filter: "blur(40px)",
        }}
      />

      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full grid-mask"
        style={{ opacity: 0.5 }}
      >
        <defs>
          <pattern id="tl-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path
              d="M64 0H0V64"
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="1"
            />
          </pattern>
          <filter id="tl-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#tl-grid)" />
        <rect width="100%" height="100%" filter="url(#tl-noise)" opacity="0.02" />
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
