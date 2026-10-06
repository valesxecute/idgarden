// Accounts + cross-device sync via Supabase.
// Model: one row per user in `gardens` holding the whole garden as JSON (see supabase/schema.sql).
// Local-first: the app always works from localStorage; sync pushes local edits (debounced)
// and pulls on load, on focus and on realtime updates. Concurrent edits merge by item id.
import { Store } from './store.js';
import cfg from '../config.js';
const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient);

let client = null;
let user = null;
let status = enabled ? 'local' : 'off'; // off | local | syncing | synced | offline | error
let lastSynced = null;
let pushTimer = null;
let channel = null;
let busy = Promise.resolve();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const setStatus = (s) => { status = s; if (s === 'synced') lastSynced = Date.now(); emit(); };
const ts = (iso) => (iso ? Date.parse(iso) : 0);
const hasContent = (s) => !!(s && (s.ideas?.length || s.inspirations?.length || s.projects?.length || s.learning?.length));
// serialize sync operations so pushes and pulls never interleave
const queue = (fn) => (busy = busy.then(fn, fn).catch((e) => { console.warn('[sync]', e); setStatus(navigator.onLine ? 'error' : 'offline'); }));

function mergeReading(o = {}, n = {}) {
  const later = new Map();
  [...(o.later || []), ...(n.later || [])].forEach((x) => later.set(x.id, x));
  const read = { ...(o.read || {}), ...(n.read || {}) };
  return {
    read, hidden: { ...(o.hidden || {}), ...(n.hidden || {}) },
    later: [...later.values()].filter((x) => !read[x.id] || (n.later || []).some((y) => y.id === x.id)),
    taste: n.taste || o.taste || { groups: {}, sources: {}, words: {} },
  };
}

function merge(a, b) {
  const newer = ts(a.meta?.updatedAt) >= ts(b.meta?.updatedAt) ? a : b;
  const older = newer === a ? b : a;
  const deleted = [...new Set([...(a.deleted || []), ...(b.deleted || [])])];
  const gone = new Set(deleted);
  const union = (key) => {
    const map = new Map();
    (older[key] || []).forEach((x) => map.set(x.id, x));
    (newer[key] || []).forEach((x) => map.set(x.id, x));
    return [...map.values()].filter((x) => !gone.has(x.id)).sort((x, y) => ts(y.createdAt) - ts(x.createdAt));
  };
  return {
    ...older, ...newer,
    user: { ...older.user, ...newer.user, onboarded: !!(a.user?.onboarded || b.user?.onboarded) },
    ideas: union('ideas'), inspirations: union('inspirations'), projects: union('projects'), learning: union('learning'),
    dismissed: [...new Set([...(a.dismissed || []), ...(b.dismissed || [])])],
    chats: { ...(older.chats || {}), ...(newer.chats || {}) },
    reading: mergeReading(older.reading, newer.reading),
    deleted,
    meta: { ...newer.meta, updatedAt: new Date().toISOString() },
  };
}

async function fetchRemote() {
  const { data, error } = await client.from('gardens').select('state, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function push() {
  if (!user) return;
  setStatus('syncing');
  const remote = await fetchRemote();
  let s = Store.state;
  if (remote && ts(remote.updated_at) > ts(s.meta?.syncedAt)) {
    // another device wrote since our last sync: fold its changes in first
    s = merge(s, remote.state);
    Store.load(s);
    s = Store.state;
  }
  const at = s.meta.updatedAt || new Date().toISOString();
  s.meta.owner = user.id;
  const { error } = await client.from('gardens').upsert({ user_id: user.id, state: s, updated_at: at });
  if (error) throw error;
  s.meta.syncedAt = at;
  Store.saveSilently();
  setStatus('synced');
}

async function pull() {
  if (!user) return;
  setStatus('syncing');
  const remote = await fetchRemote();
  const local = Store.state;
  const meta = local.meta || {};
  const dirty = ts(meta.updatedAt) > ts(meta.syncedAt) || meta.owner !== user.id;

  if (!remote) {
    if (hasContent(local) || local.user.onboarded) return push();
    return setStatus('synced');
  }
  const remoteAt = ts(remote.updated_at);
  if (remoteAt === ts(meta.syncedAt) && meta.owner === user.id) return dirty ? push() : setStatus('synced');

  let next;
  let needsPush = false;
  if (!hasContent(local) || (meta.owner && meta.owner !== user.id) || !dirty) {
    next = remote.state; // fresh device, other account's leftovers, or nothing new here
  } else {
    next = merge(local, remote.state); // guest garden joining an account, or offline edits
    needsPush = true;
  }
  next.meta = { ...next.meta, syncedAt: needsPush ? null : remote.updated_at, owner: user.id };
  if (!needsPush) next.meta.updatedAt = remote.updated_at;
  Store.load(next);
  return needsPush ? push() : setStatus('synced');
}

function subscribe() {
  if (channel) client.removeChannel(channel);
  channel = client.channel('garden-' + user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gardens', filter: `user_id=eq.${user.id}` }, (p) => {
      if (p.new && ts(p.new.updated_at) !== ts(Store.state.meta?.syncedAt)) queue(pull);
    })
    .subscribe();
}

async function setUser(next) {
  const changed = (next?.id || null) !== (user?.id || null);
  user = next;
  if (!changed) return;
  if (user) { queue(pull); subscribe(); } else { if (channel) client.removeChannel(channel); channel = null; setStatus('local'); }
  emit();
}

export const Sync = {
  enabled,
  get user() { return user; },
  get status() { return status; },
  get lastSynced() { return lastSynced; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  whenIdle() { return busy; },

  async init() {
    if (!enabled) return;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await client.auth.getSession();
    // PKCE returns ?code=… ; drop it so the hash router stays clean
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    await setUser(data.session?.user || null);
    client.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));

    Store.subscribe((_s, { remote }) => {
      if (remote || !user) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => queue(push), 1200);
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && user) queue(pull); });
    window.addEventListener('online', () => { if (user) queue(push); });
    window.addEventListener('offline', () => { if (user) setStatus('offline'); });
    return busy;
  },

  signInWithGoogle() {
    return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  },
  signInWithEmail(email) {
    return client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  },
  syncNow() { return queue(pull); },
  // call a Supabase Edge Function as the signed-in user; throws Error with .code from the function's {error}
  async invoke(name, body) {
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) {
      let detail = null;
      try { detail = await error.context?.json(); } catch {}
      throw Object.assign(new Error(detail?.error || error.message), { code: detail?.error || 'network', status: error.context?.status });
    }
    return data;
  },
  async signOut() {
    // let a running sync finish, but never hang on it; always sign this device out, even offline
    await Promise.race([busy, new Promise((r) => setTimeout(r, 3000))]);
    try { await client.auth.signOut(); } catch { await client.auth.signOut({ scope: 'local' }).catch(() => {}); }
    if (channel) { client.removeChannel(channel); channel = null; }
    user = null;
    Store.reset(); // the garden stays in the account; this device's copy is removed
    setStatus('local');
  },
  async deleteCloudCopy() {
    await busy;
    const { error } = await client.from('gardens').delete().eq('user_id', user.id);
    if (error) throw error;
    Store.state.meta.syncedAt = null;
    Store.saveSilently();
  },
  displayName() {
    const m = user?.user_metadata || {};
    return m.full_name || m.name || user?.email || '';
  },
  avatar() { return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ''; },
};

