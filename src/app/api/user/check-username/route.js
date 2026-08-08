import sql from "@/app/api/utils/sql";

export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const rawUsername = url.searchParams.get("username");
    const username =
      typeof rawUsername === "string" ? rawUsername.toLowerCase() : rawUsername;

    if (!username || username.length < 5) {
      return Response.json({
        available: false,
        error: "Username must be at least 5 characters.",
      });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return Response.json({
        available: false,
        error: "Only lowercase letters, numbers, and underscores.",
      });
    }

    const rows = await sql("SELECT id FROM users WHERE username = $1", [
      username.toLowerCase(),
    ]);
    if (rows.length > 0) {
      return Response.json({ available: false });
    }

    // Protected handles. A reserved handle opens only to the matching token
    // from its outreach link; a blocked handle never opens.
    const claimToken = url.searchParams.get("claim");
    const held = await sql(
      "SELECT kind, claim_token, claimed_by FROM reserved_handles WHERE handle = $1",
      [username],
    );
    if (held.length > 0) {
      const h = held[0];
      const claimable =
        h.kind === "reserved" &&
        !h.claimed_by &&
        h.claim_token &&
        claimToken === h.claim_token;
      if (!claimable) {
        return Response.json({
          available: false,
          error:
            h.kind === "reserved"
              ? "This username is reserved. Use your invite link to claim it."
              : "This username isn't available.",
        });
      }
    }

    return Response.json({ available: true });
  } catch (err) {
    console.error("Username check error:", err);
    return Response.json(
      { available: false, error: "Could not check username." },
      { status: 500 },
    );
  }
}
