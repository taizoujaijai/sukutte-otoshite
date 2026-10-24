// 景品の絵（図鑑・獲得演出・クリア画面用）。3Dモデルを画像にして使う。
import * as THREE from 'three';
import { PRIZES, makePrizeObject } from './prizes/catalog';

export const ICONS: Record<string, string> = {};

export function renderIcons() {
  const size = 192;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', 1.3));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  for (const def of PRIZES) {
    const { obj, radius } = makePrizeObject(def.key, 1);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.rotation.set(def.big ? 0.15 : 0.4, def.big ? 0.6 : 0.7, 0);
    scene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder, true);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(radius, box.getSize(new THREE.Vector3()).length() / 2);
    cam.position.set(c.x, c.y + r * 0.5, c.z + r * 3.6);
    cam.lookAt(c);
    renderer.render(scene, cam);
    ICONS[def.key] = renderer.domElement.toDataURL('image/png');
    scene.remove(holder);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
