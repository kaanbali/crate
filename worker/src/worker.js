/**
 * Crate proxy — the one piece of server Crate allows itself.
 *
 * Why it exists:
 *  1. MusicBrainz requires a descriptive User-Agent on every request. A browser
 *     cannot set that header, so calls have to pass through something that can.
 *  2. Upstream services rate-limit hard. Caching here turns repeat lookups into
 *     free ones, which is what keeps a shared IP survivable.
 *  3. It is the seam where affiliate tokens and keys will live later, so they
 *     never have to appear in the page.
 *
 * Routes:  /mb/...       -> musicbrainz.org/ws/2/...
 *          /caa/...      -> coverartarchive.org/...
 *          /lb/...       -> api.listenbrainz.org/1/...
 *          /discogs/...  -> api.discogs.com/...
 *          /health
 */

const UPSTREAM = {
  mb:      { host: "musicbrainz.org",       prefix: "/ws/2",  ttl: 86400 },
  caa:     { host: "coverartarchive.org",   prefix: "",       ttl: 604800 },
  lb:      { host: "api.listenbrainz.org",  prefix: "/1",     ttl: 3600 },
  discogs: { host: "api.discogs.com",       prefix: "",       ttl: 3600 }
};

// MusicBrainz asks for contact details so they can get in touch about a misbehaving client.
const UA = "Crate/1.0 ( https://kaanbali.github.io/crate/ )";

const ALLOWED_ORIGINS = [
  "https://kaanbali.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765"
];

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") {
      return new Response("Only GET", { status: 405, headers });
    }

    const url = new URL(request.url);
    const [, key, ...rest] = url.pathname.split("/");

    if (key === "health") {
      return Response.json({ ok: true, routes: Object.keys(UPSTREAM) }, { headers });
    }

    const up = UPSTREAM[key];
    if (!up) {
      return Response.json({ error: "unknown route", routes: Object.keys(UPSTREAM) },
        { status: 404, headers });
    }

    // Rebuild the upstream URL from the allowlisted host only — the caller never
    // gets to name a destination, which keeps this from becoming an open proxy.
    const target = new URL(`https://${up.host}${up.prefix}/${rest.join("/")}`);
    target.search = url.search;

    const cache = caches.default;
    const cacheKey = new Request(target.toString(), { method: "GET" });
    const hit = await cache.match(cacheKey);
    if (hit) {
      const r = new Response(hit.body, hit);
      Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v));
      r.headers.set("X-Crate-Cache", "HIT");
      return r;
    }

    const outbound = { "User-Agent": UA, "Accept": "application/json" };
    // Discogs wants its own auth scheme; the token stays here, never in the page.
    if (key === "discogs" && env.DISCOGS_TOKEN) {
      outbound["Authorization"] = `Discogs token=${env.DISCOGS_TOKEN}`;
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), { headers: outbound, redirect: "follow" });
    } catch (e) {
      return Response.json({ error: "upstream unreachable" }, { status: 502, headers });
    }

    const body = await upstream.arrayBuffer();
    const out = new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": `public, max-age=${up.ttl}`,
        ...headers,
        "X-Crate-Cache": "MISS"
      }
    });

    // Only cache what actually succeeded — caching an upstream 429 would be a bug
    // that keeps hurting long after the limit clears.
    if (upstream.ok) {
      ctx.waitUntil(cache.put(cacheKey, out.clone()));
    }
    return out;
  }
};
