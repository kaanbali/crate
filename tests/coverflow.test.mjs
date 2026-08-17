import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__d, '..');
const FIX = join(__d, 'fixtures') + '/';

const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const p = await b.newPage({viewport:{width:1180, height:980}});
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept());

// distinct fake album covers, colored by URL hash
const PAL = ['b3452e','2e6b52','4a3a7a','8a6a1e','6b2e45','2e5a7a','7a4a2e','3a6b2e','5a2e7a','2e7a6b','7a2e2e','44506b'];
await p.route('**/*.mzstatic.com/**', route => {
  const u = route.request().url();
  let h = 0; for (const c of u) h = (h*31 + c.charCodeAt(0)) >>> 0;
  const c1 = PAL[h % PAL.length], c2 = PAL[(h >> 4) % PAL.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${c1}"/><stop offset="1" stop-color="#${c2}"/></linearGradient></defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="200" cy="200" r="120" fill="rgba(0,0,0,.25)"/>
    <circle cx="200" cy="200" r="40" fill="rgba(255,255,255,.15)"/></svg>`;
  route.fulfill({status:200, contentType:'image/svg+xml', body:svg});
});
await p.route('**/itunes.apple.com/**', route => {
  const term = decodeURIComponent(new URL(route.request().url()).searchParams.get('term')||'');
  route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'},
    body: JSON.stringify({results:[{artistName:term.split(' ')[0], collectionName:term,
      artworkUrl100:`https://is1-ssl.mzstatic.com/${encodeURIComponent(term)}/100x100bb.jpg`,
      releaseDate:'2007-01-01T00:00:00Z'}]})});
});
await p.route('**/api.discogs.com/**', route => {
  const u = route.request().url();
  const body = u.includes('/marketplace/stats/')
    ? JSON.stringify({num_for_sale:23, lowest_price:{value:16.5, currency:'GBP'}})
    : JSON.stringify({pagination:{items:41}, results:[{id:777,title:'X',format:['Vinyl','LP','Album'],uri:'/release/777',year:'2016',country:'UK',community:{have:20000,want:9000}}]});
  route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body});
});

await p.goto('file://' + ROOT + '/index.html');
await p.click('#demo');
await p.waitForSelector('.album');
await p.waitForTimeout(20000);   // let some art land
await p.click('#vFlow');
await p.waitForSelector('.fitem');
await p.waitForTimeout(800);
console.log('items:', await p.$$eval('.fitem', e => e.length));
console.log('info:', (await p.textContent('#finfo')).replace(/\s+/g,' ').slice(0,140));
await p.screenshot({path: join(__d,'out','flow1.png')});

// navigate: arrow keys, click a side cover, scrub
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
await p.waitForTimeout(700);
console.log('after arrows:', await p.textContent('#fcount'));
await p.screenshot({path: join(__d,'out','flow2.png')});
// price check in flow view
await p.click('#fetch');
await p.waitForFunction(() => FLIST[FCUR] && FLIST[FCUR].state === 'done', null, {timeout:60000});
await p.waitForTimeout(400);
console.log('price in info:', (await p.textContent('#finfo')).includes('£16.50'));
// wheel
await p.mouse.move(590, 300); await p.mouse.wheel(0, 120);
await p.waitForTimeout(600);
console.log('after wheel:', await p.textContent('#fcount'));
// back to grid, still fine?
await p.click('#vGrid');
console.log('grid cards:', await p.$$eval('.album', e => e.length));
await p.click('#vFlow'); await p.waitForTimeout(600);
await p.screenshot({path: join(__d,'out','flow3.png')});
await p.setViewportSize({width:390, height:844});
await p.evaluate(() => updateFlow(true));
await p.waitForTimeout(500);
await p.screenshot({path: join(__d,'out','flow-mobile.png')});
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
