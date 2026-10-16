/* ==========================================================
 * 数独核心引擎：确定性生成（同一关卡号永远生成同一盘面）
 * ========================================================== */

/** 可复现的伪随机数生成器 (mulberry32) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptyGrid() {
  return Array.from({ length: 81 }, () => 0);
}

function idx(r, c) { return r * 9 + c; }

function canPlace(grid, i, v) {
  const r = Math.floor(i / 9), c = i % 9;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (grid[idx(r, k)] === v) return false;
    if (grid[idx(k, c)] === v) return false;
    if (grid[idx(br + Math.floor(k / 3), bc + (k % 3))] === v) return false;
  }
  return true;
}

/** 随机生成一个完整终盘 */
function generateSolution(rng) {
  const grid = emptyGrid();
  function fill(pos) {
    if (pos === 81) return true;
    const order = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (const v of order) {
      if (canPlace(grid, pos, v)) {
        grid[pos] = v;
        if (fill(pos + 1)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  }
  fill(0);
  return grid;
}

/**
 * 数解个数（最多数到 limit 个即返回）
 * @returns {number} 解的数量（1、2 或更多时提前返回）
 */
function countSolutions(grid, limit = 2) {
  const g = grid.slice();
  let count = 0;

  function solve() {
    if (count >= limit) return;
    // 找候选数最少的空格，加速搜索
    let best = -1, bestMask = null, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      let mask = 0, n = 0;
      for (let v = 1; v <= 9; v++) {
        if (canPlace(g, i, v)) { mask |= (1 << v); n++; }
      }
      if (n === 0) return;
      if (n < bestCount) { bestCount = n; best = i; bestMask = mask; if (n === 1) break; }
    }
    if (best === -1) { count++; return; }
    for (let v = 1; v <= 9; v++) {
      if (bestMask & (1 << v)) {
        g[best] = v;
        solve();
        g[best] = 0;
        if (count >= limit) return;
      }
    }
  }
  solve();
  return count;
}

/** 难度配置：初级10关 / 中级20关 / 高级50关 */
const DIFFICULTIES = [
  { key: 'easy',   name: '初级', icon: '🟢', levels: 10, clues: 43, desc: '适合入门，轻松上手' },
  { key: 'medium', name: '中级', icon: '🟡', levels: 20, clues: 35, desc: '需要一些推理技巧' },
  { key: 'hard',   name: '高级', icon: '🔴', levels: 50, clues: 28, desc: '挑战极限，只有高手能通关' },
];

/**
 * 根据难度与关卡号生成唯一解数独盘面
 * @param {string} diffKey 难度 key
 * @param {number} level 关卡号（从 1 开始）
 */
function generatePuzzle(diffKey, level) {
  const d = DIFFICULTIES.find(x => x.key === diffKey);
  const seed = (DIFFICULTIES.indexOf(d) + 1) * 100000 + level * 7919;
  const rng = mulberry32(seed);

  const solution = generateSolution(rng);
  const puzzle = solution.slice();
  const targetBlanks = 81 - d.clues;

  // 对称 + 随机混合挖洞，保证唯一解
  const positions = shuffled(
    Array.from({ length: 41 }, (_, i) => i), rng
  );

  let blanks = 0;
  for (const p of positions) {
    if (blanks >= targetBlanks) break;
    const mirror = 80 - p;
    const cells = p === mirror ? [p] : [p, mirror];
    const removed = [];
    let ok = true;
    for (const cell of cells) {
      if (puzzle[cell] !== 0 && blanks + removed.length < targetBlanks) {
        removed.push(cell);
        puzzle[cell] = 0;
      }
    }
    if (removed.length === 0) continue;
    if (countSolutions(puzzle) !== 1) {
      for (const cell of removed) puzzle[cell] = solution[cell];
    } else {
      blanks += removed.length;
    }
  }

  // 若对称挖洞不足，继续随机补挖
  if (blanks < targetBlanks) {
    const rest = shuffled(Array.from({ length: 81 }, (_, i) => i), rng)
      .filter(i => puzzle[i] !== 0);
    for (const cell of rest) {
      if (blanks >= targetBlanks) break;
      const backup = puzzle[cell];
      puzzle[cell] = 0;
      if (countSolutions(puzzle) === 1) blanks++;
      else puzzle[cell] = backup;
    }
  }

  return { puzzle, solution };
}
