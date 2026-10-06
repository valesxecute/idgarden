// Learn tab: learning goals (milestones, resources, notes, project links). New goal via the 🌻 add button.
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { S, $, esc, bar, typeIcon, guessTitle } from '../ui/util.js';
import { sheet, closeSheet, toast, notFound, ask } from '../ui/components.js';
import { render, go } from '../ui/router.js';

const STARTER = ['Get the basics: one intro resource', 'Practice: a small exercise', 'Make something with it', 'Explain it to someone'];

function viewLearn({ a: id }) {
  if (id) return viewLearnDetail(id);
  const goals = S().learning;
  return `
    <header class="page-head"><h1>Learn</h1></header>
    <p class="lead">Things you’re learning: topics, books, courses. Each one is a small project of its own.</p>
    ${goals.length ? `<div class="list">${goals.map((l) => `<a class="card proj-card" href="#/learn/${l.id}"><h4>🌻 ${esc(l.topic)}</h4>${l.goal ? `<p class="muted small">${esc(l.goal)}</p>` : ''}${bar(Store.learningProgress(l))}
      <p class="muted small">${l.milestones.filter((m) => m.done).length}/${l.milestones.length} milestones · ${l.resources.filter((r) => r.done).length}/${l.resources.length} resources</p></a>`).join('')}</div>`
      : '<div class="empty-state"><p>Nothing yet. Tap 🌻 to plant your first learning goal.</p></div>'}`;
}

function viewLearnDetail(id) {
  const l = Store.learning(id);
  if (!l) return notFound();
  const projects = S().projects;
  const relInsp = AI.inspirationsForLearning(l, { min: 1 }).filter((r) => !l.resources.some((x) => x.url && x.url === r.item.url));
  const check = (kind, x, label) => `<label class="task"><input type="checkbox" ${x.done ? 'checked' : ''} data-action="learn-toggle" data-id="${l.id}" data-kind="${kind}" data-x="${x.id}"> <span>${label}</span></label>`;
  return `
    <a class="back" href="#/learn">← Learn</a>
    <article class="idea-detail">
      <p class="eyebrow">🌻 Learning goal</p>
      <input class="title-input" value="${esc(l.topic)}" data-bind="learn:${l.id}:topic">
      <input class="inline-input" placeholder="Goal (optional)" value="${esc(l.goal)}" data-bind="learn:${l.id}:goal">
      <div class="progress-big">${bar(Store.learningProgress(l))}<span>${Store.learningProgress(l)}%</span></div>
      <section class="field"><label>Milestones</label>
        ${l.milestones.map((m) => check('milestones', m, esc(m.name))).join('')}
        <input class="inline-input" placeholder="+ Add a milestone" data-enter="learn-add-ms" data-id="${l.id}"></section>
      <section class="field"><label>Resources</label>
        ${l.resources.map((r) => check('resources', r, `${typeIcon(r.type)} ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>` : esc(r.title)}`)).join('')}
        <input class="inline-input" placeholder="+ Add a resource: paste a link or type a title" data-enter="learn-add-res" data-id="${l.id}">
        ${relInsp.length ? `<p class="muted small">✨ From your inspirations:</p>${relInsp.map((r) => `<div class="link-row suggest"><span>${typeIcon(r.item.type)} ${esc(r.item.title)}</span><button class="btn sm" data-action="learn-from-insp" data-id="${l.id}" data-insp="${r.item.id}">Add</button></div>`).join('')}` : ''}</section>
      <section class="field"><label>Notes & questions</label><textarea rows="4" data-bind="learn:${l.id}:notes" data-grow placeholder="What you’re understanding, what’s still confusing…">${esc(l.notes)}</textarea></section>
      <section class="field"><label>Supports projects</label>
        ${projects.length ? projects.map((p) => `<label class="task"><input type="checkbox" ${l.projectIds.includes(p.id) ? 'checked' : ''} data-action="learn-proj" data-id="${l.id}" data-p="${p.id}"> <span>🌳 ${esc(p.name)}</span></label>`).join('') : '<p class="muted small">No projects yet.</p>'}</section>
      <div class="danger-row"><button class="btn sm ghost danger" data-action="delete-learning" data-id="${l.id}">Delete learning goal</button></div>
    </article>`;
}

function addLearning() {
  const topic = $('#new-learn').value.trim();
  if (!topic) return $('#new-learn').focus();
  const ms = $('#new-learn-ai').checked ? STARTER : [];
  const l = Store.addLearning({ topic, goal: $('#new-learn-goal').value.trim(), milestones: ms.map((name) => ({ id: Store.uid(), name, done: false })) });
  closeSheet();
  go(`#/learn/${l.id}`);
}

export const views = { learn: viewLearn };

export const actions = {
  'new-learning': () => sheet(`<h3>Plant a sunflower 🌻</h3>
    <input class="inline-input big" id="new-learn" placeholder="What do you want to learn? e.g. Product design" data-enter="add-learning" data-autofocus>
    <input class="inline-input" id="new-learn-goal" placeholder="Why / goal (optional), e.g. design my own app" data-enter="add-learning">
    <label class="check"><input type="checkbox" id="new-learn-ai" checked> ✨ Suggest starter milestones</label>
    <div class="row end"><button class="btn ghost" data-action="close-sheet">Cancel</button><button class="btn primary" data-action="add-learning">Plant it</button></div>`),
  'add-learning': addLearning,
  'learn-toggle': (el) => {
    const l = Store.learning(el.dataset.id);
    const x = l[el.dataset.kind].find((y) => y.id === el.dataset.x);
    x.done = !x.done;
    Store.commit();
    render(true);
    if (x.done && Store.learningProgress(l) === 100) toast('🌻 Learning goal complete.');
  },
  'learn-proj': (el) => {
    const l = Store.learning(el.dataset.id);
    l.projectIds = l.projectIds.includes(el.dataset.p) ? l.projectIds.filter((x) => x !== el.dataset.p) : [...l.projectIds, el.dataset.p];
    Store.commit();
    render(true);
  },
  'learn-from-insp': (el) => {
    const s = Store.inspiration(el.dataset.insp);
    Store.learning(el.dataset.id).resources.push({ id: Store.uid(), title: s.title, url: s.url, type: s.type, done: false });
    Store.commit();
    render(true);
  },
  'delete-learning': async (el) => { if (await ask('Delete this learning goal?', { yes: 'Delete', danger: true })) { Store.deleteLearning(el.dataset.id); go('#/learn'); } },
};

export const enter = {
  'add-learning': addLearning,
  'learn-add-ms': (el) => {
    const t = el.value.trim();
    if (!t) return;
    Store.learning(el.dataset.id).milestones.push({ id: Store.uid(), name: t, done: false });
    Store.commit();
    render(true);
    $('[data-enter="learn-add-ms"]')?.focus();
  },
  'learn-add-res': (el) => {
    const raw = el.value.trim();
    if (!raw) return;
    const isUrl = /^https?:\/\//i.test(raw);
    Store.learning(el.dataset.id).resources.push({ id: Store.uid(), title: isUrl ? guessTitle(raw) : raw, url: isUrl ? raw : '', type: isUrl && /youtube|youtu\.be/.test(raw) ? 'video' : 'article', done: false });
    Store.commit();
    render(true);
    $('[data-enter="learn-add-res"]')?.focus();
  },
};
