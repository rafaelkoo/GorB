// Supabase Edge Function: deletes check-in photos once they're a week old.
// The check-in itself stays (gym days, rankings and streaks don't change); only the
// picture and its thumbnail go, and the row is marked photo_expired so the feed shows a placeholder.
// Run once a day by pg_cron (migration 20261111000010). It takes no input and only ever
// removes photos older than 7 days, so calling it early does no harm; Verify JWT is off.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
  { auth: { persistSession: false } }
);
const BUCKET = 'checkins';
const KEEP_DAYS = 7;
const thumbPath = (p: string) => p.replace(/\.jpg$/, '_t.jpg');
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  let removed = 0;
  // a few batches per run is plenty for a friend group; whatever is left goes tomorrow
  for (let round = 0; round < 5; round++) {
    const { data: rows, error } = await db.from('checkins').select('id, photo_path')
      .eq('photo_expired', false).lt('created_at', cutoff).order('created_at').limit(100);
    if (error) return json({ error: error.message, removed }, 500);
    if (!rows?.length) break;
    const paths = rows.flatMap(r => [r.photo_path, thumbPath(r.photo_path)]);
    const rm = await db.storage.from(BUCKET).remove(paths);
    if (rm.error) return json({ error: rm.error.message, removed }, 500);
    const up = await db.from('checkins').update({ photo_expired: true }).in('id', rows.map(r => r.id));
    if (up.error) return json({ error: up.error.message, removed }, 500);
    removed += rows.length;
    if (rows.length < 100) break;
  }
  return json({ removed, cutoff });
});
