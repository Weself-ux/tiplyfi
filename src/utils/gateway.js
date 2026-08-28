// Fan-side cross-chain tipping via Circle Gateway (Unified Balance).
//
// Unlike CCTP's one-shot bridge, Gateway is deposit-then-spend:
//   deposit -- fan adds USDC to their Gateway unified balance (once / rarely)
//   spend   -- fan spends from that balance, minting USDC to their OWN Arc
//              address, then the normal Arc tip runs through TipRouter
//
// Gateway spend mints to an ADDRESS only -- there is no contract hook, so we
// cannot call TipRouter atomically on mint. Minting to the fan's Arc address
// (not the creator's) is deliberate: it routes the tip through TipRouter so the
// 6% fee is taken, instead of landing fee-free on the creator.
//
// STATUS: like CCTP, the mint onto Arc (domain 26) is REASONED, not verified.
// If Gateway's attestation doesn't cover inbound Arc, spend() will fail at the
// mint step; this module surfaces that clearly.
//
// USDC only.

import { UnifiedBalanceKit } from "@circle-fin/unified-balance-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { ensureChain } from "./chainSwitch";

// Testnet chains a fan can deposit USDC from, into their unified balance. EVM
// only -- these pair with an injected browser wallet. Solana needs a different
// wallet type and is excluded until we add Solana wallet support.
const DEPOSIT_CHAINS = {
  ethereum: "Ethereum_Sepolia",
  base: "Base_Sepolia",
  arbitrum: "Arbitrum_Sepolia",
  optimism: "Optimism_Sepolia",
  polygon: "Polygon_Amoy_Testnet",
  avalanche: "Avalanche_Fuji",
  unichain: "Unichain_Sepolia",
};
const DEST_CHAIN = "Arc_Testnet";

// For the deposit-source picker: [{ id, label }], in a sensible order.
export const GATEWAY_DEPOSIT_CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "optimism", label: "Optimism" },
  { id: "polygon", label: "Polygon" },
  { id: "avalanche", label: "Avalanche" },
  { id: "unichain", label: "Unichain" },
];

let _kit = null;
function kit() {
  if (!_kit) _kit = new UnifiedBalanceKit();
  return _kit;
}

/// The fan's total unified USDC balance, as a decimal string. Read-only, so it
/// takes just the address -- no signing.
export async function getUnifiedBalance(address) {
  try {
    const res = await kit().getBalances({
      token: "USDC",
      sources: { address },
    });
    // totalConfirmedBalance is a human-readable decimal string across all chains.
    return Number(res?.totalConfirmedBalance || 0);
  } catch {
    return 0;
  }
}

/// Deposits USDC into the fan's Gateway unified balance from a source chain.
/// Builds the balance they'll later spend from. One signed approve + deposit.
export async function depositToUnified({
  provider,
  networkId,
  amountUsdc,
  onStep,
}) {
  const chain = DEPOSIT_CHAINS[networkId];
  if (!chain) throw new Error(`Deposits aren't available from ${networkId}.`);
  if (!provider) throw new Error("Connect a wallet first.");
  if (!(Number(amountUsdc) > 0)) throw new Error("Enter a valid amount.");

  const step = (s) => typeof onStep === "function" && onStep(s);
  step(`Switching your wallet to ${networkId}...`);
  await ensureChain(provider, chain);

  step("Preparing your wallet...");
  const adapter = await createViemAdapterFromProvider({ provider });

  step("Depositing to your Gateway balance — confirm in your wallet...");
  try {
    const res = await kit().deposit({
      from: { adapter, chain },
      amount: String(amountUsdc),
      token: "USDC",
    });
    step("Deposit complete.");
    return res;
  } catch (err) {
    const msg = err?.message || "The deposit failed.";
    if (/reject|denied|4001/i.test(msg)) {
      throw new Error("You cancelled the deposit. Nothing was sent.");
    }
    throw new Error(`Couldn't deposit: ${msg}`);
  }
}

/// Runs a list of deposits in sequence -- one per {networkId, amount} entry.
/// Each is its own chain switch and signature; Gateway has no way to pull from
/// two chains in one signed action, so "top up from multiple chains" is
/// genuinely multiple deposits, done one after another. onStep reports which
/// one is running so the fan sees real progress, not a stall.
export async function depositMultiple({ provider, entries, onStep }) {
  const succeeded = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    try {
      await depositToUnified({
        provider,
        networkId: e.networkId,
        amountUsdc: e.amount,
        onStep: (s) =>
          typeof onStep === "function" &&
          onStep(`(${i + 1}/${entries.length}) ${s}`),
      });
      succeeded.push(e.networkId);
    } catch (err) {
      // Stop rather than skip ahead -- but attach what already succeeded so
      // the caller removes exactly those from the retry queue. Without this,
      // a retry re-runs everything, including deposits that already landed.
      const error = new Error(err.message);
      error.succeeded = succeeded;
      throw error;
    }
  }
  return { succeeded };
}

/// Spends from the fan's unified balance, minting USDC to their OWN Arc address.
/// The normal Arc tip then runs from there. Returns nothing meaningful beyond
/// success; the funded Arc wallet is the outcome.
export async function spendToArc({
  provider,
  amountUsdc,
  fanArcAddress,
  onStep,
}) {
  if (!provider) throw new Error("Connect a wallet first.");
  if (!(Number(amountUsdc) > 0)) throw new Error("Enter a valid amount.");
  if (!/^0x[a-fA-F0-9]{40}$/.test(fanArcAddress || "")) {
    throw new Error("No Arc address to receive the funds.");
  }

  const step = (s) => typeof onStep === "function" && onStep(s);
  step("Preparing your wallet...");
  const adapter = await createViemAdapterFromProvider({ provider });

  step("Moving USDC to Arc — confirm in your wallet...");
  try {
    await kit().spend({
      from: { adapter },
      to: {
        adapter,
        chain: DEST_CHAIN,
        // Mint to the FAN, not the creator, so the tip routes through
        // TipRouter and the fee is taken.
        recipientAddress: fanArcAddress,
      },
      amount: String(amountUsdc),
      token: "USDC",
    });
    step("USDC arrived on Arc.");
  } catch (err) {
    const msg = err?.message || "The transfer failed.";
    if (/attestation|timeout|pending/i.test(msg)) {
      throw new Error(
        "The transfer is taking longer than expected to confirm on Arc. " +
          "Your unified balance is safe — try again shortly.",
      );
    }
    if (/reject|denied|4001/i.test(msg)) {
      throw new Error("You cancelled the transfer. Nothing was sent.");
    }
    if (/insufficient|balance/i.test(msg)) {
      throw new Error(
        "Not enough in your Gateway balance. Deposit first, then tip.",
      );
    }
    throw new Error(`Couldn't move funds to Arc: ${msg}`);
  }
}
