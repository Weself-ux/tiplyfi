import sql from "@/app/api/utils/sql";
import { validateSession } from "@/app/api/utils/auth-helpers";

const CATEGORIES = [
  "Art & Design", "Music", "Writing", "Video & Film", "Gaming",
  "Podcasting", "Education", "Technology", "Photography",
  "Fitness & Health", "Community", "Other",
];

const SOCIAL_KEYS = ["x", "instagram", "youtube", "tiktok", "twitch", "website"];

/// Only https, and only a host plus path. Blocks javascript: and data: URIs.
function cleanUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim().slice(0, 200);
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:") return null;
    // A hostname with no dot isn't a real link — "placeholder" would
    // otherwise parse cleanly as https://placeholder.
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function loader({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const rows = await sql(
      `SELECT full_name, bio, category, accent_color, thank_you_message, social_links
         FROM users WHERE id = $1`,
      [user.id],
    );
    const r = rows[0] || {};
    return Response.json({
      displayName: r.full_name || "",
      bio: r.bio || "",
      category: r.category || "",
      accentColor: r.accent_color || "#7c3aed",
      thankYouMessage: r.thank_you_message || "",
      socialLinks: r.social_links || {},
      categories: CATEGORIES,
    });
  } catch (err) {
    console.error("Profile read error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function action({ request }) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const body = await request.json();

    if (body.category && !CATEGORIES.includes(body.category)) {
      return Response.json({ error: "Unknown category." }, { status: 400 });
    }
    if (body.accentColor && !/^#[0-9a-fA-F]{6}$/.test(body.accentColor)) {
      return Response.json({ error: "Invalid colour." }, { status: 400 });
    }
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (name.length < 1 || name.length > 50) {
        return Response.json(
          { error: "Display name must be 1 to 50 characters." },
          { status: 400 },
        );
      }
    }

    // Built from the fields actually present. A fixed SET list needs a
    // placeholder for every column, and an untyped null placeholder inside
    // COALESCE is rejected by Postgres — which is why saving a colour alone
    // failed while saving a bio worked.
    const sets = [];
    const values = [];
    const add = (column, value) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.displayName !== undefined) {
      add("full_name", String(body.displayName).trim().slice(0, 50));
    }
    if (body.bio !== undefined) {
      add("bio", String(body.bio).slice(0, 280));
    }
    if (body.category !== undefined) {
      add("category", body.category || null);
    }
    if (body.accentColor !== undefined) {
      add("accent_color", body.accentColor);
    }
    if (body.thankYouMessage !== undefined) {
      add("thank_you_message", String(body.thankYouMessage).slice(0, 200));
    }
    if (body.socialLinks !== undefined) {
      const socials = {};
      if (body.socialLinks && typeof body.socialLinks === "object") {
        for (const key of SOCIAL_KEYS) {
          const url = cleanUrl(body.socialLinks[key]);
          if (url) socials[key] = url;
        }
      }
      add("social_links", JSON.stringify(socials));
    }

    if (sets.length === 0) {
      return Response.json({ success: true });
    }

    values.push(user.id);
    await sql(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${values.length}`,
      values,
    );

    return Response.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
