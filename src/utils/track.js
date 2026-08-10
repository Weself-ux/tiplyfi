// Funnel tracking. Fire-and-forget: a failure here must never block or
// surface to the user.

const KEY = "tiplyfi_sid";

function sessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(name, props = {}, username = null) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      name,
      sessionId: sessionId(),
      username,
      props,
    });
    // sendBeacon survives the page unloading — important for click-then-navigate.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
