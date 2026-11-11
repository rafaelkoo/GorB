// Static data. Exercise ids, goal ids and plan shape are identical to the
// first FitTrack version so saved data keeps working.

export const SCORE_CFG = { set_done: 5, task_done: 10, pr_broken: 25, workout_saved: 15 };
export const LEVEL_XP = 500;
export const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WD_ZH = { Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六', Sun: '日' };
export const WD_LONG = { Mon: ['星期一', 'Monday'], Tue: ['星期二', 'Tuesday'], Wed: ['星期三', 'Wednesday'], Thu: ['星期四', 'Thursday'], Fri: ['星期五', 'Friday'], Sat: ['星期六', 'Saturday'], Sun: ['星期日', 'Sunday'] };

export const CATS = {
  chest: { zh: '胸', zhL: '胸部', en: 'Chest', target: 75 },
  back: { zh: '背', zhL: '背部', en: 'Back', target: 75 },
  legs: { zh: '腿', zhL: '腿部', en: 'Legs', target: 75 },
  shoulders: { zh: '肩', zhL: '肩膀', en: 'Shoulders', target: 50 },
  arms: { zh: '手臂', zhL: '手臂', en: 'Arms', target: 50 },
  core: { zh: '核心', zhL: '核心', en: 'Core', target: 25 },
  cardio: { zh: '有氧', zhL: '有氧', en: 'Cardio', target: 50 }
};

export const DEFAULT_PLAN = {
  Mon: [{ id: 'warmup', sets: 1, reps: '5' }, { id: 'bb_curl', sets: 5, reps: 15 }, { id: 'hammer', sets: 5, reps: 15 }, { id: 'cable_pd', sets: 5, reps: 15 }, { id: 'skull', sets: 5, reps: 15 }, { id: 'cardio30', sets: 1, reps: '30' }],
  Tue: [{ id: 'warmup', sets: 1, reps: '5' }, { id: 'db_press', sets: 5, reps: 15 }, { id: 'lat_raise', sets: 5, reps: 15 }, { id: 'rev_fly', sets: 5, reps: 15 }, { id: 'cardio30', sets: 1, reps: '30' }],
  Wed: [{ id: 'warmup', sets: 1, reps: '5' }, { id: 'inc_db', sets: 5, reps: 15 }, { id: 'inc_mach', sets: 5, reps: 15 }, { id: 'pec_deck', sets: 5, reps: 15 }, { id: 'cardio30', sets: 1, reps: '30' }],
  Thu: [{ id: 'warmup', sets: 1, reps: '5' }, { id: 'lat_pd', sets: 5, reps: 15 }, { id: 'vbar_pd', sets: 5, reps: 15 }, { id: 'sit_row', sets: 5, reps: 15 }, { id: 'db_row', sets: 5, reps: 15 }, { id: 'cardio30', sets: 1, reps: '30' }],
  Fri: [{ id: 'warmup', sets: 1, reps: '5' }, { id: 'squat', sets: 5, reps: 15 }, { id: 'calf', sets: 5, reps: 15 }, { id: 'leg_press', sets: 5, reps: 15 }, { id: 'leg_curl', sets: 5, reps: 15 }, { id: 'adductor', sets: 5, reps: 15 }, { id: 'cardio30', sets: 1, reps: '30' }],
  Sat: [], Sun: []
};

// strength standards (x bodyweight) for novice / intermediate / advanced
export const STD = { squat: [.75, 1.25, 1.75], bench_press: [.60, 1.00, 1.40], deadlift: [1.00, 1.50, 2.00], ohp: [.40, .60, .85], rdl: [.75, 1.15, 1.60], db_row: [.25, .40, .60], hammer: [.15, .25, .40], vbar_pd: [.50, .80, 1.10], bb_curl: [.25, .45, .65], db_press: [.15, .25, .40], inc_db: [.20, .35, .50], lat_pd: [.50, .80, 1.10], sit_row: [.50, .80, 1.10], leg_press: [1.00, 1.80, 2.50], leg_curl: [.35, .55, .80], calf: [1.00, 1.50, 2.20] };

export const GOALS = [
  { id: 'lose_weight', zh: '減重瘦身', en: 'Lose weight' },
  { id: 'build_muscle', zh: '增肌健體', en: 'Build muscle' },
  { id: 'recomp', zh: '增肌減脂', en: 'Body recomp' },
  { id: 'strength', zh: '增強力量', en: 'Strength & power' },
  { id: 'endurance', zh: '心肺耐力', en: 'Cardio & endurance' },
  { id: 'wellness', zh: '健康保持', en: 'General wellness' }
];
export const GQS = {
  lose_weight: [{ id: 'approach', type: 'choice', zh: '你想點樣減重？', en: 'How do you want to lose weight?', opts: [{ id: 'cardio_only', zh: '主要有氧', en: 'Cardio-focused' }, { id: 'weights_cardio', zh: '有氧 + 力量', en: 'Cardio + weights' }, { id: 'weights_only', zh: '主要力量訓練', en: 'Weights-focused' }] }, { id: 'target_kg', type: 'number', zh: '想減幾多 kg？', en: 'How many kg to lose?', min: 1, max: 60, step: .5, def: 10, unit: 'kg' }],
  build_muscle: [{ id: 'area', type: 'choice', zh: '主要想練邊度？', en: 'Which area to focus on?', opts: [{ id: 'full', zh: '全身均衡', en: 'Full body' }, { id: 'upper', zh: '上半身', en: 'Upper body' }, { id: 'lower', zh: '下半身', en: 'Lower body' }] }, { id: 'gym_days', type: 'number', zh: '每星期去幾日 gym？', en: 'Gym days per week?', min: 2, max: 6, step: 1, def: 4, unit: '日' }],
  recomp: [{ id: 'priority', type: 'choice', zh: '你比較重視邊樣？', en: 'What matters more?', opts: [{ id: 'fat', zh: '減脂優先', en: 'Fat loss first' }, { id: 'equal', zh: '兩樣一樣重要', en: 'Balanced' }, { id: 'muscle', zh: '增肌優先', en: 'Muscle first' }] }],
  strength: [{ id: 'lift', type: 'choice', zh: '最想提升邊個動作？', en: 'Which lift?', opts: [{ id: 'all3', zh: '三大項全部', en: 'Squat, bench, deadlift' }, { id: 'squat', zh: '深蹲', en: 'Squat' }, { id: 'bench', zh: '臥推', en: 'Bench' }, { id: 'deadlift', zh: '硬舉', en: 'Deadlift' }] }, { id: 'gym_days', type: 'number', zh: '每星期去幾日 gym？', en: 'Gym days per week?', min: 2, max: 6, step: 1, def: 4, unit: '日' }],
  endurance: [{ id: 'cardio_type', type: 'choice', zh: '主要做咩有氧？', en: 'Main cardio?', opts: [{ id: 'running', zh: '跑步', en: 'Running' }, { id: 'cycling', zh: '單車', en: 'Cycling' }, { id: 'mixed', zh: '混合', en: 'Mixed' }] }, { id: 'weekly_mins', type: 'number', zh: '每星期有氧目標（分鐘）？', en: 'Weekly cardio target (min)?', min: 60, max: 600, step: 30, def: 150, unit: '分鐘' }],
  wellness: [{ id: 'focus', type: 'choice', zh: '最想改善邊方面？', en: 'What to improve?', opts: [{ id: 'energy', zh: '日常精力', en: 'Daily energy' }, { id: 'stress', zh: '壓力管理', en: 'Stress' }, { id: 'habits', zh: '建立習慣', en: 'Habits' }] }]
};

// muscle name -> [Chinese, body part on the 3D figure]
export const MUSCLES = {
  'Chest': ['胸肌', 'pec'], 'Upper Chest': ['上胸', 'pec'], 'Lower Chest': ['下胸', 'pec'], 'Inner Chest': ['胸肌內側', 'pec'],
  'Triceps': ['三頭肌', 'triceps'], 'Triceps Long Head': ['三頭肌長頭', 'triceps'], 'Biceps': ['二頭肌', 'biceps'], 'Biceps Long Head': ['二頭肌長頭', 'biceps'], 'Brachialis': ['肱肌', 'biceps'],
  'Forearms': ['前臂', 'forearm'], 'Shoulders': ['肩膀', 'deltF deltS deltR'], 'Front Deltoid': ['前三角', 'deltF'], 'Side Deltoid': ['中三角', 'deltS'], 'Rear Deltoid': ['後三角', 'deltR'], 'Rear Delt': ['後三角', 'deltR'], 'All Three Deltoid Heads': ['三角肌全部', 'deltF deltS deltR'], 'Rotator Cuff': ['旋轉肌群', 'deltR'],
  'Lats': ['背闊肌', 'lats'], 'Upper Lats': ['上背闊肌', 'lats'], 'Rhomboids': ['菱形肌', 'rhomb'], 'Traps': ['斜方肌', 'traps'], 'Teres Major': ['大圓肌', 'lats'], 'Serratus': ['前鋸肌', 'serratus'], 'Lower Back': ['下背', 'lowback'],
  'Quads': ['股四頭肌', 'quads'], 'Hamstrings': ['大腿後肌', 'hams'], 'Inner Thigh': ['大腿內側', 'adductors'], 'Hip Flexors': ['髖屈肌', 'quads'], 'Glutes': ['臀肌', 'glutes'], 'Calves': ['小腿', 'calves'], 'Soleus': ['比目魚肌', 'calves'], 'Balance': ['平衡', 'glutes'],
  'Core': ['核心', 'abs obliques'], 'Rectus Abdominis': ['腹直肌', 'abs'], 'Obliques': ['腹斜肌', 'obliques'], 'Lower Abs': ['下腹', 'abs'], 'Deep Core': ['深層核心', 'abs'],
  'Full Body': ['全身', 'quads glutes hams calves'], 'Cardio': ['心肺', 'quads calves'], 'Legs': ['腿部', 'quads hams calves'], 'Back': ['背部', 'lats rhomb'], 'Arms': ['手臂', 'biceps triceps']
};

const LV = { B: 'Beginner', I: 'Intermediate', A: 'Advanced' };
const LV_ZH = { Beginner: '新手', Intermediate: '中級', Advanced: '進階' };
export const levelZh = l => LV_ZH[l] || l;
const EQ_ZH = { Barbell: '槓鈴', Dumbbell: '啞鈴', Machine: '器械', Cable: '滑輪', Bodyweight: '自身體重', Other: '其他' };
export const equipZh = e => EQ_ZH[e] || e;

// [id, zh, en, cat, equip, level, muscles, zh description, en description, move, approx?, cardio?]
const RAW = [
  ['warmup', '熱身有氧', 'Warm-up cardio', 'cardio', 'Machine', 'B', ['Full Body'], '輕鬆步行或者踩單車 5 分鐘，令身體暖起嚟。', 'Five easy minutes walking or cycling to warm up.', 'walk', 0, 1],
  ['cardio30', '有氧 (9度5速)', 'Cardio (incline 9)', 'cardio', 'Machine', 'B', ['Full Body'], '跑步機斜度 9、速度 5 行 30 分鐘，唔好揸扶手。', 'Treadmill at incline 9, speed 5 for 30 minutes, hands off the rails.', 'walk', 0, 1],
  ['bench_press', '槓鈴臥推', 'Bench press', 'chest', 'Barbell', 'I', ['Chest', 'Triceps', 'Shoulders'], '平躺，握桿比肩略寬，下降至胸口再推起。', 'Lie flat, grip bar wider than shoulders, lower to chest and press up.', 'bench'],
  ['inc_db', '啞鈴斜臥推', 'Incline DB press', 'chest', 'Dumbbell', 'B', ['Upper Chest', 'Triceps'], '調斜板至30–45度，向上及略向內推啞鈴。', 'Set bench 30–45°. Press dumbbells upward and slightly inward.', 'incline_press'],
  ['inc_mach', '上斜胸推機', 'Incline press machine', 'chest', 'Machine', 'B', ['Upper Chest', 'Triceps'], '座位調到把手對住上胸，向上向前推。', 'Set the seat so the handles line up with your upper chest, press up and forward.', 'machine_press', 0],
  ['pec_deck', '蝴蝶機夾胸', 'Pec deck fly', 'chest', 'Machine', 'B', ['Chest', 'Front Deltoid'], '手肘90度，將把手夾合時用力收縮胸肌。', 'Elbows at 90°. Bring handles together squeezing chest at peak.', 'pec_deck'],
  ['cable_fly', '滑輪飛鳥', 'Cable fly', 'chest', 'Cable', 'B', ['Chest', 'Front Deltoid'], '站於滑輪中間，手臂略彎，將把手在胸前合攏。', 'Stand between cables, arms slightly bent, bring handles together in front of chest.', 'fly_cable'],
  ['pushup', '掌上壓', 'Push-up', 'chest', 'Bodyweight', 'B', ['Chest', 'Triceps', 'Shoulders'], '手掌與肩同寬，胸部貼近地板後推起，保持身體成直線。', 'Hands shoulder-width, lower chest to floor then press up. Keep body straight.', 'pushup'],
  ['chest_dip', '胸部雙槓臂屈伸', 'Chest dip', 'chest', 'Bodyweight', 'I', ['Chest', 'Triceps', 'Shoulders'], '雙槓前傾做臂屈伸以針對胸肌，手肘彎至90度再推起。', 'Lean forward on dips to target chest. Lower until elbows at 90°, press up.', 'dip_chest'],
  ['low_cable_fly', '低位滑輪飛鳥', 'Low cable fly', 'chest', 'Cable', 'B', ['Lower Chest'], '滑輪設於低位，弧形向上合攏把手，頂部收縮胸肌。', 'Cables set low, bring handles up and together in an arc, squeezing chest at top.', 'fly_low'],
  ['decline_bench', '下斜臥推', 'Decline bench press', 'chest', 'Barbell', 'I', ['Lower Chest', 'Triceps'], '斜板下傾15–30度，從下胸向上推槓，針對下胸。', 'Bench declined 15–30°. Press bar from lower chest up, targets lower pec.', 'decline', 0],
  ['close_grip_bench', '窄距臥推', 'Close-grip bench press', 'chest', 'Barbell', 'I', ['Triceps', 'Inner Chest'], '握距等肩或更窄，下降至下胸再推起，針對三頭肌。', 'Grip shoulder-width or narrower. Lower to lower chest, press up. Tricep focus.', 'bench_close'],
  ['svend_press', '斯文德推舉', 'Svend press', 'chest', 'Other', 'B', ['Inner Chest'], '在胸前夾緊兩片槓片，向前推出再收回，保持胸肌持續張力。', 'Squeeze two plates together at chest, press forward and return. Constant chest tension.', 'svend'],
  ['lat_pd', '滑輪下拉', 'Lat pulldown', 'back', 'Cable', 'B', ['Lats', 'Biceps'], '寬握，輕微後仰，將桿拉至胸口上方。', 'Wide grip, lean back slightly, pull bar to upper chest.', 'pulldown'],
  ['vbar_pd', '滑輪下拉 V-Bar', 'V-bar pulldown', 'back', 'Cable', 'B', ['Lats', 'Biceps'], '用 V 柄窄握，手肘貼身拉到胸口。', 'Close grip on a V-handle, elbows tight, pull to the chest.', 'pulldown_close'],
  ['sit_row', '坐姿划船', 'Seated row', 'back', 'Cable', 'B', ['Lats', 'Rhomboids', 'Biceps'], '挺直坐姿，將把手拉至下胸，同時夾緊背肌。', 'Sit tall, pull handle to lower chest, squeeze back.', 'seated_row'],
  ['db_row', '單臂俯馬划船', 'Single-arm row', 'back', 'Dumbbell', 'B', ['Lats', 'Rhomboids'], '一手一膝撐凳，背打平，將啞鈴拉向腰側。', 'One hand and knee on the bench, flat back, row the dumbbell to your hip.', 'row_db', 0],
  ['deadlift', '硬舉', 'Deadlift', 'back', 'Barbell', 'A', ['Lower Back', 'Glutes', 'Hamstrings'], '從臀部開始屈曲，保持背部平直，用腳跟推地。', 'Hinge at hips, flat back, drive through heels.', 'deadlift'],
  ['pullup', '引體向上', 'Pull-up', 'back', 'Bodyweight', 'I', ['Lats', 'Biceps', 'Rear Delt'], '懸掛在單槓上，將胸部拉至槓並夾緊背闊肌。', 'Hang from bar, pull chest to bar squeezing lats.', 'pullup'],
  ['tbar_row', 'T形槓划船', 'T-bar row', 'back', 'Barbell', 'I', ['Lats', 'Rhomboids', 'Biceps'], '跨站槓上，從臀部屈曲，將槓拉至下胸並夾緊肩胛骨。', 'Straddle the bar, hinge at hips, pull to lower chest squeezing shoulder blades.', 'tbar', 0],
  ['shrug', '槓鈴聳肩', 'Barbell shrug', 'back', 'Barbell', 'B', ['Traps'], '手持槓鈴於臀前，肩膀盡量向上聳起，稍作停頓。', 'Hold bar at hips, shrug shoulders straight up as high as possible, hold briefly.', 'shrug'],
  ['good_morning', '早安運動', 'Good morning', 'back', 'Barbell', 'I', ['Lower Back', 'Hamstrings', 'Glutes'], '槓鈴置於斜方肌，膝蓋微彎從臀部屈曲至軀幹平行地面，再站起。', 'Bar on traps, hinge at hips with slight knee bend until torso is parallel, drive up.', 'good_morning'],
  ['cable_row_wide', '寬距滑輪划船', 'Wide-grip cable row', 'back', 'Cable', 'B', ['Upper Lats', 'Rear Delt'], '寬握把，手肘向外張開拉至上胸，針對上背。', 'Wide handle or bar, pull to upper chest with elbows flaring. Upper back focus.', 'seated_row_wide', 0],
  ['chest_supported_row', '胸墊划船', 'Chest-supported row', 'back', 'Machine', 'B', ['Lats', 'Rhomboids'], '俯臥於斜板，向上拉啞鈴並夾緊肩胛骨。', 'Lie prone on incline bench, pull dumbbells up squeezing shoulder blades.', 'row_chest', 0],
  ['cable_pullover', '滑輪過頂下拉', 'Cable pullover', 'back', 'Cable', 'B', ['Lats', 'Serratus'], '手臂伸直，弧形將滑輪從頭頂拉至臀部，非常伸展背闊肌。', 'Arms straight, pull cable from overhead to hips in an arc. Great lat stretch.', 'pullover'],
  ['meadows_row', '梅多斯划船', 'Meadows row', 'back', 'Barbell', 'A', ['Lats', 'Teres Major'], '單臂地雷管划船，將地雷管拉至臀部，保持手肘高位。', 'Single arm landmine row. Pull the sleeve of a landmine bar to hip, elbow high.', 'meadows', 0],
  ['back_extension', '背部伸展', 'Back extension', 'back', 'Machine', 'B', ['Lower Back', 'Glutes'], '在背部伸展機上向前屈曲，再伸展回中立位置。', 'Hinge forward on machine, then extend back to neutral. Add weight for more resistance.', 'back_ext', 0],
  ['squat', '槓鈴深蹲', 'Barbell squat', 'legs', 'Barbell', 'I', ['Quads', 'Glutes', 'Hamstrings'], '槓鈴置於斜方肌，坐下直至大腿平行地面，再站起。', 'Bar on traps, sit back until thighs parallel, drive up.', 'squat_bb'],
  ['leg_press', '腿部推機', 'Leg press', 'legs', 'Machine', 'B', ['Quads', 'Glutes'], '雙腳與肩同寬，膝蓋彎至90度再推起。', 'Feet shoulder-width, lower until 90° knee, press through heels.', 'leg_press'],
  ['leg_curl', '腿部彎舉', 'Leg curl', 'legs', 'Machine', 'B', ['Hamstrings'], '俯臥，向上捲小腿，同時收縮腿後肌。', 'Lie prone, curl lower legs up squeezing hamstrings.', 'leg_curl'],
  ['calf', '小腿提踵', 'Calf raise', 'legs', 'Machine', 'B', ['Calves'], '腳跟完全放低，再踮腳尖並收縮小腿。', 'Lower heels fully, rise onto toes squeezing calves.', 'calf'],
  ['adductor', '夾腿機', 'Adductor machine', 'legs', 'Machine', 'B', ['Inner Thigh'], '背貼靠墊，用大腿內側將雙腿夾埋。', 'Back against the pad, bring your legs together with the inner thighs.', 'adductor'],
  ['rdl', '羅馬尼亞硬舉', 'Romanian deadlift', 'legs', 'Barbell', 'I', ['Hamstrings', 'Glutes', 'Lower Back'], '臀部向後推，沿腿部將槓鈴下降至小腿中部，夾緊臀肌站起。', 'Hinge at hips, pushing them back, lowering bar along legs to mid-shin. Squeeze glutes to stand.', 'rdl'],
  ['hip_thrust', '臀推', 'Hip thrust', 'legs', 'Barbell', 'B', ['Glutes', 'Hamstrings'], '肩膀靠於椅背，槓鈴置於臀部，向上推至身體平行地面，頂部夾緊臀肌。', 'Shoulders on bench, bar across hips. Drive hips up until body is parallel, squeeze glutes at top.', 'hip_thrust'],
  ['bulgarian', '保加利亞分腿蹲', 'Bulgarian split squat', 'legs', 'Dumbbell', 'I', ['Quads', 'Glutes', 'Balance'], '後腳抬高，前膝向地板下降，保持脛骨垂直。', 'Rear foot elevated, lower front knee toward floor keeping shin vertical.', 'bulgarian'],
  ['hack_squat', '哈克深蹲', 'Hack squat', 'legs', 'Machine', 'B', ['Quads', 'Glutes'], '背靠墊子，腳踏平台，膝蓋彎至90度後用腳跟推起。', 'Back against pad, feet on platform. Lower until 90° knee angle, drive through heels.', 'hack', 0],
  ['seated_calf', '坐姿提踵', 'Seated calf raise', 'legs', 'Machine', 'B', ['Soleus', 'Calves'], '坐姿膝蓋壓上墊子，踮腳尖並收縮小腿，再緩慢放下。', 'Sit with pads on knees, rise onto toes squeezing calves, lower slowly.', 'calf_seated', 0],
  ['goblet_squat', '高腳杯深蹲', 'Goblet squat', 'legs', 'Dumbbell', 'B', ['Quads', 'Glutes'], '雙手持啞鈴於胸前，保持上身直立深蹲至底部。', 'Hold dumbbell at chest, squat deep keeping torso upright. Great for form practice.', 'squat_goblet'],
  ['step_up', '踏台', 'Step-up', 'legs', 'Dumbbell', 'B', ['Quads', 'Glutes', 'Balance'], '單腿踏上箱子，用腳跟發力站起，再緩慢放下。', 'Step up onto box with one leg, drive through heel to stand, lower back down.', 'step_up'],
  ['sissy_squat', '西西深蹲', 'Sissy squat', 'legs', 'Bodyweight', 'I', ['Quads'], '向後傾斜同時膝蓋向前超過腳趾，極度孤立股四頭肌。', 'Lean back as you bend knees forward over toes. Extreme quad isolation.', 'sissy', 0],
  ['nordic_curl', '北歐式腿彎舉', 'Nordic hamstring curl', 'legs', 'Bodyweight', 'A', ['Hamstrings'], '跪姿固定腳部，緩慢將上身降至地板，再用腿後肌拉回。', 'Kneel with feet anchored, slowly lower torso to floor then use hamstrings to pull back up.', 'nordic', 0],
  ['donkey_calf', '驢式提踵', 'Donkey calf raise', 'legs', 'Machine', 'B', ['Calves'], '前傾姿勢，重量置於臀部，踮腳尖。比站立式有更大伸展。', 'Bent-over position, weight on hips, rise onto toes. More stretch than standing.', 'calf_donkey', 0],
  ['sumo_deadlift', '相撲硬舉', 'Sumo deadlift', 'legs', 'Barbell', 'I', ['Inner Thigh', 'Glutes', 'Lower Back'], '寬腳距，腳趾外展45度，槓鈴緊貼身體，強調臀肌和內收肌。', 'Wide stance, toes out 45°. Pull bar close to body. Emphasises glutes and adductors.', 'sumo_dl'],
  ['lunge', '弓步蹲', 'Lunge', 'legs', 'Dumbbell', 'B', ['Quads', 'Glutes'], '前後腳企，垂直向下沉到後膝接近地面。', 'Split stance, sink straight down until the back knee nears the floor.', 'lunge'],
  ['db_press', '啞鈴肩推', 'DB shoulder press', 'shoulders', 'Dumbbell', 'B', ['Shoulders', 'Triceps'], '坐直背貼靠墊，啞鈴由耳仔高度推到頭頂。', 'Sit tall against the pad, press the dumbbells from ear height overhead.', 'db_press'],
  ['ohp', '頭頂推舉', 'Overhead press', 'shoulders', 'Barbell', 'I', ['Shoulders', 'Triceps'], '從下巴高度將槓鈴垂直向上推，手臂完全打直。', 'Press bar from chin height straight overhead, lock out arms.', 'ohp'],
  ['lat_raise', '啞鈴側平舉', 'Lateral raise', 'shoulders', 'Dumbbell', 'B', ['Side Deltoid'], '輕微前傾，將啞鈴舉至肩膀高度。', 'Raise dumbbells to shoulder height with slight forward lean.', 'lateral'],
  ['rev_fly', '坐姿反向飛鳥', 'Reverse fly', 'shoulders', 'Machine', 'B', ['Rear Deltoid', 'Rhomboids'], '胸口貼住墊，手臂微曲向後張開，夾緊後三角。', 'Chest on the pad, open the arms back with soft elbows, squeeze the rear delts.', 'rev_fly_machine', 0],
  ['facepull', '面拉', 'Face pull', 'shoulders', 'Cable', 'B', ['Rear Delt', 'Rotator Cuff'], '將繩索拉至額頭高度，保持手肘高而寬。', 'Pull rope to forehead with elbows high and wide.', 'face_pull'],
  ['arnold_press', '阿諾德推舉', 'Arnold press', 'shoulders', 'Dumbbell', 'I', ['All Three Deltoid Heads'], '手掌朝向自己開始，推起時旋轉至手掌朝前。', 'Start with palms facing you, press up while rotating to palms forward at top.', 'arnold', 0],
  ['upright_row', '直立划船', 'Upright row', 'shoulders', 'Barbell', 'I', ['Side Deltoid', 'Traps'], '窄握，手肘向外張開，將槓鈴垂直拉至下巴。', 'Narrow grip, pull bar straight up to chin with elbows flaring wide.', 'upright_row'],
  ['rear_delt_fly', '後束飛鳥', 'Rear delt fly', 'shoulders', 'Dumbbell', 'B', ['Rear Deltoid', 'Rhomboids'], '前傾45度，將啞鈴向兩側舉起，頂部收縮後束肌。', 'Hinge to 45°, raise dumbbells out to sides squeezing rear delts at top.', 'rear_fly'],
  ['cable_lateral', '滑輪側平舉', 'Cable lateral raise', 'shoulders', 'Cable', 'B', ['Side Deltoid'], '單臂，滑輪置於臀部高度，將手臂舉至肩膀高度，保持持續張力。', 'Single arm, cable at hip height, raise arm to shoulder level. Constant tension.', 'lateral_cable', 0],
  ['leaning_lateral', '側傾側平舉', 'Leaning lateral raise', 'shoulders', 'Dumbbell', 'B', ['Side Deltoid'], '抓住架子，向外傾斜，舉起另一手啞鈴，動作幅度更大。', 'Hold a rack, lean away, raise dumbbell in free hand. Better range of motion.', 'lateral_lean', 0],
  ['w_press', 'W字推舉', 'W-press (prone Y raise)', 'shoulders', 'Dumbbell', 'B', ['Rear Delt', 'Rotator Cuff'], '俯臥於椅上，將啞鈴呈Y形舉起，收縮後束肌。', 'Lie prone on bench, raise dumbbells in a Y shape squeezing rear delts.', 'y_raise', 0],
  ['lu_raises', '呂小軍舉', 'Lu raises', 'shoulders', 'Dumbbell', 'I', ['Shoulders', 'Rotator Cuff'], '前平舉然後旋轉成側平舉，一氣呵成。以呂小軍命名。', 'Front raise then rotate to lateral raise in one fluid motion. Named after Lu Xiaojun.', 'lu', 0],
  ['bb_curl', '槓鈴彎舉', 'Barbell curl', 'arms', 'Barbell', 'B', ['Biceps', 'Forearms'], '手肘夾緊身旁，將槓鈴捲至下巴。', 'Curl bar to chin keeping elbows tucked at sides.', 'curl_bb'],
  ['hammer', '啞鈴錘式彎舉', 'Hammer curl', 'arms', 'Dumbbell', 'B', ['Biceps', 'Brachialis'], '中立握（拇指朝上），交替捲起。', 'Neutral grip (thumbs up), curl alternating.', 'hammer'],
  ['cable_pd', '滑輪下壓', 'Cable pushdown', 'arms', 'Cable', 'B', ['Triceps'], '手肘貼身固定，只用前臂將把手壓到手伸直。', 'Elbows pinned to your sides, press the handle down until the arms are straight.', 'pushdown'],
  ['skull', '仰臥三頭肌伸展', 'Skull crusher', 'arms', 'Barbell', 'I', ['Triceps'], '只彎手肘將槓鈴降至額頭，再推回原位。', 'Lower bar to forehead by bending only elbows, extend back up.', 'skull'],
  ['dip', '雙槓臂屈伸', 'Dip', 'arms', 'Bodyweight', 'I', ['Triceps', 'Chest'], '下沉至手肘90度，完全推起。', 'Lower until elbows at 90°, press up fully.', 'dip'],
  ['preacher_curl', '牧師椅彎舉', 'Preacher curl', 'arms', 'Barbell', 'B', ['Biceps'], '上臂平放於墊上，捲起槓鈴並在頂部收縮二頭肌，緩慢放下。', 'Upper arms flat on pad, curl bar up squeezing biceps at top, lower slowly.', 'preacher', 0],
  ['concentration_curl', '集中彎舉', 'Concentration curl', 'arms', 'Dumbbell', 'B', ['Biceps'], '坐姿，手肘抵在大腿內側，向上捲起並用力收緊。', 'Seated, elbow braced on inner thigh. Curl up and squeeze hard at top.', 'concentration', 0],
  ['cable_curl', '滑輪彎舉', 'Cable curl', 'arms', 'Cable', 'B', ['Biceps', 'Forearms'], '使用直桿配件，手肘固定，向上捲起並控制下降。', 'Straight bar attachment, keep elbows fixed, curl up and control the negative.', 'curl_cable', 0],
  ['overhead_tri', '頭上三頭伸展', 'Overhead triceps extension', 'arms', 'Dumbbell', 'B', ['Triceps Long Head'], '雙手持啞鈴舉過頭頂，彎手肘將其降至頭後，再伸展推起。', 'Hold dumbbell overhead with both hands, lower behind head bending elbows, extend up.', 'overhead_tri'],
  ['cable_tri', '滑輪三頭下壓', 'Cable triceps pushdown', 'arms', 'Cable', 'B', ['Triceps'], '使用直桿或繩索配件，手肘固定，完全下壓並收縮三頭肌。', 'Straight or rope attachment, elbows fixed at sides, push down fully and squeeze.', 'pushdown'],
  ['incline_curl', '斜板啞鈴彎舉', 'Incline dumbbell curl', 'arms', 'Dumbbell', 'B', ['Biceps Long Head'], '坐於斜板，手臂垂於身後，向上捲起以拉伸二頭長頭。', 'Sit on incline bench, arms hang behind body. Curl up for long head stretch.', 'curl_incline', 0],
  ['spider_curl', '蜘蛛彎舉', 'Spider curl', 'arms', 'Barbell', 'B', ['Biceps'], '俯臥於斜板，向上捲起槓鈴，保持二頭肌持續張力。', 'Lie prone on incline bench, curl bar up, constant bicep tension.', 'curl_spider', 0],
  ['drag_curl', '拖拉彎舉', 'Drag curl', 'arms', 'Barbell', 'B', ['Biceps Long Head'], '沿身體向上拖拉槓鈴而非向外捲起，手肘向後移動，針對長頭。', 'Drag bar up body instead of curling out. Elbows travel back. Long head focus.', 'curl_drag', 0],
  ['reverse_curl', '反握彎舉', 'Reverse curl', 'arms', 'Barbell', 'B', ['Brachialis', 'Forearms'], '正握（手背朝上）捲起槓鈴，針對肱肌和前臂伸肌。', 'Overhand grip, curl bar up. Targets brachialis and forearm extensors.', 'curl_reverse', 0],
  ['wrist_curl', '腕部彎舉', 'Wrist curl', 'arms', 'Barbell', 'B', ['Forearms'], '前臂置於椅上，手腕懸空，向上捲起手腕再放下，針對前臂屈肌。', 'Forearms on bench, wrists hanging, curl wrists up and lower. Forearm flexors.', 'wrist_curl', 0],
  ['tricep_kickback', '三頭後踢', 'Triceps kickback', 'arms', 'Dumbbell', 'B', ['Triceps'], '前傾，上臂平行地面，向後伸展前臂並收縮三頭肌。', 'Hinge forward, upper arm parallel to floor, extend forearm back squeezing tricep.', 'kickback'],
  ['jm_press', 'JM推舉', 'JM press', 'arms', 'Barbell', 'I', ['Triceps'], '介於仰臥三頭伸展和窄距臥推之間的混合動作。', 'Hybrid between skull crusher and close-grip bench. Bar to upper chest area.', 'jm', 0],
  ['plank', '平板支撐', 'Plank', 'core', 'Bodyweight', 'B', ['Core', 'Shoulders'], '前臂撐地，身體從頭至腳保持一直線，收緊腹肌。', 'Forearms on floor, body straight head to heels. Brace abs.', 'plank'],
  ['crunch', '捲腹', 'Crunch', 'core', 'Bodyweight', 'B', ['Rectus Abdominis'], '躺下，雙腳平放，將肩膀向膝蓋捲起，頂部呼氣。', 'Lie on back, feet flat, curl shoulders toward knees. Exhale at top.', 'crunch'],
  ['leg_raise', '舉腿', 'Leg raise', 'core', 'Bodyweight', 'B', ['Lower Abs', 'Hip Flexors'], '平躺，將直腿舉至90度，緩慢放下但不觸地。', 'Lie flat, raise straight legs to 90°, lower slowly without touching floor.', 'leg_raise'],
  ['cable_crunch', '滑輪捲腹', 'Cable crunch', 'core', 'Cable', 'B', ['Rectus Abdominis'], '跪姿，將繩索拉下，手肘向膝蓋彎曲，脊柱彎曲。', 'Kneel, pull rope down crunching elbows toward knees, round the spine.', 'cable_crunch'],
  ['russian_twist', '俄羅斯轉體', 'Russian twist', 'core', 'Bodyweight', 'B', ['Obliques', 'Core'], '坐姿雙腳離地，後傾45度，持重物左右旋轉軀幹。', 'Sit with feet raised, lean back 45°, rotate torso side to side holding weight.', 'russian_twist'],
  ['ab_wheel', '滾輪捲腹', 'Ab wheel rollout', 'core', 'Other', 'I', ['Core', 'Lats', 'Shoulders'], '跪姿持滾輪，保持核心收緊向前滾出，再用腹肌拉回。', 'Kneel with wheel, roll forward keeping core braced, pull back using abs.', 'ab_wheel'],
  ['pallof_press', '帕洛夫推舉', 'Pallof press', 'core', 'Cable', 'B', ['Core', 'Obliques'], '垂直站於滑輪旁，向外推出再收回，抗旋轉核心訓練。', 'Stand perpendicular to cable, press out and return. Anti-rotation core training.', 'pallof'],
  ['dead_bug', '死蟲式', 'Dead bug', 'core', 'Bodyweight', 'B', ['Deep Core', 'Lower Back'], '躺背，對側手腳同時伸展，脊柱保持緊貼地面。', 'On back, opposite arm and leg extend simultaneously. Spine stays pressed to floor.', 'dead_bug'],
  ['hollow_hold', '空心撐', 'Hollow hold', 'core', 'Bodyweight', 'I', ['Core', 'Hip Flexors'], '躺背，下背壓地，舉起腿和肩膀並保持，全程保持下背緊貼地面。', 'Lie on back, press lower back to floor, raise legs and shoulders, hold.', 'hollow'],
  ['cable_woodchop', '滑輪伐木', 'Cable woodchop', 'core', 'Cable', 'B', ['Obliques', 'Core'], '將滑輪從高位到低位橫跨身體旋轉，全程收縮腹斜肌。', 'Rotate cable from high to low across body, engaging obliques throughout.', 'woodchop'],
  ['landmine_rotation', '地雷管旋轉', 'Landmine rotation', 'core', 'Barbell', 'B', ['Obliques', 'Shoulders'], '持地雷管末端，左右旋轉至最大幅度。', 'Hold end of landmine bar, rotate side to side through full range.', 'landmine_rot', 0],
  ['treadmill', '跑步機', 'Treadmill run', 'cardio', 'Machine', 'B', ['Full Body'], '逐漸加速，以腳掌中部著地，輕微前傾。', 'Build pace gradually, land midfoot, slight forward lean.', 'run', 0, 1],
  ['bike', '健身單車', 'Stationary bike', 'cardio', 'Machine', 'B', ['Full Body'], '調整座椅高度，保持穩定節奏。非常適合低衝擊有氧。', 'Adjust seat height, maintain steady pace. Great for low-impact cardio.', 'bike', 0, 1],
  ['rowing', '划船機', 'Rowing machine', 'cardio', 'Machine', 'B', ['Full Body', 'Back', 'Legs'], '先用腿推，再後仰並拉動。發力60%靠腿，40%靠手臂。', 'Push with legs first, then lean back and pull. Drive is 60% legs, 40% arms.', 'rower', 0, 1],
  ['jump_rope', '跳繩', 'Jump rope', 'cardio', 'Other', 'B', ['Calves', 'Shoulders', 'Cardio'], '手肘靠近身體，用手腕而非手臂轉繩，以腳掌前部輕輕落地。', 'Keep elbows close to sides, rotate wrists not arms. Land softly on balls of feet.', 'jump_rope', 0, 1],
  ['hiit', '高強度間歇訓練', 'HIIT intervals', 'cardio', 'Bodyweight', 'I', ['Full Body'], '交替40秒全力衝刺和20秒休息，重複8-10輪。', 'Alternate 40s max effort with 20s rest. Repeat 8-10 rounds.', 'burpee', 1, 1],
  ['stair_climber', '踏步機', 'Stair climber', 'cardio', 'Machine', 'B', ['Glutes', 'Calves', 'Quads'], '穩定踏步動作，保持直立，避免倚靠扶手，有效鍛鍊臀肌。', 'Steady climbing motion. Keep upright, avoid leaning on rails. Great glute work.', 'stairs', 0, 1],
  ['battle_ropes', '戰繩', 'Battle ropes', 'cardio', 'Other', 'B', ['Shoulders', 'Core', 'Arms'], '交替或同時甩動繩子，保持核心收緊，30秒做15秒休息間歇。', 'Alternate or simultaneous waves. Keep core braced. 30s on, 15s off intervals.', 'battle_ropes', 0, 1],
  ['sled_push', '推雪橇', 'Sled push', 'cardio', 'Other', 'I', ['Quads', 'Glutes', 'Chest'], '降低臀部，用腿發力，爆發性地推動雪橇。', 'Low hips, drive through legs. Explosively push sled across the floor.', 'sled', 0, 1],
  ['box_jump', '跳箱', 'Box jump', 'cardio', 'Other', 'I', ['Quads', 'Glutes', 'Calves'], '擺臂，爆發向上，雙腳輕輕落於箱子上，再踏步下來。', 'Swing arms, explode upward, land softly on box with both feet. Step down.', 'box_jump', 0, 1]
];

export const EX = {};
export const EX_LIST = RAW.map(r => {
  const [id, zh, en, cat, equip, lv, muscles, dZh, dEn, move, approx, cardio] = r;
  const e = { id, zh, en, cat, equip, level: LV[lv], muscles, dZh, dEn, move, approx: !!approx, isCardio: !!cardio };
  EX[id] = e; return e;
});

export function bodyParts(ex) {
  const s = new Set();
  for (const m of ex.muscles) { const p = MUSCLES[m]; if (p) p[1].split(' ').forEach(x => s.add(x)); }
  return [...s];
}
export const muscleZh = m => (MUSCLES[m] ? MUSCLES[m][0] : m);

// everyday Hong Kong names, so the library search finds them (e.g. 亞諾推肩 -> Arnold press)
export const ALIAS = {
  arnold_press: '亞諾推肩 阿諾推肩 亞諾 阿諾 arnold 推肩', db_press: '啞鈴推肩 推肩', ohp: '槓鈴推肩 推肩 站姿推舉 軍事推舉',
  lat_raise: '側平舉 側舉 飛膊', rev_fly: '反向飛鳥 後三角', squat: '深蹲 孖腳蹲', deadlift: '硬拉 拉地',
  rdl: '羅馬尼亞硬拉 直腳硬拉', bench_press: '臥推 平板推胸 推胸', inc_db: '上斜推胸 斜板推胸', pec_deck: '夾胸機 蝴蝶機 飛鳥機',
  lat_pd: '滑輪下拉 拉背 下拉', sit_row: '坐姿划船 拉背', db_row: '單手划船 啞鈴划船', pullup: '引體上升 拉單槓', dip: '雙槓 撐體',
  bb_curl: '二頭彎舉 槓鈴彎舉 二頭', hammer: '錘式彎舉 錘子彎舉 二頭', cable_pd: '三頭下壓 下壓 三頭', skull: '碎顱 碎頭 三頭',
  leg_press: '腿推 推腿機', leg_curl: '腿彎舉 勾腿', calf: '提踵 小腿', adductor: '夾腿機 內收', hip_thrust: '臀推 頂臀',
  leg_raise: '舉腿 抬腿 舉腳', crunch: '捲腹 仰臥起坐', plank: '平板支撐 平板撐', treadmill: '跑步機 跑步', lunge: '弓箭步'
};
