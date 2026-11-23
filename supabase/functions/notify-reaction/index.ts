// Supabase Edge Function: tells the owner of a check-in photo, or the author of a chat message
// (called with { id, chat: true }, migration 020), that someone reacted to it.
// Called by the reaction_notify trigger (migration 018) with just { id }. It claims the reaction by
// setting notified_at, so a repeat call, an old reaction or a made-up id sends nothing; that's why it
// needs no secret (Verify JWT is off). All reactions to one photo share a tag, so the newest replaces
// the last one on the phone instead of piling up.
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
  let id = '', chat = false, summon = false;
  try { const b = await req.json(); id = String(b?.id ?? ''); chat = b?.chat === true; summon = b?.summon === true; } catch { /* no body */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ skipped: 'no reaction id' }, 400);

  const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  if (chat) return chatReaction(id, tenMin);
  if (summon) return summonPush(id, tenMin);
  const { data: rx } = await db.from('checkin_reactions').update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).gte('created_at', tenMin)
    .select('checkin_id, user_id, emoji').maybeSingle();
  if (!rx) return json({ skipped: 'already sent, too old or not found' });

  const { data: ci } = await db.from('checkins').select('id, user_id').eq('id', rx.checkin_id).maybeSingle();
  if (!ci || ci.user_id === rx.user_id) return json({ sent: 0 });   // no push for reacting to your own photo

  const [{ data: who }, { data: owner }, { data: subs }, { data: grp }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', rx.user_id).single(),
    db.from('profiles').select('lang').eq('id', ci.user_id).single(),
    db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', ci.user_id),
    // open the group the two of them share
    db.rpc('shared_group_of', { a: ci.user_id, b: rx.user_id })
  ]);
  if (!subs?.length) return json({ sent: 0 });

  const name = who?.display_name || 'Someone';
  const zh = owner?.lang === 'zh';
  const payload = JSON.stringify({
    title: 'Gym or Bitch',
    body: zh ? `${name} 對你嘅打卡相回應咗 ${rx.emoji}` : `${name} reacted ${rx.emoji} to your check-in`,
    url: grp ? `./#/g/${grp}` : './', tag: `react-${ci.id}`
  });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' });
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

// a reaction to a chat message: goes into that group's chat notification, like WhatsApp
async function chatReaction(id: string, since: string) {
  const { data: rx } = await db.from('chat_reactions').update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).gte('created_at', since)
    .select('message_id, user_id, emoji, group_id').maybeSingle();
  if (!rx) return json({ skipped: 'already sent, too old or not found' });
  const { data: msg } = await db.from('chat_messages').select('user_id, body').eq('id', rx.message_id).maybeSingle();
  if (!msg?.user_id || msg.user_id === rx.user_id) return json({ sent: 0 });

  const [{ data: who }, { data: owner }, { data: group }, { data: subs }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', rx.user_id).single(),
    db.from('profiles').select('lang').eq('id', msg.user_id).single(),
    db.from('groups').select('name').eq('id', rx.group_id).single(),
    db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', msg.user_id)
  ]);
  if (!subs?.length) return json({ sent: 0 });
  const name = who?.display_name || 'Someone';
  const quote = msg.body.length > 60 ? msg.body.slice(0, 57) + '…' : msg.body;
  const line = owner?.lang === 'zh' ? `${name} 對「${quote}」回應咗 ${rx.emoji}` : `${name} reacted ${rx.emoji} to “${quote}”`;
  const payload = JSON.stringify({ title: group?.name || 'Gym or Bitch', body: line, line, url: `./#/c/${rx.group_id}`, tag: `chat-${rx.group_id}`, chat: rx.group_id });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async s => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' }); sent++; }
    catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else console.error('push failed', code, (e as { body?: string }).body);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return json({ sent, removed: gone.length });
}

// a summon from the pixel gym: "Rafael is calling you to the gym!"
async function summonPush(id: string, since: string) {
  const { data: sm } = await db.from('summons').update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).gte('created_at', since)
    .select('from_user, to_user, group_id').maybeSingle();
  if (!sm) return json({ skipped: 'already sent, too old or not found' });
  const [{ data: who }, { data: to }, { data: subs }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', sm.from_user).single(),
    db.from('profiles').select('lang').eq('id', sm.to_user).single(),
    db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', sm.to_user)
  ]);
  if (!subs?.length) return json({ sent: 0 });
  const name = who?.display_name || 'Someone', zh = to?.lang === 'zh';
  const payload = JSON.stringify({
    title: zh ? `📣 ${name} 召喚你去 gym！` : `📣 ${name} is calling you to the gym!`,
    body: zh ? '24 個鐘內打卡，你哋兩個都有 15 💧 汗水幣' : 'Check in within 24 hours and you both get 15 💧 sweat coins',
    url: `./#/g/${sm.group_id}`, tag: `summon-${sm.to_user}`
  });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async s => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' }); sent++; }
    catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else console.error('push failed', code, (e as { body?: string }).body);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return json({ sent, removed: gone.length });
}
