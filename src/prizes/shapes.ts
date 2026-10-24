// コード製の景品の形。部品（ジオメトリ＋色＋位置）の一覧として組み立て、あとで1つのメッシュにまとめる。
// 単位：1 = 10cm
import * as THREE from 'three';

export const PASTEL = ['#ff8fb1', '#ffd36e', '#8fd3ff', '#a8e6a1', '#c9a7ff', '#ffb38a'];
export const GEM_COLORS = ['#ff4f7a', '#4fa8ff', '#5fe3a1', '#ffd34f', '#c06bff', '#ff8a3d'];

export interface Part {
  geo: THREE.BufferGeometry;
  color: THREE.Color;
  matrix: THREE.Matrix4;
  outline: boolean;
}

type Rnd = () => number;
const pick = <T,>(arr: T[], rnd: Rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

class Builder {
  parts: Part[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  add(geo: THREE.BufferGeometry, color: string, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1], outline = true) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    );
    m.premultiply(this.stack[this.stack.length - 1]);
    this.parts.push({ geo, color: new THREE.Color(color), matrix: m, outline });
    return this;
  }
}

const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cyl = (r1: number, r2: number, h: number, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
const cone = (r: number, h: number, s = 12) => new THREE.ConeGeometry(r, h, s);
const capsule = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 12);
const torus = (r: number, t: number, s = 40, ts = 12) => new THREE.TorusGeometry(r, t, ts, s);

// 宝石の形（ブリリアントカット風）
export function gemGeometry(r: number) {
  const pts = [
    new THREE.Vector2(0, -r * 0.9),
    new THREE.Vector2(r, -r * 0.05),
    new THREE.Vector2(r * 0.95, r * 0.12),
    new THREE.Vector2(r * 0.55, r * 0.42),
    new THREE.Vector2(0, r * 0.42),
  ];
  const g = new THREE.LatheGeometry(pts, 10).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

const H = Math.PI / 2;

function candy(b: Builder, rnd: Rnd) {
  b.add(sphere(0.14), pick(PASTEL, rnd), [0, 0, 0], [0, 0, 0], [1.25, 1, 1]);
  for (const s of [-1, 1]) b.add(cone(0.09, 0.14), '#ffffff', [s * 0.22, 0, 0], [0, 0, s * H]);
}

function choco(b: Builder, rnd: Rnd) {
  b.add(box(0.36, 0.12, 0.24), '#6b3f2a');
  b.add(box(0.16, 0.125, 0.245), pick(['#e8443a', '#2f7de1', '#f2b632'], rnd));
}

function stick(b: Builder, rnd: Rnd) {
  b.add(cyl(0.055, 0.055, 0.62), '#d9a066', [0, 0, 0], [0, 0, H]);
  b.add(cyl(0.06, 0.06, 0.44), pick(['#5a3320', '#ff8fb1', '#a8e6a1'], rnd), [0.09, 0, 0], [0, 0, H]);
}

function smallBox(b: Builder, rnd: Rnd) {
  b.add(box(0.34, 0.28, 0.34), pick(PASTEL, rnd));
  b.add(box(0.06, 0.285, 0.345), '#ffffff', [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
  b.add(box(0.345, 0.285, 0.06), '#ffffff', [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
}

function gemSmall(b: Builder, rnd: Rnd) {
  b.add(gemGeometry(0.13), pick(GEM_COLORS, rnd));
}

function bear(b: Builder, color = '#c98a55', ears = true) {
  const light = '#f3d7b5', dark = '#2b1d1d';
  b.add(sphere(0.34, 24, 16), color, [0, 0.34, 0], [0, 0, 0], [1, 1.1, 0.9]);
  b.add(sphere(0.28, 24, 16), color, [0, 0.86, 0]);
  for (const x of [-1, 1]) {
    if (ears) b.add(sphere(0.1), color, [x * 0.2, 1.08, 0]);
    b.add(sphere(0.12), color, [x * 0.36, 0.45, 0.06], [0, 0, 0], [1, 1.4, 1]);
    b.add(sphere(0.13), color, [x * 0.18, 0.08, 0.16]);
    b.add(sphere(0.035, 8, 6), dark, [x * 0.1, 0.92, 0.25], [0, 0, 0], [1, 1, 1], false);
  }
  b.add(sphere(0.11), light, [0, 0.8, 0.24], [0, 0, 0], [1.2, 0.9, 0.8]);
  b.add(sphere(0.035, 8, 6), dark, [0, 0.84, 0.33], [0, 0, 0], [1, 1, 1], false);
  b.add(sphere(0.2), light, [0, 0.34, 0.24], [0, 0, 0], [1, 1.1, 0.5]);
}

function rabbit(b: Builder) {
  bear(b, '#f6f1ee', false);
  for (const x of [-1, 1]) {
    b.add(capsule(0.07, 0.36), '#f6f1ee', [x * 0.11, 1.28, 0], [0, 0, -x * 0.15]);
    b.add(capsule(0.035, 0.3), '#ffadc6', [x * 0.11, 1.28, 0.05], [0, 0, -x * 0.15], [1, 1, 1], false);
  }
}

function car(b: Builder, body: string, cabin: string, truck: boolean) {
  const len = truck ? 1.15 : 1.0;
  b.add(box(len, 0.24, 0.5), body, [0, 0.24, 0]);
  b.add(box(truck ? 0.36 : 0.5, 0.2, 0.44), cabin, [truck ? 0.36 : -0.05, 0.46, 0]);
  for (const x of [-len * 0.32, len * 0.32]) {
    for (const z of [-0.26, 0.26]) {
      b.add(cyl(0.13, 0.13, 0.09, 20), '#222228', [x, 0.13, z], [H, 0, 0]);
      b.add(cyl(0.06, 0.06, 0.1, 12), '#d8d8e0', [x, 0.13, z], [H, 0, 0], [1, 1, 1], false);
    }
  }
  if (truck) {
    for (const z of [-0.12, 0.12]) b.add(box(0.8, 0.04, 0.04), '#e6e6ea', [-0.12, 0.42, z]);
    for (let i = 0; i < 6; i++) b.add(box(0.03, 0.03, 0.24), '#e6e6ea', [-0.45 + i * 0.13, 0.42, 0], [0, 0, 0], [1, 1, 1], false);
    b.add(box(0.1, 0.06, 0.2), '#4fa8ff', [0.36, 0.59, 0]);
  } else {
    b.add(box(0.08, 0.04, 0.5), body, [-0.46, 0.44, 0]);
    for (const z of [-0.2, 0.2]) b.add(box(0.02, 0.1, 0.03), body, [-0.46, 0.38, z]);
  }
}

function trex(b: Builder) {
  const m = '#6cc46a', belly = '#d9f2a6';
  b.add(sphere(0.3), m, [0, 0.5, 0], [0, 0, 0], [1.3, 1, 0.9]);
  b.add(box(0.42, 0.26, 0.3), m, [0.42, 0.88, 0]);
  b.add(box(0.34, 0.08, 0.26), belly, [0.44, 0.72, 0]);
  b.add(cone(0.2, 0.7), m, [-0.6, 0.42, 0], [0, 0, H + 0.25]);
  b.add(sphere(0.2), belly, [0.12, 0.45, 0], [0, H, 0], [1, 1.1, 0.5]);
  for (const z of [-1, 1]) {
    b.add(capsule(0.09, 0.22), m, [-0.05, 0.16, z * 0.18]);
    b.add(capsule(0.035, 0.1), m, [0.3, 0.56, z * 0.16], [0, 0, 1.0]);
    b.add(sphere(0.035, 8, 6), '#1e1e1e', [0.5, 0.96, z * 0.15], [0, 0, 0], [1, 1, 1], false);
  }
}

function ring(b: Builder, gemColor: string) {
  b.add(torus(0.34, 0.06, 48, 16), '#f2c14e', [0, 0.4, 0]);
  b.add(cyl(0.14, 0.08, 0.1), '#f2c14e', [0, 0.78, 0]);
  b.add(gemGeometry(0.24), gemColor, [0, 1.02, 0]);
}

function lollipop(b: Builder) {
  const colors = ['#ff6f9f', '#ffffff', '#ffd36e', '#ffffff', '#8fd3ff', '#ffffff'];
  colors.forEach((c, i) => b.add(torus(0.44 - i * 0.07, 0.045, 40, 10), c, [0, 1.0, 0], [0, 0, 0], [1, 1, 1], i === 0));
  b.add(cyl(0.06, 0.06, 0.09), '#ff6f9f', [0, 1.0, 0], [H, 0, 0], [1, 1, 1], false);
  b.add(cyl(0.46, 0.46, 0.06, 40), '#ffe3ee', [0, 1.0, -0.03], [H, 0, 0], [1, 1, 1], false);
  b.add(cyl(0.035, 0.035, 0.6, 12), '#fafafa', [0, 0.3, 0]);
}

export const CODE_SHAPES: Record<string, (b: Builder, rnd: Rnd) => void> = {
  candy,
  choco,
  stick,
  smallBox,
  gemSmall,
  bear: (b) => bear(b),
  rabbit: (b) => rabbit(b),
  sportsCar: (b) => car(b, '#ffcf3a', '#7fd0ff', false),
  fireTruck: (b) => car(b, '#e8382f', '#e8382f', true),
  trex: (b) => trex(b),
  rubyRing: (b) => ring(b, '#ff2050'),
  sapphireRing: (b) => ring(b, '#2a6bff'),
  lollipop: (b) => lollipop(b),
};

export function buildCodeParts(kind: string, rnd: Rnd): Part[] {
  const b = new Builder();
  CODE_SHAPES[kind](b, rnd);
  return b.parts;
}
