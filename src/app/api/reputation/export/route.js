import sql from "@/app/api/utils/sql";

/// Spine-facing feed. Tiplyfi emits facts; the spine assigns score.
/// Secured by the same shared secret as the cron.
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

export async function loader({ request }) {
  if (!authorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 2000);

    const rows = await sql(
      `SELECT id, source, event_type, subject_type, subject_id,
              counterparty, amount_usdc, ref, occurred_at
         FROM reputation_events
        WHERE synced_at IS NULL
        ORDER BY id ASC
        LIMIT $1`,
      [limit],
    );

    return Response.json({ events: rows, count: rows.length });
  } catch (err) {
    console.error("Reputation export error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/// Acknowledge consumption. Separate from the read so a failed spine-side
/// write never loses events.
export async function action({ request }) {
  if (!authorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "No ids supplied." }, { status: 400 });
    }
    const clean = ids.map(Number).filter(Number.isInteger).slice(0, 2000);
    if (clean.length === 0) {
      return Response.json({ error: "No valid ids." }, { status: 400 });
    }

    await sql(
      "UPDATE reputation_events SET synced_at = now() WHERE id = ANY($1::bigint[])",
      [clean],
    );
    return Response.json({ success: true, acknowledged: clean.length });
  } catch (err) {
    console.error("Reputation ack error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
