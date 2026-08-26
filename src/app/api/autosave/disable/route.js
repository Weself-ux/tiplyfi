// POST /api/autosave/disable
//
// Builds the revoke challenge. Disable is a single revokeRule call straight to
// the executor -- no batch, no Multicall3From -- because revokeRule only lets
// the rule's own user revoke, and the creator IS that user. One challenge.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";
import { readCircleCookies } from "@/app/api/utils/circle-session";
import {
  createContractExecutionChallenge,
  listUserWallets,
} from "@/app/api/utils/circle";
import { encodeRevoke } from "@/app/api/utils/autosave";

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { userToken } = readCircleCookies(request);
    if (!userToken) {
      return Response.json(
        { error: "Wallet session expired. Please sign in again.", expired: true },
        { status: 401 },
      );
    }

    const rows = await sql(
      `SELECT autosave_rule_hash, circle_wallet_id, autosave_enabled
         FROM users WHERE id = $1`,
      [user.id],
    );
    const row = rows[0] || {};
    if (!row.autosave_enabled || !row.autosave_rule_hash) {
      return Response.json(
        { error: "Auto-save isn't on." },
        { status: 400 },
      );
    }

    let walletId = row.circle_wallet_id;
    if (!walletId) {
      const wallets = await listUserWallets(userToken);
      const arc = wallets.find((w) => w.blockchain === "ARC-TESTNET");
      if (!arc?.id) {
        return Response.json({ error: "No wallet found." }, { status: 404 });
      }
      walletId = arc.id;
    }

    const { contractAddress, callData } = encodeRevoke(row.autosave_rule_hash);

    const challengeId = await createContractExecutionChallenge(userToken, {
      walletId,
      contractAddress,
      callData,
    });
    if (!challengeId) {
      return Response.json(
        { error: "Could not start the approval. Auto-save is still on." },
        { status: 502 },
      );
    }

    return Response.json({ challengeId });
  } catch (err) {
    console.error("[autosave/disable]", err);
    return Response.json(
      { error: "Couldn't turn auto-save off. It's still on." },
      { status: 500 },
    );
  }
}
