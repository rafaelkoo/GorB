// Supabase Edge Function: pushes a new group-chat message to the other members (WhatsApp style).
// Called by the chat_notify trigger (migration 013) with just { id }. It reads the message itself
// and claims it by setting notified_at, so a repeat call, an old message or a made-up id sends
// nothing; that's why it needs no secret (Verify JWT is off).
// Title = group name, body = "Name: message". All messages from one group share a tag, so the
// phone stacks them into one notification (the service worker adds the earlier lines).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
  { auth: { persistSession: false } }
);
webpush.setVapidDetails('https://rafaelkoo.github.io/GorB/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async req => {
  let id = '';
  try { id = String((await req.json())?.id ?? ''); } catch { /* no body */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ skipped: 'no message id' }, 400);

  // claim it: only a text message from the last 10 minutes that hasn't been pushed yet
  const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: msg } = await db.from('chat_messages').update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).eq('kind', 'text').gte('created_at', tenMin)
    .select('id, group_id, user_id, body, checkin_id').maybeSingle();
  if (!msg) return json({ skipped: 'already sent, too old or not found' });

  const [{ data: group }, { data: sender }, { data: mates }] = await Promise.all([
    db.from('groups').select('name').eq('id', msg.group_id).single(),
    db.from('profiles').select('display_name').eq('id', msg.user_id).single(),
    db.from('group_members').select('user_id').eq('group_id', msg.group_id).neq('user_id', msg.user_id)
  ]);
  const ids = (mates ?? []).map(m => m.user_id);
  if (!ids.length) return json({ sent: 0 });
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', ids);

  const name = sender?.display_name || 'Someone';
  // a reply to a check-in photo gets a camera in front, so people know which kind of message it is
  const line = `${name}: ${msg.checkin_id ? '📷 ' : ''}${msg.body.length > 180 ? msg.body.slice(0, 177) + '…' : msg.body}`;
  const payload = JSON.stringify({
    title: group?.name || 'Gym or Bitch', body: line, line,
    url: `./#/c/${msg.group_id}`, tag: `chat-${msg.group_id}`, chat: msg.group_id
  });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else console.error('push failed', code, (e as { body?: string }).body);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return json({ sent, removed: gone.length });
});
