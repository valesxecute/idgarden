// Account tab: sign-in / sync, garden style, interests, privacy, export / reset.
import { Store } from '../core/store.js';
import { Sync } from '../core/sync.js';
import { Vec } from '../core/embed.js';
import { Push } from '../core/push.js';
import cfg from '../config.js';
import { INTERESTS } from '../data/interests.js';
import { sampleGarden } from '../data/sample.js';
import { S, $, esc, avatarHTML, syncDot, SYNC_TEXT } from '../ui/util.js';
import { toast, ask } from '../ui/components.js';
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

// Android / desktop Chrome: keep the install prompt for our own button (iPhone: Share → Add to Home Screen)
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
window.addEventListener('appinstalled', () => { installPrompt = null; });
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function phoneCard() {
  const install = installed() ? '<p class="muted small">✓ Installed on this device.</p>'
    : installPrompt ? '<button class="btn" data-action="install-app">📲 Install Idea Garden</button>'
    : `<p class="muted small">${Push.needsInstall() ? 'On iPhone: tap Share → <strong>Add to Home Screen</strong>.' : 'Use your browser menu → <strong>Install app</strong> / <strong>Add to Home screen</strong>.'} It opens like an app, works offline, and shows up when you share a link.</p>`;
  let remind;
  if (!Sync.user) remind = '<p class="muted small">Sign in to turn on reminders.</p>';
  else if (!Push.supported()) remind = '<p class="muted small">This browser can’t show reminders.</p>';
  else if (Push.needsInstall()) remind = '<p class="muted small">On iPhone, reminders work from the installed app. Add it to your Home Screen first.</p>';
  else if (Push.blocked) remind = '<p class="muted small">Notifications are blocked for this site. Allow them in your browser’s site settings.</p>';
  else remind = `<label class="task"><input type="checkbox" data-action="toggle-push" ${Push.on ? 'checked' : ''}> <span>Gentle reminders on this device</span></label>
    <p class="muted small">Now and then, around 9:00: a milestone that’s due or stuck, or an idea waiting in your terrarium. At most every 3 days. No streaks.</p>
    ${Push.on ? '<button class="btn sm ghost" data-action="test-push">Send a test</button>' : ''}`;
  return `<section class="card"><h4>On your phone</h4>${install}${remind}</section>`;
}

function viewAccount() {
  const st = S();
  return `
    <header class="page-head"><h1>Account</h1></header>
    ${accountCard()}
    ${phoneCard()}
    <section class="card"><h4>Garden style</h4><p class="muted small">How your garden looks on the home screen. In the 3D island (beta) you can also move things around and add decor with ✏️ Arrange.</p>
      <div class="chips">${GARDEN_STYLES.map(([k, l]) => `<button class="chip${gardenStyle() === k ? ' on' : ''}" data-action="garden-style" data-style="${k}">${l}</button>`).join('')}</div></section>
    ${cfg.ai ? `<section class="card"><h4>AI assistant</h4>
      <label class="task"><input type="checkbox" data-action="toggle-ai" ${st.user.aiEnabled !== false ? 'checked' : ''}> <span>Use AI for Think With Me, Organize, project plans and finding related items</span></label>
      <p class="muted small">${Sync.user ? 'Powered by Google Gemini (free tier). Up to 60 AI requests a day. When off, a simple assistant on your device answers instead.' : 'Sign in to use the AI assistant. Guests get the simple on-device assistant.'}</p></section>` : ''}
    <section class="card"><h4>Your name <span class="muted small">(optional)</span></h4><input class="inline-input" value="${esc(st.user.name)}" data-bind="user::name" placeholder="Used only for greetings"></section>
    <section class="card"><h4>Interests</h4><p class="muted small">Shapes Discover. For you also learns from what you read, save and mark “not interested”, and now and then slips in something different.</p>
      <div class="chips">${INTERESTS.map((i) => `<button class="chip${st.user.interests.includes(i.id) ? ' on' : ''}" data-action="toggle-interest" data-id="${i.id}">${i.emoji} ${i.label}</button>`).join('')}</div>
      <button class="btn sm ghost" data-action="reset-taste">Reset what Discover learned</button></section>
    <section class="card"><h4>Privacy</h4>
      <ul class="plain"><li>Your ideas are private. Nothing is ever public by default.</li>
      <li>Signed in, your garden is stored in your account so it can sync. Only you can read it.</li>
      <li>AI assistant (when on, signed in): to write a reply, plan or suggestions, only the idea you’re working on plus a few related items (up to 8) are sent to Google Gemini, never your whole garden at once. To find related items, the text of each idea, inspiration, project and learning goal is also sent once (and again after edits) to be turned into numbers that capture its meaning; those stay on this device. On the free tier Google may use this text to improve its products, so keep private details out. Turn it off anytime above.</li>
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
  'install-app': async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(true); },
  'toggle-push': async () => {
    try {
      if (Push.on) { await Push.disable(); toast('🔕 Reminders off on this device.'); }
      else { await Push.enable(); toast('🔔 Reminders on. Tap “Send a test” to check.'); }
    } catch (e) {
      toast(e.code === 'denied' ? 'Notifications weren’t allowed, so reminders stay off.'
        : e.code === 'no_sw' ? 'Reminders work in the published app, not in this local preview.'
        : 'Couldn’t turn reminders on: ' + esc(e.message || 'unknown error'));
    }
    render(true);
  },
  'test-push': async () => {
    try { const r = await Push.test(); toast(r.sent ? '📬 Test sent. It should appear in a few seconds.' : 'Nothing was sent. Try turning reminders off and on.'); }
    catch (e) { toast(e.code === 'no_subscription' ? 'This device isn’t subscribed yet. Turn reminders off and on.' : 'The reminder service isn’t set up yet.'); }
  },
  'toggle-ai':() => { S().user.aiEnabled = S().user.aiEnabled === false; Store.commit(); render(true); },
  'sign-out': async () => {
    if (!(await ask('Sign out? Your garden stays safe in your account. This device’s copy is removed until you sign in again.', { yes: 'Sign out' }))) return;
    await Push.disable().catch(() => {});
    await Sync.signOut();
    Vec.clear();
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
  'load-sample': async () => { if (!S().ideas.length || (await ask('Replace your current garden with the sample garden?', { yes: 'Replace', danger: true }))) { Store.replace(sampleGarden()); go('#/'); toast('🌿 Sample garden loaded.'); } },
  reset: async () => { if (await ask('Delete your whole garden from this device? This can’t be undone. Consider exporting first.', { yes: 'Delete everything', danger: true })) { Store.reset(); Vec.clear(); resetOnboarding(); location.hash = '#/'; render(); } },
};

export const enter = { 'sign-in-email': () => actions['sign-in-email']() };
