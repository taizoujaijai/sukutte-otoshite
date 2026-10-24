// 調整できる値（仕様書14章）。遊びながら変えられるよう、ここにまとめる。
// 単位：長さ 1 = 10cm、時間は秒。

export const MONEY = {
  start: 1000,
  onedari: 1000,
  perPlay: 100,
  maxCredit: 9,
};

export const TIMING = {
  scoopTimeout: 60,     // 「すくう」を押さなかったら自動ですくうまで
  dropTimeout: 60,      // 「おとす」を押さなかったら自動で落とすまで
  shutterClose: 10,     // クレジット0で「おとす」が終わってからシャッターが閉じるまで
};

// 筐体の寸法
export const M = {
  apothem: 6.9,         // 中心から席の正面まで
  bodyTop: 7.1,
  riverFloor: 7.3,
  riverIn: 0.95,
  riverOut: 4.45,
  deckIn: 7.55,         // デッキの坂の内側（川の縁）の高さ
  deckOut: 8.05,        // デッキの坂の外側の高さ
  lowerTop: 8.3,
  upperTop: 8.75,
  upperIn: 3.3,
  upperOut: 5.1,
  sweeper: 3.95,        // 上段の奥にある固定の壁（上段が引っ込むとき、上段の景品を手前へ押し出す）
  lowerIn: 4.9,
  lowerOut: 6.75,
  stageW: 3.4,
  domeTop: 11.6,
};

export const MOTION = {
  riverPeriod: 24,      // 川が1周する秒数
  pushPeriod: 4,        // 上段が1往復する秒数
  pushAmp: 0.55,        // 上段の振れ幅
};

// 腕（肩・上腕・前腕）と手首の動き
// すくい方：ショベルは横向きで、先端は上流（流れてくる側）を向く。
// 肘を伸ばして、先端が手首の真下（川底すれすれ）に来るように下ろす。そこから手首を大きく回すと、
// 先端が川底に沿って上流へ進み、流れてくる景品の下に潜り込んで、すくい上げる（流れに逆らってすくう）
export const SHOVEL_SCALE = 1.3;
const LIP = { z: 0.58 * SHOVEL_SCALE, y: -0.41 * SHOVEL_SCALE };
const DIVE = Math.atan2(LIP.z, -LIP.y);
export const ARM = {
  sx: 6.0, sy: 10.0, l1: 2.0, l2: 2.8,
  homeX: 4.3, homeY: 10.3,
  riverX: 1.95, riverY: 7.33 + Math.hypot(LIP.z, LIP.y),
  scoopLift: 0.35,
  pitch: { level: 0, dive: DIVE, cup: -0.4, dump: 1.35 },
  // 各フェーズの秒数
  t: { reach: 1.8, settle: 0.3, scoop: 1.2, carry: 2.0, dump: 0.45, hold: 0.5, reset: 0.6 },
};

export const STOCK = {
  river: 140,           // 川の景品の数
  refillBelow: 0.5,     // 最初の量のこの割合を下回ったら補充
  lower: 24,
  upper: 12,
  towerChance: 0.25,
  bigChance: 0.35,      // 席の下段に大物を置く確率（解放済みの大物から選ぶ）
  riverBig: 2,          // 川に流す大物の数
};

// 宝箱の容量（景品の「かさ」の合計）。3000〜5000円でクリアになる目安
export const CHEST_CAPACITY = 150;

export const PHYSICS = {
  gravity: -60,
  step: 1 / 60,
  maxSub: 2,
  iterations: 6,
};
