# Crate

Turn your streaming playlists into a vinyl shopping list.

Drop in a playlist or library export — Spotify (Exportify), Apple Music / iTunes (desktop exports, Library.xml, or your Apple privacy data download), Soundiiz, TuneMyMusic, or just pasted "Artist - Album" lines — and Crate rolls it up into unique albums, finds vinyl pressings on Discogs with live lowest prices, and links you to Discogs, Amazon UK, Rough Trade, Juno and eBay. Browse as a grid or an iTunes-style Cover Flow.

**No build, no backend, no account.** `index.html` is the whole app — open it in a browser and you're done. Nothing you drop in leaves the page; Discogs and iTunes APIs are called directly from your browser.

## Use

Open `index.html` (double-click, or `npm start` to serve it). Drop a file in, hit **Check vinyl prices**.

Anonymous Discogs access allows 25 requests/min (≈8 albums/min). Paste a free [personal access token](https://www.discogs.com/settings/developers) under *Speed & settings* for 60/min.

## Develop

```
npm install        # playwright for tests
npm test           # all suites (APIs mocked with captured fixtures)
```

See `CLAUDE.md` for architecture, invariants, and the format-detection notes for Apple's six export shapes.
