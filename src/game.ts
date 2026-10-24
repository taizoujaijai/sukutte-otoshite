// ゲームの本体：3Dの台、物理演算、お金とクレジット、腕の操作、獲得、補充、クリア。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { M, MONEY, TIMING, STOCK, PHYSICS, ARM, MOTION } from './config';
import { buildMachineVisual, MachineVisual } from './machine/visual';
import { Physics, Prize } from './physics';
import { Arm, poseVisual, ArmPhase } from './arm';
import { PRIZE, BIG_KEYS, randomNormalKey, getTemplate } from './prizes/catalog';
import { Progress, saveProgress, isOverflowing } from './progress';
import { Sound } from './audio';
import { seatToWorld } from './util';

export type Mode = 'title' | 'select' | 'play';

export interface SeatLayout { tower: boolean; big: string | null }

export interface GameEvents {
  hud(): void;
  collected(key: string): void;
  cleared(): void;
  banner(text: string | null): void;
  toast(text: string): void;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  controls: OrbitControls;
  machine: MachineVisual;
  physics: Physics;
  arms = [0, 1, 2, 3].map(() => new Arm());
  layouts: SeatLayout[] = [];

  mode: Mode = 'title';
  seat = 0;
  money = MONEY.start;
  spent = 0;
  credits = 0;
  onedari = 0;
  shutterOpen = false;
  shutterTimer = 0;
  scoopTimer = TIMING.scoopTimeout;
  dropTimer = TIMING.dropTimeout;
  refilling = false;
  paused = false;
  cleared = false;

  private time = 0;
  private acc = 0;
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private orbitAngle = 0;

  constructor(container: HTMLElement, public progress: Progress, public sound: Sound, public ev: GameEvents) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    const s = this.scene;
    s.background = new THREE.Color('#ffe9f2');
    s.add(new THREE.AmbientLight('#ffffff', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(7, 22, 9);
    sun.target.position.set(0, 8, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    s.add(sun, sun.target);

    this.machine = buildMachineVisual();
    s.add(this.machine.root);
    this.physics = new Physics(s);
    this.physics.onSlot = (i, p) => this.onSlot(i, p);

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 38;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.addEventListener('start', () => { this.camGoal = null; });

    this.arms.forEach((a, i) => {
      this.physics.placeShovel(i, a.pose.x, a.pose.y, a.pose.pitch);
      poseVisual(this.machine.seats[i], a.pose);
    });
    this.arms[0].onPhase = (p) => this.onArmPhase(p);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const el = this.renderer.domElement.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // 縦長の画面では、台が収まるよう少し引く
    this.camera.fov = w / h < 0.8 ? 52 : 42;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q: 'high' | 'mid' | 'low') {
    const ratio = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'mid' ? Math.min(devicePixelRatio, 1.25) : 0.85;
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.scene.traverse((o: any) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  // ---- 台の準備 ----
  newLayouts() {
    const big = this.progress.unlocked;
    this.layouts = [0, 1, 2, 3].map(() => ({
      tower: Math.random() < STOCK.towerChance,
      big: Math.random() < STOCK.bigChance && big.length ? big[Math.floor(Math.random() * big.length)] : null,
    }));
    // 4席のどこかには、タワーか大物がある席を必ず作る
    if (!this.layouts.some((l) => l.tower || l.big)) this.layouts[Math.floor(Math.random() * 4)].tower = true;
  }

  // 景品を並べ直す。並べたあと、少し時間を進めて落ち着かせる
  setupBoard() {
    for (const p of [...this.physics.prizes]) this.physics.removePrize(p);
    this.newLayouts();
    const v = () => Math.floor(Math.random() * 4);
    // 川
    this.spawnRiver(STOCK.river, M.riverFloor + 0.25, 1.0);
    const bigs = this.progress.unlocked;
    for (let k = 0; k < STOCK.riverBig && bigs.length; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = (M.riverIn + M.riverOut) / 2;
      this.physics.addPrize(bigs[k % bigs.length], 0, new THREE.Vector3(Math.cos(a) * r, M.riverFloor + 0.8, Math.sin(a) * r), { scale: 0.45 });
    }
    // 各席
    this.layouts.forEach((lay, i) => {
      const place = (key: string, x: number, y: number, z: number, opts = {}) => {
        const [wx, wz] = seatToWorld(i, x, z);
        return this.physics.addPrize(key, v(), new THREE.Vector3(wx, y, wz), { yaw: -i * Math.PI / 2 + (Math.random() - 0.5) * 0.4, ...opts });
      };
      // 下段に置けるのは、上段がいちばん前に出たときの端より手前（上段の下に入ると挟まって動かなくなる）
      const front = M.upperOut + MOTION.pushAmp + 0.1;
      if (lay.tower) {
        // 小箱のタワー（手前ほど高い）
        const h = getTemplate('smallBox', 0).half;
        for (let b = 0; b < 3; b++) for (let c = 0; c < 4; c++) {
          place('smallBox', M.lowerOut - h.x - 0.25, M.lowerTop + h.y + 0.01 + c * (h.y * 2 + 0.01), (b - 1) * (h.z * 2 + 0.02), { yaw: -i * Math.PI / 2 });
        }
      }
      for (let k = 0; k < STOCK.lower; k++) {
        const x = front + Math.random() * (M.lowerOut - front - 0.15), z = (Math.random() - 0.5) * 3.0;
        if (lay.tower && Math.abs(z) < 0.95) continue;
        place(randomNormalKey(Math.random), x, M.lowerTop + 0.2 + Math.random() * 0.6, z, { tilt: true });
      }
      if (lay.big) place(lay.big, front + 0.6, M.lowerTop + 0.8, lay.tower ? 1.0 : 0.2);
      for (let k = 0; k < STOCK.upper; k++) {
        place(randomNormalKey(Math.random), M.sweeper + 0.55 + Math.random() * (M.upperOut - M.sweeper - 0.6), M.upperTop + 0.25 + Math.random() * 0.5, (Math.random() - 0.5) * 3.0, { tilt: true });
      }
    });
  }

  spawnRiver(n: number, y: number, spread: number) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = M.riverIn + 0.3 + Math.random() * (M.riverOut - M.riverIn - 0.6);
      this.physics.addPrize(randomNormalKey(Math.random), Math.floor(Math.random() * 4),
        new THREE.Vector3(Math.cos(a) * r, y + Math.random() * spread + (k % 6) * 0.22, Math.sin(a) * r), { tilt: true });
    }
  }

  // 物理を早送りして落ち着かせる（読み込み中や席選びの前に呼ぶ）
  settle(seconds: number) {
    const n = Math.round(seconds / PHYSICS.step);
    for (let k = 0; k < n; k++) this.stepFixed(PHYSICS.step);
  }

  // ---- 席とカメラ ----
  seatView(i: number) {
    const a = i * Math.PI / 2;
    const eye = new THREE.Vector3(Math.cos(a + 0.35), 0, Math.sin(a + 0.35));
    const portrait = this.camera.aspect < 0.8;
    const dist = portrait ? 15.5 : 16.5;
    return {
      pos: eye.multiplyScalar(dist).add(new THREE.Vector3(0, portrait ? 17.5 : 15.5, 0)),
      target: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(3.4).add(new THREE.Vector3(0, portrait ? 8.0 : 8.4, 0)),
    };
  }

  lookAtSeat(i: number, instant = false) {
    const v = this.seatView(i);
    if (instant) {
      this.camera.position.copy(v.pos);
      this.controls.target.copy(v.target);
      this.camGoal = null;
    } else {
      this.camGoal = v;
    }
  }

  seatDescription(i: number) {
    const l = this.layouts[i];
    const parts: string[] = [];
    if (l.tower) parts.push('小箱のタワーあり');
    if (l.big) parts.push(`大物「${PRIZE[l.big].name}」あり`);
    if (!parts.length) parts.push('お菓子がいっぱい');
    return `${i + 1}番の席：${parts.join('、')}`;
  }

  // ---- お金とクレジット ----
  get armIdle() { return this.arms[this.seat].phase === 'idle'; }
  get canScoop() { return this.mode === 'play' && this.credits > 0 && this.armIdle && !this.cleared; }
  get canDrop() { return this.mode === 'play' && this.arms[this.seat].phase === 'waitDrop'; }
  get canCoin() { return this.mode === 'play' && this.money >= MONEY.perPlay && this.credits < MONEY.maxCredit && !this.refilling && !this.cleared; }
  get canChangeSeat() { return this.mode === 'play' && this.armIdle; }

  insertCoin() {
    if (!this.canCoin) return;
    this.sound.unlock();
    this.money -= MONEY.perPlay;
    this.spent += MONEY.perPlay;
    if (this.credits === 0 && this.armIdle) this.scoopTimer = TIMING.scoopTimeout;
    this.credits++;
    this.shutterOpen = true;
    this.shutterTimer = 0;
    this.sound.startBgm();
    this.ev.hud();
  }

  begOnedari() {
    this.money += MONEY.onedari;
    this.onedari++;
    const lines = ['しょうがないなあ', 'はい、どうぞ', 'これで最後だよ', 'もう、しかたないね', '大事に使ってね'];
    this.ev.toast(`「${lines[Math.min(this.onedari - 1, lines.length - 1)]}」 +1000円`);
    this.ev.hud();
  }

  scoop() {
    if (!this.canScoop) return;
    this.sound.unlock();
    this.credits--;
    this.arms[this.seat].scoop();
    this.ev.hud();
  }

  drop() {
    if (!this.canDrop) return;
    this.arms[this.seat].drop();
    this.ev.hud();
  }

  private onArmPhase(p: ArmPhase) {
    // 手首を回し始める瞬間に、刃の面のすぐ上にある景品をショベルに固定して、すくい上げて運ぶ
    if (p === 'scoop') this.physics.capture(this.seat);
    if (p === 'dump') this.physics.release(this.seat);
    if (p === 'waitDrop') this.dropTimer = TIMING.dropTimeout;
    if (p === 'idle') {
      this.scoopTimer = TIMING.scoopTimeout;
      if (this.credits === 0) this.shutterTimer = TIMING.shutterClose;
    }
    this.ev.hud();
  }

  // 席を移る：残りのクレジットは払い戻す
  leaveSeat() {
    if (this.credits > 0) {
      this.money += this.credits * MONEY.perPlay;
      this.spent -= this.credits * MONEY.perPlay;
      this.ev.toast(`クレジット${this.credits}枚を払い戻しました`);
      this.credits = 0;
    }
    this.shutterOpen = false;
    this.sound.stopBgm();
  }

  setSeat(i: number) {
    this.arms[this.seat].onPhase = () => {};
    this.seat = i;
    this.physics.activeSeat = i;
    this.arms[i].onPhase = (p) => this.onArmPhase(p);
    this.machine.seats.forEach((s, k) => s.display.set(k === i ? this.credits : 0));
  }

  resetMoney() {
    this.money = MONEY.start;
    this.spent = 0;
    this.credits = 0;
    this.onedari = 0;
    this.shutterOpen = false;
    this.cleared = false;
  }

  // ---- 景品が落ちた ----
  private onSlot(i: number, p: Prize) {
    if (i !== this.seat || !this.shutterOpen || this.mode !== 'play' || this.cleared) return; // 機械が回収
    const key = p.key;
    this.progress.box.push(key);
    this.progress.zukan[key] = (this.progress.zukan[key] ?? 0) + 1;
    saveProgress(this.progress);
    const def = PRIZE[key];
    if (def.big) this.sound.fanfare();
    else this.sound.drop(key.startsWith('gem') ? 'gem' : def.mass >= 1.5 ? 'heavy' : 'light');
    this.ev.collected(key);
    if (isOverflowing(this.progress)) {
      this.cleared = true;
      this.credits = 0;
      this.ev.cleared();
    }
  }

  // ---- 補充 ----
  private refillT = 0;
  private refillLeft = 0;
  private checkRefill(h: number) {
    if (!this.refilling) {
      if (this.physics.riverCount() < STOCK.river * STOCK.refillBelow && this.armIdle) {
        this.refilling = true;
        this.refillLeft = STOCK.river - this.physics.riverCount();
        this.refillT = 0;
        this.ev.banner('ただいま補充中');
      }
      return;
    }
    this.refillT += h;
    // ハッチが開き、景品が降る
    this.machine.hatch.position.y = 14.3 + Math.min(this.refillT, 0.6) * 2.5;
    if (this.refillT > 0.6 && this.refillLeft > 0 && Math.random() < 0.5) {
      this.spawnRiver(1, 12.5, 0.5);
      this.refillLeft--;
    }
    if (this.refillLeft <= 0 && this.refillT > 3) {
      this.machine.hatch.position.y = 14.3;
      this.refilling = false;
      this.ev.banner(null);
      this.ev.hud();
    }
  }

  // ---- 進める ----
  private stepFixed(h: number) {
    this.time += h;
    // 運ぶ途中で、まれに景品がこぼれる（1回の運搬で1割ほど）
    if (this.arms[this.seat].phase === 'carry' && Math.random() < 0.1 * h / ARM.t.carry) this.physics.slipOne(this.seat);
    for (let i = 0; i < 4; i++) {
      const a = this.arms[i];
      a.update(h);
      this.physics.driveShovel(i, a.pose.x, a.pose.y, a.pose.pitch);
      this.physics.driveUpper(i, this.time);
    }
    this.physics.step();
  }

  update(dt: number) {
    if (this.paused) return;
    dt = Math.min(dt, 0.1);
    // タイムアウト（自動操作）とシャッター
    if (this.mode === 'play' && !this.cleared) {
      if (this.canScoop) {
        this.scoopTimer -= dt;
        if (this.scoopTimer <= 0) this.scoop();
      }
      if (this.canDrop) {
        this.dropTimer -= dt;
        if (this.dropTimer <= 0) this.drop();
      }
      if (this.shutterOpen && this.credits === 0 && this.armIdle && this.shutterTimer > 0) {
        this.shutterTimer -= dt;
        if (this.shutterTimer <= 0) {
          this.shutterOpen = false;
          this.sound.stopBgm();
          this.ev.hud();
        }
      }
    }
    this.checkRefill(dt);

    this.acc += dt;
    let n = 0;
    while (this.acc >= PHYSICS.step && n < PHYSICS.maxSub) {
      this.stepFixed(PHYSICS.step);
      this.acc -= PHYSICS.step;
      n++;
    }
    if (n === PHYSICS.maxSub) this.acc = 0;

    // 見た目を合わせる
    this.physics.sync();
    this.machine.river.rotation.y = (this.time * Math.PI * 2) / MOTION.riverPeriod;
    this.machine.seats.forEach((s, i) => {
      s.upper.position.x = this.physics.upperOffset(i, this.time);
      poseVisual(s, this.arms[i].pose);
    });
    const seatV = this.machine.seats[this.seat];
    seatV.flap.visible = !this.shutterOpen;
    seatV.display.set(this.credits);

    // カメラ
    if (this.mode === 'title') {
      this.orbitAngle += dt * 0.12;
      const a = this.orbitAngle;
      this.camera.position.set(Math.cos(a) * 21, 17, Math.sin(a) * 21);
      this.controls.target.set(0, 8.5, 0);
    } else if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, 1 - Math.pow(0.02, dt));
      this.controls.target.lerp(this.camGoal.target, 1 - Math.pow(0.02, dt));
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.05) this.camGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // UI に出す残り秒数
  timerInfo(): { label: string; sec: number | null } {
    if (this.mode !== 'play') return { label: '', sec: null };
    if (this.canDrop) return { label: 'おとす', sec: Math.ceil(this.dropTimer) };
    if (this.canScoop) return { label: 'すくう', sec: Math.ceil(this.scoopTimer) };
    return { label: 'すくう', sec: null };
  }
}

export { BIG_KEYS, ARM };
