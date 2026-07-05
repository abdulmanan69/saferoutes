# 🔔 Background Push Notifications — Setup Guide

With this set up, drivers get **"🚕 New ride request"**, customers get **"✅ Driver accepted"** and **"💬 New message"** notifications **even when the app is closed** (Android & desktop; on iPhone the PWA must be installed to the home screen, iOS 16.4+).

Everything runs on Supabase's free tier — no other service.

---

## Step 1 — Generate VAPID keys (one command)

```bash
npx web-push generate-vapid-keys
```

Copy the **Public Key** and **Private Key** it prints.

## Step 2 — Give the public key to the app

- Local: add to `.env`
  ```env
  VITE_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
  ```
- Vercel: Settings → Environment Variables → add `VITE_VAPID_PUBLIC_KEY` → **Redeploy**.

## Step 3 — Deploy the Edge Function

Install the Supabase CLI once (`npm i -g supabase`), then from the project folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF     # ref = the id in your supabase URL
supabase secrets set VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
supabase functions deploy push --no-verify-jwt
```

The function URL will be:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/push`

## Step 4 — Create the Database Webhooks (Supabase Dashboard)

**Database → Webhooks → Create a new hook** — make these **three**, all `HTTP POST` to the function URL above:

| Name | Table | Events |
|---|---|---|
| `push-ride-new` | `rides` | INSERT |
| `push-ride-update` | `rides` | UPDATE |
| `push-ride-message` | `ride_messages` | INSERT |

(No extra headers needed — the function was deployed with `--no-verify-jwt`.)

## Step 5 — Make sure the table exists

The `push_subscriptions` table is in `supabase/schema.sql` — re-run the file in the SQL Editor if you haven't since this feature was added.

## Step 6 — Users turn it on

In the app: **Settings → Notifications → Background Push Notifications → Enable** → accept the browser permission. Done — that device now gets ride alerts with the app closed.

---

### Who gets notified when

| Event | Notified |
|---|---|
| New ride request | Every driver account |
| Driver accepts | That customer |
| Ride completed | That customer |
| Chat message | The other person on the ride |

### Troubleshooting
- **"Push not configured"** in Settings → `VITE_VAPID_PUBLIC_KEY` missing at build time.
- **Enable works but nothing arrives** → check the three webhooks exist and the function logs (Dashboard → Edge Functions → push → Logs).
- **iPhone** → must install the PWA (Share → Add to Home Screen) first; enable push from inside the installed app.
- Push requires the **deployed HTTPS app** — the dev server has no service worker.
