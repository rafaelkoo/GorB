// 10 new monster concepts drawn in the exact 48x40 pixel-art style of js/pixel.js (drawBoss).
const OUT = '#231a17';

export const NEW_MONSTERS = [
  {
    en: 'Skip-Leg-Day Flamingo', zh: '走佬腳雞 Flamingo',
    tier: 'Tower Wild', type: 'Speed', move: 'Skip Squat',
    desc: 'Massive upper-body flex, 1-pixel stick legs. Vanishes every Leg Day.',
    evo: { en: 'Squatting Flamingo', zh: '深蹲巨鳥', move: 'Bulgarian Split' }
  },
  {
    en: 'Bench-Hog Mimic', zh: '霸機寶箱怪',
    tier: 'Tower Wild', type: 'Defence', move: 'Bench Camp',
    desc: 'Sits on the only flat bench for 40 minutes texting on a glowing phone.',
    evo: { en: 'Free-Weight Knight', zh: '自由重量騎士', move: 'Superset Slash' }
  },
  {
    en: 'One-More-Game Gremlin', zh: '打多鋪先小鬼',
    tier: 'Tower Wild', type: 'Technique', move: 'In Queue',
    desc: '"One more match then I\'ll change." Suddenly the gym is closed.',
    evo: { en: 'IRL Grinder', zh: '現實升級勇者', move: 'Daily Quest' }
  },
  {
    en: 'Laundry-Pile Golem', zh: '污糟衫山怪',
    tier: 'Tower Wild', type: 'HP', move: 'Missing Sock',
    desc: 'Built from wrinkled gym tees and one missing sock. Blocks the doorway.',
    evo: { en: 'Gear-Ready Golem', zh: '潔癖裝備師', move: 'Fresh Kit' }
  },
  {
    en: 'All-You-Can-Eat Whale', zh: '放題巨鯨',
    tier: 'Tower Boss', type: 'HP / Attack', move: 'Last Buffet',
    desc: '"Diet starts next month, let\'s hit the buffet first."',
    evo: { en: 'Bulking Whale', zh: '增肌巨鯨', move: 'Clean Bulk' }
  },
  {
    en: 'Hotpot Cauldron', zh: '宵夜邊爐鍋怪',
    tier: 'Weekly Raid Legend', type: 'Boss', move: 'Mala Temptation',
    desc: 'Turns a post-gym dinner plan into skipping the gym altogether.',
    evo: null
  },
  {
    en: 'Mirror-Flex Peacock', zh: '鏡前自拍孔雀',
    tier: 'Tower Wild', type: 'Technique', move: 'Flash Pose',
    desc: 'Spends 20 minutes flexing in the mirror for a story, zero sets logged.',
    evo: { en: 'PR-Day Peacock', zh: '破紀錄孔雀', move: 'Plate Fan' }
  },
  {
    en: 'Pre-Workout Crab', zh: '發抖蟹',
    tier: 'Tower Wild', type: 'Speed', move: 'Beta Tingle',
    desc: 'Took two scoops of pre-workout, now just scratching its shell and pacing.',
    evo: { en: 'Espresso Crab', zh: '黑咖啡鐵蟹', move: 'Clean Pinch' }
  },
  {
    en: 'Traffic Snail', zh: '塞車蝸牛',
    tier: 'Tower Wild', type: 'Defence', move: 'Red Light',
    desc: '"Gym is too far and traffic is brutal, I\'ll go tomorrow."',
    evo: { en: 'Spin-Bike Snail', zh: '飛輪蝸牛', move: 'Turbo Cadence' }
  },
  {
    en: 'Nap-Stretch Snake', zh: '拉筋瞓著蛇',
    tier: 'Tower Wild', type: 'HP', move: 'Foam-Roll Nap',
    desc: 'Rolled out the yoga mat to "stretch for 5 minutes", woke up 2 hours later.',
    evo: { en: 'Mobility Python', zh: '靈活性巨蟒', move: 'Deep Squat' }
  }
];

export function drawNewMonster(canvas, idx, frame = 0, state = 'idle', evolved = false) {
  const lo = document.createElement('canvas');
  lo.width = 48; lo.height = 40;
  const c = lo.getContext('2d');
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const ko = state === 'ko', b = ko ? 0 : frame;
  const base = ko ? 4 : 0;

  const eyes = (x1, x2, y, col = '#fff') => {
    if (ko) {
      for (const x of [x1, x2]) {
        r(x, y, 1, 1, OUT); r(x + 2, y, 1, 1, OUT); r(x + 1, y + 1, 1, 1, OUT); r(x, y + 2, 1, 1, OUT); r(x + 2, y + 2, 1, 1, OUT);
      }
      return;
    }
    for (const x of [x1, x2]) {
      r(x, y, 3, 3, col);
      r(x + 1 + frame, y + 1, 1, 2, OUT);
    }
    r(x1 - 1, y - 2, 4, 1, OUT); r(x2, y - 2, 4, 1, OUT);
  };

  // ground shadow
  r(6, 37, 36, 2, 'rgba(0,0,0,.28)');

  switch (idx) {
    case 0: { // Skip-Leg-Day Flamingo -> Squatting Flamingo
      const y = 3 + base + b;
      const pink = evolved ? '#f06292' : '#f48fb1', pinkD = '#c2185b';
      if (evolved) {
        // thick muscular squat legs + barbell on shoulders
        r(16, y + 23, 5, 10, pinkD); r(27, y + 23, 5, 10, pinkD);
        r(15, y + 33, 6, 2, '#f2c230'); r(27, y + 33, 6, 2, '#f2c230');
        r(5, y + 12, 38, 2, '#9aa3ad');
        r(3, y + 8, 3, 10, '#3c414a'); r(6, y + 9, 2, 8, '#e0342f');
        r(42, y + 8, 3, 10, '#3c414a'); r(40, y + 9, 2, 8, '#e0342f');
      } else {
        // comical 1px stick legs
        r(20, y + 24, 1, 10, '#f2c230'); r(27, y + 24, 1, 10, '#f2c230');
        r(18, y + 34, 4, 1, '#f2c230'); r(27, y + 34, 4, 1, '#f2c230');
      }
      // huge buffed chest & flexing arms
      r(14, y + 12, 20, 13, pink); r(16, y + 14, 16, 9, pinkD);
      r(9, y + 11 - frame, 5, 8, pink); r(34, y + 11 - frame, 5, 8, pink); // bicep flex
      r(9, y + 9 - frame, 4, 3, pinkD); r(35, y + 9 - frame, 4, 3, pinkD);
      // neck & head + beak
      r(21, y + 5, 6, 8, pink);
      r(19, y, 11, 7, pink);
      r(28, y + 3, 6, 3, '#2b2b30'); r(32, y + 5, 2, 2, '#eef0ea'); // beak
      eyes(21, 25, y + 2);
      if (evolved) r(19, y + 1, 11, 2, '#e0342f'); // sweatband
      break;
    }
    case 1: { // Bench-Hog Mimic -> Free-Weight Knight
      const y = 6 + base + b;
      if (evolved) {
        // Silver Free-Weight Knight with dumbbell shield
        r(14, y + 10, 20, 18, '#9aa3ad'); r(16, y + 12, 16, 14, '#5d6470');
        r(16, y + 2, 16, 10, '#9aa3ad'); r(18, y + 5, 12, 4, OUT); // visor
        r(22, y - 2, 4, 4, '#e0342f'); // helmet plume
        if (!ko) { r(20, y + 6, 2, 2, '#f2c230'); r(26, y + 6, 2, 2, '#f2c230'); }
        // dumbbell shield on left
        r(6, y + 12, 9, 14, '#3c414a'); r(7, y + 13, 7, 12, '#e0342f'); r(9, y + 16, 3, 6, '#eef0ea');
        // barbell sword on right
        r(36, y + 4, 3, 20, '#9aa3ad'); r(34, y + 18, 7, 2, '#f2c230');
        r(16, y + 28, 6, 5, '#3c414a'); r(26, y + 28, 6, 5, '#3c414a');
      } else {
        // Bench-Hog Mimic: bench jaws + teeth + glowing phone
        r(8, y + 24, 4, 8, '#5d6470'); r(36, y + 24, 4, 8, '#5d6470'); // bench legs
        r(6, y + 18, 36, 7, '#3c414a'); r(8, y + 19, 32, 5, '#2b2b30'); // bottom bench
        r(8, y + 4 - frame, 32, 10, '#5d6470'); // top jaw
        // teeth
        for (let tx = 11; tx <= 33; tx += 5) {
          r(tx, y + 14 - frame, 2, 2, '#eef0ea');
          r(tx + 2, y + 17, 2, 2, '#eef0ea');
        }
        // tongue + glowing phone
        r(18, y + 16, 12, 3, '#e86a6a');
        r(21, y + 12, 6, 7, '#231a17'); r(22, y + 13, 4, 5, '#4d8df0');
        eyes(14, 30, y + 7 - frame, '#f2c230');
      }
      break;
    }
    case 2: { // One-More-Game Gremlin -> IRL Grinder
      const y = 7 + base + b;
      const grn = '#45b45a', grnD = '#2d6b45';
      // pointy ears
      r(8, y + 6, 6, 4, grn); r(34, y + 6, 6, 4, grn);
      // head & body
      r(14, y + 2, 20, 14, grn); r(16, y + 15, 16, 12, grnD);
      r(16, y + 27, 5, 4, grnD); r(27, y + 27, 5, 4, grnD);
      if (evolved) {
        // sweatband + shaker bottle + jump rope
        r(14, y + 3, 20, 2, '#e0342f');
        eyes(17, 27, y + 7);
        r(9, y + 16, 5, 10, '#4d8df0'); r(10, y + 14, 3, 2, '#eef0ea'); // shaker
        r(34, y + 15, 3, 6, '#e0342f'); r(35, y + 21, 5, 8, '#f2c230'); // jump rope
      } else {
        // headset + tired eye bags + glowing controller
        r(13, y + 1, 22, 2, '#2b2b30');
        r(12, y + 4, 3, 7, '#e0342f'); r(33, y + 4, 3, 7, '#e0342f');
        eyes(17, 27, y + 6, '#eef0ea');
        r(17, y + 9, 4, 1, '#6b3fa0'); r(27, y + 9, 4, 1, '#6b3fa0'); // dark circles
        // controller
        r(15, y + 20 - frame, 18, 7, '#2b2b30');
        r(17, y + 22 - frame, 3, 3, '#9aa3ad');
        r(28, y + 22 - frame, 2, 2, '#e0342f'); r(30, y + 23 - frame, 2, 2, '#4d8df0');
      }
      break;
    }
    case 3: { // Laundry-Pile Golem -> Gear-Ready Golem
      const y = 6 + base + b;
      if (evolved) {
        // Clean muscular grey golem in crisp red gym tank + gold belt
        r(12, y + 10, 24, 18, '#9aa3ad'); r(14, y + 11, 20, 12, '#e0342f'); // crisp tank
        r(14, y + 23, 20, 3, '#f2c230'); // gold belt
        r(16, y + 1, 16, 10, '#9aa3ad');
        r(16, y + 2, 16, 2, '#eef0ea'); // clean headband
        eyes(18, 27, y + 5);
        r(7, y + 12, 5, 13, '#5d6470'); r(36, y + 12, 5, 13, '#5d6470');
        r(14, y + 28, 7, 5, '#3c414a'); r(27, y + 28, 7, 5, '#3c414a');
      } else {
        // Lumpy laundry mountain + single mismatched sock on top
        r(10, y + 18, 28, 13, '#6a6f78');
        r(12, y + 10, 24, 10, '#8a6948');
        r(16, y + 4, 16, 8, '#a4abb2');
        // wrinkled shirt sleeves sticking out
        r(6, y + 16, 6, 8, '#35466a'); r(36, y + 18, 6, 7, '#7c2c2c');
        // single sock flopping on head
        r(24, y - 2, 4, 6, '#eef0ea'); r(24, y - 2, 4, 2, '#e0342f'); r(27, y + 2, 4, 2, '#eef0ea');
        eyes(18, 27, y + 11, '#f2c230');
        r(19, y + 17, 10, 2, OUT);
      }
      break;
    }
    case 4: { // All-You-Can-Eat Whale -> Bulking Whale
      const y = 6 + base + b;
      const bl = evolved ? '#2e6b9e' : '#35466a', bel = '#c8d6e5';
      // tail fin
      r(3, y + 16 - frame, 7, 6, bl); r(1, y + 12 - frame, 5, 5, bl); r(1, y + 21 - frame, 5, 5, bl);
      // huge whale body
      r(9, y + 8, 32, 20, bl); r(12, y + 5, 24, 5, bl);
      r(14, y + 22, 26, 6, bel); // ribbed belly
      eyes(28, 35, y + 12);
      if (evolved) {
        // protein spout + biting dumbbell + gold crown
        r(22, y - 3 - frame, 3, 8, '#93c5fd'); r(19, y - 4 - frame, 9, 3, '#eef0ea');
        r(22, y + 1, 10, 4, '#f2c230'); // crown
        // dumbbell in mouth
        r(34, y + 18, 10, 2, '#9aa3ad');
        r(32, y + 15, 3, 8, '#e0342f'); r(42, y + 15, 3, 8, '#e0342f');
      } else {
        // open mouth chomping sushi/steak
        r(31, y + 17, 11, 7, '#7a2c3a');
        r(36, y + 18, 5, 3, '#eef0ea'); r(36, y + 17, 5, 2, '#e0342f'); // sushi
        r(33, y + 22, 4, 3, '#c98a5a'); // meat
      }
      break;
    }
    case 5: { // Hotpot Cauldron (Weekly Raid Legend)
      const y = 7 + base + b;
      // steam & ghostly flame eyes above pot
      r(13, y - 3 - frame, 4, 5, '#eef0ea'); r(22, y - 5 - frame, 4, 7, '#eef0ea'); r(31, y - 2 - frame, 4, 4, '#eef0ea');
      // bubbling spicy mala broth on top
      r(10, y + 5, 28, 6, '#e0342f'); r(12, y + 4, 24, 3, '#f19a33');
      // beef roll & fishballs poking out
      r(13, y + 3 - frame, 5, 4, '#e86a6a'); r(29, y + 3 + frame, 4, 4, '#f2d245');
      // iron cauldron pot
      r(8, y + 9, 32, 20, '#2b2b30'); r(6, y + 11, 4, 6, '#5d6470'); r(38, y + 11, 4, 6, '#5d6470');
      r(10, y + 29, 6, 3, '#3c414a'); r(32, y + 29, 6, 3, '#3c414a');
      // menacing fiery face on pot
      eyes(16, 28, y + 14, '#f2c230');
      if (!ko) { r(18, y + 21, 12, 3, '#e0342f'); r(20, y + 21, 2, 2, '#f2c230'); r(26, y + 21, 2, 2, '#f2c230'); }
      break;
    }
    case 6: { // Mirror-Flex Peacock -> PR-Day Peacock
      const y = 4 + base + b;
      if (evolved) {
        // Tail fan made of iron weight plates + barbell
        r(6, y + 4, 36, 18, '#3c414a');
        r(9, y + 6, 30, 14, '#5d6470');
        r(12, y + 8, 24, 10, '#e0342f');
        r(17, y + 12, 14, 18, '#2e9fd6'); // chest
        r(20, y + 4, 8, 9, '#2e9fd6'); // head
        r(19, y + 5, 10, 2, '#f2c230'); // gold headband
        eyes(21, 25, y + 7);
        r(22, y + 10, 4, 2, '#f2c230'); // beak
        // barbell overhead
        r(6, y + 1, 36, 2, '#9aa3ad');
        r(4, y - 1, 3, 6, '#e0342f'); r(41, y - 1, 3, 6, '#e0342f');
        r(19, y + 30, 3, 4, '#f2c230'); r(26, y + 30, 3, 4, '#f2c230');
      } else {
        // Peacock tail with camera-flash eyes + holding selfie phone
        r(6, y + 4, 36, 18, '#1f6b40'); r(10, y + 6, 28, 14, '#35a565');
        for (const [fx, fy] of [[9, y + 7], [22, y + 5], [35, y + 7], [13, y + 14], [31, y + 14]]) {
          r(fx, fy, 4, 4, '#4d8df0'); r(fx + 1, fy + 1, 2, 2, frame ? '#eef0ea' : '#f2c230');
        }
        r(18, y + 13, 12, 16, '#2e9fd6'); // body
        r(20, y + 5, 8, 9, '#2e9fd6'); // head
        eyes(21, 25, y + 8);
        r(22, y + 11, 4, 2, '#f2c230');
        // selfie phone & wing
        r(32, y + 13 - frame, 5, 8, '#2b2b30'); r(33, y + 14 - frame, 3, 5, '#93c5fd');
        if (frame) { r(31, y + 11, 2, 2, '#eef0ea'); r(37, y + 11, 2, 2, '#eef0ea'); }
        r(20, y + 29, 2, 5, '#f2c230'); r(26, y + 29, 2, 5, '#f2c230');
      }
      break;
    }
    case 7: { // Pre-Workout Crab -> Espresso Crab
      const y = 9 + base + b;
      const sh = evolved ? '#6e4429' : '#e0342f', shL = evolved ? '#9b6a3a' : '#f19a33';
      // legs
      for (const lx of [8, 12, 32, 36]) r(lx, y + 22, 3, 5, sh);
      // shell
      r(11, y + 9, 26, 15, sh); r(14, y + 7, 20, 4, shL);
      eyes(17, 28, y + 13);
      if (evolved) {
        // espresso crab lifting dumbbell cleanly
        r(4, y + 6 - frame, 6, 8, sh); r(38, y + 6 - frame, 6, 8, sh);
        r(3, y + 3 - frame, 42, 2, '#9aa3ad');
        r(2, y + 1 - frame, 3, 6, '#3c414a'); r(43, y + 1 - frame, 3, 6, '#3c414a');
        r(19, y + 18, 10, 5, '#eef0ea'); r(21, y + 19, 6, 3, '#2a1f18'); // coffee cup badge
      } else {
        // jittery claws + tingle sparks + shaker
        const jit = frame ? 1 : -1;
        r(4 + jit, y + 8, 6, 8, sh); r(38 - jit, y + 8, 6, 8, sh);
        r(4 + jit, y + 4, 2, 4, shL); r(42 - jit, y + 4, 2, 4, shL);
        r(19, y + 17, 10, 8, '#4d8df0'); r(20, y + 15, 8, 2, '#eef0ea'); // shaker
        // tingle sparks
        r(8, y + 2 + frame, 2, 2, '#e66fab'); r(38, y + 3 - frame, 2, 2, '#f2c230');
      }
      break;
    }
    case 8: { // Traffic Snail -> Spin-Bike Snail
      const y = 7 + base + b;
      const bodyCol = '#d99d6c';
      // snail body & eyestalks
      r(8, y + 22, 32, 8, bodyCol); r(34, y + 16, 7, 10, bodyCol);
      r(35, y + 11, 2, 6, bodyCol); r(39, y + 11, 2, 6, bodyCol);
      eyes(34, 38, y + 8);
      if (evolved) {
        // spin-bike wheel shell + red pedal
        r(9, y + 6, 22, 20, '#3c414a'); r(11, y + 8, 18, 16, '#9aa3ad');
        r(14, y + 11, 12, 10, '#1d2125'); r(18, y + 14, 4, 4, '#e0342f');
        // speed lines
        r(2, y + 10 + frame, 5, 2, '#4d8df0'); r(3, y + 16 - frame, 4, 2, '#4d8df0');
      } else {
        // shell with traffic light stuck on top
        r(10, y + 8, 20, 16, '#8a6948'); r(13, y + 11, 14, 10, '#c98a5a');
        r(17, y - 1, 6, 11, '#2b2b30');
        r(19, y + 1, 2, 2, '#e0342f'); // red light
        r(19, y + 4, 2, 2, '#5d6470');
        r(19, y + 7, 2, 2, '#5d6470');
      }
      break;
    }
    case 9: { // Nap-Stretch Snake -> Mobility Python
      const y = 7 + base + b;
      const snk = evolved ? '#35a565' : '#8fcf7a', snkD = '#2d6b45';
      // yoga mat under it
      r(5, y + 26, 38, 4, '#4d8df0'); r(7, y + 27, 34, 2, '#93c5fd');
      if (evolved) {
        // upright strong cobra/python with headband & kettlebell
        r(13, y + 18, 22, 8, snk); r(16, y + 8, 16, 12, snk);
        r(18, y + 2, 12, 8, snk);
        r(18, y + 3, 12, 2, '#e0342f'); // sweatband
        eyes(19, 27, y + 5);
        r(22, y + 11, 4, 12, '#f2d245'); // belly
        r(34, y + 17 - frame, 7, 8, '#3c414a'); r(36, y + 14 - frame, 3, 3, '#9aa3ad'); // kettlebell
      } else {
        // curled up snoozing on mat with Zzz
        r(10, y + 17, 28, 9, snk); r(13, y + 13, 22, 6, snkD);
        r(26, y + 12, 11, 8, snk);
        // sleepy closed eyes + drool
        r(28, y + 15, 3, 1, OUT); r(33, y + 15, 3, 1, OUT);
        r(35, y + 18, 2, 4 + frame, '#93c5fd'); // drool
        // Zzz
        r(33, y + 4 - frame, 4, 1, '#eef0ea'); r(35, y + 5 - frame, 1, 1, '#eef0ea'); r(33, y + 6 - frame, 4, 1, '#eef0ea');
      }
      break;
    }
  }

  if (ko) {
    r(18, 2, 2, 2, '#f2d245'); r(26, 0, 2, 2, '#f2d245'); r(32, 3, 2, 2, '#f2d245');
  }
  if (evolved) {
    // subtle gold sparkles matching pixel.js evolved spirit
    r(5 + frame, 5, 2, 2, '#f2d245');
    r(41 - frame, 7, 2, 2, '#f2d245');
  }

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.floor(Math.min(canvas.width / 48, canvas.height / 40));
  ctx.drawImage(lo, (canvas.width - 48 * s) / 2, (canvas.height - 40 * s) / 2, 48 * s, 40 * s);
}
