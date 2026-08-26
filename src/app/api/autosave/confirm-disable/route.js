// POST /api/autosave/confirm-disable
//
// Finalises a disable. Verifies the revoke landed on Arc, then clears the flag.
// Nothing changes until the chain confirms, so an abandoned prompt leaves
// auto-save on.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";
import { getTransactionSucceeded } from "@/app/api/utils/arc";

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { txHash } = await request.json();
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || "")) {
      return Response.json(
        { error: "Missing or invalid transaction hash." },
        { status: 400 },
      );
    }

    const ok = await getTransactionSucceeded(txHash);
    if (!ok) {
      return Response.json(
        { error: "That transaction hasn't confirmed. Auto-save is still on." },
        { status: 400 },
      );
    }

    // Clear the flag and the hash. The salt is left as-is -- a future enable
    // increments it, so re-enabling never collides with this revoked rule.
    await sql(
      `UPDATE users
          SET autosave_enabled = false, autosave_rule_hash = NULL
        WHERE id = $1`,
      [user.id],
    );

    return Response.json({ enabled: false });
  } catch (err) {
    console.error("[autosave/confirm-disable]", err);
    return Response.json(
      { error: "Couldn't confirm the change." },
      { status: 500 },
    );
  }
}
