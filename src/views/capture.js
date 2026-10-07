// Capture sheets: add idea (Open → type → save) and save inspiration (+ optional reflection, connection suggestions).
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { S, $, esc, TYPES, guessTitle } from '../ui/util.js';
import { sheet, closeSheet, toast } from '../ui/components.js';
import { render, route, go } from '../ui/router.js';
import { ui } from '../ui/state.js';
import { moveIdea } from './ideas.js';

export function openCapture(text = '') {
  sheet(`<textarea class="capture-input" id="cap-text" rows="4" placeholder="What’s on your mind?" data-autofocus data-enter-mod="cap-save">${esc(typeof text === 'string' ? text : '')}</textarea>
    <div class="row between"><button class="btn ghost sm" data-action="save-insp">🦋 Save an inspiration instead</button>
    <div class="row"><span class="fine hide-sm">Ctrl+Enter</span><button class="btn primary" data-action="cap-save">Save</button></div></div>`, 'capture');
}

export function openInspiration({ ideaId = '', url = '', title = '' } = {}) {
  sheet(`<h3>Save inspiration 🦋</h3>
    <input class="inline-input big" id="in-url" placeholder="Paste a link, or type a title" value="${esc(url)}" ${url ? '' : 'data-autofocus'}>
    <input class="inline-input" id="in-title" placeholder="Title (optional)" value="${esc(title)}">
    <div class="chips" id="in-type">${TYPES.map(([k, l]) => `<button class="chip${k === 'article' ? ' on' : ''}" data-action="pick-type" data-type="${k}">${l}</button>`).join('')}</div>
    <details class="reflect"><summary>Reflect now <span class="muted">(optional, or later)</span></summary>
      <textarea class="inline-input" id="in-caught" rows="2" placeholder="What caught your attention?"></textarea>
      <textarea class="inline-input" id="in-apply" rows="2" placeholder="What could you apply it to?"></textarea></details>
    <input type="hidden" id="in-idea" value="${esc(ideaId)}">
    <div class="row end"><button class="btn ghost" data-action="close-sheet">Cancel</button><button class="btn primary" data-action="insp-save">Save</button></div>`);
}

// returns false if there's nothing to suggest
export function openConnections(insp) {
  const ideas = AI.ideasForInspiration(insp);
  const projects = AI.projectsForInspiration(insp);
  if (!ideas.length && !projects.length) return false;
  sheet(`<h3>This might connect to…</h3><p class="muted">Suggestions only. Connect what makes sense.</p>
    ${ideas.map((r) => `<div class="sug"><span>💡 <strong>${esc(Store.ideaTitle(r.item))}</strong> <em class="muted small">${AI.reason(r)}</em></span><button class="btn sm" data-action="connect-insp" data-insp="${insp.id}" data-idea="${r.item.id}" data-close="1">Connect</button></div>`).join('')}
    ${projects.map((r) => `<div class="sug"><span>🌳 <strong>${esc(r.item.name)}</strong> <em class="muted small">${AI.reason(r)}</em></span><button class="btn sm" data-action="connect-insp-proj" data-insp="${insp.id}" data-p="${r.item.id}" data-close="1">Connect</button></div>`).join('')}
    <div class="row end"><button class="btn ghost" data-action="close-sheet">Not now</button></div>`);
  return true;
}

// inside the connections sheet: mark connected, close when nothing is left
function markConnected(el) {
  if (!el.dataset.close) return;
  el.replaceWith(Object.assign(document.createElement('span'), { className: 'muted small', textContent: '✓ connected' }));
  if (!document.querySelector('.sheet .sug .btn')) closeSheet();
}

export const actions = {
  capture: openCapture,
  'cap-save': () => {
    const text = $('#cap-text').value.trim();
    if (!text) return $('#cap-text').focus();
    const idea = Store.addIdea(text);
    closeSheet();
    if (['', 'ideas'].includes(route().name)) render(true);
    toast('🌱 Planted. It’s in your garden.', [
      ...(S().user.organizeMode === 'ai' ? [['✨ Organize', 'toast-organize', { id: idea.id }]] : []),
      ['Open', 'nav', { to: `#/idea/${idea.id}` }],
      ['🫙 Terrarium', 'toast-status', { id: idea.id, status: 'incubator' }],
      ['🌰 Vault', 'toast-status', { id: idea.id, status: 'vault' }],
    ]);
  },
  'toast-organize': (el) => { ui.organizeFor = el.dataset.id; go(`#/idea/${el.dataset.id}`); },
  'toast-status': (el) => moveIdea(el.dataset.id, el.dataset.status, false),
  'save-insp': (el) => openInspiration({ ideaId: el.dataset.idea }),
  'pick-type': (el) => el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)),
  'insp-save': () => {
    const raw = $('#in-url').value.trim();
    if (!raw) return $('#in-url').focus();
    const isUrl = /^https?:\/\//i.test(raw) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(raw);
    const url = isUrl ? (/^https?:/i.test(raw) ? raw : 'https://' + raw) : '';
    let type = $('#in-type .chip.on')?.dataset.type || 'article';
    if (url && /youtube\.com|youtu\.be|vimeo\.com/.test(url)) type = 'video';
    if (url && /doi\.org|pubmed|arxiv|biorxiv|journals?\./.test(url) && type === 'article') type = 'research';
    if (!url && type === 'article') type = 'note';
    const insp = Store.addInspiration({ url, type, title: $('#in-title').value.trim() || (url ? guessTitle(url) : raw), caught: $('#in-caught').value.trim(), apply: $('#in-apply').value.trim() });
    const ideaId = $('#in-idea').value;
    closeSheet();
    if (ideaId) Store.connectInspiration(insp.id, ideaId);
    render(true);
    if (!ideaId && openConnections(insp)) return;
    toast('🦋 Saved to your inspirations.', insp.caught ? [] : [['Reflect now', 'nav', { to: `#/inspiration/${insp.id}` }]]);
  },
  'connect-insp': (el) => {
    Store.connectInspiration(el.dataset.insp, el.dataset.idea);
    if (el.dataset.key) Store.dismiss(el.dataset.key);
    markConnected(el);
    render(true);
    toast('🔗 Connected. The idea grew a little.');
  },
  'connect-insp-proj': (el) => {
    Store.connectInspirationToProject(el.dataset.insp, el.dataset.p);
    markConnected(el);
    render(true);
  },
};
