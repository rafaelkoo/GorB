# Gym or Bitch

Friends' gym check-in app. Take a photo at the gym, your group sees it, the monthly table shows who's slacking.
Web app (PWA) first, Android app later via TWA.

## Phase 1 (this version)
- Sign in with a 6-digit email code (no passwords)
- Make a group or join one with an invite code / link
- Check in with a **live camera photo only** (no gallery upload, so no old photos)
- Group feed and monthly table (counts distinct days, UK time)
- Delete your own check-ins

Next: push notifications (phase 2), sets/reps logging with FitTrack's exercise ids (phase 3), fines/pot and Android app (phase 4).

## Setup
1. Make a free project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. **Authentication → Email Templates → Magic Link**: put `{{ .Token }}` in the email body so it sends the 6-digit code.
4. **Authentication → URL Configuration**: Site URL = your GitHub Pages URL.
5. **Project Settings → API**: copy the Project URL and the `anon` key into `js/config.js`.
6. Push to GitHub → Settings → Pages → deploy from `main`, root folder.

Supabase's built-in email sender has a low hourly limit. Fine for a few friends; add your own SMTP if sign-ins start failing.

## Rules that keep it honest and private
| Rule | Where it's enforced |
|---|---|
| Only groupmates can see your profile, check-ins and photos | Row Level Security in `schema.sql` |
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
| `supabase/schema.sql` | tables, rules, functions, photo bucket |

Bump `VERSION` in `sw.js` on every release so phones load the new files.
