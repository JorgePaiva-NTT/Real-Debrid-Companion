/**
 * Catch-all API proxy for Real-Debrid.
 * Forwards requests from the frontend to the RD API with the server-side token.
 * This solves CORS and keeps the token secret.
 *
 * Usage: GET /api/rd/user → proxies to https://api.real-debrid.com/rest/1.0/user
 */

const RD_BASE = "https://api.real-debrid.com/rest/1.0";

export async function GET(request, { params }) {
  return proxyToRD(request, params);
}

export async function POST(request, { params }) {
  return proxyToRD(request, params);
}

export async function DELETE(request, { params }) {
  return proxyToRD(request, params);
}

export async function PUT(request, { params }) {
  return proxyToRD(request, params);
}

async function proxyToRD(request, { path }) {
  const token = process.env.RD_TOKEN;
  if (!token) {
    return Response.json({ error: "RD_TOKEN not configured" }, { status: 500 });
  }

  const rdPath = Array.isArray(path) ? path.join("/") : path;
  const url = new URL(`${RD_BASE}/${rdPath}`);

  // Forward query params
  const { searchParams } = new URL(request.url);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));

  // Build fetch options
  const fetchOpts = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // Forward body for POST/PUT
  if (request.method === "POST" || request.method === "PUT") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      fetchOpts.body = await request.text();
      fetchOpts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (contentType.includes("application/json")) {
      // Convert JSON body to form-urlencoded (RD expects this)
      const json = await request.json();
      const params = new URLSearchParams();
      Object.entries(json).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.set(k, String(v));
      });
      fetchOpts.body = params.toString();
      fetchOpts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  try {
    const res = await fetch(url.toString(), fetchOpts);
    const data = await res.text();

    return new Response(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
