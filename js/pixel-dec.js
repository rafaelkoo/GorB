// December monsters (species 24–33), 48×40 like the others in pixel.js. Front, back (for your own pets in a fight)
// and evolved forms. Drawn from Rafael's art demo (js/demo-monsters.js), with backs added.
// r(x, y, w, h, colour) draws; eyes() draws nothing from behind; i = species − 24.
const OUT = '#231a17', WH = '#eef0ea', GOLD = '#f2c230', RED = '#e0342f', IRON = '#9aa3ad', IRON_D = '#3c414a', IRON_M = '#5d6470', PHONE = '#2b2b30';

export function drawDec(r, i, base, b, frame, ko, back, evolved, eyes) {
  switch (i) {
    case 0: {   // Skip-Leg-Day Flamingo → Squatting Flamingo
      const y = 3 + base + b, pink = evolved ? '#f06292' : '#f48fb1', pinkD = '#c2185b';
      if (evolved) {
        r(16, y + 23, 5, 10, pinkD); r(27, y + 23, 5, 10, pinkD); r(15, y + 33, 6, 2, GOLD); r(27, y + 33, 6, 2, GOLD);
        r(5, y + 12, 38, 2, IRON); r(3, y + 8, 3, 10, IRON_D); r(6, y + 9, 2, 8, RED); r(42, y + 8, 3, 10, IRON_D); r(40, y + 9, 2, 8, RED);
      } else { r(20, y + 24, 1, 10, GOLD); r(27, y + 24, 1, 10, GOLD); r(18, y + 34, 4, 1, GOLD); r(27, y + 34, 4, 1, GOLD); }
      r(14, y + 12, 20, 13, pink);
      if (back) { r(16, y + 14, 16, 2, pinkD); r(16, y + 18, 16, 2, pinkD); r(20, y + 22, 8, 4, pinkD); }   // folded wings and tail feathers
      else r(16, y + 14, 16, 9, pinkD);
      r(9, y + 11 - frame, 5, 8, pink); r(34, y + 11 - frame, 5, 8, pink); r(9, y + 9 - frame, 4, 3, pinkD); r(35, y + 9 - frame, 4, 3, pinkD);
      r(21, y + 5, 6, 8, pink); r(19, y, 11, 7, pink);
      if (!back) { r(28, y + 3, 6, 3, PHONE); r(32, y + 5, 2, 2, WH); }
      eyes(21, 25, y + 2);
      if (evolved) { r(19, y + 1, 11, 2, RED); if (back) { r(17, y + 3, 2, 3, RED); r(15, y + 4, 2, 2, RED); } }   // sweatband, knot at the back
      return true;
    }
    case 1: {   // Bench-Hog Mimic → Free-Weight Knight
      const y = 6 + base + b;
      if (evolved) {
        r(14, y + 10, 20, 18, IRON); r(16, y + 2, 16, 10, IRON); r(22, y - 2, 4, 4, RED);
        if (back) { r(14, y + 10, 20, 20, RED); r(14, y + 10, 20, 2, '#961e1b'); r(17, y + 4, 14, 1, IRON_M); }   // cape over the armour
        else { r(16, y + 12, 16, 14, IRON_M); r(18, y + 5, 12, 4, OUT); if (!ko) { r(20, y + 6, 2, 2, GOLD); r(26, y + 6, 2, 2, GOLD); } }
        r(6, y + 12, 9, 14, IRON_D); if (!back) { r(7, y + 13, 7, 12, RED); r(9, y + 16, 3, 6, WH); }   // dumbbell shield (its back from behind)
        r(36, y + 4, 3, 20, IRON); r(34, y + 18, 7, 2, GOLD);
        r(16, y + 28, 6, 5, IRON_D); r(26, y + 28, 6, 5, IRON_D);
      } else if (back) {   // the bench from behind: padded back, legs, a phone charger cable trailing out
        r(8, y + 24, 4, 8, IRON_M); r(36, y + 24, 4, 8, IRON_M);
        r(6, y + 4 - frame, 36, 21, IRON_D); r(8, y + 6 - frame, 32, 4, IRON_M); for (let k = 0; k < 4; k++) r(10 + k * 8, y + 12 - frame, 4, 1, '#2b2b30');
        r(40, y + 18, 2, 2, WH); r(42, y + 20, 2, 6, WH);
      } else {
        r(8, y + 24, 4, 8, IRON_M); r(36, y + 24, 4, 8, IRON_M); r(6, y + 18, 36, 7, IRON_D); r(8, y + 19, 32, 5, PHONE); r(8, y + 4 - frame, 32, 10, IRON_M);
        for (let tx = 11; tx <= 33; tx += 5) { r(tx, y + 14 - frame, 2, 2, WH); r(tx + 2, y + 17, 2, 2, WH); }
        r(18, y + 16, 12, 3, '#e86a6a'); r(21, y + 12, 6, 7, OUT); r(22, y + 13, 4, 5, '#4d8df0');
        eyes(14, 30, y + 7 - frame, GOLD);
      }
      return true;
    }
    case 2: {   // One-More-Game Gremlin → IRL Grinder
      const y = 7 + base + b, grn = '#45b45a', grnD = '#2d6b45';
      r(8, y + 6, 6, 4, grn); r(34, y + 6, 6, 4, grn); r(14, y + 2, 20, 14, grn); r(16, y + 15, 16, 12, grnD); r(16, y + 27, 5, 4, grnD); r(27, y + 27, 5, 4, grnD);
      if (back) r(22, y + 17, 4, 8, '#25593a');   // spine ridge
      if (evolved) {
        r(14, y + 3, 20, 2, RED); if (back) { r(22, y + 5, 4, 3, RED); r(24, y + 8, 2, 3, RED); }
        eyes(17, 27, y + 7);
        r(9, y + 16, 5, 10, '#4d8df0'); r(10, y + 14, 3, 2, WH); r(34, y + 15, 3, 6, RED); r(35, y + 21, 5, 8, GOLD);
      } else {
        r(13, y + 1, 22, 2, PHONE); r(12, y + 4, 3, 7, RED); r(33, y + 4, 3, 7, RED);
        if (back) { r(16, y + 20, 16, 2, PHONE); r(30, y + 22, 2, 6, PHONE); }   // controller cable over the shoulder
        else {
          eyes(17, 27, y + 6, WH); r(17, y + 9, 4, 1, '#6b3fa0'); r(27, y + 9, 4, 1, '#6b3fa0');
          r(15, y + 20 - frame, 18, 7, PHONE); r(17, y + 22 - frame, 3, 3, IRON); r(28, y + 22 - frame, 2, 2, RED); r(30, y + 23 - frame, 2, 2, '#4d8df0');
        }
      }
      return true;
    }
    case 3: {   // Laundry-Pile Golem → Gear-Ready Golem
      const y = 6 + base + b;
      if (evolved) {
        r(12, y + 10, 24, 18, IRON); r(14, y + 11, 20, 12, RED); r(14, y + 23, 20, 3, GOLD); r(16, y + 1, 16, 10, IRON); r(16, y + 2, 16, 2, WH);
        if (back) { r(18, y + 13, 12, 1, '#961e1b'); r(23, y + 23, 2, 3, '#b58414'); } else eyes(18, 27, y + 5);
        r(7, y + 12, 5, 13, IRON_M); r(36, y + 12, 5, 13, IRON_M); r(14, y + 28, 7, 5, IRON_D); r(27, y + 28, 7, 5, IRON_D);
      } else {
        r(10, y + 18, 28, 13, '#6a6f78'); r(12, y + 10, 24, 10, '#8a6948'); r(16, y + 4, 16, 8, '#a4abb2');
        r(6, y + 16, 6, 8, back ? '#7c2c2c' : '#35466a'); r(36, y + 18, 6, 7, back ? '#35466a' : '#7c2c2c');   // sleeves swap sides from behind
        r(24, y - 2, 4, 6, WH); r(24, y - 2, 4, 2, RED); r(27, y + 2, 4, 2, WH);
        if (back) { r(14, y + 22, 8, 3, '#4d8df0'); r(26, y + 13, 6, 2, '#c95aa0'); }   // more clothes in the pile
        else { eyes(18, 27, y + 11, GOLD); r(19, y + 17, 10, 2, OUT); }
      }
      return true;
    }
    case 4: {   // All-You-Can-Eat Whale → Bulking Whale (tower boss)
      const y = 6 + base + b, bl = evolved ? '#2e6b9e' : '#35466a';
      r(3, y + 16 - frame, 7, 6, bl); r(1, y + 12 - frame, 5, 5, bl); r(1, y + 21 - frame, 5, 5, bl);
      r(9, y + 8, 32, 20, bl); r(12, y + 5, 24, 5, bl);
      if (back) { r(22, y + 6, 4, 2, '#1d2c44'); r(14, y + 12, 22, 1, '#2a3a58'); r(16, y + 18, 18, 1, '#2a3a58'); }   // blowhole, back ridges
      else { r(14, y + 22, 26, 6, '#c8d6e5'); eyes(28, 35, y + 12); }
      if (evolved) {
        r(22, y - 3 - frame, 3, 8, '#93c5fd'); r(19, y - 4 - frame, 9, 3, WH); r(22, y + 1, 10, 4, GOLD);
        if (!back) { r(34, y + 18, 10, 2, IRON); r(32, y + 15, 3, 8, RED); r(42, y + 15, 3, 8, RED); }
      } else if (back) { r(23, y + 1 - frame, 2, 4, '#93c5fd'); }   // a little spout
      else { r(31, y + 17, 11, 7, '#7a2c3a'); r(36, y + 18, 5, 3, WH); r(36, y + 17, 5, 2, RED); r(33, y + 22, 4, 3, '#c98a5a'); }
      return true;
    }
    case 5: {   // Hotpot Cauldron (group-boss legend)
      const y = 7 + base + b;
      r(13, y - 3 - frame, 4, 5, WH); r(22, y - 5 - frame, 4, 7, WH); r(31, y - 2 - frame, 4, 4, WH);
      r(10, y + 5, 28, 6, RED); r(12, y + 4, 24, 3, '#f19a33'); r(13, y + 3 - frame, 5, 4, '#e86a6a'); r(29, y + 3 + frame, 4, 4, '#f2d245');
      r(8, y + 9, 32, 20, PHONE); r(6, y + 11, 4, 6, IRON_M); r(38, y + 11, 4, 6, IRON_M); r(10, y + 29, 6, 3, IRON_D); r(32, y + 29, 6, 3, IRON_D);
      if (back) { r(10, y + 13, 28, 1, IRON_D); r(10, y + 22, 28, 1, IRON_D); r(22, y + 24, 4, 4, '#f19a33'); }   // rivets and the gas flame under it
      else { eyes(16, 28, y + 14, GOLD); if (!ko) { r(18, y + 21, 12, 3, RED); r(20, y + 21, 2, 2, GOLD); r(26, y + 21, 2, 2, GOLD); } }
      return true;
    }
    case 6: {   // Mirror-Flex Peacock → PR-Day Peacock
      const y = 4 + base + b;
      if (evolved) {
        r(6, y + 4, 36, 18, IRON_D); r(9, y + 6, 30, 14, IRON_M); r(12, y + 8, 24, 10, RED);
        r(17, y + 12, 14, 18, '#2e9fd6'); r(20, y + 4, 8, 9, '#2e9fd6'); r(19, y + 5, 10, 2, GOLD);
        if (!back) { eyes(21, 25, y + 7); r(22, y + 10, 4, 2, GOLD); }
        r(6, y + 1, 36, 2, IRON); r(4, y - 1, 3, 6, RED); r(41, y - 1, 3, 6, RED); r(19, y + 30, 3, 4, GOLD); r(26, y + 30, 3, 4, GOLD);
      } else {
        r(6, y + 4, 36, 18, '#1f6b40'); r(10, y + 6, 28, 14, back ? '#2d8a52' : '#35a565');
        if (!back) for (const [fx, fy] of [[9, y + 7], [22, y + 5], [35, y + 7], [13, y + 14], [31, y + 14]]) { r(fx, fy, 4, 4, '#4d8df0'); r(fx + 1, fy + 1, 2, 2, frame ? WH : GOLD); }
        else for (let k = 0; k < 6; k++) r(9 + k * 5, y + 6, 1, 14, '#1f6b40');   // the plain back of the fan: quills
        r(18, y + 13, 12, 16, '#2e9fd6'); r(20, y + 5, 8, 9, '#2e9fd6');
        if (!back) { eyes(21, 25, y + 8); r(22, y + 11, 4, 2, GOLD); r(32, y + 13 - frame, 5, 8, PHONE); r(33, y + 14 - frame, 3, 5, '#93c5fd'); if (frame) { r(31, y + 11, 2, 2, WH); r(37, y + 11, 2, 2, WH); } }
        else { r(21, y + 3, 2, 3, '#2e9fd6'); r(25, y + 2, 2, 4, '#2e9fd6'); r(32, y + 15, 3, 4, PHONE); }   // crest, the phone peeking out
        r(20, y + 29, 2, 5, GOLD); r(26, y + 29, 2, 5, GOLD);
      }
      return true;
    }
    case 7: {   // Pre-Workout Crab → Espresso Crab
      const y = 9 + base + b, sh = evolved ? '#6e4429' : RED, shL = evolved ? '#9b6a3a' : '#f19a33';
      for (const lx of [8, 12, 32, 36]) r(lx, y + 22, 3, 5, sh);
      r(11, y + 9, 26, 15, sh); r(14, y + 7, 20, 4, shL);
      if (back) { r(16, y + 12, 3, 3, shL); r(29, y + 12, 3, 3, shL); r(22, y + 16, 4, 3, shL); }   // shell spots
      else if (evolved) {   // calm eyes up on stalks, like a crab
        r(18, y + 7, 2, 4, shL); r(28, y + 7, 2, 4, shL);
        if (ko) { r(17, y + 4, 1, 1, OUT); r(19, y + 6, 1, 1, OUT); r(27, y + 4, 1, 1, OUT); r(29, y + 6, 1, 1, OUT); }
        else { r(17, y + 4, 3, 3, WH); r(27, y + 4, 3, 3, WH); r(18, y + 5, 1, 2, OUT); r(28, y + 5, 1, 2, OUT); }
      } else eyes(17, 28, y + 13);
      if (evolved) {
        // claws hold the bar up: big pincers at each end
        r(4, y + 6 - frame, 6, 8, sh); r(38, y + 6 - frame, 6, 8, sh); r(4, y + 4 - frame, 2, 3, shL); r(8, y + 4 - frame, 2, 3, shL); r(38, y + 4 - frame, 2, 3, shL); r(42, y + 4 - frame, 2, 3, shL);
        r(3, y + 2 - frame, 42, 2, IRON); r(1, y - frame, 3, 6, IRON_D); r(44, y - frame, 3, 6, IRON_D);
        if (!back && !ko) r(21, y + 14, 6, 1, OUT);   // a calm, flat mouth
        if (!back) { r(40, y + 16, 5, 6, WH); r(41, y + 17, 3, 2, '#2a1f18'); r(45, y + 17, 1, 3, WH); }   // the black coffee, by its side
      } else {
        const jit = frame ? 1 : -1;
        r(4 + jit, y + 8, 6, 8, sh); r(38 - jit, y + 8, 6, 8, sh); r(4 + jit, y + 4, 2, 4, shL); r(42 - jit, y + 4, 2, 4, shL);
        if (!back) { r(19, y + 17, 10, 8, '#4d8df0'); r(20, y + 15, 8, 2, WH); }
        r(8, y + 2 + frame, 2, 2, '#e66fab'); r(38, y + 3 - frame, 2, 2, GOLD);
      }
      return true;
    }
    case 8: {   // Traffic Snail → Spin-Bike Snail
      const y = 7 + base + b, bodyCol = '#d99d6c';
      r(8, y + 22, 32, 8, bodyCol); r(34, y + 16, 7, 10, bodyCol); r(35, y + 11, 2, 6, bodyCol); r(39, y + 11, 2, 6, bodyCol);
      if (back) { r(35, y + 10, 2, 2, '#b5794b'); r(39, y + 10, 2, 2, '#b5794b'); } else eyes(34, 38, y + 8);
      if (evolved) {
        r(9, y + 6, 22, 20, IRON_D); r(11, y + 8, 18, 16, IRON); r(14, y + 11, 12, 10, '#1d2125'); r(18, y + 14, 4, 4, RED);
        r(2, y + 10 + frame, 5, 2, '#4d8df0'); r(3, y + 16 - frame, 4, 2, '#4d8df0');
      } else {
        r(10, y + 8, 20, 16, '#8a6948'); r(13, y + 11, 14, 10, '#c98a5a');
        if (back) { r(16, y + 14, 8, 4, '#8a6948'); r(19, y + 15, 3, 2, '#c98a5a'); }   // the spiral
        r(17, y - 1, 6, 11, PHONE); r(19, y + 1, 2, 2, back ? IRON_M : RED); r(19, y + 4, 2, 2, IRON_M); r(19, y + 7, 2, 2, IRON_M);
      }
      return true;
    }
    case 9: {   // Nap-Stretch Snake → Mobility Python
      const y = 7 + base + b, snk = evolved ? '#35a565' : '#8fcf7a', snkD = '#2d6b45';
      r(5, y + 26, 38, 4, '#4d8df0'); r(7, y + 27, 34, 2, '#93c5fd');
      if (evolved) {
        r(13, y + 18, 22, 8, snk); r(16, y + 8, 16, 12, snk); r(18, y + 2, 12, 8, snk); r(18, y + 3, 12, 2, RED);
        if (back) { for (let k = 0; k < 4; k++) r(18, y + 9 + k * 4, 12, 1, snkD); r(28, y + 5, 2, 4, RED); }   // back stripes, band knot
        else { eyes(19, 27, y + 5); r(22, y + 11, 4, 12, '#f2d245'); }
        r(34, y + 17 - frame, 7, 8, IRON_D); r(36, y + 14 - frame, 3, 3, IRON);
      } else {
        // curled up asleep on the mat: a big coil, head resting on top, a clear Z above
        r(9, y + 16, 30, 10, snk); r(12, y + 13, 24, 5, snkD); r(14, y + 18, 20, 2, snkD); r(26, y + 10, 12, 9, snk);
        if (back) { r(28, y + 11, 8, 2, snkD); r(16, y + 21, 16, 1, snkD); }
        else {
          r(28, y + 14, 3, 1, OUT); r(33, y + 14, 3, 1, OUT); r(29, y + 15, 1, 1, OUT); r(34, y + 15, 1, 1, OUT);   // closed eyes
          r(36, y + 17, 2, 3 + frame, '#93c5fd');   // drool
        }
        const zy = y + 1 - frame;   // a Z: top, diagonal, bottom
        r(38, zy, 5, 1, WH); r(41, zy + 1, 1, 1, WH); r(40, zy + 2, 1, 1, WH); r(39, zy + 3, 1, 1, WH); r(38, zy + 4, 5, 1, WH);
      }
      return true;
    }
  }
  return false;
}
