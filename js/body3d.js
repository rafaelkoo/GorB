// Realistic skinned body (Quaternius "Universal Base Characters", CC0), driven by the procedural figure.
// The procedural figure stays the source of truth for every move: it solves the pose and where the
// equipment goes. Each frame this module copies that pose onto the skinned body:
//  - torso, neck, head and feet copy the figure's segment rotations
//  - arms and legs run their own two-bone IK to the figure's wrists and ankles (so hands meet the bar
//    and feet meet the floor), using the figure's elbow/knee direction and its biceps/palm/knee facing
// Muscle highlighting paints the skin by region (computed once from the rest pose).
const BASE = new URL('../assets/body/', import.meta.url).href;

export async function loadBody(T) {
  const [meta, bin] = await Promise.all([
    fetch(BASE + 'body.json').then(r => { if (!r.ok) throw new Error('body.json ' + r.status); return r.json(); }),
    fetch(BASE + 'body.bin').then(r => { if (!r.ok) throw new Error('body.bin ' + r.status); return r.arrayBuffer(); })
  ]);
  const tl = new T.TextureLoader();
  const tex = (f, srgb) => new Promise((res, rej) => tl.load(BASE + f, t => { t.flipY = false; if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));
  const skinN = await tex('skin_n.jpg');
  return { meta, bin, maps: { skinN } };
}

export function buildBody(T, data) {
  const { meta, bin, maps } = data;
  const group = new T.Group();
  // ── skeleton ──
  const bones = meta.bones.map(b => { const o = new T.Bone(); o.name = b.n; o.position.fromArray(b.t); o.quaternion.fromArray(b.q); o.scale.fromArray(b.s); return o; });
  meta.bones.forEach((b, i) => { if (b.p >= 0) bones[b.p].add(bones[i]); else group.add(bones[i]); });
  group.updateMatrixWorld(true);
  const by = {}; bones.forEach(b => { by[b.name] = b; });
  const skeleton = new T.Skeleton(bones);
  const restQ = new Map(), restP = new Map();
  bones.forEach(b => { restQ.set(b, b.getWorldQuaternion(new T.Quaternion())); restP.set(b, b.getWorldPosition(new T.Vector3())); });
  const restLocalQ = new Map(bones.map(b => [b, b.quaternion.clone()]));

  // ── meshes ──
  const geoOf = m => {
    const g = new T.BufferGeometry();
    const f32 = (o, n) => new Float32Array(bin, o[0], o[1] / 4);
    g.setAttribute('position', new T.BufferAttribute(f32(m.pos), 3));
    g.setAttribute('normal', new T.BufferAttribute(f32(m.nrm), 3));
    g.setAttribute('uv', new T.BufferAttribute(f32(m.uv), 2));
    g.setAttribute('skinIndex', new T.BufferAttribute(new Uint16Array(new Uint8Array(bin, m.jo[0], m.jo[1])), 4));
    g.setAttribute('skinWeight', new T.BufferAttribute(f32(m.we), 4));
    g.setIndex(new T.BufferAttribute(m.idx32 ? new Uint32Array(bin, m.idx[0], m.idx[1] / 4) : new Uint16Array(bin, m.idx[0], m.idx[1] / 2), 1));
    return g;
  };
  const uni = { uAcc: { value: new T.Color('#FF7A2F') }, uK: { value: 0 }, uE: { value: 0 } };
  // anatomy-chart look: one smooth light-grey material, muscle shape kept faintly from the normal map
  const GREY = 0xC6C2BD;
  const skinMat = new T.MeshStandardMaterial({ color: GREY, normalMap: maps.skinN, normalScale: new T.Vector2(0.35, 0.35), roughness: 0.78, metalness: 0 });
  skinMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float hl;\nvarying float vHl;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHl = hl;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHl;\nuniform vec3 uAcc;\nuniform float uK;\nuniform float uE;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uAcc, clamp(vHl, 0.0, 1.0) * uK);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAcc * clamp(vHl, 0.0, 1.0) * uE;');
  };
  const mats = {
    body: skinMat,
    eyes: new T.MeshStandardMaterial({ color: 0xBFBAB4, roughness: 0.6 }),
    // the hair texture is a grey mask meant to be tinted
    brows: new T.MeshStandardMaterial({ color: GREY, roughness: 0.85, side: T.DoubleSide }),
    hair: new T.MeshStandardMaterial({ color: 0xC4BFB9, roughness: 0.9, side: T.DoubleSide })
  };
  const meshes = {};
  for (const [k, m] of Object.entries(meta.meshes)) {
    const g = geoOf(m);
    if (k === 'body') g.setAttribute('hl', new T.BufferAttribute(new Float32Array(m.count), 1));
    const o = new T.SkinnedMesh(g, mats[k]); if (k === 'brows') o.visible = false; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = k === 'body';
    o.bind(skeleton, new T.Matrix4()); group.add(o); meshes[k] = o;
  }

  // ── grip: curl the fingers once (open-hand moves switch back with setHand) ──
  const FINGERS = bones.filter(b => /^(index|middle|ring|pinky|thumb)_0[1-3]_/.test(b.name));
  const palm = new T.Vector3(0, -1, 0);
  for (const s of ['l', 'r']) {
    for (const f of ['index', 'middle', 'ring', 'pinky']) for (let j = 1; j <= 3; j++) {
      const b = by[`${f}_0${j}_${s}`], c = by[`${f}_0${j + 1}_${s}`] || by[`${f}_04_leaf_${s}`]; if (!b || !c) continue;
      const d = restP.get(c).clone().sub(restP.get(b)).normalize();
      const ax = new T.Vector3().crossVectors(d, palm).normalize();
      const ang = [0, 1.0, 1.25, 0.8][j];
      const axL = ax.applyQuaternion(restQ.get(b).clone().invert());
      b.quaternion.copy(restLocalQ.get(b)).multiply(new T.Quaternion().setFromAxisAngle(axL, ang));
    }
  }
  group.updateMatrixWorld(true);
  // thumb: swing it across so its tip rests on the curled index finger (wrapping the handle), then bend it a little
  for (const s of ['l', 'r']) {
    const t1 = by['thumb_01_' + s], tip = by['thumb_04_leaf_' + s], ix = by['index_03_' + s], mid = by['middle_02_' + s];
    const p1 = t1.getWorldPosition(new T.Vector3());
    const target = ix.getWorldPosition(new T.Vector3()).lerp(mid.getWorldPosition(new T.Vector3()), 0.3).add(new T.Vector3(0, -0.012, 0));
    const from = tip.getWorldPosition(new T.Vector3()).sub(p1).normalize(), to = target.sub(p1).normalize();
    const qw = new T.Quaternion().setFromUnitVectors(from, to).multiply(t1.getWorldQuaternion(new T.Quaternion()));
    const qp = t1.parent.getWorldQuaternion(new T.Quaternion()); t1.quaternion.copy(qp.invert().multiply(qw)); t1.updateMatrixWorld(true);
    for (const j of [2, 3]) {   // gentle flex of the two thumb joints toward the palm side
      const b = by[`thumb_0${j}_${s}`], c = by[`thumb_0${j + 1}_${s}`] || tip;
      const d = c.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();
      const ax = new T.Vector3().crossVectors(d, palm).normalize().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert());
      b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(ax, 0.3)); b.updateMatrixWorld(true);
    }
  }
  const curlQ = new Map(FINGERS.map(b => [b, b.quaternion.clone()]));
  // open hand: fingers nearly straight with a relaxed bend
  const openQ = new Map(FINGERS.map(b => {
    const q = restLocalQ.get(b).clone(); if (/^thumb/.test(b.name)) return [b, q];
    const c = by[b.name.replace(/_0(\d)_/, (m, d) => `_0${+d + 1}_`)] || by[b.name.replace(/_0\d_/, '_04_leaf_')];
    const d = restP.get(c).clone().sub(restP.get(b)).normalize();
    const ax = new T.Vector3().crossVectors(d, palm).normalize().applyQuaternion(restQ.get(b).clone().invert());
    return [b, q.multiply(new T.Quaternion().setFromAxisAngle(ax, 0.12))];
  }));
  // centre of the closed fist in the hand bone's frame: the handle goes here
  const gripLocal = {};
  for (const s of ['l', 'r']) {
    const pts = ['index_01', 'pinky_01', 'index_03', 'pinky_03', 'middle_01', 'middle_03'].map(n => by[`${n}_${s}`].getWorldPosition(new T.Vector3()));
    const c = pts.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / pts.length);
    gripLocal[s] = by['hand_' + s].worldToLocal(c);
  }

  // palm centre (slightly below the palm skin) for flat-hand moves, in the hand bone's frame
  const palmLocal = {};
  for (const s of ['l', 'r']) {
    const c = ['hand', 'index_01', 'middle_01', 'pinky_01'].map(n => restP.get(by[`${n}_${s}`]).clone()).reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(0.25).add(new T.Vector3(0, -0.025, 0));
    palmLocal[s] = c.applyMatrix4(new T.Matrix4().compose(restP.get(by['hand_' + s]), restQ.get(by['hand_' + s]), new T.Vector3(1, 1, 1)).invert());
  }
  let openHand = false;
  function setHand(open) { openHand = !!open; for (const b of FINGERS) b.quaternion.copy((openHand ? openQ : curlQ).get(b)); group.updateMatrixWorld(true); }

  // ── rest frames for driven bones: down = toward the child joint, front = facing ──
  const FWD = new T.Vector3(0, 0, 1);
  const frame = (d, f) => { const y = d.clone().normalize(), z = f.clone().addScaledVector(y, -f.dot(y)).normalize(), x = new T.Vector3().crossVectors(y, z); return new T.Matrix4().makeBasis(x, y, z); };
  const restFrame = {};
  for (const s of ['l', 'r']) {
    const dir = (a, b) => restP.get(by[b]).clone().sub(restP.get(by[a]));
    restFrame['upperarm_' + s] = frame(dir('upperarm_' + s, 'lowerarm_' + s), FWD);    // biceps forward in the T-pose
    restFrame['lowerarm_' + s] = frame(dir('lowerarm_' + s, 'hand_' + s), palm);        // palm down in the T-pose
    restFrame['hand_' + s] = frame(dir('hand_' + s, 'middle_01_' + s), palm);
    restFrame['thigh_' + s] = frame(dir('thigh_' + s, 'calf_' + s), FWD);
    restFrame['calf_' + s] = frame(dir('calf_' + s, 'foot_' + s), FWD);
  }
  const len = (a, b) => restP.get(by[a]).distanceTo(restP.get(by[b]));
  const L = { up: len('upperarm_l', 'lowerarm_l'), fo: len('lowerarm_l', 'hand_l'), th: len('thigh_l', 'calf_l'), sh: len('calf_l', 'foot_l'), clav: len('clavicle_l', 'upperarm_l') };
  const hipC = restP.get(by.thigh_l).clone().add(restP.get(by.thigh_r)).multiplyScalar(0.5);
  const pelvisOff = restP.get(by.pelvis).clone().sub(hipC);
  const ankleLift = restP.get(by.foot_l).y - 0.07;   // the figure's ankle sits ~7 cm above the sole

  // ── helpers ──
  const qa = new T.Quaternion(), qb = new T.Quaternion(), m4 = new T.Matrix4(), v1 = new T.Vector3(), v2 = new T.Vector3();
  function setWorldQ(bone, q) { bone.parent.getWorldQuaternion(qa); bone.quaternion.copy(qa.invert().multiply(q)); bone.updateMatrixWorld(true); }
  function setWorldP(bone, p) { bone.parent.updateMatrixWorld(true); bone.position.copy(bone.parent.worldToLocal(p.clone())); bone.updateMatrixWorld(true); }
  function aimQ(bone, down, front) { // world rotation that takes the rest frame onto (down, front)
    const now = frame(down, front), rf = restFrame[bone.name];
    return new T.Quaternion().setFromRotationMatrix(m4.copy(now).multiply(new T.Matrix4().copy(rf).transpose())).multiply(restQ.get(bone));
  }
  function aim(bone, down, front) { setWorldQ(bone, aimQ(bone, down, front)); }
  const axisOf = (obj, x, y, z) => new T.Vector3(x, y, z).applyQuaternion(obj.getWorldQuaternion(qb));
  const posOf = obj => obj.getWorldPosition(new T.Vector3());
  function ik(A, Tg, a, b, pole) {
    const d = v1.subVectors(Tg, A); let dist = d.length(); const dir = d.clone().divideScalar(dist || 1);
    dist = Math.min(Math.max(dist, Math.abs(a - b) + 1e-3), a + b - 1e-4);
    const cosA = (a * a + dist * dist - b * b) / (2 * a * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    let pp = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (pp.lengthSq() < 1e-8) pp = new T.Vector3(0, 0, 1); pp.normalize();
    return { E: A.clone().addScaledVector(dir, a * cosA).addScaledVector(pp, a * sinA), End: A.clone().addScaledVector(dir, dist) };
  }
  const slerpI = (q, f) => new T.Quaternion().slerp(q, f);   // identity -> q

  // ── drive from the procedural figure ──
  function drive(F, sh = 0, cur = null) {
    const qPel = F.pelvis.getWorldQuaternion(new T.Quaternion()), qSp = F.spine.getWorldQuaternion(new T.Quaternion()), qNk = F.neck.getWorldQuaternion(new T.Quaternion());
    // pelvis position + rotation
    setWorldQ(by.pelvis, qPel.clone().multiply(restQ.get(by.pelvis)));
    setWorldP(by.pelvis, posOf(F.pelvis).add(pelvisOff.clone().applyQuaternion(qPel)));
    // spine: spread the figure's lumbar bend over three vertebrae
    const rel = qPel.clone().invert().multiply(qSp);
    [['spine_01', 1 / 3], ['spine_02', 2 / 3], ['spine_03', 1]].forEach(([n, f]) => setWorldQ(by[n], qPel.clone().multiply(slerpI(rel, f)).multiply(restQ.get(by[n]))));
    const relN = qSp.clone().invert().multiply(qNk);
    setWorldQ(by.neck_01, qSp.clone().multiply(slerpI(relN, 0.5)).multiply(restQ.get(by.neck_01)));
    setWorldQ(by.Head, qSp.clone().multiply(relN).multiply(restQ.get(by.Head)));
    for (const [S, s, sg] of [[F.L, 'l', 1], [F.R, 'r', -1]]) {
      // shrug: lift the clavicle so the shoulder rises by `sh`
      const cl = by['clavicle_' + s], ang = Math.asin(Math.max(-0.4, Math.min(0.4, sh * 0.6 / L.clav))) * sg;
      const axL = FWD.clone().applyQuaternion(restQ.get(cl).clone().invert());
      cl.quaternion.copy(restLocalQ.get(cl)).multiply(new T.Quaternion().setFromAxisAngle(axL, ang)); cl.updateMatrixWorld(true);
      // arm: IK from the body's shoulder to the figure's wrist, elbow on the figure's side
      // the hand's orientation comes from the figure; the wrist sits back from the grip point so the handle is in the fist
      // flat hand on the floor (push-ups, burpees): palm down, fingers pointing forward from the body
      const grip0 = cur && cur.hand ? cur.hand[s === 'l' ? 'L' : 'R'] : posOf(S.hand);
      const palmF = axisOf(S.hand, 0, 0, 1), flat = openHand && grip0.y < 0.22;
      const fwd = flat ? axisOf(F.spine, 0, 0, 1).setY(0) : null;
      if (flat && fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
      const qHand = flat ? aimQ(by['hand_' + s], fwd.normalize(), new T.Vector3(0, -1, 0)) : aimQ(by['hand_' + s], axisOf(S.hand, 0, -1, 0), palmF);
      const grip = cur && cur.hand ? cur.hand[s === 'l' ? 'L' : 'R'] : posOf(S.hand);
      const wrT = grip.clone().sub((openHand ? palmLocal[s] : gripLocal[s]).clone().applyQuaternion(qHand));
      const shM = posOf(by['upperarm_' + s]), elF = posOf(S.fore);
      const pole = elF.clone().sub(posOf(S.upper).add(posOf(S.hand)).multiplyScalar(0.5));
      const arm = ik(shM, wrT, L.up, L.fo, pole);
      aim(by['upperarm_' + s], arm.E.clone().sub(shM), axisOf(S.upper, 0, 0, 1));
      aim(by['lowerarm_' + s], arm.End.clone().sub(arm.E), axisOf(S.fore, 0, 0, 1));
      setWorldQ(by['hand_' + s], qHand);
      // leg: IK from the body's hip to the figure's ankle (lifted for the taller ankle), knee on the figure's side
      const hipM = posOf(by['thigh_' + s]), anF = posOf(S.foot).addScaledVector(axisOf(S.foot, 0, 1, 0), ankleLift), knF = posOf(S.shin);
      const kpole = knF.clone().sub(posOf(S.thigh).add(anF).multiplyScalar(0.5));
      const leg = ik(hipM, anF, L.th, L.sh, kpole);
      aim(by['thigh_' + s], leg.E.clone().sub(hipM), axisOf(S.thigh, 0, 0, 1));
      aim(by['calf_' + s], leg.End.clone().sub(leg.E), axisOf(S.shin, 0, 0, 1));
      setWorldQ(by['foot_' + s], S.foot.getWorldQuaternion(new T.Quaternion()).multiply(restQ.get(by['foot_' + s])));
    }
  }

  // ── muscle regions on the skin (rest T-pose, metres, +Z forward, +X = left) ──
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const band = (x, a, b, e = 0.02) => ss(a - e, a + e, x) * (1 - ss(b - e, b + e, x));
  const body = meta.meshes.body, P = new Float32Array(bin, body.pos[0], body.count * 3), JI = new Uint8Array(bin, body.jo[0], body.count * 4), JWt = new Float32Array(bin, body.we[0], body.count * 4);
  const bi = n => meta.bones.findIndex(b => b.n === n);
  const set = names => new Set(names.flatMap(n => [bi(n + '_l'), bi(n + '_r'), bi(n)]).filter(i => i >= 0));
  const G = { up: set(['upperarm']), fo: set(['lowerarm']), cl: set(['clavicle']), th: set(['thigh']), ca: set(['calf']), neck: set(['neck_01', 'Head']),
    arm: set(['upperarm', 'lowerarm', 'hand']), leg: set(['thigh', 'calf', 'foot', 'ball']) };
  const SHX = restP.get(by.upperarm_l).x, ELX = restP.get(by.lowerarm_l).x, WRX = restP.get(by.hand_l).x, ARMY = restP.get(by.upperarm_l).y, ARMZ = restP.get(by.upperarm_l).z;
  const LEGX = restP.get(by.thigh_l).x, LEGZ = restP.get(by.thigh_l).z;
  const REG = ['pec', 'abs', 'obliques', 'serratus', 'lats', 'traps', 'rhomb', 'lowback', 'glutes', 'neck', 'deltF', 'deltS', 'deltR', 'biceps', 'triceps', 'forearm', 'quads', 'hams', 'adductors', 'calves', 'tibialis'];
  const masks = Object.fromEntries(REG.map(r => [r, new Float32Array(body.count)]));
  for (let i = 0; i < body.count; i++) {
    const X = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], x = Math.abs(X);
    let wUp = 0, wFo = 0, wCl = 0, wTh = 0, wCa = 0, wArm = 0, wLeg = 0, wNeck = 0;
    for (let c = 0; c < 4; c++) { const j = JI[i * 4 + c], w = JWt[i * 4 + c];
      if (G.up.has(j)) wUp += w; if (G.fo.has(j)) wFo += w; if (G.cl.has(j)) wCl += w; if (G.th.has(j)) wTh += w; if (G.ca.has(j)) wCa += w;
      if (G.arm.has(j)) wArm += w; if (G.leg.has(j)) wLeg += w; if (G.neck.has(j)) wNeck += w; }
    const wT = Math.max(0, 1 - wArm - wLeg);
    // arm: angle around the arm axis (0 = front, 90 = top, 180 = back)
    const ry = y - ARMY, rz = z - ARMZ, ang = Math.atan2(ry, rz) * 180 / Math.PI;
    const shoulder = ss(SHX - 0.07, SHX - 0.03, x) * (1 - ss(SHX + 0.09, SHX + 0.13, x)) * Math.min(1, (wUp + wCl) * 2) * ss(-0.035, 0.0, ry + 0.02);
    masks.deltF[i] = shoulder * band(ang, -15, 60, 15);
    masks.deltS[i] = shoulder * band(ang, 45, 125, 15);
    masks.deltR[i] = shoulder * (band(ang, 110, 180, 15) + band(ang, -180, -150, 15));
    const upSeg = wUp * ss(SHX + 0.07, SHX + 0.11, x) * (1 - ss(ELX - 0.03, ELX, x));
    masks.biceps[i] = upSeg * ss(-0.005, 0.02, rz);
    masks.triceps[i] = upSeg * ss(-0.005, 0.02, -rz);
    masks.forearm[i] = Math.min(1, wFo * 1.4) * ss(ELX + 0.01, ELX + 0.04, x) * (1 - ss(WRX - 0.04, WRX, x));
    // torso
    masks.pec[i] = wT * band(y, 1.27, 1.45) * ss(0.01, 0.03, x) * (1 - ss(0.17, 0.21, x)) * ss(0.03, 0.07, z);
    masks.abs[i] = wT * band(y, 0.99, 1.27) * (1 - ss(0.075, 0.095, x)) * ss(0.02, 0.06, z);
    masks.obliques[i] = wT * band(y, 0.98, 1.22, 0.03) * ss(0.085, 0.11, x) * (1 - ss(0.18, 0.21, x)) * ss(-0.07, -0.03, z);
    masks.serratus[i] = wT * band(y, 1.2, 1.31) * ss(0.12, 0.14, x) * ss(-0.04, -0.01, z) * (1 - ss(0.06, 0.09, z));
    masks.lats[i] = wT * band(y, 1.1, 1.4, 0.03) * ss(0.06, 0.09, x) * (1 - ss(0.2, 0.23, x)) * ss(0.02, 0.05, -z);
    masks.traps[i] = Math.max(wT * band(y, 1.42, 1.56) * (1 - ss(0.17, 0.21, x)) * ss(-0.02, 0.02, -z), wT * band(y, 1.24, 1.45) * (1 - ss(0.08, 0.11, x)) * ss(0.05, 0.08, -z));
    masks.rhomb[i] = wT * band(y, 1.27, 1.40) * ss(0.02, 0.04, x) * (1 - ss(0.1, 0.12, x)) * ss(0.05, 0.08, -z);
    masks.lowback[i] = wT * band(y, 0.98, 1.17) * (1 - ss(0.07, 0.09, x)) * ss(0.04, 0.07, -z);
    masks.glutes[i] = Math.max(wT, wTh) * band(y, 0.78, 1.0) * (1 - ss(0.19, 0.22, x)) * ss(0.0, 0.04, -(z + 0.03));
    masks.neck[i] = Math.min(1, wNeck * 2) * band(y, 1.49, 1.62) * (1 - ss(0.055, 0.075, x));
    // legs, relative to the thigh axis
    const lx = x - LEGX, lz = z - LEGZ;
    masks.quads[i] = wTh * band(y, 0.55, 0.93) * ss(-0.005, 0.02, lz);
    masks.hams[i] = wTh * band(y, 0.55, 0.88) * ss(-0.005, 0.02, -lz);
    masks.adductors[i] = Math.min(1, wTh + wT) * band(y, 0.6, 0.92) * ss(0.015, 0.04, -lx);
    masks.calves[i] = wCa * band(y, 0.15, 0.52) * ss(-0.01, 0.015, -(z + 0.05));
    masks.tibialis[i] = wCa * band(y, 0.15, 0.48) * ss(0.0, 0.02, z + 0.04) * ss(-0.01, 0.01, lx);
  }
  const hlAttr = meshes.body.geometry.getAttribute('hl');
  function setHighlight(fine) {
    const a = hlAttr.array; a.fill(0);
    for (const n of fine) { const m = masks[n]; if (!m) continue; for (let i = 0; i < a.length; i++) if (m[i] > a[i]) a[i] = m[i]; }
    hlAttr.needsUpdate = true;
  }
  function setEffort(e, accent) { if (accent) uni.uAcc.value.copy(accent); uni.uK.value = 0.8 + 0.2 * e; uni.uE.value = 0.06 + 0.22 * e; }
  return { group, drive, setHand, setHighlight, setEffort, regions: REG, bones: by, gripLocal, L };
}
