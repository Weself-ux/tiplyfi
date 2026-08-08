import argon2 from "argon2";
import sql from "@/app/api/utils/sql";
import {
  createSession,
  rateLimit,
  getClientIP,
  isValidEmail,
  isValidUsername,
  validatePassword,
} from "@/app/api/utils/auth-helpers";

export async function action({ request }) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimit(ip, "signup", 5, 60 * 60 * 1000); // 5 per hour
    if (!limit.allowed) {
      return Response.json(
        {
          error: `Too many signup attempts. Try again in ${limit.retryAfter} seconds.`,
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const {
      fullName,
      email,
      username: rawUsername,
      password,
      dateOfBirth,
      walletAddress,
    } = body;
    const username =
      typeof rawUsername === "string" ? rawUsername.toLowerCase() : rawUsername;

    // Server-side validation
    if (!fullName || fullName.trim().length < 2) {
      return Response.json(
        { error: "Full name is required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (!isValidUsername(username)) {
      return Response.json(
        {
          error:
            "Username must be 5-30 characters, lowercase letters, numbers, and underscores only.",
        },
        { status: 400 },
      );
    }

    const passError = validatePassword(password);
    if (passError) {
      return Response.json({ error: passError }, { status: 400 });
    }

    // Check if email already exists
    const existingEmail = await sql("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existingEmail.length > 0) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // Check if username already exists (global uniqueness)
    const existingUsername = await sql(
      "SELECT id FROM users WHERE username = $1",
      [username.toLowerCase()],
    );
    if (existingUsername.length > 0) {
      return Response.json(
        { error: "This username is already taken." },
        { status: 409 },
      );
    }

    // Server-side handle protection. The client check can be bypassed.
    const held = await sql(
      "SELECT kind, claim_token, claimed_by FROM reserved_handles WHERE handle = $1",
      [username.toLowerCase()],
    );
    if (held.length > 0) {
      const h = held[0];
      const claimable =
        h.kind === "reserved" &&
        !h.claimed_by &&
        h.claim_token &&
        body.claimToken === h.claim_token;
      if (!claimable) {
        return Response.json(
          { error: "This username isn't available." },
          { status: 400 },
        );
      }
    }

    // Server-side handle protection. The client check can be bypassed.
    const heldHandle = await sql(
      "SELECT kind, claim_token, claimed_by FROM reserved_handles WHERE handle = $1",
      [username.toLowerCase()],
    );
    if (heldHandle.length > 0) {
      const h = heldHandle[0];
      const claimable =
        h.kind === "reserved" &&
        !h.claimed_by &&
        h.claim_token &&
        body.claimToken === h.claim_token;
      if (!claimable) {
        return Response.json(
          { error: "This username isn't available." },
          { status: 409 },
        );
      }
    }

    // Hash password with argon2 (industry standard)
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    // Insert user — only public wallet address stored, NEVER private key
    const result = await sql(
      `INSERT INTO users (full_name, email, username, password_hash, date_of_birth, wallet_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, username, wallet_address, date_of_birth, created_at`,
      [
        fullName.trim(),
        email.toLowerCase(),
        username.toLowerCase(),
        passwordHash,
        dateOfBirth || null,
        walletAddress || null,
      ],
    );

    const user = result[0];

    // Create session token
    const token = await createSession(user.id);

    return Response.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
        walletAddress: user.wallet_address,
        dateOfBirth: user.date_of_birth,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
