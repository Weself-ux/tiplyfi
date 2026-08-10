import { createHash } from "node:crypto";

/// A stable per-supporter key that works across rails. Wallet tips use the
/// address; card and bank tips use a hash of the email so the same person
/// counts once without storing their address in a countable column.
export function supporterRef({ walletAddress, email }) {
  if (walletAddress) return String(walletAddress).toLowerCase();
  if (email) {
    const digest = createHash("sha256")
      .update(String(email).trim().toLowerCase())
      .digest("hex");
    return `e:${digest.slice(0, 32)}`;
  }
  return null;
}
