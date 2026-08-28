// Ensures the connected wallet is actually on the requested EVM chain before
// a cross-chain SDK call runs. Neither Bridge Kit nor Unified Balance Kit
// switches networks themselves -- they wrap whatever chain the provider is
// currently on, so skipping this step sends a mismatched chain parameter and
// the SDK fails with something like "chainId should be same as current
// chainId" or a broken internal chain lookup.
//
// Mirrors connectWallet's own switch/add pattern (arc-config.js) so the two
// stay consistent.

const CHAINS = {
  Ethereum_Sepolia: {
    chainId: "0xaa36a7",
    chainName: "Ethereum Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  Base_Sepolia: {
    chainId: "0x14a34",
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  Arbitrum_Sepolia: {
    chainId: "0x66eee",
    chainName: "Arbitrum Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  Optimism_Sepolia: {
    chainId: "0xaa37dc",
    chainName: "OP Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.optimism.io"],
    blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
  },
  Polygon_Amoy_Testnet: {
    chainId: "0x13882",
    chainName: "Polygon Amoy",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
  },
  Avalanche_Fuji: {
    chainId: "0xa869",
    chainName: "Avalanche Fuji",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://testnet.snowtrace.io"],
  },
  Unichain_Sepolia: {
    chainId: "0x515",
    chainName: "Unichain Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.unichain.org"],
    blockExplorerUrls: ["https://sepolia.uniscan.xyz"],
  },
};

/// Switches (or adds, on 4902) the wallet to `chainKey` before a Bridge Kit /
/// Unified Balance Kit call. Must run BEFORE createViemAdapterFromProvider.
export async function ensureChain(provider, chainKey) {
  const target = CHAINS[chainKey];
  if (!target) throw new Error(`Unknown chain: ${chainKey}`);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainId }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [target],
      });
    } else {
      throw new Error(
        `Couldn't switch your wallet to ${target.chainName}. Approve the network change and try again.`,
      );
    }
  }
}
