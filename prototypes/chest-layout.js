// 宝箱イラストの配置計算（案A・案Bで共通）。
// 箱の中に下から棚状に詰め、縁を越えたら山盛りにし、それでも入らない分は箱の外の床にこぼす。
import { ALL_PRIZES, BIG_PRIZES, randomNormalKind, seeded } from './prizes.js';

// 描画領域は 800 x 600
export const CHEST = {
  left: 190, right: 610,        // 箱の内側の左右
  floor: 430,                   // 箱の中の底（前の壁の上端）
  rim: 255,                     // 奥の壁の上端（ここを越えたら山盛り）
  heapTop: 175,                 // 山盛りの上限
  ground: 560,                  // こぼれた景品が落ちる床
};

// 取った順の景品の列（再現できる乱数）。大物はときどき混ざる
export function prizeSequence(n, seed = 11) {
  const rnd = seeded(seed);
  const bigKinds = Object.keys(BIG_PRIZES);
  const list = [];
  for (let i = 0; i < n; i++) {
    const kind = i % 17 === 9 ? bigKinds[Math.floor(rnd() * bigKinds.length)] : randomNormalKind(rnd);
    list.push(kind);
  }
  return list;
}

export function iconSize(kind) {
  const v = ALL_PRIZES[kind].volume;
  return Math.min(135, 40 * Math.sqrt(v) + 14);
}

export function layoutChest(kinds, seed = 5) {
  const rnd = seeded(seed);
  const out = [];
  let rowY = CHEST.floor;
  let rowH = 0;
  let x = CHEST.left;
  let spillIndex = 0;
  let overflowed = false;

  for (const kind of kinds) {
    const s = iconSize(kind);
    // 山盛りのときは、上に行くほど左右を狭める
    const narrowing = rowY < CHEST.rim ? (CHEST.rim - rowY) * 1.1 : 0;
    const left = CHEST.left + narrowing;
    const right = CHEST.right - narrowing;
    if (x + s * 0.8 > right) {
      rowY -= rowH * 0.62;
      rowH = 0;
      x = CHEST.left + (CHEST.rim > rowY ? (CHEST.rim - rowY) * 1.1 : 0) + rnd() * 10;
    }
    const placeInside = rowY - s * 0.5 > CHEST.heapTop && x + s * 0.8 <= (CHEST.right - (rowY < CHEST.rim ? (CHEST.rim - rowY) * 1.1 : 0));
    if (placeInside && !overflowed) {
      out.push({
        kind, size: s, outside: false,
        x: x + s * 0.5 + (rnd() - 0.5) * 8,
        y: rowY - s * 0.42 + (rnd() - 0.5) * 6,
        rot: (rnd() - 0.5) * 0.9,
      });
      x += s * 0.78;
      rowH = Math.max(rowH, s);
    } else {
      // あふれた：箱の左右の床へ交互にこぼす
      overflowed = true;
      const side = spillIndex % 2 === 0 ? -1 : 1;
      const k = Math.floor(spillIndex / 2);
      const dist = 6 + k * 15 + rnd() * 12;
      const baseX = side < 0 ? CHEST.left - 20 - dist : CHEST.right + 20 + dist;
      out.push({
        kind, size: s, outside: true,
        x: baseX,
        y: CHEST.ground - s * 0.35 - Math.max(0, 90 - k * 12) * (0.5 + rnd() * 0.5),
        rot: (rnd() - 0.5) * 2.4,
      });
      spillIndex++;
    }
  }
  return { items: out, overflowed };
}

// 箱があふれるまでに入る数（スライダーの最大値の目安に使う）
export function countToOverflow(seed = 11) {
  for (let n = 1; n < 400; n++) {
    if (layoutChest(prizeSequence(n, seed)).overflowed) return n;
  }
  return 400;
}
