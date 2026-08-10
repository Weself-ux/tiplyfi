import sql from "@/app/api/utils/sql";
import { rateLimit, getClientIP } from "@/app/api/utils/auth-helpers";

// Only names the funnel actually uses. An open endpoint that accepts any
// string is a spam target and makes the data useless.
const ALLOWED = new Set([
  "landing_view",
  "claim_started",
  "claim_submitted",
  "signup_started",
  "signup_username_set",
  "signup_completed",
  "link_copied",
  "link_shared",
  "tip_page_view",
  "tip_started",
  "tip_completed",
  "withdraw_started",
  "withdraw_completed",
]);

export async function action({ request }) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimit(ip, "events", 300, 60 * 60 * 1000);
    if (!limit.allowed) return Response.json({ ok: true });

    const { name, sessionId, username, props } = await request.json();
    if (!ALLOWED.has(name)) {
      return Response.json({ error: "Unknown event." }, { status: 400 });
    }

    await sql(
      `INSERT INTO events (name, session_id, username, props)
       VALUES ($1, $2, $3, $4)`,
      [
        name,
        sessionId ? String(sessionId).slice(0, 64) : null,
        username ? String(username).toLowerCase().slice(0, 40) : null,
        JSON.stringify(props && typeof props === "object" ? props : {}),
      ],
    );

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Event write error:", err);
    // Analytics must never surface as a user-facing failure.
    return Response.json({ ok: true });
  }
}
