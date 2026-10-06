// Onboarding: login (user's sketch) → interests → first idea → organize mode → garden legend.
import { Store } from '../core/store.js';
import { AI } from '../core/ai.js';
import { INTERESTS } from '../data/interests.js';
import { sampleGarden } from '../data/sample.js';
import { S, $, esc, STATUS_LABEL } from '../ui/util.js';
import { toast } from '../ui/components.js';
import { render } from '../ui/router.js';
import { ui } from '../ui/state.js';
import { GOOGLE_G } from './account.js';

const SPROUTS = `<svg class="login-sprouts" viewBox="0 0 240 200" aria-hidden="true">
  <g class="sway-slow"><path d="M112 200 C112 160 100 120 76 92" stroke="var(--stem)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="54" cy="90" rx="26" ry="11" transform="rotate(-8 54 90)" fill="var(--leaf)"/><ellipse cx="88" cy="70" rx="11" ry="24" transform="rotate(28 88 70)" fill="var(--leaf-hi)"/></g>
  <g class="sway"><path d="M124 200 C126 150 140 110 168 80" stroke="var(--stem)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="150" cy="62" rx="30" ry="12" transform="rotate(-22 150 62)" fill="var(--leaf-hi)"/><ellipse cx="190" cy="74" rx="28" ry="12" transform="rotate(14 190 74)" fill="var(--leaf)"/>
    <ellipse cx="176" cy="48" rx="10" ry="22" transform="rotate(30 176 48)" fill="var(--leaf)"/></g>
  <ellipse cx="118" cy="198" rx="70" ry="7" fill="var(--shadow-c)"/></svg>`;

export function viewOnboarding() {
  const u = S().user;
  const { onb } = ui;
  const dots = onb.step === 0 ? '' : `<div class="dots">${[1, 2, 3, 4].map((i) => `<span class="${i === onb.step ? 'on' : ''}"></span>`).join('')}</div>`;
  let body;
  if (onb.step === 0) {
    body = `<div class="login">
      <h1 class="login-title">Start blooming<br><span>your ideas</span></h1>
      <button class="login-btn" data-action="sign-in-google"><span class="login-word">Log in</span><span class="login-sub">${GOOGLE_G} with Google</span></button>
      <p class="login-alt">Don’t have an account yet? <button class="linkish" data-action="sign-in-google">Create account</button></p>
      <div class="login-or"><span>or</span></div>
      <button class="btn ghost" data-action="onb-next">Continue as a guest</button>
      <button class="linkish small" data-action="onb-sample">Peek at a sample garden</button>
      ${SPROUTS}
      <p class="fine">Guests keep their garden on this device and can sign in later. Nothing gets lost.</p></div>`;
  } else if (onb.step === 1) {
    body = `<h2>What are you curious about?</h2>
      <p class="lead">Pick a few. This only shapes Discover, and you can change it anytime.</p>
      <div class="chips big">${INTERESTS.map((i) => `<button class="chip${u.interests.includes(i.id) ? ' on' : ''}" data-action="toggle-interest" data-id="${i.id}">${i.emoji} ${i.label}</button>`).join('')}</div>
      <button class="btn primary lg" data-action="onb-next">Continue</button>
      <button class="btn ghost" data-action="onb-next">Skip</button>`;
  } else if (onb.step === 2) {
    body = `<h2>What’s something you’ve been thinking about lately?</h2>
      <p class="lead">Anything works: a half-idea, a question, a “what if…”.</p>
      <textarea class="capture-input" id="onb-text" rows="4" placeholder="What if restaurants let customers design their own tasting menu?" data-autofocus>${esc(onb.text)}</textarea>
      <button class="btn primary lg" data-action="onb-plant">Plant it 🌱</button>
      <button class="btn ghost" data-action="onb-skip-idea">Skip for now</button>`;
  } else if (onb.step === 3) {
    const idea = onb.ideaId && Store.idea(onb.ideaId);
    const sug = idea && u.organizeMode === 'ai' ? AI.organize(idea) : null;
    body = `<h2>Want help organizing it?</h2>
      <p class="lead">You can always change this later, idea by idea.</p>
      <div class="choice-list">
        ${[['self', 'I’ll organize it', 'Add my own tags and folders when I feel like it.'], ['ai', 'Help me organize it', 'Suggest tags, places and connections. I approve each one.'], ['later', 'Not now', 'Just keep it. I’ll decide later.']].map(([k, t, d]) => `
          <button class="choice${u.organizeMode === k ? ' on' : ''}" data-action="onb-mode" data-mode="${k}"><strong>${t}</strong><span>${d}</span></button>`).join('')}
      </div>
      ${sug ? `<div class="card soft"><div class="ai-label">Suggestions for your idea</div>
        ${sug.tags.length ? `<div class="chips">${sug.tags.map((t) => `<button class="chip${idea.tags.includes(t) ? ' on' : ''}" data-action="onb-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : '<p class="muted">No obvious tags yet. Your garden is still new.</p>'}
        ${sug.place ? `<p class="muted small">Suggested place: <strong>${STATUS_LABEL[sug.place.status]}</strong>. ${esc(sug.place.why)}</p>` : ''}</div>` : ''}
      <button class="btn primary lg" data-action="onb-next">Continue</button>`;
  } else {
    body = `<h2>This is your garden.</h2>
      <ul class="legend-list">
        <li><span>🌰→🌸</span><div><strong>Ideas are plants.</strong> They grow as you revisit, reflect on and connect them.</div></li>
        <li><span>🫙</span><div><strong>Glass cloches</strong> protect ideas growing in your terrarium.</div></li>
        <li><span>🌳</span><div><strong>Projects are trees.</strong> Each finished milestone grows a fruit 🍎.</div></li>
        <li><span>🦋</span><div><strong>Inspirations are butterflies.</strong> They visit the ideas they relate to.</div></li>
        <li><span>🌻</span><div><strong>Learning goals are sunflowers.</strong></div></li>
      </ul>
      <p class="lead">Not every idea needs to become a project. Some can stay small plants forever.</p>
      <button class="btn primary lg" data-action="onb-finish">Enter my garden</button>`;
  }
  return `<div class="onb">${dots}<div class="onb-body">${body}</div></div>`;
}

export const actions = {
  'onb-next': () => { ui.onb.step++; render(); },
  'onb-sample': () => { Store.replace(sampleGarden()); location.hash = '#/'; render(); toast('🌿 This is a sample garden. Reset it anytime under Account.'); },
  'onb-plant': () => {
    const text = $('#onb-text').value.trim();
    if (!text) return $('#onb-text').focus();
    if (ui.onb.ideaId) Store.updateIdea(ui.onb.ideaId, { content: text }, { touch: false });
    else ui.onb.ideaId = Store.addIdea(text).id;
    ui.onb.text = text;
    ui.onb.step = 3;
    render();
  },
  'onb-skip-idea': () => { ui.onb.step = 4; render(); },
  'onb-mode': (el) => { S().user.organizeMode = el.dataset.mode; Store.commit(); render(); },
  'onb-tag': (el) => {
    const i = Store.idea(ui.onb.ideaId);
    const t = el.dataset.tag;
    Store.updateIdea(i.id, { tags: i.tags.includes(t) ? i.tags.filter((x) => x !== t) : [...i.tags, t] }, { touch: false });
    render();
  },
  'onb-finish': () => { S().user.onboarded = true; Store.commit(); location.hash = '#/'; render(); },
};
