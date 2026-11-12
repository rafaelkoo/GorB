// Supabase client + every call the app makes, in one place.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHOTO_BUCKET } from './config.js';
import { BIG_FOUR } from './exercises.js';
import { t } from './i18n.js';

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
// anyone in the group can rename it; the database logs each rename as a line in the chat
export const renameGroup = (groupId, name) => sb.rpc('rename_group', { p_group: groupId, p_name: name }).then(must);

// ---------- group chat (members only, kept forever) ----------
const CHAT_COLS = 'id, group_id, user_id, kind, body, created_at';
export const chatPage = (groupId, before, limit = 50) => {
  let q = sb.from('chat_messages').select(CHAT_COLS).eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  return q.then(must).then(rows => rows.reverse());
};
export const chatSince = (groupId, after) => sb.from('chat_messages').select(CHAT_COLS).eq('group_id', groupId).gt('created_at', after).order('created_at').then(must);
export const sendChat = (userId, groupId, body) => sb.from('chat_messages').insert({ group_id: groupId, user_id: userId, body }).select(CHAT_COLS).single().then(must);
export const markChatRead = (userId, groupId) =>
  sb.from('chat_reads').upsert({ user_id: userId, group_id: groupId, read_at: new Date().toISOString() }, { onConflict: 'user_id,group_id' }).then(must);
export const chatUnread = () => sb.rpc('chat_unread').then(must).then(rows => Object.fromEntries(rows.map(r => [r.group_id, r.unread])));
// live new messages for one group; returns a function that stops listening
export function chatLive(groupId, onRow, onStatus) {
  if (!sb.channel) return () => {};
  const ch = sb.channel(`chat-${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, p => onRow(p.new))
    .subscribe(st => onStatus?.(st));
  return () => { try { sb.removeChannel(ch); } catch { /* already gone */ } };
}

export const leaveGroup = (groupId, userId) => sb.from('group_members').delete().match({ group_id: groupId, user_id: userId }).then(must);
export const leaderboard = groupId => sb.rpc('group_leaderboard', { p_group: groupId }).then(must);
export const members = groupId => sb.from('group_members').select('user_id').eq('group_id', groupId).then(must);
export const profilesOf = ids => (ids.length ? sb.from('profiles').select('id, display_name').in('id', ids).then(must) : Promise.resolve([]));

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
// Photos are kept for a week (cleanup-photos deletes them); older check-ins come back with gone: true.
export const PHOTO_DAYS = 7;
export async function groupFeed(groupId, limit) {
  const ids = (await members(groupId)).map(m => m.user_id);
  if (!ids.length) return [];
  const rows = must(await sb.from('checkins')
    .select('id, user_id, photo_path, photo_expired, note, created_at, profiles(display_name)')
    .in('user_id', ids).order('created_at', { ascending: false }).limit(limit));
  if (!rows.length) return rows;
  const cutoff = Date.now() - PHOTO_DAYS * 864e5;
  const live = rows.filter(r => !r.photo_expired && new Date(r.created_at).getTime() > cutoff);
  const url = live.length ? await photoLinks(live.map(r => thumbPath(r.photo_path))) : {};
  // check-ins from before thumbnails existed fall back to the full photo
  const missing = live.filter(r => !url[thumbPath(r.photo_path)]).map(r => r.photo_path);
  const full = missing.length ? await photoLinks(missing) : {};
  return rows.map(r => live.includes(r) ? { ...r, gone: false, thumb: url[thumbPath(r.photo_path)] || full[r.photo_path] } : { ...r, gone: true, thumb: null });
}

export async function fullPhoto(path) { return (await photoLinks([path]))[path]; }

export async function deleteCheckin(row) {
  must(await sb.from('checkins').delete().eq('id', row.id));
  if (!row.photo_expired) await sb.storage.from(PHOTO_BUCKET).remove([row.photo_path, thumbPath(row.photo_path)]);
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
export const liftTargets = userId => sb.from('lift_targets').select('exercise_id, target_kg, target_reps, by_date, set_on, base_e1rm').eq('user_id', userId).then(must);
export const setLiftTarget = (userId, exercise_id, target_kg) =>
  sb.from('lift_targets').upsert({ user_id: userId, exercise_id, target_kg }, { onConflict: 'user_id,exercise_id' }).then(must);
export const dropLiftTarget = (userId, exercise_id) => sb.from('lift_targets').delete().match({ user_id: userId, exercise_id }).then(must);
export const groupRankings = groupId => sb.rpc('group_rankings', { p_group: groupId }).then(must);
export const groupExerciseRanks = groupId => sb.rpc('group_exercise_ranks', { p_group: groupId }).then(must);
// check-in days in this UK week (Mon–Sun) for the days-per-week target
export async function daysThisWeek(userId) {
  const now = new Date(ukToday() + 'T12:00:00Z'), monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const since = new Date(monday.getTime() - 24 * 3600 * 1000).toISOString();
  const rows = must(await sb.from('checkins').select('created_at').eq('user_id', userId).gte('created_at', since));
  const mon = monday.toISOString().slice(0, 10);
  return new Set(rows.map(r => ukDayOf(r.created_at)).filter(d => d >= mon)).size;
}

// ---------- weekly plan ----------
export async function getPlan(userId) {
  const rows = must(await sb.from('plans').select('plan').eq('user_id', userId));
  return rows[0]?.plan || null;
}
export const savePlan = (userId, plan) =>
  sb.from('plans').upsert({ user_id: userId, plan, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(must);
// UK weekday key for today: 'Mon'…'Sun'
export const ukWeekday = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ukToday() + 'T12:00:00Z').getUTCDay()];

// ---------- bulk insert for the FitTrack import ----------
export const existingWorkoutDays = userId => sb.from('workouts').select('performed_on').eq('user_id', userId).then(must).then(r => new Set(r.map(x => x.performed_on)));
export const insertWorkouts = rows => sb.from('workouts').insert(rows).select('id, performed_on').then(must);
export const insertSets = rows => sb.from('workout_sets').insert(rows).then(must);
export const upsertWeights = rows => sb.from('body_weights').upsert(rows, { onConflict: 'user_id,logged_on', ignoreDuplicates: true }).then(must);
export const upsertTargets = rows => sb.from('lift_targets').upsert(rows, { onConflict: 'user_id,exercise_id' }).then(must);

// ---------- your own exercises (you + groupmates can see; only you edit) ----------
export const customExercises = () => sb.from('custom_exercises').select('id, user_id, name, kind, cat').order('created_at').then(must);
export const addCustomExercise = row => sb.from('custom_exercises').insert(row).select('id, user_id, name, kind, cat').single().then(must);
export const renameCustomExercise = (id, name) => sb.from('custom_exercises').update({ name }).eq('id', id).then(must);
export const setCustomExerciseKind = (id, kind) => sb.from('custom_exercises').update({ kind }).eq('id', id).then(must);
export const deleteCustomExercise = id => sb.from('custom_exercises').delete().eq('id', id).then(must);

// ---------- requests for new library exercises (each person sees only their own) ----------
export const myRequests = () => sb.from('exercise_requests').select('id, name, note, status, created_at').order('created_at', { ascending: false }).then(must);
export const requestExercise = (name, note) => sb.from('exercise_requests').insert({ name, note: note || null }).then(must);
export const withdrawRequest = id => sb.from('exercise_requests').delete().eq('id', id).then(must);

// ---------- cardio (private) ----------
export const cardioLogs = (userId, from) => sb.from('cardio_logs').select('performed_on, kind, minutes').eq('user_id', userId).gte('performed_on', from).order('performed_on').then(must);
export const setCardio = (userId, kind, minutes) =>
  sb.from('cardio_logs').upsert({ user_id: userId, performed_on: ukToday(), kind, minutes }, { onConflict: 'user_id,performed_on,kind' }).then(must);
export const dropCardio = (userId, kind) => sb.from('cardio_logs').delete().match({ user_id: userId, performed_on: ukToday(), kind }).then(must);
export const upsertCardio = rows => sb.from('cardio_logs').upsert(rows, { onConflict: 'user_id,performed_on,kind', ignoreDuplicates: true }).then(must);

// ---------- habits (private) + check-in dates for points ----------
export const habitTicks = (userId, from) => sb.from('habit_ticks').select('day, habit').eq('user_id', userId).gte('day', from).then(must);
export const allHabitCount = userId => sb.from('habit_ticks').select('day').eq('user_id', userId).then(must).then(r => r.length);
export const setHabit = (userId, habit, on) => on
  ? sb.from('habit_ticks').upsert({ user_id: userId, day: ukToday(), habit }, { onConflict: 'user_id,day,habit', ignoreDuplicates: true }).then(must)
  : sb.from('habit_ticks').delete().match({ user_id: userId, day: ukToday(), habit }).then(must);
export const checkinDates = userId => sb.from('checkins').select('created_at').eq('user_id', userId).then(must).then(r => r.map(x => ukDayOf(x.created_at)));
// Monday of the current UK week, "YYYY-MM-DD"
export function ukWeekStart() {
  const d = new Date(ukToday() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
