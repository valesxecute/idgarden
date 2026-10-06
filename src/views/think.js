// Think With Me: chat about one idea (rule-based assistant for now, see core/ai.js).
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { Claude, claudeErrorText } from '../core/claude.js';
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
  if (!busy) for (let k = msgs.length - 1; k >= 0; k--) if (msgs[k].pending) msgs.splice(k, 1); // left over from a closed page
  return `
    <a class="back" href="#/idea/${i.id}">← Back to idea</a>
    <header class="think-head"><p class="eyebrow">Thinking about</p><h2>${esc(Store.ideaTitle(i))}</h2></header>
    <div class="chat-log">
      ${msgs.length ? '' : '<div class="msg ai"><p>I can see this idea, plus related ideas, inspirations and learning in your garden. Where do you want to start?</p></div>'}
      ${msgs.map((m, k) => (m.role === 'user' ? `<div class="msg user"><p>${esc(m.text)}</p></div>` : m.pending ? '<div class="msg ai pending"><p><span class="dots-anim"><i></i><i></i><i></i></span> Claude is thinking…</p></div>' : `<div class="msg ai"><p>${md(m.text)}</p>
        ${m.note ? `<p class="muted small">${esc(m.note)}</p>` : ''}
        ${m.questions ? m.questions.map((q) => `<div class="q-sug"><span>${esc(q)}</span>${i.questions.includes(q) ? '<span class="muted small">saved</span>' : `<button class="btn sm" data-action="save-q" data-id="${i.id}" data-q="${esc(q)}">Save</button>`}</div>`).join('') : ''}
        ${m.keep && !m.kept ? `<button class="btn sm ghost" data-action="keep-msg" data-id="${i.id}" data-k="${k}">📌 Keep in notes</button>` : ''}${m.kept ? '<span class="muted small">📌 kept in notes</span>' : ''}
        ${m.action === 'to-project' ? `<a class="btn sm primary" href="#/new-project/${i.id}">🌳 Turn into project</a>` : ''}</div>`)).join('')}
    </div>
    <div class="chips modes">${MODES.map(([k, l]) => `<button class="chip" data-action="think-mode" data-id="${i.id}" data-mode="${k}">${l}</button>`).join('')}</div>
    <div class="chat-input"><input placeholder="Say anything about this idea…" data-enter="think-say" data-id="${i.id}" data-autofocus><button class="btn primary" data-action="think-say-btn" data-id="${i.id}">Send</button></div>
    <p class="fine">${Claude.available() ? '✨ Claude · sees this idea plus a few related items from your garden, never the whole garden.' : 'Simple assistant (runs on your device). Sign in to think with Claude.'}</p>`;
}

// one exchange: Claude when available (pending bubble while waiting), rule-based otherwise or on error
let busy = false;
async function exchange(idea, mode, userText, extraText = '') {
  if (busy) return;
  const chat = Store.chat(idea.id);
  chat.push({ role: 'user', text: userText });
  if (!Claude.available()) {
    chat.push({ role: 'ai', ...AI.think(mode, idea, extraText) });
    Store.updateIdea(idea.id, {}, { touch: true });
    return render(true);
  }
  busy = true;
  const pending = { role: 'ai', pending: true, text: '' };
  chat.push(pending);
  render(true);
  let reply;
  try {
    reply = await Claude.think(mode, idea, extraText);
  } catch (e) {
    reply = { ...AI.think(mode, idea, extraText), note: claudeErrorText(e) };
  }
  busy = false;
  chat.splice(chat.indexOf(pending), 1, { role: 'ai', ...reply });
  Store.updateIdea(idea.id, {}, { touch: true });
  render(true);
}

function say(el) {
  const text = el.value.trim();
  if (!text) return;
  exchange(Store.idea(el.dataset.id), 'free', text, text);
}

export const views = { think: viewThink };

export const actions = {
  'think-any': () => go('#/think/pick'),
  'think-mode': (el) => exchange(Store.idea(el.dataset.id), el.dataset.mode, el.textContent.replace(/^\S+\s/, '')),
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
