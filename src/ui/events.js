// Delegated DOM events. Views contribute handlers by name:
//   click [data-action=x]  → actions[x](el, ev)
//   Enter in [data-enter=x] → enter[x](el);  Ctrl/⌘+Enter in [data-enter-mod=x] → actions[x](el)
//   change [data-change=x] → actions[x](el);  change [data-bind="kind:id:field"] → bind(kind, id, field, value)
//   drag [data-drag-idea] onto [data-drop=status] → onDrop(id, status)
import { $, S } from './util.js';
import { go } from './router.js';
import { closeSheet } from './components.js';

const actions = {};
const enter = {};
export const registerActions = (map) => Object.assign(actions, map);
export const registerEnter = (map) => Object.assign(enter, map);
export const runAction = (name, el, ev) => actions[name]?.(el, ev);

let suppressClick = false;
let drag = null;
export const isDragging = () => !!drag;

export function wireEvents({ bind, onDrop, onInput, quickCapture }) {
  document.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; ev.preventDefault(); ev.stopPropagation(); return; }
    const act = ev.target.closest('[data-action]');
    if (act && actions[act.dataset.action]) {
      if (act.tagName === 'A' || act.closest('summary')) ev.preventDefault();
      actions[act.dataset.action](act, ev);
      return;
    }
    const nav = ev.target.closest('[data-nav]');
    if (nav) go(nav.dataset.nav);
  });

  document.addEventListener('keydown', (ev) => {
    const el = ev.target;
    if (ev.key === 'Escape') return closeSheet();
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && el.dataset?.enterMod) { ev.preventDefault(); return actions[el.dataset.enterMod]?.(el); }
    if (ev.key === 'Enter' && !ev.shiftKey && el.dataset?.enter && enter[el.dataset.enter]) { ev.preventDefault(); return enter[el.dataset.enter](el); }
    if ((ev.key === 'Enter' || ev.key === ' ') && el.matches?.('svg [data-nav], svg [data-action]')) { ev.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    // quick capture: "n" anywhere you aren't typing
    const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
    if (!typing && ev.key === 'n' && !ev.ctrlKey && !ev.metaKey && S().user.onboarded && !$('.sheet-wrap')) { ev.preventDefault(); quickCapture(); }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.change && actions[el.dataset.change]) return actions[el.dataset.change](el);
    if (!el.dataset.bind) return;
    const [kind, id, field] = el.dataset.bind.split(':');
    bind(kind, id, field, el.value);
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.input) onInput(el);
    if (el.hasAttribute('data-grow')) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  });

  // drag & drop: pointer events (mouse + touch); a 6px move starts a drag, a tap still opens the idea
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-drag-idea]');
    if (!el || ev.button > 0 || ev.target.closest('button')) return;
    drag = { el, id: el.dataset.dragIdea, x0: ev.clientX, y0: ev.clientY, started: false, ghost: null, over: null };
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 6) return;
      drag.started = true;
      const r = drag.el.getBoundingClientRect();
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.className += ' drag-ghost';
      drag.ghost.style.width = r.width + 'px';
      drag.dx = ev.clientX - r.left; drag.dy = ev.clientY - r.top;
      document.body.appendChild(drag.ghost);
      drag.el.classList.add('dragging');
      document.body.classList.add('is-dragging');
    }
    ev.preventDefault();
    drag.ghost.style.transform = `translate(${ev.clientX - drag.dx}px, ${ev.clientY - drag.dy}px) rotate(-3deg)`;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]');
    if (target !== drag.over) { drag.over?.classList.remove('drop-hover'); target?.classList.add('drop-hover'); drag.over = target; }
  }, { passive: false });
  const endDrag = (ev) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.started) return;
    suppressClick = ev.type === 'pointerup';
    setTimeout(() => { suppressClick = false; }, 50);
    d.ghost.remove();
    d.el.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    d.over?.classList.remove('drop-hover');
    if (d.over && ev.type === 'pointerup') onDrop(d.id, d.over.dataset.drop);
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
}
