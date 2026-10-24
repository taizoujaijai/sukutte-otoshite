// 保存するもの（仕様書12章）：宝箱の中身、図鑑、解放済みの大物。
import { loadJSON, saveJSON, removeKey } from './util';
import { BIG_KEYS, PRIZE } from './prizes/catalog';
import { CHEST_CAPACITY } from './config';

const KEY = 'sukutte-otoshite:v1';

export interface Progress {
  box: string[];                    // いまのゲームで取った景品（取った順）
  zukan: Record<string, number>;    // これまでに取った累計
  unlocked: string[];               // 台に出る大物
  clears: number;
}

function fresh(): Progress {
  return { box: [], zukan: {}, unlocked: [], clears: 0 };
}

export function loadProgress(): Progress {
  const p = { ...fresh(), ...loadJSON<Partial<Progress>>(KEY, {}) };
  // 最初のゲームでは、大物を1種類だけランダムに解放する
  if (!p.unlocked.length) p.unlocked = [BIG_KEYS[Math.floor(Math.random() * BIG_KEYS.length)]];
  p.unlocked = p.unlocked.filter((k) => PRIZE[k]);
  p.box = p.box.filter((k) => PRIZE[k]);
  return p;
}

export function saveProgress(p: Progress) {
  saveJSON(KEY, p);
}

export function clearProgress() {
  removeKey(KEY);
}

export function boxVolume(p: Progress) {
  return p.box.reduce((a, k) => a + PRIZE[k].volume, 0);
}

export function isOverflowing(p: Progress) {
  return boxVolume(p) >= CHEST_CAPACITY;
}

// クリアしたら、まだ出ていない大物を1種類増やす。全部出ていたら null
export function unlockNext(p: Progress): string | null {
  const rest = BIG_KEYS.filter((k) => !p.unlocked.includes(k));
  if (!rest.length) return null;
  const k = rest[Math.floor(Math.random() * rest.length)];
  p.unlocked.push(k);
  return k;
}
