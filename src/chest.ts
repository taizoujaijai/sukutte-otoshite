// 宝箱（仕様書10.2節）：取った景品を物理演算で上から落として詰める。容量を超えるとあふれてこぼれる。
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PRIZE, makePrizeObject, toonGradient } from './prizes/catalog';
import { addOutline } from './machine/visual';

// 箱の内寸。景品の「かさ」の合計が容量（config の CHEST_CAPACITY）に届くころ、あふれ始める大きさ
const W = 4.6, D = 2.7, H = 1.8, T = 0.12;

export class Chest {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private controls: OrbitControls;
  private world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
  private items: { body: CANNON.Body; obj: THREE.Object3D }[] = [];
  private queue: string[] = [];
  private running = false;
  private last = 0;
  private dropTimer = 0;
  private container: HTMLElement;
  onStatus: (filled: number, total: number, outside: number) => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.7, 0);
    this.controls.minDistance = 3;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    const s = this.scene;
    s.background = new THREE.Color('#fff1e4');
    s.add(new THREE.AmbientLight('#ffffff', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    s.add(sun);

    const w = this.world;
    w.broadphase = new CANNON.SAPBroadphase(w);
    w.allowSleep = true;
    w.defaultContactMaterial.friction = 0.45;
    w.defaultContactMaterial.restitution = 0.05;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshToonMaterial({ color: '#ffe2c4', gradientMap: toonGradient() }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const fb = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    fb.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    w.addBody(fb);

    const wood = new THREE.MeshToonMaterial({ color: '#c98244', gradientMap: toonGradient() });
    const gold = new THREE.MeshToonMaterial({ color: '#f2c14e', gradientMap: toonGradient() });
    const wall = (hx: number, hy: number, hz: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), wood);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      addOutline(m, 0.03);
      s.add(m);
      const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
      b.position.set(x, y, z);
      w.addBody(b);
    };
    wall(W / 2 + T, T / 2, D / 2 + T, 0, T / 2, 0);
    wall(W / 2 + T, H / 2, T / 2, 0, H / 2 + T, D / 2 + T / 2);
    wall(W / 2 + T, H / 2, T / 2, 0, H / 2 + T, -D / 2 - T / 2);
    wall(T / 2, H / 2, D / 2, W / 2 + T / 2, H / 2 + T, 0);
    wall(T / 2, H / 2, D / 2, -W / 2 - T / 2, H / 2 + T, 0);
    for (const x of [-1.3, 1.3]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, H + T + 0.02, D + T * 2 + 0.04), gold);
      band.position.set(x, (H + T) / 2, 0);
      s.add(band);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), gold);
    lock.position.set(0, H * 0.7, D / 2 + T + 0.03);
    s.add(lock);
    // ふた（奥に開いている）
    const lid = new THREE.Group();
    lid.position.set(0, H + T, -D / 2 - T);
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(D / 2 + T, D / 2 + T, W + T * 2, 24, 1, false, 0, Math.PI), wood);
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.position.z = D / 2 + T;
    lid.add(lidMesh);
    lid.rotation.x = -1.9;
    s.add(lid);

    addEventListener('resize', () => this.resize());
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // 宝箱を開く：取った景品を順に落とす（多いときは最初の分を早送りで詰める）
  open(keys: string[]) {
    this.clear();
    this.resize();
    // 縦長の画面では、箱が横にはみ出さないよう引いて見る
    const far = this.camera.aspect < 0.8 ? 1.75 : 1;
    this.camera.position.set(0, 7.4 * far, 7.8 * far);
    this.controls.target.set(0, 1.0, 0);
    this.queue = [...keys];
    // 景品が多いときは、半分ほどを最初に一気に入れて詰まった状態から始める
    const instant = Math.max(0, this.queue.length - 40);
    for (let k = 0; k < instant; k++) {
      this.drop(this.queue.shift(), true);
      for (let s = 0; s < 4; s++) this.world.step(1 / 60);
    }
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.dropTimer -= dt;
      if (this.queue.length && this.dropTimer <= 0) {
        this.drop(this.queue.shift(), false);
        this.dropTimer = 0.07;
      }
      this.world.step(1 / 60, dt, 3);
      let outside = 0;
      for (const it of this.items) {
        it.obj.position.copy(it.body.position as unknown as THREE.Vector3);
        it.obj.quaternion.copy(it.body.quaternion as unknown as THREE.Quaternion);
        const p = it.body.position;
        if (p.y < 0.8 && (Math.abs(p.x) > W / 2 + T || Math.abs(p.z) > D / 2 + T)) outside++;
      }
      this.onStatus(this.items.length, this.items.length + this.queue.length, outside);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private drop(key: string, quick: boolean) {
    const { obj, half } = makePrizeObject(key, Math.floor(Math.random() * 4));
    const def = PRIZE[key];
    const body = new CANNON.Body({
      mass: def.mass,
      shape: new CANNON.Box(new CANNON.Vec3(Math.max(half.x * 0.94, 0.04), Math.max(half.y * 0.94, 0.04), Math.max(half.z * 0.94, 0.04))),
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.6,
      angularDamping: 0.3,
    });
    body.position.set((Math.random() - 0.5) * (W - 0.6), H + (quick ? 0.8 : 2.2) + Math.random() * 0.6, (Math.random() - 0.5) * (D - 0.5));
    body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.world.addBody(body);
    this.scene.add(obj);
    this.items.push({ body, obj });
  }

  close() {
    this.running = false;
  }

  private clear() {
    for (const it of this.items) {
      this.world.removeBody(it.body);
      this.scene.remove(it.obj);
    }
    this.items = [];
  }
}
