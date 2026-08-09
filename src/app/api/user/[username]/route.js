import sql from "@/app/api/utils/sql";

export async function loader({ request, params }) {
  try {
    const { username } = params;

    if (!username) {
      return Response.json({ error: "Username is required." }, { status: 400 });
    }

    const rows = await sql(
      `SELECT username, wallet_address, full_name, created_at, fee_mode, status,
              bio, category, accent_color, thank_you_message, social_links
         FROM users WHERE username = $1`,
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
      tipRouterAddress: process.env.TIP_ROUTER_ADDRESS || "",
    });
  } catch (err) {
    console.error("User lookup error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
