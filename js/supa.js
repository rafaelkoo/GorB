// Supabase client + every call the app makes, in one place.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHOTO_BUCKET } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-');
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const must = ({ data, error }) => { if (error) throw error; return data; };

// ---------- auth (6-digit email code, no passwords) ----------
export const sendCode = email => sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).then(must);
export const verifyCode = (email, token) => sb.auth.verifyOtp({ email, token, type: 'email' }).then(must);
export const signOut = () => sb.auth.signOut();
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
export async function postCheckin(userId, blob, note) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  must(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  const { error } = await sb.from('checkins').insert({ photo_path: path, note: note || null });
  if (error) { await sb.storage.from(PHOTO_BUCKET).remove([path]); throw error; }  // don't leave orphan photos
}

// Feed for one group: everyone in the group, newest first, with short-lived photo links.
export async function groupFeed(groupId, limit = 30) {
  const ids = (await members(groupId)).map(m => m.user_id);
  if (!ids.length) return [];
  const rows = must(await sb.from('checkins')
    .select('id, user_id, photo_path, note, created_at, profiles(display_name)')
    .in('user_id', ids).order('created_at', { ascending: false }).limit(limit));
  if (!rows.length) return rows;
  const signed = must(await sb.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map(r => r.photo_path), 3600));
  const byPath = Object.fromEntries(signed.map(s => [s.path, s.signedUrl]));
  return rows.map(r => ({ ...r, url: byPath[r.photo_path] }));
}

export async function deleteCheckin(row) {
  must(await sb.from('checkins').delete().eq('id', row.id));
  await sb.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
}
