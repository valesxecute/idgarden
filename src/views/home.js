// Home (Garden tab): current project · Add idea · last inspiration / side projects · learning / 3D scene.
import { Store } from '../core/store.js';
import { renderIsland, renderBox } from '../garden/scenes.js';
import { S, esc, short, bar, ago, typeIcon } from '../ui/util.js';
import { icon } from '../ui/icons.js';

export const GARDEN_STYLES = [['island', '🏝️ Floating island'], ['box', '🪴 Planter box']];
export const gardenStyle = () => (GARDEN_STYLES.some(([k]) => k === S().user.gardenStyle) ? S().user.gardenStyle : 'island');

function currentProject(main) {
  if (!main) return `<a class="card mini empty" href="#/ideas/incubator"><p class="eyebrow">🌳 Current project</p><h4>None yet</h4><p class="muted small">Grow one from the terrarium.</p></a>`;
  return `<a class="card mini" href="#/project/${main.id}"><p class="eyebrow">🌳 Current project</p><h4>${esc(short(main.name, 40))}</h4>
    ${bar(Store.projectProgress(main))}<p class="muted small">${Store.projectProgress(main)}%</p></a>`;
}

function lastInspiration(insp) {
  if (!insp) return `<a class="card mini empty" href="#/discover"><p class="eyebrow">🦋 Last inspiration</p><h4>Nothing yet</h4><p class="muted small">Save what inspires you.</p></a>`;
  return `<a class="card mini" href="#/inspiration/${insp.id}"><p class="eyebrow">🦋 Last inspiration</p><h4>${typeIcon(insp.type)} ${esc(short(insp.title, 44))}</h4><p class="muted small">Saved ${ago(insp.createdAt)}</p></a>`;
}

function sideProjects(side) {
  const rows = side.slice(0, 3).map((p) => `<a class="mini-row" href="#/project/${p.id}"><span>🌱 ${esc(short(p.name, 30))}</span><span class="muted small">${Store.projectProgress(p)}%</span></a>`).join('');
  return `<div class="card mini list-mini"><p class="eyebrow">🌿 Side projects</p>
    ${rows || '<p class="muted small">None. Any project can be a side project.</p>'}
    ${side.length > 3 ? `<a class="mini-more" href="#/projects">+${side.length - 3} more</a>` : ''}</div>`;
}

function learning(goals) {
  const rows = goals.slice(0, 3).map((l) => `<a class="mini-row" href="#/learn/${l.id}"><span>🌻 ${esc(short(l.topic, 30))}</span><span class="muted small">${Store.learningProgress(l)}%</span></a>`).join('');
  return `<div class="card mini list-mini"><p class="eyebrow">🌻 Learning</p>
    ${rows || '<p class="muted small">Track a topic, book or course here.</p>'}
    ${goals.length > 3 ? `<a class="mini-more" href="#/learn">+${goals.length - 3} more</a>` : ''}</div>`;
}

export function viewHome() {
  const st = S();
  const { main, side } = Store.activeProjects();
  return `
    <section class="home-top">
      ${currentProject(main)}
      <button class="add-flower" data-action="capture" aria-label="Add idea">${icon('flower')}<span>Add idea</span></button>
      ${lastInspiration(st.inspirations[0])}
    </section>
    <section class="home-row">${sideProjects(side)}${learning(st.learning)}</section>
    <section class="scene-wrap">${gardenStyle() === 'box' ? renderBox(st) : renderIsland(st)}</section>`;
}

export const views = { '': viewHome };
