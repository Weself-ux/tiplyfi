import { useState } from "react";
import { QrCode, X } from "lucide-react";
import { SUPPORTED_WALLETS, connectWallet } from "./arc-config";

const INSTALL_URLS = {
  metamask: "https://metamask.io/download/",
  coinbase: "https://www.coinbase.com/wallet",
  trust: "https://trustwallet.com/download",
  okx: "https://www.okx.com/web3",
  binance: "https://www.binance.com/en/web3wallet",
  bitget: "https://web3.bitget.com/en/wallet-download",
  bybit: "https://www.bybit.com/en/web3/",
  zerion: "https://zerion.io/download",
  rainbow: "https://rainbow.me/download",
  rabby: "https://rabby.io/",
  tokenpocket: "https://www.tokenpocket.pro/en/download/app",
  imtoken: "https://token.im/download",
  coin98: "https://coin98.com/wallet",
};

/**
 * Square modal: wallets scroll on the left, QR pairing sits on the right.
 * Installed wallets sort to the top so the working options come first.
 *
 * Props:
 *   accent      — the creator's colour, so the modal matches their page
 *   onConnect({ address, provider, walletId })
 *   onClose()
 */
export default function WalletPicker({ accent = "#7c3aed", onConnect, onClose }) {
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState("");

  const wallets = [...SUPPORTED_WALLETS].sort(
    (a, b) => Number(b.detect()) - Number(a.detect()),
  );

  async function handleConnect(wallet) {
    if (!wallet.detect()) {
      window.open(INSTALL_URLS[wallet.id] || "#", "_blank", "noopener,noreferrer");
      return;
    }
    setError("");
    setConnecting(wallet.id);
    try {
      const result = await connectWallet(wallet.id);
      onConnect(result);
    } catch (err) {
      setError(err.message || "Connection failed. Try again.");
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(5,4,15,0.78)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass glass-lit rounded-[26px] w-full max-w-[560px] overflow-hidden rise"
        style={{ boxShadow: "0 50px 110px -45px rgba(0,0,0,0.95)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <div>
            <h3 className="display-md text-white text-[16px]">Connect a wallet</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Your wallet stays yours. We never see your keys.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {error && (
          <p className="mx-6 mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        <div className="grid sm:grid-cols-[1fr_190px]">
          {/* Wallets — installed first */}
          <div className="p-3 max-h-[336px] overflow-y-auto">
            {wallets.map((w) => {
              const installed = w.detect();
              const busy = connecting === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w)}
                  disabled={!!connecting}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-300 hover:bg-white/[0.05] disabled:opacity-50 group"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    {w.icon}
                  </span>
                  <span className="flex-1 text-left text-sm text-white">
                    {w.name}
                  </span>
                  {busy ? (
                    <span className="font-mono-t text-[10px] text-settle">
                      connecting
                    </span>
                  ) : installed ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--settle)" }}
                    />
                  ) : (
                    <span className="text-[10px] text-[rgba(139,138,165,0.6)] group-hover:text-[var(--muted)] transition-colors">
                      Install
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* QR pairing — placeholder until WalletConnect lands */}
          <div className="border-t sm:border-t-0 sm:border-l border-[var(--line)] p-5 flex flex-col items-center justify-center text-center">
            <div
              className="relative w-[124px] h-[124px] rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.14)",
              }}
            >
              <QrCode size={38} className="text-[rgba(139,138,165,0.45)]" />
              <span
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${accent}1F 0%, transparent 70%)`,
                }}
              />
              