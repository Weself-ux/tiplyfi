// ─────────────────────────────────────────────────────────────────────────────
// VENDORED, PROVISIONAL. This is @weself/core/identity's to own. The package is
// not installable yet, so this copy stands in. It exists to be DELETED the day
// @weself/core/identity publishes.
//
// The rule: the spine owns one implementation so five products cannot diverge.
// A vendored copy breaks that rule unless it cannot drift silently — so the
// spine's canonical vectors are asserted in weselfId.test.js. If this code ever
// disagrees with them, CI fails. It can only fail loudly, never diverge quietly.
//
// Two layers, both off-chain and RPC-free:
//   layer 1  text weself_id -> bytes32, namespaced by subject kind
//   layer 2  (bytes32, owner) -> subjectId, matches the factory's idFor
//
// subjectId depends on the OWNER, and the factory derives a vault address from
// it. A wrong value here routes funds to an address nobody controls, silently.
// ─────────────────────────────────────────────────────────────────────────────

import { keccak256, toUtf8Bytes, AbiCoder, getAddress } from "ethers";

/// Namespaces so a user id and an order id can never collide on chain.
const NAMESPACE = {
  user: "weself:v1:user:",
  group: "weself:v1:group:",
  order: "weself:v1:order:",
};

/// Layer 1 - text weself_id to bytes32. Parameterised on subject kind; never
/// hardcode a namespace. weself_id goes in byte-for-byte: no trim, no case
/// fold, no hyphen stripping.
export function weselfIdToBytes32(weselfId, kind = "user") {
  const prefix = NAMESPACE[kind];
  if (!prefix) throw new Error(`unknown subject kind: ${kind}`);
  if (typeof weselfId !== "string" || weselfId.length === 0) {
    throw new Error("weselfId must be a non-empty string");
  }
  return keccak256(toUtf8Bytes(prefix + weselfId));
}

/// Layer 2 - (bytes32, owner) to subjectId. abi.encode, not encodePacked:
/// 64 bytes, the hash then the address left-padded. Mirrors the factory's
/// public pure idFor, so this is computable with zero RPC calls.
export function idFor(weselfIdBytes32, ownerAddress) {
  const owner = getAddress(ownerAddress); // throws on a bad checksum
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address"],
    [weselfIdBytes32, owner],
  );
  return keccak256(encoded);
}

/// The full derivation a rule needs: text id + owner -> subjectId.
export function subjectId(weselfId, ownerAddress, kind = "user") {
  return idFor(weselfIdToBytes32(weselfId, kind), ownerAddress);
}
