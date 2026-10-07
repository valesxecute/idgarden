// Home (Garden tab): widget slots around the Add idea flower (choose in Customize home) + the garden scene.
// Scene: 3D island (garden/garden3d.js) when the device can, else the 2D island / planter box.
import { Store } from '../core/store.js';
import { renderIsland, renderBox, islandPlacement, DECOR, POND } from '../garden/scenes.js';
import { Garden3D, capable } from '../garden/garden3d.js';
import { S, $, esc, short, bar, ago, typeIcon } from '../ui/util.js';
import { icon } from '../ui/icons.js';
import { sheet, toast } from '../ui/components.js';
import { render, go, onRendered } from '../ui/router.js';

// 2D island is the default (user, 2026-10-07: "keep 2D for now"); 3D is opt-in
export const GARDEN_STYLES = [['island', '🏝️ Floating island'], ['box', '🪴 Planter box'], ['3d', '✨ 3D island (beta)']];
export const gardenStyle = () => {
  const pick = S().user.gardenStyle;
  if (!GARDEN_STYLES.some(([k]) => k === pick)) return 'island';
  return pick === '3d' && !capable() ? 'island' : pick;
};

// ---------- widgets ----------
const card = (href, eyebrow, title, sub, empty = false) =>
  `<a class="card mini${empty ? ' empty' : ''}" href="${href}"><p class="eyebrow">${eyebrow}</p><h4>${title}</h4>${sub}</a>`;
const listCard = (eyebrow, rows, emptyText, more) =>
  `<div class="card mini list-mini"><p class="eyebrow">${eyebrow}</p>${rows || `<p class="muted small">${emptyText}</p>`}${more || ''}</div>`;

const WIDGETS = {
  current: ['🌳 Current project', () => {
    const { main } = Store.activeProjects();
    if (!main) return card('#/ideas/incubator', '🌳 Current project', 'None yet', '<p class="muted small">Grow one from the terrarium.</p>', true);
    return card(`#/project/${main.id}`, '🌳 Current project', esc(short(main.name, 40)), `${bar(Store.projectProgress(main))}<p class="muted small">${Store.projectProgress(main)}%</p>`);
  }],
  inspiration: ['🦋 Last inspiration', () => {
    const insp = S().inspirations[0];
    if (!insp) return card('#/discover', '🦋 Last inspiration', 'Nothing yet', '<p class="muted small">Save what inspires you.</p>', true);
    return card(`#/inspiration/${insp.id}`, '🦋 Last inspiration', `${typeIcon(insp.type)} ${esc(short(insp.title, 44))}`, `<p class="muted small">Saved ${ago(insp.createdAt)}</p>`);
  }],
  side: ['🌿 Side projects', () => {
    const { side } = Store.activeProjects();
    const rows = side.slice(0, 3).map((p) => `<a class="mini-row" href="#/project/${p.id}"><span>🌱 ${esc(short(p.name, 30))}</span><span class="muted small">${Store.projectProgress(p)}%</span></a>`).join('');
    return listCard('🌿 Side projects', rows, 'None. Any project can be a side project.', side.length > 3 ? `<a class="mini-more" href="#/projects">+${side.length - 3} more</a>` : '');
  }],
  learning: ['🌻 Learning', () => {
    const goals = S().learning;
    const rows = goals.slice(0, 3).map((l) => `<a class="mini-row" href="#/learn/${l.id}"><span>🌻 ${esc(short(l.topic, 30))}</span><span class="muted small">${Store.learningProgress(l)}%</span></a>`).join('');
    return listCard('🌻 Learning', rows, 'Track a topic, book or course here.', goals.length > 3 ? `<a class="mini-more" href="#/learn">+${goals.length - 3} more</a>` : '');
  }],
  next: ['✅ Next step', () => {
    const { main } = Store.activeProjects();
    const m = main?.milestones.find((x) => !x.done);
    const t = m?.tasks.find((x) => !x.done);
    if (!t) return card(main ? `#/project/${main.id}` : '#/projects', '✅ Next step', main ? 'Nothing open' : 'No project yet', `<p class="muted small">${main ? 'Add a task to keep moving.' : 'Start one from an idea.'}</p>`, true);
    return card(`#/project/${main.id}`, '✅ Next step', esc(short(t.text, 60)), `<p class="muted small">${esc(short(main.name, 28))} · ${esc(short(m.name, 24))}</p>`);
  }],
  terrarium: ['🫙 Terrarium', () => {
    const inside = S().ideas.filter((i) => i.status === 'incubator').sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    const rows = inside.slice(0, 3).map((i) => `<a class="mini-row" href="#/idea/${i.id}"><span>🌱 ${esc(short(Store.ideaTitle(i), 30))}</span><span class="muted small">${ago(i.updatedAt)}</span></a>`).join('');
    return listCard('🫙 Terrarium', rows, 'Ideas you’re developing show up here.', inside.length > 3 ? `<a class="mini-more" href="#/ideas/incubator">+${inside.length - 3} more</a>` : '');
  }],
  reading: ['🔖 Reading list', () => {
    const later = S().reading?.later || [];
    const rows = later.slice(0, 3).map((x) => `<a class="mini-row" href="${esc(x.url || '#/discover')}" ${x.url ? 'target="_blank" rel="noopener"' : ''}><span>📖 ${esc(short(x.title || 'Saved item', 34))}</span></a>`).join('');
    return listCard('🔖 Reading list', rows, 'Save things from Discover to read later.', later.length > 3 ? `<a class="mini-more" href="#/discover">+${later.length - 3} more</a>` : '');
  }],
};
const SLOTS = [['Top left', 0], ['Top right', 1], ['Second row, left', 2], ['Second row, right', 3]];
const DEFAULT_SLOTS = ['current', 'inspiration', 'side', 'learning'];
const slots = () => { const s = S().user.homeSlots; return Array.isArray(s) && s.length === 4 ? s : DEFAULT_SLOTS; };
const widget = (id) => (WIDGETS[id] ? WIDGETS[id][1]() : '<div></div>');

// ---------- scene ----------
let arranging = false;

function sceneHTML(st) {
  const style = gardenStyle();
  const svg = style === 'box' ? renderBox(st) : renderIsland(st);
  if (style !== '3d') return `<section class="scene-wrap">${svg}</section>`;
  return `<section class="scene-wrap scene-3d${arranging ? ' arranging' : ''}" id="garden-host">${svg}<div class="g3d-tip" hidden></div>
    ${arranging ? `<div class="g3d-panel">
          <p class="small"><strong>Arrange your garden.</strong> <span class="muted">Drag plants, trees and decor. Drag empty space to turn.</span></p>
          <div class="chips">${DECOR.map(([k, e, l]) => `<button class="chip" data-action="decor-add" data-kind="${k}">${e} ${l}</button>`).join('')}</div>
          <div class="row between"><span class="g3d-sel" hidden><button class="btn sm" data-action="decor-turn">↻ Turn</button><button class="btn sm ghost danger" data-action="decor-remove">Remove</button></span>
            <span class="row"><button class="btn sm ghost" data-action="arrange-reset">Reset positions</button><button class="btn sm primary" data-action="arrange-done">Done</button></span></div></div>`
      : '<div class="g3d-bar"><button class="btn sm ghost g3d-arrange" data-action="arrange-start" title="Move things around, add decor">✏️ Arrange</button></div>'}
    </section>`;
}

export function viewHome() {
  const st = S();
  const [a, b, c, d] = slots();
  return `
    <section class="home-top">
      ${widget(a)}
      <button class="add-flower" data-action="capture" aria-label="Add idea">${icon('flower')}<span>Add idea</span></button>
      ${widget(b)}
    </section>
    <section class="home-row">${widget(c)}${widget(d)}</section>
    ${sceneHTML(st)}
    <p class="home-customize"><button class="btn sm ghost" data-action="customize-home">⚙️ Customize home</button></p>`;
}

onRendered((r) => {
  const host = r.name === '' && $('#garden-host');
  if (!host) { if (arranging) { arranging = false; Garden3D.setArrange(false); } return; }
  Garden3D.mount(host, {
    nav: go,
    selectChange: (decorId) => { const el = $('.g3d-sel'); if (el) el.hidden = !decorId; },
  });
});

const newDecorSpot = () => {
  // a free-ish spot: golden-angle walk, away from existing things
  const pl = islandPlacement(S());
  const taken = [...pl.ideas, ...pl.projects, ...pl.learning].map((x) => x.at).concat(pl.decor.map((x) => [x.u, x.v]), [POND]);
  for (let k = 0; k < 80; k++) {
    const r = 0.3 + ((k * 0.618) % 1) * 0.55, a = k * 2.39996 + 0.7;
    const p = [+(r * Math.cos(a)).toFixed(3), +(r * Math.sin(a)).toFixed(3)];
    if (!taken.some(([u, v]) => Math.hypot(u - p[0], v - p[1]) < (k < 40 ? 0.26 : 0.16))) return p;
  }
  return [0, 0.5];
};

export const views = { '': viewHome };

export const actions = {
  'arrange-start': () => { arranging = true; Garden3D.setArrange(true); render(true); },
  'arrange-done': () => { arranging = false; Garden3D.setArrange(false); render(true); toast('🌿 Garden saved.'); },
  'arrange-reset': () => {
    const st = S();
    st.garden = { layout: {}, decor: st.garden?.decor || [] };
    Store.commit();
    Garden3D.resetView();
    render(true);
    toast('Plants are back in their own spots. Decor stays.');
  },
  'decor-add': (el) => {
    const st = S();
    st.garden = st.garden || { layout: {}, decor: [] };
    const [u, v] = newDecorSpot();
    st.garden.decor.push({ id: Store.uid(), kind: el.dataset.kind, u, v, rot: 0 });
    Store.commit();
    render(true);
  },
  'decor-turn': () => {
    const d = S().garden?.decor.find((x) => x.id === Garden3D.selected);
    if (!d) return;
    d.rot = ((d.rot || 0) + Math.PI / 4) % (Math.PI * 2);
    Store.commit();
    Garden3D.sync();
  },
  'decor-remove': () => {
    const st = S();
    const id = Garden3D.selected;
    if (!id) return;
    st.garden.decor = st.garden.decor.filter((x) => x.id !== id);
    if (!st.deleted.includes(id)) st.deleted.push(id); // tombstone: sync merge won't bring it back
    Store.commit();
    render(true);
  },
  'customize-home': () => {
    const cur = slots();
    sheet(`<h3>Customize home</h3><p class="muted">Pick what sits around the Add idea flower.</p>
      ${SLOTS.map(([label, k]) => `<label class="field"><span class="small">${label}</span>
        <select class="inline-input" data-change="home-slot" data-slot="${k}">
          <option value="">(empty)</option>
          ${Object.entries(WIDGETS).map(([id, [name]]) => `<option value="${id}"${cur[k] === id ? ' selected' : ''}>${name}</option>`).join('')}
        </select></label>`).join('')}
      <div class="row between"><button class="btn ghost" data-action="home-slots-reset">Reset to default</button><button class="btn primary" data-action="close-sheet">Done</button></div>`);
  },
  'home-slot': (el) => {
    const s = [...slots()];
    s[+el.dataset.slot] = el.value;
    S().user.homeSlots = s;
    Store.commit();
    render(true);
  },
  'home-slots-reset': () => {
    delete S().user.homeSlots;
    Store.commit();
    render(true);
    actions['customize-home']();
  },
};
