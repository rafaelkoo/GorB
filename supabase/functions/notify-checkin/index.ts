// Supabase Edge Function: tells a person's groupmates when they check in.
// Called by a Database Webhook on INSERT into public.checkins (see README → Push notifications).
//
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WEBHOOK_SECRET
// Settings: turn OFF "Verify JWT" for this function; the webhook proves itself with x-webhook-secret.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
  { auth: { persistSession: false } }
);
webpush.setVapidDetails(
  'https://rafaelkoo.github.io/GorB/',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

// Calendar day in the UK, e.g. "2026-11-11"
export const ukDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

// Only the first check-in of someone's UK day notifies anyone (stops spam).
export function isFirstToday(record: { id: string; created_at: string }, recent: { id: string; created_at: string }[]) {
  const today = ukDay(new Date(record.created_at));
  return !recent.some(c => c.id !== record.id && ukDay(new Date(c.created_at)) === today);
}

Deno.serve(async req => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return json({ error: 'forbidden' }, 403);
  const { type, record } = await req.json();
  if (type !== 'INSERT' || !record?.user_id) return json({ skipped: 'not a new check-in' });

  const since = new Date(new Date(record.created_at).getTime() - 26 * 3600 * 1000).toISOString();
  const { data: recent } = await db.from('checkins').select('id, created_at').eq('user_id', record.user_id).gte('created_at', since);
  if (!isFirstToday(record, recent ?? [])) return json({ skipped: 'already notified today' });

  // everyone who shares at least one group with the poster; remember one shared group to open
  const { data: mine } = await db.from('group_members').select('group_id').eq('user_id', record.user_id);
  const groupIds = (mine ?? []).map(m => m.group_id);
  if (!groupIds.length) return json({ skipped: 'poster is in no group' });
  const { data: mates } = await db.from('group_members').select('user_id, group_id').in('group_id', groupIds).neq('user_id', record.user_id);
  const openGroup = new Map<string, string>();
  for (const m of mates ?? []) if (!openGroup.has(m.user_id)) openGroup.set(m.user_id, m.group_id);
  if (!openGroup.size) return json({ sent: 0 });

  const [{ data: me }, { data: subs }, { data: langs }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', record.user_id).single(),
    db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', [...openGroup.keys()]),
    db.from('profiles').select('id, lang').in('id', [...openGroup.keys()])
  ]);
  const langOf = new Map((langs ?? []).map(p => [p.id, p.lang]));
  const name = me?.display_name || 'Someone';
  // each person gets it in the language they picked; the poster's own words if they typed any
  const text = (lang: string) => lang === 'zh'
    ? { title: `${name} 去咗 gym 💪`, body: record.note?.trim() || '仲唔郁？Gym or Bitch？' }
    : { title: `${name} is at the gym 💪`, body: record.note?.trim() || 'Get moving. Gym or Bitch?' };

  let sent = 0;
  const gone: string[] = [];
  await Promise.all((subs ?? []).map(async s => {
    const payload = JSON.stringify({ ...text(langOf.get(s.user_id) ?? 'en'), url: `./#/g/${openGroup.get(s.user_id)}` });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);   // phone unsubscribed or app removed
      else console.error('push failed', code, (e as { body?: string }).body);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return json({ sent, removed: gone.length });
});
