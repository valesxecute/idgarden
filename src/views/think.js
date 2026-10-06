// Think With Me: chat about one idea (rule-based assistant for now, see core/ai.js).
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { S, esc, md } from '../ui/util.js';
import { toast } from '../ui/components.js';
import { render, go } from '../ui/router.js';
import { ideaCard } from './ideas.js';

const MODES = [['brainstorm', '💡 Brainstorm'], ['develop', '🌱 Develop'], ['questions', '❓ Ask me questions'], ['challenge', '⚡ Challenge it'], ['connect', '🔗 Connect'], ['inspire', '🦋 Inspire me'], ['plan', '🗺️ Plan']];

function viewThink({ a: id }) {
  const i = id && id !== 'pick' ? Store.idea(id) : null;
  if (!i) {
    const ideas = S().ideas.filter((x) => x.status !== 'archived');
    return `<header class="page-head"><h1>Think with me</h1></header><p class="lead">Which idea do you want to think about?</p>
      ${ideas.length ? `<div class="list">${ideas.map((x) => ideaCard(x, `#/think/${x.id}`)).join('')}</div>` : '<div class="empty-state"><p>Capture an idea first, then we can think about it together.</p></div>'}`;
  }
  const msgs = Store.chat(i.id);
  return `
    <a class="back" href="#/idea/${i.id}">← Back to idea</a>
    <header class="think-head"><p class="eyebrow">Thinking about</p><h2>${esc(Store.ideaTitle(i))}</h2></header>
    <div class="chat-log">
      ${msgs.length ? '' : '<div class="msg ai"><p>I can see this idea, plus related ideas, inspirations and learning in your garden. Where do you want to start?</p></div>'}
      ${msgs.map((m, k) => (m.role === 'user' ? `<div class="msg user"><p>${esc(m.text)}</p></div>` : `<div class="msg ai"><p>${md(m.text)}</p>
        ${m.questions ? m.questions.map((q) => `<div class="q-sug"><span>${esc(q)}</span>${i.questions.includes(q) ? '<span class="muted small">saved</span>' : `<button class="btn sm" data-action="save-q" data-id="${i.id}" data-q="${esc(q)}">Save</button>`}</div>`).join('') : ''}
        ${m.keep && !m.kept ? `<button class="btn sm ghost" data-action="keep-msg" data-id="${i.id}" data-k="${k}">📌 Keep in notes</button>` : ''}${m.kept ? '<span class="muted small">📌 kept in notes</span>' : ''}
        ${m.action === 'to-project' ? `<a class="btn sm primary" href="#/new-project/${i.id}">🌳 Turn into project</a>` : ''}</div>`)).join('')}
    </div>
    <div class="chips modes">${MODES.map(([k, l]) => `<button class="chip" data-action="think-mode" data-id="${i.id}" data-mode="${k}">${l}</button>`).join('')}</div>
    <div class="chat-input"><input placeholder="Say anything about this idea…" data-enter="think-say" data-id="${i.id}" data-autofocus><button class="btn primary" data-action="think-say-btn" data-id="${i.id}">Send</button></div>
    <p class="fine">Prototype assistant: rule-based and runs on your device. A real AI model plugs in here later, using the same garden context.</p>`;
}

function say(el) {
  const text = el.value.trim();
  if (!text) return;
  const i = Store.idea(el.dataset.id);
  Store.chat(i.id).push({ role: 'user', text }, { role: 'ai', ...AI.think('free', i, text) });
  Store.updateIdea(i.id, {}, { touch: true });
  render(true);
}

export const views = { think: viewThink };

export const actions = {
  'think-any': () => go('#/think/pick'),
  'think-mode': (el) => {
    const i = Store.idea(el.dataset.id);
    const label = el.textContent.replace(/^\S+\s/, '');
    Store.chat(i.id).push({ role: 'user', text: label }, { role: 'ai', ...AI.think(el.dataset.mode, i) });
    Store.updateIdea(i.id, {}, { touch: true });
    render(true);
  },
  'think-say-btn': (el) => say(el.previousElementSibling),
  'keep-msg': (el) => {
    const i = Store.idea(el.dataset.id);
    const msgs = Store.chat(i.id);
    const m = msgs[+el.dataset.k];
    const prev = msgs[+el.dataset.k - 1];
    const plain = m.text.replace(/\*\*/g, '');
    const fromMode = MODES.some(([, l]) => l.replace(/^\S+\s/, '') === prev?.text);
    m.kept = true;
    Store.updateIdea(i.id, { notes: (i.notes ? i.notes + '\n\n' : '') + (prev?.role === 'user' && !fromMode ? `${prev.text} → ${plain}` : plain) });
    render(true);
    toast('📌 Kept in the idea’s notes.');
  },
  'save-q': (el) => {
    const i = Store.idea(el.dataset.id);
    if (!i.questions.includes(el.dataset.q)) Store.updateIdea(i.id, { questions: [...i.questions, el.dataset.q] });
    render(true);
  },
};

export const enter = { 'think-say': say };
