// Web Push subscriptions — background notifications even when the app is closed.
// Requires: VITE_VAPID_PUBLIC_KEY in .env + the deployed Supabase Edge Function
// (see docs/PUSH-SETUP.md). Works in production builds (the SW only runs there).
import { supabase } from '../lib/supabase';

const b64ToU8 = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export const pushSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const getPushSubscription = async () => {
    if (!pushSupported()) return null;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        return (await reg?.pushManager.getSubscription()) || null;
    } catch { return null; }
};

export const enablePush = async (userId) => {
    if (!pushSupported()) throw new Error('Push is not supported on this browser.');
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) throw new Error('Push not configured — set VITE_VAPID_PUBLIC_KEY (see docs/PUSH-SETUP.md).');

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notification permission was denied.');

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error('Service worker not active — push works on the deployed (production) app.');

    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(key)
    });
    const j = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
        { onConflict: 'endpoint' }
    );
    if (error) throw new Error(error.message);
    return true;
};

export const disablePush = async () => {
    const sub = await getPushSubscription();
    if (!sub) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
};
