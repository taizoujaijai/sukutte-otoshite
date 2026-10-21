// 試作ページ共通：レンダラーと、見た目のテイストごとの照明・背景
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

let envCache;
function getEnv(renderer) {
  if (!envCache) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envCache = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return envCache;
}

export const STYLE_BG = {
  toon: '#ffe9f2',
  real: '#221d2e',
  lowpoly: '#cfe8ff',
};

// テイストに合わせて照明・背景・トーンマッピングを設定する
export function applyStyle(scene, renderer, style, { shadowSize = 9, target = new THREE.Vector3() } = {}) {
  scene.background = new THREE.Color(STYLE_BG[style]);
  scene.environment = null;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;

  const lights = new THREE.Group();
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.position.set(target.x + 6, target.y + 14, target.z + 8);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = c.bottom = -shadowSize;
  c.right = c.top = shadowSize;
  c.near = 1;
  c.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  lights.add(sun, sun.target);

  if (style === 'toon') {
    sun.intensity = 1.6;
    lights.add(new THREE.AmbientLight('#ffffff', 1.1));
  } else if (style === 'lowpoly') {
    sun.intensity = 2.2;
    lights.add(new THREE.HemisphereLight('#ffffff', '#b9a8c9', 1.4));
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    scene.environment = getEnv(renderer);
    sun.intensity = 2.0;
    lights.add(new THREE.HemisphereLight('#fff4f8', '#3a3048', 0.5));
    // ゲームセンターらしい色付きの照明
    const pink = new THREE.PointLight('#ff7fb6', 30, 30);
    pink.position.set(target.x - 8, target.y + 6, target.z + 4);
    const blue = new THREE.PointLight('#7fb8ff', 30, 30);
    blue.position.set(target.x + 8, target.y + 6, target.z - 4);
    lights.add(pink, blue);
  }
  scene.add(lights);
  return lights;
}

export function onResize(renderer, camera, container, extra) {
  const fn = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    extra?.(w, h);
  };
  window.addEventListener('resize', fn);
  return fn;
}

// シーンの中身を捨てる（テイスト切り替え用）
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
  while (scene.children.length) scene.remove(scene.children[0]);
}

