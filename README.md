# Gym or Bitch

Friends' gym check-in app. Take a photo at the gym, your group sees it, the monthly table shows who's slacking.
Web app (PWA) first, Android app later via TWA.

## Phase 1 (this version)
- Sign in with Google (name filled in automatically) or email + password (no emails sent)
- Make a group or join one with an invite code / link
- Check in with a **live camera photo only** (no gallery upload, so no old photos)
- Group feed and monthly table (counts distinct days, UK time)
- Delete your own check-ins

## Gym tracker (phase 3, first part)
- **Log**: today's workout — pick from 82 FitTrack exercises, kg + reps per set, last time's numbers filled in, draft kept on the phone until saved. One workout per UK day; saving again replaces it.
- **Progress**: PBs for bench / deadlift / squat / OHP + total, a trend line and PR per exercise. Groupmates can open each other's progress.
- **Group page**: PB board like the old Excel "Personal Bests" sheet.

## Me, targets, rankings, language
- **Me** tab: gym days per week target, lift targets with progress bars, body weight log + goal, FitTrack goal with BMI / calories / protein / water, settings.
- Body details (height, age, sex, weights, goal) are **private** unless "Show my body details to my groups" is on. Lift targets and days per week are visible to groupmates.
- **Ranks** tab: the whole group ranked by gym days, weekly target, workouts, volume, big-four total, each lift, and weight change (sharers only).
- **English / 繁中**: switch on the sign-in screen or Me → Settings. Saved to the profile, so notifications arrive in each person's language.

## FitTrack features (brought over)
- **Import**: Me → Bring over FitTrack, pick the file from FitTrack's Me → Export. Done sets, body weight, details, goal, plan, rest timer and targets come across; days already logged here are kept; safe to repeat.
- **Weekly plan** (Log → Plan): which day trains what; today's log starts from it. Private unless shared.
- **3D demos** (Log → Library, or tap any exercise name): FitTrack's viewer, phases, cues and red wrong-form figure. Three.js and the body model load only when opened.
- **Coach**: FitTrack's double-progression next load on every exercise; lift targets as kg × reps with a deadline and on-pace check; weight goal date with weekly pace and calories.
- **Rest timer**: tick a set done to start it; length on Me.
- **Habits, points, levels**: daily habits on Log (private); points from real data (set 5, workout 15, PR 25, habit 5, check-in 10), 500 per level; weekly muscle coverage on Progress.

Not brought over: FitTrack's weekly review and training-scheme guide, cardio logging.

Later: running times (5K…marathon).

## Setup
Database changes and the notification function deploy themselves: GitHub Actions (`.github/workflows/supabase.yml`) runs on every push to `main` that touches `supabase/`, applies any new file in `supabase/migrations/`, and deploys `supabase/functions/notify-checkin`. Watch it under the repo's **Actions** tab.

One-time setup:
1. Make a free project at supabase.com.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_ACCESS_TOKEN` — from supabase.com/dashboard/account/tokens
   - `SUPABASE_DB_PASSWORD` — the database password (Project Settings → Database)
3. **Actions → Supabase → Run workflow** once (later pushes run it by themselves).
4. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email".
5. **Authentication → URL Configuration**: Site URL + Redirect URL = your GitHub Pages URL.
6. **Project Settings → API**: Project URL + publishable key into `js/config.js`.
7. GitHub → Settings → Pages → deploy from `main`, root folder.

To change the database: add a new file `supabase/migrations/<yyyymmddhhmmss>_<name>.sql` and push. Never edit a migration that has already run; write a new one. Keep every migration safe to run twice (`if not exists`, `create or replace`, `drop … if exists`).

## Rules that keep it honest and private
| Rule | Where it's enforced |
|---|---|
| Only groupmates can see your profile, check-ins and photos | Row Level Security in `supabase/migrations/` |
| Photo bucket is private; photos load through 1-hour signed links | Storage policies |
| Check-in time and owner are set by the server, not the phone | `stamp_checkin` trigger |
| You can only upload into your own photo folder | Storage policy + trigger |
| Photo GPS/EXIF data is removed before upload | `js/camera.js` (canvas re-encode) |

**Never commit the `service_role` key.** The `anon` key in `config.js` is public by design.

## Files
| File | Role |
|---|---|
| `index.html` | page shell |
| `manifest.json`, `sw.js` | installable app, offline shell, push handler |
| `js/config.js` | Supabase URL and anon key |
| `js/supa.js` | every database/storage call |
| `js/camera.js` | live camera, resize, EXIF strip |
| `js/ui.js` | screens |
| `js/main.js` | boot and routing |
| `supabase/migrations/` | tables, rules, functions, photo bucket (applied by Actions) |
| `supabase/functions/notify-checkin/` | sends push notifications (deployed by Actions) |
| `.github/workflows/supabase.yml` | the automatic Supabase deploy |

Bump `VERSION` in `sw.js` on every release so phones load the new files.

## Google sign-in setup
1. console.cloud.google.com → new project → **Google Auth Platform** → Branding: app name, support email.
2. Audience: **External**. While in *Testing*, only listed test users can sign in; **Publish app** to let anyone in (email/profile scopes need no review).
3. Clients → **Create client** → Web application.
   - Authorised JavaScript origins: `https://rafaelkoo.github.io`
   - Authorised redirect URIs: `https://uzawqjiczhbfxhylogir.supabase.co/auth/v1/callback`
4. Supabase → Authentication → Sign In / Providers → **Google** → on, paste Client ID + Client Secret (straight into Supabase, never into this repo).
5. Supabase → Authentication → URL Configuration: Site URL `https://rafaelkoo.github.io/GorB/`, Redirect URLs add `https://rafaelkoo.github.io/GorB/**`.

## Push notifications
The first check-in of someone's UK day pings everyone who shares a group with them (later ones that day don't).
Phones mute it themselves (Do Not Disturb); the app has no mute.

1. On your PC: `npx web-push generate-vapid-keys`. The **public** key goes in `js/config.js` (`VAPID_PUBLIC_KEY`); the **private** key only into GitHub secrets (step 2).
2. The function deploys itself (GitHub Actions). Add GitHub repo secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEBHOOK_SECRET` (any long random string you make up); the next run copies them into Supabase.
3. Database → **Webhooks** → Create: table `checkins`, event **Insert**, type **Supabase Edge Functions** → `notify-checkin`, POST, add header `x-webhook-secret` = the same `WEBHOOK_SECRET`.
4. On each phone: Group page → Notifications → **Turn on**, then **Send test**.
