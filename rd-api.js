import fetch from "node-fetch";

const BASE = "https://api.real-debrid.com/rest/1.0";

/**
 * Wrapper with proper auth + error handling.
 * RD POST endpoints expect application/x-www-form-urlencoded (not JSON).
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

  // Build form-encoded body for POST/PUT
  let encodedBody;
  let contentType;
  if (body && typeof body === "object") {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v));
    });
    encodedBody = params.toString();
    contentType = "application/x-www-form-urlencoded";
  } else if (typeof body === "string") {
    encodedBody = body;
    contentType = "application/x-www-form-urlencoded";
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: encodedBody || undefined,
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

// ─── Account ────────────────────────────────────────────────────────────────
export const rdUser = (token) => rdFetch(token, "/user");
export const rdTraffic = (token) => rdFetch(token, "/traffic");

// ─── Torrents ───────────────────────────────────────────────────────────────
export const rdTorrents = (token, { limit = 25, page = 1 } = {}) =>
  rdFetch(token, "/torrents", { search: { limit, page } });

export const rdTorrentInfo = (token, id) =>
  rdFetch(token, `/torrents/info/${id}`);

export const rdAddMagnet = (token, magnet) =>
  rdFetch(token, "/torrents/addMagnet", {
    method: "POST",
    body: { magnet },
  });

export const rdSelectFiles = (token, id, files = "all") =>
  rdFetch(token, `/torrents/selectFiles/${id}`, {
    method: "POST",
    body: { files },
  });

export const rdDeleteTorrent = (token, id) =>
  rdFetch(token, `/torrents/delete/${id}`, { method: "DELETE" });

// ─── Downloads ──────────────────────────────────────────────────────────────
export const rdDownloads = (token, { offset = 0, limit = 50 } = {}) =>
  rdFetch(token, "/downloads", { search: { offset, limit } });

export const rdDeleteDownload = (token, id) =>
  rdFetch(token, `/downloads/delete/${id}`, { method: "DELETE" });

// ─── Unrestrict ─────────────────────────────────────────────────────────────
export const rdUnrestrict = (token, link, { password, remote } = {}) =>
  rdFetch(token, "/unrestrict/link", {
    method: "POST",
    body: { link, ...(password && { password }), ...(remote && { remote: 1 }) },
  });
