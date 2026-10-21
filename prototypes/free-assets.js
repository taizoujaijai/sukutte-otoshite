// CC0のフリー素材（Poly Pizza で配布されている glTF）の候補と、トゥーン調への変換。
// ライセンスはすべて各モデルのページで「CC0 1.0」と確認したもの（2026-10-20 時点）。
import * as THREE from 'three';
import { getToonGradient } from './prizes.js?v=2';

const GLB = (uuid) => `https://static.poly.pizza/${uuid}.glb`;
const PAGE = (id) => `https://poly.pizza/m/${id}`;

// code: 比べるコード製の景品（prizes.js の種類）
export const CATEGORIES = [
  {
    key: 'candy', name: '飴・キャンディ', code: ['candy', 'lollipop'],
    assets: [
      { name: 'Lollypop', author: 'Kenney', id: 'jXrEZJHt5V', uuid: '36f4eb32-1fc5-47cf-9953-7894a1eb52e4' },
    ],
  },
  {
    key: 'choco', name: 'チョコ', code: ['choco', 'chocoBar'],
    assets: [
      { name: 'Chocolate Bar', author: 'Quaternius', id: 'vJsJ1EIiOO', uuid: 'c2fe4825-1aed-430d-8925-4541a98d70f8' },
      { name: 'Chocolate Wrapper', author: 'Kenney', id: '7IPEo5wlOx', uuid: '5ed4ce9f-97ad-4c38-809f-0bd14b6a3519' },
    ],
  },
  {
    key: 'sweets', name: '新しいお菓子の候補', code: [],
    note: 'コード製にはない種類です。普通の景品を増やすときの候補です。',
    assets: [
      { name: 'Donut Sprinkles', author: 'Kenney', id: 'RnPNAFyKtY', uuid: '569364fd-8397-4e26-9ff5-2c4909fc6e27' },
      { name: 'Cupcake', author: 'Quaternius', id: 'XL70IUDIrZ', uuid: '8df5d1ad-dd86-43e9-b03c-3e53398f892c' },
      { name: 'Ice Cream', author: 'Kenney', id: 'oaDwxwtjij', uuid: '74979311-8a4a-4b1b-ba1e-b8b049cd11ea' },
    ],
  },
  {
    key: 'box', name: '小箱', code: ['smallBox'],
    assets: [
      { name: 'Present', author: 'CreativeTrio', id: 'LVg3ynJDxa', uuid: 'f040ce00-f0fb-4789-8035-e47db0e1cd1c' },
    ],
  },
  {
    key: 'gem', name: '宝石', code: ['gemSmall', 'gemLarge'],
    assets: [
      { name: 'Gem Pink', author: 'Quaternius', id: 'PJnKvWluqs', uuid: '97fcdb07-9d4d-46f2-8c17-392bb61915e6' },
      { name: 'Gem Blue', author: 'Quaternius', id: 'QgQ4rESqNc', uuid: '60566587-6940-4642-9feb-44a023791fda' },
      { name: 'Crystal', author: 'iPoly3D', id: 'dxCmHfpqc5', uuid: '8f589a88-1828-4af2-9732-eefde999610f' },
    ],
  },
  {
    key: 'ring', name: '指輪', code: ['rubyRing', 'sapphireRing'],
    assets: [
      { name: 'Blood Ring', author: 'Quaternius', id: 'xs1ULyDMUb', uuid: '8cd7b079-94c3-48de-9965-7e0848db5d8b' },
    ],
  },
  {
    key: 'animal', name: '動物マスコット', code: ['bear', 'rabbit'],
    note: 'クマのCC0素材は見つかりませんでした。Quaternius の Rabbit は、ウサギの着ぐるみを着た子どもの人形です。',
    assets: [
      { name: 'Rabbit', author: 'Quaternius', id: 'mKev485XTR', uuid: '0f6aa24f-b37e-4b75-aeec-5e7d71319f7d' },
      { name: 'Rabbit Blond', author: 'Quaternius', id: 'cMsI6FDhNx', uuid: '95941440-97ad-4457-ab4a-d17f21d7c03c' },
      { name: 'Rubber Duck', author: 'CreativeTrio', id: 'oH3dEdlDpB', uuid: '170c4be8-2462-4aa5-902f-5697b56a2fcd' },
    ],
  },
  {
    key: 'car', name: '車のおもちゃ', code: ['sportsCar', 'fireTruck'],
    note: '消防車のCC0素材は見つからず、パトカーを代わりに並べています。',
    assets: [
      { name: 'Sports Car', author: 'Quaternius', id: '1mkmFkAz5v', uuid: '34db1344-31cc-49ac-bc46-c055f68e39ca' },
      { name: 'Taxi', author: 'Kay Lousberg', id: 'u5PhZQ35XG', uuid: 'f3892479-91f2-4407-939e-f169c51467a3' },
      { name: 'Police Car', author: 'Quaternius', id: 'BwwnUrWGmV', uuid: '179e43ce-b9e0-40cf-8b99-641693d3207e' },
    ],
  },
  {
    key: 'dino', name: '恐竜マスコット', code: ['trex', 'triceratops'],
    assets: [
      { name: 'T-Rex', author: 'Quaternius', id: 'UYtneO5FpF', uuid: '34eed102-48f0-43dd-bc6f-ef7a6dfddfbb' },
      { name: 'Triceratops', author: 'Quaternius', id: 'IGvrUqGrRM', uuid: '6aa1f3ff-b9b3-4bb5-9d85-b2ffa514f0cc' },
      { name: 'Cute Red Dino', author: 'Exceptional_3D', id: 'WAkBnE6ydO', uuid: '26637805-ce66-4fb7-ac0a-2e6b92b21974' },
    ],
  },
].map((c) => ({ ...c, assets: c.assets.map((a) => ({ ...a, url: GLB(a.uuid), page: PAGE(a.id), license: 'CC0 1.0' })) }));

// 輪郭線用の材質。頂点を法線方向に押し出して裏面を描く（骨入りのモデルでも形に沿う）
function outlineMaterial(thickness) {
  const m = new THREE.MeshBasicMaterial({ color: '#3a2a3a', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float outlineThickness;')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normalize(normal) * outlineThickness;');
  };
  return m;
}

// 読み込んだモデルの材質をトゥーン用に置き換え、輪郭線を付ける。
// worldThickness は大きさをそろえたあとの見た目での太さ。モデルごとの縮尺の違いは、ここで打ち消す
export function toonify(root, worldThickness) {
  const targets = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh) targets.push(o); });
  const ws = new THREE.Vector3();
  for (const o of targets) {
    o.getWorldScale(ws);
    const thickness = worldThickness / Math.max(ws.x, ws.y, ws.z, 1e-6);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const toon = mats.map((m) => Object.assign(new THREE.MeshToonMaterial({
      color: m.color ? m.color.clone() : new THREE.Color('#ffffff'),
      map: m.map || null,
      vertexColors: !!o.geometry.attributes.color,
      gradientMap: getToonGradient(),
      transparent: m.transparent,
      opacity: m.opacity,
    }), { userData: { baseColor: m.color ? m.color.clone() : new THREE.Color('#ffffff') } }));
    o.userData.originalMaterial = o.material;
    o.material = Array.isArray(o.material) ? toon : toon[0];
    o.castShadow = o.receiveShadow = true;

    let line;
    if (o.isSkinnedMesh) {
      line = new THREE.SkinnedMesh(o.geometry, outlineMaterial(thickness));
      line.bind(o.skeleton, o.bindMatrix);
    } else {
      line = new THREE.Mesh(o.geometry, outlineMaterial(thickness));
    }
    line.userData.isOutline = true;
    line.castShadow = false;
    o.add(line);
  }
}

// トゥーン化の切り替え（元の材質に戻す／トゥーンに戻す）
export function setToon(root, on) {
  root.traverse((o) => {
    if (o.userData.isOutline) o.visible = on;
    if (o.isMesh && o.userData.originalMaterial && !o.userData.isOutline) {
      if (!o.userData.toonMaterial) o.userData.toonMaterial = o.material;
      o.material = on ? o.userData.toonMaterial : o.userData.originalMaterial;
    }
  });
}

// 色をパステル寄りにする（白に近づけて彩度を少し上げる）。コード製の景品の色合いにそろえる
export function setPastel(root, on) {
  const hsl = {};
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || !o.userData.toonMaterial) return;
    for (const m of [].concat(o.userData.toonMaterial)) {
      const base = m.userData.baseColor;
      if (!base) continue;
      if (!on) { m.color.copy(base); continue; }
      base.getHSL(hsl);
      m.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.1), 0.55 + hsl.l * 0.4);
    }
  });
}
