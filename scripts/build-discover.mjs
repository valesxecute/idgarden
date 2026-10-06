// Builds data/discover.json from scripts/sources.json (RSS/Atom feeds + OpenAlex).
// Zero deps, Node 18+. Run: node scripts/build-discover.mjs   (CI runs it every 6 h before deploy)
// Stores only title, link, source, date and a short excerpt; the app links out to the original.
// Parsing lives in src/data/feed-parse.js so the browser's live refresh uses the same code.
import { readFile, writeFile } from 'node:fs/promises';
import { sourceItems, openAlexUrl, openAlexItems, hasItems } from '../src/data/feed-parse.js';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(await readFile(new URL('scripts/sources.json', root), 'utf8'));
const UA = 'Mozilla/5.0 (compatible; IdeaGardenBot/0.1; +discover feed)';

async function getText(url, tries = 2) {
  for (let k = 1; ; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text();
      if (k < tries && !hasItems(t) && !t.trimStart().startsWith('{')) throw new Error('empty feed');
      return t;
    } catch (e) {
      if (k >= tries) throw e;
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
}

const report = [];
const all = [];
await Promise.all(cfg.sources.map(async (src) => {
  try {
    const items = sourceItems(src, await getText(src.url), cfg);
    all.push(...items);
    report.push({ name: src.name, group: src.group, url: src.url, ok: true, count: items.length });
  } catch (e) {
    report.push({ name: src.name, group: src.group, url: src.url, ok: false, count: 0, error: e.message });
  }
}));
for (const q of cfg.openalex.queries) {
  try { all.push(...openAlexItems(JSON.parse(await getText(openAlexUrl(q, cfg.openalex))))); } catch (e) { report.push({ name: `OpenAlex: ${q}`, group: 'research', ok: false, count: 0, error: e.message }); }
}

const seen = new Set();
const items = all.filter((x) => !seen.has(x.id) && seen.add(x.id))
  .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

await writeFile(new URL('data/discover.json', root), JSON.stringify({
  generatedAt: new Date().toISOString(),
  sources: report.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
  // feeds that allow browser requests (CORS): the app re-fetches these when you tap Refresh
  live: cfg.sources.filter((s) => s.live).map(({ name, url, group, kind, split }) => ({ name, url, group, kind, split })),
  limits: { perSource: cfg.perSource, maxAgeDays: cfg.maxAgeDays },
  items,
}));

const failed = report.filter((r) => !r.ok);
console.log(`discover.json: ${items.length} items from ${report.length - failed.length}/${report.length} sources`);
failed.forEach((f) => console.log(`  ✗ ${f.name}: ${f.error}`));
