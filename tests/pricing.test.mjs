import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__d, '..');
const FIX = join(__d, 'fixtures') + '/';

import fs from 'fs';
const F = n => fs.readFileSync(join(FIX, 'discogs', n), 'utf8');

const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('dialog', d => d.accept());

// replay real API responses
await p.route('**/api.discogs.com/**', async route => {
  const u = route.request().url();
  let body;
  if (u.includes('/marketplace/stats/1174296')) body = F('stats_1174296.json');
  else if (u.includes('/marketplace/stats/')) {
    const id = u.match(/stats\/(\d+)/)[1];
    body = JSON.stringify({num_for_sale: 40, lowest_price:{value: 15.0 + (id % 7), currency:'GBP'}, blocked_from_sale:false});
  }
  else if (u.includes('artist=Radiohead')) body = F('search_rh.json');
  else if (u.includes('q=') && !u.includes('format=Vinyl')) body = JSON.stringify({pagination:{items:2},results:[{id:999,title:'Baris Manco - Yol',format:['CD','Album'],country:'Turkey',uri:'/release/999',community:{have:5,want:2}}]});
  else body = JSON.stringify({pagination:{items:0}, results:[]});
  await route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body});
});
await p.route('**/itunes.apple.com/**', route =>
  route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:F('it_rh.json')}));
await p.route('**/*.mzstatic.com/**', route => route.fulfill({status:200, contentType:'image/gif',
  body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64')}));

await p.goto('file://' + ROOT + '/index.html');
await p.setInputFiles('#file', FIX + 'sample.csv');
await p.waitForSelector('.album');
await p.waitForTimeout(3000);

await p.click('#fetch');
await p.waitForFunction(() => ALBUMS.every(a => ['done','none','nostock','novinyl','error'].includes(a.state)), null, {timeout:60000});
await p.waitForTimeout(500);

const out = await p.evaluate(() => ALBUMS.map(a =>
  ({album:a.album, state:a.state, price:a.price, forSale:a.forSale, pressings:a.pressings,
    want:a.want, year:a.year, art:!!a.art, url:a.discogsUrl})));
console.log(JSON.stringify(out, null, 1));
console.log('STATS:', await p.textContent('#stats'));

// visible card text for the priced album
const cards = await p.$$eval('.album', els => els.map(e => e.innerText.replace(/\n/g,' | ')));
console.log('--- CARDS ---'); cards.forEach(c => console.log('  ' + c));

// sort by price
await p.selectOption('#sort','price');
await p.waitForTimeout(300);
console.log('SORTED:', await p.$$eval('.art-title', e => e.map(x=>x.textContent)));

// currency switch resets prices
await p.selectOption('#cur','EUR');
await p.waitForTimeout(300);
console.log('AFTER CUR SWITCH states:', await p.evaluate(()=>ALBUMS.map(a=>a.state).join(',')));

await p.setViewportSize({width:1180, height:900});
await p.selectOption('#cur','GBP');
await p.click('#fetch');
await p.waitForFunction(() => ALBUMS.some(a => a.state==='done'), null, {timeout:60000});
await p.waitForTimeout(600);
await p.screenshot({path: join(__d,'out','shot.png'), fullPage:true});
await p.setViewportSize({width:390, height:840});
await p.waitForTimeout(300);
await p.screenshot({path: join(__d,'out','shot-mobile.png')});
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
