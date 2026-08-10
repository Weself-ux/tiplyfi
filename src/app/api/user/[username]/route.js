import sql from "@/app/api/utils/sql";

export async function loader({ request, params }) {
  try {
    const { username } = params;

    if (!username) {
      return Response.json({ error: "Username is required." }, { status: 400 });
    }

    const rows = await sql(
      // Supporter counts are social proof on the tip page, so they come back
      // with the creator rather than in a second request.
      `SELECT u.username, u.wallet_address, u.full_name, u.created_at,
              u.fee_mode, u.status, u.bio, u.category, u.accent_color,
              u.thank_you_message, u.social_links, u.full_name AS display_name,
              (SELECT count(*) FROM tips t
                WHERE t.creator_username = u.username AND t.status = 'confirmed')
                AS tip_count,
              (SELECT count(DISTINCT t.supporter_ref) FROM tips t
                WHERE t.creator_username = u.username AND t.status = 'confirmed'
                  AND t.supporter_ref IS NOT NULL)
                AS supporter_count
         FROM users u WHERE u.username = $1`,
      [username.toLowerCase()],
    );

    if (rows.length === 0) {
      return Response.json({ error: "Creator not found." }, { status: 404 });
    }

    const user = rows[0];
    if (user.status === "unpublished") {
      return Response.json({ error: "Creator not found." }, { status: 404 });
    }
    return Response.json({
      status: user.status || "active",
      username: user.username,
      walletAddress: user.wallet_address,
      displayName: user.full_name,
      createdAt: user.created_at,
      feeMode: user.fee_mode || "creator_absorbs",
      bio: user.bio || null,
      category: user.category || null,
      accentColor: user.accent_color || "#7c3aed",
      thankYouMessage: user.thank_you_message || null,
      socialLinks: user.social_links || {},
      tipCount: Number(user.tip_count) || 0,
      supporterCount: Number(user.supporter_count) || 0,
      tipRouterAddress: process.env.TIP_ROUTER_ADDRESS || "",
    });
  } catch (err) {
    console.error("User lookup error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
