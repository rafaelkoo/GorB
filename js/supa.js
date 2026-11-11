// Supabase client + every call the app makes, in one place.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHOTO_BUCKET } from './config.js';
import { BIG_FOUR } from './exercises.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-');
// PKCE: Google sends us back with ?code=… in the query string, which keeps clear of the #/ routes.
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce' } }) : null;

const must = ({ data, error }) => { if (error) throw error; return data; };

// ---------- auth ----------
// Google: leaves the page, comes back to the same address signed in.
export const googleLogIn = () => sb.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: location.origin + location.pathname }
}).then(must);

// Email + password fallback ("Confirm email" is OFF in Supabase so no emails are sent).
export const logIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(must);
export async function register(email, password) {
  const data = must(await sb.auth.signUp({ email, password }));
  if (!data.session) throw new Error('Account made, but Supabase wants email confirmation. Turn off "Confirm email" in Authentication → Sign In / Providers → Email.');
  return data;
}
export const signOut = () => { try { localStorage.removeItem('gob_links'); } catch {} return sb.auth.signOut(); };
export async function currentUser() { const { data } = await sb.auth.getUser(); return data.user; }

// ---------- profile ----------
export const getProfile = id => sb.from('profiles').select('*').eq('id', id).single().then(must);
export const setName = (id, display_name) => sb.from('profiles').update({ display_name }).eq('id', id).then(must);

// ---------- groups ----------
export const myGroups = () => sb.from('groups').select('id, name, invite_code, owner_id').order('created_at').then(must);
export const createGroup = name => sb.rpc('create_group', { p_name: name }).then(must);
export const joinGroup = code => sb.rpc('join_group', { p_code: code }).then(must);
export const leaveGroup = (groupId, userId) => sb.from('group_members').delete().match({ group_id: groupId, user_id: userId }).then(must);
export const leaderboard = groupId => sb.rpc('group_leaderboard', { p_group: groupId }).then(must);
export const members = groupId => sb.from('group_members').select('user_id').eq('group_id', groupId).then(must);

// ---------- check-ins ----------
// The small feed copy sits beside the full photo: abc.jpg → abc_t.jpg
export const thumbPath = p => p.replace(/\.jpg$/, '_t.jpg');

export async function postCheckin(userId, photo, note) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const bucket = sb.storage.from(PHOTO_BUCKET), opts = { contentType: 'image/jpeg', upsert: false };
  must(await bucket.upload(path, photo.full, opts));
  const t = await bucket.upload(thumbPath(path), photo.thumb, opts);
  const { error } = t.error ? t : await sb.from('checkins').insert({ photo_path: path, note: note || null });
  if (error) { await bucket.remove([path, thumbPath(path)]); throw error; }  // don't leave orphan photos
}

// ---------- signed photo links, reused until near expiry ----------
// The same link every time means the browser's cache serves repeat views for free.
const LINK_LIFE = 6 * 3600, LINK_KEY = 'gob_links';
let links = {};
try { links = JSON.parse(localStorage.getItem(LINK_KEY) || '{}'); } catch { links = {}; }
function saveLinks() {
  const now = Date.now();
  for (const k of Object.keys(links)) if (links[k].exp < now) delete links[k];
  try { localStorage.setItem(LINK_KEY, JSON.stringify(links)); } catch { /* storage full or blocked */ }
}
export async function photoLinks(paths) {
  const soon = Date.now() + 10 * 60 * 1000;
  const need = paths.filter(p => !(links[p] && links[p].exp > soon));
  if (need.length) {
    const signed = must(await sb.storage.from(PHOTO_BUCKET).createSignedUrls(need, LINK_LIFE));
    for (const s of signed) if (s.signedUrl) links[s.path] = { url: s.signedUrl, exp: Date.now() + LINK_LIFE * 1000 };
    saveLinks();
  }
  return Object.fromEntries(paths.map(p => [p, links[p]?.url || null]));
}

// Feed for one group: everyone in the group, newest first, `limit` rows.
export async function groupFeed(groupId, limit) {
  const ids = (await members(groupId)).map(m => m.user_id);
  if (!ids.length) return [];
  const rows = must(await sb.from('checkins')
    .select('id, user_id, photo_path, note, created_at, profiles(display_name)')
    .in('user_id', ids).order('created_at', { ascending: false }).limit(limit));
  if (!rows.length) return rows;
  const url = await photoLinks(rows.map(r => thumbPath(r.photo_path)));
  // check-ins from before thumbnails existed fall back to the full photo
  const missing = rows.filter(r => !url[thumbPath(r.photo_path)]).map(r => r.photo_path);
  const full = missing.length ? await photoLinks(missing) : {};
  return rows.map(r => ({ ...r, thumb: url[thumbPath(r.photo_path)] || full[r.photo_path] }));
}

export async function fullPhoto(path) { return (await photoLinks([path]))[path]; }

export async function deleteCheckin(row) {
  must(await sb.from('checkins').delete().eq('id', row.id));
  await sb.storage.from(PHOTO_BUCKET).remove([row.photo_path, thumbPath(row.photo_path)]);
}

// ---------- gym tracker ----------
// Calendar day in the UK, e.g. "2026-11-11" (one workout per person per day)
export const ukToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

// rows: [{exercise_id, set_no, weight_kg, reps}] — replaces whatever was saved for today
export async function saveWorkout(userId, rows) {
  const w = must(await sb.from('workouts')
    .upsert({ user_id: userId, performed_on: ukToday() }, { onConflict: 'user_id,performed_on' })
    .select('id').single());
  must(await sb.from('workout_sets').delete().eq('workout_id', w.id));
  if (rows.length) must(await sb.from('workout_sets').insert(rows.map(r => ({ ...r, workout_id: w.id }))));
  return w.id;
}
// every set of one person (you or a groupmate), oldest first
export const liftHistory = userId => sb.rpc('lift_history', { p_user: userId }).then(must);
// heaviest set per member for the four PB-board lifts
export const groupLifts = groupId => sb.rpc('group_lifts', { p_group: groupId, p_exercises: BIG_FOUR }).then(must);

// ---------- me: language, targets, personal details ----------
export const ukDayOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso));
export const updateProfile = (id, fields) => sb.from('profiles').update(fields).eq('id', id).then(must);
export async function checkedInToday(userId) {
  const rows = must(await sb.from('checkins').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1));
  return !!rows.length && ukDayOf(rows[0].created_at) === ukToday();
}
// private unless share_body is on (database rules enforce it)
export async function bodyProfile(userId) {
  const rows = must(await sb.from('body_profiles').select('*').eq('user_id', userId));
  return rows[0] || null;
}
export const saveBodyProfile = (userId, fields) =>
  sb.from('body_profiles').upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(must);
export const weights = userId => sb.from('body_weights').select('logged_on, weight_kg').eq('user_id', userId).order('logged_on').then(must);
export const logWeight = (userId, kg) =>
  sb.from('body_weights').upsert({ user_id: userId, logged_on: ukToday(), weight_kg: kg }, { onConflict: 'user_id,logged_on' }).then(must);
export const liftTargets = userId => sb.from('lift_targets').select('exercise_id, target_kg').eq('user_id', userId).then(must);
export const setLiftTarget = (userId, exercise_id, target_kg) =>
  sb.from('lift_targets').upsert({ user_id: userId, exercise_id, target_kg }, { onConflict: 'user_id,exercise_id' }).then(must);
export const dropLiftTarget = (userId, exercise_id) => sb.from('lift_targets').delete().match({ user_id: userId, exercise_id }).then(must);
export const groupRankings = groupId => sb.rpc('group_rankings', { p_group: groupId }).then(must);
// check-in days in this UK week (Mon–Sun) for the days-per-week target
export async function daysThisWeek(userId) {
  const now = new Date(ukToday() + 'T12:00:00Z'), monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const since = new Date(monday.getTime() - 24 * 3600 * 1000).toISOString();
  const rows = must(await sb.from('checkins').select('created_at').eq('user_id', userId).gte('created_at', since));
  const mon = monday.toISOString().slice(0, 10);
  return new Set(rows.map(r => ukDayOf(r.created_at)).filter(d => d >= mon)).size;
}
