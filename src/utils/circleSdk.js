// The Circle SDK pulls in dotenv and firebase, which probe process.version
// and process.versions. The nextPublicProcessEnv plugin supplies process.env
// in the browser but nothing else, and the node polyfill can't supply it
// because that shim also lands in the SSR bundle and empties server env vars.
// So the shim is applied here, client-side only, right where it's needed.
if (typeof window !== "undefined") {
  const p = (globalThis.process ??= {});
  p.env ??= {};
  p.version ??= "v18.0.0";
  p.versions ??= { node: "18.0.0" };
  p.platform ??= "browser";
  p.browser = true;
  p.nextTick ??= (fn, ...args) => setTimeout(() => fn(...args), 0);
}

// Circle User-Controlled Wallets — browser SDK.
//
// performLogin REDIRECTS the whole page to Google. Nothing in memory
// survives, so the flow is: persist what we need, redirect, and pick the
// result up from the login callback on the next page load.

const STORE = {
  deviceId: "circle_device_id",
  deviceToken: "circle_device_token",
  deviceEncryptionKey: "circle_device_encryption_key",
  pending: "circle_login_pending",
};

const read = (k) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const clear = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {}
};

function config() {
  const appId = import.meta.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";
  const clientId = import.meta.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID || "";
  // Names which one is missing, and confirms whether env reached the bundle.
  if (!appId) {
    throw new Error(
      `NEXT_PUBLIC_CIRCLE_APP_ID is empty (google id len ${clientId.length})`,
    );
  }
  if (!clientId) {
    throw new Error(
      `NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID is empty (app id len ${appId.length})`,
    );
  }

  return {
    appSettings: { appId },
    loginConfigs: {
      deviceToken: read(STORE.deviceToken),
      deviceEncryptionKey: read(STORE.deviceEncryptionKey),
      google: {
        clientId,
        // Return to whichever page started the flow, so signing in doesn't
        // dump you on the signup form. Both paths are registered in Google
        // Cloud Console; anything else falls back to /signup.
        redirectUri: `${window.location.origin}${
          window.location.pathname === "/login" ? "/login" : "/signup"
        }`,
        selectAccountPrompt: true,
      },
    },
  };
}

/// Creates the SDK. onLoginComplete(error, result) fires after the OAuth
/// redirect returns, so it must be wired before anything else happens.
export async function initSdk(onLoginComplete) {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  // The callback is the second positional argument, not a config field.
  return new W3SSdk(config(), onLoginComplete);
}

/// The deviceId identifies this browser. Cached because fetching it opens an
/// invisible modal that must not run while authentication is in flight.
export async function ensureDeviceId(sdk) {
  const cached = read(STORE.deviceId);
  if (cached) return cached;
  const id = await sdk.getDeviceId();
  write(STORE.deviceId, id);
  return id;
}

/// Fetched on mount rather than on click: nothing about it depends on the
/// user, so making them wait for two round trips after clicking is wasted time.
let devicePrep = null;

export function prepareDeviceSession(sdk) {
  if (devicePrep) return devicePrep;

  // Circle allows one active token per device. Requesting a second one
  // invalidates the first, so reuse what we have rather than churning it.
  const existing = read(STORE.deviceToken);
  const existingKey = read(STORE.deviceEncryptionKey);
  if (existing && existingKey) {
    devicePrep = Promise.resolve({
      deviceToken: existing,
      deviceEncryptionKey: existingKey,
    });
    return devicePrep;
  }

  devicePrep = (async () => {
    const deviceId = await ensureDeviceId(sdk);
    if (!deviceId) throw new Error("No device id returned by the SDK.");

    const res = await fetch("/api/auth/circle/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.error || "Could not start sign-in.");
    }
    if (!data.deviceToken || !data.deviceEncryptionKey) {
      throw new Error("Circle returned an incomplete device session.");
    }

    write(STORE.deviceToken, data.deviceToken);
    write(STORE.deviceEncryptionKey, data.deviceEncryptionKey);
    return data;
  })().catch((err) => {
    devicePrep = null; // let the click retry rather than cache the failure
    throw err;
  });
  return devicePrep;
}

/// Hands the page to Google. Does not return.
export async function startGoogleLogin(sdk) {
  // A fresh token for a fresh attempt: a stale one from an abandoned login
  // fails Circle's callback check.
  clearDeviceSession();
  devicePrep = null;
  await prepareDeviceSession(sdk);
  write(STORE.pending, "1");

  sdk.updateConfigs(config());

  const types = await import("@circle-fin/w3s-pw-web-sdk/dist/src/types");
  const provider = types?.SocialLoginProvider?.GOOGLE;
  if (!provider) {
    throw new Error(
      `SocialLoginProvider missing. exports: ${Object.keys(types || {}).join(",")}`,
    );
  }
  sdk.performLogin(provider);
}

/// Only true if we are genuinely returning from Google: the flag alone is not
/// enough, because a failed attempt leaves it set. Google's response arrives
/// in the URL hash, so that is the real signal.
export function isLoginPending() {
  if (read(STORE.pending) !== "1") return false;
  const hasOauthHash = /[#&](id_token|access_token|error)=/.test(
    window.location.hash || "",
  );
  if (!hasOauthHash) {
    clear(STORE.pending);
    return false;
  }
  return true;
}
export const clearLoginPending = () => clear(STORE.pending);

export function clearDeviceSession() {
  clear(STORE.deviceToken);
  clear(STORE.deviceEncryptionKey);
  clear(STORE.pending);
  devicePrep = null;
}

/// True when the page is handling Google's response. Prefetching a device
/// token now would invalidate the one Circle is about to validate.
export function isOauthReturn() {
  return /[#&](id_token|access_token|error)=/.test(window.location.hash || "");
}

/// Fetches live Circle credentials from the server, refreshing them if the
/// 14-day window is nearly up. Tokens live in httpOnly cookies, so the
/// browser never holds them directly.
export async function getCircleSession() {
  const token = localStorage.getItem("tiplyfi_token");
  const res = await fetch("/api/auth/circle/session", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Wallet session expired.");
    err.expired = Boolean(data.expired);
    throw err;
  }
  return data;
}

/// Runs a challenge — PIN setup, wallet creation, signing.
export function executeChallenge(sdk, { challengeId, userToken, encryptionKey }) {
  sdk.setAuthentication({ userToken, encryptionKey });
  return new Promise((resolve, reject) => {
   let settled = false;
    sdk.execute(challengeId, (error, result) => {
      if (settled) return;

      // 155706 is Circle's 10-second iframe timeout. Its hosted UI is often
      // slower than that on a cold load and then renders fine, so treating
      // it as fatal shows an error over a working approval screen.
      if (error?.code === 155706) {
        console.warn("[tiplyfi] circle iframe slow to load, waiting");
        return;
      }
      settled = true;

      if (error) {
        reject(new Error(error.message || "Challenge failed."));
        return;
      }
      resolve(result);
    });
  });
}
