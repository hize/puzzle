/* ==========================================================
 * 数独大师 - 应用逻辑
 * ========================================================== */

/* ---------- 进度存储 ---------- */
const STORE_KEY = 'sudoku-master-progress-v1';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORE_KEY, JSON.stringify(p)); }

function getLevelRecord(diffKey, level) {
  const p = loadProgress();
  return (p[diffKey] && p[diffKey][level]) || null;
}
function setLevelRecord(diffKey, level, rec) {
  const p = loadProgress();
  if (!p[diffKey]) p[diffKey] = {};
  p[diffKey][level] = rec;
  saveProgress(p);
}
function isUnlocked(diffKey, level) {
  if (level === 1) return true;
  return !!getLevelRecord(diffKey, level - 1);
}
function diffDoneCount(diffKey, total) {
  const p = loadProgress();
  const recs = p[diffKey] || {};
  return Object.keys(recs).filter(k => recs[k] && recs[k].done).length;
}

/* ---------- 统计数据 ---------- */
const STATS_KEY = 'sudoku-master-stats-v1';

function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; }
  catch { return {}; }
}
function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }

function getDiffStats(diffKey) {
  const s = loadStats()[diffKey];
  return { wins: 0, streak: 0, maxStreak: 0, bestTime: null, ...(s || {}) };
}

/** 秒 → mm:ss */
function fmtTime(sec) {
  if (sec == null) return '--';
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** 通关：胜场 +1，连续胜场 +1（记录最大连续胜场），刷新最快用时 */
function recordWin(diffKey, seconds) {
  const all = loadStats();
  const d = { wins: 0, streak: 0, maxStreak: 0, bestTime: null, ...(all[diffKey] || {}) };
  d.wins++;
  d.streak++;
  d.maxStreak = Math.max(d.maxStreak, d.streak);
  if (seconds > 0 && (d.bestTime == null || seconds < d.bestTime)) d.bestTime = seconds;
  all[diffKey] = d;
  saveStats(all);
}

/** 失败：连续胜场清零 */
function recordFail(diffKey) {
  const all = loadStats();
  const d = { wins: 0, streak: 0, maxStreak: 0, bestTime: null, ...(all[diffKey] || {}) };
  d.streak = 0;
  all[diffKey] = d;
  saveStats(all);
}

/* ---------- 屏幕切换 ---------- */
const screens = {
  home: document.getElementById('screen-home'),
  levels: document.getElementById('screen-levels'),
  stats: document.getElementById('screen-stats'),
  game: document.getElementById('screen-game'),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ---------- 首页渲染 ---------- */
function renderHome() {
  const list = document.getElementById('diff-list');
  list.innerHTML = '';
  DIFFICULTIES.forEach(d => {
    const done = diffDoneCount(d.key, d.levels);
    const card = document.createElement('div');
    card.className = `diff-card ${d.key}`;
    card.innerHTML = `
      <div class="diff-emoji">${d.icon}</div>
      <div class="diff-info">
        <h2>${d.name} <small style="color:var(--text-sub);font-size:12px;font-weight:500">${d.levels} 关</small></h2>
        <p>${d.desc}</p>
        <div class="diff-stats">
          <div class="bar"><i style="width:${Math.round(done / d.levels * 100)}%"></i></div>
          <span>${done}/${d.levels}</span>
        </div>
      </div>
      <div class="diff-arrow">›</div>
    `;
    card.onclick = () => openLevels(d);
    list.appendChild(card);
  });
}

/* ---------- 关卡选择渲染 ---------- */
let currentDiff = null;

function openLevels(d) {
  currentDiff = d;
  document.getElementById('levels-title').textContent = `${d.icon} ${d.name}`;
  renderLevels();
  showScreen('levels');
}

function renderLevels() {
  const d = currentDiff;
  const grid = document.getElementById('level-grid');
  const done = diffDoneCount(d.key, d.levels);
  document.getElementById('levels-progress').textContent = `${done}/${d.levels}`;
  grid.innerHTML = '';
  for (let lv = 1; lv <= d.levels; lv++) {
    const rec = getLevelRecord(d.key, lv);
    const unlocked = isUnlocked(d.key, lv);
    const el = document.createElement('div');
    el.className = 'level-item'
      + (unlocked ? '' : ' locked')
      + (rec && rec.done ? ' done' : '');
    if (unlocked && !rec) el.classList.add('current');
    const stars = rec && rec.done
      ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars)
      : (unlocked ? '' : '🔒');
    el.innerHTML = `<div class="num">${lv}</div><div class="stars">${stars}</div>`;
    if (unlocked) el.onclick = () => startGame(d, lv);
    grid.appendChild(el);
  }
}

/* ---------- 统计页面渲染 ---------- */
function renderStats() {
  const list = document.getElementById('stats-list');
  list.innerHTML = '';
  let totalWins = 0;

  DIFFICULTIES.forEach(d => {
    const s = getDiffStats(d.key);
    const done = diffDoneCount(d.key, d.levels);
    totalWins += s.wins;
    const card = document.createElement('div');
    card.className = `stats-card ${d.key}`;
    card.innerHTML = `
      <div class="stats-head">
        <span class="stats-emoji">${d.icon}</span>
        <span class="stats-name">${d.name}</span>
        <span class="stats-progress">通关 ${done}/${d.levels}</span>
      </div>
      <div class="stats-metrics">
        <div class="metric"><b>${s.wins}</b><span>当前胜场</span></div>
        <div class="metric"><b>${s.streak}</b><span>连续胜场</span></div>
        <div class="metric"><b>${s.maxStreak}</b><span>最大胜场</span></div>
        <div class="metric"><b>${fmtTime(s.bestTime)}</b><span>最快用时</span></div>
      </div>
    `;
    list.appendChild(card);
  });

  document.getElementById('stats-total').textContent = `总胜场 ${totalWins}`;
}

/* ---------- 游戏状态 ---------- */
const G = {
  diff: null, level: 1,
  puzzle: null, solution: null,
  values: [],          // 当前盘面
  notes: [],           // 笔记
  given: [],           // 是否题目给定
  selected: -1,
  highlightNum: 0,     // 键盘点选的数字高亮
  mistakes: 0, hints: 3,
  notesMode: false,
  seconds: 0, timerId: null, paused: false,
  finished: false,
};

const MAX_MISTAKES = 3;

function startGame(d, level) {
  G.diff = d; G.level = level;
  const { puzzle, solution } = generatePuzzle(d.key, level);
  G.puzzle = puzzle; G.solution = solution;
  G.values = puzzle.slice();
  G.notes = Array.from({ length: 81 }, () => 0);
  G.given = puzzle.map(v => v !== 0);
  G.selected = -1;
  G.highlightNum = 0;
  G.mistakes = 0; G.hints = 3;
  G.notesMode = false;
  G.seconds = 0; G.paused = false;
  G.finished = false;

  document.getElementById('game-title').textContent = `${d.name} · 第 ${level} 关`;
  buildBoard();
  buildNumpad();
  updateStatus();
  updateToolbar();
  showScreen('game');
  startTimer();
}

function restartGame() {
  startGame(G.diff, G.level);
}

/* ---------- 计时器 ---------- */
function startTimer() {
  stopTimer();
  G.timerId = setInterval(() => {
    if (!G.paused && !G.finished) {
      G.seconds++;
      renderTimer();
    }
  }, 1000);
  renderTimer();
}
function stopTimer() { if (G.timerId) clearInterval(G.timerId); G.timerId = null; }
function renderTimer() {
  const m = String(Math.floor(G.seconds / 60)).padStart(2, '0');
  const s = String(G.seconds % 60).padStart(2, '0');
  document.getElementById('game-timer').textContent = `${m}:${s}`;
}

/* ---------- 棋盘渲染 ---------- */
const boardEl = document.getElementById('board');
const cellEls = [];

function buildBoard() {
  boardEl.innerHTML = '';
  cellEls.length = 0;
  // 9 个 3x3 宫块，宫块之间留缝，视觉上分组更清晰
  const boxes = [];
  for (let b = 0; b < 9; b++) {
    const box = document.createElement('div');
    box.className = 'box';
    boardEl.appendChild(box);
    boxes.push(box);
  }
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.onclick = () => selectCell(i);
    boxes[b].appendChild(cell);
    cellEls.push(cell);
  }
  renderBoard();
}

function peerIndices(i) {
  const r = Math.floor(i / 9), c = i % 9;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  const set = new Set();
  for (let k = 0; k < 9; k++) {
    set.add(idx(r, k)); set.add(idx(k, c));
    set.add(idx(br + Math.floor(k / 3), bc + (k % 3)));
  }
  set.delete(i);
  return set;
}

function renderBoard() {
  // 高亮数字：优先取键盘点选的数字（与点击盘面数字的观感一致），
  // 其次回退到选中格的数字
  const selVal = G.highlightNum ||
    (G.selected >= 0 && G.values[G.selected] !== 0 ? G.values[G.selected] : 0);
  const peers = G.selected >= 0 ? peerIndices(G.selected) : new Set();

  // 错误标记：只要填写的数字与答案不符就标红（无论是否与同行列宫重复）
  const conflicts = new Set();
  for (let i = 0; i < 81; i++) {
    if (G.given[i] || G.values[i] === 0) continue;
    if (G.values[i] !== G.solution[i]) conflicts.add(i);
  }

  for (let i = 0; i < 81; i++) {
    const el = cellEls[i];
    const v = G.values[i];
    el.className = 'cell';
    if (G.given[i]) el.classList.add('given');
    else if (v !== 0) el.classList.add('user');
    if (i === G.selected) el.classList.add('sel');
    else if (peers.has(i)) el.classList.add('peer');
    if (v !== 0 && v === selVal && i !== G.selected) el.classList.add('same');
    if (conflicts.has(i)) el.classList.add('conflict');

    // 数值变化时才重建 DOM，触发弹入动画
    if (v !== 0) {
      if (el.dataset.v !== String(v)) {
        el.dataset.v = String(v);
        el.innerHTML = '';
        const span = document.createElement('span');
        span.className = 'val pop';
        span.textContent = v;
        el.appendChild(span);
      }
    } else {
      delete el.dataset.v;
      const noteBits = G.notes[i] || 0;
      if (el.dataset.n !== String(noteBits) || el.querySelector('.val')) {
        el.dataset.n = String(noteBits);
        el.innerHTML = '';
        if (noteBits) {
          const notes = document.createElement('div');
          notes.className = 'notes';
          for (let n = 1; n <= 9; n++) {
            const s = document.createElement('span');
            s.textContent = (noteBits & (1 << n)) ? n : '';
            notes.appendChild(s);
          }
          el.appendChild(notes);
        }
      }
    }
  }
}

function selectCell(i) {
  if (G.paused || G.finished) return;
  G.selected = (G.selected === i) ? -1 : i;
  G.highlightNum = 0;   // 点击格子后改由选中格决定高亮
  renderBoard();
  updateNumpad();
}

/* ---------- 数字键盘 ---------- */
const numpadEl = document.getElementById('numpad');
const numBtnEls = [];

function buildNumpad() {
  numpadEl.innerHTML = '';
  numBtnEls.length = 0;
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.textContent = n;
    btn.onclick = () => inputNumber(n);
    numpadEl.appendChild(btn);
    numBtnEls.push(btn);
  }
  updateNumpad();
}

/** 同步数字键状态：填满 9 个则隐藏占位；高亮当前选中的数字 */
function updateNumpad() {
  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) counts[G.values[i]]++;
  for (let n = 1; n <= 9; n++) {
    const btn = numBtnEls[n - 1];
    btn.classList.toggle('done', counts[n] >= 9);
    btn.classList.toggle('selected', G.highlightNum === n);
  }
}

function inputNumber(n) {
  if (G.paused || G.finished) return;

  const i = G.selected;
  // 当前选中格是否可写入（未选中 / 题目给定 / 已填对 都不可写）
  const canFill = i >= 0 && !G.given[i] && !(G.values[i] !== 0 && G.values[i] === G.solution[i]);

  // 与点击盘面数字一致：高亮盘面上所有该数字（不可填写时再次点击可取消）
  G.highlightNum = (G.highlightNum === n && !canFill) ? 0 : n;

  if (!canFill) {
    // 点击的数字与盘面上一次点击的数字不同时，取消上次的选择高亮
    if (i >= 0 && G.values[i] !== 0 && G.values[i] !== n) {
      G.selected = -1;
    }
    renderBoard();
    updateNumpad();
    return;
  }

  if (G.notesMode) {
    if (G.values[i] === 0) G.notes[i] ^= (1 << n);
    renderBoard();
    updateNumpad();
    return;
  }

  G.values[i] = n;
  G.notes[i] = 0;

  let wrong = false;
  if (n === G.solution[i]) {
    // 正确：清除同区笔记
    for (const j of peerIndices(i)) G.notes[j] &= ~(1 << n);
  } else {
    wrong = true;
    G.mistakes++;
    if (navigator.vibrate) navigator.vibrate(80);
  }

  renderBoard();
  if (wrong) {
    cellEls[i].classList.add('error-flash');
    setTimeout(() => cellEls[i] && cellEls[i].classList.remove('error-flash'), 450);
  }
  updateNumpad();
  updateStatus();
  checkEnd();
}

/* ---------- 擦除 / 提示 ---------- */
function erase() {
  if (G.paused || G.finished || G.selected < 0 || G.given[G.selected]) return;
  const i = G.selected;
  if (G.values[i] === 0 && G.notes[i] === 0) return;
  G.values[i] = 0;
  G.notes[i] = 0;
  renderBoard();
  updateNumpad();
}

function hint() {
  if (G.paused || G.finished || G.hints <= 0) return;
  let target = (G.selected >= 0 && !G.given[G.selected] && G.values[G.selected] !== G.solution[G.selected])
    ? G.selected
    : -1;
  if (target === -1) {
    const empties = [];
    for (let i = 0; i < 81; i++) {
      if (!G.given[i] && G.values[i] !== G.solution[i]) empties.push(i);
    }
    if (empties.length === 0) return;
    target = empties[Math.floor(Math.random() * empties.length)];
  }
  G.hints--;
  G.values[target] = G.solution[target];
  G.notes[target] = 0;
  for (const j of peerIndices(target)) G.notes[j] &= ~(1 << G.solution[target]);
  G.selected = target;
  renderBoard();
  updateNumpad();
  updateStatus();
  checkEnd();
}

/* ---------- 状态栏 / 工具栏 ---------- */
function updateStatus() {
  const m = document.getElementById('chip-mistakes');
  m.innerHTML = `错误 <b>${G.mistakes}</b>/${MAX_MISTAKES}`;
  m.classList.toggle('danger', G.mistakes >= MAX_MISTAKES - 1);
  document.getElementById('chip-hints').innerHTML = `提示 <b>${G.hints}</b>`;
}

function updateToolbar() {
  document.getElementById('btn-hint').classList.toggle('disabled', G.hints <= 0);
  document.getElementById('btn-notes').classList.toggle('on', G.notesMode);
}

/* ---------- 结束判定 ---------- */
function checkEnd() {
  if (G.mistakes >= MAX_MISTAKES) { fail(); return; }
  const complete = G.values.every((v, i) => v === G.solution[i]);
  if (complete) win();
}

function starsFor() {
  let s = 3;
  if (G.mistakes > 0) s--;
  if (G.mistakes > 1 || G.hints < 3) s--;
  if (G.mistakes > 2 || G.hints < 1) s--;
  return Math.max(1, s);
}

function stopGameUi() {
  G.finished = true;
  stopTimer();
  G.paused = true;
}

function win() {
  stopGameUi();
  const stars = starsFor();
  const rec = getLevelRecord(G.diff.key, G.level);
  const best = rec && rec.done ? Math.min(rec.time, G.seconds) : G.seconds;
  const bestStars = rec && rec.done ? Math.max(rec.stars, stars) : stars;
  setLevelRecord(G.diff.key, G.level, { done: true, time: best, stars: bestStars, mistakes: G.mistakes });
  recordWin(G.diff.key, G.seconds);

  document.getElementById('win-stats').innerHTML = `
    <div class="item"><b>${fmtTime(G.seconds)}</b><span>用时</span></div>
    <div class="item"><b>${G.mistakes}</b><span>错误</span></div>
    <div class="item"><b>${3 - G.hints}</b><span>用提示</span></div>
  `;
  document.getElementById('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);

  const hasNext = G.level < G.diff.levels;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.style.display = hasNext ? 'block' : 'none';
  if (!hasNext) {
    document.querySelector('#overlay-win h2').textContent = '🎉 恭喜通关！';
    document.querySelector('#overlay-win p') &&
      (document.querySelector('#overlay-win p').textContent = `你已完成${G.diff.name}全部 ${G.diff.levels} 关！`);
  }
  document.getElementById('overlay-win').classList.remove('hidden');
}

function fail() {
  stopGameUi();
  recordFail(G.diff.key);
  document.getElementById('overlay-fail').classList.remove('hidden');
}

/* ---------- 暂停 ---------- */
function pauseGame() {
  if (G.finished) return;
  G.paused = true;
  document.getElementById('pause-info').textContent =
    `${G.diff.name} · 第 ${G.level} 关 · 已用 ${Math.floor(G.seconds / 60)} 分 ${G.seconds % 60} 秒`;
  document.getElementById('overlay-pause').classList.remove('hidden');
}
function resumeGame() {
  G.paused = false;
  document.getElementById('overlay-pause').classList.add('hidden');
}

/* ---------- 事件绑定 ---------- */
document.getElementById('btn-back-home').onclick = () => { renderHome(); showScreen('home'); };
document.getElementById('btn-back-levels').onclick = () => {
  stopTimer();
  renderLevels();
  showScreen('levels');
};
document.getElementById('btn-pause').onclick = pauseGame;
document.getElementById('btn-resume').onclick = resumeGame;
document.getElementById('btn-restart').onclick = () => {
  document.getElementById('overlay-pause').classList.add('hidden');
  restartGame();
};
document.getElementById('btn-quit').onclick = () => {
  document.getElementById('overlay-pause').classList.add('hidden');
  stopTimer();
  renderLevels();
  showScreen('levels');
};
document.getElementById('btn-erase').onclick = erase;
document.getElementById('btn-notes').onclick = () => {
  G.notesMode = !G.notesMode;
  updateStatus();
  updateToolbar();
};
document.getElementById('btn-hint').onclick = hint;
document.getElementById('btn-fail-retry').onclick = () => {
  document.getElementById('overlay-fail').classList.add('hidden');
  restartGame();
};
document.getElementById('btn-fail-quit').onclick = () => {
  document.getElementById('overlay-fail').classList.add('hidden');
  stopTimer();
  renderLevels();
  showScreen('levels');
};
document.getElementById('btn-next').onclick = () => {
  document.getElementById('overlay-win').classList.add('hidden');
  startGame(G.diff, G.level + 1);
};
document.getElementById('btn-win-quit').onclick = () => {
  document.getElementById('overlay-win').classList.add('hidden');
  stopTimer();
  renderLevels();
  showScreen('levels');
};
document.getElementById('btn-stats').onclick = () => {
  renderStats();
  showScreen('stats');
};
document.getElementById('btn-back-home-stats').onclick = () => showScreen('home');
document.getElementById('btn-reset-stats').onclick = () => {
  if (confirm('确定要重置统计数据吗？此操作不可恢复。')) {
    localStorage.removeItem(STATS_KEY);
    renderStats();
  }
};
document.getElementById('btn-reset-progress').onclick = () => {
  if (confirm('确定要重置全部关卡进度吗？此操作不可恢复。')) {
    localStorage.removeItem(STORE_KEY);
    renderHome();
  }
};

// 键盘支持（桌面调试用）
document.addEventListener('keydown', e => {
  if (!screens.game.classList.contains('active')) return;
  if (e.key >= '1' && e.key <= '9') inputNumber(+e.key);
  else if (e.key === 'Backspace' || e.key === 'Delete') erase();
  else if (e.key === 'n' || e.key === 'N') document.getElementById('btn-notes').click();
  else if (e.key === 'h' || e.key === 'H') hint();
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const dirs = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    let i = G.selected < 0 ? 40 : G.selected + dirs[e.key];
    if (i >= 0 && i < 81) { G.selected = i; renderBoard(); }
  }
});

/* ---------- 启动 ---------- */
renderHome();
showScreen('home');
