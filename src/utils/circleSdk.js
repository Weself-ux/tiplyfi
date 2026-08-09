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
  if (!appId) throw new Error("Circle App ID is not configured.");
  if (!clientId) throw new Error("Google client ID is not configured.");

  return {
    appSettings: { appId },
    loginConfigs: {
      deviceToken: read(STORE.deviceToken),
      deviceEncryptionKey: read(STORE.deviceEncryptionKey),
      google: {
        clientId,
        // Google returns here, so it must be the page that handles the
        // callback — not the origin, where nothing is listening.
        redirectUri: `${window.location.origin}/signup`,
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

/// Gets a device-bound session from our backend, stores it so it survives the
/// redirect, then hands the page to Google. Does not return.
export async function startGoogleLogin(sdk) {
  const deviceId = await ensureDeviceId(sdk);

  const res = await fetch("/api/auth/circle/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.error || "Could not start sign-in.");
  }

  write(STORE.deviceToken, data.deviceToken);
  write(STORE.deviceEncryptionKey, data.deviceEncryptionKey);
  write(STORE.pending, "1");

  sdk.updateConfigs(config());

  const { SocialLoginProvider } = await import(
    "@circle-fin/w3s-pw-web-sdk/dist/src/types"
  );
  sdk.performLogin(SocialLoginProvider.GOOGLE);
}

export const isLoginPending = () => read(STORE.pending) === "1";
export const clearLoginPending = () => clear(STORE.pending);

export function clearDeviceSession() {
  clear(STORE.deviceToken);
  clear(STORE.deviceEncryptionKey);
  clear(STORE.pending);
}

/// Runs a challenge — PIN setup, wallet creation, signing.
export function executeChallenge(sdk, { challengeId, userToken, encryptionKey }) {
  sdk.setAuthentication({ userToken, encryptionKey });
  return new Promise((resolve, reject) => {
    sdk.execute(challengeId, (error, result) => {
      if (error) reject(new Error(error.message || "Challenge failed."));
      else resolve(result);
    });
  });
}
