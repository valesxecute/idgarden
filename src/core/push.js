// Gentle reminders via web push (Phase 8). Per device: the subscription lives in push_subs
// (supabase/push.sql), garden-remind decides what and when. Needs the service worker (deployed build);
// on iPhone only from the installed app (Add to Home Screen).
import { Sync } from './sync.js';
import cfg from '../config.js';

const KEY = 'ig.push';
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const swReady = async () => {
  if (!(await navigator.serviceWorker.getRegistration())) throw Object.assign(new Error('no_sw'), { code: 'no_sw' });
  return navigator.serviceWorker.ready;
};

export const Push = {
  supported: () => !!cfg.vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  needsInstall: () => ios && !standalone,
  get on() { try { return localStorage.getItem(KEY) === '1' && Notification.permission === 'granted'; } catch { return false; } },
  get blocked() { return 'Notification' in window && Notification.permission === 'denied'; },

  async enable() {
    if ((await Notification.requestPermission()) !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
    const reg = await swReady();
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.vapidPublicKey) });
    const { endpoint, keys } = sub.toJSON();
    const { error } = await Sync.table('push_subs').upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, tz_offset: -new Date().getTimezoneOffset() });
    if (error) throw error;
    localStorage.setItem(KEY, '1');
  },

  async disable() {
    localStorage.removeItem(KEY);
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!sub) return;
    if (Sync.user) await Sync.table('push_subs').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  },

  test: () => Sync.invoke('garden-remind', { test: true }),
};
