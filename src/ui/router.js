// Hash router + app shell (bottom nav on every screen size, one add button per section).
import { S, $, avatarHTML, syncDot } from './util.js';
import { icon } from './icons.js';
import { Sync } from '../core/sync.js';

const views = {}; // route name → (params) => html
let onboardingView = () => '';
const afterRender = new Set(); // (route) => void, e.g. mount the persistent 3D canvas
export const registerViews = (map) => Object.assign(views, map);
export const onRendered = (fn) => afterRender.add(fn);
export const registerOnboarding = (fn) => { onboardingView = fn; };

export function route() {
  const [name = '', a, b] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name === 'settings' ? 'account' : name, a, b };
}
export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

const TABS = [
  ['', 'Garden', '🌳', ['']],
  ['ideas', 'Ideas', '💡', ['ideas', 'idea', 'think']],
  ['discover', 'Discover', '🦋', ['discover', 'inspiration']],
  ['projects', 'Projects', '🍎', ['projects', 'project', 'new-project']],
  ['learn', 'Learn', '🌻', ['learn']],
];
// section → add button (Garden has the big flower on the page itself; Account has none)
const ADD = {
  ideas: ['flower', 'capture', 'Add idea'],
  discover: ['butterfly', 'save-insp', 'Save inspiration'],
  projects: ['apple', 'new-project', 'New project'],
  learn: ['sunflower', 'new-learning', 'New learning goal'],
};
export const tabOf = (name) => (TABS.find(([, , , names]) => names.includes(name)) || [name])[0];

function shell(content, name) {
  const tab = tabOf(name);
  const link = ([k, label, emoji]) => `<a href="#/${k}" class="nav-link${tab === k ? ' active' : ''}"><span class="nav-ic" aria-hidden="true">${emoji}</span><span>${label}</span></a>`;
  const add = name !== 'new-project' && ADD[tab];
  return `
    <main class="main">${content}</main>
    ${add ? `<button class="fab" data-action="${add[1]}" aria-label="${add[2]}" title="${add[2]}">${icon(add[0])}</button>` : ''}
    <nav class="tabbar"><div class="tabbar-inner">
      ${TABS.map(link).join('')}
      <a href="#/account" class="nav-link${tab === 'account' ? ' active' : ''}"><span class="nav-ic tab-avatar" aria-hidden="true">${avatarHTML('xs')}${Sync.user ? syncDot() : ''}</span><span>Account</span></a>
    </div></nav>`;
}

export function render(keepScroll = false) {
  const y = window.scrollY;
  const app = $('#app');
  if (!S().user.onboarded) {
    document.body.classList.add('onboarding');
    app.innerHTML = onboardingView();
  } else {
    document.body.classList.remove('onboarding');
    const r = route();
    const view = views[r.name] || views[''];
    app.innerHTML = shell(view(r), r.name);
    if (keepScroll) window.scrollTo(0, y);
    const log = $('.chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    afterRender.forEach((fn) => fn(r));
  }
  $('[data-autofocus]')?.focus({ preventScroll: true });
}
