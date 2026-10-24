// 物理演算（Rapier）。筐体の当たり判定、景品、川の流れ、上段とショベルの動き。
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { M, MOTION, PHYSICS, SHOVEL_SCALE } from './config';
import { octFactor } from './machine/visual';
import { PRIZE, getTemplate, Template, scaleOf } from './prizes/catalog';
import { Instancer } from './prizes/instancer';
import { seatToWorld, worldToSeat } from './util';

export async function initPhysics() {
  await RAPIER.init();
}

export interface Prize {
  id: number;
  key: string;
  variant: number;
  scale: number;
  body: RAPIER.RigidBody;
  template: Template;
  obj: THREE.Object3D | null;   // 骨入りのモデルだけ個別に描く
}

const FRICTION = { prize: 0.45, stage: 0.35, shovel: 0.6, river: 0.8 };

const seatQuat = (i: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -i * Math.PI / 2, 0));
const q = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

export class Physics {
  world: RAPIER.World;
  prizes: Prize[] = [];
  uppers: RAPIER.RigidBody[] = [];
  shovels: RAPIER.RigidBody[] = [];
  // 物理で上段を動かす席。遊んでいない席の上段は見た目だけ動かし、景品は眠らせて計算を省く
  activeSeat = -1;
  onSlot: (seat: number, p: Prize) => void = () => {};
  onLost: (p: Prize) => void = () => {};
  private nextId = 1;
  private stepCount = 0;
  private instancer: Instancer;
  private shovelPose: { pos: THREE.Vector3; rot: THREE.Quaternion }[] = [];
  // ショベルに固定して運んでいる景品（ショベルから見た位置と向き）
  private carried: { p: Prize; pos: THREE.Vector3; rot: THREE.Quaternion }[][] = [[], [], [], []];
  private fixed: RAPIER.RigidBody;

  constructor(private scene: THREE.Scene) {
    this.instancer = new Instancer(scene);
    this.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.step;
    this.world.integrationParameters.numSolverIterations = PHYSICS.iterations;
    this.fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.buildStatic();
  }

  // 動かない箱を置く（世界座標）
  private box(half: [number, number, number], pos: [number, number, number], rot = new THREE.Quaternion(), friction = FRICTION.stage, slippery = false) {
    const d = RAPIER.ColliderDesc.cuboid(...half).setTranslation(...pos).setRotation(rot).setFriction(friction);
    if (slippery) d.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    this.world.createCollider(d, this.fixed);
  }

  // 席の座標で箱を置く
  private seatBox(i: number, half: [number, number, number], pos: [number, number, number]) {
    const [wx, wz] = seatToWorld(i, pos[0], pos[2]);
    this.box(half, [wx, pos[1], wz], seatQuat(i));
  }

  private buildStatic() {
    // 川の底：一定の速さで回る円盤。景品は摩擦で一緒に運ばれる
    const river = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(0, M.riverFloor - 0.5, 0).setAngvel({ x: 0, y: (Math.PI * 2) / MOTION.riverPeriod, z: 0 }),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.5, M.riverOut + 0.6).setFriction(FRICTION.river), river);
    // 中央の島
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, M.riverIn).setTranslation(0, M.riverFloor + 1.5, 0), this.fixed);

    // デッキの坂：8角形に並べた8枚の傾いた板（滑りやすい）。内側の端が川の縁の段差になる
    const r0 = M.riverOut, r1 = M.apothem + 0.3;
    const y0 = M.deckIn, y1 = M.deckOut + 0.02;
    const len = Math.hypot(r1 - r0, y1 - y0);
    const tilt = Math.atan2(y1 - y0, r1 - r0);
    const T = 0.3;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const rot = q(0, -a, 0).multiply(q(0, 0, tilt));
      const rm = (r0 + r1) / 2 + Math.sin(tilt) * T;
      const ym = (y0 + y1) / 2 - Math.cos(tilt) * T;
      const halfW = r1 * Math.tan(Math.PI / 8) + 0.05;
      this.box([len / 2, T, halfW], [Math.cos(a) * rm, ym, Math.sin(a) * rm], rot, 0, true);
    }

    // ドームの壁（8角形）と仕切り
    const side = 2 * 6.85 * Math.tan(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (k % 2 === 0) {
        // 席の正面：下段の手前は獲得口へ落ちる口なので、壁は下段より上だけにする
        const y0 = M.lowerTop + 1.3, y1 = M.domeTop;
        this.box([0.1, (y1 - y0) / 2, side / 2 + 0.1], [Math.cos(a) * 6.95, (y0 + y1) / 2, Math.sin(a) * 6.95], q(0, -a, 0));
      } else {
        this.box([0.1, 2.6, side / 2 + 0.1], [Math.cos(a) * 6.95, M.deckOut + 2, Math.sin(a) * 6.95], q(0, -a, 0));
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const len2 = M.apothem * octFactor(a) - 5.4;
      this.box([len2 / 2, 0.7, 0.03], [Math.cos(a) * (5.4 + len2 / 2), M.deckOut + 0.7, Math.sin(a) * (5.4 + len2 / 2)], q(0, -a, 0));
    }

    for (let i = 0; i < 4; i++) {
      // 下段と、上段の左右のガイド
      const lowerLen = M.lowerOut - M.lowerIn;
      this.seatBox(i, [lowerLen / 2, 0.2, M.stageW / 2], [(M.lowerIn + M.lowerOut) / 2, M.lowerTop - 0.2, 0]);
      const upperLen = M.upperOut - M.upperIn;
      for (const s of [-1, 1]) this.seatBox(i, [(upperLen + 1.2) / 2, 0.4, 0.03], [(M.upperIn + M.upperOut) / 2, M.upperTop + 0.4, s * (M.stageW / 2 + 0.03)]);
      // 上段の奥の固定の壁
      this.seatBox(i, [0.04, 0.22, M.stageW / 2], [M.sweeper, M.upperTop + 0.23, 0]);

      // 上段（前後に動く）
      const [ux, uz] = seatToWorld(i, (M.upperIn + M.upperOut) / 2, 0);
      const up = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(ux, M.upperTop - 0.225, uz).setRotation(seatQuat(i)));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(upperLen / 2, 0.225, M.stageW / 2 - 0.02).setFriction(FRICTION.stage), up);
      this.uppers.push(up);

      // ショベル（原点が手首。先端は +z、背面の壁は -z）
      const sh = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const D = 0.4;
      const S = SHOVEL_SCALE;
      const part = (hx: number, hy: number, hz: number, x: number, y: number, z: number, rx = 0, rz = 0) =>
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx * S, hy * S, hz * S).setTranslation(x * S, y * S, z * S).setRotation(q(rx, 0, rz)).setFriction(FRICTION.shovel), sh);
      part(0.35, 0.03, 0.5, 0, -D - 0.015, 0);
      part(0.21, 0.03, 0.5, -0.54, -D + 0.03, 0, 0, -0.2);
      part(0.21, 0.03, 0.5, 0.54, -D + 0.03, 0, 0, 0.2);
      part(0.75, 0.015, 0.09, 0, -D - 0.015, 0.58);
      part(0.75, 0.225, 0.025, 0, -D + 0.22, -0.52, 0.15, 0);
      this.shovels.push(sh);
    }
  }

  // 上段の目標位置（時刻 t）
  upperOffset(i: number, t: number) {
    return Math.sin((t * Math.PI * 2) / MOTION.pushPeriod + i * 1.3) * MOTION.pushAmp;
  }

  private shovelTarget(i: number, x: number, y: number, pitch: number) {
    const [wx, wz] = seatToWorld(i, x, 0);
    const t = { pos: new THREE.Vector3(wx, y, wz), rot: seatQuat(i).multiply(q(pitch, 0, 0)) };
    this.shovelPose[i] = t;
    return t;
  }

  // 刃の上にしっかり乗っている景品を、ショベルに固定する（手首を回し始めるとき）
  capture(i: number) {
    const sh = this.shovels[i];
    const t = sh.translation(), r = sh.rotation();
    const inv = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert();
    const S = SHOVEL_SCALE;
    const list = this.carried[i];
    for (const p of this.prizes) {
      if (PRIZE[p.key].big && p.scale >= 1) continue;
      const w = p.body.translation();
      const v = new THREE.Vector3(w.x - t.x, w.y - t.y, w.z - t.z).applyQuaternion(inv);
      // 刃の面のすぐ上（左右・前後は刃の範囲、高さは面から景品1つ分）にあるものだけ。端に引っかかっただけのものは除く
      // 刃を下ろした瞬間は先端がいちばん低いので、景品は先端のあたりにたまる。先端のすぐ前までを範囲に含める
      if (Math.abs(v.x) > 0.7 * S || v.z < -0.45 * S || v.z > 0.68 * S || v.y < -0.54 * S || v.y > 0.08 * S) continue;
      if (list.length >= 6) break;
      const pr = p.body.rotation();
      list.push({ p, pos: v, rot: inv.clone().multiply(new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w)) });
      p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    }
    return list.length;
  }

  // 固定を外す（「おとす」で手首を回し始めるとき、または運ぶ途中でこぼれるとき）
  release(i: number, which?: Prize) {
    const list = this.carried[i];
    for (let k = list.length - 1; k >= 0; k--) {
      const c = list[k];
      if (which && c.p !== which) continue;
      if (this.prizes.includes(c.p)) {
        c.p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        c.p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      list.splice(k, 1);
    }
  }

  carriedCount(i: number) {
    return this.carried[i].length;
  }

  // 運ぶ途中で、まれに1個こぼれる
  slipOne(i: number) {
    const list = this.carried[i];
    if (list.length) this.release(i, list[Math.floor(Math.random() * list.length)].p);
  }

  // ショベルをその場に置く（最初の1回だけ）
  placeShovel(i: number, x: number, y: number, pitch: number) {
    const t = this.shovelTarget(i, x, y, pitch);
    this.shovels[i].setTranslation(t.pos, false);
    this.shovels[i].setRotation(t.rot, false);
  }

  // 次のステップでの手首の位置と角度
  driveShovel(i: number, x: number, y: number, pitch: number) {
    const t = this.shovelTarget(i, x, y, pitch);
    this.shovels[i].setNextKinematicTranslation(t.pos);
    this.shovels[i].setNextKinematicRotation(t.rot);
  }

  driveUpper(i: number, t: number) {
    if (i !== this.activeSeat) return;
    const [wx, wz] = seatToWorld(i, (M.upperIn + M.upperOut) / 2 + this.upperOffset(i, t), 0);
    this.uppers[i].setNextKinematicTranslation({ x: wx, y: M.upperTop - 0.225, z: wz });
  }

  // 景品を置く
  addPrize(key: string, variant: number, pos: THREE.Vector3, opts: { scale?: number; yaw?: number; tilt?: boolean } = {}) {
    const scale = opts.scale ?? 1;
    const template = getTemplate(key, variant);
    const half = template.half.clone().multiplyScalar(scale);
    const def = PRIZE[key];
    const rot = q(opts.tilt ? (Math.random() - 0.5) * 0.6 : 0, opts.yaw ?? Math.random() * Math.PI * 2, opts.tilt ? (Math.random() - 0.5) * 0.6 : 0);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(rot).setLinearDamping(0.05).setAngularDamping(0.3),
    );
    const mass = def.mass * scale * scale * scale;
    let collider: RAPIER.ColliderDesc;
    if (def.spheres && def.spheres.length === 1) {
      collider = RAPIER.ColliderDesc.ball(def.spheres[0][3] * scaleOf(def) * scale);
    } else if (key === 'stick') {
      const cr = 0.06 * scaleOf(def) * scale;
      collider = RAPIER.ColliderDesc.capsule(Math.max(half.x - cr, 0.02), cr).setRotation(q(0, 0, Math.PI / 2));
    } else {
      collider = RAPIER.ColliderDesc.cuboid(Math.max(half.x * 0.95, 0.03), Math.max(half.y * 0.95, 0.03), Math.max(half.z * 0.95, 0.03));
    }
    this.world.createCollider(collider.setMass(mass).setFriction(FRICTION.prize).setRestitution(0.05), body);

    let obj: THREE.Object3D | null = null;
    if (template.skinned) {
      obj = SkeletonUtils.clone(template.skinned);
      obj.scale.multiplyScalar(scale);
      this.scene.add(obj);
    }
    const p: Prize = { id: this.nextId++, key, variant, scale, body, template, obj };
    this.prizes.push(p);
    return p;
  }

  removePrize(p: Prize) {
    this.world.removeRigidBody(p.body);
    if (p.obj) this.scene.remove(p.obj);
    const k = this.prizes.indexOf(p);
    if (k >= 0) this.prizes.splice(k, 1);
  }

  // 川にいる景品の数
  riverCount() {
    let n = 0;
    for (const p of this.prizes) {
      const b = p.body.translation();
      if (Math.hypot(b.x, b.z) < M.riverOut + 0.4 && b.y < M.lowerTop - 0.3) n++;
    }
    return n;
  }

  // 1ステップ進める
  step() {
    // 川に乗っている景品が眠ってしまうと流れなくなるので、ときどき起こす
    if (++this.stepCount % 20 === 0) {
      for (const p of this.prizes) {
        const pos = p.body.translation();
        if (pos.y < M.riverFloor + 0.9 && Math.hypot(pos.x, pos.z) < M.riverOut + 0.4 && p.body.isSleeping()) p.body.wakeUp();
      }
    }
    // 固定した景品をショベルと一緒に動かす
    for (let i = 0; i < 4; i++) {
      const pose = this.shovelPose[i];
      if (!pose) continue;
      for (const c of this.carried[i]) {
        c.p.body.setNextKinematicTranslation(c.pos.clone().applyQuaternion(pose.rot).add(pose.pos));
        c.p.body.setNextKinematicRotation(pose.rot.clone().multiply(c.rot));
      }
    }
    this.world.step();

    // 落ちた景品を調べる
    for (let k = this.prizes.length - 1; k >= 0; k--) {
      const p = this.prizes[k];
      const pos = p.body.translation();
      if (pos.y < 5 || Math.hypot(pos.x, pos.z) > 9.5) {
        this.onLost(p);
        this.removePrize(p);
        continue;
      }
      if (pos.y > M.lowerTop - 0.12) continue;
      const ang = Math.atan2(pos.z, pos.x);
      const i = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
      const [sx, sz] = worldToSeat(i, pos.x, pos.z);
      if (sx > M.lowerOut + 0.02 && Math.abs(sz) < M.stageW / 2 + 0.15) {
        this.onSlot(i, p);
        this.removePrize(p);
      }
    }
  }

  // 見た目を物理に合わせる
  sync() {
    this.instancer.begin();
    for (const p of this.prizes) {
      const t = p.body.translation();
      const r = p.body.rotation();
      if (p.obj) {
        p.obj.position.set(t.x, t.y, t.z);
        p.obj.quaternion.set(r.x, r.y, r.z, r.w);
      } else {
        this.instancer.add(p.template, t, r, p.scale);
      }
    }
    this.instancer.end();
  }
}
