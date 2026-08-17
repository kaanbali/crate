import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__d, '..');
const FIX = join(__d, 'fixtures') + '/';

const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});

const CATALOG = {                       // song -> [artist, album]
  'the stink god': ['Joe Hisaishi','Spirited Away (Original Soundtrack)'],
  'i believe in you': ['Talk Talk','Spirit of Eden'],
  'pink moon': ['Nick Drake','Pink Moon'],
  'glory box': ['Portishead','Dummy'],
  'workinonit': ['J Dilla','Donuts'],
  'joga': ['Björk','Homogenic'],
  'dreams': ['Fleetwood Mac','Rumours']
};

const files = [
  ['Apple desktop playlist (.txt, UTF-16 + CR)', 'apple/Playlist.txt'],
  ['iTunes Library.xml (plist)',                 'apple/Library.xml'],
  ['Play History Daily Tracks.csv',              'apple/Apple Music - Play History Daily Tracks.csv'],
  ['Recently Played Tracks.csv',                 'apple/Apple Music - Recently Played Tracks.csv'],
  ['Play Activity.csv (modern, no artist col)',  'apple/Apple Music Play Activity.csv'],
  ['Library Tracks.csv',                         'apple/Apple Music Library Tracks.csv'],
  ['Soundiiz CSV',                               'apple/soundiiz.csv'],
  ['Exportify Spotify CSV',                      'sample.csv']
];

for (const [label, path] of files){
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => { errs.push('ALERT: ' + d.message().split('\n')[0]); d.accept(); });
  await p.route('**/itunes.apple.com/**', route => {
    const term = decodeURIComponent(new URL(route.request().url()).searchParams.get('term')||'').toLowerCase();
    const hit = Object.keys(CATALOG).find(k => term.includes(k));
    const results = hit
      ? [{artistName:CATALOG[hit][0], collectionName:CATALOG[hit][1], trackName:hit,
          artworkUrl100:'https://x/100x100bb.jpg', releaseDate:'1999-01-01T00:00:00Z'}]
      : [];
    route.fulfill({status:200, contentType:'application/json',
      headers:{'access-control-allow-origin':'*'}, body: JSON.stringify({resultCount:results.length, results})});
  });
  await p.route('**/api.discogs.com/**', r => r.fulfill({status:200, contentType:'application/json',
    headers:{'access-control-allow-origin':'*'}, body: JSON.stringify({pagination:{items:0}, results:[]})}));

  await p.goto('file://' + ROOT + '/index.html');
  await p.setInputFiles('#file', FIX + path);
  try { await p.waitForSelector('.album', {timeout:4000}); } catch(e){}
  await p.waitForFunction(() => typeof PENDING_LEFT !== 'undefined' && PENDING_LEFT === 0, null, {timeout:30000}).catch(()=>{});
  await p.waitForTimeout(1200);
  const out = await p.evaluate(() => ({
    unit: (ALBUMS[0]||{}).unit,
    albums: ALBUMS.map(a => `${a.artist} — ${a.album} (${a.tracks}${a.pending?' PENDING':''})`).sort(),
    stats: document.getElementById('stats').textContent
  }));
  console.log(`\n### ${label}`);
  console.log('   unit:', out.unit);
  out.albums.forEach(x => console.log('   ' + x));
  if (errs.length) console.log('   !! ' + errs.join(' | '));
  await p.close();
}
await b.close();
