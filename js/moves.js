// Movement library for the 3D viewer.
// Coordinates in metres: x = figure's left, y = up, z = the way the figure faces.
// pel = pelvis [y,z]; trunk = torso lean in degrees (forward +, lying on back -90, face down +90).
// h/hL/hR = hand target (world), ht = torso-local, hs = offset from the shoulder.
// f/fL/fR = ankle target (world), fo = offset from the pelvis. ep/kp = elbow/knee pointing direction.
// Every move loops: the last key equals the first.

const P = (at, zh, en, czh, cen) => ({ at, zh, en, czh, cen });
const M = (zh, en) => ({ zh, en });
const sag = (o, dy) => ({ ...o, pel: [o.pel[0] + dy, o.pel[1]] });

// straight body from shoulders to ankles (push-up / plank family)
function line(shY, shZ, ankY = 0.13) {
  const L = 0.48 + 0.875;
  const a = Math.asin(Math.max(-1, Math.min(1, (shY - ankY) / L)));
  const trunk = 90 - a * 180 / Math.PI, r = trunk * Math.PI / 180;
  const pz = shZ - 0.48 * Math.sin(r), py = shY - 0.48 * Math.cos(r);
  return { pel: [py, pz], trunk, f: [0.12, py - 0.875 * Math.cos(r), pz - 0.875 * Math.sin(r)] };
}
const loop = keys => [...keys, { ...keys[0], t: 1 }];
const STAND = { pel: [0.96, 0], trunk: 0, f: [0.13, 0.08, 0], fy: 8 };

export const MOVES = {
  // ───────────── LEGS ─────────────
  squat_bb: {
    period: 3.8, cam: { view: 'q', target: [0, 0.85, 0], dist: 3.3 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.95, 0], trunk: 6, ht: [0.42, 0.45, -0.12], ep: [0.6, -1, -0.7], f: [0.17, 0.08, 0], fy: 18, kp: [0.45, 0, 1] },
      { t: 0.12, pel: [0.95, 0], trunk: 6 },
      { t: 0.47, pel: [0.50, -0.22], trunk: 42 },
      { t: 0.57, pel: [0.50, -0.22], trunk: 42 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '槓放喺上斜方肌，深吸一啖氣收緊核心', 'Bar on your upper traps, big breath, brace your core'),
      P([0.12, 0.47], '下蹲', 'Descent', '臀部向後向下坐，膝蓋跟住腳尖方向', 'Sit hips back and down, knees track over your toes'),
      P([0.47, 0.57], '谷底', 'Bottom', '大腿最少平行地面，背部保持平直', 'Thighs at least parallel, back stays flat'),
      P([0.57, 1], '發力', 'Drive up', '成隻腳掌發力，臀同膝一齊伸直', 'Drive through the whole foot, hips and knees together')
    ],
    mistakes: [M('膝蓋向內夾', 'Knees caving inward'), M('腳踭離地', 'Heels lifting off the floor'), M('落到底時下背圓咗', 'Lower back rounding at the bottom')]
  },
  squat_goblet: {
    period: 3.6, cam: { view: 'q', target: [0, 0.8, 0], dist: 3.2 },
    props: [{ type: 'dumbbell1', axis: 'y' }],
    keys: loop([
      { t: 0, pel: [0.95, 0], trunk: 4, ht: [0.06, 0.37, 0.22], ep: [0.25, -1, 0.3], f: [0.18, 0.08, 0], fy: 20, kp: [0.5, 0, 1] },
      { t: 0.12, pel: [0.95, 0], trunk: 4 },
      { t: 0.47, pel: [0.43, -0.12], trunk: 26 },
      { t: 0.57, pel: [0.43, -0.12], trunk: 26 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '啞鈴貼住心口，手肘向下', 'Hold the dumbbell against your chest, elbows down'),
      P([0.12, 0.47], '下蹲', 'Descent', '上身保持挺直，坐落兩腿之間', 'Keep your chest up and sit between your legs'),
      P([0.47, 0.57], '谷底', 'Bottom', '手肘喺膝蓋內側，膝蓋向外推', 'Elbows inside the knees, push the knees out'),
      P([0.57, 1], '發力', 'Drive up', '腳踭發力企返直', 'Drive through your heels to stand')
    ],
    mistakes: [M('上身向前跌', 'Chest falling forward'), M('膝蓋內夾', 'Knees caving in')]
  },
  deadlift: {
    period: 4.2, cam: { view: 'q', target: [0, 0.75, 0], dist: 3.2 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.60, -0.33], trunk: 60, h: [0.24, 0.235, 0.06], ep: [0.2, 0, -1], f: [0.13, 0.08, 0], fy: 6, kp: [0.2, 0, 1] },
      { t: 0.12, pel: [0.60, -0.33], trunk: 60 },
      { t: 0.36, pel: [0.80, -0.21], trunk: 38, h: [0.24, 0.55, 0.08] },
      { t: 0.55, pel: [0.96, 0], trunk: -1, h: [0.24, 0.81, 0.11] },
      { t: 0.66, pel: [0.96, 0], trunk: -1, h: [0.24, 0.81, 0.11] },
      { t: 0.84, pel: [0.80, -0.21], trunk: 38, h: [0.24, 0.55, 0.08] }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '槓喺腳掌中間、貼住脛骨，背打平', 'Bar over mid-foot against your shins, flat back'),
      P([0.12, 0.55], '拉起', 'Pull', '用腳推地，槓貼住腿向上', 'Push the floor away, keep the bar against your legs'),
      P([0.55, 0.66], '鎖定', 'Lockout', '夾臀企直，唔好向後彎', 'Squeeze glutes to stand tall, no leaning back'),
      P([0.66, 1], '放落', 'Lower', '臀部先向後，槓沿住腿落返去', 'Hips back first, slide the bar down your legs')
    ],
    mistakes: [M('圓背拉', 'Rounding the back'), M('槓離開身體', 'Bar drifting away from the legs'), M('臀部比槓升得快', 'Hips shooting up before the bar moves')]
  },
  rdl: {
    period: 4, cam: { view: 'q', target: [0, 0.8, 0], dist: 3.2 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.22, 0.82, 0.10], ep: [0.2, 0, -1], kp: [0.1, 0, 1] },
      { t: 0.1, pel: [0.96, 0], trunk: 0 },
      { t: 0.5, pel: [0.88, -0.30], trunk: 72, h: [0.22, 0.42, 0.10] },
      { t: 0.6, pel: [0.88, -0.30], trunk: 72, h: [0.22, 0.42, 0.10] }
    ]),
    phases: [
      P([0, 0.1], '企直', 'Start tall', '膝蓋微曲，肩胛向後收', 'Soft knees, shoulders pulled back'),
      P([0.1, 0.5], '屈髖', 'Hinge', '臀部向後推，槓貼住大腿落', 'Push your hips back, bar slides down the thighs'),
      P([0.5, 0.6], '拉伸', 'Stretch', '感到大腿後側拉緊就停', 'Stop when you feel the hamstrings stretch'),
      P([0.6, 1], '夾臀企返', 'Stand up', '臀部向前推，夾緊臀肌', 'Drive hips forward and squeeze your glutes')
    ],
    mistakes: [M('彎膝變咗深蹲', 'Bending the knees into a squat'), M('落太低圓背', 'Going too low and rounding the back')]
  },
  good_morning: {
    period: 4, cam: { view: 'q', target: [0, 0.85, 0], dist: 3.2 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { ...STAND, t: 0, ht: [0.42, 0.45, -0.12], ep: [0.6, -1, -0.7], kp: [0.1, 0, 1] },
      { t: 0.1, pel: [0.96, 0], trunk: 0 },
      { t: 0.5, pel: [0.89, -0.26], trunk: 75 },
      { t: 0.6, pel: [0.89, -0.26], trunk: 75 }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '槓放上背，膝蓋微曲', 'Bar on the upper back, soft knees'),
      P([0.1, 0.5], '屈髖', 'Hinge', '背打直，臀部向後', 'Flat back, hips travel back'),
      P([0.5, 0.6], '最低點', 'Bottom', '上身接近平行地面', 'Torso close to parallel'),
      P([0.6, 1], '企返', 'Stand up', '臀部發力帶上身返嚟', 'Glutes bring the torso back up')
    ],
    mistakes: [M('圓背', 'Rounding the back'), M('膝蓋鎖死', 'Locked knees')]
  },
  sumo_dl: {
    period: 4.2, cam: { view: 'q', target: [0, 0.75, 0], dist: 3.4 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.52, -0.20], trunk: 44, h: [0.15, 0.235, 0.06], f: [0.36, 0.08, 0], fy: 38, kp: [1, 0, 0.9], ep: [0, 0, -1] },
      { t: 0.12, pel: [0.52, -0.20], trunk: 44 },
      { t: 0.55, pel: [0.90, 0], trunk: -1, h: [0.15, 0.80, 0.11] },
      { t: 0.66, pel: [0.90, 0], trunk: -1, h: [0.15, 0.80, 0.11] }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '企闊、腳尖向外，手握喺兩腳之間', 'Wide stance, toes out, hands inside your legs'),
      P([0.12, 0.55], '拉起', 'Pull', '膝蓋向外推，胸口挺起', 'Push your knees out, chest up'),
      P([0.55, 0.66], '鎖定', 'Lockout', '夾臀企直', 'Squeeze glutes to finish'),
      P([0.66, 1], '放落', 'Lower', '控制住落返地', 'Lower with control')
    ],
    mistakes: [M('膝蓋向內塌', 'Knees collapsing in'), M('臀部先升', 'Hips rising first')]
  },
  lunge: {
    period: 3.6, cam: { view: 'side', target: [0, 0.75, 0], dist: 3.3 },
    props: [{ type: 'dumbbells', axis: 'z' }],
    keys: loop([
      { t: 0, pel: [0.84, -0.03], trunk: 3, fL: [0.12, 0.08, 0.40], fR: [-0.12, 0.14, -0.45], fpL: 0, fpR: 50, fy: 4, kpL: [0.1, 0, 1], kpR: [0, -0.4, 1], hs: [0.02, -0.6, 0.0] },
      { t: 0.12, pel: [0.84, -0.03] },
      { t: 0.47, pel: [0.50, -0.03], trunk: 6 },
      { t: 0.57, pel: [0.50, -0.03], trunk: 6 }
    ]),
    phases: [
      P([0, 0.12], '前後腳企好', 'Split stance', '前後腳距離約一步半', 'Feet about a stride and a half apart'),
      P([0.12, 0.47], '落', 'Lower', '垂直向下沉，唔好向前衝', 'Drop straight down, don\'t lunge forward'),
      P([0.47, 0.57], '最低點', 'Bottom', '後膝接近地面，前膝喺腳踝上', 'Back knee near the floor, front knee over the ankle'),
      P([0.57, 1], '推起', 'Drive up', '前腳腳踭發力', 'Push through the front heel')
    ],
    mistakes: [M('前膝衝過腳尖太多', 'Front knee shooting far past the toes'), M('上身向前傾', 'Leaning the torso forward')]
  },
  bulgarian: {
    period: 3.8, cam: { view: 'side', target: [0, 0.75, -0.1], dist: 3.4 },
    props: [{ type: 'bench', y: 0.45, z0: -0.95, z1: -0.45 }, { type: 'dumbbells', axis: 'z' }],
    keys: loop([
      { t: 0, pel: [0.85, -0.08], trunk: 6, fL: [0.12, 0.08, 0.32], fR: [-0.12, 0.55, -0.64], fpR: 75, fy: 4, kpL: [0.1, 0, 1], kpR: [0, -0.6, 1], hs: [0.02, -0.6, 0.0] },
      { t: 0.12, pel: [0.85, -0.08] },
      { t: 0.47, pel: [0.52, -0.10], trunk: 12 },
      { t: 0.57, pel: [0.52, -0.10], trunk: 12 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '後腳腳背放喺凳上', 'Rest the top of your back foot on the bench'),
      P([0.12, 0.47], '落', 'Lower', '前腳承重，垂直向下', 'Weight on the front leg, sink straight down'),
      P([0.47, 0.57], '最低點', 'Bottom', '前大腿接近平行', 'Front thigh near parallel'),
      P([0.57, 1], '推起', 'Drive up', '前腳腳踭推地', 'Drive through the front heel')
    ],
    mistakes: [M('用後腳出力', 'Pushing with the back leg'), M('前腳企得太近凳', 'Front foot too close to the bench')]
  },
  step_up: {
    period: 4, cam: { view: 'side', target: [0, 1.15, 0.2], dist: 4.1 },
    props: [{ type: 'box', w: 0.6, h: 0.42, d: 0.42, z: 0.4 }, { type: 'dumbbells', axis: 'z' }],
    keys: loop([
      { t: 0, pel: [0.84, 0.0], trunk: 14, fL: [0.12, 0.50, 0.38], fR: [-0.12, 0.08, -0.06], fpR: 10, fy: 4, kp: [0.1, 0, 1], hs: [0.02, -0.6, 0.02] },
      { t: 0.1, pel: [0.84, 0.0], trunk: 14 },
      { t: 0.3, pel: [1.16, 0.25], trunk: 10, fR: [-0.12, 0.30, 0.12], fpR: 30 },
      { t: 0.45, pel: [1.38, 0.36], trunk: 2, fR: [-0.12, 0.50, 0.38], fpR: 0 },
      { t: 0.55, pel: [1.38, 0.36], trunk: 2, fR: [-0.12, 0.50, 0.38], fpR: 0 },
      { t: 0.75, pel: [1.10, 0.20], trunk: 10, fR: [-0.12, 0.22, 0.05], fpR: 25 },
      { t: 0.9, pel: [0.84, 0.0], trunk: 14, fR: [-0.12, 0.08, -0.06], fpR: 10 }
    ]),
    phases: [
      P([0, 0.1], '一腳上箱', 'Foot on box', '成隻腳放晒上箱', 'Whole foot on the box'),
      P([0.1, 0.45], '踏上', 'Step up', '用上面隻腳發力，唔好用後腳彈', 'Drive with the top leg, don\'t bounce off the back foot'),
      P([0.45, 0.55], '企直', 'Stand tall', '喺箱上企直', 'Stand tall on the box'),
      P([0.55, 1], '慢慢落', 'Step down', '控制住落返去', 'Lower with control')
    ],
    mistakes: [M('後腳蹬地借力', 'Pushing off the back foot'), M('膝蓋向內', 'Knee caving in')]
  },
  leg_press: {
    period: 3.6, cam: { view: 'side', target: [0, 0.7, 0.25], dist: 3.2 },
    props: [{ type: 'incline', y: 0.42, angle: 50, z: 0.05, len: 0.75 }, { type: 'platform' }, { type: 'handles', x: 0.3, y: 0.45, z: 0.05 }],
    keys: loop([
      { t: 0, pel: [0.50, 0.02], trunk: -50, head: 18, f: [0.15, 1.00, 0.64], fp: -50, kp: [0.5, 1, 0.3], ht: [0.30, 0.04, 0.06], ep: [1, -0.2, 0] },
      { t: 0.12, pel: [0.50, 0.02], trunk: -50 },
      { t: 0.47, pel: [0.50, 0.02], trunk: -50, f: [0.15, 0.80, 0.40] },
      { t: 0.57, pel: [0.50, 0.02], trunk: -50, f: [0.15, 0.80, 0.40] }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '腳與肩同寬，背貼實靠墊', 'Feet shoulder-width, back flat on the pad'),
      P([0.12, 0.47], '落', 'Lower', '慢慢屈膝到約 90 度', 'Bend the knees slowly to about 90°'),
      P([0.47, 0.57], '最低點', 'Bottom', '臀部唔好離開座位', 'Keep your hips on the seat'),
      P([0.57, 1], '推', 'Press', '腳踭推，膝蓋唔好鎖死', 'Press through heels, don\'t lock the knees')
    ],
    mistakes: [M('膝蓋鎖死', 'Locking the knees out'), M('落太深臀部離座', 'Going so deep the hips lift off')]
  },
  leg_curl: {
    period: 3.4, cam: { view: 'side', target: [0, 0.7, -0.1], dist: 3.2 },
    props: [{ type: 'bench', y: 0.55, z0: -0.62, z1: 0.75, w: 0.34 }, { type: 'roller' }],
    keys: loop([
      { t: 0, pel: [0.66, -0.02], trunk: 90, head: -25, h: [0.24, 0.55, 0.62], ep: [0.3, -1, 0], f: [0.1, 0.64, -0.85], fp: 60, kp: [0, -1, 0] },
      { t: 0.1, f: [0.1, 0.64, -0.85] },
      { t: 0.42, f: [0.1, 1.04, -0.50] },
      { t: 0.52, f: [0.1, 1.04, -0.50] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '膝蓋啱啱喺凳邊外，墊壓喺腳踝上', 'Knees just off the pad edge, roller above the ankles'),
      P([0.1, 0.42], '彎', 'Curl', '用大腿後側將腳拉向臀部', 'Pull your heels toward your glutes with the hamstrings'),
      P([0.42, 0.52], '頂部', 'Top', '停一停，夾緊', 'Pause and squeeze'),
      P([0.52, 1], '放', 'Lower', '慢慢放，唔好跌落', 'Lower slowly, don\'t let it drop')
    ],
    mistakes: [M('臀部抬起', 'Hips lifting off the pad'), M('放得太快', 'Dropping the weight')]
  },
  calf: {
    period: 2.8, cam: { view: 'side', target: [0, 0.9, 0], dist: 3.6 },
    props: [],
    keys: loop([
      { ...STAND, t: 0, f: [0.12, 0.08, 0], fp: 0, hs: [0.02, -0.6, 0.04] },
      { t: 0.12, pel: [0.96, 0], f: [0.12, 0.08, 0], fp: 0 },
      { t: 0.42, pel: [1.05, 0.01], f: [0.12, 0.17, 0.0], fp: 38 },
      { t: 0.55, pel: [1.05, 0.01], f: [0.12, 0.17, 0.0], fp: 38 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '腳掌前半著地，腳踭放到最低', 'Balls of the feet planted, heels all the way down'),
      P([0.12, 0.42], '踮', 'Rise', '用小腿將腳踭推到最高', 'Push the heels as high as you can'),
      P([0.42, 0.55], '頂部', 'Top', '停一秒夾緊小腿', 'Hold one second and squeeze'),
      P([0.55, 1], '放', 'Lower', '慢慢放到最低，拉伸小腿', 'Lower slowly into a full stretch')
    ],
    mistakes: [M('彈上彈落', 'Bouncing'), M('幅度太細', 'Half reps')]
  },
  hip_thrust: {
    period: 3.4, cam: { view: 'q', target: [0, 0.45, 0], dist: 3 },
    props: [{ type: 'bench', y: 0.42, z0: -0.95, z1: -0.40 }, { type: 'barbell', len: 1.7, plate: 0.2 }],
    keys: loop([
      { t: 0, pel: [0.30, 0.03], trunk: -58, head: 25, f: [0.18, 0.08, 0.46], kp: [0.35, 0.4, 1], ht: [0.34, 0.0, 0.15], ep: [0.6, 1, 0.2] },
      { t: 0.12, pel: [0.30, 0.03], trunk: -58 },
      { t: 0.42, pel: [0.61, 0.0], trunk: -88, head: 45 },
      { t: 0.54, pel: [0.61, 0.0], trunk: -88, head: 45 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '上背靠凳邊，槓放喺盆骨上', 'Upper back on the bench edge, bar over your hips'),
      P([0.12, 0.42], '推', 'Thrust', '腳踭發力，臀部向上推', 'Drive through the heels, push the hips up'),
      P([0.42, 0.54], '頂部', 'Top', '膝蓋 90 度，夾緊臀肌，下巴微收', 'Knees at 90°, squeeze glutes, chin tucked'),
      P([0.54, 1], '放', 'Lower', '控制住落返去', 'Lower with control')
    ],
    mistakes: [M('用下背頂起', 'Arching the lower back to finish'), M('腳放得太遠', 'Feet too far forward')]
  },
  adductor: {
    period: 3.2, cam: { view: 'front', target: [0, 0.65, 0], dist: 3 },
    props: [{ type: 'seat', y: 0.45, z: 0, back: 0.65, backTilt: 8 }, { type: 'handles', x: 0.30, y: 0.555, z: 0.10 }],
    keys: loop([
      { t: 0, pel: [0.55, 0], trunk: -8, f: [0.46, 0.22, 0.40], fy: 10, kp: [1, 0.8, 0.5], h: [0.30, 0.56, 0.10], ep: [1, -0.6, -0.2], pn: [0, -1, 0] },
      { t: 0.12, f: [0.46, 0.22, 0.40] },
      { t: 0.45, f: [0.13, 0.22, 0.42], kp: [0.25, 0.5, 1] },
      { t: 0.56, f: [0.13, 0.22, 0.42], kp: [0.25, 0.5, 1] }
    ]),
    phases: [
      P([0, 0.12], '張開', 'Open', '背貼靠墊，雙腳張開', 'Back on the pad, legs open'),
      P([0.12, 0.45], '夾', 'Squeeze', '用大腿內側夾埋', 'Bring the legs together with your inner thighs'),
      P([0.45, 0.56], '停', 'Hold', '停一秒', 'Hold one second'),
      P([0.56, 1], '慢放', 'Release', '控制住張返開', 'Open back up with control')
    ],
    mistakes: [M('用衝力彈', 'Using momentum'), M('上身向前傾', 'Leaning forward')]
  },

  // ───────────── CHEST ─────────────
  bench: {
    period: 3.8, cam: { view: 'q', target: [0, 0.7, -0.15], dist: 3.1, phi: 0.3 },
    props: [{ type: 'bench' }, { type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.55, 0.12], trunk: -90, f: [0.28, 0.08, 0.52], kp: [0.5, 1, 0.4], h: [0.40, 1.17, -0.32], ep: [1, 0.3, 0.15] },
      { t: 0.1, h: [0.40, 1.17, -0.32] },
      { t: 0.45, h: [0.41, 0.83, -0.23] },
      { t: 0.53, h: [0.41, 0.83, -0.23] },
      { t: 0.8, h: [0.40, 1.17, -0.32] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '肩胛向後向下收，腳踩實地', 'Pull shoulder blades back and down, feet planted'),
      P([0.1, 0.45], '落槓', 'Lower', '控制住落到下胸', 'Lower under control to your lower chest'),
      P([0.45, 0.53], '觸胸', 'Touch', '輕輕掂胸，手肘約 45–70 度', 'Light touch, elbows about 45–70° from the body'),
      P([0.53, 1], '推起', 'Press', '向上同少少向後推', 'Press up and slightly back')
    ],
    mistakes: [M('手肘打到 90 度', 'Elbows flared to 90°'), M('槓喺胸口彈', 'Bouncing the bar off the chest'), M('臀部離凳', 'Hips lifting off the bench')]
  },
  bench_close: {
    period: 3.8, cam: { view: 'q', target: [0, 0.7, -0.15], dist: 3.1, phi: 0.3 },
    props: [{ type: 'bench' }, { type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.55, 0.12], trunk: -90, f: [0.28, 0.08, 0.52], kp: [0.5, 1, 0.4], h: [0.21, 1.17, -0.30], ep: [0.4, -1, 0.5] },
      { t: 0.1, h: [0.21, 1.17, -0.30] },
      { t: 0.45, h: [0.21, 0.83, -0.18] },
      { t: 0.53, h: [0.21, 0.83, -0.18] },
      { t: 0.8, h: [0.21, 1.17, -0.30] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '握距與肩同寬', 'Grip about shoulder-width'),
      P([0.1, 0.45], '落槓', 'Lower', '手肘貼近身體落到下胸', 'Elbows close to your sides, lower to the lower chest'),
      P([0.45, 0.53], '觸胸', 'Touch', '輕觸', 'Light touch'),
      P([0.53, 1], '推起', 'Press', '用三頭肌推直', 'Lock out with your triceps')
    ],
    mistakes: [M('握得太窄傷手腕', 'Grip so narrow it hurts the wrists'), M('手肘向外張', 'Elbows flaring out')]
  },
  incline_press: {
    period: 3.8, cam: { view: 'side', target: [0, 0.95, -0.1], dist: 3.2, phi: 0.25 },
    props: [{ type: 'incline', y: 0.45, angle: 55, z: 0.12 }, { type: 'dumbbells', axis: 'x' }],
    keys: loop([
      { t: 0, pel: [0.55, 0.15], trunk: -55, f: [0.26, 0.08, 0.58], kp: [0.5, 0.6, 1], h: [0.17, 1.42, -0.17], ep: [1, -0.5, 0.2] },
      { t: 0.1, h: [0.17, 1.42, -0.17] },
      { t: 0.45, ht: [0.40, 0.44, 0.31], ep: [1, -0.1, 0.15] },
      { t: 0.53, ht: [0.40, 0.44, 0.31], ep: [1, -0.1, 0.15] },
      { t: 0.8, h: [0.17, 1.42, -0.17] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '斜板 30–45 度，肩胛收緊', 'Bench at 30–45°, shoulder blades pinned'),
      P([0.1, 0.45], '落', 'Lower', '啞鈴落到上胸兩側', 'Lower the dumbbells beside your upper chest'),
      P([0.45, 0.53], '最低點', 'Bottom', '感到上胸拉伸', 'Feel the stretch across the upper chest'),
      P([0.53, 1], '推', 'Press', '向上推，頂部啞鈴靠近', 'Press up, dumbbells come together at the top')
    ],
    mistakes: [M('斜板角度太高變咗推肩', 'Bench so steep it becomes a shoulder press'), M('落得太淺', 'Partial range')]
  },
  pushup: {
    hand: 'open',
    period: 3.2, cam: { view: 'side', target: [0, 0.4, 0], dist: 3.1, phi: 0.2 },
    props: [],
    keys: loop([
      { t: 0, ...line(0.66, 0.40), fp: 72, kp: [0, -1, 0], h: [0.24, 0.04, 0.42], ep: [0.5, 0.5, -0.8], head: -5 },
      { t: 0.1, ...line(0.66, 0.40) },
      { t: 0.45, ...line(0.25, 0.46) },
      { t: 0.53, ...line(0.25, 0.46) }
    ]),
    phases: [
      P([0, 0.1], '撐起', 'Top', '手喺肩膊下面，身體一直線', 'Hands under shoulders, body in one straight line'),
      P([0.1, 0.45], '落', 'Lower', '手肘向後約 45 度', 'Elbows back at about 45°'),
      P([0.45, 0.53], '最低點', 'Bottom', '心口接近地面', 'Chest close to the floor'),
      P([0.53, 1], '推起', 'Push', '成個身一齊上，唔好塌腰', 'Rise as one piece, don\'t let the hips sag')
    ],
    mistakes: [M('腰向下塌', 'Hips sagging'), M('手肘向兩邊張開', 'Elbows flared straight out'), M('只係頭落', 'Only the head goes down')]
  },
  fly_cable: {
    period: 3.6, cam: { view: 'q', target: [0, 1.05, 0], dist: 3.4, phi: 0.18 },
    props: [{ type: 'cable', anchor: [1.25, 1.85, -0.1], to: 'L', handle: 'd', towerDz: 0 }, { type: 'cable', anchor: [-1.25, 1.85, -0.1], to: 'R', handle: 'd', towerDz: 0 }],
    keys: loop([
      { t: 0, pel: [0.95, -0.04], trunk: 12, fL: [0.14, 0.08, 0.08], fR: [-0.14, 0.08, -0.12], h: [0.80, 1.40, 0.04], ep: [0, 0.5, -1] },
      { t: 0.1, h: [0.80, 1.40, 0.04] },
      { t: 0.45, h: [0.13, 1.28, 0.50], ep: [0.5, 0.4, -1] },
      { t: 0.55, h: [0.13, 1.28, 0.50], ep: [0.5, 0.4, -1] }
    ]),
    phases: [
      P([0, 0.1], '張開', 'Open', '手肘微曲固定，胸口挺起', 'Slight fixed bend in the elbows, chest up'),
      P([0.1, 0.45], '合', 'Hug', '似攬住一棵大樹咁向前合', 'Bring the hands together like hugging a big tree'),
      P([0.45, 0.55], '夾', 'Squeeze', '夾緊胸肌', 'Squeeze the chest'),
      P([0.55, 1], '慢放', 'Open slowly', '感到胸口拉伸就停', 'Open until you feel the chest stretch')
    ],
    mistakes: [M('彎手變咗推', 'Bending the arms into a press'), M('聳膊頭', 'Shrugging the shoulders')]
  },
  fly_low: {
    period: 3.6, cam: { view: 'q', target: [0, 1.0, 0], dist: 3.4, phi: 0.18 },
    props: [{ type: 'cable', anchor: [1.2, 0.25, -0.1], to: 'L', handle: 'd', towerDz: 0 }, { type: 'cable', anchor: [-1.2, 0.25, -0.1], to: 'R', handle: 'd', towerDz: 0 }],
    keys: loop([
      { t: 0, pel: [0.95, -0.02], trunk: 4, fL: [0.14, 0.08, 0.08], fR: [-0.14, 0.08, -0.12], h: [0.66, 0.86, 0.10], ep: [0, -0.2, -1] },
      { t: 0.1, h: [0.66, 0.86, 0.10] },
      { t: 0.45, h: [0.13, 1.34, 0.45] },
      { t: 0.55, h: [0.13, 1.34, 0.45] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '滑輪喺低位，手喺身兩側', 'Pulleys low, hands at your sides'),
      P([0.1, 0.45], '向上合', 'Scoop up', '弧形向上向內合埋', 'Arc up and in'),
      P([0.45, 0.55], '夾', 'Squeeze', '喺胸前夾緊下胸', 'Squeeze the lower chest in front of you'),
      P([0.55, 1], '慢放', 'Lower', '控制住放返落去', 'Lower under control')
    ],
    mistakes: [M('用手臂拉', 'Pulling with the arms'), M('身體搖', 'Swinging the body')]
  },
  pec_deck: {
    period: 3.6, cam: { view: 'q', target: [0, 0.95, 0], dist: 3.2, phi: 0.25 },
    props: [{ type: 'seat', y: 0.45, z: 0, back: 0.75 }],
    keys: loop([
      { t: 0, pel: [0.55, -0.02], trunk: 0, f: [0.2, 0.08, 0.42], kp: [0.3, 0.4, 1], h: [0.50, 1.31, -0.05], ep: [1, -0.4, -0.3] },
      { t: 0.1, h: [0.50, 1.31, -0.05] },
      { t: 0.45, h: [0.13, 1.33, 0.38], ep: [0.4, -0.5, 1] },
      { t: 0.55, h: [0.13, 1.33, 0.38], ep: [0.4, -0.5, 1] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手肘 90 度，同膊頭一樣高', 'Elbows at 90°, level with your shoulders'),
      P([0.1, 0.45], '合', 'Close', '用胸肌將把手夾埋', 'Bring the pads together with your chest'),
      P([0.45, 0.55], '夾', 'Squeeze', '停一秒', 'Hold one second'),
      P([0.55, 1], '慢放', 'Open', '慢慢張開，感受拉伸', 'Open slowly into the stretch')
    ],
    mistakes: [M('座位太高或太低', 'Seat set too high or low'), M('背部離開靠墊', 'Back coming off the pad')]
  },
  dip: {
    period: 3.4, cam: { view: 'side', target: [0, 1.35, 0], dist: 3.6, phi: 0.12 },
    props: [{ type: 'dipbars', y: 1.36, x: 0.29 }],
    keys: loop([
      { t: 0, pel: [1.52, -0.04], trunk: 5, h: [0.29, 1.38, 0.03], ep: [0.15, 0, -1], fo: [0.07, -0.80, -0.22], fp: 35, kp: [0, 0, 1] },
      { t: 0.1, pel: [1.52, -0.04], trunk: 5 },
      { t: 0.45, pel: [1.22, -0.12], trunk: 16 },
      { t: 0.53, pel: [1.22, -0.12], trunk: 16 }
    ]),
    phases: [
      P([0, 0.1], '撐起', 'Top', '手臂伸直，膊頭向下壓', 'Arms straight, shoulders pressed down'),
      P([0.1, 0.45], '落', 'Lower', '手肘向後屈', 'Bend the elbows straight back'),
      P([0.45, 0.53], '最低點', 'Bottom', '上臂大約平行地面', 'Upper arms about parallel to the floor'),
      P([0.53, 1], '推起', 'Press', '推返直', 'Press back up')
    ],
    mistakes: [M('落太深傷膊頭', 'Going too deep and straining the shoulders'), M('聳膊頭', 'Shrugging up')]
  },
  dip_chest: {
    period: 3.4, cam: { view: 'side', target: [0, 1.35, 0], dist: 3.6, phi: 0.12 },
    props: [{ type: 'dipbars', y: 1.36, x: 0.31 }],
    keys: loop([
      { t: 0, pel: [1.50, -0.10], trunk: 18, h: [0.31, 1.38, 0.04], ep: [0.6, 0, -1], fo: [0.07, -0.78, -0.30], fp: 35, kp: [0, 0, 1] },
      { t: 0.1, pel: [1.50, -0.10], trunk: 18 },
      { t: 0.45, pel: [1.21, -0.20], trunk: 34 },
      { t: 0.53, pel: [1.21, -0.20], trunk: 34 }
    ]),
    phases: [
      P([0, 0.1], '撐起', 'Top', '上身向前傾', 'Lean the torso forward'),
      P([0.1, 0.45], '落', 'Lower', '手肘略向外，感受胸肌拉伸', 'Elbows slightly out, feel the chest stretch'),
      P([0.45, 0.53], '最低點', 'Bottom', '上臂平行地面', 'Upper arms parallel to the floor'),
      P([0.53, 1], '推起', 'Press', '保持前傾推返上', 'Stay leaned forward as you press up')
    ],
    mistakes: [M('身體太直變咗三頭肌', 'Staying upright turns it into a triceps dip'), M('落太深', 'Going too deep')]
  },
  svend: {
    period: 3, cam: { view: 'q', target: [0, 1.1, 0], dist: 3 },
    props: [{ type: 'plate' }],
    keys: loop([
      { ...STAND, t: 0, ht: [0.035, 0.34, 0.20], ep: [0.6, -0.6, -0.2] },
      { t: 0.1, ht: [0.035, 0.34, 0.20] },
      { t: 0.45, h: [0.035, 1.30, 0.58] },
      { t: 0.55, h: [0.035, 1.30, 0.58] }
    ]),
    phases: [
      P([0, 0.1], '夾住', 'Squeeze', '兩手用力夾住槓片', 'Press the plates together hard'),
      P([0.1, 0.45], '推出', 'Press out', '一路夾一路向前推', 'Keep squeezing as you press forward'),
      P([0.45, 0.55], '停', 'Hold', '手伸直停一停', 'Hold at full extension'),
      P([0.55, 1], '收返', 'Return', '慢慢收返心口', 'Bring it back to the chest')
    ],
    mistakes: [M('冇夾實槓片', 'Not squeezing the plates')]
  },

  // ───────────── BACK ─────────────
  row_bb: {
    period: 3.2, cam: { view: 'q', target: [0, 0.8, 0], dist: 3.2 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { t: 0, pel: [0.86, -0.28], trunk: 65, f: [0.14, 0.08, 0], kp: [0.15, 0, 1], hs: [0.05, -0.6, 0.03], ep: [0.4, 1, -0.3] },
      { t: 0.1, hs: [0.05, -0.6, 0.03] },
      { t: 0.42, ht: [0.24, 0.18, 0.21] },
      { t: 0.52, ht: [0.24, 0.18, 0.21] }
    ]),
    phases: [
      P([0, 0.1], '屈髖', 'Hinge', '上身前傾約 45 度以上，背打平', 'Lean over 45° or more with a flat back'),
      P([0.1, 0.42], '拉', 'Row', '手肘向後拉，槓拉向肚', 'Drive the elbows back, bar to your belly'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊肩胛骨', 'Squeeze your shoulder blades'),
      P([0.52, 1], '放', 'Lower', '控制住伸直手', 'Lower until the arms are straight')
    ],
    mistakes: [M('用上身起伏借力', 'Heaving with the torso'), M('圓背', 'Rounding the back')]
  },
  seated_row: {
    period: 3.4, cam: { view: 'side', target: [0, 0.6, 0.2], dist: 3.2 },
    props: [{ type: 'box', w: 0.34, h: 0.4, d: 1.0, z: -0.15 }, { type: 'box', w: 0.5, h: 0.32, d: 0.06, z: 0.70, rx: -0.5 }, { type: 'cable', anchor: [0, 0.78, 1.35], handle: 'd' }],
    keys: loop([
      { t: 0, pel: [0.50, -0.05], trunk: 18, f: [0.15, 0.30, 0.64], fp: -45, kp: [0.3, 1, 0.5], h: [0.06, 0.80, 0.66], ep: [0.3, -0.3, -1] },
      { t: 0.1, pel: [0.50, -0.05], trunk: 18 },
      { t: 0.42, trunk: -4, ht: [0.11, 0.20, 0.17] },
      { t: 0.52, trunk: -4, ht: [0.11, 0.20, 0.17] }
    ]),
    phases: [
      P([0, 0.1], '伸展', 'Reach', '手伸直，背打直', 'Arms long, back straight'),
      P([0.1, 0.42], '拉', 'Row', '手肘貼身向後拉到肚', 'Elbows back along your sides to the belly'),
      P([0.42, 0.52], '夾', 'Squeeze', '心口挺起夾緊背', 'Chest up, squeeze the back'),
      P([0.52, 1], '放', 'Release', '慢慢伸返直', 'Let the arms extend slowly')
    ],
    mistakes: [M('上身前後大搖', 'Rocking the torso a lot'), M('聳膊頭', 'Shrugging')]
  },
  pulldown: {
    period: 3.4, cam: { view: 'q', target: [0, 1.15, 0], dist: 3.4, phi: 0.12 },
    props: [{ type: 'seat', y: 0.45, z: 0, pad: [0.66, 0.2] }, { type: 'bar', len: 1.2 }, { type: 'cable', anchor: [0, 2.5, 0.08], handle: 'none', towerDz: -0.78 }],
    keys: loop([
      { t: 0, pel: [0.55, 0], trunk: -8, f: [0.18, 0.08, 0.42], kp: [0.3, 0.4, 1], h: [0.45, 1.62, 0.06], ep: [1, -0.6, -0.2] },
      { t: 0.1, h: [0.45, 1.62, 0.06] },
      { t: 0.42, trunk: -14, h: [0.38, 1.16, 0.13] },
      { t: 0.52, trunk: -14, h: [0.38, 1.16, 0.13] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '大腿頂實墊，闊握', 'Thighs locked under the pad, wide grip'),
      P([0.1, 0.42], '拉', 'Pull', '手肘向下向後，拉到上胸', 'Elbows down and back, bar to the upper chest'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊背闊肌', 'Squeeze the lats'),
      P([0.52, 1], '放', 'Release', '慢慢放返上，手伸直', 'Let the bar rise until the arms are straight')
    ],
    mistakes: [M('身體向後瞓到太盡', 'Leaning back too far'), M('拉到頸後', 'Pulling behind the neck')]
  },
  pulldown_close: {
    period: 3.4, cam: { view: 'q', target: [0, 1.15, 0], dist: 3.4, phi: 0.12 },
    props: [{ type: 'seat', y: 0.45, z: 0, pad: [0.66, 0.2] }, { type: 'cable', anchor: [0, 2.5, 0.08], handle: 'd', towerDz: -0.78 }],
    keys: loop([
      { t: 0, pel: [0.55, 0], trunk: -8, f: [0.18, 0.08, 0.42], kp: [0.3, 0.4, 1], h: [0.06, 1.63, 0.10], ep: [0.4, -0.6, -0.3] },
      { t: 0.1, h: [0.06, 1.63, 0.10] },
      { t: 0.42, trunk: -15, h: [0.06, 1.14, 0.20] },
      { t: 0.52, trunk: -15, h: [0.06, 1.14, 0.20] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '窄握 V 柄', 'Close grip on the V-handle'),
      P([0.1, 0.42], '拉', 'Pull', '手肘貼身向下拉到胸口', 'Elbows close, pull down to the chest'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊背', 'Squeeze the back'),
      P([0.52, 1], '放', 'Release', '慢慢伸直', 'Extend slowly')
    ],
    mistakes: [M('用手臂拉', 'Pulling with the arms only'), M('身體搖晃', 'Swinging')]
  },
  pullup: {
    period: 3.6, cam: { view: 'q', target: [0, 1.6, 0], dist: 4.2, phi: 0.1 },
    props: [{ type: 'pullbar', y: 2.45, w: 1.4 }],
    keys: loop([
      { t: 0, pel: [1.32, -0.03], trunk: -5, h: [0.32, 2.42, 0.0], ep: [1, -0.5, -0.3], fo: [0.08, -0.78, -0.16], fp: 30, kp: [0, 0, 1] },
      { t: 0.1, pel: [1.32, -0.03], trunk: -5 },
      { t: 0.42, pel: [1.73, -0.08], trunk: -20, head: -20 },
      { t: 0.52, pel: [1.73, -0.08], trunk: -20, head: -20 }
    ]),
    phases: [
      P([0, 0.1], '吊住', 'Dead hang', '手比肩略闊，膊頭向下收', 'Hands a little wider than shoulders, shoulders set down'),
      P([0.1, 0.42], '拉', 'Pull', '手肘向下拉向肋骨', 'Drive the elbows down toward your ribs'),
      P([0.42, 0.52], '頂部', 'Top', '下巴過槓', 'Chin over the bar'),
      P([0.52, 1], '放', 'Lower', '慢慢放到手伸直', 'Lower slowly to straight arms')
    ],
    mistakes: [M('擺腳借力', 'Kipping or swinging'), M('只做半程', 'Half reps')]
  },
  pullover: {
    period: 3.4, cam: { view: 'side', target: [0, 1.15, 0.2], dist: 3.6, phi: 0.12 },
    props: [{ type: 'cable', anchor: [0, 2.3, 1.15], handle: 'bar', handleLen: 0.6 }],
    keys: loop([
      { t: 0, pel: [0.94, -0.12], trunk: 25, f: [0.13, 0.08, 0], kp: [0.15, 0, 1], h: [0.22, 1.76, 0.54], ep: [0.5, -0.2, -1] },
      { t: 0.1, h: [0.22, 1.76, 0.54] },
      { t: 0.27, h: [0.22, 1.36, 0.68] },
      { t: 0.45, h: [0.22, 0.88, 0.27] },
      { t: 0.55, h: [0.22, 0.88, 0.27] },
      { t: 0.8, h: [0.22, 1.36, 0.68] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手臂伸直，身體微微前傾', 'Arms straight, slight forward lean'),
      P([0.1, 0.45], '下壓', 'Sweep down', '手臂保持直，弧形壓到大腿', 'Keep arms straight, sweep down to your thighs'),
      P([0.45, 0.55], '夾', 'Squeeze', '夾緊背闊肌', 'Squeeze the lats'),
      P([0.55, 1], '返上', 'Return', '慢慢返上去', 'Return slowly')
    ],
    mistakes: [M('彎手變咗下壓', 'Bending the elbows into a pushdown')]
  },
  shrug: {
    period: 2.8, cam: { view: 'front', target: [0, 1.1, 0], dist: 3 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { ...STAND, t: 0, sh: 0, hs: [0.04, -0.61, 0.09] },
      { t: 0.15, sh: 0 },
      { t: 0.45, sh: 0.065 },
      { t: 0.58, sh: 0.065 }
    ]),
    phases: [
      P([0, 0.15], '準備', 'Set up', '手伸直揸住槓', 'Hold the bar with straight arms'),
      P([0.15, 0.45], '聳', 'Shrug', '膊頭垂直向耳仔方向升', 'Lift your shoulders straight up toward your ears'),
      P([0.45, 0.58], '停', 'Hold', '停一秒', 'Hold one second'),
      P([0.58, 1], '放', 'Lower', '慢慢放低', 'Lower slowly')
    ],
    mistakes: [M('轉膊頭', 'Rolling the shoulders'), M('用手臂拉', 'Bending the arms')]
  },

  // ───────────── SHOULDERS ─────────────
  ohp: {
    period: 3.8, cam: { view: 'q', target: [0, 1.25, 0], dist: 3.6, phi: 0.12 },
    props: [{ type: 'barbell' }],
    keys: loop([
      { ...STAND, t: 0, f: [0.14, 0.08, 0], h: [0.24, 1.40, 0.17], ep: [0.3, -1, 0.8] },
      { t: 0.1, h: [0.24, 1.40, 0.17] },
      { t: 0.3, head: -10, trunk: -3, h: [0.24, 1.70, 0.08], ep: [0.5, -0.6, 0.6] },
      { t: 0.48, head: 0, trunk: 0, h: [0.24, 2.03, 0.0], ep: [0.7, 0, 0.2] },
      { t: 0.58, h: [0.24, 2.03, 0.0], ep: [0.7, 0, 0.2] },
      { t: 0.8, head: -10, trunk: -3, h: [0.24, 1.70, 0.08], ep: [0.5, -0.6, 0.6] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Rack', '槓喺鎖骨前，手肘微微向前', 'Bar at the collarbone, elbows slightly forward'),
      P([0.1, 0.48], '推', 'Press', '頭稍向後讓位，槓直線向上', 'Tip the head back, press the bar straight up'),
      P([0.48, 0.58], '鎖定', 'Lockout', '槓喺頭頂正上方，頭向前穿過', 'Bar over the middle of your head, head through'),
      P([0.58, 1], '放', 'Lower', '控制住返到鎖骨', 'Lower back to the collarbone')
    ],
    mistakes: [M('腰向後彎', 'Arching the lower back'), M('槓向前推出', 'Pressing the bar forward')]
  },
  db_press: {
    period: 3.6, cam: { view: 'q', target: [0, 1.1, 0], dist: 3.3, phi: 0.15 },
    props: [{ type: 'seat', y: 0.45, z: -0.05, back: 0.7 }, { type: 'dumbbells', axis: 'x' }],
    keys: loop([
      { t: 0, pel: [0.55, -0.05], trunk: -4, f: [0.2, 0.08, 0.45], kp: [0.3, 0.4, 1], h: [0.37, 1.07, 0.03], ep: [1, -0.4, 0] },
      { t: 0.1, h: [0.37, 1.07, 0.03] },
      { t: 0.45, h: [0.16, 1.61, 0.0] },
      { t: 0.55, h: [0.16, 1.61, 0.0] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '啞鈴喺耳仔高度，背貼靠墊', 'Dumbbells at ear height, back on the pad'),
      P([0.1, 0.45], '推', 'Press', '向上推，頂部微微靠埋', 'Press up, bring them slightly together at the top'),
      P([0.45, 0.55], '頂部', 'Top', '手臂接近伸直', 'Arms nearly straight'),
      P([0.55, 1], '放', 'Lower', '控制住返到耳仔位', 'Lower back to ear height')
    ],
    mistakes: [M('腰離開靠墊', 'Arching off the pad'), M('落得太淺', 'Partial range')]
  },
  lateral: {
    period: 3.2, cam: { view: 'front', target: [0, 1.1, 0], dist: 3.3 },
    props: [{ type: 'dumbbells', axis: 'z' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.24, 0.84, 0.08], ep: [0.3, 0.3, -1] },
      { t: 0.1, h: [0.24, 0.84, 0.08] },
      { t: 0.27, h: [0.62, 1.0, 0.09], ep: [0.2, 0.4, -0.8] },
      { t: 0.45, h: [0.79, 1.35, 0.07], ep: [0, 0.5, -0.4] },
      { t: 0.55, h: [0.79, 1.35, 0.07], ep: [0, 0.5, -0.4] },
      { t: 0.8, h: [0.62, 1.0, 0.09], ep: [0.2, 0.4, -0.8] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '身體微微前傾，手肘微曲', 'Slight forward lean, soft elbows'),
      P([0.1, 0.45], '舉', 'Raise', '手肘帶頭向兩邊舉', 'Lead with the elbows out to the sides'),
      P([0.45, 0.55], '頂部', 'Top', '舉到膊頭高度就夠', 'Stop at shoulder height'),
      P([0.55, 1], '放', 'Lower', '慢慢放，唔好跌', 'Lower slowly')
    ],
    mistakes: [M('聳膊頭', 'Shrugging'), M('甩身借力', 'Swinging the body'), M('舉過膊頭太高', 'Lifting far above shoulder height')]
  },
  front_raise: {
    period: 3.2, cam: { view: 'side', target: [0, 1.1, 0], dist: 3.3 },
    props: [{ type: 'dumbbells', axis: 'x' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.22, 0.84, 0.10], ep: [0.3, -0.2, -1] },
      { t: 0.1, h: [0.22, 0.84, 0.10] },
      { t: 0.27, h: [0.22, 1.03, 0.44], ep: [0.3, -0.7, -0.7] },
      { t: 0.45, h: [0.22, 1.42, 0.60], ep: [0.3, -1, 0] },
      { t: 0.55, h: [0.22, 1.42, 0.60], ep: [0.3, -1, 0] },
      { t: 0.8, h: [0.22, 1.03, 0.44], ep: [0.3, -0.7, -0.7] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手肘微曲', 'Soft elbows'),
      P([0.1, 0.45], '舉', 'Raise', '向前舉到膊頭高度', 'Raise in front to shoulder height'),
      P([0.45, 0.55], '頂部', 'Top', '停一停', 'Pause'),
      P([0.55, 1], '放', 'Lower', '慢慢放', 'Lower slowly')
    ],
    mistakes: [M('身體向後瞓借力', 'Leaning back to swing it up')]
  },
  rear_fly: {
    period: 3.2, cam: { view: 'q', target: [0, 0.9, 0], dist: 3.2, phi: 0.35 },
    props: [{ type: 'dumbbells', axis: 'z' }],
    keys: loop([
      { t: 0, pel: [0.88, -0.30], trunk: 70, f: [0.14, 0.08, 0], kp: [0.15, 0, 1], hs: [0.04, -0.58, 0.06], ep: [0.4, 1, 0.2] },
      { t: 0.1, hs: [0.04, -0.58, 0.06] },
      { t: 0.45, ht: [0.74, 0.40, 0.02] },
      { t: 0.55, ht: [0.74, 0.40, 0.02] }
    ]),
    phases: [
      P([0, 0.1], '屈髖', 'Hinge', '上身前傾接近平行，背打平', 'Hinge until nearly parallel, flat back'),
      P([0.1, 0.45], '張開', 'Open', '手肘微曲向兩邊張開', 'Open the arms out wide with soft elbows'),
      P([0.45, 0.55], '夾', 'Squeeze', '夾緊後三角', 'Squeeze the rear delts'),
      P([0.55, 1], '放', 'Lower', '慢慢放返', 'Lower slowly')
    ],
    mistakes: [M('上身彈起', 'Torso bouncing up'), M('夾肩胛變咗划船', 'Turning it into a row')]
  },
  face_pull: {
    period: 3.2, cam: { view: 'q', target: [0, 1.3, 0.3], dist: 3.4, phi: 0.15 },
    props: [{ type: 'cable', anchor: [0, 1.65, 1.4], handle: 'rope' }],
    keys: loop([
      { ...STAND, t: 0, trunk: -3, f: [0.15, 0.08, 0], h: [0.08, 1.55, 0.62], ep: [1, 0.2, -0.4] },
      { t: 0.1, h: [0.08, 1.55, 0.62] },
      { t: 0.45, h: [0.30, 1.62, 0.10], ep: [1, 0.6, -0.4] },
      { t: 0.55, h: [0.30, 1.62, 0.10], ep: [1, 0.6, -0.4] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '滑輪喺眼睛高度，揸繩', 'Pulley at eye level, grab the rope'),
      P([0.1, 0.45], '拉', 'Pull', '拉向額頭，手肘高過手腕', 'Pull toward your forehead, elbows high'),
      P([0.45, 0.55], '外旋', 'Rotate', '拳頭向後轉，夾緊後肩', 'Rotate fists back, squeeze the rear shoulders'),
      P([0.55, 1], '放', 'Release', '慢慢伸返直', 'Extend slowly')
    ],
    mistakes: [M('手肘太低', 'Elbows too low'), M('身體向後瞓', 'Leaning back')]
  },
  upright_row: {
    period: 3.2, cam: { view: 'front', target: [0, 1.1, 0], dist: 3.2 },
    props: [{ type: 'barbell', len: 1.5, plate: 0.15 }],
    keys: loop([
      { ...STAND, t: 0, h: [0.12, 0.84, 0.12], ep: [1, 0.4, -0.3] },
      { t: 0.1, h: [0.12, 0.84, 0.12] },
      { t: 0.45, h: [0.14, 1.32, 0.16], ep: [1, 1, -0.2] },
      { t: 0.55, h: [0.14, 1.32, 0.16], ep: [1, 1, -0.2] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '窄握，槓貼身', 'Narrow grip, bar close to the body'),
      P([0.1, 0.45], '拉', 'Pull', '手肘向上向外帶', 'Lead with the elbows up and out'),
      P([0.45, 0.55], '頂部', 'Top', '手肘去到膊頭高度', 'Elbows reach shoulder height'),
      P([0.55, 1], '放', 'Lower', '慢慢放', 'Lower slowly')
    ],
    mistakes: [M('拉得太高夾到膊頭', 'Pulling so high it pinches the shoulders')]
  },

  // ───────────── ARMS ─────────────
  curl_bb: {
    period: 3, cam: { view: 'q', target: [0, 1.1, 0], dist: 3 },
    props: [{ type: 'barbell', len: 1.5, plate: 0.15 }],
    keys: loop([
      { ...STAND, t: 0, h: [0.21, 0.82, 0.05], ep: [0.1, -0.6, -1] },
      { t: 0.1, h: [0.21, 0.82, 0.05] },
      { t: 0.27, h: [0.21, 1.14, 0.33] },
      { t: 0.42, h: [0.21, 1.40, 0.19] },
      { t: 0.52, h: [0.21, 1.40, 0.19] },
      { t: 0.75, h: [0.21, 1.14, 0.33] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手肘貼住身兩側', 'Elbows pinned to your sides'),
      P([0.1, 0.42], '捲', 'Curl', '只係前臂郁，捲到胸前', 'Only the forearms move, curl to the chest'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊二頭肌', 'Squeeze the biceps'),
      P([0.52, 1], '放', 'Lower', '慢慢放到手伸直', 'Lower slowly to straight arms')
    ],
    mistakes: [M('甩身借力', 'Swinging the body'), M('手肘向前郁', 'Elbows drifting forward')]
  },
  curl_db: {
    period: 3, cam: { view: 'q', target: [0, 1.1, 0], dist: 3 },
    props: [{ type: 'dumbbells', axis: 'x' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.22, 0.82, 0.05], ep: [0.15, -0.6, -1] },
      { t: 0.1, h: [0.22, 0.82, 0.05] },
      { t: 0.27, h: [0.22, 1.14, 0.33] },
      { t: 0.42, h: [0.22, 1.40, 0.19] },
      { t: 0.52, h: [0.22, 1.40, 0.19] },
      { t: 0.75, h: [0.22, 1.14, 0.33] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '掌心向前，手肘貼身', 'Palms forward, elbows at your sides'),
      P([0.1, 0.42], '捲', 'Curl', '捲起時手腕微微向外轉', 'Turn the wrists out slightly as you curl'),
      P([0.42, 0.52], '夾', 'Squeeze', '頂部夾緊', 'Squeeze at the top'),
      P([0.52, 1], '放', 'Lower', '慢慢放', 'Lower slowly')
    ],
    mistakes: [M('甩身', 'Swinging'), M('落一半就再捲', 'Not straightening the arms')]
  },
  hammer: {
    period: 3, cam: { view: 'q', target: [0, 1.1, 0], dist: 3 },
    props: [{ type: 'dumbbells', axis: 'y' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.22, 0.82, 0.05], ep: [0.15, -0.6, -1] },
      { t: 0.1, h: [0.22, 0.82, 0.05] },
      { t: 0.27, h: [0.22, 1.14, 0.33] },
      { t: 0.42, h: [0.22, 1.40, 0.19] },
      { t: 0.52, h: [0.22, 1.40, 0.19] },
      { t: 0.75, h: [0.22, 1.14, 0.33] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '拇指向上（中立握）', 'Thumbs up (neutral grip)'),
      P([0.1, 0.42], '捲', 'Curl', '手肘固定，捲到膊頭前', 'Elbows fixed, curl to the front of your shoulder'),
      P([0.42, 0.52], '夾', 'Squeeze', '頂部夾緊', 'Squeeze at the top'),
      P([0.52, 1], '放', 'Lower', '慢慢放', 'Lower slowly')
    ],
    mistakes: [M('手肘向前', 'Elbows moving forward')]
  },
  pushdown: {
    period: 3, cam: { view: 'side', target: [0, 1.15, 0.1], dist: 3.2 },
    props: [{ type: 'cable', anchor: [0, 2.3, 0.45], handle: 'bar', handleLen: 0.4 }],
    keys: loop([
      { t: 0, pel: [0.95, -0.04], trunk: 10, f: [0.14, 0.08, 0], kp: [0.15, 0, 1], h: [0.12, 1.24, 0.29], ep: [0.15, -0.5, -1] },
      { t: 0.1, h: [0.12, 1.24, 0.29] },
      { t: 0.42, h: [0.12, 0.86, 0.17] },
      { t: 0.52, h: [0.12, 0.86, 0.17] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手肘貼身，身體微微前傾', 'Elbows tucked, slight forward lean'),
      P([0.1, 0.42], '壓', 'Push down', '只係前臂郁，壓到手伸直', 'Only the forearms move, press to straight arms'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊三頭肌', 'Squeeze the triceps'),
      P([0.52, 1], '返', 'Return', '慢慢返到 90 度', 'Return slowly to 90°')
    ],
    mistakes: [M('手肘離開身體', 'Elbows flaring away from the body'), M('用身體重量壓', 'Leaning your body weight into it')]
  },
  skull: {
    period: 3.4, cam: { view: 'side', target: [0, 0.75, -0.25], dist: 3, phi: 0.3 },
    props: [{ type: 'bench' }, { type: 'ezbar' }],
    keys: loop([
      { t: 0, pel: [0.55, 0.12], trunk: -90, f: [0.28, 0.08, 0.52], kp: [0.5, 1, 0.4], h: [0.13, 1.14, -0.30], ep: [0.15, 1, 0.4] },
      { t: 0.1, h: [0.13, 1.14, -0.30] },
      { t: 0.45, h: [0.13, 0.76, -0.55] },
      { t: 0.53, h: [0.13, 0.76, -0.55] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手臂垂直，或者微微向頭方向斜', 'Arms vertical or tilted slightly back'),
      P([0.1, 0.45], '落', 'Lower', '只屈手肘，槓落向額頭', 'Bend only the elbows, bar toward your forehead'),
      P([0.45, 0.53], '最低點', 'Bottom', '上臂唔郁', 'Upper arms stay still'),
      P([0.53, 1], '伸直', 'Extend', '用三頭肌推返直', 'Extend with the triceps')
    ],
    mistakes: [M('手肘向外張', 'Elbows flaring out'), M('上臂跟住郁', 'Upper arms moving too')]
  },
  overhead_tri: {
    period: 3.2, cam: { view: 'side', target: [0, 1.4, 0], dist: 3.6, phi: 0.12 },
    props: [{ type: 'dumbbell1', axis: 'y' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.04, 2.02, 0.02], ep: [0.3, 1, 0.5] },
      { t: 0.1, h: [0.04, 2.02, 0.02] },
      { t: 0.45, h: [0.04, 1.58, -0.20] },
      { t: 0.53, h: [0.04, 1.58, -0.20] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '雙手揸啞鈴舉過頭', 'Hold the dumbbell overhead with both hands'),
      P([0.1, 0.45], '落', 'Lower', '手肘指天，啞鈴落到頭後', 'Elbows point up, lower behind your head'),
      P([0.45, 0.53], '拉伸', 'Stretch', '感受三頭肌拉伸', 'Feel the triceps stretch'),
      P([0.53, 1], '伸直', 'Extend', '推返上去', 'Press back up')
    ],
    mistakes: [M('手肘向外張開', 'Elbows flaring wide'), M('腰向後彎', 'Arching the back')]
  },
  kickback: {
    period: 3, cam: { view: 'side', target: [0, 0.85, -0.1], dist: 3 },
    props: [{ type: 'dumbbells', axis: 'y' }],
    keys: loop([
      { t: 0, pel: [0.88, -0.30], trunk: 70, f: [0.14, 0.08, 0], kp: [0.15, 0, 1], h: [0.20, 0.66, -0.12], ep: [0.1, 1, 0.2] },
      { t: 0.1, h: [0.20, 0.66, -0.12] },
      { t: 0.42, h: [0.20, 0.92, -0.43], ep: [0.1, 1, 0] },
      { t: 0.52, h: [0.20, 0.92, -0.43], ep: [0.1, 1, 0] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '上身前傾，上臂貼身平行地面', 'Lean over, upper arm along your side'),
      P([0.1, 0.42], '伸', 'Kick back', '只係前臂向後伸直', 'Only the forearm moves back'),
      P([0.42, 0.52], '夾', 'Squeeze', '夾緊三頭肌', 'Squeeze the triceps'),
      P([0.52, 1], '返', 'Return', '慢慢返到 90 度', 'Return slowly to 90°')
    ],
    mistakes: [M('上臂跌落嚟', 'Upper arm dropping'), M('甩手借力', 'Swinging the weight')]
  },

  // ───────────── CORE ─────────────
  plank: {
    period: 4, cam: { view: 'side', target: [0, 0.3, 0], dist: 3, phi: 0.18 },
    props: [{ type: 'mat' }],
    keys: loop([
      { t: 0, ...line(0.36, 0.30), fp: 72, kp: [0, -1, 0], h: [0.10, 0.06, 0.62], ep: [0.2, -1, 0], head: -5 },
      { t: 0.5, ...line(0.375, 0.30) }
    ]),
    phases: [
      P([0, 0.5], '撐住', 'Hold', '手肘喺膊頭正下面，頭到腳一直線', 'Elbows under shoulders, straight line head to heels'),
      P([0.5, 1], '收緊', 'Brace', '夾臀、收腹，正常呼吸', 'Squeeze glutes, brace abs, keep breathing')
    ],
    mistakes: [M('腰向下塌', 'Hips sagging'), M('屁股翹太高', 'Hips piked up'), M('閉氣', 'Holding your breath')]
  },
  crunch: {
    hand: 'open',
    period: 3, cam: { view: 'side', target: [0, 0.3, 0], dist: 2.9, phi: 0.25 },
    props: [{ type: 'mat' }],
    keys: loop([
      { t: 0, pel: [0.12, 0.05], trunk: -90, lumbar: 0, f: [0.14, 0.08, 0.48], kp: [0.2, 1, 0.3], ht: [0.10, 0.64, -0.08], ep: [1, 0, 0] },
      { t: 0.12, lumbar: 0 },
      { t: 0.45, lumbar: 34 },
      { t: 0.55, lumbar: 34 }
    ]),
    phases: [
      P([0, 0.12], '準備', 'Set up', '屈膝，手輕輕扶頭', 'Knees bent, hands lightly behind the head'),
      P([0.12, 0.45], '捲', 'Crunch', '用腹肌將膊頭捲離地面', 'Curl your shoulders off the floor with your abs'),
      P([0.45, 0.55], '頂部', 'Top', '呼氣夾緊腹肌', 'Exhale and squeeze'),
      P([0.55, 1], '放', 'Lower', '慢慢放返落去', 'Lower slowly')
    ],
    mistakes: [M('用手拉頸', 'Pulling on your neck'), M('坐成個起身', 'Sitting all the way up')]
  },
  leg_raise: {
    hand: 'open',
    period: 3.4, cam: { view: 'side', target: [0, 0.35, 0.1], dist: 3, phi: 0.25 },
    props: [{ type: 'mat' }],
    keys: loop([
      // feet travel on an arc around the hip so the legs stay straight; knees face the head side of the leg (never sideways)
      { t: 0, pel: [0.12, 0], trunk: -90, f: [0.08, 0.14, 0.875], fp: 25, kp: [0, 1.00, -0.03], h: [0.25, 0.05, 0.05], ep: [0, 1, 0] },
      { t: 0.1, f: [0.08, 0.143, 0.875], kp: [0, 1.00, -0.03] },
      { t: 0.22, f: [0.08, 0.557, 0.758], kp: [0, 0.87, -0.50] },
      { t: 0.34, f: [0.08, 0.862, 0.464], kp: [0, 0.53, -0.85] },
      { t: 0.45, f: [0.08, 0.993, 0.061], kp: [0, 0.07, -1.00] },
      { t: 0.55, f: [0.08, 0.993, 0.061], kp: [0, 0.07, -1.00] },
      { t: 0.68, f: [0.08, 0.862, 0.464], kp: [0, 0.53, -0.85] },
      { t: 0.8, f: [0.08, 0.557, 0.758], kp: [0, 0.87, -0.50] },
      { t: 0.92, f: [0.08, 0.211, 0.870], kp: [0, 0.99, -0.10] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '下背壓實地面，腳離地少少', 'Lower back pressed down, feet just off the floor'),
      P([0.1, 0.45], '舉', 'Raise', '直腳舉到 90 度', 'Lift straight legs to 90°'),
      P([0.45, 0.55], '頂部', 'Top', '停一停', 'Pause'),
      P([0.55, 1], '放', 'Lower', '慢慢放，下背唔好拱起', 'Lower slowly without arching the lower back')
    ],
    mistakes: [M('下背拱起', 'Lower back arching off the floor'), M('用衝力甩腳', 'Swinging the legs')]
  },
  cable_crunch: {
    period: 3.2, cam: { view: 'side', target: [0, 0.75, 0.1], dist: 3.2 },
    props: [{ type: 'cable', anchor: [0, 2.3, 0.35], handle: 'rope' }],
    keys: loop([
      { t: 0, pel: [0.52, -0.22], trunk: 10, lumbar: 0, head: 8, f: [0.12, 0.08, -0.64], fp: 80, kp: [0, -1, 0.3], ht: [0.1, 0.62, 0.1], ep: [0.4, -1, 0.3] },
      { t: 0.1, lumbar: 0 },
      { t: 0.45, trunk: 20, lumbar: 48, head: 18 },
      { t: 0.55, trunk: 20, lumbar: 48, head: 18 }
    ]),
    phases: [
      P([0, 0.1], '跪低', 'Kneel', '繩放喺頭兩側', 'Rope beside your head'),
      P([0.1, 0.45], '捲', 'Crunch', '用腹肌將手肘捲向膝蓋', 'Curl elbows toward your knees with the abs'),
      P([0.45, 0.55], '夾', 'Squeeze', '呼氣夾緊', 'Exhale and squeeze'),
      P([0.55, 1], '返', 'Return', '慢慢伸返', 'Uncurl slowly')
    ],
    mistakes: [M('用臀部坐落', 'Sitting back with the hips'), M('用手拉', 'Pulling with the arms')]
  },
  russian_twist: {
    period: 3, cam: { view: 'front', target: [0, 0.4, 0.1], dist: 2.9, phi: 0.3 },
    props: [{ type: 'mat' }, { type: 'plate', face: 'body' }],
    keys: loop([
      { t: 0, pel: [0.13, 0], trunk: -40, yaw: -35, f: [0.13, 0.2, 0.6], kp: [0, 1, 0.3], ht: [0.0, 0.36, 0.25], ep: [0.6, -0.6, 0.2] },
      { t: 0.5, yaw: 35 }
    ]),
    phases: [
      P([0, 0.5], '轉左', 'Twist left', '上身後傾，用腹斜肌轉', 'Lean back, rotate with your obliques'),
      P([0.5, 1], '轉右', 'Twist right', '眼跟住手，腳唔好郁', 'Eyes follow the hands, legs stay still')
    ],
    mistakes: [M('只係郁手', 'Only moving the arms'), M('圓背', 'Rounding the back')]
  },
  dead_bug: {
    hand: 'open',
    period: 4.4, cam: { view: 'q', target: [0, 0.35, 0], dist: 3, phi: 0.45 },
    props: [{ type: 'mat' }],
    keys: loop([
      { t: 0, pel: [0.12, 0], trunk: -90, h: [0.19, 0.72, -0.46], ep: [0.4, 0, 1], f: [0.11, 0.56, 0.44], kp: [0, 1, 0] },
      { t: 0.25, hL: [0.19, 0.16, -1.08], fR: [-0.11, 0.18, 0.86] },
      { t: 0.5, hL: [0.19, 0.72, -0.46], fR: [-0.11, 0.56, 0.44] },
      { t: 0.75, hR: [-0.19, 0.16, -1.08], fL: [0.11, 0.18, 0.86] }
    ]),
    phases: [
      P([0, 0.25], '左手右腳', 'Left arm, right leg', '對側手腳一齊伸，下背壓實地', 'Extend the opposite arm and leg, lower back stays down'),
      P([0.25, 0.5], '收返', 'Return', '慢慢收返中間', 'Bring them back to centre'),
      P([0.5, 0.75], '右手左腳', 'Right arm, left leg', '換邊', 'Switch sides'),
      P([0.75, 1], '收返', 'Return', '保持呼吸', 'Keep breathing')
    ],
    mistakes: [M('下背拱起', 'Lower back arching'), M('郁得太快', 'Moving too fast')]
  },
  hollow: {
    hand: 'open',
    period: 4, cam: { view: 'side', target: [0, 0.3, 0], dist: 3, phi: 0.2 },
    props: [{ type: 'mat' }],
    keys: loop([
      { t: 0, pel: [0.12, 0], trunk: -72, h: [0.12, 0.46, -1.04], ep: [0.3, 1, 0], f: [0.1, 0.30, 0.86], fp: 20, kp: [0, 1, 0] },
      { t: 0.5, trunk: -74, f: [0.1, 0.27, 0.86] }
    ]),
    phases: [
      P([0, 0.5], '撐住', 'Hold', '下背壓實地，手腳伸直離地', 'Lower back glued down, arms and legs off the floor'),
      P([0.5, 1], '呼吸', 'Breathe', '似香蕉咁，保持呼吸', 'Make a banana shape and keep breathing')
    ],
    mistakes: [M('下背離地', 'Lower back lifting'), M('閉氣', 'Holding your breath')]
  },
  pallof: {
    period: 3.2, cam: { view: 'q', target: [0, 1.0, 0], dist: 3.4 },
    props: [{ type: 'cable', anchor: [-1.3, 1.2, 0.15], handle: 'd', towerDz: 0, towerDx: -0.1 }],
    keys: loop([
      { t: 0, pel: [0.94, 0], trunk: 0, f: [0.18, 0.08, 0], kp: [0.3, 0, 1], ht: [0.03, 0.34, 0.20], ep: [0.4, -1, 0] },
      { t: 0.1, ht: [0.03, 0.34, 0.20] },
      { t: 0.45, h: [0.03, 1.22, 0.62] },
      { t: 0.6, h: [0.03, 1.22, 0.62] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '側身對住滑輪，手揸把手喺胸前', 'Side-on to the pulley, handle at your chest'),
      P([0.1, 0.45], '推出', 'Press out', '推出去時身體唔好俾條繩拉轉', 'Press out without letting the cable twist you'),
      P([0.45, 0.6], '撐住', 'Hold', '收緊腹部對抗旋轉', 'Brace your core against the rotation'),
      P([0.6, 1], '收返', 'Return', '慢慢收返心口', 'Bring it back to the chest')
    ],
    mistakes: [M('身體被拉轉', 'Torso twisting toward the pulley')]
  },
  woodchop: {
    period: 3.2, cam: { view: 'front', target: [0, 1.05, 0], dist: 3.6 },
    props: [{ type: 'cable', anchor: [-1.1, 2.1, 0.2], handle: 'd', towerDz: 0, towerDx: -0.1 }],
    keys: loop([
      { t: 0, pel: [0.92, 0], trunk: 4, yaw: -55, head: 6, f: [0.22, 0.08, 0], kp: [0.4, 0, 1], hL: [-0.6, 1.56, 0.2], hR: [-0.68, 1.53, 0.12], ep: [0.5, -0.5, 0] },
      { t: 0.1, yaw: -55 },
      { t: 0.45, pel: [0.88, 0], trunk: 14, yaw: 38, hL: [0.48, 0.76, 0.32], hR: [0.40, 0.78, 0.36] },
      { t: 0.55, pel: [0.88, 0], trunk: 14, yaw: 38, hL: [0.48, 0.76, 0.32], hR: [0.40, 0.78, 0.36] }
    ]),
    phases: [
      P([0, 0.1], '準備', 'Set up', '手揸高位把手，雙手伸直', 'Hands on the high handle, arms straight'),
      P([0.1, 0.45], '斬落', 'Chop', '用上身轉動，斜斜拉到對側膝蓋', 'Rotate the torso, pull across to the opposite knee'),
      P([0.45, 0.55], '底部', 'Bottom', '後腳跟住轉', 'Let the back foot pivot'),
      P([0.55, 1], '返', 'Return', '控制住返上去', 'Return with control')
    ],
    mistakes: [M('只用手拉', 'Pulling with the arms only'), M('圓背', 'Rounding the back')]
  },
  ab_wheel: {
    period: 4, cam: { view: 'side', target: [0, 0.35, 0.4], dist: 3.2, phi: 0.2 },
    props: [{ type: 'mat' }, { type: 'wheel' }],
    keys: loop([
      { t: 0, pel: [0.48, 0.02], trunk: 50, f: [0.12, 0.08, -0.40], fp: 80, kp: [0, -1, 0.3], h: [0.12, 0.17, 0.42], ep: [0.2, -0.5, -1] },
      { t: 0.12, pel: [0.48, 0.02], trunk: 50, h: [0.12, 0.17, 0.42] },
      { t: 0.5, pel: [0.30, 0.32], trunk: 82, h: [0.12, 0.17, 1.30] },
      { t: 0.6, pel: [0.30, 0.32], trunk: 82, h: [0.12, 0.17, 1.30] }
    ]),
    phases: [
      P([0, 0.12], '跪定', 'Kneel', '手喺膊頭下，收腹', 'Hands under shoulders, abs braced'),
      P([0.12, 0.5], '推出', 'Roll out', '慢慢向前碌，腰唔好塌', 'Roll forward slowly without letting the hips sag'),
      P([0.5, 0.6], '最遠', 'Extended', '去到控制到嘅最遠位', 'Go only as far as you can control'),
      P([0.6, 1], '拉返', 'Pull back', '用腹肌拉返嚟', 'Pull back with your abs')
    ],
    mistakes: [M('腰向下塌', 'Hips sagging'), M('碌得太遠失控', 'Rolling out further than you can control')]
  },

  // ───────────── CARDIO (procedural) ─────────────
  walk: {
    period: 1.3, cam: { view: 'side', target: [0, 0.9, 0], dist: 3.6 },
    props: [{ type: 'treadmill', z: -0.05 }],
    fn(t) {
      const a = t * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const lift = q => Math.max(0, q) * 0.07;
      return {
        pel: [1.055 + 0.012 * Math.cos(2 * a), 0], trunk: 3,
        fL: [0.11, 0.19 + lift(c), 0.24 * s], fR: [-0.11, 0.19 + lift(-c), -0.24 * s], fp: 0,
        hsL: [0.02, -0.6, -0.16 * s], hsR: [-0.02, -0.6, 0.16 * s], ep: [0.2, -0.3, -1], kp: [0.1, 0, 1]
      };
    },
    phases: [P([0, 1], '行', 'Walk', '企直，腳跟先著地，手自然擺', 'Stand tall, land heel first, swing the arms naturally')],
    mistakes: [M('揸住扶手', 'Holding on to the handrails'), M('彎腰', 'Hunching over')]
  },
  run: {
    period: 0.75, cam: { view: 'side', target: [0, 0.95, 0], dist: 3.6 },
    props: [{ type: 'treadmill', z: -0.05 }],
    fn(t) {
      const a = t * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const leg = (ph) => { const ss = Math.sin(ph), cc = Math.cos(ph); return [0.32 * ss, 0.19 + Math.max(0, cc) * 0.30 * (0.5 - 0.5 * ss) + Math.max(0, cc) * 0.06]; };
      const L = leg(a), R = leg(a + Math.PI);
      return {
        pel: [1.02 + 0.035 * Math.abs(Math.cos(a)), 0], trunk: 9,
        fL: [0.10, L[1], L[0]], fR: [-0.10, R[1], R[0]], fpL: -10 + 25 * Math.max(0, c), fpR: -10 + 25 * Math.max(0, -c),
        hsL: [0.05, -0.43 - 0.06 * s, 0.11 - 0.13 * s], hsR: [-0.05, -0.43 + 0.06 * s, 0.11 + 0.13 * s], ep: [0.1, -0.5, -1], kp: [0.1, 0, 1]
      };
    },
    phases: [P([0, 1], '跑', 'Run', '細步快頻，腳掌中段著地，手肘 90 度', 'Short quick steps, land mid-foot, elbows at 90°')],
    mistakes: [M('腳踭重重踩落', 'Heavy heel strike'), M('步幅太大', 'Overstriding')]
  },
  bike: {
    period: 1.1, cam: { view: 'side', target: [0, 0.8, 0.2], dist: 3.4 },
    props: [{ type: 'bike', cy: 0.34, cz: 0.12, seatY: 0.86 }],
    fn(t) {
      const a = -t * Math.PI * 2;
      return {
        pel: [0.93, -0.14], trunk: 30, h: [0.22, 1.07, 0.56], ep: [0.4, -1, -0.2],
        fL: [0.12, 0.34 + 0.17 * Math.sin(a), 0.12 + 0.17 * Math.cos(a)], fR: [-0.12, 0.34 - 0.17 * Math.sin(a), 0.12 - 0.17 * Math.cos(a)],
        fp: 10, kp: [0.12, 0.2, 1]
      };
    },
    phases: [P([0, 1], '踩', 'Pedal', '座位高度令腳喺最低點仲有少少屈', 'Seat high enough that the knee is slightly bent at the bottom')],
    mistakes: [M('座位太低', 'Seat too low'), M('上身左右搖', 'Rocking side to side')]
  },
  rower: {
    period: 3, cam: { view: 'side', target: [0, 0.55, 0.15], dist: 3.6 },
    props: [{ type: 'rower' }],
    keys: loop([
      { t: 0, pel: [0.40, 0.13], trunk: 28, f: [0.12, 0.27, 0.58], fp: -38, kp: [0.15, 0.4, 1], h: [0.14, 0.70, 0.92], ep: [0.3, -0.5, -1] },
      { t: 0.22, pel: [0.40, -0.18], trunk: 20, h: [0.14, 0.72, 0.62] },
      { t: 0.32, pel: [0.40, -0.29], trunk: -18, h: [0.14, 0.76, 0.30] },
      { t: 0.42, pel: [0.40, -0.29], trunk: -20, ht: [0.18, 0.30, 0.17] },
      { t: 0.55, pel: [0.40, -0.29], trunk: -18, h: [0.14, 0.76, 0.30] },
      { t: 0.68, pel: [0.40, -0.26], trunk: 22, h: [0.14, 0.72, 0.60] }
    ]),
    phases: [
      P([0, 0.22], '腳推', 'Legs', '先用腳推，手保持直', 'Push with the legs first, arms stay straight'),
      P([0.22, 0.32], '後擺', 'Swing', '上身向後擺', 'Swing the torso back'),
      P([0.32, 0.42], '手拉', 'Arms', '最後先用手拉到肋骨下', 'Finish by pulling the handle to your lower ribs'),
      P([0.42, 1], '回位', 'Recover', '手→身→腳，順序返去', 'Arms, then body, then legs on the way back')
    ],
    mistakes: [M('一開始就用手拉', 'Pulling with the arms first'), M('圓背', 'Rounding the back')]
  },
  jump_rope: {
    period: 0.5, cam: { view: 'q', target: [0, 0.95, 0], dist: 3.6 },
    props: [{ type: 'jumprope', turns: 1 }],
    fn(t) {
      const hop = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.07;
      const a = t * Math.PI * 2;
      return {
        pel: [0.95 + hop, 0], trunk: 3, f: [0.11, 0.09 + hop, 0], fp: hop > 0.02 ? 18 : 6,
        hsL: [0.14 + 0.03 * Math.cos(a), -0.44, 0.08 + 0.03 * Math.sin(a)], hsR: [-0.14 - 0.03 * Math.cos(a), -0.44, 0.08 + 0.03 * Math.sin(a)], ep: [0.2, -0.6, -1], kp: [0.1, 0, 1]
      };
    },
    phases: [P([0, 1], '跳', 'Skip', '手肘貼身，用手腕轉繩，前腳掌輕輕落地', 'Elbows close, turn the rope with the wrists, land softly on the balls of your feet')],
    mistakes: [M('跳得太高', 'Jumping too high'), M('用成隻手臂轉', 'Turning with the whole arm')]
  },
  box_jump: {
    period: 3.2, cam: { view: 'side', target: [0, 0.9, 0.35], dist: 4 },
    props: [{ type: 'box', w: 0.6, h: 0.5, d: 0.5, z: 0.8 }],
    keys: loop([
      { ...STAND, t: 0, f: [0.13, 0.08, 0], hs: [0.02, -0.6, 0.04], ep: [0.2, -0.3, -1] },
      { t: 0.12, pel: [0.70, -0.12], trunk: 34, hs: [0.04, -0.52, -0.32] },
      { t: 0.24, pel: [1.32, 0.30], trunk: 10, f: [0.13, 0.62, 0.42], hs: [0.04, 0.2, 0.42] },
      { t: 0.34, pel: [1.10, 0.66], trunk: 30, f: [0.13, 0.58, 0.82], hs: [0.04, -0.45, 0.30] },
      { t: 0.5, pel: [1.46, 0.80], trunk: 2, f: [0.13, 0.58, 0.82], hs: [0.02, -0.6, 0.04] },
      { t: 0.62, pel: [1.46, 0.80], trunk: 2, f: [0.13, 0.58, 0.82] },
      { t: 0.75, pel: [1.18, 0.40], trunk: 8, fL: [0.13, 0.58, 0.82], fR: [-0.13, 0.22, 0.25] },
      { t: 0.88, pel: [0.96, 0.02], trunk: 2, f: [0.13, 0.08, 0] }
    ]),
    phases: [
      P([0, 0.12], '蹲低擺手', 'Load', '手向後擺，臀部向後', 'Swing the arms back, hips back'),
      P([0.12, 0.34], '跳', 'Jump', '手向上擺，爆發跳上', 'Swing the arms up and explode'),
      P([0.34, 0.62], '輕落', 'Land softly', '半蹲落地，膝蓋向外', 'Land softly in a half squat, knees out'),
      P([0.62, 1], '行落', 'Step down', '一隻腳一隻腳行落，唔好跳落', 'Step down one foot at a time')
    ],
    mistakes: [M('落地膝蓋內夾', 'Knees caving on landing'), M('跳落嚟', 'Jumping back down')]
  },
  battle_ropes: {
    period: 0.8, cam: { view: 'q', target: [0, 0.8, 0.6], dist: 4 },
    props: [{ type: 'ropes', anchor: [0, 0.25, 2.6] }],
    fn(t) {
      const a = t * Math.PI * 2;
      return {
        pel: [0.72, -0.12], trunk: 22, f: [0.22, 0.08, 0], fy: 15, kp: [0.4, 0, 1],
        hL: [0.16, 0.92 + 0.17 * Math.sin(a), 0.48], hR: [-0.16, 0.92 - 0.17 * Math.sin(a), 0.48], ep: [0.3, -1, -0.3]
      };
    },
    phases: [P([0, 1], '甩', 'Waves', '半蹲，核心收緊，左右手交替快速上下', 'Half squat, brace, alternate the arms fast')],
    mistakes: [M('企得太直', 'Standing too upright'), M('用腰出力', 'Swinging from the lower back')]
  },
  sled: {
    period: 0.9, cam: { view: 'side', target: [0, 0.7, 0.3], dist: 3.8 },
    props: [{ type: 'sled' }],
    fn(t) {
      const a = t * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      return {
        pel: [0.72, -0.05], trunk: 55, h: [0.22, 1.0, 0.95], ep: [0.4, -1, -0.3],
        fL: [0.12, 0.10 + Math.max(0, c) * 0.14, -0.30 + 0.32 * s], fR: [-0.12, 0.10 + Math.max(0, -c) * 0.14, -0.30 - 0.32 * s], fp: 20, kp: [0.1, 0, 1]
      };
    },
    phases: [P([0, 1], '推', 'Drive', '身體前傾一直線，用前腳掌細步推', 'Lean in with a straight line, drive with short steps on the balls of your feet')],
    mistakes: [M('臀部翹太高', 'Hips too high'), M('步幅太大', 'Overstriding')]
  }
};


// ───────────── dedicated moves for exercises that used to borrow a similar one ─────────────
const PH4 = (a, b, c, d) => [P([0, 0.1], ...a), P([0.1, 0.45], ...b), P([0.45, 0.55], ...c), P([0.55, 1], ...d)];
const curlKeys = (bot, mid, top, ex = {}) => loop([
  { ...STAND, t: 0, h: bot, ...ex }, { t: 0.1, h: bot }, { t: 0.27, h: mid }, { t: 0.42, h: top }, { t: 0.52, h: top }, { t: 0.75, h: mid }
]);
const SUP = [[0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 0.6, -0.8], [0, 0.6, -0.8], [0, 1, 0], [0, 0, 1]];
const withPn = (keys, pns) => { keys.forEach((k, i) => { k.pn = pns[i]; }); return keys; };
const CURL_PH = PH4(
  ['準備', 'Set up', '上臂固定唔郁', 'Upper arms stay fixed'], ['捲', 'Curl', '只用前臂捲起', 'Curl with the forearms only'],
  ['夾', 'Squeeze', '頂部夾緊二頭肌', 'Squeeze the biceps at the top'], ['放', 'Lower', '慢慢放到手伸直', 'Lower slowly to straight arms']);

Object.assign(MOVES, {
  machine_press: {
    period: 3.6, cam: { view: 'q', target: [0, 1.0, 0.1], dist: 3.4, phi: 0.2 },
    props: [{ type: 'seat', y: 0.45, z: -0.02, back: 0.75, backTilt: 15 }, { type: 'machine', pivot: [0.56, 1.06, -0.12] }],
    keys: loop([
      { t: 0, pel: [0.55, -0.02], trunk: -15, f: [0.2, 0.08, 0.45], kp: [0.3, 0.4, 1], h: [0.31, 1.0, 0.14], ep: [1, -0.6, -0.1], pn: [0, -0.3, 1] },
      { t: 0.1, h: [0.31, 1.0, 0.14] }, { t: 0.45, h: [0.21, 1.1, 0.6] }, { t: 0.55, h: [0.21, 1.1, 0.6] }
    ]),
    phases: PH4(['準備', 'Set up', '把手對住上胸，背貼實靠墊', 'Handles level with your upper chest, back on the pad'], ['推', 'Press', '向上向前推出', 'Press up and forward'],
      ['頂部', 'Top', '手臂接近伸直，夾緊上胸', 'Arms nearly straight, squeeze the upper chest'], ['放', 'Return', '慢慢返到胸前', 'Return slowly to the chest']),
    mistakes: [M('膊頭向前推離開靠墊', 'Shoulders rolling forward off the pad'), M('手肘升得太高', 'Elbows flared too high')]
  },
  decline: {
    period: 3.8, cam: { view: 'q', target: [0, 0.8, -0.1], dist: 3.3, phi: 0.3 },
    props: [{ type: 'pad', at: [0, 0.56, -0.2], len: 1.25, rx: -0.26 }, { type: 'kneepad', y: 0.78, z: 0.68 }, { type: 'barbell', noPlatform: true }],
    keys: loop([
      { t: 0, pel: [0.74, 0.08], trunk: -105, f: [0.14, 0.6, 0.74], fp: -30, kp: [0.2, 1, 0.2], h: [0.30, 1.2, -0.30], ep: [1, -0.6, 0.3], pn: [0, 0, 1] },
      { t: 0.1, h: [0.30, 1.2, -0.30] }, { t: 0.45, ht: [0.30, 0.30, 0.18] }, { t: 0.53, ht: [0.30, 0.30, 0.18] }, { t: 0.8, h: [0.30, 1.2, -0.30] }
    ]),
    phases: PH4(['準備', 'Set up', '腳勾實腳墊，頭低過臀', 'Hook your feet, head lower than hips'], ['落槓', 'Lower', '槓落向下胸', 'Lower the bar to your lower chest'],
      ['觸胸', 'Touch', '輕觸下胸', 'Light touch on the lower chest'], ['推起', 'Press', '推返到肩膊正上方', 'Press back over the shoulders']),
    mistakes: [M('槓落得太高去到頸', 'Lowering the bar toward the neck'), M('槓喺胸口彈', 'Bouncing the bar')]
  },
  row_db: {
    period: 3.2, cam: { view: 'qR', target: [0, 0.75, -0.1], dist: 3.2, phi: 0.25 },
    props: [{ type: 'bench', y: 0.45, z0: -0.85, z1: 0.5, x: 0.13 }, { type: 'dumbbells', hand: 'R' }],
    keys: loop([
      { t: 0, pel: [0.92, -0.25], trunk: 80, hL: [0.2, 0.49, 0.3], epL: [0.4, -0.3, -1], fL: [0.1, 0.52, -0.66], fpL: 80, kpL: [0, -1, 0], fR: [-0.28, 0.08, -0.1], kpR: [-0.3, 0, 1], hsR: [-0.02, -0.6, 0.02], epR: [-0.3, 1, -0.3] },
      { t: 0.1, hsR: [-0.02, -0.6, 0.02] }, { t: 0.42, htR: [-0.22, 0.12, 0.2] }, { t: 0.52, htR: [-0.22, 0.12, 0.2] }
    ]),
    phases: PH4(['準備', 'Set up', '一手一膝撐凳，背打平', 'One hand and knee on the bench, flat back'], ['拉', 'Row', '手肘貼身拉向腰', 'Drive the elbow back to your hip'],
      ['夾', 'Squeeze', '夾緊背闊肌', 'Squeeze the lat'], ['放', 'Lower', '慢慢伸直手', 'Lower until the arm is straight']),
    mistakes: [M('轉身借力', 'Twisting the torso to lift'), M('拉去心口而唔係腰', 'Pulling to the chest instead of the hip')]
  },
  tbar: {
    period: 3.2, cam: { view: 'q', target: [0, 0.75, 0], dist: 3.4 },
    props: [{ type: 'landmine', z: -1.7 }],
    keys: loop([
      { t: 0, pel: [0.84, -0.22], trunk: 52, f: [0.2, 0.08, -0.05], fy: 14, kp: [0.3, 0, 1], h: [0.05, 0.55, 0.22], ep: [0.5, 1, -0.3] },
      { t: 0.1, h: [0.05, 0.55, 0.22] }, { t: 0.42, ht: [0.05, 0.17, 0.2] }, { t: 0.52, ht: [0.05, 0.17, 0.2] }
    ]),
    phases: PH4(['屈髖', 'Hinge', '跨住條槓，背打平', 'Straddle the bar, flat back'], ['拉', 'Row', '手肘向後拉到肚', 'Elbows back, handle to your belly'],
      ['夾', 'Squeeze', '夾緊肩胛骨', 'Squeeze the shoulder blades'], ['放', 'Lower', '控制住伸直手', 'Lower with control']),
    mistakes: [M('上身起伏借力', 'Heaving with the torso'), M('圓背', 'Rounding the back')]
  },
  row_chest: {
    period: 3.2, cam: { view: 'side', target: [0, 0.75, 0], dist: 3.3 },
    props: [{ type: 'pad', at: [0, 0.82, -0.06], len: 0.85, rx: -0.61 }, { type: 'dumbbells' }],
    keys: loop([
      { t: 0, pel: [0.78, -0.40], trunk: 55, f: [0.13, 0.08, -0.6], kp: [0.15, 0, 1], hs: [0.03, -0.6, 0.02], ep: [0.3, 1, -0.5] },
      { t: 0.1, hs: [0.03, -0.6, 0.02] }, { t: 0.42, ht: [0.22, 0.22, 0.2] }, { t: 0.52, ht: [0.22, 0.22, 0.2] }
    ]),
    phases: PH4(['準備', 'Set up', '心口貼住斜板', 'Chest on the incline pad'], ['拉', 'Row', '手肘向後向上拉', 'Drive the elbows up and back'],
      ['夾', 'Squeeze', '夾緊肩胛骨', 'Squeeze the shoulder blades'], ['放', 'Lower', '慢慢伸直手', 'Lower slowly']),
    mistakes: [M('心口離開墊', 'Chest lifting off the pad'), M('聳膊頭', 'Shrugging')]
  },
  meadows: {
    period: 3.2, cam: { view: 'q', target: [0.2, 0.75, 0], dist: 3.6 },
    props: [{ type: 'landmine', x: 1.8, z: 0.2, hand: 'L' }],
    keys: loop([
      { t: 0, pel: [0.82, -0.1], trunk: 55, fL: [0.2, 0.08, -0.35], fR: [-0.15, 0.08, 0.35], kpL: [0.2, 0, 1], kpR: [-0.2, 0, 1], hR: [-0.12, 0.56, 0.3], epR: [-0.3, -0.5, -1],
        hL: [0.27, 0.44, 0.2], epL: [1, 1, -0.6], pnL: [0, 0, -1] },
      { t: 0.1, hL: [0.27, 0.44, 0.2] }, { t: 0.42, hL: [0.32, 0.82, -0.08] }, { t: 0.52, hL: [0.32, 0.82, -0.08] }
    ]),
    phases: PH4(['準備', 'Set up', '前後腳企，另一隻手撐膝', 'Staggered stance, other forearm on your knee'], ['拉', 'Row', '手肘向上向後拉向臀部', 'Drive the elbow up and back to the hip'],
      ['夾', 'Squeeze', '手肘高位夾緊', 'Squeeze with the elbow high'], ['放', 'Lower', '控制住放落', 'Lower with control']),
    mistakes: [M('轉身借力', 'Twisting to lift'), M('拉得太短', 'Short range')]
  },
  back_ext: {
    period: 3.4, cam: { view: 'side', target: [0, 0.75, 0.15], dist: 3.3 },
    props: [{ type: 'pad', at: [0, 0.86, 0.2], len: 0.32, rx: 0.79, w: 0.42 }, { type: 'pad', at: [0, 0.2, -0.62], len: 0.3, rx: 0.79, w: 0.4, legs: false }],
    keys: loop([
      { t: 0, pel: [0.92, 0.05], trunk: 50, f: [0.1, 0.3, -0.55], fp: 45, kp: [0, 0, 1], ht: [-0.1, 0.36, 0.15], ep: [1, -0.5, 0] },
      { t: 0.1, trunk: 50 }, { t: 0.45, trunk: 112 }, { t: 0.55, trunk: 112 }
    ]),
    phases: PH4(['準備', 'Set up', '墊喺盆骨，身體一直線', 'Pad at your hips, body in a straight line'], ['落', 'Lower', '由髖部向前屈', 'Hinge forward from the hips'],
      ['最低點', 'Bottom', '感到大腿後側拉伸', 'Feel the hamstrings stretch'], ['起', 'Rise', '夾臀返到一直線，唔好過度後仰', 'Squeeze glutes back to straight, no over-arching']),
    mistakes: [M('頂部向後拗腰', 'Over-arching at the top'), M('用衝力彈', 'Bouncing')]
  },
  seated_row_wide: {
    period: 3.4, cam: { view: 'q', target: [0, 0.6, 0.2], dist: 3.3 },
    props: [{ type: 'box', w: 0.34, h: 0.4, d: 1.0, z: -0.15 }, { type: 'box', w: 0.5, h: 0.32, d: 0.06, z: 0.7, rx: -0.5 }, { type: 'cable', anchor: [0, 0.78, 1.35], handle: 'bar', handleLen: 0.8 }],
    keys: loop([
      { t: 0, pel: [0.50, -0.05], trunk: 18, f: [0.15, 0.30, 0.64], fp: -45, kp: [0.3, 1, 0.5], h: [0.27, 0.82, 0.62], ep: [1, 0.1, -1], pn: [0, 0, -1] },
      { t: 0.1, pel: [0.50, -0.05], trunk: 18 }, { t: 0.42, trunk: -4, ht: [0.3, 0.32, 0.18] }, { t: 0.52, trunk: -4, ht: [0.3, 0.32, 0.18] }
    ]),
    phases: PH4(['伸展', 'Reach', '闊握，手伸直', 'Wide grip, arms long'], ['拉', 'Row', '手肘向外向後拉到上胸', 'Elbows out and back to your upper chest'],
      ['夾', 'Squeeze', '夾緊上背', 'Squeeze the upper back'], ['放', 'Release', '慢慢伸返直', 'Extend slowly']),
    mistakes: [M('上身前後大搖', 'Rocking the torso'), M('聳膊頭', 'Shrugging')]
  },
  hack: {
    period: 3.8, cam: { view: 'side', target: [0, 0.75, 0], dist: 3.4 },
    props: [{ type: 'backpad', len: 0.75 }, { type: 'pad', at: [0, 0.05, 0.3], len: 0.5, rx: -0.3, w: 0.7, legs: false }],
    keys: loop([
      { t: 0, pel: [0.87, -0.16], trunk: -20, f: [0.17, 0.12, 0.27], fp: -15, fy: 14, kp: [0.4, 0, 1], ht: [0.3, 0.44, 0.04], ep: [0.6, -1, 0.2] },
      { t: 0.12, pel: [0.87, -0.16] }, { t: 0.47, pel: [0.46, -0.01] }, { t: 0.57, pel: [0.46, -0.01] }
    ]),
    phases: PH4(['準備', 'Set up', '背貼實靠墊，腳與肩同寬', 'Back flat on the pad, feet shoulder-width'], ['落', 'Descent', '膝蓋跟腳尖方向屈', 'Bend the knees in line with your toes'],
      ['谷底', 'Bottom', '大腿最少平行', 'Thighs at least parallel'], ['推', 'Drive', '腳掌推起，膝唔好鎖死', 'Drive up, don\'t lock the knees']),
    mistakes: [M('膝蓋向內', 'Knees caving in'), M('腳踭離開踏板', 'Heels lifting off the platform')]
  },
  calf_seated: {
    period: 2.8, cam: { view: 'side', target: [0, 0.45, 0.2], dist: 2.8 },
    props: [{ type: 'seat', y: 0.45, z: -0.05 }, { type: 'kneepad', y: 0.66, z: 0.36 }, { type: 'box', w: 0.5, h: 0.06, d: 0.18, z: 0.5 }],
    keys: loop([
      { t: 0, pel: [0.55, -0.05], trunk: 5, f: [0.12, 0.14, 0.42], fp: 0, kp: [0.1, 0.3, 1], h: [0.16, 0.66, 0.36], ep: [0.2, -0.5, -1] },
      { t: 0.12, f: [0.12, 0.14, 0.42], fp: 0 }, { t: 0.42, f: [0.12, 0.22, 0.42], fp: 36 }, { t: 0.55, f: [0.12, 0.22, 0.42], fp: 36 }
    ]),
    phases: PH4(['準備', 'Set up', '墊壓喺膝蓋上，腳踭放低', 'Pad on your knees, heels down'], ['踮', 'Rise', '腳踭推到最高', 'Push the heels as high as you can'],
      ['頂部', 'Top', '停一秒', 'Hold one second'], ['放', 'Lower', '慢慢放到最低', 'Lower slowly into the stretch']),
    mistakes: [M('彈上彈落', 'Bouncing'), M('幅度太細', 'Half reps')]
  },
  calf_donkey: {
    period: 2.8, cam: { view: 'side', target: [0, 0.6, 0.2], dist: 3.0 },
    props: [{ type: 'box', w: 0.5, h: 0.08, d: 0.18, z: 0.1 }, { type: 'box', w: 0.6, h: 0.72, d: 0.3, z: 1.1 }],
    keys: loop([
      { t: 0, pel: [0.92, -0.02], trunk: 84, head: -38, f: [0.12, 0.16, 0.0], fp: 0, kp: [0.1, 0, 1], h: [0.2, 0.74, 1.03], ep: [0.6, 0.2, -1] },
      { t: 0.12, pel: [0.92, -0.02], f: [0.12, 0.16, 0.0], fp: 0 }, { t: 0.42, pel: [1.0, -0.01], f: [0.12, 0.25, 0.0], fp: 36 }, { t: 0.55, pel: [1.0, -0.01], f: [0.12, 0.25, 0.0], fp: 36 }
    ]),
    phases: PH4(['屈髖', 'Hinge', '上身向前，臀部喺腳上面', 'Bend forward, hips over your feet'], ['踮', 'Rise', '腳踭推到最高', 'Push the heels up'],
      ['頂部', 'Top', '停一秒夾緊', 'Hold and squeeze'], ['放', 'Lower', '放到最低，感受拉伸', 'Lower into a full stretch']),
    mistakes: [M('屈膝借力', 'Bending the knees to help'), M('幅度太細', 'Half reps')]
  },
  sissy: {
    period: 3.6, cam: { view: 'side', target: [0, 0.75, 0], dist: 3.3 },
    props: [{ type: 'post', x: 0.45, z: 0.25, h: 1.3 }],
    keys: loop([
      { ...STAND, t: 0, hL: [0.42, 1.0, 0.25], epL: [0.5, -0.5, -0.3], htR: [-0.1, 0.36, 0.16], fp: 0, kp: [0.1, 0, 1] },
      { t: 0.12, pel: [0.96, 0], trunk: 0, fp: 0, f: [0.13, 0.08, 0] },
      { t: 0.47, pel: [0.56, 0.04], trunk: -42, fp: 50, f: [0.13, 0.16, 0.0] },
      { t: 0.57, pel: [0.56, 0.04], trunk: -42, fp: 50, f: [0.13, 0.16, 0.0] }
    ]),
    phases: PH4(['準備', 'Set up', '一隻手扶住，踮起腳', 'Hold a support, rise onto your toes'], ['落', 'Lower', '膝蓋向前，身體向後瞓成一直線', 'Knees forward, lean back in a straight line'],
      ['最低點', 'Bottom', '膝到腰保持一直線', 'Keep a straight line from knees to shoulders'], ['起', 'Rise', '用大腿前側推返上', 'Drive up with the quads']),
    mistakes: [M('屈髖坐落去', 'Bending at the hips'), M('落得太快', 'Dropping too fast')]
  },
  nordic: {
    hand: 'open',
    period: 4.6, cam: { view: 'side', target: [0, 0.4, 0.3], dist: 3.2 },
    props: [{ type: 'mat' }, { type: 'kneepad', y: 0.15, z: -0.42 }],
    keys: loop([
      { t: 0, pel: [0.52, 0.0], trunk: 0, f: [0.12, 0.1, -0.42], fp: 82, kp: [0, -0.6, 1], ht: [-0.1, 0.36, 0.15], ep: [1, -0.5, 0] },
      { t: 0.1, pel: [0.52, 0.0], trunk: 0 },
      { t: 0.5, pel: [0.25, 0.4], trunk: 68, h: [0.22, 0.12, 0.92], ep: [0.3, -1, -0.5] },
      { t: 0.6, pel: [0.25, 0.4], trunk: 68, h: [0.22, 0.12, 0.92] },
      { t: 0.75, pel: [0.4, 0.3], trunk: 45, ht: [0.0, 0.32, 0.2], ep: [1, -0.6, 0] }
    ]),
    phases: [P([0, 0.1], '跪定', 'Kneel', '腳踝固定，身體一直線', 'Ankles anchored, body straight'),
      P([0.1, 0.5], '慢慢落', 'Lower slowly', '用大腿後側煞住，越慢越好', 'Brake with your hamstrings, as slowly as you can'),
      P([0.5, 0.6], '撐地', 'Catch', '用手接住', 'Catch yourself with your hands'),
      P([0.6, 1], '推返', 'Return', '輕推地面，用腿後肌拉返上', 'Push off lightly and pull back up with the hamstrings')],
    mistakes: [M('屈髖坐落', 'Bending at the hips'), M('一下跌落', 'Dropping straight down')]
  },
  rev_fly_machine: {
    period: 3.2, cam: { view: 'q', target: [0, 1.0, 0], dist: 3.3, phi: 0.35 },
    props: [{ type: 'seat', y: 0.45, z: -0.05 }, { type: 'pad', at: [0, 0.92, 0.2], len: 0.08, rx: 0, w: 0.36 }],
    keys: loop([
      { t: 0, pel: [0.55, -0.05], trunk: 8, f: [0.2, 0.08, 0.42], kp: [0.3, 0.4, 1], h: [0.17, 1.03, 0.64], ep: [1, 0.2, -0.2], pn: [-1, 0, 0] },
      { t: 0.1, h: [0.17, 1.03, 0.64] }, { t: 0.27, h: [0.62, 1.03, 0.46], ep: [0.7, 0.3, -0.6], pn: [-0.6, 0, 0.6] },
      { t: 0.45, h: [0.8, 1.02, -0.04], ep: [0.2, 0.3, -1], pn: [0, 0, 1] }, { t: 0.55, h: [0.8, 1.02, -0.04], ep: [0.2, 0.3, -1], pn: [0, 0, 1] },
      { t: 0.75, h: [0.62, 1.03, 0.46], ep: [0.7, 0.3, -0.6], pn: [-0.6, 0, 0.6] }
    ]),
    phases: PH4(['準備', 'Set up', '心口貼墊，手伸向前', 'Chest on the pad, arms forward'], ['張開', 'Open', '手臂微曲向後張開', 'Open the arms back with soft elbows'],
      ['夾', 'Squeeze', '夾緊後三角', 'Squeeze the rear delts'], ['返', 'Return', '慢慢返前', 'Return slowly']),
    mistakes: [M('聳膊頭', 'Shrugging'), M('心口離開墊', 'Chest leaving the pad')]
  },
  arnold: {
    period: 4, cam: { view: 'q', target: [0, 1.1, 0], dist: 3.3, phi: 0.15 },
    props: [{ type: 'seat', y: 0.45, z: -0.05, back: 0.7 }, { type: 'dumbbells' }],
    keys: loop([
      { t: 0, pel: [0.55, -0.05], trunk: -4, f: [0.2, 0.08, 0.45], kp: [0.3, 0.4, 1], h: [0.19, 1.12, 0.15], ep: [0.4, -1, 0.5], pn: [0, 0, -1] },
      { t: 0.1, h: [0.19, 1.12, 0.15], pn: [0, 0, -1] },
      { t: 0.28, h: [0.34, 1.3, 0.07], ep: [1, -0.4, 0], pn: [-1, 0, 0.2] },
      { t: 0.45, h: [0.16, 1.61, 0.0], ep: [1, 0, 0], pn: [0, 0, 1] },
      { t: 0.55, h: [0.16, 1.61, 0.0], ep: [1, 0, 0], pn: [0, 0, 1] },
      { t: 0.75, h: [0.34, 1.3, 0.07], ep: [1, -0.4, 0], pn: [-1, 0, 0.2] }
    ]),
    phases: PH4(['準備', 'Set up', '啞鈴喺下巴前，掌心向自己', 'Dumbbells at chin height, palms facing you'], ['轉推', 'Rotate & press', '一路推一路轉手腕向前', 'Turn the palms forward as you press'],
      ['頂部', 'Top', '掌心向前，手接近伸直', 'Palms forward, arms nearly straight'], ['轉返落', 'Rotate down', '落返時轉返向自己', 'Turn the palms back toward you on the way down']),
    mistakes: [M('轉得太早或太遲', 'Rotating too early or too late'), M('腰離開靠墊', 'Arching off the pad')]
  },
  lateral_cable: {
    period: 3.2, cam: { view: 'front', target: [0, 1.1, 0], dist: 3.4 },
    props: [{ type: 'cable', anchor: [-0.45, 0.12, 0.15], to: 'L', handle: 'd', towerDz: 0, towerDx: -0.15 }],
    keys: loop([
      { ...STAND, t: 0, hL: [-0.04, 0.86, 0.2], epL: [0.3, 0.3, -1], pnL: [0, 0, -1], htR: [-0.22, 0.04, 0.06], epR: [-1, 0, -0.5] },
      { t: 0.1, hL: [-0.04, 0.86, 0.2] }, { t: 0.45, hL: [0.79, 1.35, 0.07], epL: [0, 0.5, -0.4], pnL: [0, -1, 0] }, { t: 0.55, hL: [0.79, 1.35, 0.07], epL: [0, 0.5, -0.4], pnL: [0, -1, 0] }
    ]),
    phases: PH4(['準備', 'Set up', '側身企，滑輪喺另一邊低位', 'Stand side-on, low pulley on the far side'], ['舉', 'Raise', '手肘帶頭向外舉', 'Lead with the elbow out to the side'],
      ['頂部', 'Top', '舉到膊頭高度', 'Stop at shoulder height'], ['放', 'Lower', '慢慢返到身前', 'Lower slowly across your body']),
    mistakes: [M('身體側彎借力', 'Leaning to swing it up'), M('聳膊頭', 'Shrugging')]
  },
  lateral_lean: {
    period: 3.2, cam: { view: 'front', target: [0, 1.1, 0], dist: 3.5 },
    props: [{ type: 'post', x: -0.6, z: 0.05, h: 1.6 }, { type: 'dumbbells', hand: 'L' }],
    keys: loop([
      { ...STAND, t: 0, roll: -14, fL: [0.06, 0.08, 0], fR: [-0.2, 0.08, 0], hL: [0.36, 0.84, 0.08], epL: [0.3, 0.3, -1], pnL: [-1, 0, 0], hR: [-0.56, 1.06, 0.05], epR: [0, -1, -0.5] },
      { t: 0.1, hL: [0.36, 0.84, 0.08] }, { t: 0.45, hL: [0.86, 1.22, 0.1], epL: [0, 1, -0.6], pnL: [0, -1, 0] }, { t: 0.55, hL: [0.86, 1.22, 0.1], epL: [0, 1, -0.6], pnL: [0, -1, 0] }
    ]),
    phases: PH4(['準備', 'Set up', '揸住支架，身體向外斜', 'Hold a post and lean away'], ['舉', 'Raise', '手肘帶頭向外舉', 'Lead with the elbow'],
      ['頂部', 'Top', '手臂大約平行地面', 'Arm about parallel to the floor'], ['放', 'Lower', '慢慢放', 'Lower slowly']),
    mistakes: [M('靠扯支架借力', 'Pulling on the post to help'), M('聳膊頭', 'Shrugging')]
  },
  y_raise: {
    period: 3.2, cam: { view: 'side', target: [0, 0.85, 0.1], dist: 3.4 },
    props: [{ type: 'pad', at: [0, 0.82, -0.06], len: 0.85, rx: -0.61 }, { type: 'dumbbells' }],
    keys: loop([
      { t: 0, pel: [0.78, -0.40], trunk: 55, f: [0.13, 0.08, -0.6], kp: [0.15, 0, 1], hs: [0.03, -0.6, 0.04], ep: [0, 1, 0], pn: [-1, 0, 0] },
      { t: 0.1, hs: [0.03, -0.6, 0.04] }, { t: 0.27, hs: [0.23, -0.3, 0.5], pn: [-1, 0.2, 0] },
      { t: 0.45, ht: [0.43, 1.07, 0.05], pn: [-1, 0.5, 0] }, { t: 0.55, ht: [0.43, 1.07, 0.05], pn: [-1, 0.5, 0] }, { t: 0.75, hs: [0.23, -0.3, 0.5], pn: [-1, 0.2, 0] }
    ]),
    phases: PH4(['準備', 'Set up', '俯臥斜板，手垂直落', 'Lie face down on the incline, arms hanging'], ['舉', 'Raise', '拇指向上，手臂舉成 Y 字', 'Thumbs up, raise the arms into a Y'],
      ['頂部', 'Top', '夾緊下斜方肌', 'Squeeze the lower traps'], ['放', 'Lower', '慢慢放', 'Lower slowly']),
    mistakes: [M('聳膊頭', 'Shrugging'), M('頭向上抬', 'Craning the neck up')]
  },
  lu: {
    period: 3.8, cam: { view: 'q', target: [0, 1.2, 0], dist: 3.6, phi: 0.12 },
    props: [{ type: 'dumbbells' }],
    keys: loop([
      { ...STAND, t: 0, h: [0.22, 0.84, 0.1], ep: [0.4, 0.2, -1], pn: [0, -1, 0] },
      { t: 0.1, h: [0.22, 0.84, 0.1] }, { t: 0.28, h: [0.56, 1.4, 0.4], ep: [0.3, 1, -0.5] },
      { t: 0.45, h: [0.3, 2.02, 0.08], ep: [1, 0.3, 0] }, { t: 0.55, h: [0.3, 2.02, 0.08], ep: [1, 0.3, 0] }, { t: 0.75, h: [0.56, 1.4, 0.4], ep: [0.3, 1, -0.5] }
    ]),
    phases: PH4(['準備', 'Set up', '輕重量，手臂伸直', 'Light weight, straight arms'], ['舉', 'Raise', '斜向前舉，一直舉過頭', 'Raise out at an angle all the way overhead'],
      ['頂部', 'Top', '頭頂正上方停一停', 'Pause directly overhead'], ['放', 'Lower', '原路慢慢放', 'Lower the same way, slowly']),
    mistakes: [M('腰向後彎', 'Arching the back'), M('用重量太重', 'Going too heavy')]
  },
  preacher: {
    period: 3.2, cam: { view: 'side', target: [0, 0.85, 0.15], dist: 3.0 },
    props: [{ type: 'preacher', y: 0.86, z: 0.28 }, { type: 'ezbar' }],
    keys: withPn(loop([
      { t: 0, pel: [0.62, -0.14], trunk: 18, f: [0.2, 0.08, 0.3], kp: [0.3, 0.3, 1], h: [0.19, 0.6, 0.46], ep: [0, -1, 0.6] },
      { t: 0.1, h: [0.19, 0.6, 0.46] }, { t: 0.27, h: [0.19, 0.86, 0.56] }, { t: 0.42, h: [0.19, 1.13, 0.28] }, { t: 0.52, h: [0.19, 1.13, 0.28] }, { t: 0.75, h: [0.19, 0.86, 0.56] }
    ]), SUP),
    phases: CURL_PH,
    mistakes: [M('上臂離開墊', 'Upper arms lifting off the pad'), M('落到最低鎖死手肘', 'Locking out hard at the bottom')]
  },
  concentration: {
    period: 3.2, cam: { view: 'q', target: [0, 0.65, 0.2], dist: 3.0 },
    props: [{ type: 'bench', y: 0.45, z0: -0.6, z1: 0.2 }, { type: 'dumbbells', hand: 'L' }],
    keys: withPn(loop([
      { t: 0, pel: [0.55, -0.02], trunk: 35, f: [0.32, 0.08, 0.45], kp: [0.6, 0, 1], hL: [0.1, 0.36, 0.38], epL: [0.6, -0.4, 0], hR: [-0.2, 0.6, 0.32], epR: [-0.5, -0.5, -1] },
      { t: 0.1, hL: [0.1, 0.36, 0.38] }, { t: 0.27, hL: [0.06, 0.62, 0.62] }, { t: 0.42, hL: [0.05, 0.9, 0.36] }, { t: 0.52, hL: [0.05, 0.9, 0.36] }, { t: 0.75, hL: [0.06, 0.62, 0.62] }
    ]), [[-0.4, 0, 1], [-0.4, 0, 1], [-0.3, 1, 0], [0, 0.4, -1], [0, 0.4, -1], [-0.3, 1, 0], [-0.4, 0, 1]].map(v => v)),
    phases: CURL_PH,
    mistakes: [M('用上身擺', 'Swinging the torso'), M('手肘離開大腿', 'Elbow leaving the thigh')]
  },
  curl_cable: {
    period: 3, cam: { view: 'side', target: [0, 1.0, 0.2], dist: 3.2 },
    props: [{ type: 'cable', anchor: [0, 0.15, 0.6], handle: 'bar', handleLen: 0.5 }],
    keys: withPn(curlKeys([0.21, 0.82, 0.08], [0.21, 1.14, 0.33], [0.21, 1.4, 0.19], { ep: [0.1, -0.6, -1] }), SUP),
    phases: CURL_PH,
    mistakes: [M('身體向後瞓', 'Leaning back'), M('手肘向前郁', 'Elbows drifting forward')]
  },
  curl_incline: {
    period: 3.2, cam: { view: 'side', target: [0, 0.7, 0], dist: 3.0 },
    props: [{ type: 'incline', y: 0.45, angle: 45, z: 0.12 }, { type: 'dumbbells' }],
    keys: withPn(loop([
      { t: 0, pel: [0.55, 0.12], trunk: -45, f: [0.22, 0.08, 0.55], kp: [0.4, 0.5, 1], h: [0.22, 0.31, -0.22], ep: [0.1, 0, -1] },
      { t: 0.1, h: [0.22, 0.31, -0.22] }, { t: 0.27, h: [0.22, 0.6, 0.11] }, { t: 0.42, h: [0.22, 0.86, 0.0] }, { t: 0.52, h: [0.22, 0.86, 0.0] }, { t: 0.75, h: [0.22, 0.6, 0.11] }
    ]), SUP),
    phases: CURL_PH,
    mistakes: [M('手肘向前帶', 'Elbows swinging forward'), M('頭離開靠墊', 'Head coming off the pad')]
  },
  curl_spider: {
    period: 3, cam: { view: 'side', target: [0, 0.75, 0], dist: 3.0 },
    props: [{ type: 'pad', at: [0, 0.82, -0.06], len: 0.85, rx: -0.61 }, { type: 'ezbar' }],
    keys: withPn(loop([
      { t: 0, pel: [0.78, -0.40], trunk: 55, f: [0.13, 0.08, -0.6], kp: [0.15, 0, 1], h: [0.19, 0.45, 0.02], ep: [0, -0.2, -1] },
      { t: 0.1, h: [0.19, 0.45, 0.02] }, { t: 0.27, h: [0.19, 0.77, 0.32] }, { t: 0.42, h: [0.19, 1.0, 0.2] }, { t: 0.52, h: [0.19, 1.0, 0.2] }, { t: 0.75, h: [0.19, 0.77, 0.32] }
    ]), [[0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 0.6, -0.8], [0, 0.6, -0.8], [0, 1, 0], [0, 0, 1]]),
    phases: CURL_PH,
    mistakes: [M('上臂跟住郁', 'Upper arms moving'), M('身體離開墊', 'Body leaving the pad')]
  },
  curl_drag: {
    period: 3, cam: { view: 'side', target: [0, 1.0, 0], dist: 3.0 },
    props: [{ type: 'barbell', len: 1.5, plate: 0.15, noPlatform: true }],
    keys: loop([
      { ...STAND, t: 0, h: [0.21, 0.82, 0.11], ep: [0.15, 0, -1], pn: [0, 0, 1] },
      { t: 0.1, h: [0.21, 0.82, 0.11] }, { t: 0.42, h: [0.21, 1.2, 0.15], pn: [0, 0.6, 0.6] }, { t: 0.52, h: [0.21, 1.2, 0.15], pn: [0, 0.6, 0.6] }
    ]),
    phases: PH4(['準備', 'Set up', '槓貼住大腿', 'Bar against your thighs'], ['拖', 'Drag', '手肘向後，槓沿住身體拖上', 'Elbows go back, drag the bar up your body'],
      ['夾', 'Squeeze', '頂部夾緊', 'Squeeze at the top'], ['放', 'Lower', '沿住身體放返落', 'Slide it back down your body']),
    mistakes: [M('槓離開身體', 'Bar drifting away from the body'), M('甩身', 'Swinging')]
  },
  curl_reverse: {
    period: 3, cam: { view: 'q', target: [0, 1.0, 0], dist: 3.0 },
    props: [{ type: 'barbell', len: 1.5, plate: 0.15, noPlatform: true }],
    keys: withPn(curlKeys([0.21, 0.82, 0.07], [0.21, 1.14, 0.33], [0.21, 1.38, 0.2], { ep: [0.1, -0.6, -1] }), [[0, 0, -1], [0, 0, -1], [0, -1, 0], [0, -0.6, 0.8], [0, -0.6, 0.8], [0, -1, 0], [0, 0, -1]]),
    phases: PH4(['準備', 'Set up', '正握（手背向上）', 'Overhand grip'], ['捲', 'Curl', '手腕保持平直', 'Keep the wrists straight'],
      ['夾', 'Squeeze', '頂部停一停', 'Pause at the top'], ['放', 'Lower', '慢慢放', 'Lower slowly']),
    mistakes: [M('手腕向下屈', 'Wrists bending down'), M('甩身', 'Swinging')]
  },
  wrist_curl: {
    period: 2.4, cam: { view: 'side', target: [0, 0.6, 0.25], dist: 2.4, phi: 0.3 },
    props: [{ type: 'bench', y: 0.45, z0: -0.6, z1: 0.2 }, { type: 'ezbar', len: 1.0 }],
    keys: loop([
      { t: 0, pel: [0.55, -0.1], trunk: 32, f: [0.2, 0.08, 0.42], kp: [0.3, 0.3, 1], h: [0.14, 0.6, 0.44], ep: [0.2, -0.6, -1], pn: [0, 1, 0], wr: -35 },
      { t: 0.12, wr: -35 }, { t: 0.45, wr: 40 }, { t: 0.56, wr: 40 }
    ]),
    phases: PH4(['準備', 'Set up', '前臂放喺大腿，手腕伸出膝外', 'Forearms on your thighs, wrists past the knees'], ['捲', 'Curl', '只郁手腕向上捲', 'Curl up with the wrists only'],
      ['夾', 'Squeeze', '頂部夾緊前臂', 'Squeeze the forearms'], ['放', 'Lower', '慢慢放低手腕', 'Lower the wrists slowly']),
    mistakes: [M('前臂離開大腿', 'Forearms lifting off the thighs'), M('用手臂拉', 'Pulling with the arms')]
  },
  jm: {
    period: 3.4, cam: { view: 'side', target: [0, 0.75, -0.25], dist: 3.0, phi: 0.3 },
    props: [{ type: 'bench' }, { type: 'barbell', len: 1.6, plate: 0.18, noPlatform: true }],
    keys: loop([
      { t: 0, pel: [0.55, 0.12], trunk: -90, f: [0.28, 0.08, 0.52], kp: [0.5, 1, 0.4], h: [0.14, 1.15, -0.28], ep: [0.2, -0.4, 1], pn: [0, 0, 1] },
      { t: 0.1, h: [0.14, 1.15, -0.28] }, { t: 0.45, h: [0.14, 0.8, -0.42] }, { t: 0.53, h: [0.14, 0.8, -0.42] }
    ]),
    phases: PH4(['準備', 'Set up', '窄握，手臂垂直', 'Close grip, arms vertical'], ['落', 'Lower', '手肘向腳方向屈，槓落向上胸', 'Elbows toward your feet, bar to the upper chest'],
      ['最低點', 'Bottom', '前臂貼近上臂', 'Forearms close to the upper arms'], ['推', 'Press', '用三頭肌推返', 'Press back with the triceps']),
    mistakes: [M('手肘向外張', 'Elbows flaring'), M('變咗普通臥推', 'Turning it into a bench press')]
  },
  landmine_rot: {
    period: 3.6, cam: { view: 'front', target: [0, 1.0, 0.3], dist: 3.8 },
    props: [{ type: 'landmine', z: 1.75 }],
    keys: loop([
      { t: 0, pel: [0.94, 0], trunk: 4, f: [0.22, 0.08, 0], kp: [0.4, 0, 1], yaw: 0, hL: [0.04, 1.28, 0.48], hR: [-0.04, 1.28, 0.48], ep: [0.6, -0.8, 0] },
      { t: 0.25, yaw: 32, hL: [0.6, 1.0, 0.32], hR: [0.52, 1.0, 0.36] },
      { t: 0.5, yaw: 0, hL: [0.04, 1.28, 0.48], hR: [-0.04, 1.28, 0.48] },
      { t: 0.75, yaw: -32, hL: [-0.52, 1.0, 0.36], hR: [-0.6, 1.0, 0.32] }
    ]),
    phases: [P([0, 0.25], '轉左', 'Rotate left', '手臂伸直，用核心帶動', 'Arms straight, rotate from the core'), P([0.25, 0.5], '返中', 'Centre', '控制住返中間', 'Come back to centre with control'),
      P([0.5, 0.75], '轉右', 'Rotate right', '後腳跟住轉', 'Let the back foot pivot'), P([0.75, 1], '返中', 'Centre', '保持呼吸', 'Keep breathing')],
    mistakes: [M('只用手臂甩', 'Swinging with the arms only'), M('腰椎扭轉過度', 'Twisting the lower back')]
  },
  burpee: {
    hand: 'open',
    period: 3.4, cam: { view: 'side', target: [0, 0.7, 0.2], dist: 3.6 },
    props: [{ type: 'mat' }],
    keys: loop([
      { ...STAND, t: 0, hs: [0.02, -0.6, 0.04], ep: [0.3, -0.3, -1], fp: 0, kp: [0.15, 0, 1] },
      { t: 0.14, pel: [0.45, -0.15], trunk: 50, h: [0.22, 0.05, 0.4], ep: [0.4, 0.3, -1], f: [0.13, 0.08, 0], fp: 0 },
      { t: 0.28, ...line(0.66, 0.4), fp: 72, kp: [0, -1, 0], h: [0.24, 0.04, 0.42] },
      { t: 0.42, ...line(0.28, 0.46), h: [0.24, 0.04, 0.42], ep: [0.5, 0.5, -0.8] },
      { t: 0.54, ...line(0.66, 0.4), h: [0.24, 0.04, 0.42] },
      { t: 0.66, pel: [0.45, -0.15], trunk: 50, h: [0.22, 0.05, 0.4], f: [0.13, 0.08, 0], fp: 0, kp: [0.15, 0, 1] },
      { t: 0.8, pel: [1.2, 0.02], trunk: -2, h: [0.22, 2.1, 0.05], ep: [1, 0, 0], f: [0.13, 0.3, 0.02], fp: 30 },
      { t: 0.9, pel: [0.92, 0], trunk: 4, hs: [0.02, -0.6, 0.04], f: [0.13, 0.08, 0], fp: 0 }
    ]),
    phases: [P([0, 0.14], '蹲低', 'Squat down', '手按地', 'Hands to the floor'), P([0.14, 0.28], '跳後', 'Jump back', '雙腳向後跳成平板', 'Jump the feet back to a plank'),
      P([0.28, 0.54], '掌上壓', 'Push-up', '身體一直線', 'Body in one line'), P([0.54, 0.8], '跳起', 'Jump up', '收腳再向上跳，手舉高', 'Feet in, then jump with arms overhead'), P([0.8, 1], '落地', 'Land', '輕輕落地', 'Land softly')],
    mistakes: [M('平板時腰塌', 'Hips sagging in the plank'), M('落地太重', 'Landing heavily')]
  },
  stairs: {
    period: 1.3, cam: { view: 'side', target: [0, 1.05, 0.25], dist: 3.8 },
    props: [{ type: 'stairs' }],
    fn(t) {
      const a = t * Math.PI * 2, s = Math.sin(a);
      const up = q => Math.max(0, q);
      return {
        pel: [1.08 + 0.03 * Math.cos(2 * a), 0.18], trunk: 8,
        fL: [0.12, 0.33 + 0.22 * up(s), 0.42 + 0.06 * s], fR: [-0.12, 0.33 + 0.22 * up(-s), 0.42 - 0.06 * s], fp: 0,
        hsL: [0.02, -0.6, -0.12 * s], hsR: [-0.02, -0.6, 0.12 * s], ep: [0.2, -0.3, -1], kp: [0.1, 0, 1]
      };
    },
    phases: [P([0, 1], '踏', 'Climb', '企直，成隻腳踩實每級，唔好倚扶手', 'Stand tall, whole foot on each step, hands off the rails')],
    mistakes: [M('挨住扶手', 'Leaning on the rails'), M('只用腳尖', 'Only using your toes')]
  }
});

// ── palm direction per move (left hand, world; the right hand is mirrored) ──
const PN = {
  squat_bb: [0, 0, 1], good_morning: [0, 0, 1], deadlift: [0, 0, -1], rdl: [0, 0, -1], sumo_dl: [0, 0, -1], shrug: [0, 0, -1],
  row_bb: [0, 0, -1], upright_row: [0, 0, -1], bench: [0, 0, 1], bench_close: [0, 0, 1], skull: [0, 0, 1], incline_press: [0, 0, 1],
  pushup: [0, -1, 0], plank: [0, -1, 0], ohp: [0, 0, 1], db_press: [0, 0, 1], lateral: [0, -1, 0.2], front_raise: [0, -1, 0],
  pushdown: [0, -0.6, -1], pulldown: [0, 0, 1], pullup: [0, 0, 1], pullover: [0, -1, 0.2], hip_thrust: [0, -1, 0], leg_raise: [0, -1, 0],
  ab_wheel: [0, -1, 0.4], bike: [0, -1, 0], rower: [0, -1, -0.3], sled: [0, 0, 1], fly_cable: [0, 0, 1], pec_deck: [0, 0, 1], dip: [-1, 0, 0]
};
for (const [id, v] of Object.entries(PN)) { const m = MOVES[id]; if (m && m.keys && !m.keys[0].pn) m.keys[0].pn = v; }
// supinated curls: palm forward at the bottom, up when level, toward the shoulder at the top
for (const id of ['curl_bb', 'curl_db']) {
  const k = MOVES[id].keys; const sup = [[0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 0.6, -0.8], [0, 0.6, -0.8], [0, 1, 0], [0, 0, 1]];
  k.forEach((key, i) => { key.pn = sup[i]; });
}
// fly: palms forward when open, facing each other when closed
MOVES.fly_cable.keys[2].pn = [-1, 0, 0.2]; MOVES.fly_cable.keys[3].pn = [-1, 0, 0.2];

// ── mistake demos: overrides applied to key indexes ('*' = every key) ──
const L0 = (y, z) => line(y, z);
const PATCH = {
  squat_bb: [{ 2: { kp: [-0.55, 0, 1] }, 3: { kp: [-0.55, 0, 1] } }, { 2: { fp: 28, f: [0.17, 0.15, 0.02] }, 3: { fp: 28, f: [0.17, 0.15, 0.02] } }, { 2: { lumbar: 30, trunk: 48 }, 3: { lumbar: 30, trunk: 48 } }],
  squat_goblet: [{ 2: { trunk: 52, pel: [0.45, -0.2] }, 3: { trunk: 52, pel: [0.45, -0.2] } }, { 2: { kp: [-0.6, 0, 1] }, 3: { kp: [-0.6, 0, 1] } }],
  deadlift: [{ 0: { lumbar: 30, trunk: 48 }, 1: { lumbar: 30, trunk: 48 }, 2: { lumbar: 18 } }, { 2: { h: [0.24, 0.55, 0.3] }, 5: { h: [0.24, 0.55, 0.3] } }, { 2: { pel: [0.9, -0.34], trunk: 64, h: [0.24, 0.44, 0.1] } }],
  rdl: [{ 2: { pel: [0.62, -0.22], trunk: 55 }, 3: { pel: [0.62, -0.22], trunk: 55 } }, { 2: { lumbar: 30, h: [0.22, 0.24, 0.14] }, 3: { lumbar: 30, h: [0.22, 0.24, 0.14] } }],
  good_morning: [{ 2: { lumbar: 30 }, 3: { lumbar: 30 } }, null],
  sumo_dl: [{ 0: { kp: [0, 0, 1] }, 1: { kp: [0, 0, 1] } }, { 2: { pel: [0.72, -0.3], trunk: 60 } }],
  lunge: [{ 2: { pel: [0.52, 0.14] }, 3: { pel: [0.52, 0.14] } }, { 2: { trunk: 32 }, 3: { trunk: 32 } }],
  bulgarian: [null, { '*': { fL: [0.12, 0.08, 0.06] } }],
  step_up: [{ 1: { kpL: [-0.5, 0, 1] }, 2: { kpL: [-0.5, 0, 1] } }, { 1: { kpL: [-0.5, 0, 1] } }],
  leg_press: [{ 0: { f: [0.15, 1.04, 0.71] }, 1: { f: [0.15, 1.04, 0.71] } }, { 2: { f: [0.15, 0.66, 0.26], pel: [0.56, 0.07] }, 3: { f: [0.15, 0.66, 0.26], pel: [0.56, 0.07] } }],
  leg_curl: [{ 2: { pel: [0.78, -0.02], trunk: 78 }, 3: { pel: [0.78, -0.02], trunk: 78 } }, null],
  calf: [null, { 2: { pel: [1.0, 0.01], f: [0.12, 0.12, 0], fp: 16 }, 3: { pel: [1.0, 0.01], f: [0.12, 0.12, 0], fp: 16 } }],
  hip_thrust: [{ 2: { trunk: -102, head: 65 }, 3: { trunk: -102, head: 65 } }, { '*': { f: [0.18, 0.08, 0.68] } }],
  adductor: [null, { '*': { trunk: 16 } }],
  bench: [{ 2: { ep: [1, 0, 0], h: [0.46, 0.76, -0.32] }, 3: { ep: [1, 0, 0], h: [0.46, 0.76, -0.32] } }, null, { 2: { pel: [0.7, 0.12] }, 3: { pel: [0.7, 0.12] } }],
  bench_close: [null, { 2: { ep: [1, -0.15, 0] }, 3: { ep: [1, -0.15, 0] } }],
  incline_press: [null, { 2: { ht: [0.34, 0.5, 0.26] }, 3: { ht: [0.34, 0.5, 0.26] } }],
  pushup: [{ 0: sag(L0(0.66, 0.4), -0.12), 1: sag(L0(0.66, 0.4), -0.12), 2: sag(L0(0.25, 0.46), -0.08), 3: sag(L0(0.25, 0.46), -0.08) }, { 2: { ep: [1, 0.3, 0] }, 3: { ep: [1, 0.3, 0] } }, { 2: { ...L0(0.5, 0.42), head: 30 }, 3: { ...L0(0.5, 0.42), head: 30 } }],
  fly_cable: [{ 2: { h: [0.12, 1.3, 0.36], ep: [0.6, -0.3, -1] }, 3: { h: [0.12, 1.3, 0.36], ep: [0.6, -0.3, -1] } }, { 2: { sh: 0.06 }, 3: { sh: 0.06 } }],
  fly_low: [{ 2: { h: [0.1, 1.08, 0.3] }, 3: { h: [0.1, 1.08, 0.3] } }, { 1: { trunk: -12 }, 2: { trunk: 18 } }],
  pec_deck: [null, { 2: { trunk: 16 }, 3: { trunk: 16 } }],
  dip: [{ 2: { pel: [1.06, -0.17], trunk: 22 }, 3: { pel: [1.06, -0.17], trunk: 22 } }, { '*': { sh: 0.05 } }],
  dip_chest: [{ '*': { trunk: 4 } }, { 2: { pel: [1.06, -0.24], trunk: 38 }, 3: { pel: [1.06, -0.24], trunk: 38 } }],
  svend: [null],
  row_bb: [{ 2: { trunk: 32, pel: [0.92, -0.18] }, 3: { trunk: 32, pel: [0.92, -0.18] } }, { '*': { lumbar: 26 } }],
  seated_row: [{ 0: { trunk: 40 }, 1: { trunk: 40 }, 2: { trunk: -26 }, 3: { trunk: -26 } }, { 2: { sh: 0.06 }, 3: { sh: 0.06 } }],
  pulldown: [{ 2: { trunk: -40 }, 3: { trunk: -40 } }, { 2: { trunk: 6, h: [0.4, 1.3, -0.16] }, 3: { trunk: 6, h: [0.4, 1.3, -0.16] } }],
  pulldown_close: [{ 2: { h: [0.06, 1.3, 0.3], ep: [0.4, -0.2, 1] }, 3: { h: [0.06, 1.3, 0.3], ep: [0.4, -0.2, 1] } }, { 2: { trunk: -36 }, 3: { trunk: -36 } }],
  pullup: [{ 2: { trunk: 18, fo: [0.08, -0.62, 0.3] }, 3: { trunk: 18, fo: [0.08, -0.62, 0.3] } }, { 0: { pel: [1.46, -0.04] }, 1: { pel: [1.46, -0.04] } }],
  pullover: [{ 3: { h: [0.22, 1.2, 0.22], ep: [0.4, -0.6, -1] }, 4: { h: [0.22, 1.2, 0.22], ep: [0.4, -0.6, -1] } }],
  shrug: [null, { 2: { hs: [0.04, -0.45, 0.14] }, 3: { hs: [0.04, -0.45, 0.14] } }],
  ohp: [{ 2: { trunk: -16 }, 3: { trunk: -13 }, 4: { trunk: -13 }, 5: { trunk: -16 } }, { 3: { h: [0.24, 1.94, 0.26] }, 4: { h: [0.24, 1.94, 0.26] } }],
  db_press: [{ '*': { trunk: -18, pel: [0.55, 0.03] } }, { 0: { h: [0.33, 1.24, 0.03] }, 1: { h: [0.33, 1.24, 0.03] } }],
  lateral: [{ 3: { sh: 0.065 }, 4: { sh: 0.065 } }, { 1: { trunk: 14 }, 3: { trunk: -12 }, 4: { trunk: -12 } }, { 3: { h: [0.6, 1.7, 0.1] }, 4: { h: [0.6, 1.7, 0.1] } }],
  front_raise: [{ 3: { trunk: -16 }, 4: { trunk: -16 } }],
  rear_fly: [{ 2: { trunk: 42, pel: [0.92, -0.2] }, 3: { trunk: 42, pel: [0.92, -0.2] } }, { 2: { ht: [0.3, 0.32, -0.06] }, 3: { ht: [0.3, 0.32, -0.06] } }],
  face_pull: [{ 2: { ep: [1, -0.8, -0.4], h: [0.3, 1.45, 0.1] }, 3: { ep: [1, -0.8, -0.4], h: [0.3, 1.45, 0.1] } }, { 2: { trunk: -18 }, 3: { trunk: -18 } }],
  upright_row: [{ 2: { h: [0.14, 1.5, 0.16] }, 3: { h: [0.14, 1.5, 0.16] } }],
  curl_bb: [{ 3: { trunk: -16 }, 4: { trunk: -16 }, 2: { trunk: -8 } }, { 3: { h: [0.21, 1.38, 0.38], ep: [0.1, -1, 0.3] }, 4: { h: [0.21, 1.38, 0.38], ep: [0.1, -1, 0.3] } }],
  curl_db: [{ 3: { trunk: -16 }, 4: { trunk: -16 }, 2: { trunk: -8 } }, { 0: { h: [0.22, 1.0, 0.24] }, 1: { h: [0.22, 1.0, 0.24] }, 6: { h: [0.22, 1.0, 0.24] } }],
  hammer: [{ 3: { h: [0.22, 1.38, 0.38], ep: [0.15, -1, 0.3] }, 4: { h: [0.22, 1.38, 0.38], ep: [0.15, -1, 0.3] } }],
  pushdown: [{ '*': { ep: [1, -0.2, -0.3] } }, { '*': { trunk: 32, pel: [0.92, -0.12] } }],
  skull: [{ '*': { ep: [1, 0.4, 0.2] } }, { 2: { h: [0.13, 0.62, -0.72], ep: [0.15, 0.3, 1] }, 3: { h: [0.13, 0.62, -0.72], ep: [0.15, 0.3, 1] } }],
  overhead_tri: [{ '*': { ep: [1, 0.3, 0.1] } }, { '*': { trunk: -12 } }],
  kickback: [{ '*': { ep: [0.1, -1, 0.3] }, 2: { h: [0.2, 0.62, -0.3] }, 3: { h: [0.2, 0.62, -0.3] } }, { 2: { trunk: 50 }, 3: { trunk: 50 } }],
  plank: [{ 0: sag(L0(0.36, 0.3), -0.12), 1: sag(L0(0.375, 0.3), -0.12) }, { 0: sag(L0(0.36, 0.3), 0.18), 1: sag(L0(0.375, 0.3), 0.18) }, null],
  crunch: [{ 2: { lumbar: 30, head: 38 }, 3: { lumbar: 30, head: 38 } }, { 2: { lumbar: 40, trunk: -38 }, 3: { lumbar: 40, trunk: -38 } }],
  leg_raise: [{ '*': { lumbar: -14 } }, { 3: { f: [0.08, 0.965, 0.226], kp: [0, 0.26, -0.97] }, 4: { f: [0.08, 0.952, -0.270], kp: [0, -0.31, -0.95] }, 5: { f: [0.08, 0.952, -0.270], kp: [0, -0.31, -0.95] } }],
  cable_crunch: [{ 2: { pel: [0.32, -0.47], trunk: 42, lumbar: 18 }, 3: { pel: [0.32, -0.47], trunk: 42, lumbar: 18 } }, null],
  russian_twist: [{ '*': { yaw: 0 }, 0: { htL: [0.34, 0.26, 0.26], htR: [0.26, 0.3, 0.3] }, 1: { htL: [-0.26, 0.3, 0.3], htR: [-0.34, 0.26, 0.26] } }, { '*': { lumbar: 26 } }],
  dead_bug: [{ '*': { lumbar: -16 } }, null],
  hollow: [{ '*': { trunk: -60, lumbar: -14 } }, null],
  pallof: [{ 2: { yaw: -26 }, 3: { yaw: -26 } }],
  woodchop: [{ '*': { yaw: 0 } }, { '*': { lumbar: 24 } }],
  ab_wheel: [{ 2: { pel: [0.17, 0.36], trunk: 88, lumbar: -16 }, 3: { pel: [0.17, 0.36], trunk: 88, lumbar: -16 } }, { 2: { h: [0.12, 0.17, 1.55], pel: [0.16, 0.42], trunk: 90, lumbar: -20 }, 3: { h: [0.12, 0.17, 1.55], pel: [0.16, 0.42], trunk: 90, lumbar: -20 } }],
  box_jump: [{ 3: { kp: [-0.6, 0, 1] }, 4: { kp: [-0.6, 0, 1] } }, null],
  machine_press: [{ 2: { trunk: 4 }, 3: { trunk: 4 } }, { '*': { ep: [1, 0.3, 0] } }],
  decline: [{ 2: { ht: [0.3, 0.46, 0.18] }, 3: { ht: [0.3, 0.46, 0.18] } }, null],
  row_db: [{ 2: { yaw: -28 }, 3: { yaw: -28 } }, { 2: { htR: [-0.22, 0.36, 0.2] }, 3: { htR: [-0.22, 0.36, 0.2] } }],
  tbar: [{ 2: { trunk: 28, pel: [0.9, -0.15] }, 3: { trunk: 28, pel: [0.9, -0.15] } }, { '*': { lumbar: 26 } }],
  row_chest: [{ 2: { trunk: 35, pel: [0.84, -0.32] }, 3: { trunk: 35, pel: [0.84, -0.32] } }, { 2: { sh: 0.06 }, 3: { sh: 0.06 } }],
  back_ext: [{ 0: { trunk: 25 }, 1: { trunk: 25 } }, null],
  hack: [{ 2: { kp: [-0.6, 0, 1] }, 3: { kp: [-0.6, 0, 1] } }, { 2: { fp: 25, f: [0.17, 0.17, 0.29] }, 3: { fp: 25, f: [0.17, 0.17, 0.29] } }],
  sissy: [{ 2: { pel: [0.5, -0.2], trunk: 20 }, 3: { pel: [0.5, -0.2], trunk: 20 } }, null],
  nordic: [{ 2: { pel: [0.3, 0.12], trunk: 75 }, 3: { pel: [0.3, 0.12], trunk: 75 } }, null],
  rev_fly_machine: [{ 3: { sh: 0.06 }, 4: { sh: 0.06 } }, { 3: { trunk: -14 }, 4: { trunk: -14 } }],
  lateral_cable: [{ 2: { roll: -18 }, 3: { roll: -18 } }, { 2: { sh: 0.065 }, 3: { sh: 0.065 } }],
  y_raise: [{ 3: { sh: 0.06 }, 4: { sh: 0.06 } }, { 3: { head: -40 }, 4: { head: -40 } }],
  lu: [{ 3: { trunk: -16 }, 4: { trunk: -16 } }, null],
  curl_cable: [{ 3: { trunk: -16 }, 4: { trunk: -16 } }, { 3: { h: [0.21, 1.38, 0.38], ep: [0.1, -1, 0.3] }, 4: { h: [0.21, 1.38, 0.38], ep: [0.1, -1, 0.3] } }],
  curl_drag: [{ 2: { h: [0.21, 1.2, 0.36] }, 3: { h: [0.21, 1.2, 0.36] } }, { 2: { trunk: -15 }, 3: { trunk: -15 } }],
  curl_reverse: [null, { 3: { trunk: -15 }, 4: { trunk: -15 } }],
  jm: [{ '*': { ep: [1, 0, 0.3] } }, { 2: { h: [0.14, 0.72, -0.2], ep: [1, -0.6, 0.3] }, 3: { h: [0.14, 0.72, -0.2], ep: [1, -0.6, 0.3] } }],
  burpee: [{ 2: sag(line(0.66, 0.4), -0.12), 3: sag(line(0.28, 0.46), -0.08), 4: sag(line(0.66, 0.4), -0.12) }, null]
};
for (const [id, list] of Object.entries(PATCH)) {
  const m = MOVES[id]; if (!m || !m.mistakes) continue;
  list.forEach((p, i) => { if (p && m.mistakes[i]) m.mistakes[i].patch = p; });
}

export const MOVE_IDS = Object.keys(MOVES);
