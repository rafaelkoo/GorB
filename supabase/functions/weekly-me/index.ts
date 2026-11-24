// Supabase Edge Function: every Sunday evening (pg_cron, migration 047) sends each person a push about
// their own week: gym days against their target, PRs, and their streak. If they're one day short there's
// still Sunday evening, so it says so. Each person is sent once per week (week_me_sent), so calling it
// again sends nothing; that's why it needs no secret (Verify JWT is off).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
  { auth: { persistSession: false } }
);
webpush.setVapidDetails('https://rafaelkoo.github.io/GorB/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

type S = { week_start: string; days: number; target: number; prs: number; streak: number; hit: boolean };

function text(s: S, zh: boolean) {
  const short = s.target - s.days;
  const head = zh
    ? (s.hit ? `🎯 今個星期去咗 ${s.days} 日，達標！` : `今個星期去咗 ${s.days} / ${s.target} 日`)
    : (s.hit ? `🎯 ${s.days} gym days this week: target hit!` : `${s.days} of ${s.target} gym days this week`);
  const bits = [head];
  if (s.prs) bits.push(zh ? `💪 破咗 ${s.prs} 個 PR` : `💪 ${s.prs} PR${s.prs > 1 ? 's' : ''}`);
  if (s.hit) bits.push(zh ? `🔥 連續 ${s.streak + 1} 個星期` : `🔥 ${s.streak + 1}-week streak`);
  else if (short === 1) bits.push(zh ? '差 1 日：今晚仲嚟得切！' : 'One day short: there’s still tonight!');
  else if (s.streak > 0) bits.push(zh ? `你有 ${s.streak} 個星期嘅連續紀錄，用保護盾可以保住` : `A shield can keep your ${s.streak}-week streak`);
  return bits.join(zh ? '　' : ' · ');
}

Deno.serve(async () => {
  const { data: subs } = await db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth');
  const byUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subs ?? []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id)!.push(s); }
  const ids = [...byUser.keys()];
  if (!ids.length) return json({ sent: 0 });
  const { data: langs } = await db.from('profiles').select('id, lang').in('id', ids);
  const zhOf = Object.fromEntries((langs ?? []).map(p => [p.id, p.lang === 'zh']));
  let sent = 0, skipped = 0;
  const gone: string[] = [];
  for (const uid of ids) {
    const { data: s } = await db.rpc('week_summary', { p_user: uid });
    if (!s) { skipped++; continue; }
    // claim this person's week; if it was already sent, move on
    const { data: claim } = await db.from('week_me_sent').insert({ user_id: uid, week_start: s.week_start }).select('user_id');
    if (!claim?.length) { skipped++; continue; }
    const zh = !!zhOf[uid];
    const payload = JSON.stringify({ title: zh ? '你嘅一星期' : 'Your week', body: text(s as S, zh), url: './#/me', tag: 'week-me' });
    for (const sub of byUser.get(uid)!) {
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 21600, urgency: 'normal' }); sent++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(sub.endpoint);
        else console.error('push failed', code, (e as { body?: string }).body);
      }
    }
  }
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return json({ sent, skipped });
});
