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
  const blade = toon('#5aa7e8');   // 透明にせず、はっきり見える色にする
  const edge = toon('#2f7dcc');
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
  shutter: THREE.Mesh;      // 閉じているときに穴をふさぐ板
  button: MachineButton;
}

// 台の上の大きなボタン（「すくう」と「おとす」を切り替える）。タップ／クリックで押す
export type ButtonState = 'scoop' | 'drop' | 'off';
const BUTTON_COLORS: Record<ButtonState, string> = { scoop: '#3d8bff', drop: '#ff5f9e', off: '#b9b3bd' };

export class MachineButton {
  group = new THREE.Group();
  hit: THREE.Mesh;          // 押しやすいよう、見た目より少し大きい当たり判定
  private cap: THREE.Mesh;
  private label: THREE.Mesh;
  private labels: Record<'scoop' | 'drop', THREE.Material>;
  private pressT = 0;
  state: ButtonState = 'off';

  constructor() {
    const base = mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.12, 32), toon('#3a2a3a'));
    this.group.add(base);
    this.cap = mesh(new THREE.CylinderGeometry(0.8, 0.86, 0.22, 32), toon(BUTTON_COLORS.off));
    this.cap.position.y = 0.17;
    this.group.add(this.cap);
    const labelMat = (text: string) => new THREE.MeshBasicMaterial({ map: circleLabel(text), transparent: true });
    this.labels = { scoop: labelMat('すくう'), drop: labelMat('おとす') };
    this.label = new THREE.Mesh(new THREE.CircleGeometry(0.72, 32), this.labels.scoop);
    this.label.rotation.x = -Math.PI / 2;
    this.label.rotation.z = Math.PI / 2;    // 席の側から読める向き
    this.label.position.y = 0.285;
    this.group.add(this.label);
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.9, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.hit.position.y = 0.2;
    this.group.add(this.hit);
  }

  set(state: ButtonState, ready: boolean, t: number, labelSide: 'scoop' | 'drop') {
    if (state !== this.state) {
      this.state = state;
      this.cap.material = toon(BUTTON_COLORS[state]);
    }
    this.label.material = this.labels[labelSide];
    // 押せるときは、ふくらんで知らせる
    const pulse = ready ? 1 + Math.sin(t * 6) * 0.05 : 1;
    this.cap.scale.set(pulse, 1, pulse);
    this.label.scale.set(pulse, pulse, 1);
    const press = this.pressT > 0 ? 0.12 : 0;
    this.pressT = Math.max(0, this.pressT - 1 / 60);
    this.cap.position.y = 0.17 - press;
    this.label.position.y = 0.285 - press;
  }

  press() { this.pressT = 0.15; }
}

function circleLabel(text: string) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 132);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
    const rail = mesh(new THREE.BoxGeometry(1.4, 0.16, 0.16), leg);
    rail.position.set(M.lowerIn - 0.5, M.lowerTop - 0.08, s * (M.stageW / 2 + 0.1));
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
  // 下段の手前の穴（ここから取り出し口へ落ちる）と、閉じているときにふさぐ板
  const holeW = M.stageW + 0.4;
  const holeDepth = M.domeR - M.lowerOut;
  const holeY = M.deckOut + 0.08;
  const slot = mesh(new THREE.BoxGeometry(holeDepth, 0.06, holeW), toon('#2a2030'), false);
  slot.position.set(M.lowerOut + holeDepth / 2, holeY, 0);
  g.add(slot);
  const shutter = mesh(new THREE.BoxGeometry(holeDepth, 0.05, holeW), toon(COLORS.stageEdge), false);
  shutter.position.set(M.lowerOut + holeDepth / 2, holeY + 0.05, 0);
  g.add(shutter);

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

  // 席の正面：取り出し口、7セグ、ボタン
  const face = new THREE.Group();
  face.position.set(M.apothem + 0.01, 0, 0);
  // 取り出し口：筐体から手前へ出っ張った箱。中は暗く、手前は透明なふた
  const trayH = M.chuteTop - M.chuteFloor + 0.6;
  const trayY = (M.chuteTop + M.chuteFloor - 0.6) / 2;
  const trayW = M.stageW + 0.5;
  const D = M.trayDepth;
  const back = mesh(new THREE.BoxGeometry(0.06, trayH, trayW), toon('#2a2030'), false);
  back.position.set(0.03, trayY, 0);
  face.add(back);
  const trim = toon(COLORS.trim);
  const roof = mesh(new THREE.BoxGeometry(D + 0.1, 0.14, trayW + 0.2), trim);
  roof.position.set(D / 2, M.chuteTop + 0.07, 0);
  face.add(roof);
  addOutline(roof, 0.03);
  const under = mesh(new THREE.BoxGeometry(D + 0.1, 0.5, trayW + 0.2), trim);
  under.position.set(D / 2, M.chuteFloor - 0.55, 0);
  face.add(under);
  addOutline(under, 0.03);
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.BoxGeometry(D + 0.1, trayH, 0.1), trim);
    w.position.set(D / 2, trayY, s * (trayW / 2 + 0.05));
    face.add(w);
  }
  const ramp = mesh(new THREE.BoxGeometry(D + 0.3, 0.06, trayW), toon('#4a3a50'), false);
  ramp.position.set(D / 2, M.chuteFloor + 0.42, 0);
  ramp.rotation.z = Math.atan2(M.chuteFloor - 4.7, D + M.domeR - M.lowerOut);
  face.add(ramp);
  const lid = mesh(new THREE.BoxGeometry(0.05, trayH, trayW), glass(0.22), false);
  lid.position.set(D + 0.03, trayY, 0);
  face.add(lid);
  const takeLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.3), new THREE.MeshBasicMaterial({ map: textTexture(['とりだしぐち'], 384, 64, '#fff1d6', '#5a3a4a', 'bold 40px sans-serif') }));
  takeLabel.rotation.y = Math.PI / 2;
  takeLabel.position.set(D + 0.07, M.chuteFloor - 0.55, 0);
  face.add(takeLabel);
  // 操作盤とボタン
  const panel = mesh(new THREE.BoxGeometry(2.3, 0.25, 4.2), trim);
  panel.position.set(1.1, 6.2, 0);
  face.add(panel);
  addOutline(panel, 0.03);
  const display = new SevenSeg();
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: display.texture }));
  disp.rotation.y = Math.PI / 2;
  disp.position.set(0.02, 6.72, 1.55);
  face.add(disp);
  const button = new MachineButton();
  button.group.position.set(1.15, 6.33, 0);
  face.add(button.group);
  g.add(face);

  return { group: g, upper, shovel, elbow, wrist, upperArm, foreArm, display, shutter, button };
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
  root.add(island, cap);
  outlined.push(island, cap);

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
  const R = M.domeR;
  const dome = mesh(lathe([[R, M.deckOut], [R, M.domeTop], [R * 0.96, 12.5], [R * 0.85, 13.3], [R * 0.64, 13.9], [R * 0.38, 14.25], [1.0, 14.35]]), glass(0.1), false, false);
  dome.renderOrder = 10;
  root.add(dome);
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4;
    const r = M.domeR * octFactor(a);
    const post = mesh(new THREE.CylinderGeometry(0.14, 0.14, M.domeTop - M.deckOut, 12), toon(COLORS.trim));
    post.position.set(Math.cos(a) * r, (M.domeTop + M.deckOut) / 2, Math.sin(a) * r);
    root.add(post);
  }
  const ring = mesh(lathe([[M.domeR + 0.1, 11.5], [M.domeR + 0.1, 11.75]]), toon(COLORS.rim));
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
