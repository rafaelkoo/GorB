// FitTrack's coaching rules (plain rules, no AI), ported to Gym or Bitch data:
// - next load: double progression in the plan's reps (hit every rep → add weight; miss twice → drop ~10%)
// - target pace: est. 1RM trend vs the pace the deadline needs
// - body weight: trend vs the pace the goal date needs, as a daily calorie figure
// Left out from FitTrack: the "weekly strength plan" guard for isolation lifts (no strength plan here).
import { EX } from './exercises.js';

export const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));   // Epley
const DAY = 864e5;
const days = (a, b) => (new Date(b) - new Date(a)) / DAY;
const roundTo = (v, step) => (step ? Math.round(v / step) * step : Math.round(v));
const COMPOUND = new Set('squat deadlift sumo_deadlift rdl good_morning bench_press close_grip_bench decline_bench inc_db inc_mach db_press ohp arnold_press dip chest_dip pullup lat_pd vbar_pd sit_row db_row tbar_row chest_supported_row meadows_row cable_row_wide leg_press hack_squat goblet_squat lunge bulgarian step_up hip_thrust pushup'.split(' '));
export const isCompound = id => COMPOUND.has(id);

// smallest sensible jump for this exercise
export function increment(id) {
  const e = EX[id]; if (!e) return 2.5;
  if (e.equip === 'Bodyweight') return 0;
  if (e.equip === 'Dumbbell') return 2;
  if (e.equip === 'Barbell' && (e.cat === 'legs' || id === 'deadlift' || id === 'sumo_deadlift' || id === 'rdl')) return 5;
  return 2.5;
}

// sessions for one exercise from bySession() output, with FitTrack's "working weight" (most-used weight, ties → heavier)
export function coachSessions(list, skipDate) {
  return (list || []).filter(s => s.date !== skipDate).map(s => {
    const ds = s.sets.filter(x => x.reps > 0); if (!ds.length) return null;
    const cnt = {}; ds.forEach(x => { cnt[x.kg] = (cnt[x.kg] || 0) + 1; });
    const top = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || b - a)[0];
    return { date: s.date, sets: ds, top, e1: Math.max(...ds.map(x => e1rm(x.kg, x.reps))), atTop: ds.filter(x => x.kg === top) };
  }).filter(Boolean);
}

// what to lift next time. lo–hi = the plan's reps (one number in this app's plan, so lo = hi)
export function nextLoad(id, list, today, lo = 10, hi = lo) {
  const ses = coachSessions(list, today), inc = increment(id);
  if (!ses.length) return null;
  const last = ses[ses.length - 1], prev = ses[ses.length - 2];
  const off = days(last.date, today), wks = Math.floor(off / 7);
  const minR = s => Math.min(...s.atTop.map(x => x.reps));
  const r0 = minR(last), rng = lo === hi ? `${hi}` : `${lo}–${hi}`;
  if (inc === 0) { // bodyweight: progress reps
    if (off >= 21) return { kg: 0, reps: lo, kind: 'same', zh: `隔咗 ${wks} 星期冇練，先做返每組 ${lo} 次`, en: `${wks} weeks off; start back at ${lo} reps a set` };
    return r0 >= lo ? { kg: 0, reps: r0 + 1, kind: 'up', zh: '上次全部做足，下次每組加 1 次', en: 'You hit every rep last time; add one rep per set' }
      : { kg: 0, reps: lo, kind: 'same', zh: `上次未做足，下次再挑戰每組 ${lo} 次`, en: `Missed some reps; aim for ${lo} per set again` };
  }
  if (off >= 42) {
    const kg = Math.max(inc, roundTo(last.top * 0.9, inc));
    if (kg >= last.top) return { kg: last.top, reps: lo, kind: 'same', zh: `隔咗 ${wks} 星期冇練。重量太輕減唔到一級，維持 ${last.top} kg，做得順先再加`, en: `${wks} weeks off. Too light to drop a step, so repeat ${last.top} kg until it feels smooth` };
    return { kg, reps: lo, kind: 'down', zh: `隔咗 ${wks} 星期冇練，由 ${kg} kg（約上次嘅 9 成）重新起步，做得順再加`, en: `${wks} weeks off; restart at ${kg} kg (about 90%) and build back up` };
  }
  if (off >= 21) return { kg: last.top, reps: lo, kind: 'same', zh: `隔咗 ${wks} 星期冇練，先維持上次嘅 ${last.top} kg，唔好即刻加`, en: `${wks} weeks off; repeat ${last.top} kg before adding weight` };
  // moved to a lower rep range: convert through est. 1RM, leaving ~2 reps in the tank
  if (r0 > hi + 1 && lo < r0) {
    const e1 = e1rm(last.top, r0), kg = Math.max(roundTo(last.top + inc, inc), Math.floor(e1 / (1 + (lo + 2) / 30) / inc) * inc);
    return { kg, reps: lo, kind: 'up', zh: `你上次 ${last.top} kg 做到 ${r0} 次，高過而家嘅範圍（${rng}）。按估算 1RM 換算，${lo} 次應該做 ${kg} kg`, en: `Last time ${last.top} kg for ${r0} reps is above your ${rng} range. Converted via est. 1RM: ${kg} kg for ${lo}` };
  }
  if (r0 >= hi) {
    const up = roundTo(last.top + inc, inc), jump = (up - last.top) / last.top;
    const room = isCompound(id) ? 2 : 3;
    if (jump > 0.10 && r0 < hi + room) {
      return { kg: last.top, reps: r0 + 1, kind: 'up', zh: `加到 ${up} kg 會跳 ${Math.round(jump * 100)}%，太多。先喺 ${last.top} kg 每組做 ${r0 + 1} 次，做到 ${hi + room} 次就加重`, en: `Going to ${up} kg is a ${Math.round(jump * 100)}% jump. Do ${r0 + 1} reps a set at ${last.top} kg first; at ${hi + room} reps, add weight` };
    }
    return { kg: up, reps: lo, kind: 'up', zh: `上次 ${last.top} kg 每組都做到 ${r0} 次（範圍頂 ${hi}），加到 ${up} kg，由 ${lo} 次重新開始`, en: `You hit ${r0} reps on every set at ${last.top} kg (top of ${rng}), so go to ${up} kg and start again at ${lo}` };
  }
  if (r0 >= lo) return { kg: last.top, reps: r0 + 1, kind: 'up', zh: `維持 ${last.top} kg，每組做 ${r0 + 1} 次；做到 ${hi} 次就加重`, en: `Stay at ${last.top} kg for ${r0 + 1} reps a set; at ${hi}, add weight` };
  if (prev && prev.top === last.top && minR(prev) < lo) {
    const kg = Math.max(inc, roundTo(last.top * 0.9, inc));
    return { kg, reps: lo, kind: 'down', zh: `連續兩次喺 ${last.top} kg 做唔夠 ${lo} 次，減到 ${kg} kg 重新起步`, en: `Under ${lo} reps at ${last.top} kg twice; drop to ${kg} kg and build back up` };
  }
  return { kg: last.top, reps: lo, kind: 'same', zh: `維持 ${last.top} kg，目標每組最少 ${lo} 次`, en: `Stay at ${last.top} kg and aim for at least ${lo} reps a set` };
}

// least-squares slope (units per week) over the last `weeks`
function weeklySlope(pts, weeks) {
  if (pts.length < 2) return null;
  const end = pts[pts.length - 1].date, use = pts.filter(p => days(p.date, end) <= weeks * 7);
  if (use.length < 2) return null;
  const xs = use.map(p => days(use[0].date, p.date) / 7), ys = use.map(p => p.v);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  return sxx > 0 ? sxy / sxx : null;
}

// how a lift target is going. tg = {target_kg, target_reps, by_date}
export function targetStatus(tg, list, today) {
  const kg = +tg.target_kg, reps = tg.target_reps || 1, by = tg.by_date;
  const ses = coachSessions(list), goal = e1rm(kg, reps);
  if (!ses.length) return { goal, cur: 0, pct: 0, state: 'nodata' };
  const best = Math.max(...ses.map(s => s.e1));
  const reached = ses.some(s => s.sets.some(x => x.kg >= kg && x.reps >= reps));
  const pct = Math.min(100, Math.round(best / goal * 100));
  if (reached || best >= goal) return { goal, cur: best, pct: 100, state: 'done' };
  const slope = weeklySlope(ses.map(s => ({ date: s.date, v: s.e1 })), 8);
  const weeksLeft = by ? days(today, by) / 7 : null;
  const need = weeksLeft && weeksLeft > 0 ? (goal - best) / weeksLeft : null;
  const eta = slope && slope > 0.05 ? (goal - best) / slope : null;
  let state = 'nopace';
  if (weeksLeft !== null && weeksLeft <= 0) state = 'late';
  else if (need !== null && slope !== null) state = slope >= need * 0.9 ? 'ontrack' : 'behind';
  else if (slope !== null) state = slope > 0.05 ? 'improving' : 'flat';
  return { goal, cur: best, pct, slope, need, weeksLeft, eta, state };
}

export function targetAdvice(id, st) {
  if (!st) return null;
  const inc = increment(id);
  switch (st.state) {
    case 'done': return { zh: '已經達標！可以設一個新目標。', en: 'Target reached! Set a new one.' };
    case 'nodata': return { zh: '完成一次訓練之後就會計到進度。', en: 'Log a session to start tracking progress.' };
    case 'late': return { zh: '期限已過。可以延長期限，或者將目標調低少少。', en: 'The deadline has passed. Extend it or lower the target a little.' };
    case 'ontrack': return { zh: '進度良好，照而家嘅節奏繼續加重就得。', en: 'On track. Keep adding weight at this pace.' };
    case 'behind': {
      const extra = st.slope > 0 ? Math.ceil((st.goal - st.cur) / st.slope / 4.345) : null;
      return { zh: `進度落後。每星期要進步約 ${st.need.toFixed(1)} kg（1RM），而家係 ${Math.max(0, st.slope).toFixed(1)} kg。試吓：每次做足就即刻加 ${inc || 1}${inc ? ' kg' : ' 次'}、每星期練多一次呢個動作，同埋確保瞓夠同食夠蛋白質。${extra ? `照而家速度大約要 ${extra} 個月。` : ''}`,
        en: `Behind. You need about ${st.need.toFixed(1)} kg/week of est. 1RM; you're at ${Math.max(0, st.slope).toFixed(1)}. Try adding ${inc || 1}${inc ? ' kg' : ' rep'} as soon as you hit every rep, training it one more time a week, and getting enough sleep and protein.${extra ? ` At this pace it takes about ${extra} months.` : ''}` };
    }
    case 'improving': return { zh: `每星期進步約 ${st.slope.toFixed(1)} kg（1RM）${st.eta ? `，預計約 ${Math.ceil(st.eta)} 星期達標` : ''}。設定期限就會知夠唔夠快。`, en: `Improving about ${st.slope.toFixed(1)} kg/week${st.eta ? `, about ${Math.ceil(st.eta)} weeks to go` : ''}. Add a deadline to check the pace.` };
    case 'flat': return { zh: '最近冇進步。試吓減輕 10% 再重新加上去，或者換一個相近動作練幾星期。', en: 'No progress lately. Try dropping 10% and building back up, or swap in a similar exercise for a few weeks.' };
    default: return { zh: '再記錄多幾次就計到進度速度。', en: 'Log a few more sessions to measure your pace.' };
  }
}

// body weight goal vs pace. log = [{logged_on, weight_kg}], td = maintenance kcal (null if unknown)
export function bodyAdvice(log, goalKg, goalDate, td, today) {
  const pts = log.map(x => ({ date: x.logged_on, v: +x.weight_kg }));
  if (!pts.length || !goalKg) return null;
  const cur = pts.at(-1).v, diff = goalKg - cur;
  if (Math.abs(diff) < 0.3) return { state: 'done', zh: '已經喺目標體重，保持而家嘅食量就得。', en: 'You are at your goal weight. Keep eating as you are.' };
  const trend = weeklySlope(pts, 4);
  const weeksLeft = goalDate ? days(today, goalDate) / 7 : null;
  const losing = diff < 0, safe = cur * 0.01;   // about 1% of body weight per week at most
  let need = weeksLeft && weeksLeft > 0 ? diff / weeksLeft : (losing ? -0.5 : 0.25);
  const rawNeed = need, tooFast = losing ? -need > safe : need > 0.5;
  if (tooFast) need = losing ? -safe : 0.5;
  const kcal = Math.round(need * 7700 / 7 / 50) * 50, eat = td ? Math.max(1500, td + kcal) : null;
  const onTrack = trend !== null && (losing ? trend <= need * 0.8 : trend >= need * 0.8);
  const zh = (tooFast && weeksLeft > 0 ? `距離期限仲有 ${Math.ceil(weeksLeft)} 星期，照期限每星期要${losing ? '減' : '增'} ${Math.abs(rawNeed).toFixed(2)} kg，太快。按安全速度，每星期${losing ? '減' : '增'}約 ${Math.abs(need).toFixed(2)} kg。`
    : `${weeksLeft && weeksLeft > 0 ? `距離期限仲有 ${Math.ceil(weeksLeft)} 星期，` : ''}每星期要${losing ? '減' : '增'}約 ${Math.abs(need).toFixed(2)} kg。`) +
    `${trend === null ? '記錄多幾次體重就計到你而家嘅速度。' : `你最近每星期${trend < 0 ? '減' : '增'}緊 ${Math.abs(trend).toFixed(2)} kg，${onTrack ? '進度良好。' : '要調整。'}`}` +
    (eat ? ` 建議每日食約 ${eat.toLocaleString()} kcal（維持量約 ${td.toLocaleString()}）。` : '') + `${tooFast ? ' 建議將期限延後，或者接受遲少少達標。' : ''}${eat === 1500 ? ' 已經係建議最低食量，唔好再減。' : ''}`;
  const en = (tooFast && weeksLeft > 0 ? `${Math.ceil(weeksLeft)} weeks to your date would need ${Math.abs(rawNeed).toFixed(2)} kg a week, which is too fast. At a safe pace, aim for about ${Math.abs(need).toFixed(2)} kg a week. `
    : `${weeksLeft && weeksLeft > 0 ? `${Math.ceil(weeksLeft)} weeks to your date, so ` : ''}aim to ${losing ? 'lose' : 'gain'} about ${Math.abs(need).toFixed(2)} kg a week. `) +
    `${trend === null ? 'Log your weight a few more times to measure your pace.' : `Lately you're ${trend < 0 ? 'losing' : 'gaining'} ${Math.abs(trend).toFixed(2)} kg a week, ${onTrack ? 'which is on track.' : 'so adjust.'}`}` +
    (eat ? ` Eat about ${eat.toLocaleString()} kcal a day (maintenance about ${td.toLocaleString()}).` : '') + `${tooFast ? ' Consider a later date.' : ''}${eat === 1500 ? ' That is the suggested minimum; don\'t go lower.' : ''}`;
  return { state: onTrack ? 'ontrack' : trend === null ? 'nopace' : 'behind', zh, en, eat };
}
