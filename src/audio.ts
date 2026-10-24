// 音（仕様書11章）。音源ファイルは使わず、Web Audio でその場で鳴らす。
// BGM：明るいオルゴール風のループ曲。効果音：景品が獲得口に落ちたときだけ。

const NOTE = (n: string) => {
  const names: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  const midi = 12 * (Number(m[3]) + 1) + names[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
};

// オリジナルの短いループ（8分音符単位。'-' は休み）
const MELODY = [
  'E5', 'G5', 'C6', 'G5', 'A5', 'G5', 'E5', '-',
  'F5', 'A5', 'D6', 'A5', 'G5', 'E5', 'D5', '-',
  'E5', 'G5', 'C6', 'E6', 'D6', 'C6', 'A5', 'G5',
  'F5', 'E5', 'D5', 'G5', 'C5', '-', 'C5', '-',
];
const BASS = ['C4', 'G4', 'F4', 'C4', 'C4', 'G4', 'F4', 'C4'];
const STEP = 60 / 112 / 2; // 112 BPM の8分音符

export class Sound {
  ctx: AudioContext | null = null;
  master: GainNode;
  bgmGain: GainNode;
  volume = 0.7;
  muted = false;
  private bgmOn = false;
  private nextTime = 0;
  private stepIndex = 0;
  private timer: number | null = null;

  // ブラウザの制限で、最初のタップのあとでないと音を出せない
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0;
      this.bgmGain.connect(this.master);
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v: number) { this.volume = v; this.applyVolume(); }
  setMuted(m: boolean) { this.muted = m; this.applyVolume(); }
  private applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  // オルゴールの音色：基音に高い倍音を重ね、すぐ減衰させる
  private bell(freq: number, t: number, gain: number, dest: AudioNode, dur = 1.4) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    g.connect(dest);
    for (const [mul, amp] of [[1, 1], [2.01, 0.35], [4.2, 0.12]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      og.gain.value = amp;
      o.type = 'sine';
      o.frequency.value = freq * mul;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  startBgm() {
    if (!this.ctx || this.bgmOn) return;
    this.bgmOn = true;
    const t = this.ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(t);
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
    this.bgmGain.gain.linearRampToValueAtTime(0.35, t + 0.4);
    this.nextTime = t + 0.05;
    this.stepIndex = 0;
    const tick = () => {
      if (!this.bgmOn) return;
      while (this.nextTime < this.ctx.currentTime + 0.3) {
        const n = MELODY[this.stepIndex % MELODY.length];
        if (n !== '-') this.bell(NOTE(n), this.nextTime, 0.5, this.bgmGain);
        if (this.stepIndex % 4 === 0) this.bell(NOTE(BASS[Math.floor(this.stepIndex / 4) % BASS.length]), this.nextTime, 0.3, this.bgmGain, 2.0);
        this.nextTime += STEP;
        this.stepIndex++;
      }
      this.timer = window.setTimeout(tick, 100);
    };
    tick();
  }

  stopBgm() {
    if (!this.ctx || !this.bgmOn) return;
    this.bgmOn = false;
    if (this.timer) clearTimeout(this.timer);
    const t = this.ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(t);
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
    this.bgmGain.gain.linearRampToValueAtTime(0, t + 1.5);
  }

  // 景品が獲得口に落ちた音。kind：light（軽い）/ heavy（重い）/ gem（宝石）
  drop(kind: 'light' | 'heavy' | 'gem') {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (kind === 'gem') {
      this.bell(NOTE('E6'), t, 0.5, this.master, 0.9);
      this.bell(NOTE('B6'), t + 0.07, 0.4, this.master, 0.9);
      return;
    }
    // 「コトン」：低めの音を短く鳴らし、少しだけ雑音を混ぜる
    const o = c.createOscillator();
    const g = c.createGain();
    const f = kind === 'heavy' ? 140 : 320;
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    g.gain.setValueAtTime(kind === 'heavy' ? 0.9 : 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'heavy' ? 0.35 : 0.18));
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  // 特別な演出（大物・宝石（大））
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => this.bell(NOTE(n), t + i * 0.09, 0.45, this.master, 1.2));
  }
}
