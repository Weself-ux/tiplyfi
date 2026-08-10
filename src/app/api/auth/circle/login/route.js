import sql from "@/app/api/utils/sql";
import { createSession } from "@/app/api/utils/auth-helpers";
import { listUserWallets } from "@/app/api/utils/circle";

export async function action({ request }) {
  try {
    const { userToken, provider, socialUserUUID, email } =
      await request.json();

    if (!userToken || !socialUserUUID) {
      return Response.json({ error: "Sign-in incomplete." }, { status: 400 });
    }

    // Never trust the client's claim of who it is: the token must be proven
    // against Circle before it can select a Weself account. listWallets is
    // the check Circle's own tutorial uses — a new user simply has none yet,
    // which still proves the token is valid.
    try {
      await listUserWallets(userToken);
    } catch (err) {
      console.error("Circle token check failed:", err.message);
      return Response.json(
        { error: "Sign-in failed.", detail: err.message },
        { status: 401 },
      );
    }

    const rows = await sql(
      `SELECT id, username, email, wallet_address, weself_id
         FROM users
        WHERE auth_provider = $1 AND provider_subject_id = $2`,
      [String(provider || "google").toLowerCase(), socialUserUUID],
    );

    if (rows.length === 0) {
      return Response.json({ registered: false, email: email || null });
    }

    const user = rows[0];
    const token = await createSession(user.id);

    return Response.json({
      registered: true,
      token,
      needsWallet: !user.wallet_address,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        weselfId: user.weself_id,
      },
    });
  } catch (err) {
    console.error("Circle login error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
