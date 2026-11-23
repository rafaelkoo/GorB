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
- **Workout days** (Log → Days): named days you pick from (Arms, Shoulders, Chest…), each with exercises, sets and rep range. Optional usual weekday; otherwise the Log page suggests the next day after the one you trained last. A FitTrack weekday plan turns into one day per weekday. Private unless shared.
- **3D demos** (Log → Library, or tap any exercise name): FitTrack's viewer, phases, cues and red wrong-form figure. Three.js and the body model load only when opened.
- **Coach**: FitTrack's double-progression next load on every exercise; lift targets as kg × reps with a deadline and on-pace check; weight goal date with weekly pace and calories.
- **Rest timer**: tick a set done to start it; length on Me.
- **Habits, points, levels**: daily habits on Log (private); points from real data (set 5, workout 15, PR 25, habit 5, check-in 10), 500 per level; weekly muscle coverage on Progress.

- **Training guide** (Plan page): FitTrack's sets, rep range, rest, weekly cardio and daily steps for the goal on Me; one tap applies it to the plan and rest timer. The coach works inside the plan's rep range.
- **Text on the check-in photo** (Stories style, `js/story.js`): after the shot tap Aa, type, pick a colour, size and box; drag to move, tap to edit, drag onto the bin to delete. The text is drawn into the photo on Post. The message box under the photo is still the notification text.
- **Group chat** (chat button on the Group page): live, kept forever, members only. WhatsApp-style pushes from the `notify-chat` Edge Function (called by a trigger on each message): titled with the group name, stacked per group, skipped while you're looking at that chat. Unread count on the button and a red dot on the Group tab. Anyone in the group can rename it; each rename shows as a grey line in the chat.
- **Reply to a photo**: the Reply button under a check-in (or on the full-size photo) opens a box with that photo quoted; the reply lands in the group chat with a small card of the photo, tap it to open. Once the photo is cleared after a week, the card says so; the message stays.
- **Wall climbing**: built in. Each row is one climb: pick its V grade (V0–V17) and tick it if you topped it. In the database a climb is a set with `weight_kg` = grade and `reps` = 1 (topped) or 0 (attempt), so the Rankings tab shows the hardest grade topped, then most climbs topped. No 3D demo.
- **Selfie camera**: the round arrows button next to the shutter flips to the front camera (only shown on phones with two cameras). Selfies look like a mirror and are saved that way, like Instagram. The app remembers which camera you used last.
- **Emoji reactions**: under every check-in, tap ☺+ and pick 🔥 💪 👏 😂 😮 ❤️. One reaction per person per photo: pick another to change it, tap yours to take it off. The photo owner gets a push (notify-reaction function, migration 018). Reactions stay after the photo is cleared.
- **Weekly review**: the group page has a "Last week" card (Mon–Sun, London time): gym days against each person's days target (dots), 🏆 most days, 🎯 hit target, 😴 didn't go, and new PBs. Every Monday 08:07 UTC the weekly-review function pushes the same summary to everyone (once per group per week; migration 019, cron job gob-week-review).
- **Chat replies and reactions**: swipe a message right (or long-press → Reply) to quote it in your answer; tap a quote to jump to the original. Long-press a message (or tap its reaction chip, or focus it and press Enter) for 👍 ❤️ 😂 😮 🔥 💪 🙏, Reply and Copy. One reaction per person per message; the author gets a push in the group's chat notification (migration 020). The + at the end of any emoji row (chat or photo) opens a picker: recent, common, or any emoji typed from the phone keyboard.
- **Movable rest timer**: drag the rest timer (anywhere except its buttons) to move it; it stays there for the next timer. Double-tap the dotted grip (or focus it and press Escape) to put it back above the tabs; arrow keys move it.
- **Folding exercises** (as in FitTrack): when every set of an exercise is ticked, its card folds to one line (✓, name, what you did, ›) and the next unfinished one opens; the others wait folded. Tap a folded card, or the ⌄ on an open one, to open or fold it yourself. Sets start from last time; the suggestion only applies when you tap Use (Undo puts last time back).
- **Pixel gym**: the group page shows "In the gym today": everyone as their pixel character (js/pixel.js, all drawn in code). Checked in today → at the station for what they did most (squat rack, bench, cable, dumbbells, wall, treadmill…); not yet → dozing on the rest bench. Tap someone to see what they did. Characters are edited on the Me page (skin, hair, hair colour, top, shorts, build) and saved in profiles.avatar (JSON, so clothes and gear can be added later). Migration 021 (group_gym_today).
- **History**: the gym/bitch board restarts on the 1st of each month (London time); finished months are on the History page (link on the board) with 🏆 most days, 🐶 the bitch, all-time counts, and each month's full table. Members only count from the month they joined (group_history).
- **Character card** (battle phase 1): the Me page shows Lv, type, XP bar, sweat coins and five stats, all worked out on the server by character_card (migration 022) from real records. Stats use the last 60 days (HP gym days, Attack = average of 3 best one-rep maxes, Defence sets, Speed cardio minutes, Technique variety + hardest climb), so they drop if you stop going. Level never drops. Tapping someone in the gym shows their level and type. Next: turn-based battles (phase 2), coin bets (phase 3).
- **Request an exercise** (Library, or the exercise picker): ask for one to be added to the library with a 3D demo. Each person sees only their own requests and their status; review them in Supabase → Table Editor → `exercise_requests` and set `status` to `added` or `declined`.
- **Timed holds**: your own exercises can be weight × seconds (e.g. holding a plate for 30 s). Seconds are stored in the reps column; the Log page has a ⏱ stopwatch per set that fills the seconds and ticks the set. Switch an exercise between reps and seconds in the library.
- **Your own exercises** (Library, or "Add your own" in the exercise picker and the Cardio card): weight × reps ones log as sets and rank like any lift; minute ones (wall climbing, swimming) log with cardio. No 3D demo. Groupmates can see and use them; only the person who added one can rename or delete it.
- **Cardio** (Log page): kind + minutes per day, weekly minutes against the guide. Private. FitTrack's ticked cardio comes across in the import.
- **Weekly review** (Log → Week): last 7 days scored like FitTrack (training days 60, lifts on track 25, weighed in 15), PRs, weigh-in change, cardio, low muscle groups and next week's weights. Banner on Sunday and Monday. Worked out live, nothing extra stored.
- **Chat replies and reactions**: swipe a message right (or long-press → Reply) to quote it in your answer; tap a quote to jump to the original. Long-press a message (or tap its reaction chip, or focus it and press Enter) for 👍 ❤️ 😂 😮 🔥 💪 🙏, Reply and Copy. One reaction per person per message; the author gets a push in the group's chat notification (migration 020). The + at the end of any emoji row (chat or photo) opens a picker: recent, common, or any emoji typed from the phone keyboard.
- **Movable rest timer**: drag the rest timer (anywhere except its buttons) to move it; it stays there for the next timer. Double-tap the dotted grip (or focus it and press Escape) to put it back above the tabs; arrow keys move it.
- **Folding exercises** (as in FitTrack): when every set of an exercise is ticked, its card folds to one line (✓, name, what you did, ›) and the next unfinished one opens; the others wait folded. Tap a folded card, or the ⌄ on an open one, to open or fold it yourself. Sets start from last time; the suggestion only applies when you tap Use (Undo puts last time back).
- **Pixel gym**: the group page shows "In the gym today": everyone as their pixel character (js/pixel.js, all drawn in code). Checked in today → at the station for what they did most (squat rack, bench, cable, dumbbells, wall, treadmill…); not yet → dozing on the rest bench. Tap someone to see what they did. Characters are edited on the Me page (skin, hair, hair colour, top, shorts, build) and saved in profiles.avatar (JSON, so clothes and gear can be added later). Migration 021 (group_gym_today).
- **History**: the gym/bitch board restarts on the 1st of each month (London time); finished months are on the History page (link on the board) with 🏆 most days, 🐶 the bitch, all-time counts, and each month's full table. Members only count from the month they joined (group_history).
- **Character card** (battle phase 1): the Me page shows Lv, type, XP bar, sweat coins and five stats, all worked out on the server by character_card (migration 022) from real records. Stats use the last 60 days (HP gym days, Attack = average of 3 best one-rep maxes, Defence sets, Speed cardio minutes, Technique variety + hardest climb), so they drop if you stop going. Level never drops. Tapping someone in the gym shows their level and type. Next: turn-based battles (phase 2), coin bets (phase 3).

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
| Photos are deleted after 7 days; the check-in stays, so gym days and rankings don't change | `cleanup-photos` Edge Function, run daily at 03:17 UTC by pg_cron (migration 010) |
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
