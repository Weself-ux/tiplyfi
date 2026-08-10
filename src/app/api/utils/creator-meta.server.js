import sql from "@/app/api/utils/sql";

/// The .server.js suffix is enforced by React Router: this module can never
/// reach the browser bundle, so the database client can't either.
export async function getCreatorMeta(username) {
  const handle = String(username || "").toLowerCase();
  if (!handle) return null;
  try {
    const rows = await sql(
      `SELECT u.username, u.full_name, u.bio, u.category, u.status,
              (SELECT count(*) FROM tips t
                WHERE t.creator_username = u.username AND t.status = 'confirmed')
                AS tip_count
         FROM users u WHERE u.username = $1`,
      [handle],
    );
    return rows[0] || null;
  } catch (err) {
    console.error("[creator-meta]", err);
    return null;
  }
}
