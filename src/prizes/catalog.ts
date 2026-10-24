// 景品の一覧と、見た目（トゥーン調のメッシュ）の作り方。
// 描画を軽くするため、1つの景品は「頂点カラーの1メッシュ＋輪郭線の1メッシュ」にまとめる。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildCodeParts, Part } from './shapes';
import { seeded } from '../util';

import triceratopsUrl from '../../assets/models/triceratops.glb?url';
import chocoBarUrl from '../../assets/models/chocolate-bar.glb?url';
import donutUrl from '../../assets/models/donut-sprinkles.glb?url';
import presentUrl from '../../assets/models/present.glb?url';
import gemPinkUrl from '../../assets/models/gem-pink.glb?url';
import gemBlueUrl from '../../assets/models/gem-blue.glb?url';

export interface PrizeDef {
  key: string;
  name: string;
  volume: number;       // 宝箱を埋める量（かさ）
  mass: number;
  big: boolean;
  genre?: string;
  size: number;         // 見た目の大きさ（いちばん長い辺）。フリー素材はこの大きさにそろえる
  glb?: string[];       // フリー素材（色違いがあれば複数）
  // 物理の形。計算を軽くするため、小さな景品は球の組み合わせにする（[x, y, z, 半径]）。省略すると箱
  spheres?: [number, number, number, number][];
  corners?: boolean;    // 箱の形を、角に置いた8個の球で近似する（積み上げられて、計算も軽い）
}

export const PRIZES: PrizeDef[] = [
  { key: 'candy', name: '飴', volume: 1, mass: 0.5, big: false, size: 0.4, spheres: [[0, 0, 0, 0.14]] },
  { key: 'choco', name: 'チョコ', volume: 1.5, mass: 1, big: false, size: 0.36, spheres: [[-0.11, 0, -0.05, 0.065], [0.11, 0, -0.05, 0.065], [-0.11, 0, 0.05, 0.065], [0.11, 0, 0.05, 0.065]] },
  { key: 'stick', name: 'スティック菓子', volume: 1.5, mass: 0.6, big: false, size: 0.62, spheres: [[-0.24, 0, 0, 0.06], [-0.08, 0, 0, 0.06], [0.08, 0, 0, 0.06], [0.24, 0, 0, 0.06]] },
  { key: 'smallBox', name: '小箱', volume: 3, mass: 1.6, big: false, size: 0.35, corners: true },
  { key: 'donut', name: 'ドーナツ', volume: 1.5, mass: 1, big: false, size: 0.42, glb: [donutUrl], spheres: [[0.13, 0, 0, 0.075], [-0.13, 0, 0, 0.075], [0, 0, 0.13, 0.075], [0, 0, -0.13, 0.075]] },
  { key: 'present', name: 'プレゼント', volume: 4, mass: 1.8, big: false, size: 0.46, glb: [presentUrl], corners: true },
  { key: 'gemSmall', name: '宝石（小）', volume: 1, mass: 1, big: false, size: 0.27, spheres: [[0, 0, 0, 0.12]] },
  { key: 'gemLarge', name: '宝石（大）', volume: 4, mass: 2.2, big: false, size: 0.55, glb: [gemPinkUrl, gemBlueUrl], spheres: [[0, 0, 0, 0.23]] },
  { key: 'bear', name: 'クマ', genre: '動物マスコット', volume: 20, mass: 8, big: true, size: 1.2 },
  { key: 'rabbit', name: 'ウサギ', genre: '動物マスコット', volume: 20, mass: 8, big: true, size: 1.4 },
  { key: 'sportsCar', name: 'スポーツカー', genre: '車のおもちゃ', volume: 16, mass: 7, big: true, size: 1.0 },
  { key: 'fireTruck', name: '消防車', genre: '車のおもちゃ', volume: 18, mass: 8, big: true, size: 1.15 },
  { key: 'trex', name: 'ティラノサウルス', genre: '恐竜マスコット', volume: 20, mass: 8, big: true, size: 1.3 },
  { key: 'triceratops', name: 'トリケラトプス', genre: '恐竜マスコット', volume: 20, mass: 8, big: true, size: 1.3, glb: [triceratopsUrl] },
  { key: 'rubyRing', name: 'ルビーの指輪', genre: '大きい宝石がついた指輪', volume: 10, mass: 5, big: true, size: 1.1 },
  { key: 'sapphireRing', name: 'サファイアの指輪', genre: '大きい宝石がついた指輪', volume: 10, mass: 5, big: true, size: 1.1 },
  { key: 'lollipop', name: '巨大ペロペロキャンディ', genre: '大きいお菓子', volume: 14, mass: 6, big: true, size: 1.3 },
  { key: 'chocoBar', name: '巨大板チョコ', genre: '大きいお菓子', volume: 14, mass: 6, big: true, size: 1.1, glb: [chocoBarUrl] },
];

// 普通の景品は、台の大きさに比べて見栄えがするよう少し大きめに作る
export const NORMAL_SCALE = 1.5;
export const scaleOf = (def: PrizeDef) => (def.big ? 1 : NORMAL_SCALE);

export const PRIZE: Record<string, PrizeDef> = Object.fromEntries(PRIZES.map((p) => [p.key, p]));
export const BIG_KEYS = PRIZES.filter((p) => p.big).map((p) => p.key);

// 川に流す普通の景品の割合（仕様書7章）
const RIVER_MIX: [string, number][] = [
  ['candy', 25], ['choco', 20], ['stick', 15], ['smallBox', 12], ['donut', 10], ['present', 10], ['gemSmall', 7], ['gemLarge', 1],
];
export function randomNormalKey(rnd: () => number) {
  let r = rnd() * 100;
  for (const [k, w] of RIVER_MIX) {
    if ((r -= w) < 0) return k;
  }
  return 'candy';
}

// ---- 材質 ----
let gradient: THREE.DataTexture;
export function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}
export const prizeMaterial = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
export const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#3a2a3a', side: THREE.BackSide });

// ---- 部品を1つのメッシュにまとめる ----
function partGeometry(p: Part, outlineT: number | null) {
  const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  g.applyMatrix4(p.matrix);
  if (outlineT !== null) {
    // 輪郭線：部品ごとに、その部品の中心から少し太らせる（大きさをそろえたあとの座標で計算する）
    g.computeBoundingSphere();
    const r = g.boundingSphere.radius || 1;
    const c = g.boundingSphere.center.clone();
    const s = 1 + Math.min(outlineT / r, 0.25); // 小さな部品が太りすぎないように
    g.translate(-c.x, -c.y, -c.z);
    g.scale(s, s, s);
    g.translate(c.x, c.y, c.z);
  } else {
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = p.color.r; col[i * 3 + 1] = p.color.g; col[i * 3 + 2] = p.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return g;
}

export interface Template {
  body: THREE.BufferGeometry;
  outline: THREE.BufferGeometry | null;
  skinned?: THREE.Object3D;   // 骨入りのモデル（そのまま複製して使う）
  half: THREE.Vector3;        // 物理の箱の半分の大きさ
  radius: number;
}

function templateFromParts(parts: Part[], outlineT: number): Template {
  const body = mergeGeometries(parts.map((p) => partGeometry(p, null)));
  const outlineParts = parts.filter((p) => p.outline);
  const outline = outlineParts.length ? mergeGeometries(outlineParts.map((p) => partGeometry(p, outlineT))) : null;
  // 中心を原点に合わせる
  body.computeBoundingBox();
  const c = body.boundingBox.getCenter(new THREE.Vector3());
  body.translate(-c.x, -c.y, -c.z);
  outline?.translate(-c.x, -c.y, -c.z);
  body.computeBoundingBox();
  body.computeBoundingSphere();
  const half = body.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return { body, outline, half, radius: body.boundingSphere.radius };
}

// パステル寄りの色にする（試作4で決定）
function pastel(c: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.1), 0.55 + hsl.l * 0.4);
}

// フリー素材を部品に分解する（材質の色を頂点カラーにし、パステル寄りにする）
function partsFromGltf(root: THREE.Object3D, size: number): Part[] {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const k = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const scale = new THREE.Matrix4().makeScale(k, k, k);
  const parts: Part[] = [];
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material);
    const geo = o.geometry as THREE.BufferGeometry;
    const m = new THREE.Matrix4().multiplyMatrices(scale, o.matrixWorld);
    if (geo.groups.length > 1 && mats.length > 1) {
      for (const gr of geo.groups) {
        const sub = new THREE.BufferGeometry();
        const src = geo.index ? geo.toNonIndexed() : geo;
        for (const name of ['position', 'normal']) {
          const a = src.getAttribute(name);
          sub.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(gr.start * 3, (gr.start + gr.count) * 3), 3));
        }
        parts.push({ geo: sub, color: pastel(mats[gr.materialIndex].color), matrix: m, outline: true });
      }
    } else {
      parts.push({ geo, color: pastel(mats[0].color ?? new THREE.Color('#fff')), matrix: m, outline: true });
    }
  });
  return parts;
}

// 骨入りのモデル（トリケラトプス）はまとめずに、材質だけトゥーンに置き換える
function toonifySkinned(root: THREE.Object3D, size: number, outlineWorld: number): Template {
  const holder = new THREE.Group();
  holder.add(root);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder, true);
  const k = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  holder.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(holder, true);
  const c = box2.getCenter(new THREE.Vector3());
  root.position.sub(c.clone().divideScalar(k));
  holder.updateMatrixWorld(true);
  const ws = new THREE.Vector3();
  const meshes: any[] = [];
  holder.traverse((o: any) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const color = pastel([].concat(o.material)[0].color);
    o.material = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    o.castShadow = true;
    o.getWorldScale(ws);
    const t = outlineWorld / Math.max(ws.x, 1e-6);
    const mat = new THREE.MeshBasicMaterial({ color: '#3a2a3a', side: THREE.BackSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normalize(normal) * ${t.toFixed(6)};`);
    };
    const line = new THREE.SkinnedMesh(o.geometry, mat);
    line.bind(o.skeleton, o.bindMatrix);
    o.add(line);
  }
  const half = box2.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return { body: null, outline: null, skinned: holder, half, radius: half.length() };
}

// 埋め込んだモデル（data: URL）を、fetch を使わずに ArrayBuffer にする。
// Artifact では fetch が制限されているため
function dataUrlToBuffer(url: string): ArrayBuffer {
  const comma = url.indexOf(',');
  const bin = atob(url.slice(comma + 1));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ---- テンプレート（種類×色違い）を用意する ----
const templates: Record<string, Template[]> = {};
const VARIANTS = 4;

export async function loadPrizes() {
  const loader = new GLTFLoader();
  for (const def of PRIZES) {
    const outlineT = def.big ? 0.03 : 0.014;
    if (def.glb) {
      templates[def.key] = [];
      for (const url of def.glb) {
        // ビルド後は埋め込み（data: URL）、開発サーバーでは普通のファイルとして渡される
        const buf = url.startsWith('data:') ? dataUrlToBuffer(url) : await (await fetch(url)).arrayBuffer();
        const gltf = await loader.parseAsync(buf, '');
        let skinned = false;
        gltf.scene.traverse((o: any) => { if (o.isSkinnedMesh) skinned = true; });
        templates[def.key].push(skinned
          ? toonifySkinned(gltf.scene, def.size * scaleOf(def), outlineT)
          : templateFromParts(partsFromGltf(gltf.scene, def.size * scaleOf(def)), outlineT));
      }
    } else {
      templates[def.key] = [];
      const n = def.big ? 1 : VARIANTS;
      const k = scaleOf(def);
      const sm = new THREE.Matrix4().makeScale(k, k, k);
      for (let v = 0; v < n; v++) {
        const parts = buildCodeParts(def.key, seeded(v * 7 + 3));
        for (const p of parts) p.matrix.premultiply(sm);
        templates[def.key].push(templateFromParts(parts, outlineT));
      }
    }
  }
}

export function getTemplate(key: string, variant: number) {
  const list = templates[key];
  return list[variant % list.length];
}

// 景品の見た目を1つ作る。scale は川に流す大物を縮めるときに使う
export function makePrizeObject(key: string, variant: number, scale = 1) {
  const t = getTemplate(key, variant);
  let obj: THREE.Object3D;
  if (t.skinned) {
    obj = SkeletonUtils.clone(t.skinned);
  } else {
    obj = new THREE.Group();
    const m = new THREE.Mesh(t.body, prizeMaterial);
    m.castShadow = true;
    m.receiveShadow = true;
    obj.add(m);
    if (t.outline) obj.add(new THREE.Mesh(t.outline, outlineMaterial));
  }
  obj.scale.multiplyScalar(scale);
  return { obj, half: t.half.clone().multiplyScalar(scale), radius: t.radius * scale };
}
