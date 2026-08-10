/// Tiplyfi mark: a T whose stem descends into a settled coin.
/// The dot uses --settle, the colour reserved for money landing.
export default function Logo({ size = 32, showWord = false, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Tiplyfi"
        role="img"
      >
        <defs>
          <linearGradient id="tl-mark" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="17" fill="url(#tl-mark)" />
        {/* Crossbar sits high and slightly narrow so the stem reads as a drop */}
        <rect x="16" y="17" width="32" height="7" rx="3.5" fill="#fff" />
        <rect x="28.5" y="17" width="7" height="21" rx="3.5" fill="#fff" />
        <circle cx="32" cy="45" r="6" fill="#2DD4A7" />
      </svg>
      {showWord && (
        <span className="display-md text-[19px] tracking-tight">Tiplyfi</span>
      )}
    </span>
  );
}
