// Discover reading state + taste learning. Synced with the garden (state.reading).
// Signals: read +1 · reading list +1.5 · saved as inspiration +2 · not interested −2.
// Each updates weights for the item's group, source and title keywords; For you ranks by their sum.
import { Store } from './store.js';
import { AI } from './ai.js';

const MAX_WORDS = 400;
const R = () => Store.state.reading;
const words = (d) => AI.keywords([d.title, d.excerpt].join(' '), 5);
const clamp = (x) => Math.max(-6, Math.min(6, x));

function learn(d, w) {
  const t = R().taste;
  t.groups[d.group] = clamp((t.groups[d.group] || 0) + w);
  t.sources[d.source] = clamp((t.sources[d.source] || 0) + w * 0.7);
  words(d).forEach((k) => { t.words[k] = clamp((t.words[k] || 0) + w * 0.4); });
  const ks = Object.keys(t.words);
  if (ks.length > MAX_WORDS) ks.sort((a, b) => Math.abs(t.words[a]) - Math.abs(t.words[b])).slice(0, ks.length - MAX_WORDS).forEach((k) => delete t.words[k]);
}

const snap = (d) => ({ id: d.id, url: d.url, title: d.title, source: d.source, group: d.group, kind: d.kind, excerpt: d.excerpt || '' });

export const Taste = {
  isRead: (id) => !!R().read[id],
  isHidden: (id) => !!R().hidden[id],
  isLater: (id) => R().later.some((x) => x.id === id),
  get later() { return R().later; },
  // newest first; items kept as snapshots because feed items rotate out
  get history() { return Object.values(R().read).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); },

  score(d) {
    const t = R().taste;
    return (t.groups[d.group] || 0) + (t.sources[d.source] || 0) + words(d).reduce((a, k) => a + (t.words[k] || 0), 0);
  },

  markRead(d) {
    if (!R().read[d.id]) learn(d, 1);
    R().read[d.id] = { ...snap(d), at: Store.now() };
    R().later = R().later.filter((x) => x.id !== d.id);
    const ids = Object.keys(R().read);
    if (ids.length > 500) ids.sort((a, b) => Date.parse(R().read[a].at) - Date.parse(R().read[b].at)).slice(0, ids.length - 500).forEach((k) => delete R().read[k]);
    Store.commit();
  },
  toggleLater(d) {
    if (this.isLater(d.id)) R().later = R().later.filter((x) => x.id !== d.id);
    else { R().later.unshift({ ...snap(d), at: Store.now() }); learn(d, 1.5); }
    Store.commit();
  },
  notInterested(d) { R().hidden[d.id] = Store.now(); learn(d, -2); Store.commit(); },
  undoNotInterested(d) { delete R().hidden[d.id]; learn(d, 2); Store.commit(); },
  saved(d) { learn(d, 2); Store.commit(); },
  reset() { R().taste = { groups: {}, sources: {}, words: {} }; R().hidden = {}; Store.commit(); },
};
