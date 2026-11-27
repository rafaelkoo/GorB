// 6 new monster concepts drawn in the exact 48x40 pixel-art style of js/pixel.js (drawBoss).
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
