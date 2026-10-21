// 景品の3Dモデルをコードで組み立てる。見た目のテイスト（style）ごとに材質と分割数を変える。
// 単位：1 = 10cm
import * as THREE from 'three';

export const STYLES = {
  toon: 'トゥーン調',
  real: 'リアル調',
  lowpoly: 'ローポリ',
};

export const PASTEL = ['#ff8fb1', '#ffd36e', '#8fd3ff', '#a8e6a1', '#c9a7ff', '#ffb38a'];
export const GEM_COLORS = ['#ff4f7a', '#4fa8ff', '#5fe3a1', '#ffd34f', '#c06bff', '#ff8a3d'];

let toonGradient;
export function getToonGradient() {
  if (!toonGradient) {
    const data = new Uint8Array([90, 170, 255]);
    toonGradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

// 材質。opts.glass で透明な宝石・ショベル、opts.metal で金属
export function mat(style, color, opts = {}) {
  const c = new THREE.Color(color);
  if (style === 'toon') {
    if (opts.glass) {
      return new THREE.MeshToonMaterial({ color: c, gradientMap: getToonGradient(), transparent: true, opacity: opts.opacity ?? 0.55 });
    }
    return new THREE.MeshToonMaterial({ color: c, gradientMap: getToonGradient() });
  }
  if (style === 'lowpoly') {
    return new THREE.MeshStandardMaterial({
      color: c, flatShading: true, roughness: opts.metal ? 0.3 : 0.85, metalness: opts.metal ? 0.6 : 0,
      transparent: !!opts.glass, opacity: opts.glass ? (opts.opacity ?? 0.6) : 1,
    });
  }
  // real
  if (opts.glass) {
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: 0, roughness: 0.03, transmission: 1, thickness: opts.thickness ?? 0.4,
      ior: opts.ior ?? 1.7, transparent: true, opacity: 1, specularIntensity: 1,
      attenuationColor: c, attenuationDistance: 0.6,
    });
  }
  if (opts.metal) return new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: 0.18 });
  return new THREE.MeshPhysicalMaterial({
    color: c, roughness: opts.roughness ?? 0.45, clearcoat: opts.clearcoat ?? 0.4, clearcoatRoughness: 0.3,
  });
}

// 分割数。ローポリは粗く
export function seg(style, hi, lo) {
  return style === 'lowpoly' ? lo : hi;
}

function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// トゥーン調の輪郭線（裏面を少し太らせて黒で描く）
export function addOutlines(root, thickness = 0.025) {
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#3a2a3a', side: THREE.BackSide });
  const targets = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) targets.push(o);
  });
  for (const o of targets) {
    o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere.radius || 1;
    const s = 1 + thickness / r;
    const line = new THREE.Mesh(o.geometry, outlineMat);
    line.scale.setScalar(s);
    line.userData.isOutline = true;
    line.castShadow = false;
    o.add(line);
  }
}

function pick(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

// ---- 普通の景品 ----

function candy(style, rnd) {
  const g = new THREE.Group();
  const color = pick(PASTEL, rnd);
  const body = mesh(new THREE.SphereGeometry(0.14, seg(style, 24, 6), seg(style, 16, 4)), mat(style, color));
  body.scale.set(1.25, 1, 1);
  g.add(body);
  const wrapMat = mat(style, '#ffffff', { glass: style !== 'toon', opacity: 0.7 });
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.ConeGeometry(0.09, 0.14, seg(style, 12, 4)), wrapMat);
    w.rotation.z = s * Math.PI / 2;
    w.position.x = s * 0.22;
    g.add(w);
  }
  return g;
}

function choco(style, rnd) {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.36, 0.12, 0.24), mat(style, '#6b3f2a', { roughness: 0.6 }));
  g.add(body);
  const band = mesh(new THREE.BoxGeometry(0.16, 0.125, 0.245), mat(style, pick(['#e8443a', '#2f7de1', '#f2b632'], rnd)));
  g.add(band);
  return g;
}

function stick(style, rnd) {
  const g = new THREE.Group();
  const s = seg(style, 16, 5);
  const body = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, s), mat(style, '#d9a066'));
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const coat = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.44, s), mat(style, pick(['#5a3320', '#ff8fb1', '#a8e6a1'], rnd)));
  coat.rotation.z = Math.PI / 2;
  coat.position.x = 0.09;
  g.add(coat);
  return g;
}

function smallBox(style, rnd) {
  const g = new THREE.Group();
  const color = pick(PASTEL, rnd);
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.28, 0.34), mat(style, color)));
  const rib = mat(style, '#ffffff');
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.285, 0.345), rib));
  g.add(mesh(new THREE.BoxGeometry(0.345, 0.285, 0.06), rib));
  return g;
}

// 宝石の形（ブリリアントカット風）
function gemGeometry(style, r) {
  const pts = [
    new THREE.Vector2(0, -r * 0.9),
    new THREE.Vector2(r, -r * 0.05),
    new THREE.Vector2(r * 0.95, r * 0.12),
    new THREE.Vector2(r * 0.55, r * 0.42),
    new THREE.Vector2(0, r * 0.42),
  ];
  const geo = new THREE.LatheGeometry(pts, seg(style, 10, 8));
  return geo.toNonIndexed();
}

function gemSmall(style, rnd) {
  const g = new THREE.Group();
  const geo = gemGeometry(style, 0.13);
  geo.computeVertexNormals();
  const m = mesh(geo, mat(style, pick(GEM_COLORS, rnd), { glass: true, thickness: 0.2 }));
  m.material.flatShading = true;
  g.add(m);
  return g;
}

function gemLarge(style, rnd) {
  const g = new THREE.Group();
  const geo = gemGeometry(style, 0.32);
  geo.computeVertexNormals();
  const m = mesh(geo, mat(style, pick(GEM_COLORS, rnd), { glass: true, thickness: 0.6 }));
  m.material.flatShading = true;
  g.add(m);
  return g;
}

// ---- 大物 10種類 ----

function bear(style, color = '#c98a55') {
  const g = new THREE.Group();
  const s = seg(style, 24, 7);
  const m = mat(style, color);
  const light = mat(style, '#f3d7b5');
  const dark = mat(style, '#2b1d1d');
  const body = mesh(new THREE.SphereGeometry(0.34, s, s), m); body.scale.set(1, 1.1, 0.9); body.position.y = 0.34; g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.28, s, s), m); head.position.y = 0.86; g.add(head);
  for (const x of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.1, s, s), m); ear.position.set(x * 0.2, 1.08, 0); g.add(ear);
    const arm = mesh(new THREE.SphereGeometry(0.12, s, s), m); arm.scale.set(1, 1.4, 1); arm.position.set(x * 0.36, 0.45, 0.06); g.add(arm);
    const leg = mesh(new THREE.SphereGeometry(0.13, s, s), m); leg.position.set(x * 0.18, 0.08, 0.16); g.add(leg);
    const eye = mesh(new THREE.SphereGeometry(0.035, 8, 8), dark); eye.position.set(x * 0.1, 0.92, 0.25); eye.userData.noOutline = true; g.add(eye);
  }
  const muzzle = mesh(new THREE.SphereGeometry(0.11, s, s), light); muzzle.scale.set(1.2, 0.9, 0.8); muzzle.position.set(0, 0.8, 0.24); g.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.035, 8, 8), dark); nose.position.set(0, 0.84, 0.33); nose.userData.noOutline = true; g.add(nose);
  const belly = mesh(new THREE.SphereGeometry(0.2, s, s), light); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.34, 0.24); g.add(belly);
  return g;
}

function rabbit(style) {
  const g = bear(style, '#f6f1ee');
  const s = seg(style, 20, 6);
  const m = mat(style, '#f6f1ee');
  const pink = mat(style, '#ffadc6');
  // クマの耳をウサギの長い耳に替える
  g.children.filter((c) => c.position.y > 1.0).forEach((c) => g.remove(c));
  for (const x of [-1, 1]) {
    const ear = mesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, s), m); ear.position.set(x * 0.11, 1.28, 0); ear.rotation.z = -x * 0.15; g.add(ear);
    const inner = mesh(new THREE.CapsuleGeometry(0.035, 0.3, 4, s), pink); inner.position.set(x * 0.11, 1.28, 0.05); inner.rotation.z = -x * 0.15; inner.userData.noOutline = true; g.add(inner);
  }
  return g;
}

function car(style, body, cabin, isTruck) {
  const g = new THREE.Group();
  const s = seg(style, 20, 6);
  const bodyMat = mat(style, body, { clearcoat: 1, roughness: 0.25 });
  const len = isTruck ? 1.15 : 1.0;
  const b = mesh(new THREE.BoxGeometry(len, 0.24, 0.5), bodyMat); b.position.y = 0.24; g.add(b);
  const c = mesh(new THREE.BoxGeometry(isTruck ? 0.36 : 0.5, 0.2, 0.44), mat(style, cabin, { glass: !isTruck && style === 'real', opacity: 0.8 }));
  c.position.set(isTruck ? 0.36 : -0.05, 0.46, 0); g.add(c);
  const tire = mat(style, '#222228', { roughness: 0.9 });
  const hub = mat(style, '#d8d8e0', { metal: true });
  for (const x of [-len * 0.32, len * 0.32]) {
    for (const z of [-0.26, 0.26]) {
      const w = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, s), tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.13, z); g.add(w);
      const h = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, s), hub); h.rotation.x = Math.PI / 2; h.position.set(x, 0.13, z); h.userData.noOutline = true; g.add(h);
    }
  }
  if (isTruck) {
    const ladderMat = mat(style, '#e6e6ea', { metal: true });
    for (const z of [-0.12, 0.12]) {
      const rail = mesh(new THREE.BoxGeometry(0.8, 0.04, 0.04), ladderMat); rail.position.set(-0.12, 0.42, z); g.add(rail);
    }
    for (let i = 0; i < 6; i++) {
      const rung = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), ladderMat); rung.position.set(-0.45 + i * 0.13, 0.42, 0); rung.userData.noOutline = true; g.add(rung);
    }
    const light = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), mat(style, '#4fa8ff', { glass: true })); light.position.set(0.36, 0.59, 0); g.add(light);
  } else {
    const spoiler = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.5), bodyMat); spoiler.position.set(-0.46, 0.44, 0); g.add(spoiler);
    for (const z of [-0.1, 0.1]) {
      const p = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.03), bodyMat); p.position.set(-0.46, 0.38, z * 2); g.add(p);
    }
  }
  return g;
}

function trex(style) {
  const g = new THREE.Group();
  const s = seg(style, 20, 6);
  const m = mat(style, '#6cc46a');
  const belly = mat(style, '#d9f2a6');
  const body = mesh(new THREE.SphereGeometry(0.3, s, s), m); body.scale.set(1.3, 1, 0.9); body.position.set(0, 0.5, 0); g.add(body);
  const head = mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3, 1, 1, 1), m); head.position.set(0.42, 0.88, 0); g.add(head);
  const jaw = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.26), belly); jaw.position.set(0.44, 0.72, 0); g.add(jaw);
  const tail = mesh(new THREE.ConeGeometry(0.2, 0.7, s), m); tail.rotation.z = Math.PI / 2 + 0.25; tail.position.set(-0.6, 0.42, 0); g.add(tail);
  const tummy = mesh(new THREE.SphereGeometry(0.2, s, s), belly); tummy.scale.set(1, 1.1, 0.5); tummy.position.set(0.12, 0.45, 0); tummy.rotation.y = Math.PI / 2; g.add(tummy);
  for (const z of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, s), m); leg.position.set(-0.05, 0.16, z * 0.18); g.add(leg);
    const arm = mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, s), m); arm.position.set(0.3, 0.56, z * 0.16); arm.rotation.z = 1.0; g.add(arm);
    const eye = mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(style, '#1e1e1e')); eye.position.set(0.5, 0.96, z * 0.15); eye.userData.noOutline = true; g.add(eye);
  }
  return g;
}

function triceratops(style) {
  const g = new THREE.Group();
  const s = seg(style, 20, 6);
  const m = mat(style, '#7fa7e8');
  const horn = mat(style, '#fff3d6');
  const body = mesh(new THREE.SphereGeometry(0.34, s, s), m); body.scale.set(1.4, 0.9, 1); body.position.y = 0.4; g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.2, s, s), m); head.scale.set(1.2, 1, 1); head.position.set(0.52, 0.48, 0); g.add(head);
  const frill = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, s), mat(style, '#f59ac0')); frill.rotation.z = Math.PI / 2 - 0.5; frill.position.set(0.38, 0.66, 0); g.add(frill);
  for (const z of [-1, 1]) {
    const h = mesh(new THREE.ConeGeometry(0.04, 0.26, s), horn); h.rotation.z = -1.1; h.position.set(0.66, 0.66, z * 0.09); g.add(h);
    for (const x of [-0.25, 0.25]) {
      const leg = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.24, s), m); leg.position.set(x, 0.12, z * 0.2); g.add(leg);
    }
    const eye = mesh(new THREE.SphereGeometry(0.03, 8, 8), mat(style, '#1e1e1e')); eye.position.set(0.66, 0.55, z * 0.12); eye.userData.noOutline = true; g.add(eye);
  }
  const nose = mesh(new THREE.ConeGeometry(0.035, 0.14, s), horn); nose.rotation.z = -1.4; nose.position.set(0.76, 0.5, 0); g.add(nose);
  const tail = mesh(new THREE.ConeGeometry(0.12, 0.4, s), m); tail.rotation.z = Math.PI / 2 + 0.3; tail.position.set(-0.6, 0.34, 0); g.add(tail);
  return g;
}

function ring(style, gemColor) {
  const g = new THREE.Group();
  const s = seg(style, 48, 8);
  const band = mesh(new THREE.TorusGeometry(0.34, 0.06, seg(style, 16, 4), s), mat(style, '#f2c14e', { metal: true }));
  band.position.y = 0.4;
  g.add(band);
  const seat = mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.1, seg(style, 16, 6)), mat(style, '#f2c14e', { metal: true }));
  seat.position.y = 0.78;
  g.add(seat);
  const geo = gemGeometry(style, 0.24);
  geo.computeVertexNormals();
  const gem = mesh(geo, mat(style, gemColor, { glass: true, thickness: 0.5 }));
  gem.material.flatShading = true;
  gem.position.y = 1.02;
  g.add(gem);
  return g;
}

function lollipop(style) {
  const g = new THREE.Group();
  const s = seg(style, 40, 8);
  const colors = ['#ff6f9f', '#ffffff', '#ffd36e', '#ffffff', '#8fd3ff', '#ffffff'];
  for (let i = 0; i < colors.length; i++) {
    const r = 0.44 - i * 0.07;
    const t = mesh(new THREE.TorusGeometry(r, 0.045, seg(style, 10, 4), s), mat(style, colors[i], { clearcoat: 1, roughness: 0.15 }));
    t.position.y = 1.0;
    if (i > 0) t.userData.noOutline = true;
    g.add(t);
  }
  const center = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, s), mat(style, '#ff6f9f'));
  center.rotation.x = Math.PI / 2; center.position.y = 1.0; g.add(center);
  const back = mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, s), mat(style, '#ffe3ee'));
  back.rotation.x = Math.PI / 2; back.position.set(0, 1.0, -0.03); back.userData.noOutline = true; g.add(back);
  const st = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, seg(style, 12, 4)), mat(style, '#fafafa'));
  st.position.y = 0.3; g.add(st);
  return g;
}

function chocoBar(style) {
  const g = new THREE.Group();
  const choc = mat(style, '#5b3524', { roughness: 0.5 });
  const base = mesh(new THREE.BoxGeometry(1.1, 0.08, 0.6), choc); base.position.y = 0.04; g.add(base);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const p = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.15), choc);
      p.position.set(-0.24 + i * 0.25, 0.1, -0.18 + j * 0.18);
      p.userData.noOutline = true;
      g.add(p);
    }
  }
  const wrap = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.62), mat(style, '#d6262e', { clearcoat: 1 }));
  wrap.position.set(0.32, 0.07, 0); g.add(wrap);
  const foil = mesh(new THREE.BoxGeometry(0.04, 0.165, 0.625), mat(style, '#e9e9ee', { metal: true }));
  foil.position.set(0.06, 0.07, 0); g.add(foil);
  const label = mesh(new THREE.BoxGeometry(0.3, 0.165, 0.2), mat(style, '#ffe066'));
  label.position.set(0.34, 0.075, 0); label.userData.noOutline = true; g.add(label);
  return g;
}

// 普通の景品の種類
export const NORMAL_PRIZES = {
  candy: { name: '飴', make: candy, volume: 1 },
  choco: { name: 'チョコ', make: choco, volume: 1.5 },
  stick: { name: 'スティック菓子', make: stick, volume: 1.5 },
  smallBox: { name: '小箱', make: smallBox, volume: 3 },
  gemSmall: { name: '宝石（小）', make: gemSmall, volume: 1 },
  gemLarge: { name: '宝石（大）', make: gemLarge, volume: 4 },
};

// 大物 10種類
export const BIG_PRIZES = {
  bear: { name: 'クマ', genre: '動物マスコット', make: (s) => bear(s), volume: 20 },
  rabbit: { name: 'ウサギ', genre: '動物マスコット', make: (s) => rabbit(s), volume: 20 },
  sportsCar: { name: 'スポーツカー', genre: '車のおもちゃ', make: (s) => car(s, '#ffcf3a', '#7fd0ff', false), volume: 16 },
  fireTruck: { name: '消防車', genre: '車のおもちゃ', make: (s) => car(s, '#e8382f', '#e8382f', true), volume: 18 },
  trex: { name: 'ティラノサウルス', genre: '恐竜マスコット', make: (s) => trex(s), volume: 20 },
  triceratops: { name: 'トリケラトプス', genre: '恐竜マスコット', make: (s) => triceratops(s), volume: 20 },
  rubyRing: { name: 'ルビーの指輪', genre: '大きい宝石がついた指輪', make: (s) => ring(s, '#ff2050'), volume: 10 },
  sapphireRing: { name: 'サファイアの指輪', genre: '大きい宝石がついた指輪', make: (s) => ring(s, '#2a6bff'), volume: 10 },
  lollipop: { name: '巨大ペロペロキャンディ', genre: '大きいお菓子', make: (s) => lollipop(s), volume: 14 },
  chocoBar: { name: '巨大板チョコ', genre: '大きいお菓子', make: (s) => chocoBar(s), volume: 14 },
};

export const ALL_PRIZES = { ...NORMAL_PRIZES, ...BIG_PRIZES };

// 景品を1つ作る。style がトゥーン調なら輪郭線を付ける
export function makePrize(kind, style, rnd = Math.random) {
  const def = ALL_PRIZES[kind];
  const g = def.make(style, rnd);
  g.userData.kind = kind;
  if (style === 'toon') addOutlines(g, BIG_PRIZES[kind] ? 0.03 : 0.012);
  return g;
}

// 台に載せる普通の景品をランダムに選ぶ（お菓子中心、宝石（小）約8%）
export function randomNormalKind(rnd = Math.random) {
  const r = rnd();
  if (r < 0.3) return 'candy';
  if (r < 0.55) return 'choco';
  if (r < 0.75) return 'stick';
  if (r < 0.91) return 'smallBox';
  if (r < 0.99) return 'gemSmall';
  return 'gemLarge';
}

// 再現できる乱数
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
