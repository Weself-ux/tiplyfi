// Circle session tokens live in httpOnly cookies, never in the database.
// userToken + encryptionKey together authorise moving funds, so a database
// breach must not become a funds breach.

const NAMES = {
  userToken: "circle_ut",
  refreshToken: "circle_rt",
  encryptionKey: "circle_ek",
  issuedAt: "circle_at",
};

const MAX_AGE = 14 * 24 * 60 * 60; // matches Circle's 14-day expiry

function cookie(name, value, maxAge = MAX_AGE) {
  return (
    `${name}=${encodeURIComponent(value ?? "")}; Path=/; HttpOnly; ` +
    `Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

/// Returns headers that set every Circle cookie. Pass to Response.json.
export function setCircleCookies({ userToken, refreshToken, encryptionKey }) {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", cookie(NAMES.userToken, userToken));
  headers.append("Set-Cookie", cookie(NAMES.refreshToken, refreshToken));
  headers.append("Set-Cookie", cookie(NAMES.encryptionKey, encryptionKey));
  headers.append("Set-Cookie", cookie(NAMES.issuedAt, String(Date.now())));
  return headers;
}

export function clearCircleCookies() {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const name of Object.values(NAMES)) {
    headers.append("Set-Cookie", cookie(name, "", 0));
  }
  return headers;
}

export function readCircleCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const jar = Object.fromEntries(
    raw
      .split(";")
      .map((p) => p.trim().split("="))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
  return {
    userToken: jar[NAMES.userToken] || null,
    refreshToken: jar[NAMES.refreshToken] || null,
    encryptionKey: jar[NAMES.encryptionKey] || null,
    issuedAt: Number(jar[NAMES.issuedAt]) || 0,
  };
}

/// Refresh a day early so a long-running action can't expire mid-flight.
export function needsRefresh(issuedAt) {
  if (!issuedAt) return false;
  return Date.now() - issuedAt > 13 * 24 * 60 * 60 * 1000;
}
