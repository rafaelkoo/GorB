// Training guide (FitTrack's SCHEMES): sets, rep range and rest for your goal,
// plus weekly cardio minutes and daily steps. Picked from the goal on the Me page.
import { isCompound } from './coach.js';
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

// scheme key for a goal id; no goal → null (the page asks you to pick one)
export const schemeKey = goalId => BY_GOAL[goalId] || null;
export const schemeOf = goalId => SCHEMES[schemeKey(goalId)] || null;

// [sets, lo, hi] for one exercise under a scheme
export const schemeFor = (sc, id) => (isCompound(id) ? sc.c : sc.i);

// what applying the scheme would change in a plan; returns the count of exercises that change
export function schemeChanges(plan, sc) {
  let n = 0;
  for (const d of Object.keys(plan)) for (const e of plan[d]) {
    const [s, lo, hi] = schemeFor(sc, e.id);
    if (e.sets !== s || e.reps !== hi || (e.lo ?? e.reps) !== lo) n++;
  }
  return n;
}
// sets and rep range for every exercise in the plan (reps = top of the range, lo = bottom)
export function applyScheme(plan, sc) {
  for (const d of Object.keys(plan)) for (const e of plan[d]) { const [s, lo, hi] = schemeFor(sc, e.id); e.sets = s; e.lo = lo; e.reps = hi; }
  return plan;
}
export const schemeName = sc => t(sc.en, sc.zh);
export const restLabel = sec => (sec % 60 ? `${sec}${t('s', ' 秒')}` : `${sec / 60}${t(' min', ' 分鐘')}`);
