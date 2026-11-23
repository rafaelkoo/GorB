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
  '#7a2c3a', '#2e6b5a', '#f2b8c6', '#c3dc5e', '#6f7f3e', '#14b8b0'];
export const SHORTS = ['#2b2b30', '#35466a', '#6a6a72', '#3c5bd9', '#46663a', '#7c2c2c', '#d6d6d6', '#8a6948',
  '#e23b3b', '#8c5bd6', '#14b8b0', '#f19a33'];
export const SHOES = ['#3a2e2a', '#f2f2f2', '#e23b3b', '#3c5bd9', '#9be33b', '#e66fab', '#f2d245', '#2b2b30'];
export const GEAR = ['#e23b3b', '#f2f2f2', '#2b2b30', '#3c5bd9', '#f2d245', '#45b45a', '#e66fab', '#f19a33'];
export const HAIRS = ['short', 'spiky', 'long', 'bun', 'buzz', 'curly', 'mohawk', 'bald', 'afro', 'ponytail', 'sidepart', 'braids', 'undercut', 'pigtails'];
export const BUILDS = ['slim', 'normal', 'big'];
export const TOP_STYLES = ['tee', 'tank', 'stringer', 'longsleeve', 'hoodie', 'jersey', 'shirtless'];
export const BOTTOMS = ['shorts', 'joggers', 'leggings'];
export const HATS = ['none', 'headband', 'cap', 'capback', 'beanie', 'bandana'];
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
    if (hat === 'bandana') { r(hx - 1, H - 2, 10, 4, gear); r(hx + 1, H - 1, 1, 1, '#f2f2f2'); r(hx + 5, H, 1, 1, '#f2f2f2'); r(hx + 8, H + 1, 2, 3, gearD); }
  };
  const head = () => {
    const hx = -4;
    if (pose === 'climb') {   // seen from behind, facing the wall: all hair
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
  for (const q of placed) drawChar(c, q.x, q.y, q.p.avatar, q.pose, (frame + q.phase) % 2);

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
    if (!q.p.inGym) {   // dozing on the bench
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
