// Small pure helpers + shared labels used across views.
import { Store } from '../core/store.js';
import { Sync } from '../core/sync.js';

export const S = () => Store.state;
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
export const short = (s, n = 34) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
export const bar = (pct, cls = '') => `<div class="bar ${cls}"><span style="width:${pct}%"></span></div>`;
export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const weekDate = (p, w) => new Date(new Date(p.startDate).getTime() + w * 7 * Store.DAY);
export const wk = (m) => (m.weekEnd - m.weekStart <= 1 ? `wk ${m.weekStart + 1}` : `wk ${m.weekStart + 1}–${m.weekEnd}`);
export const dataAttrs = (data = {}) => Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');

export const ago = (iso) => {
  const d = Store.daysSince(iso);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
};

export const STAGE_ICON = { seed: '🌰', sprout: '🌱', plant: '🌿', bloom: '🌸' };
export const STATUS_LABEL = { fresh: 'New', incubator: 'Terrarium', vault: 'Seed vault', archived: 'Compost', project: 'Project' };
// one place that explains each home for an idea (tabs, idea page, toasts)
export const STATUS_INFO = {
  fresh: ['🌱', 'In the garden', 'Planted and visible in your garden.'],
  incubator: ['🫙', 'Terrarium', 'Worth developing, not ready to be a project. I’ll suggest related ideas and inspirations to grow it.'],
  vault: ['🌰', 'Seed vault', 'Saved for later. It rests out of sight, and I’ll bring it back when something related shows up.'],
  archived: ['🍂', 'Compost', 'You’re done with it. Out of the way, never deleted. You can bring it back anytime.'],
};
export const TYPES = [['article', '📰 Article'], ['research', '🔬 Journal article'], ['video', '🎬 Video'], ['book', '📖 Book'], ['design', '🎨 Design'], ['note', '📝 Note'], ['other', '🔗 Other']];
export const typeIcon = (t) => (TYPES.find(([k]) => k === t)?.[1] || '🔗').split(' ')[0];
export const typeLabel = (t) => (TYPES.find(([k]) => k === t)?.[1] || '🔗 Link').replace(/^\S+\s/, '');

export function guessTitle(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)doi\.org$/.test(u.hostname)) return 'DOI ' + decodeURIComponent(u.pathname.slice(1));
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').trim();
    return seg ? seg[0].toUpperCase() + seg.slice(1) : u.hostname.replace(/^www\./, '');
  } catch { return url; }
}

// account bits
export const SYNC_TEXT = { off: 'On this device', local: 'Guest · not synced', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline · will sync later', error: 'Sync problem · retrying' };
export const syncDot = () => `<span class="sync-dot ${Sync.user ? Sync.status : 'local'}"></span>`;
export function avatarHTML(cls = '') {
  const url = Sync.avatar();
  if (url) return `<img class="avatar ${cls}" src="${esc(url)}" alt="" referrerpolicy="no-referrer">`;
  return `<span class="avatar ${cls}">${Sync.user ? esc((Sync.displayName() || '?').trim()[0].toUpperCase()) : '🌱'}</span>`;
}
