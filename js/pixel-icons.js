// Crisp 16x16 pixel-art SVG icons (replacing system emojis across shop, pets, ranks, and nav).
// Uses the same #231a17 outline and palette spirit as js/pixel.js, rendered with shape-rendering="crispEdges".

const P = {
  o: '#231a17', // outline
  w: '#eef0ea', // chalk white
  r: '#e0342f', // gym red
  d: '#961e1b', // dark red
  y: '#f2c230', // gold / yellow
  a: '#b58414', // dark gold / amber
  c: '#4d8df0', // sweat blue
  l: '#93c5fd', // light cyan
  n: '#1e4e9e', // dark blue
  g: '#35a565', // green
  k: '#1f6b40', // dark green
  m: '#9aa3ad', // silver / iron light
  s: '#5d6470', // iron mid
  i: '#3c414a', // iron dark
  b: '#7a4928', // brown / chocolate
  t: '#c98a5a', // tan / bone / parchment
  p: '#e8d7b4', // light parchment
  e: '#e86a6a', // meat pink
};

// Compact 16x16 grid renderer: each row is 16 chars ('.' = transparent)
function pxSvg(rows, size = 20, label = '') {
  let rects = '';
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || !P[ch]) continue;
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${P[ch]}"/>`;
      x += w - 1;
    }
  }
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="px-ic" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges" ${aria}>${rects}</svg>`;
}

const GRIDS = {
  // Sweat Coin (replaces 💧)
  coin: [
    '......oooo......',
    '....ooyyyaoo....',
    '...oyyyccyyyo...',
    '..oyyycllcyyyo..',
    '..oyyccllccyyo..',
    '.oyyccclcccyyyo.',
    '.oyycccccccyyyo.',
    '.oyyccnccnccyyo.',
    '.oyycccccccyyyo.',
    '..oyycccccyyyo..',
    '..oyyycccyyyyo..',
    '...oyyyyyyyyo...',
    '....ooaaaaoo....',
    '......oooo......',
    '................',
    '................',
  ],
  // Protein Bar (replaces 🍫)
  protein_bar: [
    '................',
    '................',
    '....oooooooooo..',
    '...obbbbbbbbbbo.',
    '..obbtbbbbtbbbbo',
    '..obbbbbbbbbbbbo',
    '..oorrrrrrrrrroo',
    '..oorrwwwwwwrroo',
    '..oorrdddddddrro',
    '..oorrrrrrrrrroo',
    '..obbbbbbbbbbbbo',
    '...oooooooooooo.',
    '................',
    '................',
    '................',
    '................',
  ],
  // Steak (replaces 🥩)
  steak: [
    '................',
    '...oooooo.......',
    '..oeeeeeerooo...',
    '.oeerrrrrrrrro..',
    '.oerrwwwwwwrrro.',
    '.oerrwttttwrrro.',
    '.oerrwwwwwwrrro.',
    '.oerrrrrrrrrddo.',
    '..oorrrrrrdddo..',
    '....ooooooo.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // Energy Drink / Potion (replaces 🧃)
  potion: [
    '.....oooooo.....',
    '.....osssso.....',
    '......oooo......',
    '....oowwwwoo....',
    '...owggggggwo...',
    '..oggglllggggo..',
    '..oggggggggggo..',
    '..ogggkggkgggo..',
    '..oggggggggggo..',
    '..okkkkkkkkkko..',
    '..okkkkkkkkkko..',
    '...oooooooooo...',
    '................',
    '................',
    '................',
    '................',
  ],
  // Iron Shield (replaces 🛡️)
  shield: [
    '..oooooooooooo..',
    '.ommmmmmmmmmmmo.',
    '.omrrrrrrrrrrmo.',
    '.omrwwwwwwwwrmo.',
    '.omrwrrrrrrwrmo.',
    '.omrwrrrrrrwrmo.',
    '.omrrrrrrrrrrmo.',
    '.omrrrrrrrrrrmo.',
    '..omrrddddrrmo..',
    '..omrrddddrrmo..',
    '...omddddddmo...',
    '....omddddmo....',
    '.....omddmo.....',
    '......oooo......',
    '................',
    '................',
  ],
  // Move Scroll (replaces 📜)
  scroll: [
    '....ooooooooo...',
    '...opppppppppo..',
    '..opppppppppppo.',
    '..ooppppppppooo.',
    '...oppppppppo...',
    '...oppssssppo...',
    '...oppppppppo...',
    '...opprrrpppo...',
    '...opprdrpppo...',
    '...oppssssppo...',
    '..ooppppppppooo.',
    '.opppppppppppo..',
    '..ooooooooooo...',
    '................',
    '................',
    '................',
  ],
  // Gold Medal (replaces 🥇)
  medal_1: [
    '..oo......oo....',
    '..orr....rro....',
    '...orr..rro.....',
    '....orrrro......',
    '.....oooo.......',
    '...ooyyyyoo.....',
    '..oyywwwwyyo....',
    '..oyyywwyyyo....',
    '..oyyywwyyyo....',
    '..oyywwwwyyo....',
    '...oyyyyyyo.....',
    '....ooaaaoo.....',
    '......oooo......',
    '................',
    '................',
    '................',
  ],
  // Silver Medal (replaces 🥈)
  medal_2: [
    '..oo......oo....',
    '..occ....cco....',
    '...occ..cco.....',
    '....occcco......',
    '.....oooo.......',
    '...oommmmoo.....',
    '..ommwwwwmmo....',
    '..ommmwwmmmo....',
    '..ommswwsmmo....',
    '..ommwwwwmmo....',
    '...ommmmmmo.....',
    '....oosssso.....',
    '......oooo......',
    '................',
    '................',
    '................',
  ],
  // Bronze Medal (replaces 🥉)
  medal_3: [
    '..oo......oo....',
    '..ogg....ggo....',
    '...ogg..ggo.....',
    '....oggggo......',
    '.....oooo.......',
    '...oottttoo.....',
    '..ottwwwwtto....',
    '..otttwwttto....',
    '..ottbwwbtto....',
    '..ottwwwwtto....',
    '...otttttto.....',
    '....oobbbbo.....',
    '......oooo......',
    '................',
    '................',
    '................',
  ],
  // Trophy (replaces 🏆)
  trophy: [
    '..oooooooooooo..',
    '.oyyyyyyyyyyyyo.',
    'ooyywwwwyyyyyyoo',
    'o.oyyyyyyyyyyo.o',
    'oo.oyyyaaaayo.oo',
    '...oyyyaaaayo...',
    '....oyyaaayo....',
    '.....oyaaao.....',
    '......oayo......',
    '......oayo......',
    '....ooyyyyoo....',
    '...oaaaaaaaao...',
    '...oooooooooo...',
    '................',
    '................',
    '................',
  ],
  // Bitch Pup Badge (replaces 🐶)
  bitch_dog: [
    '..ooo......ooo..',
    '.obboooooooobbo.',
    '.obtttttttttbo..',
    '.obttotttotttbo.',
    '..ottttttttttto.',
    '..otttoootttto..',
    '..ottttootttto..',
    '...otttttttto...',
    '....orrrrrro....',
    '....orwyywro....',
    '.....oooooo.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // Battle Tower (replaces 🗼)
  tower: [
    '......oooo......',
    '.....orrrro.....',
    '......oooo......',
    '.....osssso.....',
    '....osmmmmso....',
    '....osmssmso....',
    '....osiiiiso....',
    '...osmmmmmmso...',
    '...osmssssmso...',
    '...osmiiiimso...',
    '..osmmmmmmmmso..',
    '..osssiiiissso..',
    '..ossswwwwssso..',
    '..oooooooooooo..',
    '................',
    '................',
  ],
  // Pets: a paw print (replaces 🐾). Redrawn: 4 round toes over one big pad, so it reads as a paw at 16 px.
  pets: [
    '................',
    '.....oo..oo.....',
    '....orwo.orwo...',
    '.oo.orro.orro.oo',
    'orwo.oo..oo.orwo',
    'orro........orro',
    '.oo...oooo...oo.',
    '.....orrrro.....',
    '....orrrrrro....',
    '...orrwrrrrro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '....oorrrroo....',
    '......oooo......',
    '................',
    '................',
  ],
  // Dex: an open book with a monster on the left page and notes on the right (replaces 📖).
  dex: [
    '................',
    '................',
    '.oooooo..oooooo.',
    'owwwwwwoowwwwwwo',
    'owccccwoowsssswo',
    'ocwccwcoowwwwwwo',
    'occccccoowssswwo',
    'owcwwcwoowwwwwwo',
    'owwwwwwoowsssswo',
    'owssswwoowwwwwwo',
    'owwwwwwoowsswwwo',
    'orrrrrroorrrrrro',
    '.oooooooooooooo.',
    '................',
    '................',
    '................',
  ],
  // Boss Lair Crown (replaces 👑) - centered 16x16 royal crown
  lair: [
    '................',
    '................',
    '.oo....oo....oo.',
    'oyyo..oyyo..oyyo',
    'oyyo..oyyo..oyyo',
    'oyyyooyyyyooyyyo',
    'oyyyyyyyyyyyyyyo',
    'oyyrryyccyyrryyo',
    'oyydryyclcyydryo',
    'oyyyyyyyyyyyyyyo',
    'oaaaaaaaaaaaaaao',
    'oorrrrrrrrrrrroo',
    'oaaaaaaaaaaaaaao',
    'oooooooooooooooo',
    '................',
    '................',
  ],
  // Shop Awning (replaces 🏪)
  shop: [
    '................',
    '.oooooooooooooo.',
    'orrwwrrwwrrwwrro',
    'orrwwrrwwrrwwrro',
    'oooooooooooooooo',
    '.oppppppppppppo.',
    '.opcccppppccppo.',
    '.opcccppppccppo.',
    '.oppppppppppppo.',
    '.opppppyypppppo.',
    '.oppppppppppppo.',
    '.oooooooooooooo.',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const hasPxIcon = name => !!GRIDS[name];

export const pxIcon = (name, size = 20, label = '') =>
  GRIDS[name] ? pxSvg(GRIDS[name], size, label) : '';
