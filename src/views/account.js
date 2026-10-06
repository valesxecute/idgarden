// Account tab: sign-in / sync, garden style, interests, privacy, export / reset.
import { Store } from '../core/store.js';
import { Sync } from '../core/sync.js';
import { INTERESTS } from '../data/interests.js';
import { sampleGarden } from '../data/sample.js';
import { S, $, esc, avatarHTML, syncDot, SYNC_TEXT } from '../ui/util.js';
import { toast } from '../ui/components.js';
import { render, go } from '../ui/router.js';
import { resetOnboarding } from '../ui/state.js';
import { GARDEN_STYLES, gardenStyle } from './home.js';

export const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function accountCard() {
  if (!Sync.user) {
    return `<section class="card account-card"><div class="row">${avatarHTML('lg')}<div><h4>You’re a guest</h4><p class="muted small">Your garden lives only in this browser for now.</p></div></div>
      <p>Sign in to <strong>sync across your devices</strong> and keep your garden safe if this browser’s data is cleared. Everything you’ve planted so far comes with you.</p>
      <button class="btn google lg" data-action="sign-in-google">${GOOGLE_G} Continue with Google</button>
      ${Sync.enabled ? `<details class="email-login"><summary>Or get a sign-in link by email</summary>
        <div class="row"><input class="inline-input" type="email" id="email-login" placeholder="you@example.com" data-enter="sign-in-email"><button class="btn" data-action="sign-in-email">Send link</button></div></details>` : ''}</section>`;
  }
  const last = Sync.lastSynced ? `· ${new Date(Sync.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  return `<section class="card account-card"><div class="row">${avatarHTML('lg')}<div><h4>${esc(Sync.displayName())}</h4><p class="muted small">${esc(Sync.user.email || '')}</p></div></div>
    <p class="sync-line">${syncDot()} ${SYNC_TEXT[Sync.status]} ${Sync.status === 'synced' ? last : ''}</p>
    <p class="muted small">Your garden syncs automatically to every device where you sign in with this account.</p>
    <div class="row"><button class="btn" data-action="sync-now">↻ Sync now</button><button class="btn" data-action="sign-out">Sign out</button></div></section>`;
}

function viewAccount() {
  const st = S();
  return `
    <header class="page-head"><h1>Account</h1></header>
    ${accountCard()}
    <section class="card"><h4>Garden style</h4><p class="muted small">How your garden looks on the home screen. More ways to customize your garden are coming.</p>
      <div class="chips">${GARDEN_STYLES.map(([k, l]) => `<button class="chip${gardenStyle() === k ? ' on' : ''}" data-action="garden-style" data-style="${k}">${l}</button>`).join('')}</div></section>
    <section class="card"><h4>Your name <span class="muted small">(optional)</span></h4><input class="inline-input" value="${esc(st.user.name)}" data-bind="user::name" placeholder="Used only for greetings"></section>
    <section class="card"><h4>Interests</h4><p class="muted small">Shapes Discover. “Something different” always shows the rest.</p>
      <div class="chips">${INTERESTS.map((i) => `<button class="chip${st.user.interests.includes(i.id) ? ' on' : ''}" data-action="toggle-interest" data-id="${i.id}">${i.emoji} ${i.label}</button>`).join('')}</div></section>
    <section class="card"><h4>Privacy</h4>
      <ul class="plain"><li>Your ideas are private. Nothing is ever public by default.</li>
      <li>Signed in, your garden is stored in your account so it can sync. Only you can read it.</li>
      <li>The assistant currently runs on your device with simple rules. When real AI is added, it will only see the idea you’re working on plus related items, and you’ll be able to turn it off.</li>
      <li>You can export or delete everything at any time.</li></ul>
      <div class="row"><button class="btn" data-action="export">⬇ Export my garden (JSON)</button><button class="btn" data-action="load-sample">🌿 Load sample garden</button><button class="btn danger" data-action="reset">Delete everything on this device</button></div></section>`;
}

export const views = { account: viewAccount };

export const actions = {
  'sign-in-google': async () => {
    if (!Sync.enabled) return toast('🔌 Sign-in turns on once the app is connected to its account service. For now, continue as a guest. Your garden can be synced later.', [], 8000);
    const { error } = await Sync.signInWithGoogle();
    if (error) toast('Couldn’t start Google sign-in: ' + esc(error.message));
  },
  'sign-in-email': async () => {
    const email = $('#email-login')?.value.trim();
    if (!email) return $('#email-login')?.focus();
    const { error } = await Sync.signInWithEmail(email);
    toast(error ? 'Couldn’t send the link: ' + esc(error.message) : `📬 Check ${esc(email)} for your sign-in link.`, [], 9000);
  },
  'sync-now': () => Sync.syncNow(),
  'sign-out': async () => {
    if (!confirm('Sign out? Your garden stays safe in your account. This device’s copy will be removed until you sign in again.')) return;
    await Sync.signOut();
    resetOnboarding();
    location.hash = '#/';
    render();
  },
  'garden-style': (el) => { S().user.gardenStyle = el.dataset.style; Store.commit(); render(true); toast('🌿 Garden style updated.', [['See garden', 'nav', { to: '#/' }]]); },
  export: () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `idea-garden-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  },
  'load-sample': () => { if (!S().ideas.length || confirm('Replace your current garden with the sample garden?')) { Store.replace(sampleGarden()); go('#/'); toast('🌿 Sample garden loaded.'); } },
  reset: () => { if (confirm('Delete your whole garden from this device? This cannot be undone. Consider exporting first.')) { Store.reset(); resetOnboarding(); location.hash = '#/'; render(); } },
};

export const enter = { 'sign-in-email': () => actions['sign-in-email']() };
