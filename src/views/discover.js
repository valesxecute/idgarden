// Discover tab (curated credible sources, data/discover.json) + inspiration detail page.
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { Discover } from '../data/discover.js';
import { INTERESTS, interest } from '../data/interests.js';
import { S, esc, short, ago, typeIcon, typeLabel, STAGE_ICON } from '../ui/util.js';
import { toast, sheet, closeSheet, notFound, ask } from '../ui/components.js';
import { render, go } from '../ui/router.js';
import { ui } from '../ui/state.js';
import { openConnections } from './capture.js';

const daySeed = () => Math.floor(Date.now() / Store.DAY);
const shuffle = (arr, seed) => arr.map((x, k) => [x, ((seed + 1) * 9301 + k * 49297) % 233280]).sort((a, b) => a[1] - b[1]).map(([x]) => x);
// at most 2 per source up front, so one prolific feed can't take over
function diverse(list) {
  const per = {};
  const first = [], rest = [];
  list.forEach((d) => ((per[d.source] = (per[d.source] || 0) + 1) <= 2 ? first : rest).push(d));
  return first.concat(rest);
}

// research search phrases for live OpenAlex refresh: your interests + what your ideas are about
const INTEREST_QUERY = { science: 'science', health: 'public health', psychology: 'psychology', tech: 'artificial intelligence', design: 'design', architecture: 'architecture', business: 'innovation', education: 'learning education', culture: 'culture society', writing: 'literature', food: 'nutrition' };
function refreshQueries() {
  const st = S();
  const fromIdeas = st.ideas.filter((i) => ['fresh', 'incubator', 'project'].includes(i.status)).slice(0, 3)
    .map((i) => AI.keywords([i.title, i.content].join(' '), 2).join(' ')).filter(Boolean);
  const fromInterests = st.user.interests.map((g) => INTEREST_QUERY[g]).filter(Boolean);
  return [...new Set([...fromIdeas, ...shuffle(fromInterests, Date.now() % 9973)])].slice(0, 5);
}

function discoverCard(d) {
  const saved = S().inspirations.some((s) => s.url === d.url);
  const g = interest(d.group);
  return `<div class="card disc${Discover.newIds.has(d.id) ? ' is-new' : ''}">
    ${Discover.newIds.has(d.id) ? '<span class="pill new">✨ New</span>' : ''}
    <p class="eyebrow">${g ? g.emoji + ' ' + g.label : esc(d.group)} · ${esc(d.source)}${d.date ? ' · ' + ago(d.date) : ''}</p>
    ${d.kind === 'research' ? '<span class="pill research">🔬 Journal article</span>' : ''}
    <h4><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a></h4>
    ${d.excerpt ? `<p class="muted small">${esc(short(d.excerpt, 200))}</p>` : ''}
    ${saved ? '<span class="muted small">🦋 Saved</span>' : `<button class="btn sm" data-action="save-discover" data-id="${d.id}">🦋 Save</button>`}</div>`;
}

function pickItems(tab, ints) {
  const all = Discover.items;
  const mineGroups = ints.length ? ints : INTERESTS.map((i) => i.id).filter((g) => g !== 'news');
  if (tab === 'foryou') {
    // mostly your interests, ~1 in 4 from elsewhere: diversity over filter bubbles
    const a = Discover.freshFirst(diverse(all.filter((d) => mineGroups.includes(d.group))));
    const b = Discover.freshFirst(shuffle(all.filter((d) => !mineGroups.includes(d.group) && d.group !== 'news'), daySeed()));
    const out = [];
    while (a.length || b.length) {
      if (out.length % 4 === 3 && b.length) out.push(b.shift()); else if (a.length) out.push(a.shift()); else out.push(b.shift());
    }
    return out;
  }
  if (tab === 'different') return Discover.freshFirst(diverse(shuffle(all.filter((d) => !mineGroups.includes(d.group) && d.group !== 'news'), daySeed())));
  if (tab === 'browse') return Discover.freshFirst(diverse(ui.discoverGroup === 'all' ? all : all.filter((d) => d.group === ui.discoverGroup)));
  const p = Store.activeProjects().main;
  return all.map((d) => ({ d, s: AI.similarity([p.name, p.goal, p.description].join(' '), Discover.text(d)).score }))
    .filter((x) => x.s >= 2).sort((x, y) => y.s - x.s).map((x) => x.d);
}

function sourcesNote() {
  if (!Discover.sources.length) return '';
  const byGroup = {};
  Discover.sources.forEach((s) => { (byGroup[s.group] = byGroup[s.group] || []).push(s.name); });
  return `<details class="sources"><summary>Where this comes from · ${Discover.sources.length} sources · updated ${ago(Discover.generatedAt)}</summary>
    ${Object.entries(byGroup).map(([g, names]) => `<p><strong>${interest(g)?.label || g}:</strong> ${names.map(esc).join(', ')}</p>`).join('')}
    <p class="muted small">Refreshed daily. We show the title and a short excerpt and link to the original.</p></details>`;
}

function viewDiscover() {
  const st = S();
  const ints = st.user.interests;
  const main = Store.activeProjects().main;
  const tabs = [['foryou', 'For you'], ['different', 'Something different'], ...(main ? [['project', 'For your project']] : []), ['browse', 'Browse'], ['saved', `My inspirations (${st.inspirations.length})`]];
  if (!tabs.some(([k]) => k === ui.discoverTab)) ui.discoverTab = 'foryou';
  const tab = ui.discoverTab;
  let body;
  if (tab === 'saved') {
    body = st.inspirations.length ? `<div class="list">${st.inspirations.map((s) => `<a class="card idea-card" href="#/inspiration/${s.id}"><span class="stage-ic">${typeIcon(s.type)}</span><div class="idea-card-body"><p class="idea-text">${esc(s.title)}</p>
      <p class="meta"><span>${ago(s.createdAt)}</span>${s.caught ? '<span>✍️ reflected</span>' : '<span class="muted">reflect later</span>'}${s.ideaIds.length ? `<span>🔗 ${s.ideaIds.length}</span>` : ''}</p></div></a>`).join('')}</div>`
      : '<div class="empty-state"><p>Your inspiration bank is empty. Save articles, papers, videos, books, anything. You can reflect on them later.</p></div>';
  } else if (Discover.status !== 'ready') {
    body = `<div class="empty-state"><p>${Discover.status === 'error' ? 'Couldn’t load Discover right now. Check your connection and try again.' : 'Gathering fresh reads…'}</p></div>`;
  } else {
    const items = pickItems(tab, ints);
    ui.discoverShown = items.slice(0, ui.discoverLimit).map((d) => d.id);
    body = `
      ${tab === 'different' ? '<p class="muted">Outside your usual interests, on purpose. Good ideas often come from unexpected places.</p>' : ''}
      ${tab === 'project' ? `<p class="muted">Picked for <strong>${esc(main.name)}</strong>.</p>` : ''}
      ${tab === 'browse' ? `<div class="chips group-chips"><button class="chip${ui.discoverGroup === 'all' ? ' on' : ''}" data-action="disc-group" data-group="all">All</button>${INTERESTS.map((i) => `<button class="chip${ui.discoverGroup === i.id ? ' on' : ''}" data-action="disc-group" data-group="${i.id}">${i.emoji} ${i.label}</button>`).join('')}</div>` : ''}
      ${items.length ? `<div class="disc-grid">${items.slice(0, ui.discoverLimit).map(discoverCard).join('')}</div>` : '<div class="empty-state"><p>Nothing here yet.</p></div>'}
      ${items.length > ui.discoverLimit ? '<div class="row center"><button class="btn" data-action="disc-more">Show more</button></div>' : '<p class="fine center">That’s everything for now. Discover has an end on purpose.</p>'}
      ${sourcesNote()}`;
  }
  return `
    <header class="page-head"><h1>Discover</h1>
      ${tab !== 'saved' ? `<div class="refresh-wrap"><span class="muted small">${Discover.lastRefresh ? 'refreshed ' + ago(Discover.lastRefresh).replace('today', 'just now') : Discover.generatedAt ? 'updated ' + ago(Discover.generatedAt) : ''}</span>
        <button class="btn${Discover.refreshing ? ' spinning' : ''}" data-action="disc-refresh" ${Discover.refreshing ? 'disabled' : ''}>↻ ${Discover.refreshing ? 'Finding new reads…' : 'Refresh'}</button></div>` : ''}</header>
    <div class="seg">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-action="disc-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${tab === 'foryou' || tab === 'different' ? `<details class="interest-edit"><summary>Your interests: ${ints.length ? ints.map((x) => interest(x)?.label).filter(Boolean).join(', ') : 'none picked (showing everything)'}</summary>
      <div class="chips">${INTERESTS.map((i) => `<button class="chip${ints.includes(i.id) ? ' on' : ''}" data-action="toggle-interest" data-id="${i.id}">${i.emoji} ${i.label}</button>`).join('')}</div></details>` : ''}
    ${body}`;
}

function viewInspiration({ a: id }) {
  const s = Store.inspiration(id);
  if (!s) return notFound();
  const ideas = s.ideaIds.map(Store.idea).filter(Boolean);
  const projects = s.projectIds.map(Store.project).filter(Boolean);
  const projSug = AI.projectsForInspiration(s);
  return `
    <a class="back" href="#/discover" data-action="disc-tab" data-tab="saved">← Inspirations</a>
    <article class="idea-detail">
      <p class="eyebrow">${typeIcon(s.type)} ${esc(typeLabel(s.type))} · saved ${ago(s.createdAt)}</p>
      <input class="title-input" value="${esc(s.title)}" data-bind="insp:${s.id}:title">
      ${s.url ? `<a class="url" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)} ↗</a>` : ''}
      <section class="field"><label>What caught your attention?</label><textarea rows="2" data-bind="insp:${s.id}:caught" data-grow placeholder="Optional">${esc(s.caught)}</textarea></section>
      <section class="field"><label>What could you apply it to?</label><textarea rows="2" data-bind="insp:${s.id}:apply" data-grow placeholder="Optional">${esc(s.apply)}</textarea></section>
      <section class="field"><label>Notes</label><textarea rows="2" data-bind="insp:${s.id}:note" data-grow placeholder="Optional">${esc(s.note)}</textarea></section>
      <section class="field"><label>Connected ideas</label>
        ${ideas.map((x) => `<div class="link-row"><a href="#/idea/${x.id}">${STAGE_ICON[Store.ideaStage(x)]} ${esc(Store.ideaTitle(x))}</a><button class="x" data-action="disconnect-insp" data-insp="${s.id}" data-idea="${x.id}" aria-label="Disconnect">×</button></div>`).join('')}
        ${AI.ideasForInspiration(s).slice(0, 3).map((r) => `<div class="link-row suggest"><span>✨ ${esc(Store.ideaTitle(r.item))} <em class="muted small">${AI.reason(r)}</em></span><button class="btn sm" data-action="connect-insp" data-insp="${s.id}" data-idea="${r.item.id}">Connect</button></div>`).join('')}
        <select class="inline-input" data-change="connect-insp-select" data-insp="${s.id}"><option value="">+ Connect to an idea…</option>${S().ideas.filter((x) => x.status !== 'archived' && !s.ideaIds.includes(x.id)).map((x) => `<option value="${x.id}">${esc(Store.ideaTitle(x))}</option>`).join('')}</select></section>
      <section class="field"><label>Projects</label>
        ${projects.map((p) => `<div class="link-row"><a href="#/project/${p.id}">🌳 ${esc(p.name)}</a></div>`).join('')}
        ${projSug.map((r) => `<div class="link-row suggest"><span>✨ 🌳 ${esc(r.item.name)} <em class="muted small">${AI.reason(r)}</em></span><button class="btn sm" data-action="connect-insp-proj" data-insp="${s.id}" data-p="${r.item.id}">Connect</button></div>`).join('')}
        ${!projects.length && !projSug.length ? '<p class="muted small">Not connected to a project.</p>' : ''}</section>
      <div class="danger-row"><button class="btn sm ghost danger" data-action="delete-insp" data-id="${s.id}">Delete inspiration</button></div>
    </article>`;
}

const saveItem = (d) => Store.addInspiration({ url: d.url, title: d.title, type: Discover.inspirationType(d), note: d.excerpt ? `${d.source}: ${d.excerpt}` : d.source });

export const views = { discover: viewDiscover, inspiration: viewInspiration };

export const actions = {
  'disc-tab': (el, ev) => { ev?.preventDefault(); ui.discoverTab = el.dataset.tab; ui.discoverLimit = 12; go('#/discover'); },
  'disc-group': (el) => { ui.discoverGroup = el.dataset.group; ui.discoverLimit = 12; render(true); },
  'disc-more': () => { ui.discoverLimit += 12; render(true); },
  'disc-refresh': async () => {
    Discover.markSeen(ui.discoverShown || []);
    const pending = Discover.refresh(refreshQueries());
    render(true);
    const added = await pending;
    ui.discoverLimit = 12;
    render();
    window.scrollTo(0, 0);
    toast(added ? `✨ ${added} new read${added > 1 ? 's' : ''} found. Showing a fresh batch.` : '🌿 Nothing new published yet. Here’s a fresh batch you haven’t seen.');
  },
  'toggle-interest': (el) => {
    const u = S().user;
    u.interests = u.interests.includes(el.dataset.id) ? u.interests.filter((x) => x !== el.dataset.id) : [...u.interests, el.dataset.id];
    Store.commit();
    render(true);
  },
  'save-discover': (el) => {
    const d = Discover.byId(el.dataset.id);
    const insp = saveItem(d);
    render(true);
    sheet(`<h3>🦋 Saved</h3><p><strong>${esc(d.title)}</strong></p><p class="muted">Want to note why? It’s optional. You can do it later.</p>
      <textarea class="inline-input" id="r-caught" rows="2" placeholder="What caught your attention?" data-autofocus></textarea>
      <textarea class="inline-input" id="r-apply" rows="2" placeholder="What could you apply it to?"></textarea>
      <div class="row end"><button class="btn ghost" data-action="reflect-skip" data-id="${insp.id}">Later</button><button class="btn primary" data-action="reflect-save" data-id="${insp.id}">Save reflection</button></div>`);
  },
  'save-discover-connect': (el) => {
    const insp = saveItem(Discover.byId(el.dataset.id));
    Store.connectInspiration(insp.id, el.dataset.idea);
    if (el.dataset.key) Store.dismiss(el.dataset.key);
    render(true);
    toast('🦋 Saved and connected. The idea grew a little.');
  },
  'reflect-save': (el) => {
    const insp = Store.updateInspiration(el.dataset.id, { caught: document.querySelector('#r-caught').value.trim(), apply: document.querySelector('#r-apply').value.trim() });
    closeSheet();
    if (!openConnections(insp)) toast('🦋 Reflection saved.');
  },
  'reflect-skip': (el) => { closeSheet(); openConnections(Store.inspiration(el.dataset.id)); },
  'connect-insp-select': (el) => { if (el.value) { Store.connectInspiration(el.dataset.insp, el.value); render(true); } },
  'disconnect-insp': (el) => { Store.disconnectInspiration(el.dataset.insp, el.dataset.idea); render(true); },
  'delete-insp': async (el) => { if (await ask('Delete this inspiration?', { yes: 'Delete', danger: true })) { Store.deleteInspiration(el.dataset.id); ui.discoverTab = 'saved'; go('#/discover'); } },
};
