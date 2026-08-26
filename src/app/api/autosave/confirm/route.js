// POST /api/autosave/confirm
//
// Finalises an enable. The client posts the transaction hash from the approved
// challenge; the server verifies it landed on Arc, then -- and only then --
// marks auto-save enabled. Nothing before an on-chain confirmation flips the
// flag, so an abandoned prompt leaves the account exactly as it was.

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

    // The chain is the source of truth. If it didn't succeed, nothing changes.
    const ok = await getTransactionSucceeded(txHash);
    if (!ok) {
      return Response.json(
        { error: "That transaction hasn't confirmed. Nothing was enabled." },
        { status: 400 },
      );
    }

    const rows = await sql(
      `UPDATE users
          SET autosave_enabled = true,
              autosave_registered_at = now()
        WHERE id = $1
        RETURNING autosave_pct`,
      [user.id],
    );

    return Response.json({ enabled: true, pct: rows[0]?.autosave_pct ?? null });
  } catch (err) {
    console.error("[autosave/confirm]", err);
    return Response.json({ error: "Couldn't confirm auto-save." }, { status: 500 });
  }
}
