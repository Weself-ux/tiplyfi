import { validateSession } from "@/app/api/utils/auth-helpers";
import { refreshUserToken } from "@/app/api/utils/circle";
import {
  readCircleCookies,
  setCircleCookies,
  clearCircleCookies,
  needsRefresh,
} from "@/app/api/utils/circle-session";

/// Hands the SDK its Circle credentials, refreshing them first if the 14-day
/// window is nearly up. Requires a valid Tiplyfi session.
export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    let { userToken, refreshToken, encryptionKey, issuedAt } =
      readCircleCookies(request);

    if (!userToken || !encryptionKey) {
      return Response.json(
        { error: "Wallet session expired. Please sign in again.", expired: true },
        { status: 401, headers: clearCircleCookies() },
      );
    }

    if (needsRefresh(issuedAt) && refreshToken) {
      try {
        const next = await refreshUserToken(userToken, refreshToken);
        if (next.userToken) {
          userToken = next.userToken;
          refreshToken = next.refreshToken || refreshToken;
          encryptionKey = next.encryptionKey || encryptionKey;
          return new Response(
            JSON.stringify({ userToken, encryptionKey }),
            { headers: setCircleCookies({ userToken, refreshToken, encryptionKey }) },
          );
        }
      } catch (err) {
        console.error("Circle token refresh failed:", err.message);
        return Response.json(
          { error: "Wallet session expired. Please sign in again.", expired: true },
          { status: 401, headers: clearCircleCookies() },
        );
      }
    }

    return Response.json({ userToken, encryptionKey });
  } catch (err) {
    console.error("Circle session error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
