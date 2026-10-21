// 筐体（土台、景品の川、4席のプッシャー、ショベル、ドーム）を組み立てる。
// 見た目の試作なので物理演算はしない。景品はランダムに積んで置き、決まった道筋で動かすだけ。
// 単位：1 = 10cm。各席は「x+ = 席の方向（外側）、z = 左右」の座標で作り、y軸まわりに回して並べる。
//
// 景品の川：プッシャーテーブルの下をくぐるように、中央の島のまわりを輪の形の溝が回っている。
// ショベルは川から景品をすくって上段に載せる。台の左右からこぼれた景品は、坂を滑って川に戻る。
import * as THREE from 'three';
import { mat, seg, addOutlines, makePrize, randomNormalKind, BIG_PRIZES, seeded } from './prizes.js';

const COLORS = {
  body: '#ffc9dc',
  trim: '#fff1d6',
  mint: '#aeeed6',
  sky: '#b9ddff',
  deck: '#fff8f0',
  river: '#bfe6ff',
  rim: '#ff9cc0',
  stage: '#fffdf8',
  stageEdge: '#ffb3cf',
};

export const BASE_SHAPES = { octagon: '8角形', circle: '円' };

const APOTHEM = 6.9;        // 土台の中心から席の正面までの距離
const BODY_TOP = 7.1;       // 土台の胴の上端
const RIVER_FLOOR = 7.3;    // 川の底
const RIVER_IN = 0.95;      // 川の内側（中央の島の半径）
const RIVER_OUT = 4.45;     // 川の外側
const DECK_TOP = 7.92;      // デッキ（席と席のあいだの坂）の上端
const LOWER_TOP = 8.3;      // 下段の上面
const UPPER_TOP = 8.75;     // 上段の上面
const UPPER_IN = 3.3;       // 上段の内側の端（川の上に張り出す）
const UPPER_OUT = 5.3;
const LOWER_IN = 4.9;
const LOWER_OUT = 6.75;     // 下段の手前の端（ここから獲得口へ落ちる）
const STAGE_W = 3.4;
const PUSH_AMP = 0.45;      // 上段の振れ幅
// 腕：肩の位置と、上腕・前腕の長さ
const ARM = { sx: 6.0, sy: 10.0, l1: 2.0, l2: 2.8 };
// 手首の位置（ホーム＝上段の真上、川＝すくう位置）と、手首の角度（+ で先端が下がる）
const WRIST = { homeX: 4.3, homeY: 10.3, riverX: 1.95, riverY: RIVER_FLOOR + 0.85 };
const PITCH = { level: 0, dive: 0.9, cup: -0.3, dump: 1.35 };

function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function glassMat(style, opacity = 0.14) {
  if (style === 'real') {
    return new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, envMapIntensity: 1.5, clearcoat: 1,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: style === 'toon' ? '#e8f6ff' : '#ffffff', transparent: true, opacity: opacity + 0.04, depthWrite: false,
    side: THREE.DoubleSide, roughness: 0.1, flatShading: style === 'lowpoly',
  });
}

// 8角形のときの、角度 th での「中心から縁までの距離 / 内接円の半径」
function octFactor(th) {
  const step = Math.PI / 4;
  const d = th - Math.round(th / step) * step;
  return 1 / Math.cos(d);
}

// 回転体のジオメトリを、半径 from より外側だけ8角形に引き伸ばす（席の方向が平らな面になる）
function shapeGeometry(geo, shape, from = 0) {
  if (shape !== 'octagon') return geo;
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const t = THREE.MathUtils.smoothstep(r, from, from + 0.6);
    const f = 1 + (octFactor(Math.atan2(z, x)) - 1) * (from === 0 ? 1 : t);
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

function lathe(points, style, shape, from = 0, hi = 96) {
  const geo = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), shape === 'octagon' ? Math.max(hi, 64) : seg(style, hi, 16));
  return shapeGeometry(geo, shape, from);
}

function textTexture(lines, { w = 512, h = 128, bg = '#ff7fb0', fg = '#ffffff', font = 'bold 64px sans-serif' } = {}) {
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
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / (lines.length + 1) * (i + 1)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sevenSegTexture(credit) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#140a0a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffd0d0';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('CREDIT', 14, 30);
  ctx.font = 'bold 96px monospace';
  ctx.fillStyle = '#3a0c0c';
  ctx.fillText('8', 150, 110);
  ctx.fillStyle = '#ff3b3b';
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 12;
  ctx.fillText(String(credit), 150, 110);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 川の底の模様（流れが分かるように波線を描く）
function riverTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = COLORS.river;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let ring = 0; ring < 5; ring++) {
    const r = 70 + ring * 42;
    for (let k = 0; k < 10 + ring * 3; k++) {
      const a0 = (k / (10 + ring * 3)) * Math.PI * 2 + ring * 0.4;
      ctx.beginPath();
      ctx.arc(256, 256, r, a0, a0 + 0.22);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 景品を山盛りに置く。region(rnd) が [x, z] を返す
function scatter(parent, count, style, rnd, region, baseY, kinds) {
  const placed = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds ? kinds(rnd) : randomNormalKind(rnd);
    const p = makePrize(kind, style, rnd);
    const [x, z] = region(rnd);
    // 近くに既に置いた数だけ上に積む
    let layer = 0;
    for (const q of placed) {
      if (Math.hypot(q.x - x, q.z - z) < 0.3) layer++;
    }
    placed.push({ x, z });
    p.position.set(x, baseY + 0.07 + Math.min(layer, 2) * 0.17, z);
    p.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
    parent.add(p);
  }
}

// ショベル。原点が手首の関節で、刃は手首の下にぶら下がる。
// 横向きにすくう：先端（リップ）は +z（川の上流側。流れてくる景品を正面で受ける）、
// 背面の壁は -z（下流側）を向く。rotation.x を + にすると先端が下がる。
const BLADE_DROP = 0.4; // 手首から刃の中心までの高さ
function buildShovel(style) {
  const g = new THREE.Group();
  const blade = glassMat(style, 0.32);
  blade.depthWrite = true;
  const edge = mat(style, '#9fd7ff');
  const body = new THREE.Group();
  body.position.y = -BLADE_DROP;
  g.add(body);
  // 中央（浅いボウル）：中央の板と、左右（腕の方向）に少し反り上がった板
  body.add(mesh(new THREE.BoxGeometry(0.7, 0.03, 1.0), blade));
  for (const s of [-1, 1]) {
    const side = mesh(new THREE.BoxGeometry(0.42, 0.03, 1.0), blade);
    side.position.set(s * 0.54, 0.04, 0);
    side.rotation.z = s * 0.2;
    body.add(side);
  }
  // 先端（リップ）：薄いくさび
  const lip = mesh(new THREE.BoxGeometry(1.5, 0.012, 0.18), edge);
  lip.position.set(0, -0.01, 0.58);
  body.add(lip);
  // 背面の壁（ストッパー）：少し内側に傾ける
  const wall = mesh(new THREE.BoxGeometry(1.5, 0.45, 0.04), blade);
  wall.position.set(0, 0.22, -0.52);
  wall.rotation.x = 0.15;
  body.add(wall);
  const frame = mesh(new THREE.BoxGeometry(1.55, 0.06, 0.06), edge);
  frame.position.set(0, 0.45, -0.56);
  body.add(frame);
  // 手首から背面の壁の上へつながる金具
  const bar = mesh(new THREE.BoxGeometry(0.3, 0.08, 0.6), edge);
  bar.position.set(0, 0.02, -0.3);
  g.add(bar);
  g.userData.body = body;
  return g;
}

// 2本の棒（上腕・前腕）の関節角を、手首の目標位置から求める（肘が上に来る解）
function solveArm(sx, sy, wx, wy, l1, l2) {
  const dx = wx - sx;
  const dy = wy - sy;
  const d = THREE.MathUtils.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const a = Math.atan2(dy, dx);
  const b = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const cands = [a + b, a - b].map((t) => ({ t, ex: sx + Math.cos(t) * l1, ey: sy + Math.sin(t) * l1 }));
  const e = cands[0].ey > cands[1].ey ? cands[0] : cands[1];
  return { ex: e.ex, ey: e.ey };
}

// 2点のあいだに棒を置く
function placeLink(m, x1, y1, x2, y2) {
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  m.scale.x = Math.hypot(x2 - x1, y2 - y1);
}

function buildSeat(style, rnd, index, opts) {
  const seat = new THREE.Group();
  seat.rotation.y = -index * Math.PI / 2;
  const stageMat = mat(style, COLORS.stage);
  const edgeMat = mat(style, COLORS.stageEdge);
  const legMat = mat(style, COLORS.sky);

  // 下段（デッキの上に脚で立つ。左右は開いていて、こぼれた景品は坂を滑って川へ）
  const lowerLen = LOWER_OUT - LOWER_IN;
  const lowerX = (LOWER_IN + LOWER_OUT) / 2;
  const lowerBox = mesh(new THREE.BoxGeometry(lowerLen, 0.4, STAGE_W), stageMat);
  lowerBox.position.set(lowerX, LOWER_TOP - 0.2, 0);
  seat.add(lowerBox);
  const lip = mesh(new THREE.BoxGeometry(0.08, 0.42, STAGE_W + 0.02), edgeMat);
  lip.position.set(LOWER_OUT, LOWER_TOP - 0.2, 0);
  seat.add(lip);

  // 上段（前後に動く。内側の端は川の上に張り出している）
  const upper = new THREE.Group();
  const upperLen = UPPER_OUT - UPPER_IN;
  const upperBox = mesh(new THREE.BoxGeometry(upperLen, 0.45, STAGE_W - 0.04), stageMat);
  upperBox.position.set((UPPER_IN + UPPER_OUT) / 2, UPPER_TOP - 0.225, 0);
  upper.add(upperBox);
  const upperEdge = mesh(new THREE.BoxGeometry(0.08, 0.47, STAGE_W - 0.02), edgeMat);
  upperEdge.position.set(UPPER_OUT, UPPER_TOP - 0.225, 0);
  upper.add(upperEdge);
  seat.add(upper);
  // 上段を支えるレール（川をまたぐ）
  for (const s of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(3.4, 0.16, 0.16), legMat);
    rail.position.set(4.6, LOWER_TOP - 0.08, s * (STAGE_W / 2 + 0.1));
    seat.add(rail);
    const leg = mesh(new THREE.BoxGeometry(0.16, LOWER_TOP - RIVER_FLOOR, 0.16), legMat);
    leg.position.set(3.0, (LOWER_TOP + RIVER_FLOOR) / 2, s * (STAGE_W / 2 + 0.1));
    seat.add(leg);
  }

  // 上段の左右だけ透明なガイド（下段の左右は開けておく）
  const guideMat = glassMat(style, 0.2);
  for (const s of [-1, 1]) {
    const gd = mesh(new THREE.BoxGeometry(upperLen + PUSH_AMP * 2, 0.8, 0.04), guideMat, { cast: false });
    gd.position.set((UPPER_IN + UPPER_OUT) / 2, UPPER_TOP + 0.4, s * (STAGE_W / 2 + 0.02));
    seat.add(gd);
  }

  // 下段の景品
  const lowerItems = new THREE.Group();
  seat.add(lowerItems);
  const layout = opts.layouts[index];
  if (layout.tower) {
    // タワー：小箱を高く積む
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 5 - i; k++) {
          const b = makePrize('smallBox', style, rnd);
          b.position.set(5.6 + i * 0.3, LOWER_TOP + 0.14 + k * 0.285, (j - 1) * 0.37);
          b.rotation.y = (rnd() - 0.5) * 0.1;
          lowerItems.add(b);
        }
      }
    }
    scatter(lowerItems, 14, style, rnd, (r) => [5.3 + r() * 0.3, (r() - 0.5) * 3.0], LOWER_TOP);
    scatter(lowerItems, 10, style, rnd, (r) => [5.4 + r() * 1.1, (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.8)], LOWER_TOP);
  } else {
    scatter(lowerItems, 30, style, rnd, (r) => [5.35 + r() * 1.25, (r() - 0.5) * 3.1], LOWER_TOP);
  }
  if (layout.big) {
    const big = makePrize(layout.big, style, rnd);
    big.position.set(6.0, LOWER_TOP + 0.15, 0.3);
    big.rotation.y = rnd() * Math.PI * 2;
    lowerItems.add(big);
  }

  // 上段の景品
  const upperItems = new THREE.Group();
  upper.add(upperItems);
  scatter(upperItems, 14, style, rnd, (r) => [UPPER_IN + 0.4 + r() * 1.5, (r() - 0.5) * 3.0], UPPER_TOP);

  // 獲得口へ落ちる穴
  const slot = mesh(new THREE.BoxGeometry(0.16, 0.06, STAGE_W), mat(style, '#2a2030'), { cast: false });
  slot.position.set(LOWER_OUT + 0.08, DECK_TOP + 0.01, 0);
  seat.add(slot);

  // ショベルの腕：肩（固定）→ 上腕 → 肘 → 前腕 → 手首 → ショベル
  const arm = new THREE.Group();
  const frameMat = mat(style, COLORS.sky);
  // 肩を吊る門形の枠
  const gantry = mesh(new THREE.BoxGeometry(0.22, 0.22, STAGE_W + 0.9), frameMat);
  gantry.position.set(ARM.sx, ARM.sy + 0.35, 0);
  arm.add(gantry);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.2, ARM.sy + 0.35 - DECK_TOP, 0.2), frameMat);
    post.position.set(ARM.sx, (ARM.sy + 0.35 + DECK_TOP) / 2, s * (STAGE_W / 2 + 0.45));
    arm.add(post);
  }
  const jointMat = mat(style, COLORS.mint);
  const linkMat = mat(style, '#e9e9ef', { metal: true });
  const hub = (r) => {
    const h = mesh(new THREE.CylinderGeometry(r, r, 0.42, seg(style, 24, 8)), jointMat);
    h.rotation.x = Math.PI / 2;
    arm.add(h);
    return h;
  };
  const shoulder = hub(0.3);
  shoulder.position.set(ARM.sx, ARM.sy, 0);
  const elbow = hub(0.24);
  const wrist = hub(0.18);
  const upperArm = mesh(new THREE.BoxGeometry(1, 0.26, 0.26), linkMat);
  const foreArm = mesh(new THREE.BoxGeometry(1, 0.2, 0.2), linkMat);
  arm.add(upperArm, foreArm);
  const shovel = buildShovel(style);
  arm.add(shovel);
  seat.add(arm);

  // 席の正面：獲得口、7セグ表示、ボタン
  const face = new THREE.Group();
  face.position.set(APOTHEM + 0.01, 0, 0);
  const win = mesh(new THREE.BoxGeometry(0.1, 1.6, 3.0), mat(style, '#2a2030'), { cast: false });
  win.position.set(0, 3.6, 0);
  face.add(win);
  const flap = mesh(new THREE.BoxGeometry(0.06, 1.5, 2.9), glassMat(style, 0.35), { cast: false });
  flap.position.set(0.08, 3.6, 0);
  face.add(flap);
  const frame = mesh(new THREE.BoxGeometry(0.16, 1.9, 3.3), mat(style, COLORS.trim));
  frame.position.set(-0.04, 3.6, 0);
  face.add(frame);
  const panel = mesh(new THREE.BoxGeometry(0.9, 0.25, 3.6), mat(style, COLORS.trim));
  panel.position.set(0.35, 6.2, 0);
  face.add(panel);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: sevenSegTexture(index === 0 ? 1 : 0) }));
  disp.rotation.y = Math.PI / 2;
  disp.position.set(0.12, 6.75, 0);
  face.add(disp);
  const btnDefs = [['#3d8bff', 'すくう', 0.8], ['#ff5f9e', 'おとす', -0.8]];
  for (const [color, label, z] of btnDefs) {
    const btn = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.15, seg(style, 24, 8)), mat(style, color, { clearcoat: 1, roughness: 0.2 }));
    btn.position.set(0.45, 6.38, z);
    face.add(btn);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: textTexture([label], { w: 256, h: 64, bg: '#fff1d6', fg: '#5a3a4a', font: 'bold 40px sans-serif' }) }));
    lab.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    lab.position.set(0.72, 6.33, z);
    face.add(lab);
  }
  seat.add(face);

  return { seat, upper, upperItems, lowerItems, arm, elbow, wrist, upperArm, foreArm, shovel, carried: [], falling: [], spilling: [] };
}

export function defaultLayouts(rnd) {
  const bigKinds = Object.keys(BIG_PRIZES);
  return [0, 1, 2, 3].map((i) => ({
    tower: i === 2 || rnd() < 0.25,
    big: i === 1 || rnd() < 0.3 ? bigKinds[Math.floor(rnd() * bigKinds.length)] : null,
  }));
}

export function buildMachine(style, { seed = 7, shape = 'octagon' } = {}) {
  const rnd = seeded(seed);
  const root = new THREE.Group();
  const layouts = defaultLayouts(rnd);
  const outlined = [];

  // 床
  const floor = mesh(new THREE.CircleGeometry(40, 48), mat(style, style === 'real' ? '#3b3350' : style === 'toon' ? '#ffd6e6' : '#a9c7e8'), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // 土台（円か8角形）
  const body = mesh(lathe([[0.01, 0.6], [APOTHEM, 0.6], [APOTHEM, BODY_TOP], [0.01, BODY_TOP]], style, shape), mat(style, COLORS.body));
  root.add(body);
  const plinth = mesh(lathe([[0.01, 0], [APOTHEM + 0.2, 0], [APOTHEM + 0.2, 0.6], [0.01, 0.6]], style, shape), mat(style, COLORS.sky));
  root.add(plinth);
  outlined.push(body, plinth);

  // 水玉模様（席の正面を避けて、斜めの面に並べる）
  const dotMat = mat(style, COLORS.mint);
  for (let i = 0; i < 4; i++) {
    for (const da of [-0.22, 0, 0.22]) {
      for (const y of [1.8, 4.6]) {
        const a = Math.PI / 4 + i * Math.PI / 2 + da;
        const r = APOTHEM * (shape === 'octagon' ? octFactor(a) : 1) + 0.02;
        const d = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, seg(style, 24, 6)), dotMat, { cast: false });
        d.position.set(Math.cos(a) * r, y + (da === 0 ? 1.4 : 0), Math.sin(a) * r);
        d.rotation.set(0, -(shape === 'octagon' ? Math.round(a / (Math.PI / 4)) * (Math.PI / 4) : a), Math.PI / 2);
        root.add(d);
      }
    }
  }

  // デッキ：外側は平ら、内側は川へ向かって下る坂（こぼれた景品が川に戻る）
  const deck = mesh(lathe([[RIVER_OUT, RIVER_FLOOR + 0.25], [5.3, DECK_TOP], [APOTHEM + 0.2, DECK_TOP], [APOTHEM + 0.2, BODY_TOP - 0.3]], style, shape, 5.4), mat(style, COLORS.deck));
  deck.material.side = THREE.DoubleSide;
  root.add(deck);
  const band = mesh(lathe([[APOTHEM + 0.21, BODY_TOP - 0.3], [APOTHEM + 0.21, DECK_TOP + 0.06]], style, shape, 5.4), mat(style, COLORS.trim));
  band.material.side = THREE.DoubleSide;
  root.add(band);

  // 景品の川：溝の外壁と底（底は回る）
  const wall = mesh(lathe([[RIVER_OUT, RIVER_FLOOR - 0.05], [RIVER_OUT, RIVER_FLOOR + 0.26]], style, 'circle', 0, 96), mat(style, COLORS.rim));
  wall.material.side = THREE.DoubleSide;
  root.add(wall);
  const river = new THREE.Group();
  const riverFloor = mesh(new THREE.RingGeometry(RIVER_IN, RIVER_OUT, seg(style, 96, 24), 1), style === 'lowpoly' ? mat(style, COLORS.river) : new THREE.MeshStandardMaterial({ map: riverTexture(), roughness: 0.5 }), { cast: false });
  riverFloor.rotation.x = -Math.PI / 2;
  riverFloor.position.y = RIVER_FLOOR;
  river.add(riverFloor);
  const riverItems = new THREE.Group();
  river.add(riverItems);
  scatter(riverItems, 150, style, rnd, (r) => {
    const a = r() * Math.PI * 2;
    const rad = RIVER_IN + 0.3 + r() * (RIVER_OUT - RIVER_IN - 0.55);
    return [Math.cos(a) * rad, Math.sin(a) * rad];
  }, RIVER_FLOOR);
  // ショベルですくえる大きさの大物
  const riverBig = makePrize(layouts[0].big || 'bear', style, rnd);
  riverBig.scale.setScalar(0.6);
  riverBig.position.set(-2.2, RIVER_FLOOR + 0.05, 1.0);
  riverItems.add(riverBig);
  root.add(river);

  // 中央の島（回らない）
  const island = mesh(new THREE.CylinderGeometry(RIVER_IN, RIVER_IN + 0.05, 9.6 - BODY_TOP, seg(style, 48, 8)), mat(style, COLORS.mint));
  island.position.y = (9.6 + BODY_TOP) / 2;
  root.add(island);
  const islandCap = mesh(new THREE.CylinderGeometry(RIVER_IN + 0.15, RIVER_IN + 0.15, 0.2, seg(style, 48, 8)), mat(style, COLORS.rim));
  islandCap.position.y = 9.7;
  root.add(islandCap);
  const ball = mesh(new THREE.SphereGeometry(0.6, seg(style, 32, 8), seg(style, 16, 5)), mat(style, COLORS.rim, { clearcoat: 1, roughness: 0.2 }));
  ball.position.y = 10.4;
  root.add(ball);
  outlined.push(island, islandCap, ball, band);

  // 4席
  const seats = [];
  for (let i = 0; i < 4; i++) {
    const s = buildSeat(style, rnd, i, { layouts });
    root.add(s.seat);
    seats.push(s);
  }

  // 席の仕切り（斜めの方向。デッキの外側だけ）
  const partMat = glassMat(style, 0.18);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const rOut = APOTHEM * (shape === 'octagon' ? octFactor(a) : 1);
    const len = rOut - 5.4;
    const p = mesh(new THREE.BoxGeometry(len, 1.4, 0.05), partMat, { cast: false });
    p.position.set(Math.cos(a) * (5.4 + len / 2), DECK_TOP + 0.7, Math.sin(a) * (5.4 + len / 2));
    p.rotation.y = -a;
    root.add(p);
  }

  // ドーム（土台と同じ形）
  const dome = mesh(lathe([[6.85, DECK_TOP], [6.85, 11.6], [6.6, 12.5], [5.8, 13.3], [4.4, 13.9], [2.6, 14.25], [1.0, 14.35]], style, shape), glassMat(style, 0.12), { cast: false, receive: false });
  dome.renderOrder = 10;
  root.add(dome);
  // 柱：8角形は角に8本、円は斜めに4本
  const postMat = mat(style, COLORS.trim);
  const postAngles = shape === 'octagon' ? [...Array(8)].map((_, k) => Math.PI / 8 + k * Math.PI / 4) : [0, 1, 2, 3].map((k) => Math.PI / 4 + k * Math.PI / 2);
  for (const a of postAngles) {
    const r = 6.85 * (shape === 'octagon' ? octFactor(a) : 1);
    const post = mesh(new THREE.CylinderGeometry(0.14, 0.14, 11.6 - DECK_TOP, seg(style, 12, 5)), postMat);
    post.position.set(Math.cos(a) * r, (11.6 + DECK_TOP) / 2, Math.sin(a) * r);
    root.add(post);
  }
  const ring = mesh(lathe([[6.95, 11.5], [6.95, 11.75]], style, shape), mat(style, COLORS.rim));
  ring.material.side = THREE.DoubleSide;
  root.add(ring);

  // てっぺんの看板
  const crown = new THREE.Group();
  crown.position.y = 14.3;
  const cBase = mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, shape === 'octagon' ? 8 : seg(style, 32, 8)), mat(style, COLORS.rim));
  cBase.position.y = 0.2;
  cBase.rotation.y = Math.PI / 8;
  crown.add(cBase);
  const signTex = textTexture(['すくっておとして', 'スペシャル'], { w: 512, h: 256, bg: '#ff7fb0', fg: '#ffffff', font: 'bold 64px sans-serif' });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
  const signBox = mesh(new THREE.BoxGeometry(2.6, 1.3, 2.6), [signMat, signMat, mat(style, COLORS.trim), mat(style, COLORS.trim), signMat, signMat]);
  signBox.position.y = 1.05;
  crown.add(signBox);
  const top = mesh(new THREE.SphereGeometry(0.45, seg(style, 24, 6), seg(style, 12, 4)), mat(style, COLORS.mint, { clearcoat: 1 }));
  top.position.y = 2.0;
  crown.add(top);
  root.add(crown);
  outlined.push(cBase, top);

  if (style === 'toon') {
    // 透明なものには輪郭線を付けない
    root.traverse((o) => {
      if (o.isMesh && o.material && o.material.transparent) o.userData.noOutline = true;
    });
    for (const o of outlined) addOutlines(o, 0.06);
    seats.forEach((s) => addOutlines(s.arm, 0.03));
  }

  // ---- 動き ----
  const RIVER_PERIOD = 24; // 川が1周する秒数
  // 1サイクル。reach〜carry が「すくう」、dump〜reset が「おとす」。waitDrop はプレイヤーが「おとす」を押すまでの待ち
  const CYCLE = [
    ['wait', 1.6], ['reach', 1.8], ['settle', 0.3], ['scoop', 1.0], ['carry', 1.8], ['waitDrop', 1.2], ['dump', 0.45], ['hold', 0.5], ['reset', 0.6],
  ];
  const cycleLen = CYCLE.reduce((a, [, d]) => a + d, 0);
  const ease = (x) => x * x * (3 - 2 * x);
  const lerp = THREE.MathUtils.lerp;
  const HOME_POSE = { x: WRIST.homeX, y: WRIST.homeY, pitch: PITCH.level, phase: 'wait' };

  // 手首の位置と角度
  function shovelPose(t) {
    const { homeX, homeY, riverX, riverY } = WRIST;
    let acc = 0;
    for (const [name, d] of CYCLE) {
      if (t < acc + d) {
        const k = ease((t - acc) / d);
        // 上段の内側の縁をよけるため、運ぶ途中は少し持ち上げる
        const arc = Math.sin(Math.PI * k) * 0.9;
        switch (name) {
          case 'wait': return HOME_POSE;
          // 肘が伸びて川へ。着くまでに手首を回して先端を下げておく
          case 'reach': return { x: lerp(homeX, riverX, k), y: lerp(homeY, riverY, k) + arc, pitch: lerp(PITCH.level, PITCH.dive, k), phase: name };
          case 'settle': return { x: riverX, y: riverY, pitch: PITCH.dive, phase: name };
          // 手首を回してすくう（先端が景品の下に潜り、持ち上がる）
          case 'scoop': return { x: riverX, y: riverY + 0.15 * k, pitch: lerp(PITCH.dive, PITCH.cup, k), phase: name };
          // その角度のまま、上段の真上へ運ぶ
          case 'carry': return { x: lerp(riverX, homeX, k), y: lerp(riverY + 0.15, homeY, k) + arc, pitch: PITCH.cup, phase: name };
          case 'waitDrop': return { x: homeX, y: homeY, pitch: PITCH.cup, phase: name };
          // 「おとす」：手首を回して先端を下げ、景品を落とす
          case 'dump': return { x: homeX, y: homeY, pitch: lerp(PITCH.cup, PITCH.dump, k), phase: name };
          case 'hold': return { x: homeX, y: homeY, pitch: PITCH.dump, phase: name };
          case 'reset': return { x: homeX, y: homeY, pitch: lerp(PITCH.dump, PITCH.level, k), phase: name };
        }
      }
      acc += d;
    }
    return HOME_POSE;
  }

  function poseArm(s, pose) {
    const { ex, ey } = solveArm(ARM.sx, ARM.sy, pose.x, pose.y, ARM.l1, ARM.l2);
    s.elbow.position.set(ex, ey, 0);
    s.wrist.position.set(pose.x, pose.y, 0);
    placeLink(s.upperArm, ARM.sx, ARM.sy, ex, ey);
    placeLink(s.foreArm, ex, ey, pose.x, pose.y);
    s.shovel.position.set(pose.x, pose.y, 0);
    s.shovel.rotation.x = pose.pitch;
  }

  const lastPhase = seats.map(() => '');
  const tmp = new THREE.Vector3();
  let nextSpill = 2;

  // 下段の左右から景品をこぼし、坂を滑らせて川に戻す
  function startSpill(s) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const p = makePrize(randomNormalKind(), style);
    p.position.set(5.4 + Math.random() * 1.0, LOWER_TOP + 0.08, side * (STAGE_W / 2 - 0.15));
    s.seat.add(p);
    s.spilling.push({ p, side, t: 0 });
  }

  function updateSpill(s, dt) {
    for (let k = s.spilling.length - 1; k >= 0; k--) {
      const sp = s.spilling[k];
      sp.t += dt;
      const p = sp.p;
      if (sp.t < 0.5) {
        // 下段の縁から横へ転がり落ちる
        const u = sp.t / 0.5;
        p.position.z = sp.side * (STAGE_W / 2 - 0.15 + u * 0.75);
        p.position.y = LOWER_TOP + 0.08 - u * u * (LOWER_TOP - DECK_TOP + 0.02);
        p.rotation.x += sp.side * 8 * dt;
      } else {
        // 坂を中心へ向かって滑り、川へ入る
        const r = Math.hypot(p.position.x, p.position.z);
        const speed = 2.2;
        const nr = Math.max(r - speed * dt, RIVER_OUT - 0.35);
        p.position.x *= nr / r;
        p.position.z *= nr / r;
        const slope = THREE.MathUtils.clamp((nr - RIVER_OUT) / (5.3 - RIVER_OUT), 0, 1);
        p.position.y = RIVER_FLOOR + 0.07 + slope * (DECK_TOP - RIVER_FLOOR - 0.07);
        p.rotation.y += 3 * dt;
        if (nr <= RIVER_OUT - 0.35) {
          // 川に入ったら、川と一緒に回る
          p.getWorldPosition(tmp);
          river.worldToLocal(tmp);
          s.seat.remove(p);
          p.position.copy(tmp);
          riverItems.add(p);
          s.spilling.splice(k, 1);
          while (riverItems.children.length > 175) riverItems.remove(riverItems.children[1]);
        }
      }
    }
  }

  function update(time, dt) {
    river.rotation.y = time * (Math.PI * 2 / RIVER_PERIOD);
    nextSpill -= dt;
    seats.forEach((s, i) => {
      // 上段の前後運動（席ごとに少しずらす）
      s.upper.position.x = Math.sin(time * Math.PI * 2 / 4 + i * 1.3) * PUSH_AMP;

      // ショベル：遊んでいる席（0番）だけ動かす。空き席はホームで止まる
      const pose = i === 0 ? shovelPose(time % cycleLen) : HOME_POSE;
      poseArm(s, pose);

      // すくった景品をショベルに載せ、手首を回したら上段へ落とす
      const body = s.shovel.userData.body;
      if (pose.phase !== lastPhase[i]) {
        if (pose.phase === 'carry') {
          const n = 2 + Math.floor(Math.random() * 3);
          for (let k = 0; k < n; k++) {
            const p = makePrize(randomNormalKind(), style);
            p.position.set((Math.random() - 0.5) * 1.0, 0.1, -0.1 - Math.random() * 0.3);
            p.rotation.y = Math.random() * Math.PI;
            body.add(p);
            s.carried.push(p);
          }
        }
        if (pose.phase === 'hold') {
          for (const p of s.carried) {
            p.getWorldPosition(tmp);
            s.seat.worldToLocal(tmp);
            body.remove(p);
            p.position.copy(tmp);
            p.userData.vy = 0;
            s.seat.add(p);
            s.falling.push(p);
          }
          s.carried = [];
        }
        lastPhase[i] = pose.phase;
      }
      for (let k = s.falling.length - 1; k >= 0; k--) {
        const p = s.falling[k];
        p.userData.vy -= 30 * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += 0.6 * dt;
        p.rotation.x += 3 * dt;
        if (p.position.y <= UPPER_TOP + 0.08) {
          p.position.y = UPPER_TOP + 0.08;
          p.position.x -= s.upper.position.x;
          s.seat.remove(p);
          s.upperItems.add(p);
          s.falling.splice(k, 1);
          // 上段の景品が増えすぎないよう、古いものを消す
          while (s.upperItems.children.length > 24) s.upperItems.remove(s.upperItems.children[0]);
        }
      }

      // サイドこぼれ（ときどき、どこかの席で起きる）
      if (nextSpill <= 0 && i === Math.floor(Math.random() * 4)) {
        startSpill(s);
        nextSpill = 1.2 + Math.random() * 1.5;
      }
      updateSpill(s, dt);
    });
  }

  // 席から覗き込む視点
  function seatView(i) {
    const a = i * Math.PI / 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    // 腕の曲げ伸ばしが見えるよう、少し斜めから見る
    const eye = new THREE.Vector3(Math.cos(a + 0.6), 0, Math.sin(a + 0.6));
    return {
      position: eye.multiplyScalar(17).add(new THREE.Vector3(0, 16, 0)),
      target: dir.clone().multiplyScalar(2.8).add(new THREE.Vector3(0, 8.6, 0)),
    };
  }

  return { root, update, seatView, layouts };
}
