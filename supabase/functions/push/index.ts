// SafeRoute push sender — Supabase Edge Function.
// Triggered by Database Webhooks on rides (INSERT/UPDATE) and ride_messages (INSERT);
// sends Web Push notifications to the right users, even when the app is closed.
//
// Deploy:   supabase functions deploy push --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

webpush.setVapidDetails(
    'mailto:push@saferoute.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
    let payload;
    try { payload = await req.json(); } catch { return new Response('bad payload', { status: 400 }); }
    const { type, table, record, old_record } = payload;

    let targets: string[] = [];
    let title = '';
    let body = '';

    if (table === 'rides' && type === 'INSERT') {
        // New request → notify every driver except the customer themself
        title = '🚕 New ride request';
        body = `${record.pickup} → ${record.destination} · Rs. ${Number(record.fare).toLocaleString()}`;
        const { data } = await supabase.from('profiles')
            .select('id').eq('user_type', 'driver').neq('id', record.customer_id);
        targets = (data ?? []).map((d) => d.id);
    } else if (table === 'rides' && type === 'UPDATE'
        && old_record?.status === 'requested' && record.status === 'accepted') {
        title = '✅ Driver accepted your ride';
        body = `Your driver is heading to ${record.pickup}. Open SafeRoute to track them live.`;
        targets = [record.customer_id];
    } else if (table === 'rides' && type === 'UPDATE'
        && record.status === 'completed' && old_record?.status !== 'completed') {
        title = '🏁 Ride completed';
        body = `${record.pickup} → ${record.destination} · Rs. ${Number(record.fare).toLocaleString()}`;
        targets = [record.customer_id];
    } else if (table === 'ride_messages' && type === 'INSERT') {
        const { data: ride } = await supabase.from('rides')
            .select('customer_id, driver_id').eq('id', record.ride_id).single();
        const other = ride
            ? (record.sender_id === ride.customer_id ? ride.driver_id : ride.customer_id)
            : null;
        if (other) {
            title = '💬 New ride message';
            body = String(record.message).slice(0, 90);
            targets = [other];
        }
    }

    if (!targets.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const { data: subs } = await supabase.from('push_subscriptions')
        .select('*').in('user_id', targets);

    let sent = 0;
    await Promise.all((subs ?? []).map(async (s) => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title, body, url: '/rides' })
            );
            sent++;
        } catch (e) {
            // Subscription expired/revoked → clean it up
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            }
        }
    }));

    return new Response(JSON.stringify({ sent }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
