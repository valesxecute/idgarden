// Shared UI pieces: sheets (modals), toasts, suggestion rows.
import { esc, dataAttrs } from './util.js';

export function sheet(html, cls = '') {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg" data-action="close-sheet"></div><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const f = wrap.querySelector('[data-autofocus]');
  if (f) setTimeout(() => f.focus(), 30);
}
let pendingAsk = null; // resolve fn of an open ask(); closing the sheet any other way = "no"
export const closeSheet = () => {
  document.querySelectorAll('.sheet-wrap').forEach((n) => n.remove());
  if (pendingAsk) { const r = pendingAsk; pendingAsk = null; r(false); }
};

// in-app replacement for window.confirm() (native dialogs are blocked in some browsers / installed apps)
export function ask(text, { yes = 'Yes', no = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    sheet(`<p class="ask-text">${esc(text)}</p>
      <div class="row end"><button class="btn ghost" data-ask="no">${esc(no)}</button>
      <button class="btn ${danger ? 'danger-solid' : 'primary'}" data-ask="yes" data-autofocus>${esc(yes)}</button></div>`, 'ask');
    pendingAsk = resolve;
    document.querySelector('.sheet.ask').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ask]');
      if (!b) return;
      pendingAsk = null;
      document.querySelectorAll('.sheet-wrap').forEach((n) => n.remove());
      resolve(b.dataset.ask === 'yes');
    });
  });
}

let toastTimer;
// actions: [[label, action, data]]
export function toast(text, actions = [], ms = 6000) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${text}</span>${actions.length ? `<div class="toast-actions">${actions.map(([l, a, data]) => `<button class="btn sm" data-action="${a}" ${dataAttrs(data)}>${l}</button>`).join('')}</div>` : ''}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// quiet suggestion row: text + one action + × (dismiss by key)
export function sugRow({ key, icon, html, action }) {
  const [label, act, data] = action || [];
  return `<div class="sug quiet"><span>${icon} ${html}</span><span class="sug-actions">
    ${action ? `<button class="btn sm" data-action="${act}" ${dataAttrs(data)} data-key="${esc(key)}">${label}</button>` : ''}
    <button class="x" data-action="dismiss" data-key="${esc(key)}" title="Not useful" aria-label="Dismiss suggestion">×</button></span></div>`;
}
export const sugBox = (rows, title = '✨ Suggestions') => (rows.length ? `<section class="sug-box"><div class="ai-label">${title}</div>${rows.map(sugRow).join('')}</section>` : '');

export const notFound = () => `<div class="empty-state"><p>That doesn’t exist anymore.</p><a class="btn" href="#/">Back to garden</a></div>`;
