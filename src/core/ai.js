// Garden assistant. Prototype = rule-based + keyword similarity, fully offline.
// Every public function returns plain data, so swapping in an LLM later means
// replacing the bodies (see plans/ai.md) without touching the UI.
import { Store } from './store.js';
import { Discover } from '../data/discover.js';

const STOP = new Set(('a an and are as at be but by can could do for from had has have how i if in into is it its just like make maybe me more my no not of on or our out over so some than that the their them then there these they thing things this to too up us was we what when where which who why will with would you your about also really get got want could should very much many one way new use using people someone something lot really able need let help idea ideas').split(' '));

const stem = (w) => w
  .replace(/(ings|ing)$/, '')
  .replace(/(ies)$/, 'y')
  .replace(/(ers|er)$/, '')
  .replace(/(ed)$/, '')
  .replace(/(es)$/, '')
  .replace(/s$/, '');

function tokens(text) {
  return (text || '').toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 2);
}

const TOPICS = {
  tech: 'app software website web code coding program build platform tool digital ai algorithm data api mobile prototype mvp dashboard tracker model',
  food: 'restaurant food menu cook cooking recipe chef meal kitchen tasting cafe',
  education: 'student learn learning research paper study teach school course university academic lesson understand literacy',
  health: 'health sleep habit fitness exercise wellbeing mental stress diet nutrition',
  design: 'design visual art illustration typography interface layout architecture aesthetic color',
  business: 'business market marketplace customer startup sell product revenue price brand company client',
  writing: 'write writing book essay story blog newsletter article publish author',
  psychology: 'psychology behavior behaviour mind motivation emotion cognitive bias attention',
  culture: 'music film culture museum game games community travel city',
  science: 'science climate biology physics chemistry experiment nature environment',
  creativity: 'creative creativity brain note notes knowledge garden inspiration thinking',
  media: 'podcast video youtube channel episode episodes audio documentary',
};
const TOPIC_TOKENS = Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, new Set(v.split(' ').map(stem))]));

function topicsOf(text) {
  const t = tokens(text);
  const scores = Object.entries(TOPIC_TOKENS)
    .map(([k, set]) => [k, t.filter((w) => set.has(w)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return scores.map(([k]) => k);
}

function keywords(text, n = 4) {
  const counts = {};
  (text || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map(([w]) => w);
}

// shared stems + shared topics; returns {score, shared}
function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  const shared = [...A].filter((w) => B.has(w));
  const ta = topicsOf(a), tb = topicsOf(b);
  const sharedTopics = ta.filter((t) => tb.includes(t));
  return { score: shared.length * 2 + sharedTopics.length, shared, sharedTopics };
}

// notes are excluded: they collect kept assistant text, which made everything look related
const ideaText = (i) => [i.title, i.content, i.why, i.tags.join(' ')].join(' ');
const inspText = (s) => [s.title, s.note, s.caught, s.apply].join(' ');
const projText = (p) => [p.name, p.goal, p.description].join(' ');
const learnText = (l) => [l.topic, l.goal, l.notes, l.resources.map((r) => r.title).join(' ')].join(' ');

function rank(text, items, toText, { exclude = [], min = 2, limit = 3 } = {}) {
  return items
    .filter((x) => !exclude.includes(x.id))
    .map((x) => ({ item: x, ...similarity(text, toText(x)) }))
    .filter((r) => r.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const reason = (r) => r.shared.length
  ? `both mention “${r.shared.slice(0, 2).join('”, “')}”`
  : `both touch on ${r.sharedTopics[0]}`;

export const AI = {
  tokens, topicsOf, keywords, similarity, reason,

  relatedIdeas(idea, opts) {
    const s = Store.state;
    return rank(ideaText(idea), s.ideas.filter((i) => i.status !== 'archived'), ideaText,
      { exclude: [idea.id, ...idea.ideaIds], ...opts });
  },
  relatedInspirationsForIdea(idea, opts) {
    return rank(ideaText(idea), Store.state.inspirations, inspText, { exclude: idea.inspirationIds, ...opts });
  },
  ideasForInspiration(insp, opts) {
    return rank(inspText(insp), Store.state.ideas.filter((i) => i.status !== 'archived'), ideaText,
      { exclude: insp.ideaIds, ...opts });
  },
  projectsForInspiration(insp, opts) {
    return rank(inspText(insp), Store.state.projects, projText, { exclude: insp.projectIds, ...opts });
  },
  learningForProject(p, opts) {
    return rank(projText(p), Store.state.learning, learnText, { min: 1, ...opts });
  },
  inspirationsForProject(p, opts) {
    return rank(projText(p), Store.state.inspirations, inspText, { exclude: Store.state.inspirations.filter((s) => s.projectIds.includes(p.id)).map((s) => s.id), ...opts });
  },
  inspirationsForLearning(l, opts) {
    return rank(learnText(l), Store.state.inspirations, inspText, opts);
  },

  suggestTags(idea) {
    const topics = topicsOf(ideaText(idea)).slice(0, 2);
    const kws = keywords(idea.content, 3).filter((k) => !topics.includes(k));
    return [...new Set([...topics, ...kws])].filter((t) => !idea.tags.includes(t)).slice(0, 4);
  },

  // "Organize with AI": suggestions the user accepts one by one
  organize(idea) {
    const tags = AI.suggestTags(idea);
    const related = AI.relatedIdeas(idea);
    const insps = AI.relatedInspirationsForIdea(idea);
    const words = idea.content.split(/\s+/).length;
    let place = null;
    if (idea.status === 'fresh') {
      if (words > 25 || related.length >= 2 || insps.length >= 1) {
        place = { status: 'incubator', why: 'It already has some depth and connections — worth developing.' };
      } else if (words < 10) {
        place = { status: 'vault', why: 'It’s a short spark. Park it safely; I’ll resurface it if something related shows up.' };
      }
    }
    let title = null;
    if (!idea.title && words > 12) {
      const kw = keywords(idea.content, 3);
      if (kw.length >= 2) title = kw.map((w) => w[0].toUpperCase() + w.slice(1)).join(' · ');
    }
    return { tags, related, insps, place, title };
  },

  // "Think With Me"
  think(mode, idea, userText) {
    const title = Store.ideaTitle(idea);
    const kw = keywords(ideaText(idea), 4);
    const k0 = kw[0] || 'this', k1 = kw[1] || 'it';
    const related = AI.relatedIdeas(idea, { min: 1 }).concat(idea.ideaIds.map((id) => ({ item: Store.idea(id), shared: [], sharedTopics: ['a link you made'] })).filter((r) => r.item));
    const insps = idea.inspirationIds.map((id) => Store.inspiration(id)).filter(Boolean);
    const learning = Store.state.learning.filter((l) => similarity(ideaText(idea), learnText(l)).score >= 1);
    const topics = topicsOf(ideaText(idea));

    switch (mode) {
      case 'brainstorm': {
        const lines = [
          `**Smallest version:** what would “${title}” look like if you could only spend one weekend on it?`,
          `**Different audience:** who besides the obvious user would care about ${k0}? Try designing it for them instead.`,
          `**Flip it:** what if the ${k1} side were the main product and ${k0} only a feature?`,
          `**No-tech version:** could you test the core of this with paper, a spreadsheet, or a conversation first?`,
        ];
        if (related[0]) lines.push(`**Combine:** cross it with your idea “${Store.ideaTitle(related[0].item)}” — what does the hybrid look like?`);
        if (insps[0]) lines.push(`**Borrow:** you saved “${insps[0].title}”. What would this idea look like done in that style?`);
        return { text: `A few directions to poke at:\n\n${lines.map((l) => '• ' + l).join('\n')}`, keep: true };
      }
      case 'develop': {
        return {
          text: `Let’s sharpen it into a one-line concept. Try filling this in:\n\n**For** [who] **who** [struggle], “${title}” **is a** [what] **that** [key benefit]. **Unlike** [current alternative], it [difference].\n\n${idea.why ? `You said it matters because: “${idea.why}”. That’s probably your “key benefit”.` : 'Tip: write a line in “Why it interests me” — it often becomes the key benefit.'}`,
          keep: true,
        };
      }
      case 'questions': {
        const qs = [
          `Who is the very first person who would use or benefit from this?`,
          `What problem does it solve that ${k0} doesn’t already solve today?`,
          `What would make you confident this is worth a month of your time?`,
          `What’s the riskiest assumption here?`,
          `What does “done” look like for a first version?`,
        ];
        return { text: `Questions worth answering (you can save them to the idea):`, questions: qs };
      }
      case 'challenge': {
        const lines = [
          `**Does this already exist?** Search for “${kw.slice(0, 2).join(' ')}” before building — if it exists, what would make yours different?`,
          `**Is the need real or assumed?** Have you seen someone struggle with this, or is it a guess?`,
          `**Scope creep risk:** ideas around ${topics[0] || k0} tend to grow. What would you cut first?`,
          `**Why you?** What do you know or have that makes you the right person to try this?`,
        ];
        return { text: `Playing devil’s advocate — not to kill it, just to stress-test:\n\n${lines.map((l) => '• ' + l).join('\n')}`, keep: true };
      }
      case 'connect': {
        const parts = [];
        if (related.length) parts.push(`**Ideas:**\n${related.slice(0, 3).map((r) => `• “${Store.ideaTitle(r.item)}” — ${r.shared.length || r.sharedTopics.length ? reason(r) : 'linked'}`).join('\n')}`);
        if (insps.length) parts.push(`**Inspirations already attached:**\n${insps.map((s) => `• ${s.title}`).join('\n')}`);
        const moreInsps = AI.relatedInspirationsForIdea(idea, { min: 1 });
        if (moreInsps.length) parts.push(`**Saved inspirations that might relate:**\n${moreInsps.map((r) => `• ${r.item.title} — ${reason(r)}`).join('\n')}`);
        if (learning.length) parts.push(`**Learning:**\n${learning.map((l) => `• You’re learning “${l.topic}” — could feed straight into this.`).join('\n')}`);
        return { text: parts.length ? `Here’s what in your garden touches this idea:\n\n${parts.join('\n\n')}` : `Nothing in your garden clearly relates yet. As you save inspirations and ideas, I’ll point out overlaps here.` };
      }
      case 'inspire': {
        const text = ideaText(idea);
        const picks = Discover.items
          .map((d) => ({ d, ...similarity(text, Discover.text(d)) }))
          .sort((a, b) => b.score - a.score);
        const close = picks.filter((x) => x.score >= 4).slice(0, 2);
        const wild = picks.filter((x) => x.score === 0);
        const far = wild[(idea.content.length + Store.chat(idea.id).length) % Math.max(1, wild.length)];
        const lines = close.map((x) => `• **${x.d.title}** (${x.d.source}): ${x.d.excerpt}`);
        if (far) lines.push(`• Something different: **${far.d.title}** (${far.d.source}). What would this idea borrow from it?`);
        return { text: lines.length ? `A few things to feed this idea (save them from Discover):\n\n${lines.join('\n')}` : 'I don’t have anything close yet. Try Discover → Something different.', keep: true };
      }
      case 'plan': {
        return { text: `Ready to make it real? I can draft a roadmap with first steps, milestones and a rough timeline — or we can build it together. Tap **Turn into project** below.`, action: 'to-project' };
      }
      default: {
        const t = userText || '';
        const userKw = keywords(t, 2);
        const echo = userKw.length ? `“${userKw.join('” and “')}”` : 'that';
        const followups = [
          `What made you think of ${echo}?`,
          `How would ${echo} change what you build first?`,
          `If ${echo} turned out to be wrong, would the idea still hold?`,
          `Who would care most about ${echo}?`,
        ];
        const q = followups[t.length % followups.length];
        return { text: `Noted — I’ll keep ${echo} in mind for this idea. ${q}`, keep: true };
      }
    }
  },

  // Project plan generator. Honest about uncertainty.
  plan({ idea, name, goal, weeks, hoursPerWeek, done }) {
    const text = [name, goal, done, idea ? ideaText(idea) : ''].join(' ');
    const topics = topicsOf(text);
    const kind = topics.includes('media') ? 'media'
      : topics.includes('tech') ? 'software'
      : topics.includes('writing') ? 'writing'
      : topics.includes('business') || topics.includes('food') ? 'venture'
      : topics.includes('education') ? 'research'
      : 'general';
    const k = keywords(text, 3);
    const subject = k[0] || 'the idea';

    const TEMPLATES = {
      software: [
        ['Define the core', 1, ['Write a one-paragraph description of the problem', `List 3 people who might use ${name}`, 'Decide the ONE thing v1 must do']],
        ['Research', 1.5, [`Look up 3 existing tools similar to ${subject}`, 'Talk to 2–3 potential users (15 min each)', 'Write down what surprised you']],
        ['Design the MVP', 2, ['Sketch the main screens on paper', 'Map the core user flow end-to-end', 'Cut anything that isn’t needed for the core flow']],
        ['Build the core experience', 4, ['Set up the project and tools', 'Build the core flow, ugly is fine', 'Make it work on a phone']],
        ['Test with real people', 1.5, ['Give it to 3–5 people', 'Watch them use it without helping', 'Fix the top 3 problems']],
        ['Launch', 1, ['Write a short launch post', 'Share it with the people who helped', 'Decide what v2 should be']],
      ],
      writing: [
        ['Shape the idea', 1, ['Write the main argument in one sentence', 'Decide who you’re writing for', 'Pick a working title']],
        ['Research & collect', 2, [`Gather 5 sources on ${subject}`, 'Pull quotes and notes into one place', 'Find one surprising angle']],
        ['Outline', 1, ['Draft a section-by-section outline', 'Move sections around until it flows']],
        ['First draft', 4, ['Write without editing', 'Aim for done, not good', 'Mark gaps with [TODO]']],
        ['Revise', 2, ['Read it out loud', 'Get feedback from 2 readers', 'Cut 10%']],
        ['Publish', 1, ['Final proofread', 'Choose where to publish', 'Share it']],
      ],
      media: [
        ['Define the show', 1, ['Describe the show in one sentence', 'Decide who it’s for', `List 10 possible episode topics about ${subject}`]],
        ['Research the format', 1, ['Watch or listen to 3 similar shows', 'Note what you’d copy and what you’d avoid']],
        ['Pilot episode', 2.5, ['Pick the easiest episode to make first', 'Record a rough version with the gear you have', 'Get feedback from 2 people']],
        ['Batch first episodes', 3, ['Plan the next 3 episodes', 'Record them', 'Edit lightly. Done beats polished.']],
        ['Publish', 1.5, ['Choose a platform', 'Publish the first episodes', 'Share them with people who’d care']],
      ],
      venture: [
        ['Clarify the offer', 1, ['Describe who it’s for and what they get', `Write down why ${subject} is interesting now`]],
        ['Validate demand', 2, ['Talk to 5 potential customers', 'Ask what they use today and what it costs them', 'Note any “I’d pay for that” moments']],
        ['Design a small test', 1.5, ['Pick the cheapest way to test the idea (pop-up, landing page, pilot)', 'Define what result would convince you']],
        ['Run the pilot', 3, ['Prepare the minimum materials', 'Run it with a handful of real people', 'Collect feedback right away']],
        ['Review & decide', 1, ['Compare results against your success criteria', 'Decide: stop, change, or scale']],
      ],
      research: [
        ['Frame the question', 1, ['Write your question in one sentence', 'Decide what a useful answer looks like']],
        ['Literature & examples', 2, [`Find 5 good sources on ${subject}`, 'Summarize each in 3 lines', 'Note what’s missing']],
        ['Design an approach', 1.5, ['Pick a method (interviews, prototype, experiment)', 'List what you need to start']],
        ['Do the work', 3, ['Collect data or build the thing', 'Keep a short weekly log']],
        ['Make sense of it', 1.5, ['Write up what you found', 'Share with one person for feedback']],
      ],
      general: [
        ['Clarify', 1, ['Write what success looks like', 'List what you already have (skills, tools, people)']],
        ['Explore', 1.5, [`Research 3 examples of similar things to ${subject}`, 'Collect inspiration in your garden']],
        ['First version', 3, ['Make the roughest possible version', 'Show it to someone']],
        ['Improve', 2, ['Pick the top 3 improvements', 'Do them']],
        ['Share / finish', 1, ['Decide where it lives', 'Share it and reflect']],
      ],
    };

    const tpl = TEMPLATES[kind];
    const totalWeight = tpl.reduce((a, [, w]) => a + w, 0);
    let cursor = 0;
    const milestones = tpl.map(([title, w, tasks], idx) => {
      const span = Math.max(1, Math.round((w / totalWeight) * weeks));
      const ms = {
        id: Store.uid(), name: title, weekStart: cursor, weekEnd: Math.min(weeks, cursor + span),
        done: false, doneAt: null, startedAt: idx === 0 ? Store.now() : null,
        tasks: tasks.map((t) => ({ id: Store.uid(), text: t, done: false, doneAt: null, createdAt: Store.now() })),
      };
      cursor = ms.weekEnd;
      return ms;
    });
    if (milestones.length) milestones[milestones.length - 1].weekEnd = weeks;

    const needed = { media: 60, software: 120, writing: 70, venture: 80, research: 80, general: 50 }[kind];
    const available = weeks * hoursPerWeek;
    const ratio = available / needed;
    let estimateNote;
    if (ratio >= 1.4) estimateNote = `${weeks} weeks at ~${hoursPerWeek} h/week looks comfortable for a focused first version. You may even finish early — I’ll suggest pulling milestones forward if that happens.`;
    else if (ratio >= 0.8) estimateNote = `${weeks} weeks at ~${hoursPerWeek} h/week is achievable for a focused first version, but not with extras. This is a rough estimate — we’ll adjust as you go.`;
    else estimateNote = `${weeks} weeks at ~${hoursPerWeek} h/week is tight for this kind of project (rough guess: it usually takes ~${needed} focused hours; you have ~${available}). Consider cutting scope, adding time, or treating the end goal as a prototype.`;

    const firstSteps = milestones[0].tasks.slice(0, 3).map((t) => t.text);
    return { kind, milestones, estimateNote, firstSteps };
  },

  // collaborative-planning questions
  planQuestions(idea) {
    return [
      { key: 'done', q: 'What does “done” look like for the first version?', placeholder: 'e.g. 10 friends using it weekly' },
      { key: 'weeks', q: 'Roughly how long do you want this to take?', type: 'weeks' },
      { key: 'hoursPerWeek', q: 'How many hours a week can you realistically give it?', type: 'hours' },
    ];
  },
};

