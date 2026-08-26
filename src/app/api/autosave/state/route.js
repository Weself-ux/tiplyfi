// GET /api/autosave/state
//
// Current auto-save state for the signed-in creator. The card reads this on
// load to show on/off and the saved percentage.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const rows = await sql(
      `SELECT autosave_enabled, autosave_pct FROM users WHERE id = $1`,
      [user.id],
    );
    const row = rows[0] || {};
    return Response.json({
      enabled: row.autosave_enabled === true,
      pct: row.autosave_pct ?? null,
    });
  } catch (err) {
    console.error("[autosave/state]", err);
    return Response.json({ error: "Couldn't read auto-save state." }, {
      status: 500,
    });
  }
}
