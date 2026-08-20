# Crate proxy

A single Cloudflare Worker. Crate still runs entirely in the browser — this is the
only server-side piece, and the app works without it.

## Why it exists

1. **MusicBrainz requires an identifying `User-Agent` header.** Browsers forbid
   setting that header from JavaScript, so calls have to pass through something
   that can. This is the hard blocker that makes the proxy step one of migration.
2. **Caching.** Replies are cached at the edge, so a repeat lookup costs nothing
   and never touches the upstream's rate limit.
3. **A place for secrets later.** Affiliate tokens and API keys can live here
   instead of in the page, where anyone could read them.

## Routes

| Path | Goes to | Cached for |
|---|---|---|
| `/mb/...` | `musicbrainz.org/ws/2/...` | 1 day |
| `/caa/...` | `coverartarchive.org/...` | 7 days |
| `/lb/...` | `api.listenbrainz.org/1/...` | 1 hour |
| `/discogs/...` | `api.discogs.com/...` | 1 hour |
| `/health` | returns `{ok:true, routes:[...]}` | — |

The caller cannot name a destination — only these four hosts are reachable, so
this can't be used as an open proxy by anyone who finds the URL.

## What it costs

**£0.** Cloudflare's free Workers plan allows 100,000 requests a day and needs no
card. Crate would have to get genuinely popular before that mattered, and caching
means most repeat traffic never counts against it.

## Deploying it (about five minutes)

1. Make a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
   No domain and no payment details are needed.
2. From this folder:

   ```
   npx wrangler login     # opens your browser to authorise
   npx wrangler deploy
   ```

3. It prints an address like `https://crate-proxy.<your-subdomain>.workers.dev`.
4. Paste that into Crate under **Speed & settings → Crate proxy address**, then
   press **Check it works**.

To let the Worker hold a Discogs token (so the token isn't in the page):

```
npx wrangler secret put DISCOGS_TOKEN
```

## Why "send Discogs through it too" is off by default

Discogs rate-limits per IP address. Going direct, every visitor gets their own
allowance. Through the Worker, everyone shares one address and therefore one
allowance — worse, not better, unless a `DISCOGS_TOKEN` secret is set. MusicBrainz
and the Cover Art Archive have the same property, which is why the cache matters
more than anything else here: watch the `X-Crate-Cache` header.

## Testing it locally

```
npx wrangler dev --port 8787 --local
curl http://localhost:8787/health
```

`http://localhost:8765` is already allowed as an origin, so a locally served copy
of Crate can talk to a locally running Worker.
