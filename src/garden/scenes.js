// Home garden scenes. Both place the same sprites on a pseudo-3D surface, drawn back→front.
// island = floating island (default), box = wooden planter box (from the user's sketch).
import { Store } from '../core/store.js';
import { hash, esc, FLOWER, hueOf, plant, cloche, tree, sunflower, butterfly, tuft, tinyFlower } from './sprites.js';

const SQ = 0.866;

function sceneItems(state) {
  const ideas = state.ideas.filter((i) => ['fresh', 'incubator'].includes(i.status))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return {
    ideas,
    projects: state.projects.filter((p) => p.status !== 'archived').slice(0, 3),
    learning: state.learning.slice(0, 4),
  };
}

// stable spot per idea from a list of free points (same probing as the meadow)
function placeIdeas(ideas, spots) {
  const shown = ideas.slice(-spots.length);
  const taken = new Set();
  const pos = {};
  shown.forEach((idea) => {
    let k = hash(idea.id) % spots.length;
    while (taken.has(k)) k = (k + 1) % spots.length;
    taken.add(k);
    pos[idea.id] = spots[k];
  });
  return { shown, pos };
}

// sprites: [{x, y, depth, svg}] sorted back→front
function drawSprites(items) {
  return items.sort((a, b) => a.y - b.y).map((it) => it.svg).join('');
}

function spritesFor(state, { ideas, projects, learning }, spot, { treeSpots, sunSpots, ideaSpots, scale = 1, treeScale = 0.62 }) {
  const out = [];
  const { shown, pos } = placeIdeas(ideas, ideaSpots);
  const fresh = Date.now() - 6000;
  shown.forEach((idea) => {
    const p = spot(pos[idea.id]);
    const stage = Store.ideaStage(idea);
    const isNew = new Date(idea.createdAt).getTime() > fresh;
    out.push({ y: p.y, svg: `<g class="item${isNew ? ' pop' : ''}" data-nav="#/idea/${idea.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(scale * p.d).toFixed(2)})" tabindex="0">
      <title>${esc(Store.ideaTitle(idea))} · ${Store.STAGE_LABEL[stage]}${idea.status === 'incubator' ? ' · in the terrarium' : ''}</title>
      <rect x="-20" y="-66" width="40" height="72" fill="transparent"/>${plant(stage, hueOf(idea.id))}${idea.status === 'incubator' ? cloche(stage) : ''}</g>` });
  });
  projects.forEach((pr, k) => {
    const p = spot(treeSpots[k]);
    const prog = Store.projectProgress(pr);
    out.push({ y: p.y, svg: `<g class="item" data-nav="#/project/${pr.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(treeScale * p.d).toFixed(2)})" tabindex="0">
      <title>Project: ${esc(pr.name)} (${prog}%)</title>${tree(prog, pr.milestones.filter((m) => m.done).length, pr.status === 'done')}</g>` });
  });
  learning.forEach((l, k) => {
    const p = spot(sunSpots[k]);
    out.push({ y: p.y, svg: `<g class="item" data-nav="#/learn/${l.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(scale * 0.85 * p.d).toFixed(2)})" tabindex="0">
      <title>Learning: ${esc(l.topic)} (${Store.learningProgress(l)}%)</title>${sunflower(Store.learningProgress(l))}</g>` });
  });
  let sprites = drawSprites(out);
  state.inspirations.slice(0, 8).forEach((s, k) => {
    const anchor = s.ideaIds.map((id) => pos[id]).find(Boolean);
    const h = hash(s.id);
    const base = anchor ? spot(anchor) : { x: 80 + (h % 240), y: 120 + (h % 60), d: 1 };
    const x = base.x + ((h % 24) - 12), y = base.y - (anchor ? 70 + (h % 14) : 0) * scale;
    sprites += `<g class="item" data-nav="#/inspiration/${s.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})" style="animation-delay:${(k * 0.7).toFixed(1)}s" tabindex="0">
      <title>Inspiration: ${esc(s.title || s.url)}</title>${butterfly(FLOWER[(h + 2) % FLOWER.length])}</g>`;
  });
  return { sprites, shown };
}

const isoDefs = `<defs>
  <radialGradient id="canopyShade" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="var(--canopy-hi)"/><stop offset=".6" stop-color="var(--canopy)"/><stop offset="1" stop-color="var(--canopy-2)"/></radialGradient>
  <linearGradient id="isoSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-1)"/><stop offset="1" stop-color="var(--bg)"/></linearGradient>
  <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bed-top)"/><stop offset="1" stop-color="var(--bed)"/></linearGradient>
  <radialGradient id="grassTop" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="var(--grass-1)"/><stop offset="1" stop-color="var(--grass-2)"/></radialGradient>
</defs>`;

const emptyHint = (x, y) => `<g class="item empty-seed" data-action="capture" transform="translate(${x} ${y})" tabindex="0">
  <circle r="24" fill="var(--surface)" fill-opacity=".55" stroke="var(--ink-soft)" stroke-dasharray="5 5"/>
  <text y="7" text-anchor="middle" font-size="20" fill="var(--ink-soft)">+</text>
  <text y="-32" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">Plant your first seed</text></g>`;

// B: wooden raised planter box (the user's sketch)
export function renderBox(state) {
  const W = 400, H = 360, N = 6, s = 29, h = 44, cx = 200, cy = 150;
  const iso = (x, y, z = 0) => ({ x: cx + (x - y) * SQ * s, y: cy + (x + y) * 0.5 * s - z });
  const pt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;
  const items = sceneItems(state);
  const reserved = ['0,0', '2,0', '0,2', '5,0', '5,1', '4,0', '5,2', '1,0', '0,1'];
  const ideaSpots = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!reserved.includes(`${i},${j}`)) ideaSpots.push([i + 0.5, j + 0.5]);
  const spot = ([x, y]) => { const p = iso(x, y, h - 2); return { ...p, d: 0.82 + 0.18 * ((x + y) / (2 * N)) }; };
  const { sprites, shown } = spritesFor(state, items, spot, {
    treeSpots: [[0.9, 0.9], [2.6, 0.7], [0.7, 2.6]], sunSpots: [[5.5, 0.5], [5.5, 1.5], [4.5, 0.5], [5.5, 2.5]], ideaSpots, scale: 1.15, treeScale: 0.82,
  });
  const plank = (a, b, c, d, t) => { const p = (u, v) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t }); return `<line x1="${p(a, d).x}" y1="${p(a, d).y}" x2="${p(b, c).x}" y2="${p(b, c).y}" stroke="#000" stroke-opacity=".12" stroke-width="1.2"/>`; };
  const R0 = iso(N, 0, 0), F0 = iso(N, N, 0), L0 = iso(0, N, 0), Rh = iso(N, 0, h), Fh = iso(N, N, h), Lh = iso(0, N, h), Bh = iso(0, 0, h);
  const inset = 0.28;
  const soil = [iso(inset, inset, h - 3), iso(N - inset, inset, h - 3), iso(N - inset, N - inset, h - 3), iso(inset, N - inset, h - 3)];
  return `<svg viewBox="0 0 ${W} ${H}" class="garden-svg iso-scene" role="img" aria-label="Your idea garden in a planter box">${isoDefs}
    <ellipse cx="${cx}" cy="${F0.y - 8}" rx="${N * s * SQ * 1.15}" ry="26" fill="var(--shadow-c)"/>
    ${poly([R0, F0, Fh, Rh], 'var(--box-right)')}${poly([L0, F0, Fh, Lh], 'var(--box-left)')}
    ${plank(R0, F0, Fh, Rh, 0.5)}${plank(L0, F0, Fh, Lh, 0.5)}
    <line x1="${F0.x}" y1="${F0.y}" x2="${Fh.x}" y2="${Fh.y}" stroke="#000" stroke-opacity=".12"/>
    ${poly([Bh, Rh, Fh, Lh], 'var(--box-rim)')}
    ${poly(soil, 'url(#dirt)')}
    ${[[1.2, 4.3], [3.4, 2.2], [4.6, 4.8], [2.2, 5.1]].map(([x, y]) => { const p = iso(x, y, h - 3); return `<ellipse cx="${p.x}" cy="${p.y}" rx="3.5" ry="1.8" fill="#fff" opacity=".14"/>`; }).join('')}
    ${sprites}
    ${!shown.length && !items.projects.length ? emptyHint(cx, iso(3, 3, h).y) : ''}
  </svg>`;
}

// C: floating island
export function renderIsland(state) {
  const W = 400, H = 360, cx = 200, cy = 175, rx = 168, ry = 76;
  const items = sceneItems(state);
  const pond = [-0.55, 0.32];
  const reservedPts = [[-0.42, -0.42], [0.32, -0.55], [0.02, -0.72], [0.74, -0.16], [0.8, 0.12], [0.62, -0.42], [0.7, 0.36], pond];
  const ideaSpots = [];
  for (let k = 0; k < 60 && ideaSpots.length < 26; k++) { // golden-angle spiral, skip reserved areas
    const r = Math.sqrt((k + 0.5) / 60) * 0.86, a = k * 2.39996;
    const u = r * Math.cos(a), v = r * Math.sin(a);
    if (reservedPts.some(([x, y]) => Math.hypot(x - u, (y - v) * 1.2) < 0.2)) continue;
    ideaSpots.push([u, v]);
  }
  const spot = ([u, v]) => ({ x: cx + u * rx * 0.92, y: cy + v * ry * 0.92, d: 0.84 + 0.16 * ((v + 1) / 2) });
  const { sprites, shown } = spritesFor(state, items, spot, {
    treeSpots: reservedPts.slice(0, 3), sunSpots: reservedPts.slice(3, 7), ideaSpots, scale: 1.1, treeScale: 0.8,
  });
  const p = spot(pond);
  return `<svg viewBox="0 0 ${W} ${H}" class="garden-svg iso-scene" role="img" aria-label="Your idea garden on a floating island">${isoDefs}
    <g class="cloud"><ellipse cx="70" cy="300" rx="34" ry="10" fill="var(--cloud)"/><circle cx="62" cy="292" r="12" fill="var(--cloud)"/></g>
    <g class="island">
      <path d="M${cx - rx} ${cy} C ${cx - rx + 10} ${cy + 70}, ${cx - 70} ${cy + 110}, ${cx - 30} ${cy + 150} Q ${cx} ${cy + 175} ${cx + 22} ${cy + 140} C ${cx + 70} ${cy + 108}, ${cx + rx - 6} ${cy + 66}, ${cx + rx} ${cy} Z" fill="url(#dirt)"/>
      <path d="M${cx - rx + 18} ${cy + 34} Q ${cx - 40} ${cy + 58} ${cx + 30} ${cy + 48} T ${cx + rx - 24} ${cy + 30}" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>
      <path d="M${cx - 92} ${cy + 82} Q ${cx - 10} ${cy + 100} ${cx + 70} ${cy + 80}" stroke="#000" stroke-opacity=".1" stroke-width="2" fill="none"/>
      <ellipse cx="${cx - 60}" cy="${cy + 60}" rx="9" ry="5" fill="#fff" opacity=".12"/><ellipse cx="${cx + 50}" cy="${cy + 92}" rx="7" ry="4" fill="#fff" opacity=".1"/>
      <ellipse cx="${cx}" cy="${cy + 9}" rx="${rx}" ry="${ry}" fill="var(--grass-2)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#grassTop)"/>
      <ellipse cx="${p.x}" cy="${p.y}" rx="30" ry="12" fill="var(--pond)"/><ellipse cx="${p.x - 8}" cy="${p.y - 3}" rx="10" ry="3" fill="#fff" opacity=".45"/>
      ${tuft(cx - 120, cy + 30)}${tuft(cx + 120, cy + 34)}${tinyFlower(cx - 20, cy + 62, FLOWER[0])}${tinyFlower(cx + 64, cy + 56, FLOWER[3])}
      ${sprites}
      ${!shown.length && !items.projects.length ? emptyHint(cx, cy + 20) : ''}
    </g>
  </svg>`;
}

