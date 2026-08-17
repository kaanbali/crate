import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__d, '..');
const FIX = join(__d, 'fixtures') + '/';

import fs from 'fs';
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept());
const CAT = {'pink moon':['Nick Drake','Pink Moon'],'glory box':['Portishead','Dummy']};
await p.route('**/itunes.apple.com/**', route => {
  const term = decodeURIComponent(new URL(route.request().url()).searchParams.get('term')||'').toLowerCase();
  const hit = Object.keys(CAT).find(k => term.includes(k));
  route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'},
    body: JSON.stringify({results: hit ? [{artistName:CAT[hit][0], collectionName:CAT[hit][1], trackName:hit, artworkUrl100:'https://x/100x100bb.jpg', releaseDate:'1972-02-25T00:00:00Z'}] : []})});
});
await p.route('**/api.discogs.com/**', route => {
  const u = route.request().url();
  let body;
  if (u.includes('/marketplace/stats/')) body = JSON.stringify({num_for_sale:37, lowest_price:{value:18.4, currency:'GBP'}});
  else body = JSON.stringify({pagination:{items:24}, results:[{id:5551,title:'X',format:['Vinyl','LP','Album'],country:'UK',uri:'/release/5551',year:'1972',community:{have:9000,want:3000}}]});
  route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body});
});
await p.goto('file://' + ROOT + '/index.html');
await p.setInputFiles('#file', FIX + 'apple/Apple Music - Play History Daily Tracks.csv');
await p.waitForSelector('.album');
await p.waitForFunction(() => PENDING_LEFT === 0, null, {timeout:30000});
await p.waitForTimeout(1000);
await p.click('#fetch');
await p.waitForFunction(() => ALBUMS.every(a => a.state === 'done'), null, {timeout:60000});
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
console.log('STATS:', await p.textContent('#stats'));
console.log((await p.$$eval('.album', e => e.map(x => x.innerText.replace(/\n+/g,' | ')))).join('\n'));
await p.setViewportSize({width:1180, height:1400});
await p.screenshot({path: join(__d,'out','shot2.png'), fullPage:true});
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
