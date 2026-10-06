// Real AI (OpenAI) via the garden-ai Edge Function (supabase/functions/garden-ai). Signed-in users only;
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
  available: () => !!cfg.ai && Sync.enabled && !!Sync.user && Store.state.user.aiEnabled !== false,

  // → { text, questions } in the same shape as AI.think()
  async think(mode, idea, text = '') {
    const history = Store.chat(idea.id).filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text }));
    const res = await Sync.invoke('garden-ai', { task: 'think', mode, text, idea: ideaFields(idea), related: relatedFor(idea), history });
    if (res.refusal) return { text: 'I can’t help with that one. Try a different angle?', questions: [] };
    return { text: res.reply, questions: res.questions?.length ? res.questions : undefined, keep: true, action: mode === 'plan' ? 'to-project' : undefined, by: 'ai' };
  },

  // → same shape as AI.plan(): { kind, milestones[], estimateNote, firstSteps[] }
  async plan({ idea, name, goal, done, weeks, hoursPerWeek }) {
    const res = await Sync.invoke('garden-ai', {
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
