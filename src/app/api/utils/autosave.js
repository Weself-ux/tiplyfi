// Auto-save rule construction, server-side.
//
// Builds the single aggregate3 batch a creator signs to enable auto-save:
//   1. USDC.approve(Permit2, max)
//   2. Permit2.approve(USDC, executor, amount, expiry)
//   3. registerRule(rule)
// routed through Multicall3From so msg.sender stays the creator inside the
// batch -- registerRule requires msg.sender == rule.user, and the precompile
// preserves it (verified on chain this session).
//
// bind() runs separately, BEFORE this batch, from the server signer, because
// registerRule needs the binding to already exist and the factory/executor
// ordering across a single aggregate3 is not something to rely on.
//
// Every amount is 6dp USDC. Never 18dp -- that is the native-gas view, and the
// factory/executor speak the ERC-20 interface at 6 decimals.

import { ethers } from "ethers";
import { subjectId, weselfIdToBytes32 } from "../../../utils/weselfId.js";

// ── Canonical addresses (all verified on Arc testnet this session) ───────────
const USDC = "0x3600000000000000000000000000000000000000";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const EXECUTOR = "0xccAdE206373A5E845E0cdca1b7A7247769771c84";
const SAFEMI_FACTORY = "0xCC62763B033b8f52523c25f41c7D9DcECE3150E7";
const MULTICALL3_FROM = "0x522fAf9A91c41c443c66765030741e4AaCe147D0";

// ── Rule parameters (locked) ─────────────────────────────────────────────────
const RULE_TYPE_TIP_AUTOSAVE = 1;
const MAX_SINGLE_TIP_6DP = 10_000_000_000n; // 10,000 USDC ceiling for sizing
const MAX_TOTAL_6DP = 25_000_000_000n; // 25,000 USDC lifetime cap
const EXPIRY_SECONDS = 180 * 24 * 60 * 60; // 180 days
const MAX_PCT = 50; // hard cap; the UI must not exceed this

const iface = {
  usdc: new ethers.Interface(["function approve(address,uint256)"]),
  permit2: new ethers.Interface([
    "function approve(address,address,uint160,uint48)",
  ]),
  factory: new ethers.Interface(["function bind(bytes32,address)"]),
  executor: new ethers.Interface([
    "function registerRule((address,bytes32,address,uint8,uint128,uint128,uint64,uint64)) returns (bytes32)",
  ]),
  multicall: new ethers.Interface([
    "function aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[])",
  ]),
};

/// A creator's server signer for bind(). Lowest-stakes key in the system:
/// bind is permissionless and idempotent, owner is baked into the id, so this
/// key can only ever record the rightful owner. Funded with a little USDC for
/// gas. Never leaves the server.
function signer() {
  const key = process.env.AUTOSAVE_SIGNER_KEY;
  if (!key) throw new Error("AUTOSAVE_SIGNER_KEY is not set");
  const rpc = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  return new ethers.Wallet(key, new ethers.JsonRpcProvider(rpc));
}

/// Records the creator as owner of their subjectId on Safemi's factory, so
/// registerRule can bind the rule to a vault the factory can derive. Awaits the
/// receipt -- Arc has instant finality, so once it returns the binding holds
/// for the batch that follows. Idempotent: a repeat bind is a cheap no-op.
export async function bindOwner(weselfId, ownerAddress) {
  const w = signer();
  const b32 = subjectIdInputs(weselfId, ownerAddress).weselfIdBytes32;
  const data = iface.factory.encodeFunctionData("bind", [b32, ownerAddress]);
  const tx = await w.sendTransaction({ to: SAFEMI_FACTORY, data });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("bind did not confirm");
  }
  return receipt.hash;
}

/// Splits subjectId derivation so bind() and the rule share one implementation.
/// bind needs the layer-1 hash; the rule needs the composed subjectId.
function subjectIdInputs(weselfId, ownerAddress) {
  return {
    weselfIdBytes32: weselfIdToBytes32(weselfId, "user"),
    subjectId: subjectId(weselfId, ownerAddress, "user"),
  };
}

/// Sizes maxPerExecution from the save percentage. A tip larger than the sizing
/// ceiling simply does not auto-save -- it stays in the creator's wallet, which
/// is the safe failure. Rounds down (against the treasury / in the user's
/// favour). Non-zero required, or registerRule reverts BadCaps.
function maxPerExecution(pct) {
  const v = (MAX_SINGLE_TIP_6DP * BigInt(pct)) / 100n;
  if (v === 0n) throw new Error("maxPerExecution rounded to zero");
  return v;
}

/// Builds the full rule tuple in the exact field order the executor expects.
/// Order is the ABI encoding order -- do not reorder. expiry is passed in, not
/// generated here: the batch and the rule hash must share ONE expiry, or they
/// describe different rules and revoke fails on an unknown hash.
export function buildRule({ ownerAddress, weselfId, pct, salt, expiry }) {
  if (pct < 1 || pct > MAX_PCT) {
    throw new Error(`pct out of range: ${pct}`);
  }
  if (!Number.isInteger(expiry)) {
    throw new Error("expiry (unix seconds) is required");
  }
  const { subjectId: sid } = subjectIdInputs(weselfId, ownerAddress);
  return [
    ownerAddress, // user
    sid, // subjectId
    SAFEMI_FACTORY, // factory
    RULE_TYPE_TIP_AUTOSAVE, // ruleType
    maxPerExecution(pct), // maxPerExecution
    MAX_TOTAL_6DP, // maxTotal
    BigInt(expiry), // expiry
    BigInt(salt), // salt
  ];
}

/// One expiry, computed once per enable and reused everywhere. 180 days out.
export function newExpiry() {
  return Math.floor(Date.now() / 1000) + EXPIRY_SECONDS;
}

/// Encodes the three-call batch into a single aggregate3 callData for
/// Multicall3From. allowFailure is false on every call: the batch is atomic, so
/// a creator never ends up approved-but-not-registered or vice versa.
export function encodeEnableBatch({ ownerAddress, weselfId, pct, salt, expiry }) {
  const rule = buildRule({ ownerAddress, weselfId, pct, salt, expiry });

  const call1 = iface.usdc.encodeFunctionData("approve", [
    PERMIT2,
    ethers.MaxUint256,
  ]);
  const call2 = iface.permit2.encodeFunctionData("approve", [
    USDC,
    EXECUTOR,
    MAX_TOTAL_6DP, // uint160 amount, matches the rule's lifetime cap
    expiry, // uint48 expiration, same window as the rule
  ]);
  const call3 = iface.executor.encodeFunctionData("registerRule", [rule]);

  const batch = [
    [USDC, false, call1],
    [PERMIT2, false, call2],
    [EXECUTOR, false, call3],
  ];

  return {
    contractAddress: MULTICALL3_FROM,
    callData: iface.multicall.encodeFunctionData("aggregate3", [batch]),
  };
}

/// The rule hash for a given enable, so the DB can store it and the disable
/// path can revoke by hash. Mirrors the executor's ruleHash view input.
export function ruleHashInput({ ownerAddress, weselfId, pct, salt }) {
  return buildRule({ ownerAddress, weselfId, pct, salt });
}

/// Asks the executor for the canonical hash of a rule. We never compute the
/// hash off-chain -- the preimage is the executor's business, and a wrong guess
/// would make revoke fail. One eth_call, the executor's own answer.
export async function getRuleHash({ ownerAddress, weselfId, pct, salt, expiry }) {
  const rule = buildRule({ ownerAddress, weselfId, pct, salt, expiry });
  const iface2 = new ethers.Interface([
    "function ruleHash((address,bytes32,address,uint8,uint128,uint128,uint64,uint64)) view returns (bytes32)",
  ]);
  const rpc = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpc);
  const data = iface2.encodeFunctionData("ruleHash", [rule]);
  const ret = await provider.call({ to: EXECUTOR, data });
  const [hash] = iface2.decodeFunctionResult("ruleHash", ret);
  return hash;
}

/// Encodes a revokeRule call. Disable is a single call, not a batch -- one
/// challenge, no Multicall3From, straight to the executor as the creator.
export function encodeRevoke(ruleHash) {
  const iface2 = new ethers.Interface(["function revokeRule(bytes32)"]);
  return {
    contractAddress: EXECUTOR,
    callData: iface2.encodeFunctionData("revokeRule", [ruleHash]),
  };
}
