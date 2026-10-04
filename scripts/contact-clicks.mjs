// Sums up the clicks on the contacts from the server log /var/log/caddy/velmren-contacts.log
// (scripts/portfolio.caddy writes one line per click). Reads the log from a file or from standard input:
//   node scripts/contact-clicks.mjs velmren-contacts.log
//   <command that prints the log> | node scripts/contact-clicks.mjs
// Prints the clicks by week and contact, then by the page they were made on and the mark of the link
// that brought the visitor (utm_source).
import { readFileSync } from 'node:fs';

const lines = readFileSync(process.argv[2] ?? 0, 'utf8').split('\n').filter(Boolean);
const byWeek = new Map(), byPage = new Map();
const add = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
// The Monday of the week a moment belongs to, as a date.
const week = seconds => {
  const day = new Date(seconds * 1000);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
};

let skipped = 0;
for (const line of lines) {
  let entry;
  try { entry = JSON.parse(line); } catch { skipped++; continue; }
  const contact = /^\/ping\/([a-z]+\/[a-z0-9-]+)$/.exec(entry.request?.uri ?? '')?.[1];
  // Only what a page sends: a click is a POST with the address of the page in Referer.
  const from = entry.request?.headers?.Referer?.[0];
  if (!contact || entry.request.method !== 'POST' || !from) { skipped++; continue; }
  const page = new URL(from);
  add(byWeek, `${week(entry.ts)}  ${contact}`);
  add(byPage, `${page.pathname}  ${page.searchParams.get('utm_source') ?? '-'}  ${contact}`);
}

const print = (title, map) => {
  console.log(title);
  for (const [key, count] of [...map].sort(([a], [b]) => a.localeCompare(b))) console.log(`${String(count).padStart(5)}  ${key}`);
};
print('clicks  week (Monday)  contact/place', byWeek);
print('\nclicks  page  utm_source  contact/place', byPage);
if (skipped) console.log(`\n${skipped} lines are not clicks from a page and are left out`);
