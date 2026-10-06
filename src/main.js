// Boot: register views/actions, wire events, start sync + Discover feed.
import { Store } from './core/store.js';
import { Sync } from './core/sync.js';
import { Discover } from './data/discover.js';
import { S } from './ui/util.js';
import { closeSheet } from './ui/components.js';
import { registerViews, registerOnboarding, render, route, go } from './ui/router.js';
import { registerActions, registerEnter, wireEvents, isDragging } from './ui/events.js';
import * as home from './views/home.js';
import * as ideas from './views/ideas.js';
import * as think from './views/think.js';
import * as discover from './views/discover.js';
import * as capture from './views/capture.js';
import * as projects from './views/projects.js';
import * as learn from './views/learn.js';
import * as account from './views/account.js';
import * as onboarding from './views/onboarding.js';

const modules = [home, ideas, think, discover, capture, projects, learn, account, onboarding];
modules.forEach((m) => {
  if (m.views) registerViews(m.views);
  if (m.actions) registerActions(m.actions);
  if (m.enter) registerEnter(m.enter);
});
registerOnboarding(onboarding.viewOnboarding);
registerActions({
  nav: (el) => go(el.dataset.to),
  'close-sheet': closeSheet,
  dismiss: (el) => { Store.dismiss(el.dataset.key); render(true); },
});

const BIND = {
  idea: (id, field, v) => Store.updateIdea(id, { [field]: field === 'content' ? v.trim() || Store.idea(id).content : v.trim() }),
  insp: (id, field, v) => Store.updateInspiration(id, { [field]: v.trim() }),
  project: (id, field, v) => Store.updateProject(id, { [field]: v.trim() }),
  learn: (id, field, v) => Store.updateLearning(id, { [field]: v.trim() }),
  user: (_id, field, v) => { S().user[field] = v.trim(); Store.commit(); },
};

wireEvents({
  bind: (kind, id, field, value) => BIND[kind]?.(id, field, value),
  onDrop: (id, status) => ideas.moveIdea(id, status),
  onInput: (el) => ideas.onInput[el.dataset.input]?.(el),
  quickCapture: capture.openCapture,
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// cloud updates (other device, first sign-in merge) re-render, unless the user is mid-typing
const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
let pendingRender = false;
Store.subscribe((_s, { remote }) => { if (!remote) return; if (typing()) pendingRender = true; else render(true); });
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !typing()) { pendingRender = false; render(true); } }, 0));
Sync.onChange(() => { if (!typing() && !isDragging()) render(true); });

// auto-size growable textareas after each render
new MutationObserver(() => document.querySelectorAll('textarea[data-grow]:not([data-sized])').forEach((t) => { t.dataset.sized = 1; t.style.height = t.scrollHeight + 'px'; }))
  .observe(document.getElementById('app'), { childList: true, subtree: true });

render();
Sync.init();
Discover.load().then(() => { if (['discover', 'idea', 'ideas'].includes(route().name)) render(true); });
