// 景品をまとめて描く（インスタンス描画）。同じ形・同じ色違いの景品は1回の描画で済ませる。
import * as THREE from 'three';
import { Template, prizeMaterial, outlineMaterial } from './catalog';

interface Pool { body: THREE.InstancedMesh; outline: THREE.InstancedMesh | null; count: number }

const CAPACITY = 256;

export class Instancer {
  private pools = new Map<Template, Pool>();
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();

  constructor(private scene: THREE.Scene) {}

  private pool(t: Template) {
    let p = this.pools.get(t);
    if (!p) {
      const body = new THREE.InstancedMesh(t.body, prizeMaterial, CAPACITY);
      body.castShadow = true;
      body.receiveShadow = true;
      body.frustumCulled = false;
      body.count = 0;
      this.scene.add(body);
      let outline: THREE.InstancedMesh | null = null;
      if (t.outline) {
        outline = new THREE.InstancedMesh(t.outline, outlineMaterial, CAPACITY);
        outline.frustumCulled = false;
        outline.count = 0;
        this.scene.add(outline);
      }
      p = { body, outline, count: 0 };
      this.pools.set(t, p);
    }
    return p;
  }

  begin() {
    for (const p of this.pools.values()) p.count = 0;
  }

  add(t: Template, pos: THREE.Vector3 | { x: number; y: number; z: number }, quat: THREE.Quaternion | { x: number; y: number; z: number; w: number }, scale: number) {
    const p = this.pool(t);
    if (p.count >= CAPACITY) return;
    this.s.setScalar(scale);
    // Rapier の値は Three.js の型ではないので、詰め直してから使う
    this.p.set(pos.x, pos.y, pos.z);
    this.q.set(quat.x, quat.y, quat.z, quat.w);
    this.m.compose(this.p, this.q, this.s);
    p.body.setMatrixAt(p.count, this.m);
    p.outline?.setMatrixAt(p.count, this.m);
    p.count++;
  }

  end() {
    for (const p of this.pools.values()) {
      p.body.count = p.count;
      p.body.instanceMatrix.needsUpdate = true;
      if (p.outline) {
        p.outline.count = p.count;
        p.outline.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
