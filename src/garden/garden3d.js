// 3D garden (Phase 7): cozy low-poly floating island in Three.js, everything built from primitives (no assets).
// One renderer for the whole session: each home render calls mount(host), which moves the canvas into
// the new host and diffs the scene against the garden. The 2D island SVG in the host stays visible
// until 3D is ready, and stays as the fallback if Three.js can't load.
// Arrange mode: drag ideas / trees / sunflowers / decor to move them (saved to state.garden, synced).
import { Store } from '../core/store.js';
import { islandPlacement, POND } from './scenes.js';
import { hash, hueOf, FLOWER } from './sprites.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const R = 5; // island radius; positions are stored as u, v = x / R, z / R
const TOP = 0.3; // grass surface height
const MAX_UV = 0.9;
const ITEM_SCALE = 1.5;

let T = null; // three.js module
let loading = null;
let g = null; // { renderer, scene, camera, root, items: Map(key → {obj, sig}), ... }
let host = null;
let arrange = false;
let onSelect = () => {};
let onNav = () => {};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- capability ----------
let capableCache = null;
export function capable() {
  if (capableCache !== null) return capableCache;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const weak = (navigator.deviceMemory && navigator.deviceMemory < 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
    capableCache = !!gl && !weak;
  } catch { capableCache = false; }
  return capableCache;
}

// ---------- materials + shared geometry ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
const PALETTE = ['--grass-1', '--grass-2', '--bed', '--bed-top', '--soil', '--seed', '--leaf', '--leaf-hi', '--stem', '--canopy', '--canopy-2', '--pond', '--cloud'];
let colors = {}, colorSig = '';
const mats = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra }));
  return mats.get(key);
}
const geos = new Map();
function geo(key, make) {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
}
const sphere = () => geo('sphere', () => new T.IcosahedronGeometry(1, 0));
const ball = () => geo('ball', () => new T.IcosahedronGeometry(1, 1));
const cyl = () => geo('cyl', () => new T.CylinderGeometry(1, 1, 1, 6));
const cone = () => geo('cone', () => new T.ConeGeometry(1, 1, 6));
const box = () => geo('box', () => new T.BoxGeometry(1, 1, 1));

function mesh(geometry, material, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], shadow = true } = {}) {
  const m = new T.Mesh(geometry, material);
  m.position.set(...p);
  m.scale.set(...(Array.isArray(s) ? s : [s, s, s]));
  m.rotation.set(...r);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
const group = (...children) => { const o = new T.Group(); children.flat().forEach((c) => c && o.add(c)); return o; };
const stem = (h, w = 0.045) => mesh(cyl(), mat(colors['--stem']), { p: [0, h / 2, 0], s: [w, h, w] });
const leaf = (y, angle, size = 0.22, tilt = 0.5) => {
  const l = mesh(sphere(), mat(colors['--leaf']), { s: [size, size * 0.22, size * 0.5] });
  l.position.set(Math.cos(angle) * size * 0.8, y, Math.sin(angle) * size * 0.8);
  l.rotation.set(0, -angle, tilt);
  return l;
};
const mound = (r = 0.32) => mesh(sphere(), mat(colors['--soil']), { p: [0, 0.02, 0], s: [r, 0.1, r], shadow: false });

// ---------- garden things ----------
function plant(stage, hue, inTerrarium) {
  const parts = [mound()];
  const sway = new T.Group();
  if (stage === 'seed') {
    sway.add(mesh(sphere(), mat(colors['--seed']), { p: [0, 0.13, 0], s: [0.09, 0.13, 0.09], r: [0, 0, 0.4] }));
  } else {
    const h = { sprout: 0.45, plant: 0.9 }[stage] || 1.15;
    sway.add(stem(h));
    const n = { sprout: 2, plant: 4 }[stage] || 4;
    for (let k = 0; k < n; k++) sway.add(leaf(h * (stage === 'sprout' ? 0.92 : 0.3 + (k / n) * 0.6), k * 2.4, stage === 'sprout' ? 0.2 : 0.26));
    if (stage === 'bloom') {
      const head = new T.Group();
      head.position.y = h + 0.04;
      head.add(mesh(sphere(), mat('#fbe3a0'), { s: [0.1, 0.07, 0.1] }));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        head.add(mesh(sphere(), mat(hue), { p: [Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], s: [0.13, 0.04, 0.08], r: [0, -a, 0.25] }));
      }
      head.rotation.x = 0.35;
      sway.add(head);
    }
  }
  sway.userData.sway = true;
  parts.push(sway);
  if (inTerrarium) {
    const h = { seed: 0.45, sprout: 0.75, plant: 1.15 }[stage] || 1.45;
    const glass = new T.MeshStandardMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, depthWrite: false });
    parts.push(mesh(geo('dome', () => new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), glass, { s: [0.48, h, 0.48], shadow: false }));
    parts.push(mesh(sphere(), mat('#cfe3ea'), { p: [0, h + 0.05, 0], s: 0.06 }));
  }
  return group(parts);
}

function tree(progress, fruits, done) {
  const size = 0.55 + (progress / 100) * 0.45;
  const trunkH = 0.9 + size * 0.6;
  const trunk = mesh(cyl(), mat('#8a6a4a'), { p: [0, trunkH / 2, 0], s: [0.12, trunkH, 0.12] });
  const canopy = new T.Group();
  canopy.position.y = trunkH + size * 0.4;
  [[0, 0, 0, 1], [-0.45, -0.15, 0.1, 0.72], [0.42, -0.1, -0.15, 0.7], [0.05, 0.4, 0.05, 0.62]].forEach(([x, y, z, s], k) => {
    canopy.add(mesh(ball(), mat(colors[k % 2 ? '--canopy-2' : '--canopy']), { p: [x * size, y * size, z * size], s: s * size * 0.8 }));
  });
  for (let k = 0; k < Math.min(8, fruits); k++) {
    const a = k * 2.4, y = -0.1 + (k % 3) * 0.25;
    canopy.add(mesh(sphere(), mat(done ? '#f5c869' : '#e0584b'), { p: [Math.cos(a) * size * 0.85, y * size, Math.sin(a) * size * 0.85], s: 0.09 }));
  }
  canopy.userData.sway = true;
  return group(mound(0.45), trunk, canopy);
}

function sunflower(progress) {
  const h = 0.9 + (progress / 100) * 0.6;
  const head = new T.Group();
  head.position.y = h;
  head.rotation.x = -0.5;
  head.add(mesh(cyl(), mat('#6b4a2b'), { s: [0.13, 0.05, 0.13], r: [Math.PI / 2, 0, 0] }));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    head.add(mesh(sphere(), mat('#f5c542'), { p: [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0], s: [0.1, 0.05, 0.03], r: [0, 0, a] }));
  }
  const sway = group(stem(h, 0.05), leaf(h * 0.45, 0.5, 0.24), leaf(h * 0.6, 3.6, 0.22), head);
  sway.userData.sway = true;
  return group(mound(0.25), sway);
}

function butterfly(color) {
  const wing = (side) => {
    const w = mesh(geo('wing', () => new T.CircleGeometry(0.16, 6)), new T.MeshStandardMaterial({ color, side: T.DoubleSide, flatShading: true }), { p: [side * 0.13, 0, 0], s: [1, 0.8, 1], r: [-Math.PI / 2, 0, 0], shadow: false });
    const pivot = new T.Group();
    pivot.add(w);
    pivot.userData.wing = side;
    return pivot;
  };
  const b = group(mesh(cyl(), mat('#3d3029'), { s: [0.025, 0.2, 0.025], r: [Math.PI / 2, 0, 0], shadow: false }), wing(-1), wing(1));
  return b;
}

const DECOR_BUILD = {
  bench: () => group(
    mesh(box(), mat('#b07a4f'), { p: [0, 0.32, 0], s: [0.9, 0.06, 0.32] }),
    mesh(box(), mat('#b07a4f'), { p: [0, 0.55, -0.15], s: [0.9, 0.22, 0.05] }),
    ...[-0.38, 0.38].map((x) => mesh(box(), mat('#7c5536'), { p: [x, 0.15, 0], s: [0.06, 0.3, 0.28] })),
  ),
  lantern: () => group(
    mesh(cyl(), mat('#4a4038'), { p: [0, 0.45, 0], s: [0.04, 0.9, 0.04] }),
    mesh(box(), mat('#ffd98a', { emissive: '#ffb347', emissiveIntensity: 0.9 }), { p: [0, 0.98, 0], s: [0.18, 0.22, 0.18] }),
    mesh(cone(), mat('#4a4038'), { p: [0, 1.15, 0], s: [0.17, 0.14, 0.17] }),
  ),
  mushroom: () => group(
    ...[[0, 0, 1], [0.22, 0.12, 0.7], [-0.18, 0.16, 0.6]].map(([x, z, s]) => group(
      mesh(cyl(), mat('#f3e7d3'), { p: [x, 0.12 * s, z], s: [0.05 * s, 0.24 * s, 0.05 * s] }),
      mesh(sphere(), mat('#e0584b'), { p: [x, 0.25 * s, z], s: [0.16 * s, 0.09 * s, 0.16 * s] }),
    )),
  ),
  rocks: () => group(
    mesh(sphere(), mat('#a7a39a'), { p: [0, 0.1, 0], s: [0.3, 0.2, 0.24], r: [0.2, 0.5, 0] }),
    mesh(sphere(), mat('#8f8b83'), { p: [0.3, 0.06, 0.12], s: [0.16, 0.12, 0.14], r: [0, 1, 0.3] }),
  ),
  bush: () => group(
    ...[[0, 0.22, 0, 0.32], [0.26, 0.16, 0.05, 0.22], [-0.24, 0.15, -0.04, 0.24]].map(([x, y, z, s], k) => mesh(ball(), mat(colors[k ? '--canopy-2' : '--canopy']), { p: [x, y, z], s })),
  ),
  fence: () => group(
    ...[-0.45, -0.15, 0.15, 0.45].map((x) => mesh(box(), mat('#c49a6c'), { p: [x, 0.25, 0], s: [0.08, 0.5, 0.06] })),
    ...[0.18, 0.38].map((y) => mesh(box(), mat('#b0855a'), { p: [0, y, 0.04], s: [1.05, 0.06, 0.03] })),
  ),
};

// ---------- island ----------
function jitter(geometry, amount, seed = 1) {
  const pos = geometry.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const r = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
    const n = (r - Math.floor(r) - 0.5) * amount;
    pos.setX(k, pos.getX(k) * (1 + n)); pos.setZ(k, pos.getZ(k) * (1 + n));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function island() {
  const top = mesh(new T.CylinderGeometry(R, R * 1.02, 0.6, 32), mat(colors['--grass-1']), { shadow: false });
  const lip = mesh(new T.CylinderGeometry(R * 1.02, R * 0.98, 0.35, 32), mat(colors['--grass-2']), { p: [0, -0.45, 0], shadow: false });
  const dirtGeo = jitter(new T.ConeGeometry(R * 0.98, 5, 14, 3), 0.18, 3);
  dirtGeo.rotateX(Math.PI);
  const dirt = mesh(dirtGeo, mat(colors['--bed']), { p: [0, -3.1, 0], shadow: false });
  const rocks = [[1.6, -1.2, 2.6, 0.5], [-2.2, -1.8, 1.4, 0.4], [0.4, -3.4, -1.2, 0.35]].map(([x, y, z, s]) => mesh(sphere(), mat(colors['--bed-top']), { p: [x, y, z], s, shadow: false }));
  const [pu, pv] = POND;
  const pond = mesh(geo('pond', () => new T.CircleGeometry(1, 10)), new T.MeshStandardMaterial({ color: colors['--pond'], roughness: 0.2, metalness: 0.1 }), { p: [pu * R, TOP + 0.01, pv * R], s: [1.25, 1.25, 0.85], r: [-Math.PI / 2, 0, 0], shadow: false });
  const tufts = [[-3.9, 1.6], [3.8, 1.9], [-1.2, 3.8], [2.4, -3.6], [-3.3, -2.2]].map(([x, z]) => mesh(cone(), mat(colors['--leaf']), { p: [x, TOP + 0.1, z], s: [0.1, 0.22, 0.1] }));
  top.receiveShadow = true;
  top.position.y = 0;
  return group(top, lip, dirt, rocks, pond, tufts);
}

function clouds() {
  return [[-4.8, 2.4, -4, 0.9], [5.2, 0.8, -1, 0.7], [-4.2, -3.2, 3.5, 0.6]].map(([x, y, z, s], k) => {
    const c = group([[0, 0, 0, 0.7], [0.6, -0.1, 0.1, 0.5], [-0.6, -0.15, 0, 0.5]].map(([a, b, d, r]) => mesh(ball(), mat(colors['--cloud']), { p: [a, b, d], s: r, shadow: false })));
    c.position.set(x, y, z);
    c.scale.setScalar(s);
    c.userData.cloud = k;
    return c;
  });
}

// ---------- scene setup ----------
function setup() {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'garden-3d';
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new T.HemisphereLight('#fff6e0', '#6b5a45', 1.6));
  const sun = new T.DirectionalLight('#fff3d6', 2.2);
  sun.position.set(-6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  const root = new T.Group();
  root.rotation.y = -0.35;
  scene.add(root);
  g = { renderer, scene, camera, root, base: null, cloudGroup: null, items: new Map(), dist: 19, raf: 0, visible: true, dirty: true, t0: performance.now() };
  wirePointer(renderer.domElement);  new ResizeObserver(() => resize()).observe(renderer.domElement);
  document.addEventListener('visibilitychange', loop);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => sync(true));
}

function placeCamera() {
  const el = 0.44;
  g.camera.position.set(0, Math.sin(el) * g.dist, Math.cos(el) * g.dist);
  g.camera.lookAt(0, -0.5, 0);
  g.dirty = true;
}

function resize() {
  const el = g.renderer.domElement;
  const w = el.parentElement?.clientWidth || 400;
  const h = Math.round(w * 0.9);
  g.renderer.setSize(w, h, false);
  el.style.width = '100%';
  el.style.height = 'auto';
  el.style.aspectRatio = `${w} / ${h}`;
  g.camera.aspect = w / h;
  g.camera.updateProjectionMatrix();
  placeCamera();
  if (g.base) g.renderer.render(g.scene, g.camera); // setSize clears the canvas: no blank frame
  loop();
}

// ---------- diff garden → scene ----------
const uvToXZ = ([u, v]) => { const r = Math.hypot(u, v), k = r > MAX_UV ? MAX_UV / r : 1; return [u * k * R, v * k * R]; };

function want(state) {
  const pl = islandPlacement(state);
  const out = [];
  pl.ideas.forEach(({ item, at }) => {
    const stage = Store.ideaStage(item);
    out.push({ key: item.id, kind: 'idea', at, nav: `#/idea/${item.id}`, label: Store.ideaTitle(item), sig: `${stage}|${item.status}`, build: () => plant(stage, hueOf(item.id), item.status === 'incubator') });
  });
  pl.projects.forEach(({ item, at }) => {
    const prog = Store.projectProgress(item), fruits = item.milestones.filter((m) => m.done).length;
    out.push({ key: item.id, kind: 'project', at, nav: `#/project/${item.id}`, label: `Project: ${item.name} (${prog}%)`, sig: `${prog}|${fruits}|${item.status}`, build: () => tree(prog, fruits, item.status === 'done') });
  });
  pl.learning.forEach(({ item, at }) => {
    const prog = Store.learningProgress(item);
    out.push({ key: item.id, kind: 'learning', at, nav: `#/learn/${item.id}`, label: `Learning: ${item.topic} (${prog}%)`, sig: `${prog}`, build: () => sunflower(prog) });
  });
  pl.decor.forEach((d) => out.push({ key: d.id, kind: 'decor', at: [d.u, d.v], rot: d.rot || 0, label: d.kind, sig: d.kind, build: () => DECOR_BUILD[d.kind]?.() || group() }));
  const anchors = Object.fromEntries(pl.ideas.map(({ item, at }) => [item.id, at]));
  state.inspirations.slice(0, 8).forEach((s) => {
    const h = hash(s.id);
    const anchor = s.ideaIds.map((id) => anchors[id]).find(Boolean) || [((h % 100) / 100 - 0.5) * 1.2, (((h >> 3) % 100) / 100 - 0.5) * 1.2];
    out.push({ key: 'b:' + s.id, kind: 'butterfly', at: anchor, nav: `#/inspiration/${s.id}`, label: `Inspiration: ${s.title || s.url}`, sig: 'b', fixed: true, phase: (h % 628) / 100, build: () => butterfly(FLOWER[(h + 2) % FLOWER.length]) });
  });
  return out;
}

function sync(force = false) {
  if (!g) return;
  const sig = PALETTE.map(css).join();
  if (sig !== colorSig || force) {
    colorSig = sig;
    colors = Object.fromEntries(PALETTE.map((n) => [n, css(n)]));
    mats.clear();
    if (g.base) g.root.remove(g.base);
    g.cloudGroup?.forEach((c) => g.scene.remove(c));
    g.base = island();
    g.root.add(g.base);
    g.cloudGroup = clouds();
    g.cloudGroup.forEach((c) => g.scene.add(c));
    g.items.forEach(({ obj }) => g.root.remove(obj));
    g.items.clear();
  }
  const next = want(Store.state);
  const keep = new Set(next.map((w) => w.key));
  g.items.forEach((it, key) => { if (!keep.has(key)) { g.root.remove(it.obj); g.items.delete(key); } });
  next.forEach((w) => {
    let it = g.items.get(w.key);
    if (!it || it.sig !== w.sig) {
      if (it) g.root.remove(it.obj);
      const obj = w.build();
      obj.traverse((o) => { o.userData.key = w.key; });
      g.root.add(obj);
      it = { obj, sig: w.sig };
      g.items.set(w.key, it);
    }
    Object.assign(it, { kind: w.kind, nav: w.nav, label: w.label, fixed: w.fixed, phase: w.phase || 0 });
    if (dragging?.key === w.key) return;
    const [x, z] = uvToXZ(w.at);
    if (w.kind === 'butterfly') it.home = [x, z];
    else { it.obj.position.set(x, TOP, z); it.obj.rotation.y = w.rot || 0; it.obj.scale.setScalar(ITEM_SCALE); }
  });
  g.dirty = true;
  loop();
}

// ---------- animation ----------
function frame(now) {
  g.raf = 0;
  const t = (now - g.t0) / 1000;
  const animate = !reduceMotion.matches;
  if (animate) {
    g.root.position.y = Math.sin(t * 0.8) * 0.08;
    g.items.forEach((it) => {
      if (it.kind === 'butterfly' && it.home) {
        const a = t * 0.7 + it.phase;
        it.obj.position.set(it.home[0] + Math.cos(a) * 0.6, TOP + 2.3 + Math.sin(t * 1.7 + it.phase) * 0.2, it.home[1] + Math.sin(a) * 0.6);
        it.obj.rotation.y = -a;
        it.obj.children.forEach((c) => { if (c.userData.wing) c.rotation.z = c.userData.wing * (0.2 + Math.abs(Math.sin(t * 9 + it.phase)) * 0.9); });
      } else {
        it.obj.children.forEach((c) => { if (c.userData.sway) c.rotation.z = Math.sin(t * 1.3 + it.obj.position.x) * 0.04; });
      }
    });
    g.cloudGroup?.forEach((c) => { c.position.x += Math.sin(t * 0.1 + c.userData.cloud) * 0.002; });
  } else {
    g.items.forEach((it) => { if (it.kind === 'butterfly' && it.home) it.obj.position.set(it.home[0] + 0.4, TOP + 2.3, it.home[1]); });
  }
  g.renderer.render(g.scene, g.camera);
  g.dirty = false;
  loop();
}

function loop() {
  if (!g || g.raf) return;
  const live = g.renderer.domElement.isConnected && document.visibilityState === 'visible' && g.visible;
  if (!live) return;
  if (reduceMotion.matches && !g.dirty) return;
  g.raf = requestAnimationFrame(frame);
}

// ---------- pointer: rotate, zoom, tap to open, drag to arrange ----------
let dragging = null;
let tip = null;
const ray = () => (g.raycaster ??= new T.Raycaster());
function pick(ev) {
  g.scene.updateMatrixWorld();
  const r = g.renderer.domElement.getBoundingClientRect();
  const ndc = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray().setFromCamera(ndc, g.camera);
  const hits = ray().intersectObjects([...g.items.values()].map((it) => it.obj), true);
  const key = hits.find((h) => h.object.userData.key)?.object.userData.key;
  return key ? { key, it: g.items.get(key) } : null;
}
function groundPoint(ev) {
  g.scene.updateMatrixWorld();
  const r = g.renderer.domElement.getBoundingClientRect();
  ray().setFromCamera(new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), g.camera);
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -(TOP + g.root.position.y));
  const p = new T.Vector3();
  if (!ray().ray.intersectPlane(plane, p)) return null;
  return g.root.worldToLocal(p);
}

function wirePointer(el) {
  const pointers = new Map();
  let start = null, pinch0 = null;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (ev) => {
    pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: g.dist }; start = null; return; }
    const hit = pick(ev);
    start = { x: ev.clientX, y: ev.clientY, rot: g.root.rotation.y, hit, moved: false };
    if (arrange && hit && !hit.it.fixed) {
      dragging = { key: hit.key, it: hit.it };
      try { el.setPointerCapture(ev.pointerId); } catch {}
      select(hit.key);
    }
  });
  el.addEventListener('pointermove', (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pinch0 && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      g.dist = Math.min(26, Math.max(12, pinch0.dist * (pinch0.d / Math.hypot(a[0] - b[0], a[1] - b[1]))));
      return placeCamera(), loop();
    }
    if (!start) return hover(ev);
    const dx = ev.clientX - start.x;
    if (!start.moved && Math.hypot(dx, ev.clientY - start.y) < 6) return;
    start.moved = true;
    if (dragging) {
      const p = groundPoint(ev);
      if (!p) return;
      const r = Math.hypot(p.x, p.z), k = r > MAX_UV * R ? (MAX_UV * R) / r : 1;
      dragging.it.obj.position.set(p.x * k, TOP + 0.15, p.z * k);
    } else if (Math.abs(dx) > Math.abs(ev.clientY - start.y) || arrange) {
      g.root.rotation.y = start.rot + dx * 0.01;
    }
    g.dirty = true;
    loop();
  });
  const end = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch0 = null;
    if (!start) return;
    const s = start;
    start = null;
    if (dragging) {
      const { key, it } = dragging;
      dragging = null;
      it.obj.position.y = TOP;
      if (s.moved) saveSpot(key, it);
      return;
    }
    if (!s.moved && ev.type === 'pointerup') {
      if (arrange) select(s.hit && !s.hit.it.fixed ? s.hit.key : null);
      else if (s.hit?.it.nav) onNav(s.hit.it.nav);
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });
  el.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey && !arrange) return; // plain scrolling keeps scrolling the page
    ev.preventDefault();
    g.dist = Math.min(26, Math.max(12, g.dist + ev.deltaY * 0.01));
    placeCamera(); loop();
  }, { passive: false });
}

function hover(ev) {
  if (ev.pointerType !== 'mouse') return;
  const hit = pick(ev);
  g.renderer.domElement.style.cursor = hit && (arrange ? !hit.it.fixed : hit.it.nav) ? (arrange ? 'grab' : 'pointer') : arrange ? 'move' : 'grab';
  if (!tip) return;
  if (!hit || arrange) { tip.hidden = true; return; }
  const r = host.getBoundingClientRect();
  tip.textContent = hit.it.label;
  tip.hidden = false;
  tip.style.left = `${ev.clientX - r.left}px`;
  tip.style.top = `${ev.clientY - r.top - 14}px`;
}

function saveSpot(key, it) {
  const st = Store.state;
  st.garden = st.garden || { layout: {}, decor: [] };
  const u = +(it.obj.position.x / R).toFixed(3), v = +(it.obj.position.z / R).toFixed(3);
  const d = st.garden.decor.find((x) => x.id === key);
  if (d) Object.assign(d, { u, v });
  else st.garden.layout[key] = [u, v];
  Store.commit();
}

let selected = null;
function select(key) {
  selected = key;
  onSelect(key && g.items.get(key)?.kind === 'decor' ? key : null, key);
  g.dirty = true;
  loop();
}

// ---------- public ----------
export const Garden3D = {
  get ready() { return !!g; },
  get arranging() { return arrange; },
  get selected() { return selected; },

  // host: element containing the 2D SVG placeholder. Returns false if 3D can't run.
  mount(el, { nav, selectChange } = {}) {
    host = el;
    if (nav) onNav = nav;
    if (selectChange) onSelect = selectChange;
    if (!capable()) return false;
    if (g) return attach(), true;
    loading ??= import(THREE_URL).then((mod) => { T = mod; setup(); }).catch((e) => { console.warn('[garden3d] falling back to 2D', e); capableCache = false; });
    loading.then(() => { if (g && host === el) attach(); });
    return true;
  },
  sync: () => sync(),
  setArrange(on) {
    arrange = on;
    if (!on) select(null);
    if (g) g.renderer.domElement.classList.toggle('arranging', on);
  },
  resetView() { if (!g) return; g.root.rotation.y = -0.35; g.dist = 19; placeCamera(); loop(); },
  visible(on) { if (g) { g.visible = on; loop(); } },
};

function attach() {
  const el = g.renderer.domElement;
  if (el.parentElement !== host) host.prepend(el);
  host.classList.add('is-3d');
  tip = host.querySelector('.g3d-tip');
  g.renderer.domElement.classList.toggle('arranging', arrange);
  // one observer that follows the current host (old hosts are thrown away on every render)
  g.io ??= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.target === host) Garden3D.visible(e.isIntersecting); }));
  g.io.disconnect();
  g.io.observe(host);
  resize();
  sync();
}
