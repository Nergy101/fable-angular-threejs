/**
 * Scrapes the partyflock.nl genre agendas into public/partyflock-events.json.
 *
 * Partyflock's agenda pages embed schema.org/Event microdata per row, so this
 * is a handful of regexes — no DOM library needed. We fetch one page per
 * partyflock genre slug, map slugs onto the Music section's taste chips,
 * dedupe events that appear under several slugs, and keep the next ~5 weeks.
 *
 * Run: node scripts/scrape-partyflock.mjs
 * The deploy workflow runs this daily; on failure the committed JSON stays.
 */

import { writeFileSync } from 'node:fs';

const OUT = new URL('../public/partyflock-events.json', import.meta.url);
const UA = 'vector-atelier-music/1.0 (personal learning project; contact: github.com/Nergy101)';
const WINDOW_DAYS = 35;
const DELAY_MS = 400;

/** taste-chip id → partyflock genre slugs folded into it */
const SLUGS = {
  techno: ['techno', 'house'],
  dnb: ['drum-and-bass', 'jungle'],
  gabber: ['hardcore', 'uptempo-hardcore', 'frenchcore'],
  hardstyle: ['hardstyle', 'rawstyle'],
  hiphop: ['hip-hop', 'randb'],
  rock: ['rock', 'hard-rock'],
  thrash: ['thrash-metal', 'heavy-metal', 'speed-metal'],
  death: ['death-metal', 'black-metal', 'deathcore'],
  doom: ['doom-metal', 'sludge-metal', 'stoner-metal'],
  metalcore: ['metalcore', 'hardcore-punk', 'punk'],
  indie: ['indie', 'alternative-rock'],
  pop: ['pop', 'synth-pop'],
  jazz: ['jazz', 'soul'],
  classical: ['classical'],
  latin: ['latin', 'reggaeton', 'afrobeats'],
};

/** genres whose events are typically concerts rather than club nights */
const CONCERT_GENRES = new Set([
  'rock',
  'thrash',
  'death',
  'doom',
  'metalcore',
  'indie',
  'jazz',
  'classical',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return s
    .replace(/<.*$/s, '') // names can carry a nested <small>·subtitle</small> — drop it
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseEvents(html) {
  const events = [];
  // each event is a <tbody class="hl" id="p<ID>" ... itemtype=".../Event"> block
  const blocks = html.split(/<tbody class="hl"/).slice(1);
  for (const block of blocks) {
    // genre pages omit the tbody id; the party link always carries it
    const id = block.match(/href="\/party\/(\d+)/)?.[1] ?? block.match(/^[^>]*id="p(\d+)"/)?.[1];
    const start = block.match(/itemprop="startDate" content="([^"]+)"/)?.[1];
    const name = block.match(/<span itemprop="name">(.*?)<\/span>/)?.[1];
    if (!id || !start || !name) continue;

    const end = block.match(/itemprop="endDate" content="([^"]+)"/)?.[1];
    const url = block.match(/itemprop="url" content="([^"]+)"/)?.[1];
    const location = block.match(/itemprop="location"[\s\S]*?itemprop="name" content="([^"]+)"/)?.[1];
    const city = block.match(/itemprop="addressLocality" content="([^"]+)"/)?.[1];

    events.push({
      id,
      name: decode(name),
      start,
      end,
      url,
      venue: location ? decode(location) : '',
      city: city ? decode(city) : '',
    });
  }
  return events;
}

function classifyKind(event, genres) {
  if (/festival|\bfest\b|open air|openair|outdoor/i.test(event.name)) return 'festival';
  if (event.end) {
    const hours = (Date.parse(event.end) - Date.parse(event.start)) / 36e5;
    const startHour = new Date(event.start).getHours();
    if (hours >= 9 && startHour >= 8 && startHour <= 17) return 'festival';
  }
  const concertish = genres.filter((g) => CONCERT_GENRES.has(g)).length;
  return concertish > genres.length / 2 ? 'concert' : 'party';
}

const now = Date.now();
const horizon = now + WINDOW_DAYS * 864e5;
const byId = new Map();
let pages = 0;

for (const [genre, slugs] of Object.entries(SLUGS)) {
  for (const slug of slugs) {
    const url = `https://partyflock.nl/agenda/genre/${slug}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        console.warn(`! ${slug}: HTTP ${res.status}`);
        continue;
      }
      const found = parseEvents(await res.text());
      pages++;
      let kept = 0;
      for (const ev of found) {
        const t = Date.parse(ev.start);
        if (Number.isNaN(t) || t < now - 864e5 || t > horizon) continue;
        kept++;
        const existing = byId.get(ev.id);
        if (existing) {
          if (!existing.genres.includes(genre)) existing.genres.push(genre);
        } else {
          byId.set(ev.id, { ...ev, genres: [genre] });
        }
      }
      console.log(`  ${slug.padEnd(16)} ${found.length} rows, ${kept} in window`);
    } catch (err) {
      console.warn(`! ${slug}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
}

const events = [...byId.values()]
  .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  .map((ev) => ({
    id: ev.id,
    date: ev.start,
    kind: classifyKind(ev, ev.genres),
    name: ev.name,
    venue: ev.venue,
    city: ev.city,
    genres: ev.genres,
    url: ev.url ?? `https://partyflock.nl/party/${ev.id}`,
  }));

if (events.length === 0) {
  // leave the committed JSON untouched so the site keeps its last good data
  console.error('No events scraped — keeping the existing JSON.');
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify({ scrapedAt: new Date().toISOString(), events }, null, 1));
console.log(`\n${events.length} events from ${pages} pages → public/partyflock-events.json`);
