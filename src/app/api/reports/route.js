import sql from "@/app/api/utils/sql";
import { rateLimit, getClientIP } from "@/app/api/utils/auth-helpers";
import {
  recordReputationEvent,
  REPUTATION_EVENTS,
} from "@/app/api/utils/reputation";

const REASONS = ["impersonation", "illegal", "spam", "other"];
const ESCALATION_THRESHOLD = 3;

export async function action({ request }) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimit(ip, "report", 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many reports. Please try again later." },
        { status: 429 },
      );
    }

    const { username, reason, detail } = await request.json();
    if (!username || !REASONS.includes(reason)) {
      return Response.json({ error: "Invalid report." }, { status: 400 });
    }

    const creator = username.toLowerCase();
    const exists = await sql("SELECT id FROM users WHERE username = $1", [
      creator,
    ]);
    if (exists.length === 0) {
      return Response.json({ error: "Creator not found." }, { status: 404 });
    }

    // One open report per reporter per creator, so nobody can escalate alone.
    const dup = await sql(
      `SELECT id FROM reports
        WHERE creator_username = $1 AND reporter_ip = $2 AND status = 'open'`,
      [creator, ip],
    );
    if (dup.length === 0) {
      const inserted = await sql(
        `INSERT INTO reports (creator_username, reason, detail, reporter_ip)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [creator, reason, detail ? String(detail).slice(0, 500) : null, ip],
      );
      await recordReputationEvent({
        eventType: REPUTATION_EVENTS.REPORT_FILED,
        subjectType: "username",
        subjectId: creator,
        ref: `report:${inserted[0].id}`,
      });
    }

    // Escalation counts distinct reporters, not distinct reports.
    const distinct = await sql(
      `SELECT count(DISTINCT reporter_ip) AS n FROM reports
        WHERE creator_username = $1 AND status = 'open'`,
      [creator],
    );
    if (Number(distinct[0].n) >= ESCALATION_THRESHOLD) {
      const changed = await sql(
        `UPDATE users SET status = 'under_review'
          WHERE username = $1 AND status = 'active' RETURNING id`,
        [creator],
      );
      if (changed.length > 0) {
        await recordReputationEvent({
          eventType: REPUTATION_EVENTS.PAGE_UNDER_REVIEW,
          subjectType: "username",
          subjectId: creator,
          ref: `review:${changed[0].id}:${Date.now()}`,
        });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Report error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
