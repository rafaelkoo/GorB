// Exercise library, same ids as FitTrack (generated from FitTrack js/data.js). Cardio left out for now.
// [id, English name, Chinese name, category, equipment]
export const CATS = {"chest":"Chest","back":"Back","legs":"Legs","shoulders":"Shoulders","arms":"Arms","core":"Core","other":"Other"};
export const EXERCISES = [["bench_press","Bench press","槓鈴臥推","chest","Barbell"],
  ["inc_db","Incline DB press","啞鈴斜臥推","chest","Dumbbell"],
  ["inc_mach","Incline press machine","上斜胸推機","chest","Machine"],
  ["pec_deck","Pec deck fly","蝴蝶機夾胸","chest","Machine"],
  ["cable_fly","Cable fly","滑輪飛鳥","chest","Cable"],
  ["pushup","Push-up","掌上壓","chest","Bodyweight"],
  ["chest_dip","Chest dip","胸部雙槓臂屈伸","chest","Bodyweight"],
  ["low_cable_fly","Low cable fly","低位滑輪飛鳥","chest","Cable"],
  ["decline_bench","Decline bench press","下斜臥推","chest","Barbell"],
  ["close_grip_bench","Close-grip bench press","窄距臥推","chest","Barbell"],
  ["svend_press","Svend press","斯文德推舉","chest","Other"],
  ["lat_pd","Lat pulldown","滑輪下拉","back","Cable"],
  ["vbar_pd","V-bar pulldown","滑輪下拉 V-Bar","back","Cable"],
  ["sit_row","Seated row","坐姿划船","back","Cable"],
  ["db_row","Single-arm row","單臂俯馬划船","back","Dumbbell"],
  ["deadlift","Deadlift","硬舉","back","Barbell"],
  ["pullup","Pull-up","引體向上","back","Bodyweight"],
  ["tbar_row","T-bar row","T形槓划船","back","Barbell"],
  ["shrug","Barbell shrug","槓鈴聳肩","back","Barbell"],
  ["good_morning","Good morning","早安運動","back","Barbell"],
  ["cable_row_wide","Wide-grip cable row","寬距滑輪划船","back","Cable"],
  ["chest_supported_row","Chest-supported row","胸墊划船","back","Machine"],
  ["cable_pullover","Cable pullover","滑輪過頂下拉","back","Cable"],
  ["meadows_row","Meadows row","梅多斯划船","back","Barbell"],
  ["back_extension","Back extension","背部伸展","back","Machine"],
  ["squat","Barbell squat","槓鈴深蹲","legs","Barbell"],
  ["leg_press","Leg press","腿部推機","legs","Machine"],
  ["leg_curl","Leg curl","腿部彎舉","legs","Machine"],
  ["calf","Calf raise","小腿提踵","legs","Machine"],
  ["adductor","Adductor machine","夾腿機","legs","Machine"],
  ["rdl","Romanian deadlift","羅馬尼亞硬舉","legs","Barbell"],
  ["hip_thrust","Hip thrust","臀推","legs","Barbell"],
  ["bulgarian","Bulgarian split squat","保加利亞分腿蹲","legs","Dumbbell"],
  ["hack_squat","Hack squat","哈克深蹲","legs","Machine"],
  ["seated_calf","Seated calf raise","坐姿提踵","legs","Machine"],
  ["goblet_squat","Goblet squat","高腳杯深蹲","legs","Dumbbell"],
  ["step_up","Step-up","踏台","legs","Dumbbell"],
  ["sissy_squat","Sissy squat","西西深蹲","legs","Bodyweight"],
  ["nordic_curl","Nordic hamstring curl","北歐式腿彎舉","legs","Bodyweight"],
  ["donkey_calf","Donkey calf raise","驢式提踵","legs","Machine"],
  ["sumo_deadlift","Sumo deadlift","相撲硬舉","legs","Barbell"],
  ["lunge","Lunge","弓步蹲","legs","Dumbbell"],
  ["db_press","DB shoulder press","啞鈴肩推","shoulders","Dumbbell"],
  ["ohp","Overhead press","頭頂推舉","shoulders","Barbell"],
  ["lat_raise","Lateral raise","啞鈴側平舉","shoulders","Dumbbell"],
  ["rev_fly","Reverse fly","坐姿反向飛鳥","shoulders","Machine"],
  ["facepull","Face pull","面拉","shoulders","Cable"],
  ["arnold_press","Arnold press","阿諾德推舉","shoulders","Dumbbell"],
  ["upright_row","Upright row","直立划船","shoulders","Barbell"],
  ["rear_delt_fly","Rear delt fly","後束飛鳥","shoulders","Dumbbell"],
  ["cable_lateral","Cable lateral raise","滑輪側平舉","shoulders","Cable"],
  ["leaning_lateral","Leaning lateral raise","側傾側平舉","shoulders","Dumbbell"],
  ["w_press","W-press (prone Y raise)","W字推舉","shoulders","Dumbbell"],
  ["lu_raises","Lu raises","呂小軍舉","shoulders","Dumbbell"],
  ["bb_curl","Barbell curl","槓鈴彎舉","arms","Barbell"],
  ["hammer","Hammer curl","啞鈴錘式彎舉","arms","Dumbbell"],["db_curl","Dumbbell bicep curl","啞鈴二頭彎舉","arms","Dumbbell"],
  ["cable_pd","Cable pushdown","滑輪下壓","arms","Cable"],
  ["skull","Skull crusher","仰臥三頭肌伸展","arms","Barbell"],
  ["dip","Dip","雙槓臂屈伸","arms","Bodyweight"],
  ["preacher_curl","Preacher curl","牧師椅彎舉","arms","Barbell"],
  ["concentration_curl","Concentration curl","集中彎舉","arms","Dumbbell"],
  ["cable_curl","Cable curl","滑輪彎舉","arms","Cable"],
  ["overhead_tri","Overhead triceps extension","頭上三頭伸展","arms","Dumbbell"],
  ["cable_tri","Cable triceps pushdown","滑輪三頭下壓","arms","Cable"],
  ["incline_curl","Incline dumbbell curl","斜板啞鈴彎舉","arms","Dumbbell"],
  ["spider_curl","Spider curl","蜘蛛彎舉","arms","Barbell"],
  ["drag_curl","Drag curl","拖拉彎舉","arms","Barbell"],
  ["reverse_curl","Reverse curl","反握彎舉","arms","Barbell"],
  ["wrist_curl","Wrist curl","腕部彎舉","arms","Barbell"],
  ["tricep_kickback","Triceps kickback","三頭後踢","arms","Dumbbell"],
  ["jm_press","JM press","JM推舉","arms","Barbell"],
  ["plank","Plank","平板支撐","core","Bodyweight"],
  ["crunch","Crunch","捲腹","core","Bodyweight"],
  ["leg_raise","Leg raise","舉腿","core","Bodyweight"],
  ["cable_crunch","Cable crunch","滑輪捲腹","core","Cable"],
  ["russian_twist","Russian twist","俄羅斯轉體","core","Bodyweight"],
  ["ab_wheel","Ab wheel rollout","滾輪捲腹","core","Other"],
  ["pallof_press","Pallof press","帕洛夫推舉","core","Cable"],
  ["dead_bug","Dead bug","死蟲式","core","Bodyweight"],
  ["hollow_hold","Hollow hold","空心撐","core","Bodyweight"],
  ["cable_woodchop","Cable woodchop","滑輪伐木","core","Cable"],
  ["landmine_rotation","Landmine rotation","地雷管旋轉","core","Barbell"]];
export const EX = Object.fromEntries(EXERCISES.map(([id, en, zh, cat, equip]) => [id, { id, en, zh, cat, equip }]));
// The four lifts on the group's PB board (the old Excel "Personal Bests" sheet)
export const BIG_FOUR = ['bench_press', 'deadlift', 'squat', 'ohp'];
// FitTrack's default weekly plan (cardio items left out)
export const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DEFAULT_PLAN = {"Mon":[{"id":"bb_curl","sets":5,"reps":15},{"id":"hammer","sets":5,"reps":15},{"id":"cable_pd","sets":5,"reps":15},{"id":"skull","sets":5,"reps":15}],"Tue":[{"id":"db_press","sets":5,"reps":15},{"id":"lat_raise","sets":5,"reps":15},{"id":"rev_fly","sets":5,"reps":15}],"Wed":[{"id":"inc_db","sets":5,"reps":15},{"id":"inc_mach","sets":5,"reps":15},{"id":"pec_deck","sets":5,"reps":15}],"Thu":[{"id":"lat_pd","sets":5,"reps":15},{"id":"vbar_pd","sets":5,"reps":15},{"id":"sit_row","sets":5,"reps":15},{"id":"db_row","sets":5,"reps":15}],"Fri":[{"id":"squat","sets":5,"reps":15},{"id":"calf","sets":5,"reps":15},{"id":"leg_press","sets":5,"reps":15},{"id":"leg_curl","sets":5,"reps":15},{"id":"adductor","sets":5,"reps":15}],"Sat":[],"Sun":[]};

// ---------- exercises people add themselves (custom_exercises table) ----------
// 'weight' ones join EXERCISES / EX like any lift (no 3D demo); 'minutes' ones join the cardio list.
// Filled after sign-in with your own and your groupmates' exercises.
export const CUSTOM_CARDIO = [];
export function registerCustom(rows, myId) {
  for (let i = EXERCISES.length - 1; i >= 0; i--) if (EX[EXERCISES[i][0]]?.custom) { delete EX[EXERCISES[i][0]]; EXERCISES.splice(i, 1); }
  CUSTOM_CARDIO.length = 0;
  for (const r of rows || []) {
    const base = { id: r.id, en: r.name, zh: r.name, custom: true, mine: r.user_id === myId, owner: r.user_id };
    if (r.kind === 'minutes') CUSTOM_CARDIO.push(base);
    else { const cat = CATS[r.cat] ? r.cat : 'other'; EXERCISES.push([r.id, r.name, r.name, cat, 'Other']); EX[r.id] = { ...base, cat, equip: 'Other', timed: r.kind === 'timed' }; }
  }
}
export const newCustomId = () => 'c_' + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);

// timed holds (your own 'timed' exercises): the reps column holds seconds
export const isTimed = id => !!EX[id]?.timed;

// what a search matches: both names, the body part, the muscles it works (English and Chinese) and
// everyday other names, so "bicep" finds every curl and "二頭" finds them in Chinese too
import { EX as FT, muscleZh, ALIAS as FT_ALIAS } from './ftdata.js';
const ALIAS_EN = { db_curl: 'bicep curl biceps curl dumbbell curl 二頭彎舉 二頭', bb_curl: 'bicep curl', bench_press: 'bench', ohp: 'shoulder press overhead press military press', rdl: 'romanian deadlift', lat_pd: 'lat pulldown pull down', pullup: 'pull up chin up' };
export function searchText(id) {
  const e = EX[id]; if (!e) return '';
  const ms = FT[id]?.muscles || [];
  return `${e.en} ${e.zh} ${CATS[e.cat] || ''} ${ms.join(' ')} ${ms.map(muscleZh).join(' ')} ${FT_ALIAS[id] || ''} ${ALIAS_EN[id] || ''}`.toLowerCase();
}
