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
- **Bouldering** (id `wall_climb`): built in. Each row is one climb: pick its V grade (V0–V17) and tick it if you topped it. In the database a climb is a set with `weight_kg` = grade and `reps` = 1 (topped) or 0 (attempt), so the Rankings tab shows the hardest grade topped, then most climbs topped. No 3D demo.
- **Selfie camera**: the round arrows button next to the shutter flips to the front camera (only shown on phones with two cameras). Selfies look like a mirror and are saved that way, like Instagram. The app remembers which camera you used last.
- **Emoji reactions**: under every check-in, tap ☺+ and pick 🔥 💪 👏 😂 😮 ❤️. One reaction per person per photo: pick another to change it, tap yours to take it off. The photo owner gets a push (notify-reaction function, migration 018). Reactions stay after the photo is cleared.
- **Weekly review**: the group page has a "Last week" card (Mon–Sun, London time): gym days against each person's days target (dots), 🏆 most days, 🎯 hit target, 😴 didn't go, and new PBs. Every Monday 08:07 UTC the weekly-review function pushes the same summary to everyone (once per group per week; migration 019, cron job gob-week-review).
- **Chat replies and reactions**: swipe a message right (or long-press → Reply) to quote it in your answer; tap a quote to jump to the original. Long-press a message (or tap its reaction chip, or focus it and press Enter) for 👍 ❤️ 😂 😮 🔥 💪 🙏, Reply and Copy. One reaction per person per message; the author gets a push in the group's chat notification (migration 020). The + at the end of any emoji row (chat or photo) opens a picker: recent, common, or any emoji typed from the phone keyboard.
- **Movable rest timer**: drag the rest timer (anywhere except its buttons) to move it; it stays there for the next timer. Double-tap the dotted grip (or focus it and press Escape) to put it back above the tabs; arrow keys move it.
- **Folding exercises** (as in FitTrack): when every set of an exercise is ticked, its card folds to one line (✓, name, what you did, ›) and the next unfinished one opens; the others wait folded. Tap a folded card, or the ⌄ on an open one, to open or fold it yourself. Sets start from last time; the suggestion only applies when you tap Use (Undo puts last time back).
- **Autosave** (no Save button): a few seconds after you tick, untick or change sets, today's ticked sets are written (replacing today's record). Unticked rows stay on the phone. Climbing rows count once ticked or once you pick a grade. New PRs pop up as a toast. With no signal it says so and retries every 20 s and when you're back online.
- **Pixel gym**: the group page shows "In the gym today": everyone as their pixel character (js/pixel.js, all drawn in code). Your character goes to the body part you've trained most today (arms → dumbbells/cable, shoulders → overhead press, legs → squat rack…), live as you tick sets in the Log (gym_live, migration 023), not just after Save; ticking sets also counts as being at the gym. Nothing today → dozing on the rest bench. Tap someone to see what they did. Characters are edited on the Me page in four tabs: body (16 skin tones incl. fun colours, build), hair (14 styles, 14 colours, facial hair, glasses), clothes (7 top styles, 3 bottoms, colours, shoes), hats (6 + colour) and saved in profiles.avatar (JSON, so clothes and gear can be added later). Migration 021 (group_gym_today).
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
- **Pixel gym**: the group page shows "In the gym today": everyone as their pixel character (js/pixel.js, all drawn in code). Your character goes to the body part you've trained most today (arms → dumbbells/cable, shoulders → overhead press, legs → squat rack…), live as you tick sets in the Log (gym_live, migration 023), not just after Save; ticking sets also counts as being at the gym. Nothing today → dozing on the rest bench. Tap someone to see what they did. Characters are edited on the Me page in four tabs: body (16 skin tones incl. fun colours, build), hair (14 styles, 14 colours, facial hair, glasses), clothes (7 top styles, 3 bottoms, colours, shoes), hats (6 + colour) and saved in profiles.avatar (JSON, so clothes and gear can be added later). Migration 021 (group_gym_today).
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

### Game layer (encouragement)
- **Rewards ledger** (`rewards`, migration 024): every coin/XP bonus is a row with a unique ref per person, written only by database functions. `character_card` adds it to what training earns.
- **Check-in chest**: first check-in of the day opens a pixel treasure chest: 5–20 coins, or 15% a big one (40–60 coins + 30 XP); never more than 5 small ones in a row.
- **Welcome-back bonus**: after 3+ days away, 10–50 XP once (a gym day alone is 20), so it helps people catch up without overtaking regulars.
- **Summon**: tap a groupmate resting on the bench in the pixel gym → "📣 Summon" sends them a push (notify-reaction, `summon: true`). If they check in within 24 hours you both get 15 coins. One per friend per day; not for someone already in today (migration 025).
- **Weekly boss** (co-op, migration 026): a new pixel boss every Monday per group (Couch Monster, Midnight Snack Dragon, Lazy Slime, Snooze Clock, Bubble Tea Beast, Doomscroll Demon). HP = 100 × everyone's days target. Since migration 032 it's a **raid**: one attack per gym day (you must have checked in today), a turn-based fight of up to 8 moves against a boss matched to your own stats. An attack counts 70 for turning up + up to 60 for damage (measured against your own HP), × the underdog bonus (+10% per level below the group average, up to +50%). Beaten by Sunday → everyone claims 60 coins + 80 XP once (this week or last; claimed automatically when you open the group page).
- **Moves** (migration 030): learned from real training in the last 60 days: strength moves by best lift per body part, volume moves by sets, endurance by cardio minutes, climbing by hardest grade. Stop training and you forget them. Equip 4 on the Me page. Grit (12+ gym days in 60) survives one knockout per fight.
- **More than one group** (migration 034): a check-in is one photo that every group sees and counts in every group, but each group can get its own caption (`checkin_captions`, posted atomically with `post_checkin`, editable per group with `set_caption`; a group only reads its own captions, the push uses the caption of the group it opens). Weekly boss: one raid attack per gym day in total, counted in every group with that group's underdog bonus; loot once per person per week. One open friendly match per pair. Group switcher chips on the group page.
- **Weekly stats** (migration 037): battle stats are worked out once a week (`character_stats_weekly`, cron `gob-weekly-stats` Mondays 01:30 UTC) from training up to Sunday; the last 30 days count fully, older training fades out by 90 days (`stat_weight`). A stat drops at most 10% a week and rises by at most half the gap (or 10%). `character_next` shows next Monday's numbers on the character card.
- **Strength level** (Me page): best estimated 1RM in the last 90 days against your latest body weight, using FitTrack's standards (`STD` in ftdata.js: novice / intermediate / advanced × body weight), with the weight for the next level.
- **Goal follow-up questions** (migration 039, `body_profiles.goal_answers`): e.g. recomp → fat-loss or muscle rep ranges, weekly cardio minutes, more or less cardio while losing weight, which lifts come first in strength level; gym days and kilos to lose go into the existing settings; build muscle with an upper/lower focus adds a set to that half's exercises (`inFocus`); general wellness's focus (energy / stress / habits) adds a daily habit on the Log page.
- **Group page layout** ("today first"): top card = your check-in, days, rank and who's been today (with what they're on) plus a summon for someone who hasn't; then the pixel gym, a compact boss row (details folded), friendly matches (slim when empty), the month board with last week folded inside, and the feed. Rename, invite and leave live in group settings.
- **Plateaus**: the same weight three sessions running with no more reps (and below the top of the range) → a step back (~10% lighter, full reps), then straight back to the old weight; stuck again after a step back → suggest a similar exercise or another rep range for 2–3 weeks. Rep PRs (better estimated 1RM without a heavier weight) get a toast and, from 24 Nov 2026, +15 XP (migration 038).
- **Weight suggestions**: exercises not in your plan use your goal's rep range (Me page goal → `SCHEMES`), e.g. muscle 6–10 for compounds; with fat loss or endurance as the goal, weight goes up only after hitting the top of the range two sessions running. A single plan rep number (e.g. 10) is treated as 8–10, so adding weight always restarts at fewer reps; exercises not in the plan use your own usual reps (beat them by 2 before adding weight, then restart 1 below usual). A rep-range conversion never jumps more than ~10% (or one step).
- **Free workout mode**: a tick on the Log page ("I don't follow a plan") saves `free: true` in the plan; the Log page then always opens on an empty free workout with quick picks of exercises done in the last 14 days. Logging never needs a plan.
- **Bouldering minutes** (migration 036): the cardio card has Bouldering (`kind = 'boulder'`). Those minutes count as climbing, not cardio: no Speed or Endurance type, +1 Technique per 8 min, 4 min ≈ 1 climb for the Climbing type and the climb-count moves. Grade moves still need climbs logged with a V grade. Not counted in the weekly cardio target.
- **Group settings and joining** (migration 035): invite links/codes open a preview (`group_preview`) before joining; you choose whether the group sees your check-ins from before you joined (`group_members.show_history`, enforced in the check-ins and photo-file read rules via `can_see_checkin` / `can_see_photo`). Per group, only for you (`#/gs/<group>`, `set_group_prefs`): check-in and chat push mute, show-history, include in your "Everyone" ranking, pin (opens the app on that group). The groups page (`#/all`, `my_group_cards`) shows each group's members, who checked in today, your rank, the boss and unread chat. Ranking "Everyone" shows which of your groups each person is in. The camera warns when someone is in more than one of your groups (they'll see each caption).
- **Fusion and climbing moves** (migration 033): learn all the parts of a fusion (e.g. Squat Slam + Sprint → Power Charge) and you get it too. Fusions carry every type of their parts (STAB if yours matches any, best match-up used), hit with the higher of their stats, are ~1.5× their strongest part and have limited uses per fight (`moves.uses`). Climbing now has a move for each grade V0–V7 plus two for climbs topped in 60 days (40 / 120). Simulated: a lv 8 lifter with cardio fusions climbs ~3–4 floors higher than a pure lifter.
- **Battle engine** (migration 031): Pokémon-style turn-based damage worked out on the server (type match-ups strength > climbing > endurance > strength, crits, boosts with limited uses, heals, multi-hit, recoil, flinch, lock). `battle_move` returns what happened; against a monster its reply comes back in the same call.
- **Gym Tower** (migration 032, `#/tower`): floors with the six boss monsters in turn, every 5th an elite. Difficulty curve is gentle for the first floors then steeper (`tower_scale`). Tickets: 3 free every day (migration 043, given when you first open the tower or lair) plus 3 for the first check-in of the day (max 9); a fight costs 1. First clear of a floor: 20 + 4×floor XP and 5 + floor coins (+30 XP / +15 coins on elite floors). Simulated: a newcomer clears ~3–4 floors, a strong lv 8 lifter ~17–20.
- **Pets** (migration 040, `#/pets`, `#/shop`, `#/lair`): 18 species (12 tower monsters + 6 boss species, `monsters.ratios`). A pet's stats = your stats × its species ratios × its IVs (−20%..+20% per stat, set when caught); attack, speed and technique come from your best of the three (×0.85), so an off-type pet is still useful. Team = you + up to 5 pets (`pets.slot`), tower and Boss Lair only; switching uses your turn and the next one comes in when one goes down. Monsters scale with team size (+50% HP, +6% attack/speed/technique per extra member). Simulated: a full team adds about 2–4 floors.
  - Shop (coins, as negative `rewards` rows): balls ×1 / ×1.6 / ×2.3, drinks heal 30% / 60% (2 per fight). Catch chance = rate × ball × (1 − HP left) × 1.6 + 2% (elite ×0.7, max 95%); boss species only at ≤30% HP.
  - Boss Lair: one free try a day, then 1 ticket or 40 coins. The boss is matched to your stats (HP ×1.1 × ratio, strongest attack stat 65% of yours). Beating it without catching: +15 coins +20 XP. `pet_test` is a free, rewardless practice fight for one pet.
  - Levels (migration 041): 1–10, +2% stats a level, XP to reach level n = 25·n·(n−1). Team pets get +20 XP for a tower/lair win (catching counts), +5 for a loss, 0 for walking away (trigger `pet_fight_xp`). Food: Protein Bar +40, Steak +150. Move scrolls (`pet_teach`): one extra move, the pet's type or Normal (Normal pets learn any), no fusion or monster moves, 60 + 1.5 × power coins.
  - In a fight the 🎒 Bag lists every ball and drink with a ＋ button to buy one on the spot (buying doesn't use your turn). The Me page has Tower / Pets / Boss / Shop buttons on the moves card.
  - Migration 042: species 6–15 are now the excuses not to go (Takeaway Goblin, Duvet Burrito, Rain Cloud, DOMS Jelly, Overtime Ghost, Beer Belly Barrel; bosses Next-Monday Dragon, Tomorrow Phoenix, Binge Kraken, Excuse Golem) with their own monster moves. Every 5th tower floor is a boss species (5 → 12 … 30 → 17, then round again), built from the boss's shape at old-elite strength (`tower_snapshot`); beating floor 5k unlocks species 11+k in the Boss Lair (`lair_unlocked`).
- **Shop moves** (migration 042): `moves.req_kind = 'shop'` with `price`, owned in `user_moves` (`buy_move`). Kept apart from trained moves: `character_moves` returns them as `bought`, they never count towards fusions, and `set_moves` allows only one of them among your 4.
- **Friendly matches** (`challenge` / `respond_battle`): PvP between groupmates, async turns with a push when it's your go, no XP or coins. 48 hours without a move → the other side can claim the win.
- **Bitch → dog** (migration 027): last month's bitch shows as a pixel dog in the gym (fur = their hair colour, collar = their top colour). 3 gym days in one Mon–Sun week this month turns them back. Tap the dog to see their progress.
- **Quests** (migration 028, Me page): daily (check in; N sets ≈ your usual 6–25) and weekly (hit your days target; try an exercise you've never logged; M cardio minutes ≈ your usual, 30+). Targets follow each person's own last 4 weeks, so newcomers get the same reward for an easier target. Claim once each.
- **Season pass** (migration 029, Me page): free tiers for gym days this month (2, 4, 6, 8, 10, 12, 15, 18, 20), each with coins + XP; resets on the 1st. 10 days unlocks the gold top colour, 15 the crown, 20 gold shoes, for good (locked 🔒 in the character editor until earned).
