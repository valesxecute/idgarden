// Data layer. LocalAdapter persists to localStorage (guest mode).
// A SupabaseAdapter only needs load() / save(state) with the same shape — see plans/backend.md.
const KEY = 'idea-garden:v1';

const LocalAdapter = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch {}
  },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => new Date().toISOString();
const DAY = 86400000;

function emptyState() {
  return {
    version: 1,
    user: { name: '', interests: [], guest: true, onboarded: false, organizeMode: 'ask' },
    ideas: [],
    inspirations: [],
    projects: [],
    learning: [],
    dismissed: [],
    chats: {},
    deleted: [], // tombstones so sync merges don't resurrect deleted items
    meta: { updatedAt: null, syncedAt: null, owner: null },
  };
}

let state = Object.assign(emptyState(), LocalAdapter.load() || {});
const listeners = new Set();

// local edits stamp meta.updatedAt (sync pushes them); loads from the cloud don't
function commit({ remote = false } = {}) {
  state.meta = state.meta || {};
  if (!remote) state.meta.updatedAt = now();
  LocalAdapter.save(state);
  listeners.forEach((fn) => fn(state, { remote }));
}
const tomb = (id) => { if (!state.deleted.includes(id)) state.deleted.push(id); };

export const Store = {
  get state() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  commit,
  reset() { LocalAdapter.clear(); state = emptyState(); commit({ remote: true }); },
  replace(next) { state = Object.assign(emptyState(), next); commit(); },
  load(next) { state = Object.assign(emptyState(), next); commit({ remote: true }); },
  saveSilently() { LocalAdapter.save(state); },
  exportJSON() { return JSON.stringify(state, null, 2); },

  // ---------- ideas ----------
  addIdea(content, extra = {}) {
    const idea = {
      id: uid(), content: content.trim(), title: '', tags: [], folder: '',
      status: 'fresh', why: '', notes: '', questions: [],
      ideaIds: [], inspirationIds: [], projectId: null,
      attention: 0, createdAt: now(), updatedAt: now(), ...extra,
    };
    state.ideas.unshift(idea);
    commit();
    return idea;
  },
  idea(id) { return state.ideas.find((i) => i.id === id); },
  updateIdea(id, patch, { touch = true } = {}) {
    const idea = Store.idea(id);
    if (!idea) return;
    Object.assign(idea, patch);
    if (touch) { idea.updatedAt = now(); idea.attention = (idea.attention || 0) + 1; }
    commit();
    return idea;
  },
  deleteIdea(id) {
    tomb(id);
    state.ideas = state.ideas.filter((i) => i.id !== id);
    state.ideas.forEach((i) => { i.ideaIds = i.ideaIds.filter((x) => x !== id); });
    state.inspirations.forEach((s) => { s.ideaIds = s.ideaIds.filter((x) => x !== id); });
    delete state.chats[id];
    commit();
  },
  linkIdeas(a, b) {
    const A = Store.idea(a), B = Store.idea(b);
    if (!A || !B || a === b) return;
    if (!A.ideaIds.includes(b)) A.ideaIds.push(b);
    if (!B.ideaIds.includes(a)) B.ideaIds.push(a);
    A.attention++; B.attention++;
    commit();
  },
  unlinkIdeas(a, b) {
    const A = Store.idea(a), B = Store.idea(b);
    if (A) A.ideaIds = A.ideaIds.filter((x) => x !== b);
    if (B) B.ideaIds = B.ideaIds.filter((x) => x !== a);
    commit();
  },

  // ---------- inspirations ----------
  addInspiration(data) {
    const insp = {
      id: uid(), url: '', title: '', type: 'article', note: '', caught: '', apply: '',
      ideaIds: [], projectIds: [], learningIds: [], createdAt: now(), ...data,
    };
    state.inspirations.unshift(insp);
    commit();
    return insp;
  },
  inspiration(id) { return state.inspirations.find((s) => s.id === id); },
  updateInspiration(id, patch) {
    const s = Store.inspiration(id);
    if (s) { Object.assign(s, patch); commit(); }
    return s;
  },
  deleteInspiration(id) {
    tomb(id);
    state.inspirations = state.inspirations.filter((s) => s.id !== id);
    state.ideas.forEach((i) => { i.inspirationIds = i.inspirationIds.filter((x) => x !== id); });
    commit();
  },
  connectInspiration(inspId, ideaId) {
    const s = Store.inspiration(inspId), i = Store.idea(ideaId);
    if (!s || !i) return;
    if (!s.ideaIds.includes(ideaId)) s.ideaIds.push(ideaId);
    if (!i.inspirationIds.includes(inspId)) i.inspirationIds.push(inspId);
    i.attention++;
    i.updatedAt = now();
    commit();
  },
  disconnectInspiration(inspId, ideaId) {
    const s = Store.inspiration(inspId), i = Store.idea(ideaId);
    if (s) s.ideaIds = s.ideaIds.filter((x) => x !== ideaId);
    if (i) i.inspirationIds = i.inspirationIds.filter((x) => x !== inspId);
    commit();
  },
  connectInspirationToProject(inspId, projectId) {
    const s = Store.inspiration(inspId);
    if (s && !s.projectIds.includes(projectId)) { s.projectIds.push(projectId); commit(); }
  },

  // ---------- projects ----------
  addProject(data) {
    const p = {
      id: uid(), name: '', goal: '', description: '', ideaId: null,
      weeks: 8, hoursPerWeek: 5, startDate: now(), targetDate: null,
      milestones: [], status: 'active', estimateNote: '', createdAt: now(), ...data,
    };
    state.projects.unshift(p);
    if (p.ideaId) {
      const idea = Store.idea(p.ideaId);
      if (idea) { idea.status = 'project'; idea.projectId = p.id; }
    }
    commit();
    return p;
  },
  project(id) { return state.projects.find((p) => p.id === id); },
  updateProject(id, patch) {
    const p = Store.project(id);
    if (p) { Object.assign(p, patch); commit(); }
    return p;
  },
  deleteProject(id) {
    const p = Store.project(id);
    if (p && p.ideaId) {
      const idea = Store.idea(p.ideaId);
      if (idea) { idea.status = 'incubator'; idea.projectId = null; }
    }
    tomb(id);
    state.projects = state.projects.filter((x) => x.id !== id);
    state.learning.forEach((l) => { l.projectIds = l.projectIds.filter((x) => x !== id); });
    commit();
  },
  toggleTask(projectId, milestoneId, taskId) {
    const m = Store.project(projectId)?.milestones.find((x) => x.id === milestoneId);
    const t = m?.tasks.find((x) => x.id === taskId);
    if (!t) return {};
    t.done = !t.done;
    t.doneAt = t.done ? now() : null;
    const wasDone = m.done;
    m.done = m.tasks.length > 0 && m.tasks.every((x) => x.done);
    m.doneAt = m.done ? (m.doneAt || now()) : null;
    commit();
    return { milestoneJustDone: !wasDone && m.done, milestone: m };
  },
  toggleMilestone(projectId, milestoneId) {
    const m = Store.project(projectId)?.milestones.find((x) => x.id === milestoneId);
    if (!m) return {};
    m.done = !m.done;
    m.doneAt = m.done ? now() : null;
    m.tasks.forEach((t) => { t.done = m.done; t.doneAt = m.done ? (t.doneAt || now()) : null; });
    commit();
    return { milestoneJustDone: m.done, milestone: m };
  },
  addTask(projectId, milestoneId, text) {
    const m = Store.project(projectId)?.milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    m.tasks.push({ id: uid(), text, done: false, doneAt: null, createdAt: now() });
    m.done = false;
    commit();
  },
  addMilestone(projectId, name) {
    const p = Store.project(projectId);
    if (!p) return;
    const last = p.milestones[p.milestones.length - 1];
    const start = last ? last.weekEnd : 0;
    p.milestones.push({ id: uid(), name, weekStart: start, weekEnd: start + 2, done: false, doneAt: null, tasks: [], startedAt: now() });
    commit();
  },

  // ---------- learning ----------
  addLearning(data) {
    const l = {
      id: uid(), topic: '', goal: '', milestones: [], resources: [], notes: '',
      projectIds: [], createdAt: now(), ...data,
    };
    state.learning.unshift(l);
    commit();
    return l;
  },
  learning(id) { return state.learning.find((l) => l.id === id); },
  updateLearning(id, patch) {
    const l = Store.learning(id);
    if (l) { Object.assign(l, patch); commit(); }
    return l;
  },
  deleteLearning(id) {
    tomb(id);
    state.learning = state.learning.filter((l) => l.id !== id);
    commit();
  },

  // ---------- misc ----------
  dismiss(key) {
    if (!state.dismissed.includes(key)) state.dismissed.push(key);
    commit();
  },
  chat(ideaId) { return state.chats[ideaId] || (state.chats[ideaId] = []); },
};

// ---------- derived helpers ----------
Store.ideaStage = function (idea) {
  // seed -> sprout -> plant -> bloom, driven by attention + connections + reflection
  // attention is capped so repeated clicks can't fake growth; connections and reflection matter more
  const score = Math.min(idea.attention || 0, 4)
    + idea.ideaIds.length * 2
    + idea.inspirationIds.length * 2
    + (idea.why ? 2 : 0)
    + (idea.notes ? 1 : 0)
    + (idea.questions?.length ? 1 : 0)
    + (idea.tags.length ? 1 : 0);
  if (score >= 10) return 'bloom';
  if (score >= 5) return 'plant';
  if (score >= 2) return 'sprout';
  return 'seed';
};
Store.STAGE_LABEL = { seed: 'Seed', sprout: 'Sprout', plant: 'Growing', bloom: 'Blooming' };

Store.projectProgress = function (p) {
  const tasks = p.milestones.flatMap((m) => m.tasks);
  if (tasks.length) return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
  if (!p.milestones.length) return 0;
  return Math.round((p.milestones.filter((m) => m.done).length / p.milestones.length) * 100);
};
Store.learningProgress = function (l) {
  const items = [...l.milestones, ...l.resources];
  if (!items.length) return 0;
  return Math.round((items.filter((x) => x.done).length / items.length) * 100);
};
Store.ideaTitle = function (idea) {
  if (idea.title) return idea.title;
  const t = idea.content.replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67).trimEnd() + '…' : t;
};
// main project = flagged one, else the oldest active; the rest are side projects
Store.activeProjects = function (s = state) {
  const active = s.projects.filter((p) => p.status === 'active');
  const main = active.find((p) => p.isMain) || active[active.length - 1]; // oldest stays main until changed
  return { main, side: active.filter((p) => p !== main) };
};

Store.daysSince =(iso) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
Store.uid = uid;
Store.now = now;
Store.DAY = DAY;

