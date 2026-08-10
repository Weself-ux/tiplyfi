import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const rows = await sql(
      `SELECT id, to_address, amount_usdc, tx_hash, status, created_at
         FROM withdrawals WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [user.id],
    );
    return Response.json({ withdrawals: rows });
  } catch (err) {
    console.error("Withdrawals read error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { toAddress, amount, txHash, challengeId, status } =
      await request.json();

    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress || "")) {
      return Response.json({ error: "Invalid address." }, { status: 400 });
    }

    // Idempotent on tx_hash, so a retry can't double-record a withdrawal.
    await sql(
      `INSERT INTO withdrawals (user_id, to_address, amount_usdc, tx_hash, challenge_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tx_hash) DO UPDATE SET status = EXCLUDED.status`,
      [
        user.id,
        toAddress,
        Number(amount) || 0,
        txHash || null,
        challengeId || null,
        status === "confirmed" ? "confirmed" : "pending",
      ],
    );

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Withdrawal record error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
