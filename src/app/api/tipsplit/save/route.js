// POST /api/tipsplit/save
//
// Replaces the creator's full co-host list in one transaction-shaped write:
// validate every username resolves to a real, signed-up creator (co-hosts
// must have an account -- they can't be listed by name alone), validate the
// splits sum to under 100 (the primary streamer keeps the remainder,
// including any rounding dust), then delete and re-insert.
//
// This is configuration only. Payout still runs as a single-recipient tip
// through TipRouter until the spine's shared split primitive lands --
// splitting funds live is a contract change owned by the spine, not Tiplyfi
// (per the standing ruling: no v2 of TipRouter). Saving here means "this is
// how tips SHOULD split once that primitive exists," and is also what a
// stream overlay / creator page can read to show the split today.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

const MAX_COHOSTS = 8;

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { cohosts } = await request.json();
    if (!Array.isArray(cohosts)) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    if (cohosts.length > MAX_COHOSTS) {
      return Response.json(
        { error: `Up to ${MAX_COHOSTS} co-hosts.` },
        { status: 400 },
      );
    }

    const clean = [];
    const seen = new Set();
    let total = 0;

    for (const c of cohosts) {
      const uname = String(c.username || "").toLowerCase().trim();
      const pct = Number(c.pct);

      if (!/^[a-z0-9_]{3,30}$/.test(uname)) {
        return Response.json(
          { error: `"${c.username}" isn't a valid username.` },
          { status: 400 },
        );
      }
      if (uname === user.username?.toLowerCase()) {
        return Response.json(
          { error: "You can't add yourself as a co-host." },
          { status: 400 },
        );
      }
      if (seen.has(uname)) {
        return Response.json(
          { error: `${uname} is listed more than once.` },
          { status: 400 },
        );
      }
      if (!(pct > 0) || pct >= 100) {
        return Response.json(
          { error: `${uname}'s share must be between 0 and 100.` },
          { status: 400 },
        );
      }

      seen.add(uname);
      total += pct;
      clean.push({ username: uname, pct });
    }

    if (total >= 100) {
      return Response.json(
        { error: "Co-host shares must add up to less than 100% -- you keep the rest." },
        { status: 400 },
      );
    }

    // Every co-host must already have a Tiplyfi account. A stranger can't be
    // listed by name alone. Checked one at a time -- the same single-param
    // pattern every other route in this app already relies on, rather than
    // an array-bound ANY($1) this driver's behaviour hasn't been confirmed
    // for. At most 8 co-hosts, so the extra round trips cost nothing real.
    const missing = [];
    for (const c of clean) {
      const found = await sql(
        `SELECT id FROM users WHERE lower(username) = $1`,
        [c.username],
      );
      if (found.length === 0) missing.push(c.username);
    }
    if (missing.length > 0) {
      return Response.json(
        {
          error: `${missing.join(", ")} ${missing.length > 1 ? "don't" : "doesn't"} have a Tiplyfi account yet.`,
        },
        { status: 400 },
      );
    }

    await sql("DELETE FROM stream_cohosts WHERE streamer_id = $1", [user.id]);
    for (const c of clean) {
      await sql(
        `INSERT INTO stream_cohosts (streamer_id, cohost_username, split_pct)
         VALUES ($1, $2, $3)`,
        [user.id, c.username, c.pct],
      );
    }

    return Response.json({ saved: true, primaryPct: 100 - total });
  } catch (err) {
    console.error("[tipsplit/save]", err);
    return Response.json({ error: "Couldn't save tip-split." }, { status: 500 });
  }
}
