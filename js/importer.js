// Import a FitTrack backup (Me → Export in FitTrack, a fittrack-backup-YYYY-MM-DD.json file).
// Brings over: workouts (done sets only), body weight log, height / age / goal weight, goal,
// weekly plan, rest timer length, lift targets. Days already logged in Gym or Bitch are skipped.
import * as api from './supa.js';
import { EX } from './exercises.js';
import { t } from './i18n.js';
import { cleanPlan } from './plan.js';

const GOAL_IDS = ['lose_weight', 'build_muscle', 'recomp', 'strength', 'endurance', 'wellness'];
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// FitTrack v2 stores every key as a JSON string under data.ft_<key>; v1 files are the object itself
export function readBackup(text) {
  let p;
  try { p = JSON.parse(text); } catch { throw new Error(t('That file isn’t a FitTrack backup (not JSON).', '呢個檔唔係 FitTrack 備份（唔係 JSON）。')); }
  const v2 = p && typeof p.data === 'object' && p.data;
  if (!v2 && !(p && (p.logs || p.history))) throw new Error(t('That file isn’t a FitTrack backup.', '呢個檔唔係 FitTrack 備份。'));
  return key => {
    if (!v2) return p[key];
    const v = v2['ft_' + key];
    if (v == null) return undefined;
    try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return undefined; }
  };
}

// date → exercise id → [{kg, reps}], done sets only, known exercises only
export function workoutsFrom(history, today) {
  const byDate = {};
  for (const h of Array.isArray(history) ? history : []) {
    if (!isDay(h?.date) || h.date > today) continue;
    for (const [id, arr] of Object.entries(h.sets || {})) {
      if (!EX[id] || !Array.isArray(arr)) continue;
      const sets = arr.filter(s => s && s.done !== false)
        .map(s => ({ kg: Math.max(0, Math.round((+s.weight || 0) * 100) / 100), reps: Math.max(0, parseInt(s.reps) || 0) }))
        .filter(s => s.reps >= 1 || s.kg > 0);
      if (!sets.length) continue;
      const day = byDate[h.date] || (byDate[h.date] = {});
      day[id] = [...(day[id] || []), ...sets];
    }
  }
  return byDate;
}

export async function importFitTrack(user, text, onStep = () => {}) {
  const get = readBackup(text);
  const today = api.ukToday();
  const report = { workouts: 0, sets: 0, skippedDays: 0, weights: 0, plan: false, targets: 0, details: false };

  // 1. workouts
  onStep(t('Reading workouts…', '讀取訓練記錄…'));
  const byDate = workoutsFrom(get('history'), today);
  const have = await api.existingWorkoutDays(user.id);
  const dates = Object.keys(byDate).sort().filter(d => { if (have.has(d)) { report.skippedDays++; return false; } return true; });
  for (const part of chunks(dates, 200)) {
    onStep(t(`Saving workouts (${report.workouts + part.length} of ${dates.length})…`, `儲存訓練（${report.workouts + part.length} / ${dates.length}）…`));
    const made = await api.insertWorkouts(part.map(d => ({ user_id: user.id, performed_on: d })));
    const rows = [];
    for (const w of made) for (const [id, sets] of Object.entries(byDate[w.performed_on])) {
      sets.forEach((s, i) => rows.push({ workout_id: w.id, exercise_id: id, set_no: i + 1, weight_kg: s.kg, reps: s.reps }));
    }
    for (const r of chunks(rows, 500)) await api.insertSets(r);
    report.workouts += made.length; report.sets += rows.length;
  }

  // 2. body weight log
  onStep(t('Saving body weight…', '儲存體重…'));
  const haveW = new Set((await api.weights(user.id)).map(w => w.logged_on));
  const weights = (get('bodyLog') || []).filter(x => isDay(x?.date) && x.date <= today && !haveW.has(x.date) && +x.kg >= 30 && +x.kg <= 300)
    .map(x => ({ user_id: user.id, logged_on: x.date, weight_kg: Math.round(+x.kg * 10) / 10 }));
  for (const r of chunks(weights, 500)) await api.upsertWeights(r);
  report.weights = weights.length;

  // 3. details + goal + rest timer: only fill what's still empty here
  const prof = get('profile') || {}, body = (await api.bodyProfile(user.id)) || {};
  const fill = {};
  if (body.height_cm == null && +prof.height >= 100 && +prof.height <= 250) fill.height_cm = +prof.height;
  if (body.age == null && Number.isInteger(+prof.age) && +prof.age >= 12 && +prof.age <= 100) fill.age = +prof.age;
  if (body.goal_weight_kg == null && +prof.goalWeight >= 30 && +prof.goalWeight <= 300) fill.goal_weight_kg = +prof.goalWeight;
  const goal = get('goalId');
  if (!body.goal_id && GOAL_IDS.includes(goal)) fill.goal_id = goal;
  const rest = +get('restSec');
  if ((body.rest_sec == null || body.rest_sec === 90) && rest >= 15 && rest <= 600) fill.rest_sec = rest;
  if (Object.keys(fill).length) { await api.saveBodyProfile(user.id, fill); report.details = true; }
  if (!weights.length && !haveW.size && +prof.weight >= 30 && +prof.weight <= 300) { await api.upsertWeights([{ user_id: user.id, logged_on: today, weight_kg: +prof.weight }]); report.weights = 1; }

  // 4. weekly plan, if there isn't one here yet
  const plan = get('customPlan');
  if (plan && !(await api.getPlan(user.id))) {
    const clean = cleanPlan(plan);
    if (Object.values(clean).some(d => d.length)) { await api.savePlan(user.id, clean); report.plan = true; }
  }

  // 5. lift targets ({id: {kg, reps, by, set, base}}), keeping any already set here
  const tg = get('targets') || {}, mine = new Set((await api.liftTargets(user.id)).map(x => x.exercise_id));
  const rows = Object.entries(tg).filter(([id, v]) => EX[id] && !mine.has(id) && +v?.kg > 0 && +v.kg < 1000).map(([id, v]) => ({
    user_id: user.id, exercise_id: id, target_kg: +v.kg, target_reps: Math.min(30, Math.max(1, parseInt(v.reps) || 1)),
    by_date: isDay(v.by) ? v.by : null, set_on: isDay(v.set) ? v.set : today, base_e1rm: +v.base > 0 ? Math.round(+v.base * 100) / 100 : null
  }));
  if (rows.length) await api.upsertTargets(rows);
  report.targets = rows.length;
  return report;
}
