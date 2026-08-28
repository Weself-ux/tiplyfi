// POST /api/livestream/toggle
//
// A single on/off flag. No configuration of its own -- going live is a state,
// not a payout structure. Tip-split (if any) applies regardless of this flag.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const rows = await sql(
      "SELECT live_stream_enabled FROM users WHERE id = $1",
      [user.id],
    );
    return Response.json({ enabled: rows[0]?.live_stream_enabled === true });
  } catch (err) {
    console.error("[livestream/toggle GET]", err);
    return Response.json({ error: "Couldn't read state." }, { status: 500 });
  }
}

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { enabled } = await request.json();
    const rows = await sql(
      `UPDATE users SET live_stream_enabled = $1 WHERE id = $2
       RETURNING live_stream_enabled`,
      [Boolean(enabled), user.id],
    );

    return Response.json({ enabled: rows[0]?.live_stream_enabled === true });
  } catch (err) {
    console.error("[livestream/toggle]", err);
    return Response.json({ error: "Couldn't update." }, { status: 500 });
  }
}
