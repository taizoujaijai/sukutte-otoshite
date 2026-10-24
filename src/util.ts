// 再現できる乱数
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (x: number) => x * x * (3 - 2 * x);

// 席 i の座標（x+ = 席の方向、z = 左右）を世界座標に変換する
export function seatToWorld(i: number, x: number, z: number): [number, number] {
  const a = i * Math.PI / 2;
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - z * s, x * s + z * c];
}
export function worldToSeat(i: number, wx: number, wz: number): [number, number] {
  const a = -i * Math.PI / 2;
  const c = Math.cos(a), s = Math.sin(a);
  return [wx * c - wz * s, wx * s + wz * c];
}

// localStorage は使えないこともあるので、必ず try で包む
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できない環境でも遊べるようにする */
  }
}
export function removeKey(key: string) {
  try { localStorage.removeItem(key); } catch { /* 無視 */ }
}
