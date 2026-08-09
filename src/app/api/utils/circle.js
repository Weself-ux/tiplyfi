// Circle User-Controlled Wallets — server side.
// REST rather than the SDK: user-controlled wallets need no entity secret
// (the user's PIN authorises signing), and this codebase has already hit
// ESM interop failures with Circle's Node packages in production.

const BASE = "https://api.circle.com/v1/w3s";

async function circleFetch(path, { method = "GET", userToken, body } = {}) {
  const headers = {
    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (userToken) headers["X-User-Token"] = userToken;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.message || data?.error || res.statusText;
    const err = new Error(`Circle ${method} ${path}: ${detail}`);
    err.circleCode = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

/// Creates the PIN-setup + wallet-creation challenge. The wallet does not
/// exist until the user completes this challenge in the browser SDK.
/// Code 155106 means the user is already initialised — fetch wallets instead.
export async function initializeUserWallet(userToken) {
  const data = await circleFetch("/user/initialize", {
    method: "POST",
    userToken,
    body: {
      idempotencyKey: crypto.randomUUID(),
      blockchains: ["ARC-TESTNET"],
      accountType: "SCA",
    },
  });
  return data?.data?.challengeId || null;
}

export async function listUserWallets(userToken) {
  const data = await circleFetch("/wallets", { userToken });
  return data?.data?.wallets || [];
}

/// Circle's own user record. Useful for confirming whether the same social
/// identity resolves to one userId across every app on this App ID.
export async function getCircleUser(userToken) {
  const data = await circleFetch("/user", { userToken });
  return data?.data?.user || null;
}
