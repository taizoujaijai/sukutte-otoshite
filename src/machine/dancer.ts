// 中央の島の上で踊るキャラクター（お菓子の妖精）。BGM の拍に合わせて跳ねて、手足を振る。
import * as THREE from 'three';
import { toon, addOutline } from './visual';

const BEAT = 60 / 112; // BGM の1拍の秒数

export interface Dancer {
  group: THREE.Group;
  update(t: number): void;
}

export function buildDancer(): Dancer {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const part = (geo: THREE.BufferGeometry, color: string, parent: THREE.Object3D, pos: [number, number, number], outline = true) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(...pos);
    m.castShadow = true;
    if (outline) addOutline(m, 0.025);
    parent.add(m);
    return m;
  };

  // 体と頭（まるいお菓子のイメージ）
  const body = part(new THREE.SphereGeometry(0.46, 24, 16), '#ffd36e', bodyPivot, [0, 0.72, 0]);
  body.scale.set(1, 0.95, 0.9);
  const head = new THREE.Group();
  head.position.y = 1.32;
  bodyPivot.add(head);
  part(new THREE.SphereGeometry(0.48, 28, 20), '#fff1d6', head, [0, 0, 0]);
  // 顔（どの席からも見えるよう、前後に同じ顔を付ける）
  for (const side of [1, -1]) {
    const face = new THREE.Group();
    face.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
    head.add(face);
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.055, 12, 10), '#3a2a3a', face, [s * 0.17, 0.05, 0.44], false);
      const cheek = part(new THREE.SphereGeometry(0.075, 12, 10), '#ff9cc0', face, [s * 0.29, -0.09, 0.37], false);
      cheek.scale.z = 0.4;
    }
    const mouth = part(new THREE.TorusGeometry(0.08, 0.018, 8, 16, Math.PI), '#3a2a3a', face, [0, -0.07, 0.46], false);
    mouth.rotation.z = Math.PI;
  }
  // 頭のペロペロキャンディ
  part(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), '#ffffff', head, [0, 0.58, 0]);
  const swirl = ['#ff6f9f', '#ffffff', '#8fd3ff', '#ffffff'];
  swirl.forEach((c, i) => {
    const r = 0.27 - i * 0.065;
    const t = part(new THREE.CylinderGeometry(r, r, 0.08 + i * 0.012, 28), c, head, [0, 0.88, 0], i === 0);
    t.rotation.x = Math.PI / 2;
  });

  // 腕と脚（付け根で回すので、付け根を原点にしたグループに入れる）
  const limb = (color: string, x: number, y: number, len: number, r: number) => {
    const g = new THREE.Group();
    g.position.set(0, y, x);
    bodyPivot.add(g);
    part(new THREE.CapsuleGeometry(r, len, 4, 10), color, g, [0, -len / 2 - r, 0]);
    return g;
  };
  const armL = limb('#fff1d6', 0.46, 0.9, 0.3, 0.09);
  const armR = limb('#fff1d6', -0.46, 0.9, 0.3, 0.09);
  const legL = limb('#ff9cc0', 0.2, 0.42, 0.14, 0.12);
  const legR = limb('#ff9cc0', -0.2, 0.42, 0.14, 0.12);

  return {
    group,
    update(t: number) {
      const b = (t / BEAT) * Math.PI; // 1拍で半周
      group.rotation.y = t * 0.5;     // どの席からも見えるよう、ゆっくり回る
      bodyPivot.position.y = Math.abs(Math.sin(b)) * 0.28;
      bodyPivot.rotation.x = Math.sin(b) * 0.14;
      head.rotation.x = Math.sin(b + 0.6) * 0.16;
      armL.rotation.x = -2.2 + Math.sin(b) * 0.7;
      armR.rotation.x = 2.2 + Math.sin(b) * 0.7;
      legL.rotation.x = Math.max(0, Math.sin(b)) * -0.7;
      legR.rotation.x = Math.max(0, -Math.sin(b)) * 0.7;
    },
  };
}
