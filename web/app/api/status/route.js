/**
 * Service Status API — checks health of:
 * 1. Real-Debrid API
 * 2. Real-Debrid Stream Servers (download infrastructure)
 * 3. Torrentio (torrentio.strem.fun)
 * 4. Jackettio (jackettio.elfhosted.com) — with your config
 * 5. Comet (comet.elfhosted.com) — with your config
 *
 * Each check fetches a known endpoint and reports ok/latency/error.
 * Stream server check fetches the public server list, picks one per location,
 * and tests each with a HEAD request to verify they're responding.
 */

const TIMEOUT_MS = 15000;
const SERVER_TIMEOUT_MS = 5000;

// A well-known IMDB ID to test stream endpoints (Interstellar)
const TEST_IMDB = "tt0816692";

// Public server list maintained by DMM (same one they use)
const SERVERS_LIST_URL =
  "https://nzimhzbfnannoxumremm.supabase.co/storage/v1/object/public/public-files/servers.txt";

async function checkEndpoint(url, opts = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...opts });
    const latency = Date.now() - start;
    // 2xx-4xx means the service is responding (4xx = up but rejecting us)
    if (res.status >= 200 && res.status < 500) {
      return { ok: true, latency, status: res.status, error: null };
    }
    return { ok: false, latency, status: res.status, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, status: null, error: e.message || "Timeout" };
  }
}

/** Checks if a Stremio addon stream response contains actual streams */
async function checkStremioAddon(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const latency = Date.now() - start;

    if (res.status >= 500) {
      return { ok: false, latency, status: res.status, error: `Server error ${res.status}` };
    }
    if (!res.ok && res.status >= 400) {
      return { ok: true, latency, status: res.status, error: null };
    }

    try {
      const data = await res.json();
      const hasStreams = data.streams && data.streams.length > 0;
      return { ok: true, latency, status: res.status, error: hasStreams ? null : "No streams (but responding)" };
    } catch {
      return { ok: true, latency, status: res.status, error: null };
    }
  } catch (e) {
    return { ok: false, latency: Date.now() - start, status: null, error: e.message || "Timeout" };
  }
}

// ─── Real-Debrid Stream Server Check ───────────────────────────────────────

/**
 * Fetches the public RD server list, filters to IPv4 location-based servers,
 * picks the lowest-numbered instance per location, and tests each with a HEAD request.
 * Returns overall health + per-server breakdown.
 */
async function checkStreamServers() {
  try {
    // 1. Fetch server list
    const res = await fetch(SERVERS_LIST_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      return { ok: false, latency: 0, status: null, error: "Failed to fetch server list", servers: [] };
    }

    const text = await res.text();
    const allServers = [];

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("generated|")) continue;

      const [host, ip] = trimmed.split("|");
      if (!host || !ip) continue;

      // Only named location servers with IPv4 (contain -4)
      if (!host.includes("-4")) continue;
      // Skip purely numeric servers (like 20.download...)
      if (/^\d+[-.]/.test(host)) continue;

      allServers.push({ id: host.replace(".download.real-debrid.com", ""), host, ip });
    }

    // 2. Pick lowest instance per location (e.g., chi1 over chi2)
    const locationMap = new Map();
    for (const server of allServers) {
      // Extract location base: "chi1-4" → "chi", "akl1-4" → "akl"
      const match = server.id.match(/^([a-z]+)/);
      if (!match) continue;
      const location = match[1];

      if (!locationMap.has(location)) {
        locationMap.set(location, server);
      }
    }

    const serversToTest = Array.from(locationMap.values());

    // 3. Test each server with a HEAD request to its speedtest endpoint
    const results = await Promise.all(
      serversToTest.map(async (server) => {
        const url = `https://${server.host}/speedtest/test.rar`;
        const start = Date.now();
        try {
          const r = await fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
          });
          const latency = Date.now() - start;
          const ok = r.status >= 200 && r.status < 500;
          return { id: server.id, ok, latency, status: r.status, error: ok ? null : `HTTP ${r.status}` };
        } catch (e) {
          return { id: server.id, ok: false, latency: Date.now() - start, status: null, error: e.message || "Timeout" };
        }
      })
    );

    // 4. Summarize
    const working = results.filter((r) => r.ok).length;
    const total = results.length;
    const avgLatency = working > 0
      ? Math.round(results.filter((r) => r.ok).reduce((sum, r) => sum + r.latency, 0) / working)
      : null;

    return {
      ok: working > 0,
      latency: avgLatency,
      status: null,
      error: working === 0 ? "All servers down" : null,
      working,
      total,
      rate: total > 0 ? Math.round((working / total) * 100) : 0,
      servers: results,
    };
  } catch (e) {
    return { ok: false, latency: 0, status: null, error: e.message || "Failed", servers: [] };
  }
}

// ─── Service Checks ────────────────────────────────────────────────────────

async function checkRealDebrid() {
  const token = process.env.RD_TOKEN;
  if (!token) return { ok: false, latency: 0, status: null, error: "No RD_TOKEN configured" };

  return checkEndpoint("https://api.real-debrid.com/rest/1.0/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function checkTorrentio() {
  const url = `https://torrentio.strem.fun/stream/movie/${TEST_IMDB}.json`;
  return checkStremioAddon(url);
}

async function checkJackettio() {
  const config = process.env.JACKETTIO_CONFIG;
  const url = config
    ? `https://jackettio.elfhosted.com/${config}/stream/movie/${TEST_IMDB}.json`
    : `https://jackettio.elfhosted.com/manifest.json`;
  return config ? checkStremioAddon(url) : checkEndpoint(url);
}

async function checkComet() {
  const config = process.env.COMET_CONFIG;
  const url = config
    ? `https://comet.elfhosted.com/${config}/stream/movie/${TEST_IMDB}.json`
    : `https://comet.elfhosted.com/manifest.json`;
  return config ? checkStremioAddon(url) : checkEndpoint(url);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const [realDebrid, streamServers, torrentio, jackettio, comet] = await Promise.all([
    checkRealDebrid(),
    checkStreamServers(),
    checkTorrentio(),
    checkJackettio(),
    checkComet(),
  ]);

  return Response.json({
    timestamp: new Date().toISOString(),
    services: {
      realDebrid: { name: "Real-Debrid API", ...realDebrid },
      streamServers: { name: "RD Stream Servers", ...streamServers },
      torrentio: { name: "Torrentio", ...torrentio },
      jackettio: { name: "Jackettio", ...jackettio },
      comet: { name: "Comet", ...comet },
    },
  });
}
