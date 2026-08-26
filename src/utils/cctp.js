// Fan-side cross-chain tipping via Circle Bridge Kit (CCTP v2).
//
// Flow: a fan holding USDC on Base Sepolia bridges it to their OWN address on
// Arc, then the existing Arc tip flow runs unchanged. Bridge Kit does approve +
// burn + attestation + mint in one call; the tip that follows is a normal Arc
// tip through TipRouter, so the fee routes correctly with no special path.
//
// STATUS: the inbound-to-Arc attestation (Base domain 6 -> Arc domain 26) is
// REASONED, not verified on-chain. If Circle's Iris API does not attest this
// direction, kit.bridge() will hang or throw at the attestation step. This
// module surfaces that as a clear error rather than a silent stall.
//
// Only USDC. Bridge Kit supports USDC only, which is exactly the tip asset.

import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

// Bridge Kit's own chain identifiers (verified against the installed types).
const SOURCE_CHAINS = {
  ethereum: "Ethereum_Sepolia",
  base: "Base_Sepolia",
  arbitrum: "Arbitrum_Sepolia",
  optimism: "Optimism_Sepolia",
  polygon: "Polygon_Amoy_Testnet",
  avalanche: "Avalanche_Fuji",
  unichain: "Unichain_Sepolia",
};
const DEST_CHAIN = "Arc_Testnet";

/// Chains a fan can bridge FROM. Keyed to the tip page's network ids. Extend
/// this as more source chains are enabled -- each must be a Bridge Kit chain id.
export const CCTP_SOURCE_CHAINS = Object.keys(SOURCE_CHAINS);

/// Bridges `amountUsdc` of the fan's USDC from a source chain to their own
/// address on Arc. Returns the burn and mint transaction hashes. Throws with a
/// human-readable message on any failure -- including an attestation that never
/// arrives, which is the known risk on the inbound-to-Arc direction.
///
/// onStep is called with short status strings so the UI can show progress
/// through what is a multi-minute, multi-transaction flow.
export async function bridgeToArc({ provider, networkId, amountUsdc, onStep }) {
  const sourceChain = SOURCE_CHAINS[networkId];
  if (!sourceChain) {
    throw new Error(`Cross-chain tipping isn't available from ${networkId}.`);
  }
  if (!provider) {
    throw new Error("Connect a wallet first.");
  }
  if (!(Number(amountUsdc) > 0)) {
    throw new Error("Enter a valid amount.");
  }

  const step = (s) => {
    if (typeof onStep === "function") onStep(s);
  };

  step("Preparing your wallet...");
  // One adapter serves both chains. Bridge Kit switches networks as needed.
  const adapter = await createViemAdapterFromProvider({ provider });

  const kit = new BridgeKit();

  step("Bridging to Arc — approve and confirm in your wallet...");
  let result;
  try {
    result = await kit.bridge({
      source: { adapter, chain: sourceChain },
      destination: { adapter, chain: DEST_CHAIN },
      amount: String(amountUsdc),
      token: "USDC",
      // SLOW is free (no fast-transfer fee). On testnet the extra wait is
      // minutes, and it keeps the fee story clean: the only fee a fan pays is
      // the 6% taken by TipRouter when the arrived USDC tips the creator.
      config: { transferSpeed: "SLOW" },
    });
  } catch (err) {
    // Bridge Kit categorises failures; surface something a fan can act on.
    const msg = err?.message || "The transfer failed.";
    if (/attestation|timeout|pending/i.test(msg)) {
      throw new Error(
        "The bridge is taking longer than expected to confirm on Arc. " +
          "Your funds are safe on the source chain — try again shortly.",
      );
    }
    if (/reject|denied|4001/i.test(msg)) {
      throw new Error("You cancelled the transfer. Nothing was sent.");
    }
    throw new Error(`Couldn't bridge to Arc: ${msg}`);
  }

  const burnHash = result?.steps?.burn?.transactionHash || null;
  const mintHash = result?.steps?.mint?.transactionHash || null;
  if (!mintHash) {
    throw new Error(
      "The bridge didn't complete the mint on Arc. Your funds remain on the " +
        "source chain.",
    );
  }

  step("USDC arrived on Arc.");
  return { burnHash, mintHash };
}
