// Training guide (FitTrack's SCHEMES): sets, rep range and rest for your goal,
// plus weekly cardio minutes and daily steps. Picked from the goal on the Me page.
import { isCompound } from './coach.js';
import { EX } from './exercises.js';
import { t } from './i18n.js';

// c = compound [sets, lo, hi] · i = isolation [sets, lo, hi] · rest seconds · cardio minutes a week · steps a day · hard sets per muscle a week
export const SCHEMES = {
  fat:       { en: 'Fat loss',       zh: '減脂',   c: [4, 8, 12], i: [3, 12, 15], rest: 90,  cardio: 180, steps: 9000,  sets: [10, 14] },
  recomp:    { en: 'Body recomp',    zh: '增肌減脂', c: [4, 8, 12], i: [3, 10, 15], rest: 90,  cardio: 135, steps: 8000,  sets: [10, 16] },
  muscle:    { en: 'Muscle',         zh: '增肌',   c: [4, 6, 10], i: [3, 10, 15], rest: 120, cardio: 60,  steps: 7000,  sets: [12, 20] },
  strength:  { en: 'Strength',       zh: '力量',   c: [5, 3, 6],  i: [3, 8, 12],  rest: 180, cardio: 45,  steps: 7000,  sets: [8, 12] },
  endurance: { en: 'Endurance',      zh: '耐力',   c: [3, 12, 15], i: [2, 15, 20], rest: 60, cardio: 200, steps: 10000, sets: [6, 10] },
  wellness:  { en: 'General health', zh: '健康',   c: [3, 8, 12], i: [2, 12, 15], rest: 90,  cardio: 150, steps: 8000,  sets: [6, 10] }
};
const BY_GOAL = { lose_weight: 'fat', build_muscle: 'muscle', recomp: 'recomp', strength: 'strength', endurance: 'endurance', wellness: 'wellness' };

// scheme key for a goal id; no goal → null (the page asks you to pick one).
// ans = the goal's follow-up answers (Me page): body recomp can lean to fat loss or to muscle.
export const schemeKey = (goalId, ans) => {
  if (goalId === 'recomp' && ans?.priority === 'fat') return 'fat';
  if (goalId === 'recomp' && ans?.priority === 'muscle') return 'muscle';
  return BY_GOAL[goalId] || null;
};
// the scheme, tuned by the answers: your own weekly cardio target, more or less cardio while losing weight
export const schemeOf = (goalId, ans) => {
  const base = SCHEMES[schemeKey(goalId, ans)];
  if (!base) return null;
  const sc = { ...base };
  if (goalId === 'lose_weight' && ans?.approach === 'cardio_only') sc.cardio += 60;
  if (goalId === 'lose_weight' && ans?.approach === 'weights_only') sc.cardio = Math.max(60, sc.cardio - 60);
  if (+ans?.weekly_mins > 0) sc.cardio = +ans.weekly_mins;
  // building muscle with a focus area: one extra set on exercises for that half of the body
  if (goalId === 'build_muscle' && (ans?.area === 'upper' || ans?.area === 'lower')) sc.focus = ans.area;
  return sc;
};
const UPPER = new Set(['chest', 'back', 'shoulders', 'arms']), LOWER = new Set(['legs']);
export const inFocus = (sc, id) => (sc?.focus === 'upper' ? UPPER : sc?.focus === 'lower' ? LOWER : null)?.has(EX[id]?.cat) || false;

// [sets, lo, hi] for one exercise under a scheme
export const schemeFor = (sc, id) => { const [s, lo, hi] = isCompound(id) ? sc.c : sc.i; return [s + (inFocus(sc, id) ? 1 : 0), lo, hi]; };

// what applying the scheme would change in a plan; returns the count of exercises that change
export function schemeChanges(plan, sc) {
  let n = 0;
  for (const d of plan.days) for (const e of d.items) {
    if (EX[e.id]?.timed || EX[e.id]?.climb) continue;
    const [s, lo, hi] = schemeFor(sc, e.id);
    if (e.sets !== s || e.reps !== hi || (e.lo ?? e.reps) !== lo) n++;
  }
  return n;
}
// sets and rep range for every exercise in the plan (reps = top of the range, lo = bottom)
export function applyScheme(plan, sc) {
  for (const d of plan.days) for (const e of d.items) { if (EX[e.id]?.timed || EX[e.id]?.climb) continue; const [s, lo, hi] = schemeFor(sc, e.id); e.sets = s; e.lo = lo; e.reps = hi; }
  return plan;
}
export const schemeName = sc => t(sc.en, sc.zh);
export const restLabel = sec => (sec % 60 ? `${sec}${t('s', ' 秒')}` : `${sec / 60}${t(' min', ' 分鐘')}`);
