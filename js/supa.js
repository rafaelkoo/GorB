// Supabase client + every call the app makes, in one place.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHOTO_BUCKET } from './config.js';
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
export const joinGroup = (code, showHistory = true) => sb.rpc('join_group', { p_code: code, p_show_history: showHistory }).then(must);
export const groupPreview = code => sb.rpc('group_preview', { p_code: code }).then(must);
export const myGroupCards = () => sb.rpc('my_group_cards').then(must);
export const setGroupPrefs = (groupId, prefs) => sb.rpc('set_group_prefs', { p_group: groupId, p_prefs: prefs }).then(must);
// anyone in the group can rename it; the database logs each rename as a line in the chat
export const renameGroup = (groupId, name) => sb.rpc('rename_group', { p_group: groupId, p_name: name }).then(must);

// ---------- group chat (members only, kept forever) ----------
const CHAT_COLS = 'id, group_id, user_id, kind, body, created_at, checkin_id, reply_to';
export const chatPage = (groupId, before, limit = 50) => {
  let q = sb.from('chat_messages').select(CHAT_COLS).eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  return q.then(must).then(rows => rows.reverse());
};
export const chatSince = (groupId, after) => sb.from('chat_messages').select(CHAT_COLS).eq('group_id', groupId).gt('created_at', after).order('created_at').then(must);
export const sendChat = (userId, groupId, body, checkinId = null, replyTo = null) =>
  sb.from('chat_messages').insert({ group_id: groupId, user_id: userId, body, ...(checkinId ? { checkin_id: checkinId } : {}), ...(replyTo ? { reply_to: replyTo } : {}) })
    .select(CHAT_COLS).single().then(must);
// messages by id (the ones replies point at, when they're older than what's loaded)
export const chatByIds = ids => (ids.length ? sb.from('chat_messages').select(CHAT_COLS).in('id', ids).then(must) : Promise.resolve([]));
// emoji reactions on chat messages: { messageId: [{ user_id, emoji }] }
export async function chatReactions(messageIds) {
  if (!messageIds.length) return {};
  const out = {};
  for (let i = 0; i < messageIds.length; i += 150) {   // keep the URL short
    const rows = must(await sb.from('chat_reactions').select('message_id, user_id, emoji, created_at').in('message_id', messageIds.slice(i, i + 150)).order('created_at'));
    for (const r of rows) (out[r.message_id] ||= []).push({ user_id: r.user_id, emoji: r.emoji });
  }
  return out;
}
// set my reaction on a message; the same emoji again (or null) takes it off
export async function setChatReaction(userId, messageId, emoji, current) {
  const q = sb.from('chat_reactions');
  if (!emoji || emoji === current) return must(await q.delete().eq('message_id', messageId).eq('user_id', userId));
  if (current) return must(await q.update({ emoji }).eq('message_id', messageId).eq('user_id', userId));
  return must(await q.insert({ message_id: messageId, user_id: userId, emoji }));
}
// the check-in photos chat replies point at: { id: { user_id, name, created_at, photo_path, thumb, gone } }
export async function checkinCards(ids) {
  if (!ids.length) return {};
  const rows = must(await sb.from('checkins').select('id, user_id, photo_path, photo_expired, created_at, profiles!checkins_user_id_fkey(display_name)').in('id', ids));
  const cutoff = Date.now() - PHOTO_DAYS * 864e5;
  const live = rows.filter(r => !r.photo_expired && new Date(r.created_at).getTime() > cutoff);
  const url = live.length ? await photoLinks(live.map(r => thumbPath(r.photo_path))) : {};
  return Object.fromEntries(rows.map(r => [r.id, { user_id: r.user_id, name: r.profiles?.display_name, created_at: r.created_at, photo_path: r.photo_path,
    gone: !live.includes(r), thumb: live.includes(r) ? url[thumbPath(r.photo_path)] : null }]));
}
export const markChatRead = (userId, groupId) =>
  sb.from('chat_reads').upsert({ user_id: userId, group_id: groupId, read_at: new Date().toISOString() }, { onConflict: 'user_id,group_id' }).then(must);
export const chatUnread = () => sb.rpc('chat_unread').then(must).then(rows => Object.fromEntries(rows.map(r => [r.group_id, r.unread])));
// live new messages for one group; returns a function that stops listening
export function chatLive(groupId, onRow, onStatus, onReaction) {
  if (!sb.channel) return () => {};
  const ch = sb.channel(`chat-${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, p => onRow(p.new))
    // new or changed reactions arrive live; removed ones show up on the next 15-second check
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions', filter: `group_id=eq.${groupId}` }, p => onReaction?.(p))
    .subscribe(st => onStatus?.(st));
  return () => { try { sb.removeChannel(ch); } catch { /* already gone */ } };
}

export const leaveGroup = (groupId, userId) => sb.from('group_members').delete().match({ group_id: groupId, user_id: userId }).then(must);
export const weekReview = groupId => sb.rpc('group_week_review', { p_group: groupId }).then(must);
export const groupHistory = groupId => sb.rpc('group_history', { p_group: groupId }).then(must);
// today's rewards (London day): the chest, the welcome-back bonus and any summon you answered
export const todayRewards = since => sb.from('rewards').select('kind, ref, xp, coins, meta, created_at').in('kind', ['chest', 'comeback', 'summon']).gte('created_at', since).then(must);
export const seasonPass = () => sb.rpc('season_pass').then(must);
export const claimSeason = need => sb.rpc('claim_season', { p_need: need }).then(must);
// character items you've unlocked (from season rewards)
export const myItems = () => sb.from('rewards').select('meta').eq('kind', 'season').then(must).then(rows => rows.map(r => r.meta?.item).filter(Boolean));
export const myQuests = () => sb.rpc('my_quests').then(must).then(x => x || []);
export const claimQuest = id => sb.rpc('claim_quest', { p_id: id }).then(must);
export const groupDogs = groupId => sb.rpc('group_dogs', { p_group: groupId }).then(must);
export const characterNext = userId => sb.rpc('character_next', { p_user: userId }).then(must);
export const setCaption = (checkinId, groupId, note) => sb.rpc('set_caption', { p_checkin: checkinId, p_group: groupId, p_note: note }).then(must);
export const groupBoss = groupId => sb.rpc('group_boss', { p_group: groupId }).then(must);
// ---------- battles: moves, the Gym Tower, boss raids and friendly matches ----------
export const allMoves = () => sb.from('moves').select('id, en, zh, type, stat, power, effect, effect_val, req_kind, req_cat, req_val, desc_en, desc_zh, sort, types, stats, uses, req_moves, price').neq('req_kind', 'monster').order('sort').then(must);
export const characterMoves = userId => sb.rpc('character_moves', { p_user: userId }).then(must);
export const setMoves = ids => sb.rpc('set_moves', { p_moves: ids }).then(must);
export const myTower = () => sb.rpc('my_tower').then(must);
export const towerFight = floor => sb.rpc('tower_fight', floor ? { p_floor: floor } : {}).then(must);
// pets, shop and the boss lair
export const shopItems = () => sb.from('shop_items').select('*').order('sort').then(must);
export const myBag = () => sb.rpc('my_items').then(must);
export const shopBuy = (item, qty = 1) => sb.rpc('shop_buy', { p_item: item, p_qty: qty }).then(must);
export const myPets = () => sb.rpc('my_pets').then(must);
export const setTeam = ids => sb.rpc('set_team', { p_pets: ids }).then(must);
export const petUpdate = (id, nickname, release = false) => sb.rpc('pet_update', { p_pet: id, p_nickname: nickname, p_release: release }).then(must);
export const battleItem = (id, item) => sb.rpc('battle_item', { p_id: id, p_item: item }).then(must);
export const battleSwitch = (id, to) => sb.rpc('battle_switch', { p_id: id, p_to: to }).then(must);
export const buyMove = id => sb.rpc('buy_move', { p_move: id }).then(must);
export const petFeed = (id, item) => sb.rpc('pet_feed', { p_pet: id, p_item: item }).then(must);
export const petTeach = (id, move) => sb.rpc('pet_teach', { p_pet: id, p_move: move }).then(must);
export const petTest = id => sb.rpc('pet_test', { p_pet: id }).then(must);
export const petEvoChoice = (id, choice) => sb.rpc('pet_evo_choice', { p_pet: id, p_choice: choice }).then(must);
export const movesByIds = ids => (ids.length ? sb.from('moves').select('id, en, zh, type, power, effect, effect_val, uses, desc_en, desc_zh').in('id', ids).then(must) : Promise.resolve([]));
export const evolvePet = id => sb.rpc('evolve_pet', { p_pet: id }).then(must);
export const myDex = () => sb.rpc('my_dex').then(must);
export const claimDex = set => sb.rpc('claim_dex', { p_set: set }).then(must);
export const shieldStatus = () => sb.rpc('shield_status').then(must);
export const useShield = () => sb.rpc('use_shield').then(must);
export const lairStatus = () => sb.rpc('lair_status').then(must);
export const lairFight = (species, pay) => sb.rpc('lair_fight', { p_species: species, p_pay: pay }).then(must);
export const raidFight = groupId => sb.rpc('raid_fight', { p_group: groupId }).then(must);
export const getBattle = id => sb.from('battles').select('*').eq('id', id).maybeSingle().then(must);
export const battleMove = (id, move) => sb.rpc('battle_move', { p_id: id, p_move: move }).then(must);
export const battleFlee = id => sb.rpc('battle_flee', { p_id: id }).then(must);
export const challenge = (opp, groupId) => sb.rpc('challenge', { p_opp: opp, p_group: groupId }).then(must);
export const respondBattle = (id, accept) => sb.rpc('respond_battle', { p_id: id, p_accept: accept }).then(must);
export const claimTimeout = id => sb.rpc('claim_timeout', { p_id: id }).then(must);
export const groupMatches = groupId => sb.from('battles').select('id, a, b, status, turn, winner, updated_at, snap').eq('group_id', groupId).eq('kind', 'pvp')
  .order('updated_at', { ascending: false }).limit(20).then(must);
// live changes to one battle (friendly matches); returns a function that stops listening
export function battleLive(id, onRow) {
  if (!sb.channel) return () => {};
  const ch = sb.channel(`battle-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${id}` }, p => onRow(p.new)).subscribe();
  return () => { try { sb.removeChannel(ch); } catch { /* already gone */ } };
}
export const claimBoss = (groupId, week = null) => sb.rpc('claim_boss', { p_group: groupId, ...(week ? { p_week: week } : {}) }).then(must);
// who you've summoned today (you can summon each person once a day, as many people as you like)
export const summonsSent = (fromUser, day) => sb.from('summons').select('to_user').eq('from_user', fromUser).eq('day', day).then(must).then(rows => rows.map(r => r.to_user));
export const summon = (toUser, groupId) => sb.rpc('summon', { p_to: toUser, p_group: groupId }).then(must);
export const characterCard = userId => sb.rpc('character_card', { p_user: userId }).then(must);
// what you're ticking in the Log today, for the pixel gym (see migration 023)
export const setGymLive = (userId, day, sets, lastEx) =>
  sb.from('gym_live').upsert({ user_id: userId, day, sets, last_ex: lastEx, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(must);
export const gymToday = groupId => sb.rpc('group_gym_today', { p_group: groupId }).then(must);
export const leaderboard = groupId => sb.rpc('group_leaderboard', { p_group: groupId }).then(must);
export const members = groupId => sb.from('group_members').select('user_id, joined_at, show_history, in_everyone').eq('group_id', groupId).then(must);
export const profilesOf = ids => (ids.length ? sb.from('profiles').select('id, display_name').in('id', ids).then(must) : Promise.resolve([]));

// ---------- check-ins ----------
// The small feed copy sits beside the full photo: abc.jpg → abc_t.jpg
export const thumbPath = p => p.replace(/\.jpg$/, '_t.jpg');

// captions: { groupId: text } for groups that get their own caption (same photo for every group)
export async function postCheckin(userId, photo, note, captions = {}) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const bucket = sb.storage.from(PHOTO_BUCKET), opts = { contentType: 'image/jpeg', upsert: false };
  must(await bucket.upload(path, photo.full, opts));
  const t = await bucket.upload(thumbPath(path), photo.thumb, opts);
  const { error } = t.error ? t : await sb.rpc('post_checkin', { p_path: path, p_note: note || '', p_captions: captions });
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
  const mem = await members(groupId), ids = mem.map(m => m.user_id);
  if (!ids.length) return [];
  const rows = must(await sb.from('checkins')
    .select('id, user_id, photo_path, photo_expired, note, created_at, profiles!checkins_user_id_fkey(display_name)')
    .in('user_id', ids).order('created_at', { ascending: false }).limit(limit));
  // someone who joined without showing their history: only their check-ins from after they joined
  const from = Object.fromEntries(mem.filter(m => m.show_history === false && m.joined_at).map(m => [m.user_id, m.joined_at]));
  for (let i = rows.length - 1; i >= 0; i--) if (from[rows[i].user_id] && rows[i].created_at < from[rows[i].user_id]) rows.splice(i, 1);
  if (!rows.length) return rows;
  // this group's own captions replace the default one
  const caps = must(await sb.from('checkin_captions').select('checkin_id, note').eq('group_id', groupId).in('checkin_id', rows.map(r => r.id)));
  for (const c of caps) { const r = rows.find(x => x.id === c.checkin_id); if (r) { r.note = c.note || null; r.own_caption = true; } }
  const cutoff = Date.now() - PHOTO_DAYS * 864e5;
  const live = rows.filter(r => !r.photo_expired && new Date(r.created_at).getTime() > cutoff);
  const url = live.length ? await photoLinks(live.map(r => thumbPath(r.photo_path))) : {};
  // check-ins from before thumbnails existed fall back to the full photo
  const missing = live.filter(r => !url[thumbPath(r.photo_path)]).map(r => r.photo_path);
  const full = missing.length ? await photoLinks(missing) : {};
  const rx = await reactionsFor(rows.map(r => r.id)).catch(() => ({}));
  return rows.map(r => ({ ...(live.includes(r) ? { ...r, gone: false, thumb: url[thumbPath(r.photo_path)] || full[r.photo_path] } : { ...r, gone: true, thumb: null }), reactions: rx[r.id] || [] }));
}

// emoji reactions under check-in photos: one per person per photo
export async function reactionsFor(ids) {
  if (!ids.length) return {};
  const rows = must(await sb.from('checkin_reactions').select('checkin_id, user_id, emoji, created_at, profiles!checkin_reactions_user_id_fkey(display_name)').in('checkin_id', ids).order('created_at'));
  const out = {};
  for (const r of rows) (out[r.checkin_id] ||= []).push({ user_id: r.user_id, emoji: r.emoji, name: r.profiles?.display_name || '' });
  return out;
}
// set my reaction to emoji; null (or the same emoji again) takes it off
export async function setReaction(userId, checkinId, emoji, current) {
  if (!emoji || emoji === current) return must(await sb.from('checkin_reactions').delete().eq('checkin_id', checkinId).eq('user_id', userId));
  if (current) return must(await sb.from('checkin_reactions').update({ emoji }).eq('checkin_id', checkinId).eq('user_id', userId));
  return must(await sb.from('checkin_reactions').insert({ checkin_id: checkinId, user_id: userId, emoji }));
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
export const setCustomExerciseCat = (id, cat) => sb.from('custom_exercises').update({ cat }).eq('id', id).then(must);
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
export const setHabit = (userId, habit, on) => on
  ? sb.from('habit_ticks').upsert({ user_id: userId, day: ukToday(), habit }, { onConflict: 'user_id,day,habit', ignoreDuplicates: true }).then(must)
  : sb.from('habit_ticks').delete().match({ user_id: userId, day: ukToday(), habit }).then(must);
export const checkinDates = userId => sb.from('checkins').select('created_at').eq('user_id', userId).then(must).then(r => r.map(x => ukDayOf(x.created_at)));
// Monday of the current UK week, "YYYY-MM-DD"
export function ukWeekStart() {
  const d = new Date(ukToday() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
