// Web Push on this device: turn on, turn off, test.
// The server side is supabase/functions/notify-checkin.
import { sb } from './supa.js';
import { VAPID_PUBLIC_KEY } from './config.js';

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;

const urlB64ToBytes = s => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(userId) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied'
    ? 'Notifications are blocked. In Chrome: ⋮ → Settings → Site settings → Notifications → allow this site.'
    : 'Notifications were not allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY) });
  const { endpoint, keys } = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({ endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth });
  if (error) throw error;
}

// Also called on sign out, so the next person on this phone doesn't get your mates' alerts.
export async function disablePush() {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// Shows a notification from this phone only: proves the phone can display them.
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Gym or Bitch', { body: 'Notifications work on this phone 💪', icon: 'icons/icon-192.png' });
}
