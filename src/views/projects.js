// Projects tab: list (main + side), project page (milestones, timeline, nudges), new-project wizard.
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { S, $, esc, bar, wk, fmtDate, weekDate, typeIcon, STAGE_ICON } from '../ui/util.js';
import { toast, sugBox, notFound, ask } from '../ui/components.js';
import { render, go } from '../ui/router.js';
import { ui } from '../ui/state.js';

const dismissed = (k) => S().dismissed.includes(k);

// stuck milestone, finished early, learning that could help (max 3, dismissible)
function projectNudges(p) {
  const out = [];
  const m = p.milestones.find((x) => !x.done);
  if (m && m.startedAt) {
    const lastDone = Math.max(new Date(m.startedAt).getTime(), ...p.milestones.flatMap((x) => x.tasks).filter((t) => t.doneAt).map((t) => new Date(t.doneAt).getTime()));
    const idle = Math.floor((Date.now() - lastDone) / Store.DAY);
    const key = `stuck:${m.id}:${Math.floor(lastDone / Store.DAY)}`;
    if (idle >= 14 && !dismissed(key)) out.push({ key, icon: '🪨', html: `“${esc(m.name)}” hasn’t moved for ${Math.round(idle / 7)} weeks. Blocked, not important anymore, or too big?`, action: ['Break it down', 'break-down', { p: p.id, m: m.id }] });
  }
  const doneMs = p.milestones.filter((x) => x.done && x.doneAt);
  const last = doneMs[doneMs.length - 1];
  if (last) {
    const next = p.milestones[p.milestones.indexOf(last) + 1];
    const early = Math.floor((weekDate(p, last.weekEnd) - new Date(last.doneAt)) / (7 * Store.DAY));
    const key = `early:${last.id}`;
    if (next && !next.done && early >= 1 && !dismissed(key)) out.push({ key, icon: '⏩', html: `You finished “${esc(last.name)}” ~${early} week${early > 1 ? 's' : ''} early. Bring the next milestones forward?`, action: ['Bring forward', 'pull-forward', { p: p.id, m: last.id, w: early }] });
  }
  AI.learningForProject(p).filter((r) => !r.item.projectIds.includes(p.id)).slice(0, 1).forEach((r) => {
    const key = `learn:${r.item.id}:${p.id}`;
    if (!dismissed(key)) out.push({ key, icon: '🌻', html: `You’re learning “${esc(r.item.topic)}”. It could help here.`, action: ['Connect', 'link-learn', { l: r.item.id, p: p.id }] });
  });
  return out.slice(0, 3);
}

function viewProjects() {
  const st = S();
  const { main } = Store.activeProjects();
  const active = st.projects.filter((p) => p.status === 'active');
  const done = st.projects.filter((p) => p.status === 'done');
  const card = (p) => {
    const next = p.milestones.flatMap((m) => m.tasks).find((t) => !t.done);
    const role = p.status !== 'active' ? '' : p === main ? '<span class="pill project">⭐ Main</span>' : '<span class="pill">Side</span>';
    return `<a class="card proj-card" href="#/project/${p.id}"><div class="row between"><h4>🌳 ${esc(p.name)} ${role}</h4><span class="muted small">🍎 ${p.milestones.filter((m) => m.done).length}/${p.milestones.length}</span></div>
      ${bar(Store.projectProgress(p))}<p class="muted small">${Store.projectProgress(p)}%${next ? ' · Next: ' + esc(next.text) : ''}</p></a>`;
  };
  const ready = st.ideas.filter((i) => i.status === 'incubator');
  return `
    <header class="page-head"><h1>Projects</h1></header>
    ${active.length ? `<div class="list">${active.map(card).join('')}</div>` : '<div class="empty-state"><p>No active projects. That’s fine. Not every idea needs to be one.</p></div>'}
    ${ready.length ? `<h3 class="section-title">In the terrarium, maybe ready?</h3><div class="list">${ready.slice(0, 4).map((i) => `<div class="card row between"><span>${STAGE_ICON[Store.ideaStage(i)]} ${esc(Store.ideaTitle(i))}</span><a class="btn sm" href="#/new-project/${i.id}">Turn into project</a></div>`).join('')}</div>` : ''}
    ${done.length ? `<h3 class="section-title">Completed</h3><div class="list">${done.map(card).join('')}</div>` : ''}`;
}

function timeline(p) {
  const pct = Math.min(100, (Math.max(0, (Date.now() - new Date(p.startDate)) / (7 * Store.DAY)) / p.weeks) * 100);
  return `<div class="timeline">
    ${p.milestones.map((m) => {
      const part = m.done ? 100 : m.tasks.length ? Math.round((m.tasks.filter((t) => t.done).length / m.tasks.length) * 100) : 0;
      return `<div class="tl-row${m.done ? ' done' : ''}"><span class="tl-label"><span class="dot"></span>${esc(m.name)}</span>
      <div class="tl-track"><span class="tl-bar" style="left:${(m.weekStart / p.weeks) * 100}%;width:${Math.max(3, ((m.weekEnd - m.weekStart) / p.weeks) * 100)}%"><i style="width:${part}%"></i></span><span class="today" style="left:${pct}%"></span></div></div>`;
    }).join('')}
    <div class="tl-row"><span class="tl-label"></span><div class="tl-track axis"><span class="today-label" style="left:${pct}%">today</span>
      <span class="axis-l">${fmtDate(p.startDate)}</span><span class="axis-r">${fmtDate(weekDate(p, p.weeks))}</span></div></div></div>`;
}

function viewProject({ a: id }) {
  const p = Store.project(id);
  if (!p) return notFound();
  const prog = Store.projectProgress(p);
  const nextTasks = p.milestones.filter((m) => !m.done).flatMap((m) => m.tasks.filter((t) => !t.done).map((t) => ({ t, m }))).slice(0, 3);
  const idea = p.ideaId && Store.idea(p.ideaId);
  const insps = S().inspirations.filter((s) => s.projectIds.includes(p.id));
  const learn = S().learning.filter((l) => l.projectIds.includes(p.id));
  const firstOpen = p.milestones.find((m) => !m.done);
  const task = (t, m, extra = '') => `<label class="task"><input type="checkbox" ${t.done ? 'checked' : ''} data-action="toggle-task" data-p="${p.id}" data-m="${m.id}" data-t="${t.id}"> <span>${esc(t.text)}</span>${extra}</label>`;
  return `
    <a class="back" href="#/projects">← Projects</a>
    <article class="idea-detail">
      <p class="eyebrow">🌳 Project${p.status === 'done' ? ' · completed ✨' : ''}</p>
      <input class="title-input" value="${esc(p.name)}" data-bind="project:${p.id}:name">
      <input class="inline-input" placeholder="Goal: what does done look like?" value="${esc(p.goal)}" data-bind="project:${p.id}:goal">
      <div class="progress-big">${bar(prog)}<span>${prog}%</span></div>
      ${p.status === 'active' ? `<p class="proj-role">${Store.activeProjects().main === p ? '⭐ Your current (main) project' : `🌱 Side project · <button class="linkish" data-action="make-main" data-id="${p.id}">Make it the main project</button>`}</p>` : ''}
      ${sugBox(projectNudges(p))}
      ${p.estimateNote ? `<p class="estimate">🧭 ${esc(p.estimateNote)}</p>` : ''}

      ${nextTasks.length ? `<section class="card next"><h4>Next steps</h4>${nextTasks.map(({ t, m }) => task(t, m, ` <em class="muted small">${esc(m.name)}</em>`)).join('')}</section>` : ''}
      ${p.milestones.length ? `<section class="field"><label>Timeline · ${p.weeks} weeks · ~${p.hoursPerWeek} h/week</label>${timeline(p)}</section>` : ''}

      <section class="field"><label>Milestones</label>
        ${p.milestones.map((m) => `<details class="ms${m.done ? ' done' : ''}" ${m === firstOpen ? 'open' : ''}><summary><span class="ms-ic" data-action="toggle-ms" data-p="${p.id}" data-m="${m.id}" title="${m.done ? 'Mark not done' : 'Mark milestone done'}" role="checkbox" aria-checked="${m.done}"></span>
          <span class="ms-name">${esc(m.name)}${m.done ? ' <span class="fruit-badge" title="A fruit grew on your tree">🍎</span>' : ''}</span><span class="muted small">${wk(m)} · ${m.tasks.filter((t) => t.done).length}/${m.tasks.length}</span></summary>
          ${m.tasks.map((t) => task(t, m)).join('')}
          <input class="inline-input" placeholder="+ Add a task" data-enter="add-task" data-p="${p.id}" data-m="${m.id}"></details>`).join('')}
        <input class="inline-input" placeholder="+ Add a milestone" data-enter="add-ms" data-p="${p.id}"></section>

      <section class="field"><label>Connected</label>
        ${idea ? `<div class="link-row"><a href="#/idea/${idea.id}">💡 From idea: ${esc(Store.ideaTitle(idea))}</a></div>` : ''}
        ${insps.map((s) => `<div class="link-row"><a href="#/inspiration/${s.id}">${typeIcon(s.type)} ${esc(s.title)}</a></div>`).join('')}
        ${AI.inspirationsForProject(p).map((r) => `<div class="link-row suggest"><span>✨ ${typeIcon(r.item.type)} ${esc(r.item.title)} <em class="muted small">${AI.reason(r)}</em></span><button class="btn sm" data-action="connect-insp-proj" data-insp="${r.item.id}" data-p="${p.id}">Connect</button></div>`).join('')}
        ${learn.map((l) => `<div class="link-row"><a href="#/learn/${l.id}">🌻 Learning: ${esc(l.topic)}</a></div>`).join('')}
        ${!idea && !insps.length && !learn.length ? '<p class="muted small">Nothing connected yet.</p>' : ''}</section>

      <div class="danger-row">
        ${p.status === 'active' ? `<button class="btn sm" data-action="project-done" data-id="${p.id}">✨ Mark project complete</button>` : `<button class="btn sm" data-action="project-reopen" data-id="${p.id}">Reopen</button>`}
        <button class="btn sm ghost danger" data-action="delete-project" data-id="${p.id}">Delete project</button></div>
    </article>`;
}

// ---------- new project wizard ----------
function viewNewProject({ a: ideaId }) {
  const idea = ideaId && ideaId !== 'new' ? Store.idea(ideaId) : null;
  if (!ui.wiz || ui.wiz.ideaId !== (idea?.id || null)) {
    ui.wiz = { ideaId: idea?.id || null, step: 'basics', name: idea ? Store.ideaTitle(idea) : '', goal: '', weeks: 8, hoursPerWeek: 5, done: '', qIdx: 0, plan: null, mode: null };
  }
  const wiz = ui.wiz;
  const back = idea ? `<a class="back" href="#/idea/${idea.id}">← Back to idea</a>` : '<a class="back" href="#/projects">← Projects</a>';
  const weeksSel = (v) => `<div class="chips">${[2, 4, 8, 12, 16, 26].map((w) => `<button class="chip${v === w ? ' on' : ''}" data-action="wiz-set" data-k="weeks" data-v="${w}">${w < 26 ? w + ' weeks' : '6 months'}</button>`).join('')}</div>`;
  const hoursSel = (v) => `<div class="chips">${[2, 5, 8, 15, 30].map((h) => `<button class="chip${v === h ? ' on' : ''}" data-action="wiz-set" data-k="hoursPerWeek" data-v="${h}">${h} h/week</button>`).join('')}</div>`;

  if (wiz.step === 'basics') {
    return `${back}<h1>Plant a tree 🌳</h1>${idea ? `<p class="lead">Turning “${esc(Store.ideaTitle(idea))}” into a project.</p>` : ''}
      <section class="field"><label>Project name</label><input class="inline-input big" value="${esc(wiz.name)}" data-wiz="name" data-autofocus></section>
      <section class="field"><label>Goal <span class="muted">(optional)</span></label><input class="inline-input" placeholder="e.g. A working prototype 5 friends use" value="${esc(wiz.goal)}" data-wiz="goal"></section>
      <h3>How would you like to create your plan?</h3>
      <div class="choice-list">
        <button class="choice" data-action="wiz-mode" data-mode="auto"><strong>✨ Build it for me</strong><span>I’ll draft milestones, first steps and a rough timeline. You edit.</span></button>
        <button class="choice" data-action="wiz-mode" data-mode="together"><strong>💬 Build it together</strong><span>A few quick questions first, then a plan that fits.</span></button>
        <button class="choice" data-action="wiz-mode" data-mode="self"><strong>✍️ I’ll do it myself</strong><span>Start with an empty project and add milestones yourself.</span></button>
      </div>`;
  }
  if (wiz.step === 'auto') {
    return `${back}<h2>How long, roughly?</h2>${weeksSel(wiz.weeks)}<h3>Time per week</h3>${hoursSel(wiz.hoursPerWeek)}
      <button class="btn primary lg" data-action="wiz-generate">Draft my plan</button>`;
  }
  if (wiz.step === 'together') {
    const qs = AI.planQuestions();
    const q = qs[wiz.qIdx];
    const answer = (x) => (x.key === 'weeks' ? wiz.weeks + ' weeks' : x.key === 'hoursPerWeek' ? wiz.hoursPerWeek + ' h/week' : wiz[x.key] || '(skipped)');
    return `${back}<div class="chat-log static">
      <div class="msg ai"><p>Let’s shape <strong>${esc(wiz.name || 'this project')}</strong> together. Three quick questions.</p></div>
      ${qs.slice(0, wiz.qIdx).map((x) => `<div class="msg ai"><p>${esc(x.q)}</p></div><div class="msg user"><p>${esc(answer(x))}</p></div>`).join('')}
      <div class="msg ai"><p>${esc(q.q)}</p></div></div>
      ${q.type === 'weeks' ? weeksSel(wiz.weeks) : q.type === 'hours' ? hoursSel(wiz.hoursPerWeek) : `<input class="inline-input" placeholder="${esc(q.placeholder)}" value="${esc(wiz[q.key])}" data-wiz="${q.key}" data-autofocus data-enter="wiz-answer">`}
      <button class="btn primary" data-action="wiz-answer">${wiz.qIdx < qs.length - 1 ? 'Next' : 'Draft the plan'}</button>`;
  }
  const pl = wiz.plan;
  return `${back}<h2>Here’s a first draft</h2><p class="estimate">🧭 ${esc(pl.estimateNote)}</p>
    <section class="card next"><h4>Your first steps</h4><ol>${pl.firstSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="muted small">Small on purpose. Each one should take under an hour.</p></section>
    <section class="field"><label>Milestones · ${wiz.weeks} weeks</label>
      ${pl.milestones.map((m, k) => `<div class="ms-edit"><span class="muted small">${wk(m)}</span><input class="inline-input" value="${esc(m.name)}" data-wiz-ms="${k}"><button class="x" data-action="wiz-rm-ms" data-k="${k}" aria-label="Remove">×</button>
        <p class="muted small">${m.tasks.map((t) => esc(t.text)).join(' · ')}</p></div>`).join('')}</section>
    <div class="row"><button class="btn primary lg" data-action="wiz-create">Plant this tree 🌳</button><button class="btn ghost" data-action="wiz-generate">Regenerate</button><button class="btn ghost" data-action="wiz-step" data-step="${wiz.mode}">Change answers</button></div>`;
}

function syncWiz() {
  document.querySelectorAll('[data-wiz]').forEach((el) => { ui.wiz[el.dataset.wiz] = el.value; });
  document.querySelectorAll('[data-wiz-ms]').forEach((el) => { ui.wiz.plan.milestones[+el.dataset.wizMs].name = el.value; });
}

function createProject(milestones, estimateNote = '') {
  const { wiz } = ui;
  const p = Store.addProject({ name: wiz.name.trim(), goal: wiz.goal.trim() || wiz.done.trim(), ideaId: wiz.ideaId, weeks: wiz.weeks, hoursPerWeek: wiz.hoursPerWeek, milestones, estimateNote });
  ui.wiz = null;
  go(`#/project/${p.id}`);
  toast('🌳 A new tree is growing in your garden.');
}

function afterMilestone(projectId, res) {
  const p = Store.project(projectId);
  if (res.milestoneJustDone) {
    const next = p.milestones[p.milestones.indexOf(res.milestone) + 1];
    if (next && !next.startedAt) { next.startedAt = Store.now(); Store.commit(); }
    const allDone = p.milestones.every((m) => m.done);
    toast(allDone ? '🍎 Every milestone done. Mark the project complete when you’re ready.' : `🍎 “${esc(res.milestone.name)}” done. A fruit grew on your tree.`, [['See garden', 'nav', { to: '#/' }]]);
  }
  render(true);
}

function generate() {
  syncWiz();
  const { wiz } = ui;
  wiz.plan = AI.plan({ idea: wiz.ideaId && Store.idea(wiz.ideaId), name: wiz.name, goal: wiz.goal || wiz.done, weeks: wiz.weeks, hoursPerWeek: wiz.hoursPerWeek, done: wiz.done });
  wiz.step = 'preview';
  render();
}

function answer() {
  syncWiz();
  if (ui.wiz.qIdx < AI.planQuestions().length - 1) { ui.wiz.qIdx++; render(true); } else generate();
}

export const views = { projects: viewProjects, project: viewProject, 'new-project': viewNewProject };

export const actions = {
  'new-project': () => { ui.wiz = null; go('#/new-project/new'); },
  'wiz-mode': (el) => {
    syncWiz();
    if (!ui.wiz.name.trim()) { $('[data-wiz="name"]').focus(); return toast('Give it a name first, even a rough one.'); }
    ui.wiz.mode = el.dataset.mode;
    if (ui.wiz.mode === 'self') return createProject([]);
    ui.wiz.step = ui.wiz.mode;
    ui.wiz.qIdx = 0;
    render();
  },
  'wiz-set': (el) => { ui.wiz[el.dataset.k] = +el.dataset.v; render(true); },
  'wiz-step': (el) => { ui.wiz.step = el.dataset.step; ui.wiz.qIdx = 0; render(); },
  'wiz-answer': answer,
  'wiz-generate': generate,
  'wiz-rm-ms': (el) => { syncWiz(); ui.wiz.plan.milestones.splice(+el.dataset.k, 1); render(true); },
  'wiz-create': () => { syncWiz(); createProject(ui.wiz.plan.milestones, ui.wiz.plan.estimateNote); },
  'toggle-task': (el) => afterMilestone(el.dataset.p, Store.toggleTask(el.dataset.p, el.dataset.m, el.dataset.t)),
  'toggle-ms': (el, ev) => { ev.preventDefault(); afterMilestone(el.dataset.p, Store.toggleMilestone(el.dataset.p, el.dataset.m)); },
  'make-main': (el) => {
    S().projects.forEach((p) => { p.isMain = p.id === el.dataset.id; });
    Store.commit();
    render(true);
    toast('⭐ This is now your current project.');
  },
  'project-done': (el) => { Store.updateProject(el.dataset.id, { status: 'done' }); render(true); toast('✨ Project complete. Your tree is fully grown.'); },
  'project-reopen': (el) => { Store.updateProject(el.dataset.id, { status: 'active' }); render(true); },
  'delete-project': async (el) => { if (await ask('Delete this project? The idea goes back to the terrarium.', { yes: 'Delete', danger: true })) { Store.deleteProject(el.dataset.id); go('#/projects'); } },
  'break-down': (el) => {
    const p = Store.project(el.dataset.p);
    const m = p.milestones.find((x) => x.id === el.dataset.m);
    const what = m.tasks.find((x) => !x.done)?.text || m.name;
    ['Write down what’s blocking: ' + what, 'Spend 20 minutes on the easiest part of: ' + what, 'Decide the very next physical action for: ' + what].forEach((x) => Store.addTask(p.id, m.id, x));
    Store.dismiss(el.dataset.key);
    toast('🪨 Added three smaller steps.');
    render(true);
  },
  'pull-forward': (el) => {
    const p = Store.project(el.dataset.p);
    const idx = p.milestones.findIndex((x) => x.id === el.dataset.m);
    const w = +el.dataset.w;
    p.milestones.slice(idx + 1).forEach((m) => { m.weekStart = Math.max(0, m.weekStart - w); m.weekEnd = Math.max(m.weekStart + 1, m.weekEnd - w); });
    p.milestones[idx].weekEnd = Math.max(p.milestones[idx].weekStart + 1, p.milestones[idx].weekEnd - w);
    p.weeks = Math.max(1, p.weeks - w);
    Store.dismiss(el.dataset.key);
    toast(`⏩ Brought forward by ${w} week${w > 1 ? 's' : ''}.`);
    render(true);
  },
  'link-learn': (el) => { Store.learning(el.dataset.l).projectIds.push(el.dataset.p); Store.dismiss(el.dataset.key); render(true); },
};

export const enter = {
  'wiz-answer': answer,
  'add-task': (el) => { const t = el.value.trim(); if (!t) return; Store.addTask(el.dataset.p, el.dataset.m, t); render(true); $(`[data-enter="add-task"][data-m="${el.dataset.m}"]`)?.focus(); },
  'add-ms': (el) => { const t = el.value.trim(); if (!t) return; Store.addMilestone(el.dataset.p, t); render(true); },
};
