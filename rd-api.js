import fetch from "node-fetch";

const BASE = "https://api.real-debrid.com/rest/1.0";

/**
 * Minimal wrapper with proper auth + error handling
 */
export async function rdFetch(
  token,
  path,
  { method = "GET", search = {}, body } = {}
) {
  const url = new URL(
    path.startsWith("http") ? path : `${BASE}/${path.replace(/^\/+/, "")}`
  );
  Object.entries(search).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // RD uses 204 sometimes; handle text vs json gracefully
  const text = await res.text();
  if (!res.ok) {
    let reason = text;
    try {
      reason = JSON.parse(text);
    } catch {}
    throw new Error(
      `RD ${res.status} ${res.statusText} – ${
        typeof reason === "string" ? reason : JSON.stringify(reason)
      }`
    );
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/** Common endpoints (adjust/extend as you like) */
export const rdUser = (token) => rdFetch(token, "/user");
export const rdTraffic = (token) => rdFetch(token, "/traffic");
export const rdTorrents = (token, { limit = 25, page = 1 } = {}) =>
  rdFetch(token, "/torrents", { search: { limit, page } });
export const rdDownloads = (token, { offset = 0, limit = 50 } = {}) =>
  rdFetch(token, "/downloads", { search: { offset, limit } });
