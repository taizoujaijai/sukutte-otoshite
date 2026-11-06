// ショベルの腕の動き（仕様書5章）。
// 「すくう」：肘を伸ばして川へ → 手首を回してすくう → その角度のまま上段の真上へ運ぶ。
// 「おとす」：手首を回して落とす → 水平に戻る。
import { ARM } from './config';
import { ease, lerp, clamp } from './util';
import type { SeatVisual } from './machine/visual';
import * as THREE from 'three';

export type ArmPhase = 'idle' | 'reach' | 'settle' | 'scoop' | 'carry' | 'waitDrop' | 'dump' | 'hold' | 'reset';

export interface Pose { x: number; y: number; z: number; pitch: number }

const P = ARM.pitch;
const HOME: Pose = { x: ARM.homeX, y: ARM.homeY, z: 0, pitch: P.level };

export class Arm {
  phase: ArmPhase = 'idle';
  t = 0;
  pose: Pose = { ...HOME };
  onPhase: (p: ArmPhase) => void = () => {};

  get busy() { return this.phase !== 'idle' && this.phase !== 'waitDrop'; }

  scoop() {
    if (this.phase !== 'idle') return false;
    this.go('reach');
    return true;
  }

  drop() {
    if (this.phase !== 'waitDrop') return false;
    this.go('dump');
    return true;
  }

  private go(p: ArmPhase) {
    this.phase = p;
    this.t = 0;
    this.onPhase(p);
  }

  update(h: number) {
    this.t += h;
    const T = ARM.t;
    const { homeX, homeY, riverX, riverY, riverZ, scoopZ } = ARM;
    const k = (d: number) => ease(clamp(this.t / d, 0, 1));
    const arc = (d: number) => Math.sin(Math.PI * clamp(this.t / d, 0, 1)) * 0.9;
    switch (this.phase) {
      case 'idle':
        this.pose = { ...HOME };
        break;
      case 'reach':
        this.pose = { x: lerp(homeX, riverX, k(T.reach)), y: lerp(homeY, riverY, k(T.reach)) + arc(T.reach), z: lerp(0, riverZ, k(T.reach)), pitch: lerp(P.level, P.dive, k(T.reach)) };
        if (this.t >= T.reach) this.go('settle');
        break;
      case 'settle':
        this.pose = { x: riverX, y: riverY, z: riverZ, pitch: P.dive };
        if (this.t >= T.settle) this.go('scoop');
        break;
      case 'scoop': {
        // 流れに逆らって左へ進みながら手首を回す。前半は先端が川底に沿うよう高さを保ち、後半で持ち上げる
        const u = clamp(this.t / T.scoop, 0, 1);
        this.pose = { x: riverX, y: riverY + ARM.scoopLift * ease(clamp((u - 0.4) / 0.6, 0, 1)), z: lerp(riverZ, scoopZ, ease(u)), pitch: lerp(P.dive, P.cup, ease(u)) };
        if (this.t >= T.scoop) this.go('carry');
        break;
      }
      case 'carry':
        this.pose = { x: lerp(riverX, homeX, k(T.carry)), y: lerp(riverY + ARM.scoopLift, homeY, k(T.carry)) + arc(T.carry), z: lerp(scoopZ, 0, k(T.carry)), pitch: P.cup };
        if (this.t >= T.carry) this.go('waitDrop');
        break;
      case 'waitDrop':
        this.pose = { x: homeX, y: homeY, z: 0, pitch: P.cup };
        break;
      case 'dump':
        this.pose = { x: homeX, y: homeY, z: 0, pitch: lerp(P.cup, P.dump, k(T.dump)) };
        if (this.t >= T.dump) this.go('hold');
        break;
      case 'hold':
        this.pose = { x: homeX, y: homeY, z: 0, pitch: P.dump };
        if (this.t >= T.hold) this.go('reset');
        break;
      case 'reset':
        this.pose = { x: homeX, y: homeY, z: 0, pitch: lerp(P.dump, P.level, k(T.reset)) };
        if (this.t >= T.reset) this.go('idle');
        break;
    }
  }
}

// 2本の棒の関節角を、手首の目標位置から求める（肘が上に来る解）
export function solveElbow(wx: number, wy: number) {
  const { sx, sy, l1, l2 } = ARM;
  const dx = wx - sx, dy = wy - sy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const a = Math.atan2(dy, dx);
  const b = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const c1 = { x: sx + Math.cos(a + b) * l1, y: sy + Math.sin(a + b) * l1 };
  const c2 = { x: sx + Math.cos(a - b) * l1, y: sy + Math.sin(a - b) * l1 };
  return c1.y > c2.y ? c1 : c2;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const dirV = new THREE.Vector3();

function placeLink(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  m.position.addVectors(a, b).multiplyScalar(0.5);
  dirV.subVectors(b, a);
  m.scale.x = dirV.length();
  m.quaternion.setFromUnitVectors(AXIS_X, dirV.normalize());
}

const shoulderV = new THREE.Vector3(ARM.sx, ARM.sy, 0);
const elbowV = new THREE.Vector3();
const wristV = new THREE.Vector3();

// 腕の見た目を姿勢に合わせる。肩から手首へ向かう縦の面の中で肘を曲げるので、手首が左右に動いても腕はつながる
export function poseVisual(v: SeatVisual, pose: Pose) {
  const rho = Math.hypot(ARM.sx - pose.x, pose.z);
  const e = solveElbow(ARM.sx - rho, pose.y);
  const rhoE = ARM.sx - e.x;
  const dx = rho > 1e-5 ? (pose.x - ARM.sx) / rho : -1;
  const dz = rho > 1e-5 ? pose.z / rho : 0;
  elbowV.set(ARM.sx + dx * rhoE, e.y, dz * rhoE);
  wristV.set(pose.x, pose.y, pose.z);
  v.elbow.position.copy(elbowV);
  v.wrist.position.copy(wristV);
  placeLink(v.upperArm, shoulderV, elbowV);
  placeLink(v.foreArm, elbowV, wristV);
  v.shovel.position.copy(wristV);
  v.shovel.rotation.x = pose.pitch;
}
