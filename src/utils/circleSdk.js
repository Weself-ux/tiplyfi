// Circle User-Controlled Wallets — browser SDK.
// Loaded dynamically: the SDK touches window at import time and must never
// enter the SSR bundle.

let sdkPromise = null;

const CONFIG = () => ({
  appSettings: {
    appId: import.meta.env.NEXT_PUBLIC_CIRCLE_APP_ID || "",
  },
  loginConfigs: {
    google: {
      clientId: import.meta.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID || "",
      redirectUri: window.location.origin,
    },
  },
});

/// One SDK instance per page load. getDeviceId() is called immediately —
/// without it, execute() fails silently with no error.
export async function getSdk() {
  if (typeof window === "undefined") {
    throw new Error("Circle SDK is browser-only.");
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
    const sdk = new W3SSdk({ configs: CONFIG() });
    await sdk.getDeviceId();
    return sdk;
  })();

  return sdkPromise;
}

/// Opens Google's popup and resolves with the tokens plus the provider
/// identity. socialUserUUID is the stable per-provider subject id.
export async function loginWithGoogle() {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const { SocialLoginProvider } = await import(
    "@circle-fin/w3s-pw-web-sdk/dist/src/types"
  );

  return new Promise((resolve, reject) => {
    const sdk = new W3SSdk({
      configs: CONFIG(),
      socialLoginCompleteCallback: (error, result) => {
        if (error) {
          reject(new Error(error.message || "Google sign-in failed."));
          return;
        }
        resolve({
          userToken: result.userToken,
          encryptionKey: result.encryptionKey,
          provider: result.oauthInfo?.provider || "google",
          socialUserUUID: result.oauthInfo?.socialUserUUID || null,
          email: result.oauthInfo?.socialUserInfo?.email || null,
          name: result.oauthInfo?.socialUserInfo?.name || null,
        });
      },
    });
    sdk.getDeviceId().then(() => {
      sdk.performLogin(SocialLoginProvider.GOOGLE);
    });
  });
}

/// Runs a challenge — PIN setup, wallet creation, transaction signing.
/// setAuthentication must precede execute or nothing happens.
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
