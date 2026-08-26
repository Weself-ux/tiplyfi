import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

// Renders the creator's tip link as a QR code with the Tiplyfi mark centered
// in it, and a download button directly beneath. High error-correction is
// required whenever a logo covers part of the code, or scanners can't read
// through the gap -- 'H' tolerates up to ~30% obstruction.
const LOGO_SRC = "/favicon.svg";

async function drawBranded(canvas, link, size) {
  await QRCode.toCanvas(canvas, link, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#111827", light: "#FFFFFF" },
  });

  const ctx = canvas.getContext("2d");
  const logo = new Image();
  await new Promise((resolve, reject) => {
    logo.onload = resolve;
    logo.onerror = reject;
    logo.src = LOGO_SRC;
  });

  const markSize = size * 0.22;
  const pad = markSize * 0.18;
  const cx = size / 2;
  const cy = size / 2;

  // White backing so the mark reads cleanly and the QR's own dark modules
  // don't show through behind it.
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  const r = markSize / 2 + pad;
  ctx.roundRect
    ? ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.3)
    : ctx.rect(cx - r, cy - r, r * 2, r * 2);
  ctx.fill();

  ctx.drawImage(logo, cx - markSize / 2, cy - markSize / 2, markSize, markSize);
}

export default function TipQrCode({ link, username }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!link || !canvasRef.current) return;
    setReady(false);
    setError(false);
    drawBranded(canvasRef.current, link, 96)
      .then(() => setReady(true))
      .catch(() => setError(true));
  }, [link]);

  async function download() {
    if (!link) return;
    const big = document.createElement("canvas");
    try {
      await drawBranded(big, link, 512);
      const url = big.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${username || "tiplyfi"}-qr.png`;
      a.click();
    } catch {
      // Silent: the on-screen QR still works even if download generation fails.
    }
  }

  if (error) return null;

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
      <div className="w-24 h-24 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={download}
        disabled={!ready}
        className="text-[11px] font-medium text-[#7c3aed] hover:underline disabled:opacity-40"
      >
        Download
      </button>
    </div>
  );
}
