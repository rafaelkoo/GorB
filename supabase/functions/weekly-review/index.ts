// Supabase Edge Function: every Monday morning (pg_cron, migration 019) sends each group a push
// with last week's review: who went most, who hit their days target, who set a new PB, who didn't go.
// Each group is sent once per week (week_review_sent), so calling it again sends nothing; that's why
// it needs no secret (Verify JWT is off). The full review is on the group page.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
  { auth: { persistSession: false } }
);
webpush.setVapidDetails('https://rafaelkoo.github.io/GorB/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

type M = { user_id: string; name: string; target: number | null; days: number; prs: unknown[] };
const list = (xs: string[], zh: boolean) => xs.length <= 2 ? xs.join(zh ? '、' : ' & ') : `${xs.slice(0, 2).join(zh ? '、' : ', ')} ${zh ? `等 ${xs.length} 人` : `+${xs.length - 2}`}`;

function line(members: M[], zh: boolean) {
  const top = Math.max(0, ...members.map(m => m.days));
  const best = members.filter(m => m.days === top && top > 0).map(m => m.name);
  const hit = members.filter(m => m.target && m.days >= m.target).map(m => m.name);
  const pb = members.filter(m => m.prs.length).map(m => m.name);
  const none = members.filter(m => m.days === 0).map(m => m.name);
  if (!top) return zh ? '上星期冇人去過 gym 😬 今個星期由你開始？' : 'Nobody went to the gym last week 😬 Start this week off?';
  const bits = zh
    ? [`🏆 ${list(best, true)} ${top} 日`, hit.length ? `🎯 ${list(hit, true)} 達標` : '', pb.length ? `💪 ${list(pb, true)} 破 PB` : '', none.length ? `😴 ${list(none, true)} 冇去` : '']
    : [`🏆 ${list(best, false)} ${top} day${top === 1 ? '' : 's'}`, hit.length ? `🎯 ${list(hit, false)} hit target` : '', pb.length ? `💪 ${list(pb, false)} new PB` : '', none.length ? `😴 ${list(none, false)} didn't go` : ''];
  return bits.filter(Boolean).join(' · ');
}

Deno.serve(async () => {
  const { data: groups } = await db.from('groups').select('id');
  let sent = 0, skipped = 0;
  for (const g of groups ?? []) {
    const { data: rv } = await db.rpc('group_week_review', { p_group: g.id });
    const members: M[] = rv?.members ?? [];
    if (members.length < 2) { skipped++; continue; }   // nothing to compare in a group of one
    // claim this group's week; if it was already sent, move on
    const { data: claim } = await db.from('week_review_sent').insert({ group_id: g.id, week_start: rv.week_start }).select('group_id');
    if (!claim?.length) { skipped++; continue; }

    const ids = members.map(m => m.user_id);
    const [{ data: subs }, { data: langs }] = await Promise.all([
      db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', ids),
      db.from('profiles').select('id, lang').in('id', ids)
    ]);
    const zhOf = Object.fromEntries((langs ?? []).map(p => [p.id, p.lang === 'zh']));
    const gone: string[] = [];
    await Promise.all((subs ?? []).map(async s => {
      const zh = !!zhOf[s.user_id];
      const payload = JSON.stringify({
        title: zh ? `${rv.group_name} · 上星期總結` : `${rv.group_name} · last week`,
        body: line(members, zh), url: `./#/g/${g.id}`, tag: `week-${g.id}`
      });
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' }); sent++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
        else console.error('push failed', code, (e as { body?: string }).body);
      }
    }));
    if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  }
  return json({ sent, skipped });
});
