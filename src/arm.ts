// ショベルの腕の動き（仕様書5章）。
// 「すくう」：肘を伸ばして川へ → 手首を回してすくう → その角度のまま上段の真上へ運ぶ。
// 「おとす」：手首を回して落とす → 水平に戻る。
import { ARM } from './config';
import { ease, lerp, clamp } from './util';
import type { SeatVisual } from './machine/visual';

export type ArmPhase = 'idle' | 'reach' | 'settle' | 'scoop' | 'carry' | 'waitDrop' | 'dump' | 'hold' | 'reset';

export interface Pose { x: number; y: number; pitch: number }

const P = ARM.pitch;
const HOME: Pose = { x: ARM.homeX, y: ARM.homeY, pitch: P.level };

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
    const { homeX, homeY, riverX, riverY } = ARM;
    const k = (d: number) => ease(clamp(this.t / d, 0, 1));
    const arc = (d: number) => Math.sin(Math.PI * clamp(this.t / d, 0, 1)) * 0.9;
    switch (this.phase) {
      case 'idle':
        this.pose = { ...HOME };
        break;
      case 'reach':
        this.pose = { x: lerp(homeX, riverX, k(T.reach)), y: lerp(homeY, riverY, k(T.reach)) + arc(T.reach), pitch: lerp(P.level, P.dive, k(T.reach)) };
        if (this.t >= T.reach) this.go('settle');
        break;
      case 'settle':
        this.pose = { x: riverX, y: riverY, pitch: P.dive };
        if (this.t >= T.settle) this.go('scoop');
        break;
      case 'scoop':
        // 前半は先端が川底に沿って進むよう高さを保ち、後半で持ち上げる
        const u = clamp(this.t / T.scoop, 0, 1);
        this.pose = { x: riverX, y: riverY + ARM.scoopLift * ease(clamp((u - 0.4) / 0.6, 0, 1)), pitch: lerp(P.dive, P.cup, ease(u)) };
        if (this.t >= T.scoop) this.go('carry');
        break;
      case 'carry':
        this.pose = { x: lerp(riverX, homeX, k(T.carry)), y: lerp(riverY + ARM.scoopLift, homeY, k(T.carry)) + arc(T.carry), pitch: P.cup };
        if (this.t >= T.carry) this.go('waitDrop');
        break;
      case 'waitDrop':
        this.pose = { x: homeX, y: homeY, pitch: P.cup };
        break;
      case 'dump':
        this.pose = { x: homeX, y: homeY, pitch: lerp(P.cup, P.dump, k(T.dump)) };
        if (this.t >= T.dump) this.go('hold');
        break;
      case 'hold':
        this.pose = { x: homeX, y: homeY, pitch: P.dump };
        if (this.t >= T.hold) this.go('reset');
        break;
      case 'reset':
        this.pose = { x: homeX, y: homeY, pitch: lerp(P.dump, P.level, k(T.reset)) };
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

function placeLink(m: THREE.Mesh, x1: number, y1: number, x2: number, y2: number) {
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  m.scale.x = Math.hypot(x2 - x1, y2 - y1);
}

// 腕の見た目を姿勢に合わせる
export function poseVisual(v: SeatVisual, pose: Pose) {
  const e = solveElbow(pose.x, pose.y);
  v.elbow.position.set(e.x, e.y, 0);
  v.wrist.position.set(pose.x, pose.y, 0);
  placeLink(v.upperArm, ARM.sx, ARM.sy, e.x, e.y);
  placeLink(v.foreArm, e.x, e.y, pose.x, pose.y);
  v.shovel.position.set(pose.x, pose.y, 0);
  v.shovel.rotation.x = pose.pitch;
}

import type * as THREE from 'three';
