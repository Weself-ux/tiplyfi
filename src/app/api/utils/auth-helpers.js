import sql from "@/app/api/utils/sql";

// Simple rate limiter (in-memory, resets on server restart)
const rateLimitMap = new Map();

export function rateLimit(ip, action, maxAttempts, windowMs) {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.startTime > windowMs) {
    rateLimitMap.set(key, { count: 1, startTime: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.startTime + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

// Generate a random session token
export function generateToken() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create a session in the database
export async function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await sql(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt.toISOString()],
  );

  return token;
}

// Validate a session token and return the user
export async function validateSession(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  const rows = await sql(
    `SELECT s.user_id, s.expires_at, u.id, u.full_name, u.email, u.username, u.wallet_address, u.date_of_birth, u.created_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = $1`,
    [token],
  );

  if (rows.length === 0) return null;

  const session = rows[0];
  if (new Date(session.expires_at) < new Date()) {
    // Session expired, clean it up
    await sql("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }

  return {
    id: session.id,
    fullName: session.full_name,
    email: session.email,
    username: session.username,
    walletAddress: session.wallet_address,
    dateOfBirth: session.date_of_birth,
    createdAt: session.created_at,
  };
}


// Validate username format
export function isValidUsername(username) {
  return /^[a-z0-9_]{5,30}$/.test(username);
}

// Get client IP from request
export function getClientIP(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}
