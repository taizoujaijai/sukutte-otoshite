// 画面の切り替えと操作をつなぐ。
import './style.css';
import { Game } from './game';
import { initPhysics } from './physics';
import { Sound } from './audio';
import { Chest } from './chest';
import { loadPrizes, PRIZES, PRIZE } from './prizes/catalog';
import { renderIcons, ICONS } from './icons';
import { loadProgress, saveProgress, clearProgress, unlockNext, boxVolume } from './progress';
import { CHEST_CAPACITY } from './config';
import { loadJSON, saveJSON } from './util';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, on = true) => { $(id).hidden = !on; };

const SETTINGS_KEY = 'sukutte-otoshite:settings';
const settings = loadJSON(SETTINGS_KEY, { volume: 0.7, muted: false, quality: 'high' as 'high' | 'mid' | 'low' });

let stage = '起動';

async function boot() {
  const sound = new Sound();
  sound.setVolume(settings.volume);
  sound.setMuted(settings.muted);
  const progress = loadProgress();

  $('loading-text').textContent = '景品を用意しています…';
  stage = '物理エンジンの準備';
  await initPhysics();
  stage = '景品のモデルの読み込み';
  await loadPrizes();
  stage = '景品の絵の作成';
  renderIcons();
  stage = '台の組み立て';

  let toastTimer = 0;
  const game = new Game($('view'), progress, sound, {
    hud: () => updateHud(),
    collected: (key) => onCollected(key),
    cleared: () => setTimeout(onCleared, 1600),
    broke: () => onBroke(),
    banner: (text) => { $('banner').textContent = text ?? ''; show('banner', !!text); updateHud(); },
    toast: (text) => {
      $('toast').textContent = text;
      show('toast');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => show('toast', false), 2200);
    },
  });
  game.setQuality(settings.quality);

  $('loading-text').textContent = '台を準備しています…';
  await new Promise((r) => setTimeout(r, 30));
  game.setupBoard();
  game.settle(2.5);
  show('loading', false);
  stage = '画面の準備';

  const chest = new Chest($('chest-view'));
  chest.onStatus = (filled, total, outside) => {
    const vol = boxVolume(progress);
    const pct = Math.min(999, Math.round((vol / CHEST_CAPACITY) * 100));
    $('chest-status').innerHTML = outside > 0
      ? `${total}個 ・ <b>あふれた！</b>（外に${outside}個）`
      : total ? `${filled} / ${total}個` + (filled === total ? ` ・ ${pct >= 100 ? '<b>いっぱい！</b>' : pct >= 70 ? 'だいぶたまってきた' : pct >= 35 ? 'まだ入る' : 'まだまだ入る'}` : '') : 'まだ何も入っていません';
  };

  // ---- 画面 ----
  function toTitle() {
    game.mode = 'title';
    game.controls.enabled = true;
    game.leaveSeat();
    show('hud', false);
    show('select', false);
    show('title');
  }

  let selectIndex = 0;
  function toSelect() {
    game.mode = 'select';
    game.controls.enabled = false; // 席選びではドラッグを左右のスワイプに使う
    show('title', false);
    show('hud', false);
    show('select');
    updateSelect();
  }
  function updateSelect() {
    $('seat-desc').textContent = game.seatDescription(selectIndex);
    game.lookAtSeat(selectIndex);
  }

  function startPlay() {
    game.setSeat(selectIndex);
    game.mode = 'play';
    game.controls.enabled = true;
    show('select', false);
    show('hud');
    game.lookAtSeat(selectIndex);
    updateHud();
  }

  function newGame() {
    game.resetMoney();
    progress.box = [];
    saveProgress(progress);
    game.setupBoard();
    game.settle(2.0);
  }

  // ---- 表示の更新 ----
  function updateHud() {
    $('money').textContent = String(game.money);
    $('spent').textContent = String(game.spent);
    $('credit').textContent = String(game.credits);
    ($('btn-coin') as HTMLButtonElement).disabled = !game.canCoin;
    // 「すくう」と「おとす」は1つのボタンで切り替える
    const phase = game.arms[game.seat].phase;
    const dropSide = phase === 'waitDrop' || phase === 'dump' || phase === 'hold' || phase === 'reset';
    const btn = $('btn-action') as HTMLButtonElement;
    let label = 'すくう', sub = '';
    if (phase === 'waitDrop') label = 'おとす';
    else if (dropSide) { label = 'おとす'; sub = 'おとしています…'; }
    else if (phase !== 'idle') sub = 'すくっています…';
    else if (game.credits === 0 && game.mode === 'play') sub = 'コインを入れてね';
    $('btn-action-label').textContent = label;
    $('btn-action-sub').textContent = sub;
    btn.classList.toggle('scoop', !dropSide);
    btn.classList.toggle('drop', dropSide);
    btn.disabled = !(game.canScoop || game.canDrop);
    btn.classList.toggle('ready', game.canScoop || game.canDrop);
    ($('btn-onedari') as HTMLButtonElement).disabled = game.cleared;
  }
  function updateTimer() {
    const { label, sec } = game.timerInfo();
    $('timer-label').textContent = label || 'すくう';
    $('timer').textContent = sec === null ? '--' : String(sec).padStart(2, '0');
    $('timer-box').classList.toggle('warn', sec !== null && sec <= 10);
  }

  // 景品を取ったら「GET!」と出し、取った景品の絵をポンポンとはね出させる。最後に取ってから1秒で消す
  let getTimer = 0;
  function onCollected(key: string) {
    const def = PRIZE[key];
    const icons = $('get-icons');
    if ($('get').hidden) icons.innerHTML = '';
    const img = document.createElement('img');
    img.src = ICONS[key];
    img.alt = def.name;
    if (def.big || key === 'gemLarge') img.className = 'big';
    icons.appendChild(img);
    while (icons.children.length > 8) icons.firstElementChild.remove();
    const text = $('get-text');
    const big = def.big || icons.querySelector('img.big');
    text.textContent = def.big ? '大物GET!' : big ? text.textContent : 'GET!';
    text.classList.toggle('big', !!def.big || text.textContent === '大物GET!');
    // 文字も取るたびにはねさせる
    text.style.animation = 'none';
    void text.offsetWidth;
    text.style.animation = '';
    show('get');
    clearTimeout(getTimer);
    getTimer = window.setTimeout(() => show('get', false), def.big ? 1600 : 1000);
  }

  // お金を使い切ったら、宝箱を開いて取った景品を知らせ、続けるか終わるかを選んでもらう
  function onBroke() {
    $('broke-count').textContent = String(progress.box.length);
    show('broke');
    openChest();
  }
  function closeChest() {
    chest.close();
    show('chest', false);
    show('broke', false);
  }
  $('broke-onedari').onclick = () => { closeChest(); game.begOnedari(); };
  $('broke-end').onclick = () => { closeChest(); game.resetMoney(); toTitle(); updateHud(); };

  function onCleared() {
    progress.clears++;
    const next = unlockNext(progress);
    saveProgress(progress);
    $('r-spent').textContent = `${game.spent}円`;
    $('r-onedari').textContent = `${game.onedari}回`;
    $('r-count').textContent = `${progress.box.length}個`;
    $('r-unlock').innerHTML = next
      ? `<img src="${ICONS[next]}" alt=""><p>新しい大物が台に出るようになりました<br><b>${PRIZE[next].name}</b></p>`
      : `<p><b>全種類コンプリート！</b><br>大物10種類がすべて台に出るようになっています。</p>`;
    game.sound.stopBgm();
    show('clear');
  }

  // ---- 宝箱・図鑑 ----
  function openChest() {
    show('chest');
    chest.open(progress.box);
  }
  $('chest-close').onclick = closeChest;

  function openZukan() {
    const got = PRIZES.filter((p) => (progress.zukan[p.key] ?? 0) > 0).length;
    $('zukan-count').textContent = `${got} / ${PRIZES.length}種類`;
    $('zukan-grid').innerHTML = PRIZES.map((p) => {
      const n = progress.zukan[p.key] ?? 0;
      const locked = p.big && !progress.unlocked.includes(p.key);
      return `<div class="zukan-item${n ? '' : ' none'}${p.big ? ' big' : ''}${locked && !n ? ' locked' : ''}">
        <img src="${ICONS[p.key]}" alt="">
        <span class="name">${n || !locked ? p.name : '？？？'}</span>
        <span class="count">${n}個</span>
      </div>`;
    }).join('');
    show('zukan');
  }

  document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => (b.onclick = () => show(b.dataset.close, false)));

  // ---- 設定 ----
  ($('set-volume') as HTMLInputElement).value = String(settings.volume);
  ($('set-mute') as HTMLInputElement).checked = settings.muted;
  const saveSettings = () => saveJSON(SETTINGS_KEY, settings);
  $('set-volume').oninput = (e) => { settings.volume = Number((e.target as HTMLInputElement).value); sound.setVolume(settings.volume); saveSettings(); };
  $('set-mute').onchange = (e) => { settings.muted = (e.target as HTMLInputElement).checked; sound.setMuted(settings.muted); saveSettings(); };
  const markQuality = () => document.querySelectorAll<HTMLElement>('#set-quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === settings.quality));
  markQuality();
  document.querySelectorAll<HTMLElement>('#set-quality button').forEach((b) => (b.onclick = () => {
    settings.quality = b.dataset.q as any;
    game.setQuality(settings.quality);
    markQuality();
    saveSettings();
  }));
  $('set-reset').onclick = () => show('reset-confirm');
  $('reset-no').onclick = () => show('reset-confirm', false);
  $('reset-yes').onclick = () => {
    clearProgress();
    const fresh = loadProgress();
    Object.assign(progress, fresh);
    saveProgress(progress);
    show('reset-confirm', false);
    game.ev.toast('データを消しました');
  };

  // ---- ボタン ----
  const unlockAudio = () => sound.unlock();
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  $('t-start').onclick = () => { sound.unlock(); if (game.cleared) newGame(); selectIndex = game.seat; toSelect(); };
  $('t-chest').onclick = openChest;
  $('t-zukan').onclick = openZukan;
  $('t-howto').onclick = () => show('howto');
  $('t-settings').onclick = () => show('settings');

  const prevSeat = () => { selectIndex = (selectIndex + 3) % 4; updateSelect(); };
  const nextSeat = () => { selectIndex = (selectIndex + 1) % 4; updateSelect(); };
  $('seat-prev').onclick = prevSeat;
  $('seat-next').onclick = nextSeat;
  // 席選び：左右にスワイプして席を変える（左へスワイプで次の席）
  let swipeX: number | null = null;
  $('view').addEventListener('pointerdown', (e) => { if (game.mode === 'select') swipeX = e.clientX; });
  addEventListener('pointerup', (e) => {
    if (game.mode !== 'select' || swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) nextSeat(); else prevSeat();
  });
  addEventListener('keydown', (e) => {
    if (game.mode !== 'select') return;
    if (e.code === 'ArrowLeft') prevSeat();
    else if (e.code === 'ArrowRight') nextSeat();
    else if (e.code === 'Enter') startPlay();
  });
  $('seat-ok').onclick = startPlay;

  $('btn-coin').onclick = () => game.insertCoin();
  const action = () => { if (game.canDrop) game.drop(); else game.scoop(); updateHud(); };
  $('btn-action').onclick = action;
  $('btn-onedari').onclick = () => game.begOnedari();
  $('btn-chest').onclick = openChest;
  $('btn-camera').onclick = () => game.lookAtSeat(game.seat);
  $('btn-menu').onclick = () => {
    ($('m-seat') as HTMLButtonElement).disabled = !game.canChangeSeat;
    $('m-note').textContent = game.credits > 0 ? `席を移ると、残りのクレジット${game.credits}枚は払い戻します。` : '';
    show('menu');
  };
  $('m-close').onclick = () => show('menu', false);
  $('m-seat').onclick = () => { show('menu', false); game.leaveSeat(); selectIndex = game.seat; toSelect(); updateHud(); };
  $('m-zukan').onclick = () => { show('menu', false); openZukan(); };
  $('m-howto').onclick = () => { show('menu', false); show('howto'); };
  $('m-settings').onclick = () => { show('menu', false); show('settings'); };
  $('m-title').onclick = () => { show('menu', false); toTitle(); };

  $('c-chest').onclick = openChest;
  $('c-again').onclick = () => { show('clear', false); newGame(); selectIndex = 0; toSelect(); };

  // PC のキー操作（仕様書13.2節）
  addEventListener('keydown', (e) => {
    if (game.mode !== 'play' || e.repeat) return;
    if (e.code === 'KeyC') game.insertCoin();
    else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); action(); }
    else if (e.code === 'KeyR') game.lookAtSeat(game.seat);
  });

  // 画面が裏に回ったら止める
  document.addEventListener('visibilitychange', () => { game.paused = document.hidden; last = performance.now(); });

  // ---- ループ ----
  const fpsEl = $('fps');
  const debug = location.hash === '#debug';
  show('fps', debug);
  if (debug) (window as any).game = game;
  let last = performance.now();
  let frames = 0, fpsT = 0, timerT = 0;
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    game.update(dt);
    timerT += dt;
    if (timerT > 0.2) { timerT = 0; updateTimer(); updateHud(); }
    if (debug) {
      frames++;
      fpsT += dt;
      if (fpsT > 0.5) { fpsEl.textContent = `${Math.round(frames / fpsT)} fps ・ 景品 ${game.physics.prizes.length}`; frames = 0; fpsT = 0; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  toTitle();
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading-text');
  // どこで止まったかが分かるよう、段階とエラーの内容も出す
  if (el) el.textContent = `読み込めませんでした。ページを開き直してください。（${stage}：${err?.message ?? err}）`;
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = false;
});
