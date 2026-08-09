// Circle User-Controlled Wallets — browser SDK.
// Loaded dynamically: the SDK touches window at import time and must never
// enter the SSR bundle.
//
// ONE instance per page load. getDeviceId() opens an invisible modal, so a
// second instance calling it clobbers the first and the handshake never
// completes. Circle's docs are explicit about this.

let sdkPromise = null;
let pendingLogin = null;

function readConfig() {
  const appId = import.meta.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";
  const googleClientId = import.meta.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID || "";

  if (!appId) throw new Error("Circle App ID is not configured.");
  if (!googleClientId) throw new Error("Google client ID is not configured.");

  return {
    appSettings: { appId },
    loginConfigs: {
      google: { clientId: googleClientId, redirectUri: window.location.origin },
    },
  };
}

async function initSdk() {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

  const sdk = new W3SSdk({
    configs: readConfig(),
    // One callback for the instance; each login attempt parks its resolver
    // here rather than constructing a second SDK.
    socialLoginCompleteCallback: (error, result) => {
      if (!pendingLogin) return;
      const { resolve, reject } = pendingLogin;
      pendingLogin = null;

      if (error) {
        reject(new Error(error.message || "Sign-in was cancelled."));
        return;
      }
      resolve({
        userToken: result?.userToken,
        encryptionKey: result?.encryptionKey,
        provider: result?.oauthInfo?.provider || "google",
        socialUserUUID: result?.oauthInfo?.socialUserUUID || null,
        email: result?.oauthInfo?.socialUserInfo?.email || null,
        name: result?.oauthInfo?.socialUserInfo?.name || null,
      });
    },
  });

  // Must finish before performLogin, and must never overlap with it.
  await sdk.getDeviceId();
  return sdk;
}

export function getSdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Circle SDK is browser-only."));
  }
  if (!sdkPromise) {
    sdkPromise = initSdk().catch((err) => {
      sdkPromise = null; // let the next attempt retry rather than cache failure
      throw err;
    });
  }
  return sdkPromise;
}

/// Opens Google's popup. socialUserUUID is the stable per-provider subject id.
export async function loginWithGoogle() {
  const sdk = await getSdk();
  const { SocialLoginProvider } = await import(
    "@circle-fin/w3s-pw-web-sdk/dist/src/types"
  );

  return new Promise((resolve, reject) => {
    // A hung popup must not leave the button spinning forever.
    const timer = setTimeout(() => {
      if (pendingLogin) {
        pendingLogin = null;
        reject(new Error("Sign-in timed out. Please try again."));
      }
    }, 120000);

    pendingLogin = {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    };

    try {
      sdk.performLogin(SocialLoginProvider.GOOGLE);
    } catch (err) {
      clearTimeout(timer);
      pendingLogin = null;
      reject(err);
    }
  });
}

/// Runs a challenge — PIN setup, wallet creation, transaction signing.
export async function executeChallenge({
  challengeId,
  userToken,
  encryptionKey,
}) {
  const sdk = await getSdk();
  sdk.setAuthentication({ userToken, encryptionKey });

  return new Promise((resolve, reject) => {
    sdk.execute(challengeId, (error, result) => {
      if (error) {
        reject(new Error(error.message || "Challenge failed."));
        return;
      }
      resolve(result);
    });
  });
}
