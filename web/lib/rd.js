/**
 * Client-side API helper — calls our proxy routes at /api/rd/...
 */

const API_BASE = "/api/rd";

async function rdFetch(path, { method = "GET", search = {}, body } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const opts = { method, headers: {} };

  if (body && (method === "POST" || method === "PUT")) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), opts);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const getUser = () => rdFetch("user");
export const getTrafficDetails = () => rdFetch("traffic/details");
export const getTorrents = (opts = {}) => rdFetch("torrents", { search: opts });
export const getDownloads = (opts = {}) => rdFetch("downloads", { search: opts });
export const addMagnet = (magnet) => rdFetch("torrents/addMagnet", { method: "POST", body: { magnet } });
export const selectFiles = (id, files) => rdFetch(`torrents/selectFiles/${id}`, { method: "POST", body: { files } });
export const deleteTorrent = (id) => rdFetch(`torrents/delete/${id}`, { method: "DELETE" });
export const deleteDownload = (id) => rdFetch(`downloads/delete/${id}`, { method: "DELETE" });
export const unrestrict = (link) => rdFetch("unrestrict/link", { method: "POST", body: { link } });
