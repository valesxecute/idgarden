# Phase 8: mobile polish

## Done (2026-10-07)
| Piece | Where | Notes |
|---|---|---|
| Installable | `manifest.webmanifest`, `icons/` (sprout-in-pot; 192/512/maskable/apple 180, svg) | Account → "On your phone": install button (Android/desktop via `beforeinstallprompt`), iPhone hint |
| Offline | `sw.js` | Deployed builds only (`APP_VERSION !== 'dev'`). Precache = shell + css + every module (list + cache name stamped per deploy by stamp-version.mjs). Pages network-first, `?v=` files cache-first, rest stale-while-revalidate. Supabase + version.json never cached |
| Shortcuts | manifest `shortcuts` → `?capture=idea` / `?capture=insp` | main.js `handleLaunch()` |
| Share target | manifest `share_target` (GET `share_url/share_text/share_title`) | link → Save inspiration prefilled (URL pulled out of text if needed); plain text → new idea. Android/Chrome only (iOS has no web share target) |
| Reminders | `src/core/push.js`, `supabase/push.sql`, `supabase/functions/garden-remind` | Per-device opt-in. Hourly cron → 9:00 local, ≤1 per 3 days: stuck milestone (14 d) → milestone due → terrarium idea untouched 10 d. "Send a test" button. Dead subscriptions removed on 404/410 |

Verified locally (stamped build on :5175): SW active, 38 files precached, loads with server stopped, share + shortcut params open the right sheet.

## Setup (user, once)
1. Supabase → Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (values: generated file, see chat)
2. Deploy `garden-remind` (code: supabase/functions/garden-remind/index.ts), **JWT verification OFF**
3. SQL Editor: run `supabase/push.sql` with `<CRON_SECRET>` replaced
4. Phone: install app → Account → Gentle reminders → Send a test

## Open
- Live test on Android + iPhone (iOS push = installed app only, iOS 16.4+)
- `npm:web-push` in Deno: if it fails at runtime, swap to jsr `@negrel/webpush`
- Native app later (spec §36): same Supabase backend
