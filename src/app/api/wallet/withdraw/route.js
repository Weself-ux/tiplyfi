import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";
import {
  createTransferChallenge,
  getWalletBalances,
  listUserWallets,
} from "@/app/api/utils/circle";
import { readCircleCookies } from "@/app/api/utils/circle-session";

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { userToken } = readCircleCookies(request);
    if (!userToken) {
      return Response.json(
        { error: "Wallet session expired. Please sign in again.", expired: true },
        { status: 401 },
      );
    }

    const { toAddress, amount } = await request.json();

    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress || "")) {
      return Response.json({ error: "Enter a valid address." }, { status: 400 });
    }
    if (toAddress.toLowerCase() === (user.walletAddress || "").toLowerCase()) {
      return Response.json(
        { error: "That's your own address." },
        { status: 400 },
      );
    }
    const value = Number(amount);
    if (!(value > 0)) {
      return Response.json({ error: "Enter a valid amount." }, { status: 400 });
    }

    const rows = await sql(
      "SELECT circle_wallet_id FROM users WHERE id = $1",
      [user.id],
    );
    let walletId = rows[0]?.circle_wallet_id;

    // Older rows may predate the column being populated.
    if (!walletId) {
      const wallets = await listUserWallets(userToken);
      const arc = wallets.find((w) => w.blockchain === "ARC-TESTNET");
      if (!arc?.id) {
        return Response.json({ error: "No wallet found." }, { status: 404 });
      }
      walletId = arc.id;
      await sql("UPDATE users SET circle_wallet_id = $1 WHERE id = $2", [
        walletId,
        user.id,
      ]);
    }

    // tokenId is per-chain and per-token, so it has to be looked up rather
    // than hardcoded.
    const balances = await getWalletBalances(userToken, walletId);
    const usdc = balances.find((b) =>
      (b.token?.symbol || "").toUpperCase().startsWith("USDC"),
    );
    if (!usdc?.token?.id) {
      return Response.json(
        { error: "No USDC balance to withdraw." },
        { status: 400 },
      );
    }
    if (Number(usdc.amount) < value) {
      return Response.json(
        { error: `You have ${usdc.amount} USDC available.` },
        { status: 400 },
      );
    }

    const challengeId = await createTransferChallenge(userToken, {
      walletId,
      destinationAddress: toAddress,
      amount: value,
      tokenId: usdc.token.id,
    });
    if (!challengeId) {
      return Response.json(
        { error: "Could not start the withdrawal." },
        { status: 502 },
      );
    }

    return Response.json({ challengeId });
  } catch (err) {
    console.error("Withdraw error:", err);
    return Response.json(
      { error: "Could not start the withdrawal.", detail: err.message },
      { status: 500 },
    );
  }
}
