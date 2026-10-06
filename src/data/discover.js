// Discover feed. Base: data/discover.json (built every 6 h by scripts/build-discover.mjs).
// Refresh: re-checks the json, fetches CORS-friendly feeds live and searches OpenAlex for new papers.
// "Seen" ids live in localStorage (per device) so each refresh rotates in a fresh batch.
import { sourceItems, openAlexUrl, openAlexItems } from './feed-parse.js';

const SEEN_KEY = 'idea-garden:discover-seen';
const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { return new Set(); } };
const byDate = (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);

export const Discover = {
  items: [],
  sources: [],
  live: [],
  limits: {},
  generatedAt: null,
  status: 'idle', // idle | loading | ready | error
  refreshing: false,
  lastRefresh: null,
  newIds: new Set(), // arrived via the last refresh
  seen: loadSeen(),

  async fetchJson() {
    const r = await fetch(`data/discover.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.json();
  },

  async load() {
    if (this.status === 'loading' || this.status === 'ready') return;
    this.status = 'loading';
    try {
      const j = await this.fetchJson();
      Object.assign(this, { items: j.items, sources: j.sources, live: j.live || [], limits: j.limits || {}, generatedAt: j.generatedAt, status: 'ready' });
    } catch {
      this.status = 'error';
    }
  },

  // add unknown items; returns how many were new
  merge(items) {
    const have = new Set(this.items.map((d) => d.id));
    const fresh = items.filter((d) => d.title && !have.has(d.id) && have.add(d.id));
    fresh.forEach((d) => this.newIds.add(d.id));
    this.items = [...fresh, ...this.items].sort(byDate);
    return fresh.length;
  },

  // queries: research topics to search on OpenAlex (from interests + ideas)
  async refresh(queries = []) {
    if (this.refreshing) return 0;
    this.refreshing = true;
    this.newIds = new Set();
    const tasks = [
      this.fetchJson().then((j) => {
        Object.assign(this, { sources: j.sources, live: j.live || this.live, generatedAt: j.generatedAt });
        this.merge(j.items);
      }),
      ...this.live.map(async (src) => {
        const r = await fetch(src.url, { signal: AbortSignal.timeout(12000) });
        this.merge(sourceItems(src, await r.text(), this.limits));
      }),
      ...queries.slice(0, 5).map(async (q) => {
        const r = await fetch(openAlexUrl(q, { perQuery: 4, sinceDays: 90, sort: null }), { signal: AbortSignal.timeout(12000) });
        this.merge(openAlexItems(await r.json()));
      }),
    ];
    await Promise.allSettled(tasks);
    this.refreshing = false;
    this.lastRefresh = new Date().toISOString();
    if (this.status !== 'ready' && this.items.length) this.status = 'ready';
    return this.newIds.size; // merge() records every new id; parallel tasks can't lose counts
  },

  markSeen(ids) {
    ids.forEach((id) => this.seen.add(id));
    const keep = [...this.seen].slice(-3000);
    this.seen = new Set(keep);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(keep)); } catch {}
  },

  // unseen first (newest refresh arrivals at the very front), order otherwise kept
  freshFirst(list) {
    const rank = (d) => (this.newIds.has(d.id) ? 0 : this.seen.has(d.id) ? 2 : 1);
    return list.map((d, k) => [d, k]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([d]) => d);
  },

  byId(id) { return this.items.find((d) => d.id === id); },
  text: (d) => [d.title, d.excerpt, d.group].join(' '),
  inspirationType: (d) => (d.kind === 'research' ? 'research' : 'article'),
};
