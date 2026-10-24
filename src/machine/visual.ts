// 筐体の見た目（トゥーン調・8角形）。動く部分（上段・腕・ショベル・川の底）は参照を返す。
import * as THREE from 'three';
import { M, ARM, SHOVEL_SCALE, STIR } from '../config';
import { toonGradient } from '../prizes/catalog';

export const COLORS = {
  body: '#ffc9dc', trim: '#fff1d6', mint: '#aeeed6', sky: '#b9ddff', deck: '#fff8f0',
  river: '#bfe6ff', rim: '#ff9cc0', stage: '#fffdf8', stageEdge: '#ffb3cf', ink: '#3a2a3a',
};

const matCache = new Map<string, THREE.Material>();
export function toon(color: string) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() }));
  return matCache.get(color);
}
export function glass(opacity = 0.16) {
  return new THREE.MeshStandardMaterial({ color: '#e8f6ff', transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: 0.1 });
}
const outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.ink, side: THREE.BackSide });

function mesh(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], cast = true, receive = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function addOutline(o: THREE.Mesh, t = 0.05) {
  o.geometry.computeBoundingSphere();
  const r = o.geometry.boundingSphere.radius || 1;
  const line = new THREE.Mesh(o.geometry, outlineMat);
  line.scale.setScalar(1 + t / r);
  o.add(line);
}

// 8角形のときの「中心から縁までの距離 / 内接円の半径」
export function octFactor(th: number) {
  const step = Math.PI / 4;
  return 1 / Math.cos(th - Math.round(th / step) * step);
}

// 回転体を、半径 from より外側だけ8角形に引き伸ばす
function octagonize(geo: THREE.BufferGeometry, from = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const t = from === 0 ? 1 : THREE.MathUtils.smoothstep(r, from, from + 0.6);
    const f = 1 + (octFactor(Math.atan2(z, x)) - 1) * t;
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

function lathe(points: [number, number][], from = 0, segs = 96) {
  return octagonize(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs), from);
}

function textTexture(lines: string[], w = 512, h = 128, bg = '#ff7fb0', fg = '#ffffff', font = 'bold 64px sans-serif') {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 7セグ風のクレジット表示（数字が変わったら描き直す）
export class SevenSeg {
  canvas = document.createElement('canvas');
  texture: THREE.CanvasTexture;
  constructor() {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.set(0);
  }
  set(n: number) {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#140a0a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffd0d0';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('CREDIT', 14, 30);
    ctx.font = 'bold 96px monospace';
    ctx.fillStyle = '#3a0c0c';
    ctx.fillText('8', 150, 110);
    ctx.fillStyle = '#ff3b3b';
    ctx.fillText(String(n), 150, 110);
    this.texture.needsUpdate = true;
  }
}

function riverTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = COLORS.river;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let ring = 0; ring < 5; ring++) {
    const r = 70 + ring * 42;
    const n = 10 + ring * 3;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + ring * 0.4;
      ctx.beginPath();
      ctx.arc(256, 256, r, a0, a0 + 0.22);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ショベル。原点が手首の関節で、刃は手首の下にぶら下がる。
// 横向きにすくう：先端（リップ）は +z（川の上流側）、背面の壁は -z。rotation.x を + にすると先端が下がる。
export const BLADE_DROP = 0.4;
function buildShovel() {
  const g = new THREE.Group();
  const blade = new THREE.MeshToonMaterial({ color: '#cfeeff', gradientMap: toonGradient(), transparent: true, opacity: 0.55 });
  const edge = toon('#7cc4f0');
  const body = new THREE.Group();
  body.position.y = -BLADE_DROP;
  g.add(body);
  body.add(mesh(new THREE.BoxGeometry(0.7, 0.03, 1.0), blade));
  for (const s of [-1, 1]) {
    const side = mesh(new THREE.BoxGeometry(0.42, 0.03, 1.0), blade);
    side.position.set(s * 0.54, 0.04, 0);
    side.rotation.z = s * 0.2;
    body.add(side);
  }
  const lip = mesh(new THREE.BoxGeometry(1.5, 0.012, 0.18), edge);
  lip.position.set(0, -0.01, 0.58);
  body.add(lip);
  const wall = mesh(new THREE.BoxGeometry(1.5, 0.45, 0.04), blade);
  wall.position.set(0, 0.22, -0.52);
  wall.rotation.x = 0.15;
  body.add(wall);
  const frame = mesh(new THREE.BoxGeometry(1.55, 0.06, 0.06), edge);
  frame.position.set(0, 0.45, -0.56);
  body.add(frame);
  const bar = mesh(new THREE.BoxGeometry(0.3, 0.08, 0.6), edge);
  bar.position.set(0, 0.02, -0.3);
  g.add(bar);
  // 大きさは物理の当たり判定と同じ倍率にする
  const outer = new THREE.Group();
  g.scale.setScalar(SHOVEL_SCALE);
  outer.add(g);
  return outer;
}

export interface SeatVisual {
  group: THREE.Group;
  upper: THREE.Group;
  shovel: THREE.Group;
  elbow: THREE.Mesh;
  wrist: THREE.Mesh;
  upperArm: THREE.Mesh;
  foreArm: THREE.Mesh;
  display: SevenSeg;
  flap: THREE.Mesh;
}

function buildSeat(i: number): SeatVisual {
  const g = new THREE.Group();
  g.rotation.y = -i * Math.PI / 2;
  const stage = toon(COLORS.stage), edge = toon(COLORS.stageEdge), leg = toon(COLORS.sky);

  // 下段
  const lowerLen = M.lowerOut - M.lowerIn;
  const lower = mesh(new THREE.BoxGeometry(lowerLen, 0.4, M.stageW), stage);
  lower.position.set((M.lowerIn + M.lowerOut) / 2, M.lowerTop - 0.2, 0);
  g.add(lower);
  addOutline(lower, 0.03);
  const lip = mesh(new THREE.BoxGeometry(0.08, 0.42, M.stageW + 0.02), edge);
  lip.position.set(M.lowerOut, M.lowerTop - 0.2, 0);
  g.add(lip);
  // 下段の脚
  for (const s of [-1, 1]) {
    const l = mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), leg);
    l.position.set(M.lowerIn + 0.2, M.lowerTop - 0.6, s * (M.stageW / 2 - 0.2));
    g.add(l);
  }

  // 上段（前後に動く）
  const upper = new THREE.Group();
  const upperLen = M.upperOut - M.upperIn;
  const ub = mesh(new THREE.BoxGeometry(upperLen, 0.45, M.stageW - 0.04), stage);
  ub.position.set((M.upperIn + M.upperOut) / 2, M.upperTop - 0.225, 0);
  upper.add(ub);
  addOutline(ub, 0.03);
  const ue = mesh(new THREE.BoxGeometry(0.08, 0.47, M.stageW - 0.02), edge);
  ue.position.set(M.upperOut, M.upperTop - 0.225, 0);
  upper.add(ue);
  g.add(upper);
  // 上段を支えるレール（下段から川の上へ張り出す）
  for (const s of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(2.2, 0.16, 0.16), leg);
    rail.position.set(M.lowerIn - 1.0, M.lowerTop - 0.08, s * (M.stageW / 2 + 0.1));
    g.add(rail);
  }
  // 上段の奥の固定の壁（上段が引っ込むとき、上段の景品を手前へ押し出す）
  const sweeper = mesh(new THREE.BoxGeometry(0.08, 0.44, M.stageW), toon(COLORS.mint));
  sweeper.position.set(M.sweeper, M.upperTop + 0.23, 0);
  addOutline(sweeper, 0.02);
  g.add(sweeper);
  // 上段の左右の透明なガイド
  for (const s of [-1, 1]) {
    const gd = mesh(new THREE.BoxGeometry(upperLen + 1.2, 0.8, 0.04), glass(0.2), false);
    gd.position.set((M.upperIn + M.upperOut) / 2, M.upperTop + 0.4, s * (M.stageW / 2 + 0.02));
    g.add(gd);
  }
  // 獲得口へ落ちる穴
  const slot = mesh(new THREE.BoxGeometry(0.16, 0.06, M.stageW), toon('#2a2030'), false);
  slot.position.set(M.lowerOut + 0.08, M.deckOut + 0.01, 0);
  g.add(slot);

  // 腕
  const frame = toon(COLORS.sky);
  const gantry = mesh(new THREE.BoxGeometry(0.22, 0.22, M.stageW + 0.9), frame);
  gantry.position.set(ARM.sx, ARM.sy + 0.35, 0);
  g.add(gantry);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.2, ARM.sy + 0.35 - M.deckOut, 0.2), frame);
    post.position.set(ARM.sx, (ARM.sy + 0.35 + M.deckOut) / 2, s * (M.stageW / 2 + 0.45));
    g.add(post);
  }
  const hub = (r: number) => {
    const h = mesh(new THREE.CylinderGeometry(r, r, 0.42, 24), toon(COLORS.mint));
    h.rotation.x = Math.PI / 2;
    addOutline(h, 0.03);
    g.add(h);
    return h;
  };
  const shoulder = hub(0.3);
  shoulder.position.set(ARM.sx, ARM.sy, 0);
  const elbow = hub(0.24);
  const wrist = hub(0.18);
  const upperArm = mesh(new THREE.BoxGeometry(1, 0.26, 0.26), toon('#e9e9ef'));
  const foreArm = mesh(new THREE.BoxGeometry(1, 0.2, 0.2), toon('#e9e9ef'));
  g.add(upperArm, foreArm);
  const shovel = buildShovel();
  g.add(shovel);

  // 席の正面：獲得口、7セグ、ボタン
  const face = new THREE.Group();
  face.position.set(M.apothem + 0.01, 0, 0);
  const win = mesh(new THREE.BoxGeometry(0.1, 1.6, 3.0), toon('#2a2030'), false);
  win.position.set(0, 3.6, 0);
  face.add(win);
  const flap = mesh(new THREE.BoxGeometry(0.06, 1.5, 2.9), glass(0.5), false);
  flap.position.set(0.08, 3.6, 0);
  face.add(flap);
  const fr = mesh(new THREE.BoxGeometry(0.16, 1.9, 3.3), toon(COLORS.trim));
  fr.position.set(-0.04, 3.6, 0);
  face.add(fr);
  const panel = mesh(new THREE.BoxGeometry(0.9, 0.25, 3.6), toon(COLORS.trim));
  panel.position.set(0.35, 6.2, 0);
  face.add(panel);
  const display = new SevenSeg();
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: display.texture }));
  disp.rotation.y = Math.PI / 2;
  disp.position.set(0.12, 6.75, 0);
  face.add(disp);
  for (const [color, label, z] of [['#3d8bff', 'すくう', 0.8], ['#ff5f9e', 'おとす', -0.8]] as const) {
    const btn = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.15, 24), toon(color));
    btn.position.set(0.45, 6.38, z);
    face.add(btn);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: textTexture([label], 256, 64, '#fff1d6', '#5a3a4a', 'bold 40px sans-serif') }));
    lab.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    lab.position.set(0.72, 6.33, z);
    face.add(lab);
  }
  g.add(face);

  return { group: g, upper, shovel, elbow, wrist, upperArm, foreArm, display, flap };
}

export interface MachineVisual {
  root: THREE.Group;
  river: THREE.Group;
  seats: SeatVisual[];
  hatch: THREE.Group;
  stirrers: THREE.Mesh[];
}

export function buildMachineVisual(): MachineVisual {
  const root = new THREE.Group();
  const outlined: THREE.Mesh[] = [];

  const floor = mesh(new THREE.CircleGeometry(60, 48), toon('#ffd6e6'), false);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // 土台
  const body = mesh(lathe([[0.01, 0.6], [M.apothem, 0.6], [M.apothem, M.bodyTop], [0.01, M.bodyTop]]), toon(COLORS.body));
  const plinth = mesh(lathe([[0.01, 0], [M.apothem + 0.2, 0], [M.apothem + 0.2, 0.6], [0.01, 0.6]]), toon(COLORS.sky));
  root.add(body, plinth);
  outlined.push(body, plinth);
  // 水玉模様（斜めの面）
  for (let i = 0; i < 4; i++) {
    for (const da of [-0.22, 0, 0.22]) {
      for (const y of [1.8, 4.6]) {
        const a = Math.PI / 4 + i * Math.PI / 2 + da;
        const r = M.apothem * octFactor(a) + 0.02;
        const d = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 24), toon(COLORS.mint), false);
        d.position.set(Math.cos(a) * r, y + (da === 0 ? 1.4 : 0), Math.sin(a) * r);
        d.rotation.set(0, -Math.round(a / (Math.PI / 4)) * (Math.PI / 4), Math.PI / 2);
        root.add(d);
      }
    }
  }

  // デッキ：川へ向かって下る坂
  const deck = mesh(lathe([[M.riverOut, M.deckIn], [M.apothem + 0.2, M.deckOut], [M.apothem + 0.2, M.bodyTop - 0.3]], 5.4), toon(COLORS.deck));
  (deck.material as THREE.Material).side = THREE.DoubleSide;
  root.add(deck);
  const band = mesh(lathe([[M.apothem + 0.21, M.bodyTop - 0.3], [M.apothem + 0.21, M.deckOut + 0.06]], 5.4), toon(COLORS.trim));
  root.add(band);
  outlined.push(band);

  // 景品の川
  const wall = mesh(lathe([[M.riverOut, M.riverFloor - 0.05], [M.riverOut, M.deckIn]], 0, 96), toon(COLORS.rim));
  root.add(wall);
  const river = new THREE.Group();
  const rf = mesh(new THREE.RingGeometry(M.riverIn, M.riverOut, 96, 1), new THREE.MeshToonMaterial({ map: riverTexture(), gradientMap: toonGradient() }), false);
  rf.rotation.x = -Math.PI / 2;
  rf.position.y = M.riverFloor;
  river.add(rf);
  root.add(river);

  // かき混ぜの仕切り板（位置は毎フレーム game.ts で合わせる）
  const stirrers: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const m = mesh(new THREE.BoxGeometry(STIR.rOut - STIR.rIn, STIR.height + 0.3, 0.1), toon(COLORS.mint));
    addOutline(m, 0.02);
    m.visible = false;
    root.add(m);
    stirrers.push(m);
  }

  // 中央の島
  const island = mesh(new THREE.CylinderGeometry(M.riverIn, M.riverIn + 0.05, 9.6 - M.bodyTop, 48), toon(COLORS.mint));
  island.position.y = (9.6 + M.bodyTop) / 2;
  const cap = mesh(new THREE.CylinderGeometry(M.riverIn + 0.15, M.riverIn + 0.15, 0.2, 48), toon(COLORS.rim));
  cap.position.y = 9.7;
  const ball = mesh(new THREE.SphereGeometry(0.6, 32, 16), toon(COLORS.rim));
  ball.position.y = 10.4;
  root.add(island, cap, ball);
  outlined.push(island, cap, ball);

  const seats = [0, 1, 2, 3].map((i) => buildSeat(i));
  seats.forEach((s) => root.add(s.group));

  // 席の仕切り
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const rOut = M.apothem * octFactor(a);
    const len = rOut - 5.4;
    const p = mesh(new THREE.BoxGeometry(len, 1.4, 0.05), glass(0.18), false);
    p.position.set(Math.cos(a) * (5.4 + len / 2), M.deckOut + 0.7, Math.sin(a) * (5.4 + len / 2));
    p.rotation.y = -a;
    root.add(p);
  }

  // ドーム
  const dome = mesh(lathe([[6.85, M.deckOut], [6.85, M.domeTop], [6.6, 12.5], [5.8, 13.3], [4.4, 13.9], [2.6, 14.25], [1.0, 14.35]]), glass(0.1), false, false);
  dome.renderOrder = 10;
  root.add(dome);
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4;
    const r = 6.85 * octFactor(a);
    const post = mesh(new THREE.CylinderGeometry(0.14, 0.14, M.domeTop - M.deckOut, 12), toon(COLORS.trim));
    post.position.set(Math.cos(a) * r, (M.domeTop + M.deckOut) / 2, Math.sin(a) * r);
    root.add(post);
  }
  const ring = mesh(lathe([[6.95, 11.5], [6.95, 11.75]]), toon(COLORS.rim));
  (ring.material as THREE.Material).side = THREE.DoubleSide;
  root.add(ring);

  // てっぺんの看板（補充のときに開くハッチを兼ねる）
  const hatch = new THREE.Group();
  hatch.position.y = 14.3;
  const cBase = mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 8), toon(COLORS.rim));
  cBase.position.y = 0.2;
  cBase.rotation.y = Math.PI / 8;
  hatch.add(cBase);
  const signMat = new THREE.MeshBasicMaterial({ map: textTexture(['すくっておとして', 'スペシャル'], 512, 256), side: THREE.DoubleSide });
  const signBox = mesh(new THREE.BoxGeometry(2.6, 1.3, 2.6), [signMat, signMat, toon(COLORS.trim), toon(COLORS.trim), signMat, signMat]);
  signBox.position.y = 1.05;
  hatch.add(signBox);
  const top = mesh(new THREE.SphereGeometry(0.45, 24, 12), toon(COLORS.mint));
  top.position.y = 2.0;
  hatch.add(top);
  root.add(hatch);
  outlined.push(cBase, top);

  for (const o of outlined) addOutline(o, 0.06);
  return { root, river, seats, hatch, stirrers };
}
