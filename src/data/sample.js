import { Store } from '../core/store.js';

// Optional demo garden (Account → Load sample garden / onboarding peek)
export function sampleGarden() {
  const ago = (d) => new Date(Date.now() - d * Store.DAY).toISOString();
  const id = Store.uid;
  const i1 = id(), i2 = id(), i3 = id(), i4 = id(), i5 = id(), i6 = id();
  const s1 = id(), s2 = id(), s3 = id(), s4 = id();
  const p1 = id(), l1 = id();
  const t = (text, done, d) => ({ id: id(), text, done, doneAt: done ? ago(d) : null, createdAt: ago(40) });
  return {
    version: 1,
    user: { name: '', interests: ['science', 'education', 'design', 'psychology', 'tech'], guest: true, onboarded: true, organizeMode: 'ask' },
    ideas: [
      { id: i1, title: 'Research papers students actually understand', content: 'Maybe I could create a website that helps students find research papers they actually understand — plain-language summaries next to the original paper.', tags: ['education', 'research'], folder: '', status: 'incubator', why: 'I remember being lost in papers as a first-year student.', notes: '', questions: ['Who is the very first person who would use this?'], ideaIds: [i4], inspirationIds: [s1, s2], projectId: null, attention: 4, createdAt: ago(45), updatedAt: ago(3) },
      { id: i2, title: 'Build Idea Garden MVP', content: 'A calm app to capture ideas, collect inspiration and grow ideas into projects — a garden instead of a database.', tags: ['tech', 'creativity'], folder: '', status: 'project', why: 'My notes are scattered everywhere.', notes: '', questions: [], ideaIds: [], inspirationIds: [s3], projectId: p1, attention: 8, createdAt: ago(60), updatedAt: ago(1) },
      { id: i3, title: '', content: 'What if restaurants let customers design their own tasting menu?', tags: ['food'], folder: '', status: 'vault', why: '', notes: '', questions: [], ideaIds: [], inspirationIds: [], projectId: null, attention: 0, createdAt: ago(38), updatedAt: ago(38) },
      { id: i4, title: '', content: 'A podcast where researchers explain their work to a 12-year-old', tags: [], folder: '', status: 'fresh', why: '', notes: '', questions: [], ideaIds: [i1], inspirationIds: [], projectId: null, attention: 1, createdAt: ago(9), updatedAt: ago(9) },
      { id: i5, title: '', content: 'Habit tracker that only asks one question a day', tags: [], folder: '', status: 'fresh', why: '', notes: '', questions: [], ideaIds: [], inspirationIds: [], projectId: null, attention: 0, createdAt: ago(2), updatedAt: ago(2) },
      { id: i6, title: '', content: 'Marketplace for independent researchers', tags: [], folder: '', status: 'vault', why: '', notes: '', questions: [], ideaIds: [], inspirationIds: [], projectId: null, attention: 0, createdAt: ago(50), updatedAt: ago(50) },
    ],
    inspirations: [
      { id: s1, url: 'https://theconversation.com/global', title: 'The Conversation: research explained by academics', type: 'article', note: '', caught: 'Translating complicated research into simple explanations.', apply: 'Research-literacy idea', ideaIds: [i1], projectIds: [], learningIds: [], createdAt: ago(20) },
      { id: s2, url: 'https://www.oercommons.org/', title: 'OER Commons: open educational resources', type: 'article', note: '', caught: '', apply: '', ideaIds: [i1], projectIds: [], learningIds: [], createdAt: ago(12) },
      { id: s3, url: 'https://zettelkasten.de/introduction/', title: 'Introduction to the Zettelkasten method', type: 'article', note: 'Linked small notes', caught: 'Ideas get value from links, not folders.', apply: 'Idea Garden connections', ideaIds: [i2], projectIds: [p1], learningIds: [], createdAt: ago(30) },
      { id: s4, url: 'https://doi.org/10.1037/0003-066X.54.7.493', title: 'Implementation intentions: strong effects of simple plans (Gollwitzer, 1999)', type: 'research', note: '', caught: '', apply: '', ideaIds: [], projectIds: [], learningIds: [], createdAt: ago(1) },
    ],
    projects: [
      { id: p1, name: 'Build Idea Garden MVP', goal: 'A working prototype that 5 friends use for two weeks', description: '', ideaId: i2, weeks: 16, hoursPerWeek: 8, startDate: ago(42), targetDate: null, status: 'active', estimateNote: '16 weeks at ~8 h/week is achievable for a focused first version, but not with extras. This is a rough estimate — we’ll adjust as you go.', createdAt: ago(42),
        milestones: [
          { id: id(), name: 'Define product', weekStart: 0, weekEnd: 2, done: true, doneAt: ago(30), startedAt: ago(42), tasks: [t('Write the product vision', true, 35), t('List the core loop', true, 31)] },
          { id: id(), name: 'Research', weekStart: 2, weekEnd: 4, done: true, doneAt: ago(18), startedAt: ago(30), tasks: [t('Review Notion, Obsidian, Apple Notes', true, 25), t('Interview 3 people about their notes', true, 18)] },
          { id: id(), name: 'Design MVP', weekStart: 4, weekEnd: 7, done: false, doneAt: null, startedAt: ago(18), tasks: [t('Sketch garden screen', true, 10), t('Design capture flow', false), t('Pick colours and type', false)] },
          { id: id(), name: 'Build core experience', weekStart: 7, weekEnd: 12, done: false, doneAt: null, startedAt: null, tasks: [t('Capture + idea list', false), t('Garden view', false)] },
          { id: id(), name: 'Test', weekStart: 12, weekEnd: 14, done: false, doneAt: null, startedAt: null, tasks: [t('Give to 5 friends', false)] },
          { id: id(), name: 'Launch', weekStart: 14, weekEnd: 16, done: false, doneAt: null, startedAt: null, tasks: [t('Write launch post', false)] },
        ] },
    ],
    learning: [
      { id: l1, topic: 'Learn app development', goal: 'Build and launch my first app', notes: '', projectIds: [p1], createdAt: ago(50),
        milestones: [
          { id: id(), name: 'Complete introductory course', done: true },
          { id: id(), name: 'Learn basic product design', done: true },
          { id: id(), name: 'Build a prototype', done: false },
          { id: id(), name: 'Launch', done: false },
        ],
        resources: [
          { id: id(), title: 'MDN: Getting started with the web', url: 'https://developer.mozilla.org/en-US/docs/Learn', type: 'course', done: true },
          { id: id(), title: 'Design thinking 101 (Nielsen Norman Group)', url: 'https://www.nngroup.com/articles/design-thinking/', type: 'article', done: true },
          { id: id(), title: 'How to remember anything forever-ish (Nicky Case)', url: 'https://ncase.me/remember/', type: 'article', done: false },
        ] },
    ],
    dismissed: [],
    chats: {},
  };
}
