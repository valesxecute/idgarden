// Real AI (Gemini, OpenAI-compatible API) via the garden-ai Edge Function (supabase/functions/garden-ai). Signed-in users only;
// callers fall back to the rule-based AI (core/ai.js) when unavailable or on error.
// Privacy: sends only the current idea + up to 5 related items per kind, never the whole garden.
import { Store } from './store.js';
import { Sync } from './sync.js';
import { AI } from './ai.js';
import cfg from '../config.js';

const ERRORS = {
  daily_limit: 'You’ve reached today’s AI limit. The simple assistant takes over until tomorrow.',
  sign_in_required: 'Sign in to use the AI assistant.',
  ai_not_configured: 'The AI assistant isn’t set up on the server yet.',
  busy: 'The AI is busy right now. Try again in a minute.',
};
// server has no OPENAI_API_KEY yet: stop asking for this session, quietly use the simple assistant
let serverOff = false;
async function call(body) {
  try { return await Sync.invoke('garden-ai', body); } catch (e) { if (e.code === 'ai_not_configured') serverOff = true; throw e; }
}

export const assistantErrorText = (e) => ERRORS[e?.code] || 'Couldn’t reach the AI, so the simple assistant answered instead.';

const ideaFields = (i) => ({ title: Store.ideaTitle(i), content: i.content, why: i.why, tags: i.tags, questions: i.questions, notes: i.notes });

function relatedFor(idea) {
  const st = Store.state;
  const linked = idea.ideaIds.map(Store.idea).filter(Boolean);
  const similar = AI.relatedIdeas(idea, { min: 2 }).map((r) => r.item);
  const ideas = [...new Set([...linked, ...similar])].slice(0, 5).map((x) => ({ title: Store.ideaTitle(x), content: x.content }));
  const insps = [...idea.inspirationIds.map(Store.inspiration).filter(Boolean), ...AI.relatedInspirationsForIdea(idea).map((r) => r.item)]
    .slice(0, 5).map((s) => ({ title: s.title, caught: s.caught, note: s.note }));
  return {
    ideas,
    inspirations: insps,
    learning: st.learning.slice(0, 5).map((l) => ({ topic: l.topic, goal: l.goal })),
    projects: st.projects.filter((p) => p.status === 'active').slice(0, 5).map((p) => ({ name: p.name })),
  };
}

export const Assistant = {
  available: () => !!cfg.ai && !serverOff && Sync.enabled && !!Sync.user && Store.state.user.aiEnabled !== false,

  // → { text, questions } in the same shape as AI.think()
  async think(mode, idea, text = '') {
    const history = Store.chat(idea.id).filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text }));
    const res = await call({ task: 'think', mode, text, idea: ideaFields(idea), related: relatedFor(idea), history });
    if (res.refusal) return { text: 'I can’t help with that one. Try a different angle?', questions: [] };
    return { text: res.reply, questions: res.questions?.length ? res.questions : undefined, keep: true, action: mode === 'plan' ? 'to-project' : undefined, by: 'ai' };
  },

  // → same shape as AI.organize(): { title, tags[], place, related[{item, why}], insps[{item, why}] }
  // candidates come from AI.related* (embeddings when ready), so only ≤8 per kind leave the device
  async organize(idea) {
    const st = Store.state;
    const ideas = AI.relatedIdeas(idea, { min: 1, limit: 8 }).map((r) => r.item);
    const insps = AI.relatedInspirationsForIdea(idea, { min: 1, limit: 8 }).map((r) => r.item);
    const res = await call({
      task: 'organize',
      idea: { ...ideaFields(idea), status: idea.status },
      gardenTags: [...new Set(st.ideas.flatMap((i) => i.tags))],
      ideas: ideas.map((x) => ({ id: x.id, title: Store.ideaTitle(x), content: x.content })),
      inspirations: insps.map((s) => ({ id: s.id, title: s.title, note: s.note })),
    });
    if (res.refusal) throw Object.assign(new Error('refused'), { code: 'refused' });
    const pick = (links, pool) => (links || []).map((l) => ({ item: pool.find((x) => x.id === l.id), why: l.why })).filter((r) => r.item).slice(0, 3);
    const tags = [...new Set((res.tags || []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 4);
    const place = res.place?.status && res.place.status !== 'stay' && idea.status === 'fresh' ? res.place : null;
    return { title: idea.title ? null : res.title?.trim() || null, tags, place, related: pick(res.related, ideas), insps: pick(res.inspirations, insps), by: 'ai' };
  },

  // → same shape as AI.plan(): { kind, milestones[], estimateNote, firstSteps[] }
  async plan({ idea, name, goal, done, weeks, hoursPerWeek }) {
    const res = await call({
      task: 'plan', name, goal, done, weeks, hoursPerWeek,
      idea: idea ? { content: idea.content, why: idea.why } : null,
      learning: Store.state.learning.map((l) => l.topic),
    });
    if (res.refusal || !res.milestones?.length) throw Object.assign(new Error('no_plan'), { code: 'no_plan' });
    // weeks → weekStart/weekEnd, scaled to the chosen total if the model's sum is off
    const sum = res.milestones.reduce((a, m) => a + Math.max(1, m.weeks | 0), 0);
    let cursor = 0;
    const milestones = res.milestones.map((m, k) => {
      const span = Math.max(1, Math.round((Math.max(1, m.weeks | 0) / sum) * weeks));
      const ms = {
        id: Store.uid(), name: m.name, weekStart: cursor, weekEnd: Math.min(weeks, cursor + span), done: false, doneAt: null,
        startedAt: k === 0 ? Store.now() : null,
        tasks: m.tasks.map((t) => ({ id: Store.uid(), text: t, done: false, doneAt: null, createdAt: Store.now() })),
      };
      cursor = ms.weekEnd;
      return ms;
    });
    milestones[milestones.length - 1].weekEnd = weeks;
    return { kind: 'ai', milestones, estimateNote: res.estimateNote, firstSteps: res.firstSteps.slice(0, 3) };
  },
};
