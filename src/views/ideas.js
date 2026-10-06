// Ideas tab: list (+ revisit), terrarium (incubator, drag & drop), idea page (+ quiet suggestions, organize).
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { Discover } from '../data/discover.js';
import { plantIcon } from '../garden/sprites.js';
import { S, $, esc, short, ago, STAGE_ICON, STATUS_LABEL, STATUS_INFO, typeIcon } from '../ui/util.js';
import { toast, sugBox, notFound, ask } from '../ui/components.js';
import { render, go } from '../ui/router.js';
import { ui } from '../ui/state.js';

const dismissed = (k) => S().dismissed.includes(k);

// ---------- moving ideas between garden / terrarium / vault / compost ----------
export function moveIdea(id, status, withUndo = true) {
  const idea = Store.idea(id);
  if (!idea || idea.status === status) return;
  const prev = idea.status;
  Store.updateIdea(id, { status });
  ui.justMoved = id;
  render(true);
  ui.justMoved = null;
  const msg = {
    fresh: '🌱 Back in the garden.',
    incubator: '🫙 Moved into the terrarium. I’ll look for ideas and inspirations it could grow with.',
    vault: '🌰 Resting in the seed vault. I’ll bring it back when something related shows up.',
    archived: '🍂 Composted. Find it under Ideas → Compost anytime.',
  }[status];
  toast(msg, withUndo ? [['Undo', 'idea-status', { id, status: prev, undo: 1 }]] : []);
}

// ---------- suggestions ----------
function discoverPick(i, minScore = 4) {
  const text = [i.title, i.content, i.why, i.tags.join(' ')].join(' ');
  const saved = new Set(S().inspirations.map((s) => s.url));
  return Discover.items.filter((d) => !saved.has(d.url))
    .map((d) => ({ d, ...AI.similarity(text, Discover.text(d)) }))
    .filter((x) => x.score >= minScore).sort((a, b) => b.score - a.score)[0];
}

// inside an idea: related ideas, saved inspirations, one Discover pick (max 3, dismissible)
function ideaSuggestions(i) {
  const out = [];
  AI.relatedIdeas(i).forEach((r) => {
    const key = `sug:${i.id}:${r.item.id}`;
    if (!dismissed(key)) out.push({ key, icon: '🔗', html: `Related idea: <a href="#/idea/${r.item.id}">${esc(short(Store.ideaTitle(r.item), 48))}</a> <em class="muted small">${AI.reason(r)}</em>`, action: ['Link', 'link-idea', { id: i.id, other: r.item.id }] });
  });
  AI.relatedInspirationsForIdea(i).forEach((r) => {
    const key = `sug:${i.id}:${r.item.id}`;
    if (!dismissed(key)) out.push({ key, icon: '🦋', html: `<a href="#/inspiration/${r.item.id}">${esc(r.item.title)}</a> may relate <em class="muted small">${AI.reason(r)}</em>`, action: ['Connect', 'connect-insp', { insp: r.item.id, idea: i.id }] });
  });
  const pick = discoverPick(i);
  if (pick) {
    const key = `sug:${i.id}:${pick.d.id}`;
    if (!dismissed(key)) out.push({ key, icon: pick.d.kind === 'research' ? '🔬' : '✨', html: `${esc(pick.d.source)}: <a href="${esc(pick.d.url)}" target="_blank" rel="noopener">${esc(short(pick.d.title, 70))} ↗</a>`, action: ['Save & connect', 'save-discover-connect', { id: pick.d.id, idea: i.id }] });
  }
  return out.slice(0, 3);
}

// Ideas list: older ideas that gained related material since
function revisitList() {
  const st = S();
  const out = [];
  st.ideas.filter((i) => ['fresh', 'vault', 'incubator'].includes(i.status) && Store.daysSince(i.createdAt) >= 14).forEach((i) => {
    const key = `revisit:${i.id}`;
    if (dismissed(key)) return;
    const since = st.inspirations.filter((s) => new Date(s.createdAt) > new Date(i.createdAt) && (s.ideaIds.includes(i.id) || AI.similarity([i.content, i.title].join(' '), [s.title, s.caught, s.apply, s.note].join(' ')).score >= 2));
    if (since.length) out.push({ key, icon: '🌰', html: `<a href="#/idea/${i.id}">${esc(short(Store.ideaTitle(i), 50))}</a> <em class="muted small">captured ${ago(i.createdAt)} · ${since.length} related thing${since.length > 1 ? 's' : ''} saved since</em>`, action: ['Revisit', 'nav', { to: `#/idea/${i.id}` }] });
  });
  return out.slice(0, 3);
}

// ---------- list ----------
export function ideaCard(i, href = `#/idea/${i.id}`) {
  const stage = Store.ideaStage(i);
  return `<a class="card idea-card" href="${href}">
    <span class="stage-ic" title="${Store.STAGE_LABEL[stage]}">${STAGE_ICON[stage]}</span>
    <div class="idea-card-body"><p class="idea-text">${esc(Store.ideaTitle(i))}</p>
      <p class="meta">${i.status !== 'fresh' ? `<span class="pill ${i.status}">${STATUS_LABEL[i.status]}</span>` : ''}${i.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}<span>${ago(i.createdAt)}</span>
      ${i.inspirationIds.length ? `<span>🦋 ${i.inspirationIds.length}</span>` : ''}${i.ideaIds.length ? `<span>🔗 ${i.ideaIds.length}</span>` : ''}</p></div></a>`;
}

function viewIdeas({ a = 'all' }) {
  const st = S();
  const tabs = [['all', 'All'], ['fresh', '🌱 New'], ['incubator', '🫙 Terrarium'], ['vault', '🌰 Seed vault'], ['archived', '🍂 Compost']];
  const count = (k) => (k === 'all' ? st.ideas.filter((i) => i.status !== 'archived') : st.ideas.filter((i) => i.status === k)).length;
  const head = `<header class="page-head"><h1>Ideas</h1></header>
    <div class="seg">${tabs.map(([k, l]) => `<a href="#/ideas/${k}" class="${a === k ? 'on' : ''}">${l} <span class="count">${count(k)}</span></a>`).join('')}</div>`;
  if (a === 'incubator') return head + viewTerrarium();

  const q = ui.ideasFilter.toLowerCase();
  const list = st.ideas
    .filter((i) => (a === 'all' ? i.status !== 'archived' : i.status === a))
    .filter((i) => !q || [i.title, i.content, i.tags.join(' '), i.folder].join(' ').toLowerCase().includes(q));
  const folders = [...new Set(list.map((i) => i.folder).filter(Boolean))];
  const groups = folders.length ? [...folders.map((f) => [f, list.filter((i) => i.folder === f)]), ['', list.filter((i) => !i.folder)]] : [['', list]];
  const desc = { vault: STATUS_INFO.vault[2], archived: STATUS_INFO.archived[2] };
  return `${head}
    ${desc[a] ? `<p class="muted">${desc[a]}</p>` : ''}
    ${a === 'all' || a === 'vault' ? sugBox(revisitList(), '🌰 Worth a revisit') : ''}
    <input class="search" type="search" placeholder="Search ideas, tags, folders…" value="${esc(ui.ideasFilter)}" data-input="ideas-filter">
    ${list.length ? groups.filter(([, g]) => g.length).map(([f, g]) => `${folders.length ? `<h3 class="section-title">${f ? '📁 ' + esc(f) : 'Unfiled'}</h3>` : ''}<div class="list">${g.map((i) => ideaCard(i)).join('')}</div>`).join('')
      : `<div class="empty-state"><p>${q ? 'Nothing matches that search.' : a === 'all' ? 'No ideas yet. The first one is the hardest. It doesn’t need to be good.' : 'Nothing here yet.'}</p></div>`}`;
}

// ---------- terrarium ----------
function viewTerrarium() {
  const st = S();
  const inside = st.ideas.filter((i) => i.status === 'incubator');
  const tray = st.ideas.filter((i) => i.status === 'fresh');
  const pod = (i) => `<div class="pod${ui.justMoved === i.id ? ' pop-in' : ''}" data-drag-idea="${i.id}">
      <a href="#/idea/${i.id}" draggable="false">${plantIcon(i, { size: 46 })}<span class="pod-label">${esc(short(Store.ideaTitle(i), 30))}</span></a></div>`;
  const seed = (i) => `<div class="seed-chip${ui.justMoved === i.id ? ' pop-in' : ''}" data-drag-idea="${i.id}">
      <span class="grip" aria-hidden="true">⠿</span><a href="#/idea/${i.id}" draggable="false">${STAGE_ICON[Store.ideaStage(i)]} ${esc(short(Store.ideaTitle(i), 46))}</a>
      <button class="x jar-btn" data-action="idea-status" data-id="${i.id}" data-status="incubator" title="Move into the terrarium" aria-label="Move into the terrarium">🫙</button></div>`;
  return `
    <p class="muted">${STATUS_INFO.incubator[2]}</p>
    <div class="terrarium-wrap">
      <div class="terrarium" data-drop="incubator" aria-label="Terrarium">
        <div class="jar-lid"><span></span></div>
        <div class="jar">
          <div class="jar-shine"></div>
          <div class="jar-plants">${inside.length ? inside.map(pod).join('') : '<p class="jar-empty">Drag a seed in here 🌱<br><span>Ideas you want to grow, but that aren’t projects yet.</span></p>'}</div>
          <div class="jar-soil"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
    <div class="drop-row" aria-hidden="true">
      <div class="drop-target" data-drop="fresh">🌱 Back to garden</div>
      <div class="drop-target" data-drop="vault">🌰 Seed vault</div>
      <div class="drop-target" data-drop="archived">🍂 Compost</div>
    </div>
    <h3 class="section-title">Seeds in your garden <span class="muted small">· drag one into the jar, or tap 🫙</span></h3>
    <div class="seed-tray">${tray.length ? tray.map(seed).join('') : '<p class="muted small">No new ideas right now.</p>'}</div>
    ${terrariumSuggestions(inside)}`;
}

function terrariumSuggestions(inside) {
  const items = [];
  const seen = new Set();
  inside.forEach((i) => {
    AI.relatedIdeas(i).slice(0, 1).forEach((r) => {
      const k = [i.id, r.item.id].sort().join();
      if (seen.has(k)) return;
      seen.add(k);
      items.push(`<div class="sug"><span>🔗 <strong>${esc(short(Store.ideaTitle(i)))}</strong> and <strong>${esc(short(Store.ideaTitle(r.item)))}</strong> could grow together <em class="muted small">(${AI.reason(r)})</em></span><button class="btn sm" data-action="link-idea" data-id="${i.id}" data-other="${r.item.id}">Link</button></div>`);
    });
    AI.relatedInspirationsForIdea(i).slice(0, 1).forEach((r) => {
      items.push(`<div class="sug"><span>🦋 <strong>${esc(r.item.title)}</strong> could feed <strong>${esc(short(Store.ideaTitle(i)))}</strong> <em class="muted small">(${AI.reason(r)})</em></span><button class="btn sm" data-action="connect-insp" data-insp="${r.item.id}" data-idea="${i.id}">Connect</button></div>`);
    });
    const pick = discoverPick(i);
    if (pick && !seen.has(pick.d.id)) {
      seen.add(pick.d.id);
      items.push(`<div class="sug"><span>✨ New for <strong>${esc(short(Store.ideaTitle(i)))}</strong>: <a href="${esc(pick.d.url)}" target="_blank" rel="noopener">${esc(short(pick.d.title, 70))} ↗</a> <em class="muted small">${esc(pick.d.source)}</em></span><button class="btn sm" data-action="save-discover-connect" data-id="${pick.d.id}" data-idea="${i.id}">Save & connect</button></div>`);
    }
  });
  const oldest = [...inside].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))[0];
  return `<section class="card soft terrarium-ai"><div class="ai-label">✨ Growing together</div>
    ${items.length ? items.slice(0, 6).join('') : '<p class="muted small">As your terrarium fills up, I’ll point out ideas and inspirations that could grow together.</p>'}
    ${oldest ? `<div class="row" style="margin-top:.6rem"><a class="btn sm ai" href="#/think/${oldest.id}">💬 Think about “${esc(short(Store.ideaTitle(oldest), 28))}”</a><span class="muted small">untouched the longest</span></div>` : ''}</section>`;
}

// ---------- idea page ----------
function organizePanel(i) {
  const s = AI.organize(i);
  const empty = !s.tags.length && !s.related.length && !s.insps.length && !s.place && !s.title;
  return `<div class="card soft organize">
    <div class="row between"><span class="ai-label">✨ Suggestions. Accept what fits.</span><button class="x" data-action="close-organize" aria-label="Close">×</button></div>
    ${empty ? '<p class="muted">Nothing to suggest right now. As your garden grows, I’ll find more connections.</p>' : ''}
    ${s.title ? `<div class="sug"><span>Title: <strong>${esc(s.title)}</strong></span><button class="btn sm" data-action="accept-title" data-id="${i.id}" data-title="${esc(s.title)}">Use</button></div>` : ''}
    ${s.tags.length ? `<div class="sug"><span>Tags:</span><div class="chips">${s.tags.map((t) => `<button class="chip" data-action="accept-tag" data-id="${i.id}" data-tag="${esc(t)}">+ #${esc(t)}</button>`).join('')}</div></div>` : ''}
    ${s.place ? `<div class="sug"><span>Move to <strong>${STATUS_LABEL[s.place.status]}</strong>. <em class="muted">${esc(s.place.why)}</em></span><button class="btn sm" data-action="idea-status" data-id="${i.id}" data-status="${s.place.status}">Move</button></div>` : ''}
    ${s.related.map((r) => `<div class="sug"><span>Related idea: <strong>${esc(Store.ideaTitle(r.item))}</strong> <em class="muted">(${AI.reason(r)})</em></span><button class="btn sm" data-action="link-idea" data-id="${i.id}" data-other="${r.item.id}">Link</button></div>`).join('')}
    ${s.insps.map((r) => `<div class="sug"><span>Inspiration: <strong>${esc(r.item.title)}</strong> <em class="muted">(${AI.reason(r)})</em></span><button class="btn sm" data-action="connect-insp" data-insp="${r.item.id}" data-idea="${i.id}">Connect</button></div>`).join('')}
  </div>`;
}

function viewIdea({ a: id }) {
  const i = Store.idea(id);
  if (!i) return notFound();
  const stage = Store.ideaStage(i);
  const linked = i.ideaIds.map(Store.idea).filter(Boolean);
  const insps = i.inspirationIds.map(Store.inspiration).filter(Boolean);
  const project = i.projectId && Store.project(i.projectId);
  const stages = ['seed', 'sprout', 'plant', 'bloom'];
  return `
    <a class="back" href="#/ideas">← Ideas</a>
    <article class="idea-detail">
      <div class="stage-row"><span class="stage-badge">${STAGE_ICON[stage]} ${Store.STAGE_LABEL[stage]}</span>
        <div class="stage-track">${stages.map((s) => `<span class="${stages.indexOf(s) <= stages.indexOf(stage) ? 'on' : ''}"></span>`).join('')}</div>
        <span class="muted small">Captured ${ago(i.createdAt)}</span></div>
      <input class="title-input" placeholder="Add a title (optional)" value="${esc(i.title)}" data-bind="idea:${i.id}:title">
      <textarea class="content-input" rows="3" data-bind="idea:${i.id}:content" data-grow>${esc(i.content)}</textarea>

      <div class="status-row">${project ? `<a class="btn primary" href="#/project/${project.id}">🌳 Open project</a>` : ['fresh', 'incubator', 'vault', 'archived'].map((s) => `<button class="btn sm${i.status === s ? ' on' : ''}" data-action="idea-status" data-id="${i.id}" data-status="${s}" title="${esc(STATUS_INFO[s][2])}">${STATUS_INFO[s][0]} ${STATUS_INFO[s][1]}</button>`).join('')}</div>
      ${!project && STATUS_INFO[i.status] ? `<p class="status-hint">${STATUS_INFO[i.status][0]} ${STATUS_INFO[i.status][2]}</p>` : ''}

      <div class="ai-actions">
        <button class="btn ai" data-action="organize" data-id="${i.id}">✨ Organize with AI</button>
        <a class="btn ai" href="#/think/${i.id}">💬 Think with me</a>
        ${project ? '' : `<a class="btn" href="#/new-project/${i.id}">🌳 Turn into project</a>`}
      </div>
      ${ui.organizeFor === i.id ? organizePanel(i) : sugBox(ideaSuggestions(i))}

      <section class="field"><label>Why it interests me</label>
        <textarea rows="2" placeholder="What pulls you toward this?" data-bind="idea:${i.id}:why" data-grow>${esc(i.why)}</textarea></section>

      <section class="field"><label>Tags & folder</label>
        <div class="chips">${i.tags.map((t) => `<span class="chip on">#${esc(t)} <button class="x" data-action="rm-tag" data-id="${i.id}" data-tag="${esc(t)}" aria-label="Remove tag">×</button></span>`).join('')}
          <input class="chip-input" placeholder="+ tag" data-enter="add-tag" data-id="${i.id}"></div>
        <input class="inline-input" placeholder="📁 Folder (optional)" value="${esc(i.folder)}" data-bind="idea:${i.id}:folder" list="folders">
        <datalist id="folders">${[...new Set(S().ideas.map((x) => x.folder).filter(Boolean))].map((f) => `<option value="${esc(f)}">`).join('')}</datalist></section>

      <section class="field"><label>Open questions</label>
        ${i.questions.map((q, k) => `<div class="q-row">❓ <span>${esc(q)}</span><button class="x" data-action="rm-question" data-id="${i.id}" data-k="${k}" aria-label="Remove">×</button></div>`).join('')}
        <input class="inline-input" placeholder="+ Add a question you haven’t answered yet" data-enter="add-question" data-id="${i.id}"></section>

      <section class="field"><label>Notes</label>
        <textarea rows="3" placeholder="Anything. Insights you keep from Think With Me land here too." data-bind="idea:${i.id}:notes" data-grow>${esc(i.notes)}</textarea></section>

      <section class="field"><label>Related ideas</label>
        ${linked.map((x) => `<div class="link-row"><a href="#/idea/${x.id}">${STAGE_ICON[Store.ideaStage(x)]} ${esc(Store.ideaTitle(x))}</a><button class="x" data-action="unlink-idea" data-id="${i.id}" data-other="${x.id}" aria-label="Unlink">×</button></div>`).join('')}
        ${!linked.length ? '<p class="muted small">No related ideas linked yet.</p>' : ''}</section>

      <section class="field"><label>Inspirations</label>
        ${insps.map((s) => `<div class="link-row"><a href="#/inspiration/${s.id}">${typeIcon(s.type)} ${esc(s.title)}</a><button class="x" data-action="disconnect-insp" data-insp="${s.id}" data-idea="${i.id}" aria-label="Disconnect">×</button></div>`).join('')}
        <button class="btn sm ghost" data-action="save-insp" data-idea="${i.id}">+ Save an inspiration for this idea</button></section>

      <div class="danger-row"><button class="btn sm ghost danger" data-action="delete-idea" data-id="${i.id}">Delete idea</button></div>
    </article>`;
}

export const views = { ideas: viewIdeas, idea: viewIdea };

export const actions = {
  'idea-status': (el) => moveIdea(el.dataset.id, el.dataset.status, !el.dataset.undo),
  organize: (el) => { ui.organizeFor = ui.organizeFor === el.dataset.id ? null : el.dataset.id; render(true); },
  'close-organize': () => { ui.organizeFor = null; render(true); },
  'accept-title': (el) => { Store.updateIdea(el.dataset.id, { title: el.dataset.title }); render(true); },
  'accept-tag': (el) => { const i = Store.idea(el.dataset.id); Store.updateIdea(i.id, { tags: [...i.tags, el.dataset.tag] }); render(true); },
  'rm-tag': (el) => { const i = Store.idea(el.dataset.id); Store.updateIdea(i.id, { tags: i.tags.filter((t) => t !== el.dataset.tag) }, { touch: false }); render(true); },
  'rm-question': (el) => { const i = Store.idea(el.dataset.id); i.questions.splice(+el.dataset.k, 1); Store.commit(); render(true); },
  'link-idea': (el) => { Store.linkIdeas(el.dataset.id, el.dataset.other); render(true); toast('🔗 Linked. Both ideas grew a little.'); },
  'unlink-idea': (el) => { Store.unlinkIdeas(el.dataset.id, el.dataset.other); render(true); },
  'delete-idea': async (el) => { if (await ask('Delete this idea for good? (Compost keeps it out of the way instead.)', { yes: 'Delete', danger: true })) { Store.deleteIdea(el.dataset.id); go('#/ideas'); } },
};

export const enter = {
  'add-tag': (el) => {
    const t = el.value.trim().replace(/^#/, '');
    const i = Store.idea(el.dataset.id);
    if (t && !i.tags.includes(t)) Store.updateIdea(i.id, { tags: [...i.tags, t] });
    render(true);
    $('[data-enter="add-tag"]')?.focus();
  },
  'add-question': (el) => {
    const q = el.value.trim();
    if (!q) return;
    const i = Store.idea(el.dataset.id);
    Store.updateIdea(i.id, { questions: [...i.questions, q] });
    render(true);
    $('[data-enter="add-question"]')?.focus();
  },
};

export const onInput = {
  'ideas-filter': (el) => {
    ui.ideasFilter = el.value;
    const pos = el.selectionStart;
    render(true);
    const s = $('[data-input="ideas-filter"]');
    s.focus();
    s.setSelectionRange(pos, pos);
  },
};
