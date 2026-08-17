import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__d, '..');
const FIX = join(__d, 'fixtures') + '/';

const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept());
// iTunes always 403s — the old code stranded every pending album forever
await p.route('**/itunes.apple.com/**', r => r.fulfill({status:403, contentType:'text/plain', headers:{'access-control-allow-origin':'*'}, body:'blocked'}));
await p.goto('file://' + ROOT + '/index.html');
await p.setInputFiles('#file', FIX + 'apple/Apple Music - Play History Daily Tracks.csv');
await p.waitForSelector('.album');
await p.waitForFunction(() => PENDING_LEFT === 0, null, {timeout:20000});
const st = await p.evaluate(() => ({
  pending: ALBUMS.filter(a=>a.pending).length,
  left: PENDING_LEFT,
  cards: [...document.querySelectorAll('.art-title')].map(e=>e.textContent)
}));
console.log('after 403 storm:', JSON.stringify(st));
// check empty-album guard: none of these should be priceable with a blank title
await p.route('**/api.discogs.com/**', r => r.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify({pagination:{items:1},results:[{id:1,title:'x',format:['Vinyl','LP'],uri:'/r/1',community:{have:1,want:1}}]})}));
await p.click('#fetch');
await p.waitForTimeout(4000);
console.log('states:', await p.evaluate(() => ALBUMS.map(a=>`${a.album||'(blank)'}:${a.state}`)));
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
