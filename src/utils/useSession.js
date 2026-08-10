import { useState, useEffect, useCallback } from "react";

const TOKEN_KEY = "tiplyfi_token";
const USER_KEY = "tiplyfi_user";

// Legacy keys from before the Tip Jar rename. Migrated once at module load,
// which runs during import and therefore before any component reads them.
// Renaming without this would silently sign every existing creator out.
(function migrateLegacyKeys() {
  if (typeof window === "undefined") return;
  try {
    for (const [legacy, current] of [
      // Deliberately the OLD keys. These must never be renamed — they are
      // what the migration reads FROM.
      ["tipjar_token", TOKEN_KEY],
      ["tipjar_user", USER_KEY],
    ]) {
      const value = localStorage.getItem(legacy);
      if (!value) continue;
      if (!localStorage.getItem(current)) localStorage.setItem(current, value);
      localStorage.removeItem(legacy);
    }
  } catch {}
})();

export default function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);

    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // Invalid stored data
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Verify session with backend
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        // Session expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      });
  }, []);

  const login = useCallback((userData, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  return { user, loading, login, logout, getToken };
}
