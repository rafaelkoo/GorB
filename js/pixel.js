// Pixel-art avatars and the little gym they train in. Everything is drawn in code, one "pixel" at a
// time, on a small canvas that's then scaled up with smoothing off, so it stays crisp and chunky.
// Original art in a cosy farm-game spirit; nothing is copied from any game.
//
// An avatar is a small JSON of parts (see AVATAR_PARTS). Add a new part (a cap, a belt, a new top
// style) by adding its options here and drawing it in drawChar; old avatars keep working because
// every part has a default.
import { EX, isClimb } from './exercises.js';

// ---------- parts ----------
// Colour lists only ever grow at the end, so a saved index always means the same colour.
export const SKINS = ['#f7d9bf', '#eebc94', '#d99d6c', '#b5794b', '#8c5634', '#5f3a22',
  '#fde6d6', '#e3b483', '#c98a5a', '#6e4429', '#462a1a',                  // more natural tones
  '#8fcf7a', '#86b3ea', '#b8bccb', '#c79be8', '#f2a3c0'];                 // fun: green, blue, robot grey, purple, pink
export const SKIN_ORDER = [6, 0, 1, 7, 2, 8, 3, 4, 9, 5, 10, 11, 12, 13, 14, 15];   // light to deep, then fun
export const HAIR_COLORS = ['#2a1f18', '#5b3a22', '#9b6a3a', '#dcb56c', '#ece3d3', '#b7392a', '#3d63b8', '#c95aa0',
  '#8a8a8f', '#f0812a', '#3fbf9f', '#8a4fd8', '#f7f7f7', '#e04a6e'];
export const TOPS = ['#e23b3b', '#f19a33', '#f2d245', '#45b45a', '#2e9fd6', '#3c5bd9', '#8c5bd6', '#e66fab', '#eeeeee', '#2b2b30',
  '#7a2c3a', '#2e6b5a', '#f2b8c6', '#c3dc5e', '#6f7f3e', '#14b8b0',
  '#e8b923'];                                                              // 16: gold (season reward)
export const SHORTS = ['#2b2b30', '#35466a', '#6a6a72', '#3c5bd9', '#46663a', '#7c2c2c', '#d6d6d6', '#8a6948',
  '#e23b3b', '#8c5bd6', '#14b8b0', '#f19a33'];
export const SHOES = ['#3a2e2a', '#f2f2f2', '#e23b3b', '#3c5bd9', '#9be33b', '#e66fab', '#f2d245', '#2b2b30', '#e8b923'];   // 8: gold (season reward)
export const GEAR = ['#e23b3b', '#f2f2f2', '#2b2b30', '#3c5bd9', '#f2d245', '#45b45a', '#e66fab', '#f19a33'];
export const HAIRS = ['short', 'spiky', 'long', 'bun', 'buzz', 'curly', 'mohawk', 'bald', 'afro', 'ponytail', 'sidepart', 'braids', 'undercut', 'pigtails'];
export const BUILDS = ['slim', 'normal', 'big'];
export const TOP_STYLES = ['tee', 'tank', 'stringer', 'longsleeve', 'hoodie', 'jersey', 'shirtless'];
export const BOTTOMS = ['shorts', 'joggers', 'leggings'];
export const HATS = ['none', 'headband', 'cap', 'capback', 'beanie', 'bandana', 'crown'];
// season-pass items: which choice needs which unlocked item (see season_pass, migration 029)
export const LOCKED = { top: { 16: 'gold_top' }, shoes: { 8: 'gold_shoes' }, hat: { crown: 'crown' } };
export const ITEM_DAYS = { gold_top: 10, crown: 15, gold_shoes: 20 };
export const FACES = ['none', 'stubble', 'beard', 'moustache', 'glasses', 'shades'];

// everyone gets a look from their id until they make their own
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function defaultAvatar(id) {
  const h = hash(id);
  return { v: 1, skin: h % 6, hair: HAIRS[(h >>> 3) % 7], hairColor: (h >>> 6) % 5, top: (h >>> 9) % 10, shorts: (h >>> 13) % 8, build: 'normal',
    topStyle: 'tee', bottom: 'shorts', shoes: 0, hat: 'none', hatColor: 0, face: 'none' };
}
export function cleanAvatar(a, id) {
  const d = defaultAvatar(id), o = a && typeof a === 'object' ? a : {};
  const pick = (k, n) => (Number.isInteger(o[k]) && o[k] >= 0 && o[k] < n ? o[k] : d[k]);
  const one = (k, list) => (list.includes(o[k]) ? o[k] : d[k]);
  return {
    v: 1, skin: pick('skin', SKINS.length), hairColor: pick('hairColor', HAIR_COLORS.length), top: pick('top', TOPS.length), shorts: pick('shorts', SHORTS.length),
    shoes: pick('shoes', SHOES.length), hatColor: pick('hatColor', GEAR.length),
    hair: one('hair', HAIRS), build: one('build', BUILDS), topStyle: one('topStyle', TOP_STYLES), bottom: one('bottom', BOTTOMS), hat: one('hat', HATS), face: one('face', FACES)
  };
}

// ---------- colour helpers ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${((m(r) << 16) | (m(g) << 8) | m(b)).toString(16).padStart(6, '0')}`;
}
const OUT = '#231a17';      // outline
const IRON = '#5d6470', IRON_D = '#3c414a', IRON_L = '#9aa3ad';

// ---------- the character ----------
// Poses: stand, squat, ohp, curl, pull, run, sit, cycle, row, climb, stretch, press (seated bench press)
// (x, y) is the point between the feet, in scene pixels. frame is 0 or 1.
export function drawChar(c, x, y, av, pose = 'stand', frame = 0) {
  const r = (px, py, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
  const skin = SKINS[av.skin], skinD = shade(skin, -0.18), top = TOPS[av.top], topD = shade(top, -0.25), sh = SHORTS[av.shorts], shD = shade(sh, -0.25);
  const hair = HAIR_COLORS[av.hairColor], hairD = shade(hair, -0.3), hairL = shade(hair, 0.25);
  const tw = av.build === 'slim' ? 6 : av.build === 'big' ? 10 : 8, hw = tw / 2;
  const SHOE = SHOES[av.shoes ?? 0], ts = av.topStyle || 'tee', bt = av.bottom || 'shorts';
  const gear = GEAR[av.hatColor ?? 0], gearD = shade(gear, -0.3);
  const legCol = bt === 'shorts' ? skin : sh, legColD = bt === 'shorts' ? skinD : shD;   // trousers cover the legs
  const bare = ts === 'tank' || ts === 'stringer' || ts === 'shirtless';                   // no sleeves
  const longArm = ts === 'longsleeve' || ts === 'hoodie';
  const seated = ['sit', 'cycle', 'row', 'press'].includes(pose);
  const low = pose === 'squat' && frame === 1 ? 3 : 0;          // squatting down
  const by = (seated ? 5 : 0) + low;                             // body drop
  const bob = (pose === 'stand' || pose === 'sit') && frame === 1 ? 1 : 0;   // breathing / dozing
  const H = -24 + by + bob;                                      // top of head

  // shadow
  c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(Math.round(x - hw - 2), Math.round(y - 1), tw + 4, 2);

  // ---- legs ----
  const legs = () => {
    const ly = H + 18;   // top of legs (under shorts)
    if (seated) {
      // thighs come toward us: short legs, feet down in front
      const kick = (pose === 'cycle') ? (frame ? 1 : -1) : 0;
      r(-hw + 1, ly - 1, 3, 3, legCol); r(hw - 4, ly - 1, 3, 3, legCol);
      r(-hw + 1, ly + 2 + kick, 3, 2, SHOE); r(hw - 4, ly + 2 - kick, 3, 2, SHOE);
      return;
    }
    if (pose === 'squat' && frame === 1) {    // knees out
      r(-hw - 1, ly, 3, 2, legCol); r(hw - 2, ly, 3, 2, legCol);
      r(-hw - 1, ly + 2, 3, 1, SHOE); r(hw - 2, ly + 2, 3, 1, SHOE);
      return;
    }
    // two legs with a gap between them; running and climbing lift one at a time
    let lA = 0, lB = 0;
    if (pose === 'run') { lA = frame ? -2 : 0; lB = frame ? 0 : -2; }
    if (pose === 'climb') { lA = frame ? -2 : 0; lB = frame ? 0 : -2; }
    const lx = -Math.max(2, hw - 1), rx = Math.max(0, hw - 3) + (hw > 3 ? 0 : 0), lg = 4;
    r(lx, ly, 2, lg + lA, legCol); r(lx, ly, 1, lg + lA, legColD);
    r(rx + (rx - lx < 3 ? 1 : 0), ly, 2, lg + lB, legCol);
    if (bt === 'joggers') { r(lx, ly + lg + lA - 1, 2, 1, legColD); r(rx + (rx - lx < 3 ? 1 : 0), ly + lg + lB - 1, 2, 1, legColD); }      // cuffs
    if (bt === 'leggings') { r(lx, ly, 1, lg + lA, shade(sh, 0.3)); r(rx + (rx - lx < 3 ? 1 : 0) + 1, ly, 1, lg + lB, shade(sh, 0.3)); }   // side stripe
    r(lx - 1 + (pose === 'climb' ? 0 : 0), ly + lg + lA, 3, 2, SHOE); r(rx + (rx - lx < 3 ? 1 : 0), ly + lg + lB, 3, 2, SHOE);
  };

  // ---- body ----
  const body = () => {
    r(-1, H + 7, 2, 1, skinD);                                   // neck
    if (ts === 'shirtless') {
      r(-hw, H + 8, tw, 7, skin); r(-hw, H + 8, 1, 7, skinD); r(hw - 1, H + 8, 1, 7, skinD);
      r(-hw + 1, H + 10, tw - 2, 1, skinD); r(0, H + 11, 1, 3, skinD); r(-hw + 2, H + 12, tw - 4, 1, shade(skin, -0.1));   // chest and abs
    } else {
      r(-hw, H + 8, tw, 7, top); r(-hw, H + 8, 1, 7, topD); r(hw - 1, H + 8, 1, 7, topD);   // shirt
      r(-hw + 2, H + 8, tw - 4, 1, shade(top, 0.15));            // collar light
      if (ts === 'tank') { r(-hw, H + 8, 1, 2, skin); r(hw - 1, H + 8, 1, 2, skin); r(-1, H + 8, 2, 1, skin); }
      if (ts === 'stringer') { r(-hw, H + 8, 2, 4, skin); r(hw - 2, H + 8, 2, 4, skin); r(-1, H + 8, 2, 2, skin); }
      if (ts === 'hoodie') { r(-3, H + 7, 6, 1, topD); r(-1, H + 9, 1, 2, '#f2f2f2'); r(1, H + 9, 1, 2, '#f2f2f2'); r(-hw + 2, H + 12, tw - 4, 2, topD); }
      if (ts === 'jersey') { r(-hw, H + 8, tw, 1, '#f2f2f2'); r(-1, H + 10, 2, 3, '#f2f2f2'); r(-hw, H + 14, tw, 1, shade(top, -0.4)); }
    }
    r(-hw, H + 15, tw, 3, sh); r(-hw, H + 17, tw, 1, shD); r(-1, H + 16, 2, 2, shD);      // shorts
  };

  // ---- arms: each arm is a sleeve + forearm + hand; positions by pose ----
  const arm = (side, hx, hy) => {
    // side -1 left / 1 right; (hx, hy) = hand position relative to (x, H)
    const sx = side < 0 ? -hw - 2 : hw;                          // shoulder column
    r(sx, H + 8, 2, 2, bare ? skin : top);                      // sleeve (or shoulder)
    // a straight-ish line of skin from shoulder to hand, 2px wide
    const x0 = sx, y0 = H + 10, x1 = hx, y1 = H + hy;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) r(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 2, 1, longArm && i < n ? top : skin);
    r(hx, H + hy, 2, 2, skinD);                                 // hand
  };
  const L = -hw - 2, R = hw;
  const bar = (yy, w = tw + 14) => {                           // a barbell with plates
    r(-w / 2, H + yy, w, 1, IRON_L);
    r(-w / 2 - 1, H + yy - 2, 2, 5, IRON_D); r(w / 2 - 1, H + yy - 2, 2, 5, IRON_D);
    r(-w / 2 - 2, H + yy - 1, 1, 3, IRON); r(w / 2 + 1, H + yy - 1, 1, 3, IRON);
  };
  const dumbbell = (hx, hy) => { r(hx - 1, H + hy, 4, 1, IRON_L); r(hx - 2, H + hy - 1, 1, 3, IRON_D); r(hx + 3, H + hy - 1, 1, 3, IRON_D); };

  const arms = () => {
    switch (pose) {
      case 'squat': arm(-1, L - 2, 9); arm(1, R + 2, 9); bar(8); break;
      case 'ohp': case 'press': {
        const up = frame === 0 ? 1 : 6;
        arm(-1, L - 1, up); arm(1, R + 1, up); bar(up); break;
      }
      case 'curl': {
        const hy = frame ? 10 : 15;
        arm(-1, L, hy); arm(1, R, hy); dumbbell(L, hy + 1); dumbbell(R, hy + 1); break;
      }
      case 'pull': {
        const hy = frame ? 4 : -2;
        arm(-1, L + 1, hy); arm(1, R - 1, hy);
        r(L + 1, H + hy - 1, 2, 1, IRON_L); r(R - 1, H + hy - 1, 2, 1, IRON_L); break;
      }
      case 'row': { const hx = frame ? 2 : 0; arm(-1, L + 2 + hx, 12); arm(1, R - 2 - hx, 12); r(L + 2 + hx, H + 13, tw + 4 - 2 * hx, 1, IRON_L); break; }
      case 'run': arm(-1, L - (frame ? 1 : 0), frame ? 11 : 13); arm(1, R + (frame ? 0 : 1), frame ? 13 : 11); break;
      case 'cycle': arm(-1, L + 1, 12); arm(1, R - 1, 12); break;
      case 'climb': arm(-1, L - 1, frame ? -2 : 5); arm(1, R + 1, frame ? 5 : -2); break;
      case 'stretch': if (frame) { arm(-1, L - 3, 1); arm(1, R + 3, 1); } else { arm(-1, L - 4, 9); arm(1, R + 4, 9); } break;
      case 'sit': arm(-1, L + 1, 14); arm(1, R - 1, 14); break;
      case 'back': arm(-1, L, 13); arm(1, R, 13); break;
      default: arm(-1, L, 14); arm(1, R, 14);
    }
  };

  // ---- head: face, hair, then face extras and hats on top ----
  const hs = av.hair, hat = av.hat || 'none', face = av.face || 'none';
  const hatOn = hat === 'cap' || hat === 'capback' || hat === 'beanie' || hat === 'bandana';
  const drawHat = hx => {
    if (hat === 'headband') { r(hx - 1, H + 1, 10, 1, gear); r(hx + 8, H + 2, 1, 2, gearD); }
    if (hat === 'cap') { r(hx - 1, H - 2, 10, 4, gear); r(hx + 1, H - 2, 4, 1, shade(gear, 0.25)); r(hx - 2, H + 2, 12, 1, gearD); r(hx + 3, H - 1, 2, 1, gearD); }
    if (hat === 'capback') { r(hx - 1, H - 2, 10, 4, gear); r(hx + 1, H - 2, 4, 1, shade(gear, 0.25)); r(hx + 2, H + 1, 4, 1, gearD); r(hx + 3, H, 2, 1, skin); }
    if (hat === 'beanie') { r(hx - 1, H - 3, 10, 5, gear); r(hx - 1, H + 1, 10, 1, gearD); r(hx + 3, H - 4, 2, 1, '#f2f2f2'); for (let i = 0; i < 10; i += 2) r(hx - 1 + i, H - 1, 1, 2, shade(gear, -0.12)); }
    if (hat === 'crown') {
      const g = '#f2c430', gD = '#b8881a';
      r(hx, H - 3, 8, 3, g); r(hx, H - 5, 1, 2, g); r(hx + 3, H - 6, 2, 3, g); r(hx + 7, H - 5, 1, 2, g); r(hx, H - 1, 8, 1, gD);
      r(hx + 3, H - 2, 2, 1, '#e23b3b'); r(hx + 1, H - 2, 1, 1, '#3c5bd9'); r(hx + 6, H - 2, 1, 1, '#45b45a'); r(hx + 3, H - 6, 1, 1, '#fff0a0');
    }
    if (hat === 'bandana') { r(hx - 1, H - 2, 10, 4, gear); r(hx + 1, H - 1, 1, 1, '#f2f2f2'); r(hx + 5, H, 1, 1, '#f2f2f2'); r(hx + 8, H + 1, 2, 3, gearD); }
  };
  const head = () => {
    const hx = -4;
    if (pose === 'climb' || pose === 'back') {   // seen from behind: all hair
      const capOnly = hs === 'bald' || hs === 'buzz' || hs === 'mohawk' || hs === 'undercut';
      r(hx, H, 8, 7, hs === 'bald' ? skin : hs === 'mohawk' ? skin : hair);
      r(hx - 1, H + 3, 1, 2, skinD); r(hx + 8, H + 3, 1, 2, skinD); r(hx + 1, H + 6, 6, 1, capOnly ? skinD : hairD);
      if (hs === 'long' || hs === 'braids') { r(hx - 1, H + 2, 10, 8, hair); r(hx, H + 9, 8, 1, hairD); }
      if (hs === 'bun') r(hx + 2, H - 3, 4, 3, hair);
      if (hs === 'spiky') { r(hx + 2, H - 2, 2, 2, hair); r(hx + 5, H - 1, 2, 1, hair); }
      if (hs === 'mohawk') r(hx + 3, H - 3, 2, 9, hair);
      if (hs === 'afro') { r(hx - 3, H - 3, 14, 10, hair); r(hx - 2, H - 3, 4, 1, hairL); }
      if (hs === 'ponytail') { r(hx + 3, H + 3, 2, 7, hair); r(hx + 3, H + 9, 2, 1, hairD); }
      if (hs === 'pigtails') { r(hx - 3, H + 2, 2, 5, hair); r(hx + 9, H + 2, 2, 5, hair); }
      if (hs === 'undercut') r(hx, H - 1, 8, 3, hair);
      if (hs !== 'bald' && hs !== 'afro') r(hx + 1, H, 4, 1, hairL);
      if (hat !== 'none') drawHat(hx);
      return;
    }
    // hair that hangs behind the face
    if (hs === 'afro') { r(hx - 3, H - 3, 14, 9, hair); r(hx - 2, H - 4, 12, 1, hair); }
    if (hs === 'long' || hs === 'braids') { r(hx - 1, H + 2, 10, 8, hair); }
    r(hx, H, 8, 7, skin); r(hx, H + 6, 8, 1, skinD);               // face + jaw shade
    r(hx - 1, H + 3, 1, 2, skinD); r(hx + 8, H + 3, 1, 2, skinD);  // ears
    const sleepy = pose === 'sit';
    if (sleepy) { r(hx + 2, H + 4, 2, 1, OUT); r(hx + 5, H + 4, 2, 1, OUT); }      // eyes shut
    else { r(hx + 2, H + 3, 1, 2, OUT); r(hx + 5, H + 3, 1, 2, OUT); }
    r(hx + 1, H + 5, 1, 1, shade(skin, -0.08)); r(hx + 6, H + 5, 1, 1, shade(skin, -0.08));   // cheeks
    if (!sleepy && pose !== 'stand' && face !== 'beard' && face !== 'moustache') r(hx + 3, H + 5, 2, 1, shade(skin, -0.35));   // effort
    // face extras
    if (face === 'stubble') { for (let i = 0; i < 8; i += 2) r(hx + i, H + 6, 1, 1, shade(skin, -0.4)); r(hx + 1, H + 5, 1, 1, shade(skin, -0.3)); r(hx + 6, H + 5, 1, 1, shade(skin, -0.3)); }
    if (face === 'beard') { r(hx, H + 4, 1, 3, hair); r(hx + 7, H + 4, 1, 3, hair); r(hx + 1, H + 5, 6, 2, hair); r(hx + 3, H + 5, 2, 1, shade(skin, -0.35)); r(hx + 1, H + 7, 6, 1, hairD); }
    if (face === 'moustache') { r(hx + 2, H + 5, 4, 1, hair); r(hx + 1, H + 6, 1, 1, hair); r(hx + 6, H + 6, 1, 1, hair); }
    if (face === 'glasses' && !sleepy) { for (const gx of [hx + 1, hx + 4]) { r(gx, H + 2, 3, 1, OUT); r(gx, H + 5, 3, 1, OUT); r(gx, H + 3, 1, 2, OUT); r(gx + 2, H + 3, 1, 2, OUT); } r(hx + 3, H + 3, 1, 1, OUT); }
    if (face === 'shades') { r(hx + 1, H + 3, 3, 2, '#121214'); r(hx + 4, H + 3, 3, 2, '#121214'); r(hx, H + 3, 8, 1, '#121214'); r(hx + 1, H + 3, 1, 1, '#5d6470'); r(hx + 4, H + 3, 1, 1, '#5d6470'); }
    // hair on top (a hat hides most of it)
    if (hs === 'bald') { if (!hatOn) r(hx + 1, H, 3, 1, shade(skin, 0.25)); }
    else if (hs === 'buzz') { if (!hatOn) r(hx, H, 8, 2, hair); r(hx, H + 2, 1, 1, hair); r(hx + 7, H + 2, 1, 1, hair); }
    else if (hs === 'mohawk') { if (!hatOn) { r(hx + 1, H, 6, 1, shade(skin, 0.12)); r(hx + 3, H - 4, 2, 6, hair); r(hx + 3, H - 4, 1, 2, hairL); r(hx + 3, H + 1, 2, 1, hairD); } }
    else if (hs === 'undercut') { r(hx - 1, H + 1, 1, 3, shade(hair, 0.35)); r(hx + 8, H + 1, 1, 3, shade(hair, 0.35)); if (!hatOn) { r(hx, H - 2, 8, 3, hair); r(hx + 4, H + 1, 4, 1, hair); r(hx + 1, H - 2, 4, 1, hairL); } }
    else if (hs === 'afro') { if (!hatOn) { r(hx - 2, H - 4, 12, 4, hair); r(hx - 1, H - 4, 4, 1, hairL); } r(hx - 3, H - 1, 3, 6, hair); r(hx + 8, H - 1, 3, 6, hair); r(hx, H, 8, 1, hair); }
    else {
      r(hx - 1, H - 1, 10, 3, hair); r(hx - 1, H + 2, 1, 3, hair); r(hx + 8, H + 2, 1, 3, hair);   // base cap of hair
      r(hx + 1, H - 1, 4, 1, hairL);
      if (hs === 'short') r(hx, H + 2, 3, 1, hair);
      if (hs === 'spiky' && !hatOn) { r(hx, H - 2, 1, 1, hair); r(hx + 2, H - 3, 2, 2, hair); r(hx + 5, H - 2, 2, 1, hair); r(hx + 7, H - 3, 1, 2, hair); }
      if (hs === 'long') { r(hx - 1, H + 2, 2, 8, hair); r(hx + 7, H + 2, 2, 8, hair); r(hx - 1, H + 9, 2, 1, hairD); r(hx + 7, H + 9, 2, 1, hairD); }
      if (hs === 'braids') { for (let i = 0; i < 8; i++) { r(hx - 1, H + 2 + i, 2, 1, i % 2 ? hairD : hair); r(hx + 7, H + 2 + i, 2, 1, i % 2 ? hair : hairD); } r(hx - 1, H + 10, 2, 1, gear); r(hx + 7, H + 10, 2, 1, gear); }
      if (hs === 'bun' && !hatOn) { r(hx + 2, H - 4, 4, 3, hair); r(hx + 3, H - 4, 2, 1, hairL); }
      if (hs === 'curly') { r(hx - 2, H, 2, 4, hair); r(hx + 8, H, 2, 4, hair); if (!hatOn) { r(hx, H - 2, 2, 1, hair); r(hx + 4, H - 2, 3, 1, hair); } r(hx + 2, H + 2, 1, 1, hairD); }
      if (hs === 'sidepart') { r(hx, H + 2, 5, 1, hair); r(hx, H + 1, 6, 1, hair); r(hx + 6, H - 1, 1, 1, hairD); }
      if (hs === 'ponytail') { r(hx + 8, H, 2, 2, hair); r(hx + 9, H + 2, 2, 6, hair); r(hx + 9, H + 7, 2, 1, hairD); r(hx + 8, H, 1, 1, gear); }
      if (hs === 'pigtails') { r(hx - 3, H + 1, 2, 6, hair); r(hx + 9, H + 1, 2, 6, hair); r(hx - 2, H + 1, 1, 1, gear); r(hx + 9, H + 1, 1, 1, gear); }
    }
    if (hat !== 'none') drawHat(hx);
  };

  legs(); body(); arms(); head();
}

// ---------- last month's bitch: a dog ----------
// Fur takes the person's hair colour and the collar their top colour, so you can tell who it is.
export function drawDog(c, x, y, av, frame = 0, busy = false) {
  const r = (px, py, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
  const fur = av.hair === 'bald' ? SKINS[av.skin] : HAIR_COLORS[av.hairColor], furD = shade(fur, -0.3), furL = shade(fur, 0.22);
  const collar = TOPS[av.top], hop = busy && frame ? -1 : 0;
  c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(Math.round(x - 8), Math.round(y - 1), 16, 2);
  // body (sitting), legs, tail wag
  r(-5, -9 + hop, 10, 8, fur); r(-5, -9 + hop, 10, 1, furL); r(-4, -2, 3, 2, furD); r(1, -2, 3, 2, furD);
  if (frame) { r(5, -8 + hop, 3, 2, fur); r(7, -10 + hop, 2, 2, fur); } else { r(5, -6 + hop, 3, 2, fur); r(7, -5 + hop, 2, 2, fur); }
  // head
  r(-5, -17 + hop, 10, 8, fur); r(-4, -17 + hop, 8, 1, furL);
  r(-7, -17 + hop, 3, 6, furD); r(4, -17 + hop, 3, 6, furD);                 // floppy ears
  r(-3, -12 + hop, 6, 3, shade(fur, 0.4)); r(-1, -12 + hop, 2, 1, OUT);       // snout + nose
  r(-3, -15 + hop, 1, 2, OUT); r(2, -15 + hop, 1, 2, OUT);                    // eyes
  if (frame) r(-1, -10 + hop, 2, 2, '#e66fab');                               // tongue
  r(-5, -10 + hop, 10, 1, collar); r(-1, -9 + hop, 2, 2, '#f2d245');          // collar + tag
}

// ---------- the gym ----------
export const W = 256, H = 176;
// where each station is (feet spots for up to 3 people) and what pose its users do
const ST = {
  climb:   { pose: 'climb',   spots: [[20, 48], [40, 38], [30, 60]] },
  rack:    { pose: 'squat',   spots: [[86, 76], [100, 80]] },
  bench:   { pose: 'press',   spots: [[126, 78], [142, 82]] },
  cable:   { pose: 'pull',    spots: [[166, 76], [180, 80]] },
  pullup:  { pose: 'pull',    spots: [[206, 74]] },
  dbs:     { pose: 'curl',    spots: [[222, 96], [240, 98], [230, 104]] },
  ohp:     { pose: 'ohp',     spots: [[204, 102], [214, 110]] },
  machine: { pose: 'row',     spots: [[62, 116], [78, 118]] },
  mat:     { pose: 'stretch', spots: [[110, 130], [128, 132], [146, 128], [120, 140]] },
  tread:   { pose: 'run',     spots: [[178, 150], [196, 150]] },
  bike:    { pose: 'cycle',   spots: [[216, 152]] },
  rower:   { pose: 'row',     spots: [[236, 154]] },
  rest:    { pose: 'sit',     spots: [[22, 160], [38, 160], [54, 160], [70, 160], [86, 160]] }
};
// which station an exercise (or cardio kind) uses
export function stationFor(exerciseId, cardio) {
  if (exerciseId) {
    if (isClimb(exerciseId)) return 'climb';
    const e = EX[exerciseId];
    if (e) {
      const { cat, equip } = e;
      if (e.kind === 'minutes') return 'tread';
      if (/pull_?up|chin/.test(exerciseId)) return 'pullup';
      if (cat === 'legs') return equip === 'Machine' ? 'machine' : 'rack';
      if (cat === 'chest') return equip === 'Cable' ? 'cable' : equip === 'Machine' ? 'machine' : equip === 'Bodyweight' ? 'mat' : 'bench';
      if (cat === 'back') return equip === 'Cable' || equip === 'Machine' ? 'cable' : equip === 'Bodyweight' ? 'pullup' : 'dbs';
      if (cat === 'shoulders') return equip === 'Cable' ? 'cable' : 'ohp';
      if (cat === 'arms') return equip === 'Cable' ? 'cable' : 'dbs';
      if (cat === 'core') return equip === 'Cable' ? 'cable' : 'mat';
      return 'mat';
    }
  }
  if (cardio) return /bike/.test(cardio) ? 'bike' : /row/.test(cardio) ? 'rower' : /jump|box|rope|sled|hiit/.test(cardio) ? 'mat' : 'tread';
  return 'mat';
}

function drawRoom(c, t) {
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // back wall
  r(0, 0, W, 46, '#e9d9b8'); r(0, 0, W, 4, '#c9b48e'); r(0, 38, W, 8, '#b98d5c'); r(0, 38, W, 1, '#d8b07c'); r(0, 45, W, 1, '#7a5634');
  // wall planks
  for (let x = 0; x < W; x += 16) r(x, 4, 1, 34, '#dcc9a3');
  // windows with sky
  for (const wx of [64, 152]) { r(wx, 8, 22, 16, '#7a5634'); r(wx + 2, 10, 18, 12, '#9fd3f0'); r(wx + 2, 18, 18, 4, '#c3e6f7'); r(wx + 10, 10, 2, 12, '#7a5634'); r(wx + 2, 15, 18, 1, '#7a5634'); r(wx - 1, 24, 24, 2, '#c9b48e'); }
  // clock
  r(118, 9, 10, 10, '#7a5634'); r(119, 10, 8, 8, '#fdf7ea'); r(122, 11, 1, 4, OUT); r(122, 14, 3, 1, OUT);
  // poster
  r(226, 8, 20, 24, '#d8483b'); r(228, 10, 16, 20, '#f6e7c8'); r(233, 13, 6, 3, IRON_D); r(231, 14, 2, 1, IRON_D); r(239, 14, 2, 1, IRON_D); r(231, 20, 10, 1, '#d8483b'); r(232, 23, 8, 1, '#d8483b'); r(233, 26, 6, 1, '#d8483b');
  // floor: rubber tiles
  for (let y = 46; y < H; y += 12) for (let x = 0; x < W; x += 16) {
    const odd = ((x / 16) + Math.floor((y - 46) / 12)) % 2;
    r(x, y, 16, 12, odd ? '#4b4f57' : '#454950'); r(x, y, 16, 1, '#555a62');
  }
  // wooden border at the bottom
  r(0, H - 6, W, 6, '#8a6440'); r(0, H - 6, W, 1, '#a77b4f');

  // climbing wall
  r(6, 2, 50, 66, '#c9a06e'); r(6, 2, 50, 2, '#a77b4f'); r(6, 66, 50, 2, '#7a5634');
  const holds = [[10, 8, '#e23b3b'], [22, 12, '#f2d245'], [36, 7, '#45b45a'], [48, 14, '#2e9fd6'], [14, 22, '#8c5bd6'], [30, 25, '#f19a33'], [44, 30, '#e23b3b'], [12, 38, '#45b45a'], [26, 42, '#2e9fd6'], [40, 46, '#f2d245'], [18, 54, '#e66fab'], [34, 58, '#8c5bd6'], [50, 52, '#45b45a']];
  for (const [hx, hy, col] of holds) { r(hx, hy, 3, 2, col); r(hx, hy + 2, 3, 1, shade(col, -0.35)); }
  r(4, 66, 54, 6, '#3c5bd9'); r(4, 66, 54, 1, '#5d7bf0');                        // crash pad

  // squat rack
  r(78, 30, 2, 50, IRON_D); r(104, 30, 2, 50, IRON_D); r(78, 30, 28, 2, IRON); r(77, 79, 4, 2, IRON_D); r(103, 79, 4, 2, IRON_D);
  r(80, 52, 24, 1, IRON_L); r(80, 50, 2, 5, IRON_D); r(102, 50, 2, 5, IRON_D);         // bar resting on the hooks
  // bench press
  r(116, 70, 34, 4, '#7c2c2c'); r(116, 70, 34, 1, '#a34444'); r(120, 74, 2, 6, IRON_D); r(144, 74, 2, 6, IRON_D);
  r(114, 54, 2, 18, IRON_D); r(150, 54, 2, 18, IRON_D);
  // cable machine with weight stack
  r(158, 22, 30, 3, IRON); r(158, 22, 3, 56, IRON_D); r(185, 22, 3, 56, IRON_D);
  r(167, 48, 12, 24, IRON_D); for (let i = 0; i < 6; i++) r(168, 49 + i * 4, 10, 3, IRON);
  r(172, 25, 1, 23, IRON_L);
  // pull-up bar
  r(196, 34, 2, 42, IRON_D); r(214, 34, 2, 42, IRON_D); r(196, 50, 20, 2, IRON_L);
  // dumbbell rack
  r(218, 72, 34, 4, IRON_D); r(218, 76, 2, 8, IRON_D); r(250, 76, 2, 8, IRON_D);
  for (let i = 0; i < 6; i++) { const dx = 220 + i * 5; r(dx, 69, 4, 1, IRON_L); r(dx, 68, 1, 3, IRON_D); r(dx + 3, 68, 1, 3, IRON_D); }
  // machine (seat + stack)
  r(50, 92, 4, 26, IRON_D); r(52, 96, 8, 10, IRON); r(54, 108, 14, 4, '#7c2c2c'); r(66, 92, 28, 3, IRON);
  // mat
  r(96, 118, 64, 26, '#2e6fa8'); r(96, 118, 64, 2, '#4a8fcc'); r(96, 142, 64, 2, '#225580');
  // kettlebells by the mat
  r(162, 136, 5, 5, IRON_D); r(163, 134, 3, 2, IRON_D); r(170, 138, 4, 4, IRON); r(171, 136, 2, 2, IRON);
  // treadmills
  for (const tx of [170, 188]) { r(tx, 140, 16, 16, IRON_D); r(tx + 2, 142, 12, 13, '#2a2d32'); r(tx + 2, 136, 12, 4, IRON); r(tx + 4, 137, 8, 2, '#6fd3a0'); r(tx + 2, 142 + ((t >> 3) % 4) * 3, 12, 1, '#3a3e45'); }
  // bike
  r(212, 140, 10, 3, IRON); r(214, 143, 2, 10, IRON_D); r(220, 146, 2, 8, IRON_D); r(211, 154, 12, 2, IRON_D);
  // rower
  r(228, 146, 22, 2, IRON); r(246, 140, 6, 8, IRON_D); r(228, 148, 2, 6, IRON_D);
  // rest area: bench, water cooler, plant, sign
  r(12, 156, 84, 4, '#a77b4f'); r(12, 156, 84, 1, '#c99a66'); r(14, 160, 3, 6, '#7a5634'); r(91, 160, 3, 6, '#7a5634');
  r(100, 146, 8, 20, '#d8e6ee'); r(101, 140, 6, 7, '#7fc4ea'); r(102, 141, 2, 4, '#b5e0f5');
  r(4, 140, 6, 4, '#a0522d'); r(3, 144, 8, 10, '#8a4a28'); r(4, 132, 2, 8, '#3e8a3c'); r(7, 130, 3, 10, '#4cae48'); r(2, 134, 3, 4, '#4cae48');
  r(30, 146, 34, 8, '#7a5634'); r(31, 147, 32, 6, '#f6e7c8');
}

// ---------- the scene ----------
// people: [{ id, name, avatar, inGym, station, label }]; returns the hit boxes (for taps)
export function drawGym(canvas, people, t, scale, restLabel = 'REST') {
  const lo = canvas._lo || (canvas._lo = document.createElement('canvas'));
  lo.width = W; lo.height = H;
  const c = lo.getContext('2d');
  c.imageSmoothingEnabled = false;
  drawRoom(c, t);
  const frame = Math.floor(t / 450) % 2;
  // place everyone, filling each station's spots, then spilling just beside them
  const used = {}, placed = [];
  for (const p of people) {
    const key = p.inGym ? p.station : 'rest', st = ST[key];
    const n = used[key] = (used[key] ?? -1) + 1;
    const [sx, sy] = st.spots[n % st.spots.length];
    const off = Math.floor(n / st.spots.length) * 9;
    placed.push({ p, x: sx + off, y: sy + (off ? 3 : 0), pose: st.pose, phase: hash(p.id) % 2 });
  }
  placed.sort((a, b) => a.y - b.y);   // nearer people drawn last
  for (const q of placed) {
    if (q.p.dog) drawDog(c, q.x, q.y, q.p.avatar, (frame + q.phase) % 2, q.p.inGym);
    else drawChar(c, q.x, q.y, q.p.avatar, q.pose, (frame + q.phase) % 2);
  }

  // up to the screen, crisp
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(lo, 0, 0, W * scale, H * scale);
  // names and "zzz" at full resolution so they're readable
  const boxes = [];
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const fs = Math.max(10, Math.round(scale * 4.2));
  ctx.font = `800 ${Math.round(scale * 4.4)}px system-ui, sans-serif`; ctx.fillStyle = '#7a5634';
  ctx.fillText(restLabel, 47 * scale, 147.6 * scale);
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  for (const q of placed) {
    const cx = q.x * scale, fy = (q.y + 2) * scale;
    const name = q.p.name.length > 9 ? q.p.name.slice(0, 8) + '…' : q.p.name;
    const w = ctx.measureText(name).width + fs * 0.7;
    ctx.fillStyle = q.p.me ? 'rgba(242,210,69,.92)' : 'rgba(20,16,14,.72)';
    ctx.fillRect(cx - w / 2, fy, w, fs * 1.25);
    ctx.fillStyle = q.p.me ? '#231a17' : '#fff';
    ctx.fillText(name, cx, fy + fs * 0.12);
    if (!q.p.inGym && !q.p.dog) {   // dozing on the bench
      const zf = Math.round(fs * 1.1), drift = (t / 90) % 14;
      ctx.font = `800 ${zf}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText('z', cx + 6 * scale, (q.y - 30) * scale - drift);
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
    }
    boxes.push({ p: q.p, x0: (q.x - 8) * scale, x1: (q.x + 8) * scale, y0: (q.y - 30) * scale, y1: (q.y + 6) * scale });
  }
  return boxes;
}

// a single avatar, big, for the editor and profile
export function drawPortrait(canvas, av, pose = 'stand', frame = 0) {
  const lo = document.createElement('canvas'); lo.width = 32; lo.height = 34;
  const c = lo.getContext('2d');
  drawChar(c, 16, 31, av, pose, frame);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.floor(Math.min(canvas.width / 32, canvas.height / 34));
  ctx.drawImage(lo, (canvas.width - 32 * s) / 2, (canvas.height - 34 * s) / 2, 32 * s, 34 * s);
}

// ---------- treasure chest (check-in reward) ----------
// state: 'shut' | 'shake' | 'open'; big chests are gold
export function drawChest(canvas, state = 'shut', frame = 0, big = false) {
  const lo = document.createElement('canvas'); lo.width = 40; lo.height = 36;
  const c = lo.getContext('2d');
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const wood = big ? '#d9a12b' : '#a0602e', woodD = shade(wood, -0.3), woodL = shade(wood, 0.25), band = big ? '#fff3b0' : '#5d6470', bandD = shade(band, -0.3);
  const dx = state === 'shake' ? (frame ? 1 : -1) : 0;
  r(8, 33, 24, 2, 'rgba(0,0,0,.25)');                                   // shadow
  // body
  r(7 + dx, 18, 26, 15, wood); r(7 + dx, 18, 26, 2, woodL); r(7 + dx, 31, 26, 2, woodD);
  r(7 + dx, 18, 2, 15, band); r(31 + dx, 18, 2, 15, band); r(7 + dx, 24, 26, 2, bandD);
  if (state === 'open') {
    // lid flipped back, glow and coins
    r(7, 8, 26, 6, woodD); r(7, 8, 26, 1, wood); r(7, 8, 2, 6, band); r(31, 8, 2, 6, band);
    c.fillStyle = big ? 'rgba(255,236,140,.9)' : 'rgba(255,236,140,.6)';
    c.beginPath(); c.moveTo(9, 18); c.lineTo(2, 0); c.lineTo(38, 0); c.lineTo(31, 18); c.fill();
    const coin = (x, y) => { r(x, y, 4, 4, '#f2c430'); r(x + 1, y, 2, 1, '#fff0a0'); r(x, y + 3, 4, 1, '#b8881a'); };
    coin(12, 14 - frame); coin(18, 12 + frame); coin(24, 14 - frame); if (big) { coin(15, 9 + frame); coin(21, 8 - frame); }
    r(9, 17, 22, 2, '#3a2412');
  } else {
    r(9 + dx, 9, 22, 2, wood); r(9 + dx, 9, 22, 1, woodL);             // rounded lid top
    r(7 + dx, 11, 26, 8, wood); r(7 + dx, 11, 26, 1, woodL); r(7 + dx, 11, 2, 8, band); r(31 + dx, 11, 2, 8, band); r(9 + dx, 9, 2, 2, band); r(29 + dx, 9, 2, 2, band);
    r(7 + dx, 18, 26, 1, '#231a17');                                    // gap between lid and body
    r(18 + dx, 17, 4, 5, band); r(19 + dx, 19, 2, 2, '#231a17');        // lock
  }
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.floor(Math.min(canvas.width / 40, canvas.height / 36));
  ctx.drawImage(lo, (canvas.width - 40 * s) / 2, (canvas.height - 36 * s) / 2, 40 * s, 36 * s);
}

// Proper backs for the ones where hiding the face isn't enough (you'd see their back, not their front)
function drawBackSprite(r, i, base, b, frame, crown) {
  switch (i) {
    case 0: case 16: {   // couch: the tall back panel, no cushions or arms
      const y = 12 + base + b, king = i === 16;
      r(4, y, 40, 22, king ? '#7a4c30' : '#8a5a3c'); r(4, y, 40, 3, king ? '#7c2c8c' : '#a87450');
      for (let k = 0; k < 3; k++) r(6, y + 7 + k * 5, 36, 1, '#6b4128');   // stitching
      r(4, y + 20, 40, 2, '#5a3620'); r(7, y + 22, 3, 3, '#3a2416'); r(38, y + 22, 3, 3, '#3a2416');
      if (king) crown(18, y - 6);
      return true;
    }
    case 3: {   // clock: red back, winding key and battery door
      const y = 6 + base + b;
      r(10, y + 4, 28, 26, '#d8483b'); r(12, y + 2, 24, 2, '#d8483b'); r(12, y + 30, 24, 2, '#d8483b');
      r(8, y - 2, 8, 5, '#f2d245'); r(32, y - 2, 8, 5, '#f2d245'); r(13, y + 32, 4, 3, '#7a2c2c'); r(31, y + 32, 4, 3, '#7a2c2c');
      r(17, y + 18, 14, 8, '#b7392a'); r(18, y + 19, 12, 6, '#c8423a');   // battery door
      r(22, y + 8, 4, 2, '#8a8f98'); r(20, y + 6 - frame, 8, 2, '#a4abb2');   // winding key
      return true;
    }
    case 5: {   // phone: the back, camera bump
      const y = 4 + base + b;
      r(13, y, 22, 34, '#2b2b30'); r(15, y + 2, 18, 30, '#3a3d44');
      r(16, y + 3, 8, 8, '#2b2b30'); r(17, y + 4, 3, 3, '#5d6470'); r(21, y + 4, 2, 2, '#5d6470'); r(17, y + 8, 2, 2, '#f2d245');
      r(8, y + 14, 5, 3, '#2b2b30'); r(35, y + 14, 5, 3, '#2b2b30');
      return true;
    }
    case 7: {   // duvet burrito: the other end of the roll, back of the head
      const y = 14 + base;
      r(4, y + 2 + b, 40, 20, '#f3f1ea'); r(4, y + 2 + b, 40, 2, '#ffffff'); for (let k = 0; k < 4; k++) r(10 + k * 9, y + 4 + b, 2, 18, '#9ec9e8');
      r(4, y + 22, 40, 2, '#c8d6e2');
      r(32, y - 5 + b, 12, 12, '#5b3a22'); r(33, y - 6 + b, 10, 2, '#5b3a22'); r(34, y - 3 + b, 3, 2, '#7a5034');   // hair
      r(28, y - 10 - frame, 3, 1, '#ffffff'); r(29, y - 9 - frame, 1, 1, '#ffffff'); r(28, y - 8 - frame, 3, 1, '#ffffff');
      return true;
    }
    case 10: {   // overtime ghost: just the sheet, laptop hidden in front
      const y = 4 + base + b;
      r(12, y + 4, 24, 26, '#eef0ea'); r(14, y + 2, 20, 2, '#eef0ea'); r(14, y + 6, 3, 18, '#dfe3dc');
      for (let k = 0; k < 4; k++) r(12 + k * 6 + (frame ? 3 : 0), y + 30, 3, 3, '#eef0ea');
      r(22, y + 4, 4, 1, '#3c5bd9');   // the tie's knot strap at the neck
      r(10, y + 16, 2, 6, '#9fd3f0');   // laptop glow round the side
      return true;
    }
    case 14: {   // binge kraken: back of the head, tentacles, the TV's glow beyond
      const y = 4 + base + b;
      r(10, y + 20, 28, 14, frame ? 'rgba(95,211,243,.35)' : 'rgba(155,232,248,.35)');   // screen glow
      r(12, y, 24, 18, '#8c5bd6'); r(14, y - 2, 20, 2, '#8c5bd6'); r(28, y + 2, 5, 3, '#b48ae8'); r(14, y + 12, 20, 2, '#7c4fb6');
      for (let k = 0; k < 5; k++) { const tx = 8 + k * 8; r(tx, y + 18, 4, 14 + ((k + frame) % 2) * 2, '#7c4fb6'); r(tx + 1, y + 20, 2, 2, '#9b6ad8'); }
      return true;
    }
    case 17: {   // hydra: three heads seen from behind
      const y = 12 + base;
      r(10, y + 10, 28, 18, '#6b3fa0'); r(12, y + 12, 24, 2, '#7c4fb6');
      for (const [hx, off] of [[4, b], [19, -b], [34, b]]) {
        const hy = y + (hx === 19 ? -4 : 0) + off;
        r(hx + 3, hy + 8, 4, 6, '#6b3fa0'); r(hx, hy, 10, 9, '#7c4fb6'); r(hx + 2, hy + 1, 6, 1, '#9b6ad8'); r(hx + 4, hy - 2, 2, 2, '#c9b6e8');   // spines
      }
      r(40, y + 22, 6, 3, '#6b3fa0');   // tail
      return true;
    }
    case 1: case 12: {   // dragons: plain back, wing nubs and a tail, no belly
      const y = (i === 12 ? 10 : 8) + base + b, body = i === 12 ? '#c8382c' : '#4fae5a', dark = i === 12 ? '#a02a20' : '#3d8a46';
      r(10, y + 6, 28, 22, body); r(8, y, 10, 10, body); r(30, y, 10, 10, body); r(9, y - 3, 2, 3, '#f2d245'); r(37, y - 3, 2, 3, '#f2d245');
      for (let k = 0; k < 4; k++) r(22, y + 8 + k * 5, 4, 3, dark);   // spine plates
      r(6, y + 10, 8, 6, dark); r(34, y + 10, 8, 6, dark);   // wings
      r(36, y + 24, 10, 3, body); r(44, y + 22, 3, 3, dark);   // tail
      if (i === 12) { const cy = y - 8 - frame; r(29, cy, 19, 14, '#f3f1ea'); r(29, cy, 19, 4, '#e23b3b'); }   // the calendar from behind
      return true;
    }
    case 4: {   // bubble tea: the cup's back, pearls, straw
      const y = 6 + base + b;
      r(17, y - 6, 3, 12, '#e66fab'); r(12, y + 2, 24, 3, '#eeeeee'); r(13, y + 5, 22, 26, '#d9b48c'); r(15, y + 31, 18, 2, '#c4a07a');
      r(16, y + 9, 16, 6, '#ece3d3'); r(18, y + 11, 12, 1, '#c4a07a');   // label
      for (const [bx, by] of [[16, 25], [21, 27], [26, 25], [30, 27], [18, 29], [24, 29], [28, 29]]) r(bx, y + by, 3, 3, '#3a2416');
      return true;
    }
    case 6: {   // takeaway goblin: back of head, cap, the big delivery box on its back
      const y = 8 + base + b;
      r(10, y + 8, 18, 18, '#5aa648'); r(8, y + 10, 3, 5, '#5aa648'); r(27, y + 10, 3, 5, '#5aa648');
      r(10, y + 5, 18, 4, '#f2d245'); r(12, y + 9, 6, 2, '#e8b923');   // cap from behind
      r(12, y + 18, 22, 18, '#d8483b'); r(12, y + 18, 22, 3, '#b7392a'); r(18, y + 25, 10, 5, '#f3f1ea'); r(16, y + 16, 2, 4, '#2b2b30'); r(28, y + 16, 2, 4, '#2b2b30');   // box + straps
      r(12, y + 36, 4, 2, '#2b2b30'); r(28, y + 36, 4, 2, '#2b2b30');
      return true;
    }
    case 11: {   // barrel: staves and hoops, no belly
      const y = 6 + base + b;
      r(12, y + 2, 24, 4, '#f3f1ea'); r(10, y + 4, 4, 3, '#f3f1ea'); r(34, y + 4, 4, 3, '#f3f1ea');
      r(10, y + 6, 28, 28, '#a8743f'); for (let k = 0; k < 5; k++) r(14 + k * 5, y + 6, 1, 28, '#8a5a3c');
      r(10, y + 10, 28, 2, '#5d6470'); r(10, y + 28, 28, 2, '#5d6470'); r(22, y + 18, 4, 4, '#6b4128');   // tap hole
      r(4, y + 16, 6, 4, '#a8743f'); r(38, y + 16, 6, 4, '#a8743f');
      return true;
    }
    case 13: {   // phoenix: back, tail feathers, wings
      const y = 6 + base + b;
      r(16, y + 8, 16, 18, '#e8862a'); r(18, y + 2, 12, 8, '#f19a33'); r(20, y - 2, 2, 4, '#e23b3b'); r(24, y - 4, 2, 6, '#f2d245'); r(28, y - 2, 2, 4, '#e23b3b');
      const wy = frame ? y + 2 : y + 10;
      r(4, wy, 12, 6, '#e23b3b'); r(2, wy + 6, 8, 3, '#f2d245'); r(32, wy, 12, 6, '#e23b3b'); r(38, wy + 6, 8, 3, '#f2d245');
      r(18, y + 24, 3, 8, '#e23b3b'); r(22, y + 24, 4, 10, '#f2d245'); r(27, y + 24, 3, 8, '#e23b3b');   // tail
      return true;
    }
    case 15: {   // excuse golem: all bricks, no sign
      const y = 4 + base + b;
      const brick = (x, yy, w, h) => { r(x, yy, w, h, '#b7563f'); for (let j = 0; j < h; j += 4) { r(x, yy + j, w, 1, '#8a3a2a'); for (let k = (j / 4) % 2 ? 2 : 6; k < w; k += 8) r(x + k, yy + j, 1, 4, '#8a3a2a'); } };
      brick(14, y, 20, 10); brick(8, y + 10, 32, 16); brick(2, y + 10, 6, 14); brick(40, y + 10, 6, 14); brick(12, y + 26, 8, 8); brick(28, y + 26, 8, 8);
      return true;
    }
    default: return false;
  }
}

// ---------- evolved forms: the excuse turned into a motivation. Each one is its own drawing. ----------
// r: rect painter on the 48×40 sprite, eyes(): front eyes (skipped from behind), back: seen from behind.
const WH = '#f8f8f2';   // white that the back-view pass leaves alone
function drawEvo(r, i, base, b, frame, ko, back, eyes, crown) {
  const mouth = (x, y, w = 6) => { if (!back && !ko) { r(x, y, w, 2, OUT); r(x + 1, y, 2, 1, WH); r(x + w - 3, y, 2, 1, WH); } };
  const smile = (x, y, w = 6) => { if (!back && !ko) { r(x, y, 1, 1, OUT); r(x + 1, y + 1, w - 2, 1, OUT); r(x + w - 1, y, 1, 1, OUT); } };
  const band = (x, y, w) => { r(x, y, w, 2, '#e23b3b'); if (back) { r(x + w - 2, y + 2, 2, 3, '#e23b3b'); r(x + w, y + 3, 2, 2, '#e23b3b'); } };
  switch (i) {
    case 0: {   // Yoga Mat Guardian: a standing rolled mat, arms up in a stretch
      const y = 4 + base + b;
      r(13, y + 4, 22, 26, '#8c5bd6'); r(13, y + 4, 22, 3, '#b48ae8'); r(11, y, 26, 6, '#6b3fa0'); r(12, y + 1, 24, 4, '#9b6ad8'); r(13, y + 2, 22, 1, '#b48ae8');   // mat + roll on top
      for (let k = 0; k < 5; k++) r(14, y + 9 + k * 4, 20, 1, '#7c4fb6');   // grip texture
      // arms up in a tree-pose stretch, hands meeting overhead
      r(7, y + 8, 6, 3, '#8c5bd6'); r(5, y + 2 - frame, 3, 7, '#8c5bd6'); r(35, y + 8, 6, 3, '#8c5bd6'); r(40, y + 2 - frame, 3, 7, '#8c5bd6');
      r(16, y + 30, 5, 6, '#6b3fa0'); r(27, y + 30, 5, 6, '#6b3fa0'); r(15, y + 35, 7, 2, '#45b45a'); r(26, y + 35, 7, 2, '#45b45a');   // legs + green socks
      if (!back) { eyes(17, 27, y + 12); smile(21, y + 18); r(15, y + 22, 3, 2, '#f59ab8'); r(30, y + 22, 3, 2, '#f59ab8'); r(22, y + 24, 4, 4, '#45b45a'); r(23, y + 23, 2, 1, '#6fd3a0'); }   // a leaf badge
      else { r(18, y + 12, 12, 12, '#7c4fb6'); r(22, y + 10, 4, 3, '#45b45a'); }
      break;
    }
    case 1: {   // Meal-Prep Dragon: green, a chef's hat, a stack of lunch boxes
      const y = 10 + base + b;
      r(12, y + 6, 24, 22, '#3d9a4c'); r(10, y, 10, 10, '#3d9a4c'); r(28, y, 10, 10, '#3d9a4c'); r(12, y + 6, 24, 2, '#5fc06a');
      r(11, y - 8, 14, 6, WH); r(13, y - 11, 10, 4, WH); r(11, y - 3, 14, 2, '#dfe3dc');   // chef's hat
      r(4, y + 12, 8, 5, '#2f7a3b'); r(36, y + 12, 8, 5, '#2f7a3b'); r(14, y + 28, 6, 4, '#2f7a3b'); r(28, y + 28, 6, 4, '#2f7a3b');
      if (!back) {
        r(16, y + 18, 16, 9, '#e8f0c8'); eyes(14, 29, y + 8); smile(19, y + 14, 10);
        for (let k = 0; k < 3; k++) { r(36, y + 14 + k * 5, 11, 4, WH); r(37, y + 15 + k * 5, 4, 2, ['#45b45a', '#d9a14b', '#e2563b'][k]); r(42, y + 15 + k * 5, 4, 2, '#f1e1b0'); }   // meal-prep boxes
      } else { for (let k = 0; k < 4; k++) r(22, y + 8 + k * 5, 4, 3, '#2f7a3b'); r(36, y + 24, 9, 3, '#3d9a4c'); }
      break;
    }
    case 2: {   // Hustle Slime: bright, upright, headband, flexing, sweat flying
      const y = 8 + base;
      const w = 30 - (frame ? 2 : 0), x = 24 - w / 2;
      r(x + 3, y + 2 - b, w - 6, 4, '#ff8a3d'); r(x, y + 6 - b, w, 22 + b, '#f26b1d'); r(x + 2, y + 28, w - 4, 2, '#c44f0f');
      r(x + 4, y + 7 - b, 5, 3, '#ffb27a');
      band(x, y + 8 - b, w);
      r(x - 6, y + 14 - b - frame, 6, 5, '#f26b1d'); r(x - 8, y + 11 - b - frame, 4, 4, '#ff8a3d'); r(x + w, y + 14 - b - frame, 6, 5, '#f26b1d'); r(x + w + 4, y + 11 - b - frame, 4, 4, '#ff8a3d');   // flexed arms
      if (!back) { eyes(x + 7, x + w - 10, y + 14 - b); mouth(x + w / 2 - 3, y + 20 - b); }
      r(x + w + 3, y + 2 + frame * 2, 2, 3, '#9fd3f0'); r(x - 4, y + 4 - frame * 2, 2, 3, '#9fd3f0');   // sweat
      for (let k = 0; k < 3; k++) r(2, y + 18 + k * 4, 3, 1, '#ffb27a');   // speed lines
      break;
    }
    case 3: {   // Early-Bird Clock: a round yellow clock with wings and a crest, the sun rising behind
      const y = 6 + base + b;
      if (!back) for (let k = 0; k < 5; k++) r(4 + k * 9, y + 2 + (k % 2) * 2, 2, 5, '#ffd76a');   // sun rays
      r(14, y + 6, 20, 24, '#f2c230'); r(12, y + 10, 24, 16, '#f2c230'); r(16, y + 4, 16, 2, '#f2c230'); r(16, y + 30, 16, 2, '#f2c230');
      r(20, y - 2, 3, 6, '#e23b3b'); r(24, y - 4, 3, 8, '#f19a33'); r(28, y - 1, 3, 5, '#e23b3b');   // crest
      const wy = frame ? y + 6 : y + 12; r(2, wy, 10, 6, '#f8f8f2'); r(0, wy + 4, 6, 4, '#dfe3dc'); r(36, wy, 10, 6, '#f8f8f2'); r(42, wy + 4, 6, 4, '#dfe3dc');   // wings
      r(18, y + 32, 3, 4, '#f19a33'); r(27, y + 32, 3, 4, '#f19a33');   // bird feet
      if (!back) { r(16, y + 10, 16, 16, '#fffbe8'); r(23, y + 11, 2, 7, OUT); r(23, y + 17, 2, 7, OUT); r(22, y + 17, 4, 2, OUT);   // 6:00
        eyes(16, 28, y + 13, '#fff'); r(22, y + 9, 4, 2, '#f19a33'); }   // little beak
      else { r(18, y + 12, 12, 10, '#e0ad1f'); r(22, y + 14, 4, 3, '#a4abb2'); }
      break;
    }
    case 4: {   // Protein Shake Beast: a big shaker, arms like hams, a scoop
      const y = 2 + base + b;
      r(14, y, 20, 5, '#3c5bd9'); r(21, y - 3, 6, 3, '#3c5bd9'); r(13, y + 5, 22, 2, '#2e4ab8');   // lid
      r(14, y + 7, 20, 28, '#dfe7ee'); r(14, y + 18, 20, 17, '#a8743f'); r(16, y + 9, 3, 8, WH);   // cup + chocolate shake
      for (let k = 0; k < 4; k++) r(31, y + 10 + k * 5, 3, 1, '#8a8f98');
      r(4, y + 14 - frame, 10, 7, '#c48a55'); r(2, y + 10 - frame, 6, 6, '#c48a55'); r(34, y + 14 - frame, 10, 7, '#c48a55'); r(40, y + 10 - frame, 6, 6, '#c48a55');   // flexing arms
      if (!back) { eyes(17, 27, y + 10, '#fff'); mouth(20, y + 22, 8); r(40, y + 4 - frame, 6, 4, '#eeeeee'); r(42, y + 8 - frame, 2, 4, '#8a8f98'); }   // scoop
      else { r(17, y + 22, 14, 8, WH); r(19, y + 24, 10, 1, '#3c5bd9'); r(19, y + 26, 7, 1, '#3c5bd9'); }   // nutrition label
      break;
    }
    case 5: {   // Workout Tracker: a smartwatch with a heart-rate line, running on its strap
      const y = 4 + base + b;
      r(17, y - 2, 14, 8, '#2b2b30'); r(17, y + 28, 14, 6, '#2b2b30');   // strap
      r(12, y + 6, 24, 22, '#5d6470'); r(13, y + 7, 22, 20, '#1d2125');
      r(36, y + 12, 2, 5, '#a4abb2');   // crown button
      if (!back) {
        r(15, y + 9, 18, 16, '#0f3d2a');
        const pts = [4, 4, 4, 1, 8, 4, 4, 4, 2, 4, 4, 4]; pts.forEach((h, k) => r(16 + k, y + 12 + h, 1, 1, '#45e07a'));   // heart-rate line
        r(17, y + 20, 3, 3, '#e23b3b'); r(21, y + 21, 8, 1, '#45e07a'); eyes(18, 27, y + 13);
      } else { r(18, y + 12, 12, 10, '#2b2b30'); r(20, y + 14, 2, 2, '#45e07a'); r(26, y + 14, 2, 2, '#45e07a'); r(23, y + 18, 2, 2, '#e23b3b'); }   // sensors
      r(16 + frame * 4, y + 34, 5, 3, '#f2f2f2'); r(26 - frame * 4, y + 34, 5, 3, '#f2f2f2');   // running feet
      break;
    }
    case 6: {   // Meal-Prep Chef: the goblin in whites, hat, apron, a carrot and a tray of boxes
      const y = 6 + base + b;
      r(12, y - 4, 14, 6, WH); r(14, y - 7, 10, 4, WH); r(12, y + 1, 14, 2, '#dfe3dc');   // chef's hat
      r(12, y + 3, 14, 13, '#6fbf5a'); r(9, y + 5, 3, 5, '#6fbf5a'); r(26, y + 5, 3, 5, '#6fbf5a');
      r(11, y + 16, 16, 16, WH); r(17, y + 16, 4, 16, '#dfe3dc');   // whites
      r(12, y + 32, 5, 3, '#2b2b30'); r(21, y + 32, 5, 3, '#2b2b30');
      if (!back) {
        eyes(14, 21, y + 7); smile(16, y + 12);
        r(13, y + 20, 12, 10, '#e23b3b'); r(14, y + 21, 10, 1, '#f3f1ea');   // apron
        r(4, y + 14 - frame, 3, 8, '#f19a33'); r(4, y + 12 - frame, 3, 2, '#45b45a');   // carrot
        r(30, y + 18, 16, 3, '#8a8f98'); for (let k = 0; k < 3; k++) { r(31 + k * 5, y + 13, 4, 5, WH); r(32 + k * 5, y + 14, 2, 2, ['#45b45a', '#d9a14b', '#e2563b'][k]); }   // tray
      } else { r(17, y + 18, 4, 3, '#e23b3b'); r(15, y + 21, 3, 2, '#e23b3b'); r(20, y + 21, 3, 2, '#e23b3b'); }   // apron bow
      break;
    }
    case 7: {   // Sunrise Runner: out of the duvet, wearing it as a cape, running at dawn
      const y = 4 + base + b;
      r(30, y - 2, 14, 7, '#f2c230'); r(28, y + 1, 18, 4, '#ffd76a');   // rising sun
      r(14, y + 6, 18, 18, '#f8f8f2'); for (let k = 0; k < 3; k++) r(16 + k * 6, y + 8, 2, 16, '#9ec9e8');   // cape
      r(18, y + 2, 10, 10, '#eebc94'); r(18, y + 1, 10, 3, '#5b3a22'); band(18, y + 4, 10);   // head
      r(19, y + 14, 8, 10, '#3c5bd9');   // vest
      const s = frame ? 4 : 0; r(17 + s, y + 24, 4, 8, '#2b2b30'); r(25 - s, y + 24, 4, 8, '#2b2b30'); r(16 + s, y + 32, 6, 3, '#e23b3b'); r(24 - s, y + 32, 6, 3, '#e23b3b');   // legs + shoes
      if (!back) { r(20, y + 7, 2, 2, OUT); r(25, y + 7, 2, 2, OUT); r(21, y + 10, 4, 1, OUT); r(14, y + 6, 18, 2, '#dfe3dc'); }
      else { r(18, y + 2, 10, 9, '#5b3a22'); r(14, y + 6, 18, 20, '#f8f8f2'); for (let k = 0; k < 3; k++) r(16 + k * 6, y + 8, 2, 18, '#9ec9e8'); }
      for (let k = 0; k < 3; k++) r(4, y + 14 + k * 5, 6, 1, '#dfe3dc');   // speed lines
      break;
    }
    case 8: {   // Rain-or-Shine Cloud: white and sunny, a rainbow over it, trainers on
      const y = 6 + base + b;
      const bands = ['#e23b3b', '#f19a33', '#f2c230', '#45b45a', '#2e9fd6'];
      bands.forEach((c, k) => { r(4 + k, y + 6 - k + 4, 2, 10 - k, c); r(42 - k, y + 6 - k + 4, 2, 10 - k, c); r(6 + k, y + 2 + k, 36 - 2 * k, 2, c); });   // rainbow arch
      r(10, y + 12, 28, 14, WH); r(14, y + 8, 12, 6, WH); r(24, y + 6, 12, 8, WH); r(10, y + 24, 28, 2, '#dfe3dc');
      r(32, y + 4, 7, 7, '#f2c230');   // sun peeking out
      r(14, y + 28, 6, 4, '#3c5bd9'); r(28, y + 28, 6, 4, '#3c5bd9'); r(14, y + 32, 7, 2, WH); r(28, y + 32, 7, 2, WH);   // trainers
      if (!back) { eyes(16, 27, y + 15, '#fff'); smile(20, y + 20, 8); r(14, y + 19, 2, 1, '#f59ab8'); r(32, y + 19, 2, 1, '#f59ab8'); }
      break;
    }
    case 9: {   // Recovery Jelly: cool mint, an ice pack on top, hugging a foam roller
      const y = 10 + base;
      const w = 32 + (ko ? 6 : frame * 2), x = 24 - w / 2;
      r(x + 3, y + 2 - b, w - 6, 3, '#9fe8c8'); r(x, y + 5 - b, w, 18 + b, '#6fd3a0'); r(x + 2, y + 23, w - 4, 2, '#45a87a');
      r(x + 4, y + 7 - b, 4, 3, '#c8f5e0');
      r(16, y - 4 - b, 16, 6, '#9fd3f0'); r(17, y - 3 - b, 14, 1, '#d7f0fc'); r(22, y - 6 - b, 4, 2, '#5fb8f3');   // ice pack
      if (!back) { eyes(16, 27, y + 9 - b); smile(20, y + 15 - b, 8); r(6, y + 18, 36, 6, '#2e9fd6'); for (let k = 0; k < 6; k++) r(8 + k * 6, y + 18, 1, 6, '#1d6f9a'); }   // foam roller in its arms
      for (const [sx, sy] of frame ? [[6, y], [40, y + 6]] : [[40, y - 2], [4, y + 8]]) { r(sx, sy, 1, 3, WH); r(sx - 1, sy + 1, 3, 1, WH); }   // sparkle
      break;
    }
    case 10: {   // Lunch-Break Lifter: a solid, rosy ghost pressing a dumbbell overhead, tie over the shoulder
      const y = 6 + base + b;
      const up = frame ? 0 : 3;
      r(12, y + 6, 24, 24, '#f3eee8'); r(14, y + 4, 20, 2, '#f3eee8');
      for (let k = 0; k < 4; k++) r(12 + k * 6 + (frame ? 3 : 0), y + 30, 3, 3, '#f3eee8');
      r(8, y + 8 + up, 4, 10 - up, '#f3eee8'); r(36, y + 8 + up, 4, 10 - up, '#f3eee8');   // arms up
      r(2, y + 2 + up, 44, 2, '#8a8f98'); r(0, y - 1 + up, 4, 8, '#2b2b30'); r(44, y - 1 + up, 4, 8, '#2b2b30');   // dumbbell bar overhead
      band(12, y + 7, 24);
      r(30, y + 12, 3, 2, '#3c5bd9'); r(32, y + 10, 2, 6, '#3c5bd9');   // tie flipped over
      if (!back) { eyes(16, 26, y + 12, '#fff'); r(15, y + 15, 3, 1, '#f59ab8'); r(28, y + 15, 3, 1, '#f59ab8'); mouth(20, y + 19, 7); }
      break;
    }
    case 11: {   // Six-Pack Barrel: lean barrel, carved abs, flexing
      const y = 4 + base + b;
      r(12, y + 2, 24, 4, '#e23b3b'); if (back) r(34, y + 5, 3, 5, '#e23b3b');   // headband instead of foam
      r(12, y + 6, 24, 28, '#c48a55'); r(12, y + 6, 2, 28, '#a8743f'); r(34, y + 6, 2, 28, '#a8743f');
      r(12, y + 9, 24, 2, '#5d6470'); r(12, y + 30, 24, 2, '#5d6470');
      r(4, y + 14 - frame, 8, 6, '#c48a55'); r(2, y + 9 - frame, 5, 6, '#c48a55'); r(36, y + 14 - frame, 8, 6, '#c48a55'); r(41, y + 9 - frame, 5, 6, '#c48a55');   // flex
      if (!back) { eyes(16, 27, y + 12); smile(21, y + 17);
        for (let k = 0; k < 3; k++) { r(18, y + 20 + k * 3, 5, 2, '#a8743f'); r(25, y + 20 + k * 3, 5, 2, '#a8743f'); } }   // six-pack
      else for (let k = 0; k < 5; k++) r(15 + k * 4, y + 11, 1, 19, '#a8743f');
      break;
    }
    case 12: {   // Do-It-Today Dragon: fiery red, flame wings, holding a calendar with today ticked off
      const y = 8 + base + b;
      r(4, y + 4 - frame, 8, 12, '#f19a33'); r(2, y + 2 - frame, 4, 6, '#f2c230'); r(36, y + 4 - frame, 8, 12, '#f19a33'); r(42, y + 2 - frame, 4, 6, '#f2c230');   // flame wings
      r(12, y + 6, 24, 24, '#d8483b'); r(10, y, 10, 10, '#d8483b'); r(28, y, 10, 10, '#d8483b'); r(12, y + 6, 24, 2, '#f06a5d');
      r(11, y - 3, 3, 4, '#f2c230'); r(34, y - 3, 3, 4, '#f2c230'); r(22, y - 4, 4, 5, '#f2c230');   // three horns
      r(14, y + 30, 6, 4, '#a02a20'); r(28, y + 30, 6, 4, '#a02a20');
      if (!back) { r(16, y + 18, 16, 10, '#f1c27d'); eyes(14, 29, y + 8); smile(19, y + 14, 10);
        r(30, y + 16, 14, 12, WH); r(30, y + 16, 14, 3, '#45b45a'); r(33, y + 22, 2, 2, '#45b45a'); r(35, y + 24, 2, 2, '#45b45a'); r(37, y + 22, 2, 2, '#45b45a'); r(39, y + 20, 2, 2, '#45b45a'); }   // ✓
      else { for (let k = 0; k < 4; k++) r(22, y + 8 + k * 5, 4, 3, '#a02a20'); r(36, y + 26, 10, 3, '#d8483b'); r(44, y + 23, 3, 4, '#f2c230'); }   // flame-tipped tail
      break;
    }
    case 13: {   // Right-Now Phoenix: white-hot, a lightning crest, a stopwatch on its chest
      const y = 4 + base + b;
      const wy = frame ? y + 4 : y + 10;
      r(2, wy, 14, 6, '#f2c230'); r(0, wy + 6, 10, 3, '#fff3b0'); r(32, wy, 14, 6, '#f2c230'); r(38, wy + 6, 10, 3, '#fff3b0');   // blazing wings
      r(16, y + 10, 16, 18, '#ffd76a'); r(18, y + 4, 12, 8, '#ffe9a0');
      r(22, y - 4, 3, 4, '#f2f2f2'); r(24, y - 1, 3, 3, '#f2f2f2'); r(20, y - 6, 3, 3, '#f2f2f2');   // lightning crest
      r(19, y + 28, 3, 7, '#f19a33'); r(23, y + 28, 2, 8, '#e23b3b'); r(26, y + 28, 3, 7, '#f19a33');   // tail flames
      if (!back) { eyes(19, 26, y + 6); r(30, y + 8, 4, 2, '#f19a33');
        r(19, y + 15, 10, 10, '#f2f2f2'); r(20, y + 16, 8, 8, '#2b2b30'); r(23, y + 13, 2, 2, '#f2f2f2'); r(23, y + 18, 1, 3, '#45e07a'); r(24, y + 20, 2, 1, '#45e07a'); }   // stopwatch
      else r(18, y + 12, 12, 14, '#f2c230');
      break;
    }
    case 14: {   // Workout-Video Kraken: a headset, a dumbbell in each tentacle, the TV now showing a workout
      const y = 2 + base + b;
      r(12, y, 24, 18, '#2e9fd6'); r(14, y - 2, 20, 2, '#2e9fd6'); r(15, y + 2, 5, 3, '#7fc8ef');
      r(10, y + 4, 3, 8, '#2b2b30'); r(11, y + 11, 6, 2, '#2b2b30');   // headset + mic
      for (let k = 0; k < 5; k++) { const tx = 6 + k * 9; r(tx, y + 18, 4, 12 + ((k + frame) % 2) * 2, '#1f7fb3'); }
      r(2, y + 26 - frame, 8, 3, '#5d6470'); r(1, y + 24 - frame, 2, 7, '#2b2b30'); r(9, y + 24 - frame, 2, 7, '#2b2b30');   // dumbbells
      r(38, y + 26 + frame - 1, 8, 3, '#5d6470'); r(37, y + 24 + frame - 1, 2, 7, '#2b2b30'); r(45, y + 24 + frame - 1, 2, 7, '#2b2b30');
      if (!back) { eyes(16, 27, y + 6); smile(20, y + 12, 8);
        r(15, y + 22, 18, 13, '#2b2b30'); r(17, y + 24, 14, 8, '#9be8f8'); r(23, y + 25, 2, 2, OUT); r(23, y + 27, 2, 3, OUT); r(20 + frame, y + 27, 3, 1, OUT); r(25 - frame, y + 27, 3, 1, OUT); }   // stick figure on TV
      else r(14, y + 12, 20, 2, '#1f7fb3');
      break;
    }
    case 15: {   // Discipline Golem: polished steel, a checklist chest plate, a barbell across the shoulders
      const y = 4 + base + b;
      r(0, y + 8, 48, 2, '#a4abb2'); r(0, y + 4, 4, 10, '#2b2b30'); r(44, y + 4, 4, 10, '#2b2b30');   // barbell
      r(15, y, 18, 10, '#8a8f98'); r(17, y + 2, 14, 6, '#a4abb2');
      r(8, y + 10, 32, 16, '#6a6f78'); r(10, y + 11, 28, 2, '#8a8f98');
      r(3, y + 11, 6, 13, '#6a6f78'); r(39, y + 11, 6, 13, '#6a6f78');
      r(12, y + 26, 9, 9, '#5d6470'); r(27, y + 26, 9, 9, '#5d6470');
      if (!back) { eyes(19, 26, y + 3, '#5fd3f3');
        r(15, y + 13, 18, 11, WH); for (let k = 0; k < 3; k++) { r(17, y + 15 + k * 3, 2, 2, '#45b45a'); r(21, y + 15 + k * 3, 10, 1, '#5d6470'); } }   // checklist
      else { r(14, y + 14, 20, 8, '#5d6470'); r(22, y + 12, 4, 12, '#8a8f98'); }
      break;
    }
    case 16: {   // Bench-Press King: the couch is now a bench; crowned, pressing a loaded bar
      const y = 6 + base + b;
      const up = frame ? 0 : 2;
      r(2, y + 2 + up, 44, 2, '#a4abb2'); r(2, y - 2 + up, 5, 10, '#e23b3b'); r(41, y - 2 + up, 5, 10, '#e23b3b'); r(7, y - 1 + up, 3, 8, '#2b2b30'); r(38, y - 1 + up, 3, 8, '#2b2b30');   // loaded bar
      r(12, y + 4 + up, 4, 10 - up, '#8a5a3c'); r(32, y + 4 + up, 4, 10 - up, '#8a5a3c');   // arms
      r(14, y + 12, 20, 14, '#8a5a3c'); r(14, y + 12, 20, 2, '#a87450');   // body
      r(6, y + 26, 36, 4, '#2b2b30'); r(6, y + 26, 36, 1, '#5d6470'); r(9, y + 30, 3, 5, '#5d6470'); r(36, y + 30, 3, 5, '#5d6470');   // bench
      crown(18, y + 6);
      if (!back) { eyes(17, 27, y + 15); smile(21, y + 20); r(24, y + 24, 2, 2, '#f2c230'); }
      else r(16, y + 15, 16, 8, '#7a4c30');
      break;
    }
    case 17: {   // Macro Hydra: three heads, each with its macro: protein, carbs, greens
      const y = 12 + base;
      r(10, y + 10, 28, 18, '#2e9a8a'); r(12, y + 12, 24, 2, '#45b8a8'); if (!back) r(14, y + 18, 20, 9, '#bfeee4');
      const foods = [['#f1c27d', '#d9a14b'], ['#f8f8f2', '#dfe3dc'], ['#45b45a', '#2f7a3b']];   // chicken, rice, broccoli
      [[4, b], [19, -b], [34, b]].forEach(([hx, off], k) => {
        const hy = y + (hx === 19 ? -4 : 0) + off;
        r(hx + 3, hy + 8, 4, 6, '#2e9a8a'); r(hx, hy, 10, 9, '#38b0a0');
        if (!back) { if (ko) { r(hx + 2, hy + 3, 2, 1, OUT); r(hx + 6, hy + 3, 2, 1, OUT); } else { r(hx + 2, hy + 2, 2, 2, '#fff'); r(hx + 6, hy + 2, 2, 2, '#fff'); r(hx + 3, hy + 3, 1, 1, OUT); r(hx + 7, hy + 3, 1, 1, OUT); }
          r(hx + 2, hy + 6, 6, 3, foods[k][0]); r(hx + 3, hy + 7, 4, 1, foods[k][1]); }   // each head holds its food
        else { r(hx + 2, hy + 1, 6, 1, '#5fd0c0'); r(hx + 4, hy - 2, 2, 2, '#bfeee4'); }
      });
      r(40, y + 22, 6, 3, '#2e9a8a');
      break;
    }
    default: return false;
  }
  return true;
}

// From behind: paint over what's left of the face (mouths, teeth, pupils) with the body colour around it,
// so the same sprite works as the back of your pet in a battle.
const FACE_COLS = new Set(['255,255,255', '35,26,23', '42,31,24', '26,26,26', '242,59,59']);
function backView(c) {
  const W = 48, H = 40, d = c.getImageData(0, 0, W, H), px = d.data;
  const key = i => `${px[i]},${px[i + 1]},${px[i + 2]}`;
  const isFace = i => px[i + 3] === 255 && FACE_COLS.has(key(i));
  for (let pass = 0; pass < 6; pass++) {
    const fix = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (!isFace(i)) continue;
      const votes = {};
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = (ny * W + nx) * 4; if (px[j + 3] !== 255 || isFace(j)) continue;
        const k = key(j); votes[k] = (votes[k] || 0) + 1;
      }
      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      if (best) fix.push([i, best[0].split(',').map(Number)]);
    }
    if (!fix.length) break;
    for (const [i, [r, g, b]] of fix) { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
  }
  c.putImageData(d, 0, 0);
}

// ---------- weekly bosses: the things that keep you from the gym ----------
export const BOSSES = [
  { en: 'The Couch Monster', zh: '梳化怪', evo: { en: 'Yoga Mat Guardian', zh: '瑜伽墊守護者' } },
  { en: 'Midnight Snack Dragon', zh: '宵夜龍', evo: { en: 'Meal-Prep Dragon', zh: '備餐龍' } },
  { en: 'Lazy Slime', zh: '懶惰史萊姆', evo: { en: 'Hustle Slime', zh: '拼搏史萊姆' } },
  { en: 'The Snooze Clock', zh: '貪睡鬧鐘', evo: { en: 'Early-Bird Clock', zh: '早起鬧鐘' } },
  { en: 'Bubble Tea Beast', zh: '珍奶怪', evo: { en: 'Protein Shake Beast', zh: '蛋白奶昔獸' } },
  { en: 'Doomscroll Demon', zh: '碌手機魔', evo: { en: 'Workout Tracker', zh: '運動紀錄機' } },
  // 6–11: more excuses not to go, in the tower; catch them as pets
  { en: 'Takeaway Goblin', zh: '外賣哥布林', evo: { en: 'Meal-Prep Chef', zh: '備餐大廚' } },
  { en: 'Duvet Burrito', zh: '被竇卷', evo: { en: 'Sunrise Runner', zh: '晨跑卷' } },
  { en: 'Rain Cloud', zh: '落雨雲', evo: { en: 'Rain-or-Shine Cloud', zh: '風雨無阻雲' } },
  { en: 'DOMS Jelly', zh: '肌肉痛啫喱', evo: { en: 'Recovery Jelly', zh: '恢復啫喱' } },
  { en: 'Overtime Ghost', zh: '加班鬼', evo: { en: 'Lunch-Break Lifter', zh: '午休健身鬼' } },
  { en: 'Beer Belly Barrel', zh: '啤酒肚桶', evo: { en: 'Six-Pack Barrel', zh: '六舊腹肌桶' } },
  // 12–17: boss species: every 5th tower floor, then the Boss Lair
  { en: 'Next-Monday Dragon', zh: '下星期一龍', evo: { en: 'Do-It-Today Dragon', zh: '今日就做龍' } },
  { en: 'Tomorrow Phoenix', zh: '聽日先鳳凰', evo: { en: 'Right-Now Phoenix', zh: '即刻鳳凰' } },
  { en: 'Binge Kraken', zh: '追劇八爪魚', evo: { en: 'Workout-Video Kraken', zh: '跟片運動八爪魚' } },
  { en: 'Excuse Golem', zh: '藉口魔像', evo: { en: 'Discipline Golem', zh: '自律魔像' } },
  { en: 'Couch King', zh: '梳化王', evo: { en: 'Bench-Press King', zh: '臥推王' } },
  { en: 'Midnight Hydra', zh: '宵夜九頭蛇', evo: { en: 'Macro Hydra', zh: '營養九頭蛇' } }
];
// state: 'idle' | 'ko' | 'back' (seen from behind: your pet in a battle). 48×40 scene pixels.
// evolved: the excuse turned motivation: a sweatband, a gold glow and sparkles.
export function drawBoss(canvas, idx, frame = 0, state = 'idle', evolved = false) {
  const lo = document.createElement('canvas'); lo.width = 48; lo.height = 40;
  const c = lo.getContext('2d');
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const ko = state === 'ko', back = state === 'back', b = ko ? 0 : frame;            // breathing bob
  const eyes = (x1, x2, y, col = '#fff') => {
    if (back) return;   // no face from behind
    if (ko) { for (const x of [x1, x2]) { r(x, y, 1, 1, OUT); r(x + 2, y, 1, 1, OUT); r(x + 1, y + 1, 1, 1, OUT); r(x, y + 2, 1, 1, OUT); r(x + 2, y + 2, 1, 1, OUT); } return; }
    for (const x of [x1, x2]) { r(x, y, 3, 3, col); r(x + 1 + frame, y + 1, 1, 2, OUT); }
    r(x1 - 1, y - 2, 4, 1, OUT); r(x2, y - 2, 4, 1, OUT);   // angry brows
  };
  r(6, 37, 36, 2, 'rgba(0,0,0,.28)');
  const base = ko ? 4 : 0;   // KO'd bosses slump down
  const crown = (x, y) => { r(x, y + 2, 12, 3, '#f2d245'); r(x, y, 2, 2, '#f2d245'); r(x + 5, y - 1, 2, 3, '#f2d245'); r(x + 10, y, 2, 2, '#f2d245'); r(x + 5, y + 3, 2, 1, '#d8483b'); };
  const dragon = (y, body, light, belly) => {
    r(10, y + 6, 28, 22, body); r(10, y + 6, 28, 2, light); r(14, y + 18, 20, 9, belly);
    r(8, y, 10, 10, body); r(30, y, 10, 10, body); r(9, y - 3, 2, 3, '#f2d245'); r(37, y - 3, 2, 3, '#f2d245');
    r(4, y + 12, 6, 4, body); r(38, y + 12, 6, 4, body);
    eyes(14, 29, y + 8);
    if (!ko) { r(16, y + 14, 16, 3, '#2a1f18'); r(17, y + 14, 2, 1, '#fff'); r(29, y + 14, 2, 1, '#fff'); }
  };
  const evoDone = evolved && drawEvo(r, idx % 18, base, b, frame, ko, back, eyes, crown);
  const backDone = !evoDone && back && drawBackSprite(r, idx % 18, base, b, frame, crown);
  switch (evoDone || backDone ? -1 : idx % 18) {
    case 0: case 16: { // couch (16: the Couch King, bigger cushions and a crown)
      const king = idx % 18 === 16;
      const y = 14 + base + b;
      r(6, y, 36, 10, '#8a5a3c'); r(6, y, 36, 2, '#a87450');           // back
      r(4, y + 8, 6, 14, '#7a4c30'); r(38, y + 8, 6, 14, '#7a4c30');   // arms
      r(9, y + 10, 30, 8, '#9c6644'); r(9, y + 10, 30, 1, '#b98058'); r(23, y + 10, 1, 8, '#7a4c30');   // cushions
      r(8, y + 18, 32, 4, '#6b4128'); r(8, 36 - (ko ? 0 : 0), 3, 2, '#3a2416'); r(37, 36, 3, 2, '#3a2416');
      eyes(15, 28, y + 3); if (!ko) { r(17, y + 7, 14, 2, OUT); for (let i = 0; i < 4; i++) r(18 + i * 3, y + 7, 2, 1, '#fff'); }
      if (king) { r(6, y, 36, 2, '#7c2c8c'); r(9, y + 10, 30, 1, '#c95aa0'); crown(18, y - 6); }
      break;
    }
    case 1: { // snack dragon
      const y = 8 + base + b;
      r(10, y + 6, 28, 22, '#4fae5a'); r(10, y + 6, 28, 2, '#6fcf78'); r(14, y + 18, 20, 9, '#d8e89a');   // body + belly
      r(8, y, 10, 10, '#4fae5a'); r(30, y, 10, 10, '#4fae5a'); r(9, y - 3, 2, 3, '#f2d245'); r(37, y - 3, 2, 3, '#f2d245');   // horns
      r(4, y + 12, 6, 4, '#3d8a46'); r(38, y + 12, 6, 4, '#3d8a46');   // little wings
      eyes(14, 29, y + 8);
      if (!ko) { r(16, y + 14, 16, 3, '#2a1f18'); r(17, y + 14, 2, 1, '#fff'); r(29, y + 14, 2, 1, '#fff'); }
      // holding a burger
      r(34, y + 18, 9, 3, '#d9a14b'); r(34, y + 21, 9, 2, '#6b3a1f'); r(34, y + 23, 9, 2, '#d9a14b'); r(35, y + 20, 7, 1, '#45b45a');
      break;
    }
    case 2: { // lazy slime
      const y = 12 + base;
      const w = 34 + (ko ? 6 : frame * 2), x = 24 - w / 2;
      r(x + 3, y + 2 - b, w - 6, 4, '#9b6ad8'); r(x, y + 6 - b, w, 18 + b, '#8c5bd6'); r(x + 2, y + 24, w - 4, 2, '#6f45b0');
      r(x + 5, y + 6 - b, 6, 3, '#c7a6f2');   // shine
      if (ko) { r(16, y + 12, 16, 2, OUT); }
      else { r(15, y + 11, 5, 2, '#fff'); r(28, y + 11, 5, 2, '#fff'); r(17, y + 12, 2, 1, OUT); r(30, y + 12, 2, 1, OUT); r(15, y + 10, 5, 1, '#6f45b0'); r(28, y + 10, 5, 1, '#6f45b0'); r(20, y + 17, 8, 1, OUT); }   // droopy eyes
      r(36, y + 2 - b, 2, 2, '#fff'); r(39, y - 2 - b, 3, 1, '#fff'); r(40, y - 1 - b, 1, 1, '#fff');   // z
      break;
    }
    case 3: { // snooze clock
      const y = 6 + base + b;
      r(10, y + 4, 28, 26, '#d8483b'); r(12, y + 2, 24, 2, '#d8483b'); r(12, y + 30, 24, 2, '#d8483b');
      r(14, y + 6, 20, 22, '#fdf7ea'); r(23, y + 8, 2, 9, OUT); r(24, y + 16, 7, 2, OUT);   // face + hands
      r(8, y - 2, 8, 5, '#f2d245'); r(32, y - 2, 8, 5, '#f2d245'); r(13, y + 32, 4, 3, '#7a2c2c'); r(31, y + 32, 4, 3, '#7a2c2c');   // bells + feet
      if (!ko && frame) { r(4, y + 2, 3, 1, OUT); r(41, y + 2, 3, 1, OUT); r(4, y + 6, 2, 1, OUT); r(42, y + 6, 2, 1, OUT); }   // ringing
      eyes(16, 28, y + 18, '#fff');
      if (!ko) r(19, y + 24, 10, 2, OUT);
      break;
    }
    case 4: { // bubble tea beast
      const y = 6 + base + b;
      r(29, y - 6, 3, 12, '#e66fab');                                   // straw
      r(12, y + 2, 24, 3, '#eeeeee'); r(13, y + 5, 22, 26, '#d9b48c'); r(15, y + 31, 18, 2, '#c4a07a');   // lid + cup
      for (const [bx, by] of [[16, 25], [21, 27], [26, 25], [30, 27], [18, 29], [24, 29], [28, 29]]) r(bx, y + by, 3, 3, '#3a2416');   // pearls
      eyes(16, 27, y + 10);
      if (!ko) { r(19, y + 17, 10, 3, '#3a2416'); r(20, y + 17, 2, 1, '#fff'); r(26, y + 17, 2, 1, '#fff'); }
      break;
    }
    case 5: { // doomscroll phone
      const y = 4 + base + b;
      r(13, y, 22, 34, '#2b2b30'); r(15, y + 3, 18, 26, '#5fd3f3'); r(22, y + 31, 4, 2, '#5d6470');
      for (let i = 0; i < 4; i++) r(17, y + 16 + i * 3 + (frame ? 1 : 0), 14, 1, '#9be8f8');   // endless feed
      eyes(17, 26, y + 6, '#f23b3b');
      if (!ko) r(19, y + 12, 10, 2, OUT);
      r(8, y + 14, 5, 3, '#2b2b30'); r(35, y + 14, 5, 3, '#2b2b30');   // grabby arms
      break;
    }
    case 6: { // takeaway goblin: a delivery box on its back
      const y = 8 + base + b;
      r(26, y + 4, 16, 16, '#d8483b'); r(26, y + 4, 16, 3, '#b7392a'); r(30, y + 10, 8, 4, '#f3f1ea');   // insulated box
      r(10, y + 8, 18, 18, '#6fbf5a'); r(8, y + 10, 3, 5, '#6fbf5a'); r(27, y + 10, 3, 5, '#6fbf5a');   // head + pointy ears
      r(10, y + 5, 18, 4, '#f2d245'); r(26, y + 7, 5, 2, '#f2d245');   // cap
      eyes(12, 20, y + 13);
      if (!ko) { r(14, y + 20, 10, 2, OUT); r(15, y + 20, 2, 1, '#fff'); r(21, y + 20, 2, 1, '#fff'); }
      r(12, y + 26, 14, 6, '#3c5bd9'); r(12, y + 32, 4, 3, '#2b2b30'); r(22, y + 32, 4, 3, '#2b2b30');   // jacket + feet
      r(4, y + 22 - frame, 7, 5, '#f3f1ea'); r(5, y + 21 - frame, 5, 1, '#d9a14b');   // a takeaway box in hand
      break;
    }
    case 7: { // duvet burrito: rolled up, refusing to get up
      const y = 14 + base;
      r(4, y + 2 + b, 40, 20, '#f3f1ea'); r(4, y + 2 + b, 40, 2, '#ffffff'); for (let i = 0; i < 4; i++) r(10 + i * 9, y + 4 + b, 2, 18, '#9ec9e8');   // duvet + stripes
      r(4, y + 22, 40, 2, '#c8d6e2');
      r(32, y - 4 + b, 12, 12, '#eebc94'); r(32, y - 6 + b, 12, 3, '#5b3a22');   // sleepy head poking out
      if (ko) { r(34, y + 1 + b, 3, 1, OUT); r(40, y + 1 + b, 3, 1, OUT); } else { r(34, y + 1 + b, 3, 1, OUT); r(40, y + 1 + b, 3, 1, OUT); r(37, y + 5 + b, 2, 1, OUT); }
      r(28, y - 10 - frame, 3, 1, '#fff'); r(29, y - 9 - frame, 1, 1, '#fff'); r(28, y - 8 - frame, 3, 1, '#fff');   // z
      break;
    }
    case 8: { // rain cloud
      const y = 4 + base + b;
      r(8, y + 8, 32, 14, '#8a8f98'); r(12, y + 4, 12, 6, '#8a8f98'); r(24, y + 2, 12, 8, '#8a8f98'); r(8, y + 20, 32, 2, '#6a6f78');
      r(14, y + 5, 6, 2, '#a4abb2');
      eyes(16, 27, y + 12, '#fff');
      if (!ko) r(20, y + 18, 8, 1, OUT);
      for (let i = 0; i < 6; i++) r(10 + i * 6, y + 25 + ((i + frame) % 2) * 4, 1, 3, '#5fb8f3');   // rain
      if (!ko && frame) { r(30, y + 22, 3, 2, '#f2d245'); r(29, y + 24, 2, 3, '#f2d245'); }   // a little lightning
      break;
    }
    case 9: { // DOMS jelly: sore all over, wobbling
      const y = 12 + base;
      const w = 32 + (ko ? 6 : frame * 2), x = 24 - w / 2;
      r(x + 3, y + 2 - b, w - 6, 3, '#f59ab8'); r(x, y + 5 - b, w, 18 + b, '#e66fab'); r(x + 2, y + 23, w - 4, 2, '#c4508c');
      r(x + 4, y + 7 - b, 4, 3, '#ffd0e0');
      r(x + w - 12, y + 6 - b, 8, 3, '#f1d4a8'); r(x + w - 10, y + 6 - b, 1, 3, '#d9b48c'); r(x + w - 7, y + 6 - b, 1, 3, '#d9b48c');   // plaster
      if (ko) r(16, y + 12, 16, 2, OUT);
      else { eyes(16, 27, y + 10 - b); r(20, y + 17 - b, 8, 1, OUT); r(22, y + 18 - b, 4, 1, OUT); }   // wince
      break;
    }
    case 10: { // overtime ghost: tie, laptop, dark rings
      const y = 4 + base + b;
      r(12, y + 4, 24, 26, '#eef0ea'); r(14, y + 2, 20, 2, '#eef0ea');
      for (let i = 0; i < 4; i++) r(12 + i * 6 + (frame ? 3 : 0), y + 30, 3, 3, '#eef0ea');   // wavy tail
      eyes(16, 26, y + 10, '#fff'); r(15, y + 14, 5, 1, '#8c5bd6'); r(25, y + 14, 5, 1, '#8c5bd6');   // eye bags
      r(22, y + 17, 4, 2, '#3c5bd9'); r(23, y + 19, 2, 6, '#3c5bd9');   // tie
      r(2, y + 18, 12, 8, '#5d6470'); r(3, y + 19, 10, 5, '#9fd3f0'); r(0, y + 26, 16, 2, '#3a3d44');   // laptop
      break;
    }
    case 11: { // beer belly barrel
      const y = 6 + base + b;
      r(12, y + 2, 24, 4, '#f3f1ea'); r(10, y + 4, 4, 3, '#f3f1ea'); r(34, y + 4, 4, 3, '#f3f1ea'); if (frame && !ko) r(16, y, 4, 2, '#f3f1ea');   // foam
      r(10, y + 6, 28, 28, '#a8743f'); r(10, y + 6, 2, 28, '#8a5a3c'); r(36, y + 6, 2, 28, '#8a5a3c');
      r(10, y + 10, 28, 2, '#5d6470'); r(10, y + 28, 28, 2, '#5d6470');   // hoops
      r(16, y + 18, 16, 10, '#c48a55');   // the belly
      eyes(15, 27, y + 14);
      if (!ko) r(21, y + 23, 6, 2, OUT);
      r(4, y + 16, 6, 4, '#a8743f'); r(38, y + 16, 6, 4, '#a8743f');
      break;
    }
    case 12: { // next-Monday dragon: holding a calendar stuck on MON
      const y = 10 + base + b;
      dragon(y, '#c8382c', '#e2564b', '#f1c27d');
      const cy = y - 8 - (ko ? -6 : frame);
      r(29, cy, 19, 14, '#f3f1ea'); r(29, cy, 19, 4, '#e23b3b'); r(33, cy - 1, 1, 2, OUT); r(43, cy - 1, 1, 2, OUT);
      const ty = cy + 6;   // "MON", 1-pixel letters
      r(31, ty, 1, 5, OUT); r(35, ty, 1, 5, OUT); r(32, ty + 1, 1, 1, OUT); r(33, ty + 2, 1, 1, OUT); r(34, ty + 1, 1, 1, OUT);
      r(37, ty, 4, 1, OUT); r(37, ty + 4, 4, 1, OUT); r(37, ty, 1, 5, OUT); r(40, ty, 1, 5, OUT);
      r(42, ty, 1, 5, OUT); r(45, ty, 1, 5, OUT); r(43, ty + 1, 1, 1, OUT); r(44, ty + 2, 1, 2, OUT);
      break;
    }
    case 13: { // tomorrow phoenix: rises again every day, with a little sunrise
      const y = 6 + base + b, up = !ko && frame;
      r(16, y + 8, 16, 18, '#f19a33'); r(18, y + 2, 12, 8, '#f19a33'); r(20, y - 2, 2, 4, '#e23b3b'); r(24, y - 4, 2, 6, '#f2d245'); r(28, y - 2, 2, 4, '#e23b3b');
      r(30, y + 5, 5, 2, '#f2d245');
      const wy = up ? y + 2 : y + 10;
      r(4, wy, 12, 6, '#e23b3b'); r(2, wy + 6, 8, 3, '#f2d245'); r(32, wy, 12, 6, '#e23b3b'); r(38, wy + 6, 8, 3, '#f2d245');
      r(18, y + 18, 12, 6, '#f2d245'); r(18, y + 24, 12, 1, '#e2563b'); for (let i = 0; i < 3; i++) r(19 + i * 4, y + 15, 2, 2, '#f2d245');   // sunrise on its chest
      r(18, y + 26, 2, 6, '#e8b923'); r(28, y + 26, 2, 6, '#e8b923');
      eyes(19, 26, y + 4);
      break;
    }
    case 14: { // binge kraken: tentacles round a TV
      const y = 4 + base + b;
      r(12, y, 24, 18, '#8c5bd6'); r(14, y - 2, 20, 2, '#8c5bd6'); r(15, y + 2, 5, 3, '#b48ae8');   // head
      eyes(16, 27, y + 6);
      for (let i = 0; i < 5; i++) { const tx = 8 + i * 8; r(tx, y + 18, 4, 12 + ((i + frame) % 2) * 2, '#7c4fb6'); }   // tentacles
      r(14, y + 22, 20, 14, '#2b2b30'); r(16, y + 24, 16, 9, frame ? '#5fd3f3' : '#9be8f8'); r(22, y + 36, 4, 2, '#2b2b30');   // TV
      r(19, y + 27, 3, 4, '#fff'); r(22, y + 28, 2, 2, '#fff');   // play button
      break;
    }
    case 15: { // excuse golem: a body of bricks
      const y = 4 + base + b;
      const brick = (x, yy, w, h) => { r(x, yy, w, h, '#b7563f'); for (let j = 0; j < h; j += 4) { r(x, yy + j, w, 1, '#8a3a2a'); for (let k = (j / 4) % 2 ? 2 : 6; k < w; k += 8) r(x + k, yy + j, 1, 4, '#8a3a2a'); } };
      brick(14, y, 20, 10); eyes(18, 26, y + 3, '#f2d245');
      brick(8, y + 10, 32, 16);
      r(16, y + 14, 16, 8, '#f3f1ea'); r(18, y + 16, 12, 1, OUT); r(18, y + 18, 9, 1, OUT); r(18, y + 20, 11, 1, OUT);   // a sign full of excuses
      brick(2, y + 10, 6, 14); brick(40, y + 10, 6, 14);
      brick(12, y + 26, 8, 8); brick(28, y + 26, 8, 8);
      break;
    }
    case 17: { // midnight hydra: three hungry heads
      const y = 12 + base;
      r(10, y + 10, 28, 18, '#6b3fa0'); r(14, y + 18, 20, 9, '#c9b6e8');   // body
      for (const [hx, off] of [[4, b], [19, -b], [34, b]]) {
        const hy = y + (hx === 19 ? -4 : 0) + off;
        r(hx + 3, hy + 8, 4, 6, '#6b3fa0'); r(hx, hy, 10, 9, '#7c4fb6');
        if (ko) { r(hx + 2, hy + 3, 2, 1, OUT); r(hx + 6, hy + 3, 2, 1, OUT); } else { r(hx + 2, hy + 2, 2, 2, '#f2d245'); r(hx + 6, hy + 2, 2, 2, '#f2d245'); r(hx + 2, hy + 6, 6, 1, '#2a1f18'); }
      }
      r(34, y + 24, 8, 3, '#d9a14b'); r(34, y + 27, 8, 2, '#6b3a1f');   // a midnight burger
      break;
    }
    default: break;
  }
  if (ko) { r(18, 2, 2, 2, '#f2d245'); r(26, 0, 2, 2, '#f2d245'); r(32, 3, 2, 2, '#f2d245'); }   // stars
  if (back && !evoDone) backView(c);
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.floor(Math.min(canvas.width / 48, canvas.height / 40));
  ctx.drawImage(lo, (canvas.width - 48 * s) / 2, (canvas.height - 40 * s) / 2, 48 * s, 40 * s);
}


// ---------- battle scene (Pokémon style): them up on the right facing you, you bottom-left from behind ----------
export const BW = 160, BH = 112;
const MOVE_POSE = { squat_slam: 'squat', deadlift_uproot: 'squat', max_out: 'squat', bench_blast: 'press', chest_cannon: 'press', row_combo: 'row',
  press_uppercut: 'ohp', bicep_hammer: 'curl', sprint: 'run', interval_rush: 'run', marathon_grind: 'run', grip: 'climb', dyno: 'climb', crimp_lock: 'climb',
  warmup: 'stretch', the_pump: 'curl', iron_wall: 'stretch', second_wind: 'sit', shove: 'stand' };
function charInto(c, x, y, av, pose, frame, scale) {
  const t = document.createElement('canvas'); t.width = 32; t.height = 34;
  drawChar(t.getContext('2d'), 16, 31, av, pose, frame);
  c.drawImage(t, Math.round(x - 16 * scale), Math.round(y - 31 * scale), 32 * scale, 34 * scale);
}
// fx: { attacker: 'me'|'them', move, t: 0..1, hit: 'me'|'them' } for the animation of a move
export function drawBattle(canvas, me, them, frame = 0, fx = null) {
  const lo = canvas._blo || (canvas._blo = document.createElement('canvas')); lo.width = BW; lo.height = BH;
  const c = lo.getContext('2d'); c.imageSmoothingEnabled = false;
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // backdrop: gym wall and floor
  r(0, 0, BW, 46, '#e9d9b8'); for (let x = 0; x < BW; x += 16) r(x, 0, 1, 46, '#dcc9a3'); r(0, 40, BW, 6, '#b98d5c');
  r(18, 8, 22, 14, '#7a5634'); r(20, 10, 18, 10, '#9fd3f0'); r(120, 6, 16, 20, '#d8483b'); r(122, 8, 12, 16, '#f6e7c8');
  for (let y = 46; y < BH; y += 10) for (let x = 0; x < BW; x += 16) r(x, y, 16, 10, ((x / 16 + (y - 46) / 10) % 2) ? '#4b4f57' : '#454950');
  // platforms
  const plat = (cx, cy, w) => { c.fillStyle = '#2e6fa8'; c.beginPath(); c.ellipse(cx, cy, w, w / 4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#4a8fcc'; c.beginPath(); c.ellipse(cx, cy - 1, w - 3, w / 4 - 2, 0, 0, Math.PI * 2); c.fill(); };
  plat(118, 66, 26); plat(44, 106, 34);
  // positions, with a lunge / shake for the move being played
  let tx = 118, ty = 64, mx = 44, my = 104;
  if (fx) {
    const k = Math.sin(Math.min(1, fx.t) * Math.PI);
    if (fx.attacker === 'me') { mx += 14 * k; my -= 8 * k; } else if (fx.attacker === 'them') { tx -= 12 * k; ty += 6 * k; }
    if (fx.hit === 'them' && fx.t > 0.45) tx += (Math.floor(fx.t * 20) % 2 ? 2 : -2);
    if (fx.hit === 'me' && fx.t > 0.45) mx += (Math.floor(fx.t * 20) % 2 ? 2 : -2);
  }
  const themPose = fx?.attacker === 'them' ? (MOVE_POSE[fx.move] || 'stand') : (them.fainted ? 'sit' : 'stand');
  const blinkThem = fx?.hit === 'them' && fx.t > 0.45 && Math.floor(fx.t * 16) % 2;
  const blinkMe = fx?.hit === 'me' && fx.t > 0.45 && Math.floor(fx.t * 16) % 2;
  if (!blinkThem && !them.gone && !(fx && fx.ball >= 1)) {
    if (them.monster != null) {   // one of the boss sprites, bigger when it's an elite or a raid boss
      const t2 = canvas._bmon || (canvas._bmon = document.createElement('canvas')); t2.width = 48; t2.height = 40;
      drawBoss(t2, them.monster, frame, them.fainted ? 'ko' : 'idle', !!them.evolved);
      const k = them.big ? 1.25 : 1;
      c.drawImage(t2, Math.round(tx - 24 * k), Math.round(ty - 38 * k), Math.round(48 * k), Math.round(40 * k));
    } else charInto(c, tx, ty, them.avatar, themPose, frame, 1);
  }
  if (!blinkMe && !me.gone) {
    if (me.monster != null) {   // one of your pets, facing the other way, a little bigger
      const t3 = canvas._bpet || (canvas._bpet = document.createElement('canvas')); t3.width = 48; t3.height = 40;
      drawBoss(t3, me.monster, frame, me.fainted ? 'ko' : 'back', !!me.evolved);   // from behind, like you
      c.drawImage(t3, Math.round(mx - 36), Math.round(my - 54), 72, 60);
    } else charInto(c, mx, my, me.avatar, me.fainted ? 'sit' : 'back', frame, 2);
  }
  // a ball thrown at them: arcs over, then wobbles (fx.ball: 0..1 throw, fx.wobble: count, fx.caught)
  if (fx && fx.ball != null) {
    const k = Math.min(1, fx.ball), bx = mx + (tx - mx) * k, by = (my - 40) + (ty - 20 - (my - 40)) * k - Math.sin(k * Math.PI) * 30;
    const wob = fx.ball >= 1 ? Math.round(Math.sin((fx.wobble || 0) * Math.PI * 2) * 2) : 0;
    c.fillStyle = OUT; c.fillRect(bx - 4 + wob, by - 4, 8, 8);
    c.fillStyle = fx.col || '#e23b3b'; c.fillRect(bx - 3 + wob, by - 3, 6, 3);
    c.fillStyle = '#f3f1ea'; c.fillRect(bx - 3 + wob, by, 6, 3); c.fillStyle = OUT; c.fillRect(bx - 3 + wob, by - 1, 6, 1); c.fillStyle = '#fff'; c.fillRect(bx - 1 + wob, by - 1, 2, 2);
    if (fx.caught) { c.fillStyle = '#f2d245'; for (const [dx, dy] of [[-8, -8], [8, -9], [0, -12]]) c.fillRect(bx + dx, by + dy, 2, 2); }
  }
  // impact sparks
  if (fx && fx.hit && fx.t > 0.4 && fx.t < 0.8) {
    const [hx, hy] = fx.hit === 'them' ? [tx, ty - 14] : [mx, my - 30];
    c.fillStyle = '#fff3b0'; for (const [dx, dy] of [[-6, -4], [5, -6], [-3, 5], [6, 3], [0, -8]]) c.fillRect(hx + dx, hy + dy, 2, 2);
  }
  if (fx && fx.heal && fx.t > 0.3) { c.fillStyle = 'rgba(111,211,160,.9)'; const [hx, hy] = fx.attacker === 'me' ? [mx, my - 40] : [tx, ty - 26]; for (let i = 0; i < 5; i++) c.fillRect(hx - 8 + i * 4, hy - (fx.t * 12 + i * 2) % 12, 2, 2); }
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(lo, 0, 0, canvas.width, canvas.height);
}
