// Circle User-Controlled Wallets — server side.
// REST rather than the SDK: user-controlled wallets need no entity secret
// (the user's PIN authorises signing), and this codebase has already hit
// ESM interop failures with Circle's Node packages in production.

const BASE = "https://api.circle.com/v1/w3s";

/// Not global crypto: vite-plugin-node-polyfills shims crypto, and the shim
/// may not carry randomUUID in the server bundle.
function uuid() {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
    .slice(6, 8)
    .join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

async function circleFetch(path, { method = "GET", userToken, body } = {}) {
  const key = process.env.CIRCLE_API_KEY || "";
  // Temporary diagnostic. Reports the shape of the key the server actually
  // receives without exposing it. Remove once sign-in works.
  if (key.split(":").length !== 3) {
    throw new Error(
      `API key shape wrong — length ${key.length}, ` +
        `parts ${key.split(":").length}, ` +
        `starts "${key.slice(0, 14)}", ` +
        `ends "${key.slice(-4)}"`,
    );
  }

  const headers = {
    Authorization: `Bearer ${key}`,
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

/// Exchanges the SDK's deviceId for a device-bound session. Required before
/// performLogin — without it Circle's auth page has nothing to authenticate.
export async function createSocialDeviceToken(deviceId) {
  const data = await circleFetch("/users/social/token", {
    method: "POST",
    body: { idempotencyKey: uuid(), deviceId },
  });
  return {
    deviceToken: data?.data?.deviceToken,
    deviceEncryptionKey: data?.data?.deviceEncryptionKey,
  };
}

/// Creates the PIN-setup + wallet-creation challenge. The wallet does not
/// exist until the user completes this challenge in the browser SDK.
/// Code 155106 means the user is already initialised — fetch wallets instead.
export async function initializeUserWallet(userToken) {
  const data = await circleFetch("/user/initialize", {
    method: "POST",
    userToken,
    body: {
      idempotencyKey: uuid(),
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
