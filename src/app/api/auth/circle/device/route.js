import { createSocialDeviceToken } from "@/app/api/utils/circle";
import { rateLimit, getClientIP } from "@/app/api/utils/auth-helpers";

export async function action({ request }) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimit(ip, "circle-device", 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const { deviceId } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "Missing device id." }, { status: 400 });
    }

    const tokens = await createSocialDeviceToken(deviceId);
    if (!tokens.deviceToken) {
      return Response.json({ error: "Could not start sign-in." }, { status: 502 });
    }
    return Response.json(tokens);
  } catch (err) {
    console.error("Circle device token error:", err);
    return Response.json({ error: "Could not start sign-in." }, { status: 500 });
  }
}
