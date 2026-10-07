// Embeddings for "related" suggestions (Phase 6). Vectors come from garden-ai (task "embed"),
// live only on this device (localStorage, keyed by a hash of the item's text) and are never synced.
// Relatedness is a z-score against this garden's own spread of similarities, so it doesn't
// hinge on one model's absolute cosine values. Not enough vectors yet → callers use keywords.
import { Store } from './store.js';
import { Sync } from './sync.js';
import cfg from '../config.js';
import { ideaText, inspText, projText, learnText } from './texts.js';

const KEY = 'ig.vec.v1';
const BATCH = 50, MAX_CALLS = 3; // per refresh; each call counts toward the daily AI limit
const MIN_VECTORS = 8;
const STOP_CODES = ['daily_limit', 'ai_not_configured', 'sign_in_required', 'unknown_task'];
const RETRY_MS = 5 * 60e3; // other failures: every attempt costs quota, so back off

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
function hash(t) {
  const s = t.toLowerCase();
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

// int8-quantized, base64 in storage: 256 dims ≈ 344 chars per item
function pack(v) {
  const max = Math.max(...v.map(Math.abs)) || 1;
  const q = Int8Array.from(v, (x) => Math.round((x / max) * 127));
  return withNorm(q);
}
function withNorm(q) {
  let n = 0;
  for (const x of q) n += x * x;
  return { q, n: Math.sqrt(n) || 1 };
}
const encode = ({ q }) => btoa(String.fromCharCode(...new Uint8Array(q.buffer)));
const decode = (b) => withNorm(new Int8Array(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer));

function cos(a, b) {
  const len = Math.min(a.q.length, b.q.length);
  let d = 0;
  for (let k = 0; k < len; k++) d += a.q[k] * b.q[k];
  return d / (a.n * b.n);
}

let cache = {};
try { for (const [h, b] of Object.entries(JSON.parse(localStorage.getItem(KEY) || '{}'))) cache[h] = decode(b); } catch { cache = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).map(([h, v]) => [h, encode(v)])))); } catch {} };

// mean/std of pairwise cosines, recomputed lazily when the vector set changes
let version = 0, statsFor = -1, stats = null;
function spread() {
  if (statsFor === version) return stats;
  statsFor = version;
  const vs = Object.values(cache).slice(0, 150);
  if (vs.length < MIN_VECTORS) return (stats = null);
  let sum = 0, sq = 0, n = 0;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) { const c = cos(vs[i], vs[j]); sum += c; sq += c * c; n++; }
  const mean = sum / n;
  return (stats = { mean, std: Math.sqrt(Math.max(1e-6, sq / n - mean * mean)) });
}

function gardenTexts() {
  const s = Store.state;
  return [...s.ideas.map(ideaText), ...s.inspirations.map(inspText), ...s.projects.map(projText), ...s.learning.map(learnText)]
    .map(clean).filter((t) => t.length >= 3);
}

let stopped = false, running = false, timer = null, retryAt = 0;
const listeners = new Set();

async function refresh() {
  if (!Vec.on() || running || Date.now() < retryAt) return;
  const texts = new Map(gardenTexts().map((t) => [hash(t), t.slice(0, 1500)]));
  if (!texts.size) return; // e.g. before the first pull: don't wipe the cache
  running = true;
  let changed = false;
  try {
    for (const h of Object.keys(cache)) if (!texts.has(h)) { delete cache[h]; changed = true; }
    const missing = [...texts].filter(([h]) => !cache[h]);
    for (let c = 0; c < MAX_CALLS && missing.length; c++) {
      const batch = missing.splice(0, BATCH);
      const { vectors } = await Sync.invoke('garden-ai', { task: 'embed', texts: batch.map(([, t]) => t) });
      batch.forEach(([h], k) => { if (vectors?.[k]?.length) { cache[h] = pack(vectors[k]); changed = true; } });
    }
  } catch (e) {
    if (STOP_CODES.includes(e.code)) stopped = true;
    else retryAt = Date.now() + RETRY_MS;
    console.warn('[embed]', e.code || e);
  } finally {
    running = false;
    if (changed) { version++; save(); listeners.forEach((fn) => fn()); }
  }
}

export const Vec = {
  on: () => !!cfg.ai && !stopped && Sync.enabled && !!Sync.user && Store.state.user.aiEnabled !== false,

  // → { cos, z } for two item texts, or null when either has no vector yet
  sim(a, b) {
    if (!Vec.on()) return null;
    const st = spread();
    const va = st && cache[hash(clean(a))], vb = st && cache[hash(clean(b))];
    if (!va || !vb) return null;
    const c = cos(va, vb);
    return { cos: c, z: (c - st.mean) / st.std };
  },

  schedule(ms = 4000) { clearTimeout(timer); timer = setTimeout(refresh, ms); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  clear() { cache = {}; version++; try { localStorage.removeItem(KEY); } catch {} },
  init() {
    Store.subscribe(() => Vec.schedule());
    Sync.onChange(() => { if (Sync.user) Vec.schedule(); });
    Vec.schedule(6000);
  },
};
