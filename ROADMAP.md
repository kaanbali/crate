# Crate — build roadmap

Research and decisions from Cowork sessions (Aug 2026). Work top to bottom; each phase is a
self-contained chunk. Read `CLAUDE.md` first — its invariants still apply to everything here.

**Working style:** Kaan is not a developer. Explain changes in plain language, not code.
Run the test suites before committing. Commit and push after each working chunk so there's
always a save point. Ask before doing anything irreversible.

`{q}` below = URL-encoded "artist album".

---

# DECISION — Crate is going commercial (recorded Aug 2026)

Kaan's call, taken 2026-08-20. Roughly **3–6 months out**, so target window **Nov 2026 – Feb 2027**.

- **Affiliate links only to start.** No user accounts, no payments, no checkout. A paid tier is
  possible much later but is not being designed for now.
- **Migrate off Discogs marketplace data and Apple artwork BEFORE monetising**, not after.
- **Skip Last.fm entirely** — its API is non-commercial-only. ListenBrainz replaces it.

**Status of the reasoning:** the clause-by-clause licensing research this decision refers to is
NOT in this file and was not found anywhere in the repo or its history. The decision is recorded
here as Kaan's, and the three claims below are what it rests on. Each is **UNVERIFIED** and must be
checked against the live terms — with dates and quoted clauses written back into this file —
before any money changes hands.

| Claim the plan rests on | Status |
|---|---|
| Discogs marketplace data may not be used commercially | unverified — read the Discogs API terms |
| Apple/iTunes artwork may not be used commercially | unverified — read the Apple Media Services terms |
| Last.fm API is non-commercial only | unverified — read the Last.fm API terms |
| MusicBrainz + Cover Art Archive are usable commercially | unverified — check the licence per dataset |
| eBay Partner Network has an API, permits displaying prices, no traffic minimum | unverified — read the EPN agreement |

Doing that reading is a task in its own right; it belongs before A2 lands, and it is not a coding
job. Nothing below should be read as legal advice.

**On pricing, specifically.** Discogs prices are fine to use TODAY, while Crate is non-commercial.
So they stay — but behind an adapter (A4), so that at the moment of monetising, the price source
flips to shop affiliate feeds without touching the UI. **eBay Partner Network is the first target**
for that flip.

---

# A — Migration (do this first, in this order)

Everything here is groundwork for going commercial. Nothing in B or C should be started until A is
done, because A changes the data underneath both.

## A1 — Cloudflare Worker proxy

The one piece of server we allow ourselves, and the seam everything later hangs off.

- Sets the `User-Agent` MusicBrainz requires — a browser cannot set that header itself, which is
  the hard technical reason this step comes first.
- Caches upstream responses, so repeat lookups cost nothing and stay inside rate limits.
- Becomes the single place to later hold affiliate tokens, keys and any server-side logic, without
  putting secrets in the page.
- Free tier: 100,000 requests/day, no card needed.
- **Watch:** every user then shares the worker's IP, so a per-IP upstream limit becomes a global
  one. Caching is what makes this survivable — treat cache hit rate as the metric that matters.

## A2 — Cover art: iTunes → Cover Art Archive

- Resolve each album to a MusicBrainz **release-group MBID**, then take the sleeve from the Cover
  Art Archive.
- ListenBrainz already returns `caa_id` + `caa_release_mbid`, so imports from there need no lookup.
- Keep `pumpArt()` — CAA queues hard, and handing out a few requests at a time is what made covers
  appear at all (see CLAUDE.md invariant).
- **Note:** Apple is also the source of song→album resolution and 30-second previews. Those are
  separate uses from artwork and need their own decision — dropping artwork does not automatically
  mean dropping previews.

## A3 — Album and pressing data: Discogs search → MusicBrainz

- Album identity and metadata from MusicBrainz **release-groups**; individual pressings from
  MusicBrainz **releases**.
- This is the biggest and riskiest step: `scoreRelease()`, the pressing picker and the detail panel
  all assume Discogs' shapes.
- Expect quality loss on format detail. Discogs is unusually rich on "180g / gatefold / coloured";
  MusicBrainz is thinner. Measure before/after on ten real records rather than assuming parity.

## A4 — Pricing behind a pluggable adapter

- One interface, e.g. `priceSource.lookup(album) → {price, currency, url, inStock}`.
- Discogs stays the implementation **for now** (legal while non-commercial).
- At monetisation, swap in eBay Partner Network. Nothing in the UI should need to change — that is
  the test of whether the adapter is right.

## A5 — Remove the Last.fm import

Note: this is a **removal**, not a build. The Last.fm import already shipped (Aug 2026) and works.
Dropping it means deleting the UI block, the key field, `LFM_ERR`, and its tests, leaving
ListenBrainz as the only scrobble source.

---

# B — Rebuild on the new foundation

**These three already exist**, built Aug 2026 against Discogs and iTunes. They are listed here in
Kaan's requested order because each will need re-pointing once A lands — not building from scratch.

1. **Search overhaul** — shipped. Fuzzy/accent-tolerant crate filter, chips, keyboard, and a
   Discogs fallback lookup. The fallback is the part A3/A4 changes.
2. **Album detail panel** — shipped. Tracklist, label, catalogue number, format, genres, styles,
   notes, have/want, rating, per-pressing prices. Most of this is Discogs-shaped; A3 rewrites its
   data layer, and the format-detail fields are where quality loss will show first.
3. **Voice / mic button** — shipped, and source-agnostic. A changes nothing here.

---

# C — Commercial preparation (last, and not before A)

- `/disclosure` page — how Crate makes money, in plain words.
- `/privacy` page — what is stored (currently nothing leaves the browser) and what the Worker logs.
- **"Ad" or "Affiliate" labels** on every monetised link. Required by the FTC and the UK CMA, and
  a condition of most affiliate programmes.
- **Not-affiliated notice** — Crate is not affiliated with Discogs, MusicBrainz, Apple, eBay or any
  shop listed.
- **Accessibility pass** — keyboard paths, focus order, contrast, alt text, `prefers-reduced-motion`,
  and the voice button's labelling. Worth doing before traffic arrives, not after.

---

## Still-standing work (unchanged by the commercial decision)

### Save my crate

Right now everything dies when the tab closes: owned/wishlist marks, fetched prices, the whole
list. This is the single biggest gap in daily usability.

- Add "Save crate" → downloads a JSON snapshot (albums, prices, owned flags, unit, timestamp).
- Add "Load crate" → restores it, merging with anything already loaded.
- Consider `localStorage` auto-save with a "Clear saved crate" button. (It was avoided originally
  because of an artifact-environment restriction; on GitHub Pages it's fine.)
- Keep the CSV export as-is — it's for humans, JSON is for the app.

### Import listening history  ✅ DONE (Aug 2026) — Last.fm half to be removed by A5

Decision: **do NOT build direct Spotify OAuth.** Since Feb 2026, Spotify dev-mode apps require the
owner to hold Premium and are capped at 5 users — unshippable for a public site. Instead use
scrobbler aggregators, which cover every service at once.

**2a. Last.fm (primary).** ✅ built — username + key, all six periods, placeholder art filtered.
**2a. Last.fm (primary).** Free API key, CORS open (verified). No user login needed — a username
is enough for public profiles.
- `user.getTopAlbums` with `period` = 7day / 1month / 3month / 6month / 12month / overall.
- Feed results into the existing `mergeItems` pipeline with play counts (`unit: "plays"`).
- Store the API key like the Discogs token (settings field, never committed).
- Handle: private profiles (empty results), rate limits, users who typo their username.
- Why it matters: Last.fm collects scrobbles from Spotify (official integration), Tidal, Deezer,
  Apple Music, YouTube Music and Bandcamp — one integration, every platform.

**2b. ListenBrainz (secondary, even easier).** ✅ built — no key, Cover Art Archive sleeves, rate-limit header respected.
**2b. ListenBrainz (secondary, even easier).** Zero auth, CORS open (verified).
- `GET https://api.listenbrainz.org/1/stats/user/{name}/release-groups?range=month|year|all_time`
- Returns MusicBrainz IDs → can chain to Cover Art Archive for artwork.
- Rate limit ~30 requests per short window; respect the returned rate-limit headers.

**2c. Optional extras** (only if 2a/2b land cleanly):
- Tidal direct connect — OAuth PKCE, open developer signup, CORS verified working. Risk: production
  access needs manual approval from Tidal and their queue is slow.
- Deezer paste-a-playlist-link — public playlists readable with zero credentials via their JSONP
  endpoint (`api.deezer.com/playlist/{id}/tracks?output=jsonp&callback=cb`). Plain CORS is broken;
  JSONP works.
- Spotify GDPR export — accept the "Extended streaming history" JSON as a drag-and-drop format
  (free from Spotify account privacy settings, no API involved).

### Global shops — research below stays valid; the buy links become the affiliate surface

Today the buy links are hardcoded UK shops. Make them geo-aware.

**Architecture:** shops are DATA, not code — one object per country, so adding a country is a data
edit, not a rewrite. Date-stamp every pack (`verified: '2026-08'`); shop domains die and customs
rules change fast.

```js
COUNTRY_PACKS = {
  GB: { name:'United Kingdom', currency:'GBP', verified:'2026-08',
        shops:[{name:'HMV', url:q=>`...`, tags:['new','cheap'], note:'free shipping over £20'}],
        importNote: '...' },
  ...
}
```

- Country picker in the toolbar. Suggest from `navigator.language` region subtag; never force it;
  remember the choice (ties into Phase 1 persistence).
- Always show the GLOBAL BACKBONE beneath local shops: Discogs, eBay, Bandcamp, the mapped Amazon
  storefront.
- For countries with an `importNote`, show a landed-cost hint next to foreign-shop links
  (e.g. Turkey: EU orders ×1.3, elsewhere ×1.6).
- Add a "record shops near you" link → `https://www.discogs.com/record-stores/map/`.
- Flagged patterns below marked `[browser-check]` were bot-blocked during research — open them in a
  real browser once and confirm before shipping.

### Global backbone facts (live-tested Aug 2026)

**Discogs seller-origin filtering works via URL** — this is the key to helping buyers in
narrow markets:
`https://www.discogs.com/sell/list?ships_from=Germany&format=Vinyl&currency=EUR&sort=price%2Casc`
- `ships_from` takes the full English country name. Only ONE origin per URL (repeating the param
  does not combine) — generate one link per useful origin.
- There is NO ships-to parameter; availability is decided by the buyer's account at checkout. Say so
  in the UI rather than pretending to filter.
- Currencies: USD GBP EUR CAD AUD JPY CHF MXN BRL NZD SEK ZAR DKK.

**Amazon storefronts (23 active).** Pattern everywhere: `/s?k={q}+vinyl&i=music`.
com · ca · com.mx · com.br · co.uk · de · fr · it · es · nl · se · pl · com.be · ie · com.tr · ae ·
sa · eg · co.za · co.jp · in · sg · com.au
Good vinyl selection: US UK DE FR IT ES NL SE PL BE IE CA JP AU. Thin: MX BR TR IN SG AE SA. Skip: EG ZA.
Neighbour map for countries without one: AT→de, CH→de, PT→es, DK→de/se, FI→se, NO→de/se,
CZ/SK/HU→de/pl, GR/CY→de/it, LU→fr/de.

**Customs reality 2026** (rules changed a lot in 2025-26 — show a "verify at checkout" disclaimer):
| Country | Situation |
|---|---|
| US | $800 de-minimis KILLED (Aug 2025, indefinite from Jun 2026) — foreign orders now taxed |
| EU | VAT from €0 (IOSS at checkout); €150 duty exemption ended Jul 2026 |
| UK | £135 threshold; below it seller collects VAT |
| Turkey | No threshold. 30% from EU, 60% elsewhere (UK counts as elsewhere). Max 5 parcels/month |
| Canada | CAD 20 general; CAD 40 tax-free / 150 duty-free from US-MX courier |
| Australia | GST charged at checkout; AUD 1000 duty threshold |
| Japan | ¥10,000 CIF exemption |
| Brazil | No threshold. 20% ≤$50, 60% above, plus ~17-20% ICMS. Domestic only, realistically |
| Mexico | USMCA <$50 free, 17-19% above; all other origins flat 33.5% |
| Chile | 19% VAT on everything since Oct 2025 |
| Argentina | US$400 courier exemption (VAT only) — imports viable again |

### Country packs — wave 1 (build these first)

**GB** — 1. Amazon UK `amazon.co.uk/s?k={q}+vinyl` · 2. HMV `hmv.com/search?searchtext={q}`
[browser-check] *free ship >£20, often cheapest all-in* · 3. Juno `juno.co.uk/search/?q%5Ball%5D%5B%5D={q}`
*cheapest specialist* · 4. Norman `normanrecords.com/search?q={q}` · 5. Rough Trade
`roughtrade.com/en-gb/search?q={q}` *(keep the /en-gb/)* · 6. Resident `resident-music.com/search?q={q}`
· 7. Discogs · 8. eBay UK `ebay.co.uk/sch/i.html?_nkw={q}&_sacat=176985`
Optional toggles: Banquet `banquetrecords.com/search?q=` · Piccadilly
`piccadillyrecords.com/counter/search.php?search=` *(NOT ?term=)* · Monorail `monorailmusic.com/search?q=`
*(NOT /?s=)* · Drift · Crash · Assai · Vinilo · Recordstore.co.uk · musicMagpie *(used, free post)*

**US** — Discogs · Amazon · eBay `&_sacat=176985` · Turntable Lab `turntablelab.com/search?q={q}` ·
Rough Trade US `roughtrade.com/en-us/search?q={q}` · Newbury Comics `newburycomics.com/search?q={q}`
*(exclusives)* · Bull Moose `bullmoose.com/search?q={q}` *(US shipping only)* · Amoeba → link their
Discogs storefront `discogs.com/seller/AmoebaMusic/profile` [bot-blocked site].
Do NOT list Vinyl Me Please — went bankrupt 2025, troubled relaunch.

**DE** — HHV `hhv.de/en/catalog/filter/search-S11?term={q}` *(JS-rendered; ships 200+ countries)* ·
jpc `jpc.de/s/{q}` *(classical/jazz depth)* · Amazon.de · Medimops
`medimops.de/produkte-C0/?searchparam={q}&fcIsSearch=1` *(used)* · Deejay.de `deejay.de/{q}` *(electronic)*

**TR** — domestic first, customs makes it competitive: Kontra `kontrarecords.com`
*(⚠ old kontraplak.com domain is dead — do not use)* · Deform `deformmuzik.com` · Opus3a
`opus3a.com/plak` · TLPma `tlpma.com.tr` · Plak Burada `plakburada.com` · Hepsiburada `/plak-c-80371044`
· Trendyol `/plak` · amazon.com.tr.
Reach-expansion tips to show: Discogs filtered to EU sellers (30% band) · Amazon.com.tr Global Store
(import fees collected upfront) · EU shops HHV/Deejay/jpc · suitcase allowance ~€430 on trips ·
UK/US only for grails at 60%.
Second-hand: sahibinden, Dolap, letgo, Instagram sellers, Feriköy Sunday market (Istanbul).

**JP** — two link types, direct-ship vs proxy:
*Direct:* CDJapan `cdjapan.co.jp/searchuni?q={q}+LP` · HMV Japan English site
`hmv.co.jp/en/select/vinyl/list/?keyword={q}` *(built for overseas buyers, new + used)* · Snow Records.
*Proxy:* Buyee `buyee.jp/item/search/query/{q}` — one URL searches Yahoo Auctions + Mercari + Rakuten.
Disk Union does NOT ship internationally → link their eBay store `ebay.com/usr/diskunion_distribution`.

### Country packs — wave 2

**Latin America** — one MercadoLibre template covers five countries:
`listado.mercadolibre.{com.mx|com.ar|cl|com.co}/{query-with-dashes}` and
`lista.mercadolivre.com.br/{query-with-dashes}` *(note: lista + .com.br for Brazil)*. Append vinilo/vinil.
Plus: MX Mixup `mixup.com/{q}?_q={q}&map=ft` *(use .com, not .com.mx — expired cert)* · BR Tracks Rio
`tracksrio.com.br/shop?search={q}`, Casarão do Vinil via Discogs · AR Zivals
`zivals.com.ar/resultados.aspx?c={q}`, Tiendanube shops `/search/?q={q}` · CL Needle `needle.cl/search?q={q}`
· CO La Música `lamusica.com.co/search?q={q}`, Codiscos *(local repertoire)*.

**Europe** — pan-EU shippers work for any EU country: HHV, jpc, iMusic `imusic.dk/page/search?q={q}`,
Recordsale `recordsale.de/en/search?s={q}` *(used)*.
FR Fnac `fnac.com/SearchResult/ResultList.aspx?Search={q}`, Diggers Factory · NL Bol
`bol.com/nl/nl/s/?searchtext={q}` *(NL/BE only!)*, Plato `platomania.nl/search/results/?q={q}`, Sounds
Haarlem · BE Music Mania `musicmaniarecords.be/search?q={q}` · IT IBS `ibs.it/search/?ts=as&query={q}`,
laFeltrinelli *(same engine)* · ES Marilians `marilians.com/?s={q}`, Fnac.es · PT Flur `flur.pt/search?q={q}`
· SE Bengans `bengans.se/shop?funk=gor_sokning&term={q}` · DK Vinylpladen `vinylpladen.dk/soeg?q={q}`,
Pladekisten `pladekisten.dk/?s={q}` · FI Levykauppa Äx / recordshopx.com `/search/?q={q}` [browser-check]
· PL Empik `empik.com/szukaj/produkt?q={q}`, Winylownia `winylownia.pl/pl/search.html?text={q}` ·
CZ Phono `phono.cz/en/hledat?Fulltext={q}`, Rekordér `rekorder.cz/en/search?q={q}` · IE Golden Discs
`goldendiscs.ie/search?q={q}`, Tower Dublin `towerrecords.ie/search?q={q}` · GR Vinylstore
`vinylstore.gr/en/products-c-0.html?keywords={q}`, Le Disque Noir `ledisquenoir.gr/?s={q}` ·
CH CeDe `cede.ch/de/search/?q={q}` *(non-EU: 8.1% VAT)* · NO Platekompaniet [browser-check]
*(non-EU: 25% VAT from first krone, VOEC sellers collect at checkout)*.
Note: Fnac and Bol.com look pan-European but only ship to their home countries.

**Asia-Pacific & rest** — KR Ktown4u `ktown4u.com/search?searchKeyword={q}` *(ships worldwide)*, Yes24
Global · AU Discrepancy `discrepancy-records.com.au`, JB Hi-Fi `jbhifi.com.au/search?query={q}`, Rocking
Horse, Amazon.com.au · NZ Real Groovy `realgroovy.com/search?q={q}` *(⚠ correct domain — scam clones like
realgroovyshop.shop exist, never link them)*, Marbecks · IN The Revolver Club
`therevolverclub.com/search?q={q}` *(imports on demand)*, Amazon.in · SG RetroCrates
`retrocrates.com/search?q={q}` · PH Backspacer `backspacerrecords.com/search?q={q}`, Satchmi ·
MY Swee Lee `sweelee.com.my` · ID Tokopedia *(search "piringan hitam")* · HK White Noise
`whitenoiserecords.org`, Vinyl HK · TW Chia Chia `ccr.com.tw`, books.com.tw
`search.books.com.tw/search/query/key/{q}/cat/all` · ZA Mr Vinyl `mrvinyl.co.za/?s={q}&post_type=product` ·
AE Flip Side `flipsidedxb.com/search?q={q}`, Virgin ME `virginmegastore.ae/en/search?text={q}`.
Many of these are Shopify — one `https://{domain}/search?q={q}` template covers them.

---

### Scale and polish

- **Virtualize the views.** Grid and Cover Flow render every album eagerly. Fine at 500, janky at
  2,000+ (full library imports). Needs windowing + incremental render.
- **Pressing counts are approximate.** "N pressings" uses Discogs `pagination.items` from a fuzzy
  search, which overstates for generic titles ("Greatest Hits"). The "not on vinyl" verdict only
  inspects the first 50 all-format results.
- **Song→album confidence.** iTunes resolution can still pick a live album or compilation for
  ambiguous song-only rows. A small "is this right?" affordance would beat silent guessing.
- **Mixed-unit stats.** Importing a playlist and a play-history in one session sums tracks and plays
  together in the header line.
- **Mobile Cover Flow polish** — worth a real-device pass.

### Ideas not yet committed to

- Discogs OAuth: sync the user's real wantlist/collection instead of local owned-flags.
- Price-drop alerts (needs a backend or a scheduled job — breaks the no-backend rule; think first).
- "Plan my crate": budget input → what to buy first by play count per pound.
- Share a crate as a link (state in URL hash).

---

## Maintenance

Shop URLs rot and customs rules change — 2025-26 saw major changes in the US, EU, Turkey, Mexico,
Chile and Brazil. Re-verify packs roughly twice a year and bump the `verified` date stamps.
Two domains already died during research (kontraplak.com, rotate.com), which is why the packs carry
dates.
