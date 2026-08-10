import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";
import { listUserWallets } from "@/app/api/utils/circle";
import {
  recordReputationEvent,
  REPUTATION_EVENTS,
} from "@/app/api/utils/reputation";

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { userToken } = await request.json();
    if (!userToken) {
      return Response.json({ error: "Sign-in incomplete." }, { status: 400 });
    }

    const wallets = await listUserWallets(userToken);
    const arc = wallets.find((w) => w.blockchain === "ARC-TESTNET");
    if (!arc?.address) {
      return Response.json(
        { error: "Wallet not ready yet. Please try again." },
        { status: 409 },
      );
    }

    // userId comes back on the wallet record, so no extra call is needed.
    await sql(
      `UPDATE users
          SET wallet_address = $1,
              circle_wallet_id = $2,
              circle_user_id = COALESCE(circle_user_id, $3)
        WHERE id = $4`,
      [arc.address, arc.id, arc.userId || null, user.id],
    );

    await recordReputationEvent({
      eventType: REPUTATION_EVENTS.ACCOUNT_CREATED,
      subjectType: "username",
      subjectId: user.username,
      ref: `user:${user.id}`,
    });

    return Response.json({ success: true, walletAddress: arc.address });
  } catch (err) {
    console.error("Circle complete error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
