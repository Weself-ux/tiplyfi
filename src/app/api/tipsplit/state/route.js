// GET /api/tipsplit/state
//
// The creator's current tip-split configuration: their co-hosts and each
// one's percentage. The primary streamer's own share is never stored -- it's
// always 100 minus the sum of co-host splits, computed here so the two
// numbers can never drift out of sync.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const cohosts = await sql(
      `SELECT cohost_username, split_pct
         FROM stream_cohosts
        WHERE streamer_id = $1
        ORDER BY created_at ASC`,
      [user.id],
    );

    const cohostTotal = cohosts.reduce(
      (sum, c) => sum + Number(c.split_pct),
      0,
    );

    return Response.json({
      cohosts: cohosts.map((c) => ({
        username: c.cohost_username,
        pct: Number(c.split_pct),
      })),
      primaryPct: Math.max(0, 100 - cohostTotal),
    });
  } catch (err) {
    console.error("[tipsplit/state]", err);
    return Response.json(
      { error: "Couldn't load tip-split settings." },
      { status: 500 },
    );
  }
}
