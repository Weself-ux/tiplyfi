import { setCircleCookies } from "@/app/api/utils/circle-session";
import sql from "@/app/api/utils/sql";
import {
  createSession,
  isValidUsername,
  rateLimit,
  getClientIP,
} from "@/app/api/utils/auth-helpers";
import { initializeUserWallet, listUserWallets } from "@/app/api/utils/circle";

export async function action({ request }) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimit(ip, "circle-register", 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const {
      userToken,
      refreshToken,
      encryptionKey,
      provider,
      socialUserUUID,
      email,
      name,
      claimToken,
    } = body;
    const username = String(body.username || "").toLowerCase().trim();

    if (!userToken || !socialUserUUID) {
      return Response.json({ error: "Sign-in incomplete." }, { status: 400 });
    }
    if (!isValidUsername(username)) {
      return Response.json({ error: "Invalid username." }, { status: 400 });
    }

    try {
      await listUserWallets(userToken);
    } catch (err) {
      console.error("Circle token check failed:", err.message);
      return Response.json(
        { error: "Sign-in failed.", detail: err.message },
        { status: 401 },
      );
    }

    const taken = await sql("SELECT id FROM users WHERE username = $1", [
      username,
    ]);
    if (taken.length > 0) {
      return Response.json(
        { error: "This username is already taken." },
        { status: 409 },
      );
    }

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
        return Response.json(
          { error: "This username isn't available." },
          { status: 409 },
        );
      }
    }

    // Idempotent on the provider identity: a retry after a failed challenge
    // returns the same row rather than creating a second account.
    const existing = await sql(
      `SELECT id, username FROM users
        WHERE auth_provider = $1 AND provider_subject_id = $2`,
      [String(provider || "google").toLowerCase(), socialUserUUID],
    );

    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      // weself_id is generated here and reconciled by the spine's identity
      // service later. The column is non-null from the first insert.
      const inserted = await sql(
        `INSERT INTO users
           (full_name, email, username, auth_provider, provider_subject_id,
            circle_user_id, weself_id, wallet_type)
         VALUES ($1, $2, $3, $4, $5, $6, gen_random_uuid(), 'circle_sca')
         RETURNING id`,
        [
          name || username,
          email || null,
          username,
          String(provider || "google").toLowerCase(),
          socialUserUUID,
          null,
        ],
      );
      userId = inserted[0].id;
    }

    if (held.length > 0) {
      await sql(
        "UPDATE reserved_handles SET claimed_by = $1, claimed_at = now() WHERE handle = $2",
        [userId, username],
      );
    }

    // Creates the PIN + wallet challenge. The wallet exists only once the
    // user completes it in the browser.
    let challengeId = null;
    let alreadyInitialised = false;
    try {
      challengeId = await initializeUserWallet(userToken);
    } catch (err) {
      if (err.circleCode === 155106) {
        // Already initialised: the PIN was set in an earlier session, so
        // there is no challenge to run and the wallet already exists.
        alreadyInitialised = true;
        challengeId = null;
      } else {
        throw err;
      }
    }

    const token = await createSession(userId);
    return new Response(
      JSON.stringify({
        success: true,
        token,
        challengeId,
        userId,
        alreadyInitialised,
      }),
      { headers: setCircleCookies({ userToken, refreshToken, encryptionKey }) },
    );
  } catch (err) {
    console.error("Circle register error:", err);
    return Response.json({ error: "Could not create your account." }, { status: 500 });
  }
}
