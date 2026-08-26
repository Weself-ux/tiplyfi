// POST /api/autosave/enable
//
// Server-side build of the auto-save enable batch. The creator approves ONE
// challenge; the server does everything else first:
//   1. gate  -- wallet must be funded and deployed (gas is USDC on Arc)
//   2. read  -- weself_id + wallet, server-side; weself_id never hits the wire
//   3. salt  -- increment per-enable so an off-then-on can't collide on chain
//   4. bind  -- record the owner on Safemi's factory, await the receipt
//   5. batch -- encode approve + Permit2.approve + registerRule as one aggregate3
//   6. challenge -- hand Circle the callData, return the challengeId
//
// The client then runs executeChallenge(challengeId) -- one signature, three
// actions, msg.sender preserved by Multicall3From. Confirmation is a separate
// route: nothing is marked enabled until the transaction is seen on chain.

import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";
import { readCircleCookies } from "@/app/api/utils/circle-session";
import {
  createContractExecutionChallenge,
  getWalletBalances,
  listUserWallets,
} from "@/app/api/utils/circle";
import {
  bindOwner,
  encodeEnableBatch,
  getRuleHash,
  newExpiry,
} from "@/app/api/utils/autosave";

const MAX_PCT = 50;

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

    const { pct } = await request.json();
    if (!Number.isInteger(pct) || pct < 1 || pct > MAX_PCT) {
      return Response.json(
        { error: `Choose a save amount between 1% and ${MAX_PCT}%.` },
        { status: 400 },
      );
    }

    // weeself_id is NOT on the session object -- read it from users directly.
    const rows = await sql(
      `SELECT weself_id, wallet_address, circle_wallet_id, autosave_salt
         FROM users WHERE id = $1`,
      [user.id],
    );
    const row = rows[0];
    if (!row?.weself_id) {
      return Response.json(
        { error: "Account not fully set up." },
        { status: 400 },
      );
    }
    const ownerAddress = row.wallet_address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAddress || "")) {
      return Response.json({ error: "No wallet on file." }, { status: 400 });
    }

    // Resolve walletId, backfilling the column if an older row lacks it.
    let walletId = row.circle_wallet_id;
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

    // Gate: the wallet must be able to pay its own gas. On Arc gas is USDC, and
    // the enable transaction plus any lazy deployment come out of this balance.
    const balances = await getWalletBalances(userToken, walletId);
    const usdc = balances.find((b) =>
      (b.token?.symbol || "").toUpperCase().startsWith("USDC"),
    );
    const usdcAmount = Number(usdc?.amount || 0);
    if (usdcAmount < 0.5) {
      return Response.json(
        {
          error:
            "Add a little USDC first -- auto-save needs to cover network fees.",
          needsFunds: true,
        },
        { status: 400 },
      );
    }

    // Per-enable salt: increment first, use the new value, so a revoked rule is
    // never re-registered with identical parameters (it would revert on chain).
    const salted = await sql(
      `UPDATE users SET autosave_salt = autosave_salt + 1
        WHERE id = $1 RETURNING autosave_salt`,
      [user.id],
    );
    const salt = salted[0].autosave_salt;

    // Bind the owner on Safemi's factory and WAIT for the receipt. registerRule
    // needs the binding to exist; Arc's instant finality guarantees ordering
    // once this returns.
    await bindOwner(row.weself_id, ownerAddress);

    // One expiry, shared by the batch and the rule hash. If these differed the
    // registered rule and the stored hash would describe different rules, and
    // revoke would fail on an unknown hash.
    const expiry = newExpiry();
    const params = { ownerAddress, weselfId: row.weself_id, pct, salt, expiry };

    // Encode the three-call batch and open one challenge for it.
    const { contractAddress, callData } = encodeEnableBatch(params);

    // The executor's own hash for this exact rule, so /confirm and the disable
    // path revoke by a hash the chain will recognise. Never computed off-chain.
    const ruleHash = await getRuleHash(params);

    const challengeId = await createContractExecutionChallenge(userToken, {
      walletId,
      contractAddress,
      callData,
    });
    if (!challengeId) {
      return Response.json(
        { error: "Could not start the approval. Nothing was changed." },
        { status: 502 },
      );
    }

    // Stash the pending intent so /confirm can finalise against it. Not enabled
    // yet -- only the on-chain confirmation flips autosave_enabled.
    await sql(
      `UPDATE users
          SET autosave_pct = $1, autosave_rule_hash = $2
        WHERE id = $3`,
      [pct, ruleHash, user.id],
    );

    return Response.json({ challengeId, pct, salt });
  } catch (err) {
    console.error("[autosave/enable]", err);
    return Response.json(
      { error: "Couldn't turn that on. Nothing was changed." },
      { status: 500 },
    );
  }
}
