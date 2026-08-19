# Crate — music discovery, ending in a vinyl shopping list

Single-file web app (`index.html` — everything inline: CSS, JS, no build step, no dependencies, no backend). Records get in four ways: a music-service export, a Last.fm or ListenBrainz username, a catalogue search (song / album / artist), or a Discogs lookup from the filter box. The app rolls tracks up into unique albums, finds vinyl pressings on Discogs with live marketplace prices, and gives buy links. Two views: card grid and an iTunes-style Cover Flow (CSS 3D).

Built by Kaan with Claude (Cowork), August 2026. UK-based user; default currency GBP.

## Architecture (all in index.html's single <script>)

- **Ingest** — `ingest(text)` sniffs the input: Apple plist XML → `itemsFromPlist`; delimited text → `parseDelimited` + `itemsFromRows`; else plain "Artist - Album" lines → `itemsFromLines`. `detectFormat(H)` matches header signatures because Apple ships ≥6 export shapes with inconsistent column names (see "Format notes"). Every reader emits `{artist, album, song, plays, year}` items; `mergeItems` folds them into `ALBUMS` keyed by `norm(artist)|norm(album)`.
- **Pending albums** — play-history exports often name the song but not the album (modern Play Activity has NO artist column at all). Those get key `?|artist|song` and `pending:true`; `enrich()` resolves them against the iTunes Search API, then `rekey()` re-keys/merges. `enrich()` also fetches cover art for everyone.
- **Pricing** — `fetchVinyl()`: Discogs search (format=Vinyl, artist+release_title), fallback loose search, then `scoreRelease()` ranks pressings and the top ≤3 get marketplace/stats price checks; cheapest in-stock wins, early-stop below the CHEAP threshold (~£25). This deliberately prefers an in-print reissue over a pricey collector's original.
- **Throttling** — `makeQueue(gapMs)` promise chains. CRITICAL: `dg()` routes every individual Discogs REQUEST through `discQ` (25/min anonymous, 60/min with user token). Do not re-introduce per-album pacing — an album makes up to 5 requests. iTunes goes through `artQ` (1.4s gap) with `ART_BUDGET` (400) and a 90s backoff on 403/429 (`ART_PAUSE_UNTIL`).
- **Catalogue search** — `catSearch()` makes ONE iTunes request with `entity=musicArtist,album,song` and groups the three `wrapperType`s; `showArtist()` drills into a discography via `/lookup?id=&entity=album`. `addPick()` puts a hit in the crate and prices it. `SFOUND` stops a re-added pick counting twice.
- **Filtering** — `visible()` is two-pass: substring over a cached per-album haystack (`hay()`, cleared by setting `a._hay = null`), then edit distance (`lev()`, counts a neighbour swap as one) only if that found nothing. `CHIPS` holds the owned/priced/etc toggles. When nothing matches, `askDiscogs()` offers the wider catalogue through `dg()`.
- **Detail panel** — `openDetail()` → `loadDetail()`: `/releases/{id}`, then `/masters/{id}/versions`, then a `/marketplace/stats` per pressing (capped at `PRESS_MAX`). Cached on `a._detail`, so reopening costs nothing; aborts if `SHEET_FOR` changes mid-flight.
- **Previews** — iTunes `previewUrl`, played through the Now Playing turntable. `PLAY_SEQ` guards against a fast second click, since `play()` resolves async.
- **Voice** — `setupMic()` feature-detects `webkitSpeechRecognition` and hides the button when absent.
- **Views** — `render()` dispatches to `renderGrid()` / `renderFlow()` on `VIEW`. `renderGrid()` draws a `SHOW_CAP` window (filtering still sees everything) and hands cover URLs to `pumpArt()`. Cover Flow: `FLIST`/`FCUR`, transforms in `updateFlow()` (responsive: `compact` when stage < 560px). `paint(a)` updates one album in whichever view is live.

## Invariants — do not break

- A `pending` album must ALWAYS eventually settle: every exit path of `enrich()` goes through `settle()` (clears `pending`, decrements `PENDING_LEFT`). Regression test: `tests/resilience.test.mjs` (403 storm).
- Never price an album with an empty `album` (`fetchVinyl` guards; `runPrices` filters) — an empty `release_title` makes Discogs return the artist's whole discography and prices a random record.
- Everything user- or API-supplied that reaches `innerHTML` goes through `esc()`. `data-k` keys are `norm()`-restricted.
- Currency select and token input are disabled while a price run is `RUNNING` (mid-run changes corrupt results).
- `scoreRelease()` penalties (singles/7" −80, box sets −60, picture discs −40) exist because a wildly popular 7" of a title track can out-`have` the LP. Title/artist bonuses are skipped when `norm()` returns "" (non-Latin titles) — `"".includes` is true for everything.
- CSV export: keep the `﻿` BOM (Excel/UTF-8), the formula-injection prefix (`'` before leading `=+-@`), CRLF line endings.
- Scripts detect Apple's desktop playlist export by BOM: UTF-16LE + CR-only line endings (`readFiles` decodes by BOM sniff).
- Cover images are handed out by `pumpArt()`, at most `ART_INFLIGHT_MAX` at a time. Do NOT put a plain `src` back on card art: the Cover Art Archive queues so hard that 200 at once never complete, and every sleeve stays blank.
- `norm()` folds ligatures (æ→ae, ø→o, ß→ss…) as well as accents — NFD leaves ligatures alone, which turned "Ágætis" into "a tis". It sets album keys, so changing it changes merging.
- Anything cached off an album (`_hay`, `_detail`) must be invalidated when the fields behind it change.
- `.hit` rows are divs, not buttons — they contain a real play button, and a nested button gets hoisted out by the parser.

## Format notes (hard-won, verified against real files)

- Apple privacy-download "Play Activity.csv" (modern): 118 columns, track artist column DOES NOT EXIST; only `Container Artist Name` (filled only when playing from an album). Filter to `Event Type == PLAY_END` or plays double-count; drop `FAILED_TO_LOAD`; count a play at ≥30s or ≥50% duration.
- "Recently Played Tracks.csv": header typo `Last End Reason Tyoe` is genuinely in Apple's file. `Track Description` = "Artist - Song" combined string (split on first " - ").
- "Play History Daily Tracks.csv" is the best file: small, pre-aggregated `Play Count`/`Skip Count`.
- Legacy (~2019) Play Activity: 31 columns, `Content Name`/`Artist Name` instead.
- Library Tracks uses `Title`/`Artist`/`Album`; Play Activity uses `Song Name`/`Album Name`. Same archive, different names — that's why `detectFormat` exists.
- Exportify: `Artist Name(s)`, `Album Name`. Soundiiz: lowercase `title,artist,album`. TuneMyMusic: `Track name,Artist name,Album`.

## Testing

`npm install` then `npm test` (or individual `npm run test:*`). Tests are plain node scripts (no framework) driving Playwright; external APIs are mocked via `page.route` with fixtures in `tests/fixtures/` (real captured Discogs/iTunes responses in `fixtures/discogs/`, synthesized Apple exports in `fixtures/apple/` matching the verified real schemas). Set `CHROMIUM_PATH` to use a specific browser binary. Screenshots land in `tests/out/`.

When changing parsing or state logic, run `test:formats` and `test:resilience` first — they catch the classes of bug that have actually occurred.

## Known limitations / roadmap (biggest value first)

1. "N pressings" uses Discogs `pagination.items` from a fuzzy search — overstates for generic titles ("Greatest Hits"). The "not on vinyl" verdict only inspects the first 50 all-format results.
2. Cover Flow still renders every album eagerly; the grid is capped at `SHOW_CAP` with no "show more" control yet, so a 2,000-album library is browsable but not fully reachable by scrolling.
3. No persistence: wishlist/owned marks, prices and fetched release details die with the tab. Now that it runs on GitHub Pages, `localStorage` is available — this is the next job.
4. iTunes song→album resolution can still pick a live/compilation release for ambiguous song-only rows; artist+karaoke filters exist but a confidence UI ("is this right?") would be better.
5. Mixed-unit imports (playlist + play history in one session) sum plays and tracks together in the stats line.
6. Price alerts, Discogs OAuth (sync wantlist/collection), Bandcamp/juno price scraping, and a "total crate cost by priority" planner are all unexplored.
