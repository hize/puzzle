/* ==========================================================================
   engine.js — 纯逻辑的推箱子引擎（不接触 DOM）
   ========================================================================== */
(function () {
  'use strict';

  const NS = (window.Sokoban = window.Sokoban || {});

  const DIRS = {
    up: [0, -1],
    right: [1, 0],
    down: [0, 1],
    left: [-1, 0],
  };

  const DIR_ORDER = ['up', 'right', 'down', 'left'];

  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  /**
   * 地图字符约定（与脚本生成的关卡一致）：
   *   '#' 墙  ' ' 地板  '.' 目标  '$' 箱子  '*' 箱子在目标上  '@' 玩家  '+' 玩家在目标上
   */
  class Game {
    constructor(level) {
      this.level = level;
      this.width = level.width;
      this.height = level.height;
      this.rows = level.map;

      const size = this.width * this.height;
      this.walls = new Uint8Array(size);
      this.goals = new Set();
      this.startBoxes = [];
      this.startPlayer = -1;

      for (let y = 0; y < this.height; y++) {
        const row = this.rows[y] || '';
        for (let x = 0; x < this.width; x++) {
          const ch = row[x] || ' ';
          const i = y * this.width + x;
          if (ch === '#') this.walls[i] = 1;
          if (ch === '.' || ch === '*' || ch === '+') this.goals.add(i);
          if (ch === '$' || ch === '*') this.startBoxes.push(i);
          if (ch === '@' || ch === '+') this.startPlayer = i;
        }
      }

      if (this.startPlayer < 0) this.startPlayer = this._fallbackPlayer();

      this.reset();
    }

    _fallbackPlayer() {
      const occupied = new Set(this.startBoxes);
      for (let i = 0; i < this.walls.length; i++) {
        if (!this.walls[i] && !occupied.has(i)) return i;
      }
      return 0;
    }

    /* ---------------------------------------------------------- 生命周期 */

    reset() {
      this.boxes = new Set(this.startBoxes);
      // 每个箱子一个稳定 id，便于渲染层做平滑动画
      this.boxIdOf = new Map();
      this.startBoxes.forEach((pos, i) => this.boxIdOf.set(pos, i));
      this.player = this.startPlayer;
      this.history = [];
      this.moves = 0;
      this.pushes = 0;
      this.solved = this._checkSolved();
      return this;
    }

    _checkSolved() {
      for (const b of this.boxes) {
        if (!this.goals.has(b)) return false;
      }
      return true;
    }

    /* ------------------------------------------------------------ 工具 */

    isWall(i) {
      return this.walls[i] === 1;
    }

    xy(i) {
      const x = i % this.width;
      return [x, (i - x) / this.width];
    }

    index(x, y) {
      return y * this.width + x;
    }

    inside(x, y) {
      return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    /** 玩家在不推箱子的前提下能走到的所有格子。 */
    reachable(from) {
      const seen = new Set([from]);
      const stack = [from];
      while (stack.length) {
        const cur = stack.pop();
        const [x, y] = this.xy(cur);
        for (const d of DIR_ORDER) {
          const [dx, dy] = DIRS[d];
          const nx = x + dx;
          const ny = y + dy;
          if (!this.inside(nx, ny)) continue;
          const j = this.index(nx, ny);
          if (seen.has(j) || this.isWall(j) || this.boxes.has(j)) continue;
          seen.add(j);
          stack.push(j);
        }
      }
      return seen;
    }

    /** 箱子是否被推进了永远无法再移动的死角。 */
    isBoxDeadlocked(boxIndex) {
      if (this.goals.has(boxIndex)) return false;
      const [x, y] = this.xy(boxIndex);
      const wall = (dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        return !this.inside(nx, ny) || this.isWall(this.index(nx, ny));
      };
      const up = wall(0, -1);
      const down = wall(0, 1);
      const left = wall(-1, 0);
      const right = wall(1, 0);
      return (up || down) && (left || right);
    }

    /* ------------------------------------------------------------ 操作 */

    /**
     * 朝指定方向移动一步。
     * @returns {null|{pushed:boolean, dir:string, player:number, box:?object}}
     */
    move(dir) {
      const d = DIRS[dir];
      if (!d) return null;

      const [dx, dy] = d;
      const [px, py] = this.xy(this.player);
      const nx = px + dx;
      const ny = py + dy;
      if (!this.inside(nx, ny)) return null;

      const target = this.index(nx, ny);
      if (this.isWall(target)) return null;

      let box = null;
      if (this.boxes.has(target)) {
        const bx = nx + dx;
        const by = ny + dy;
        if (!this.inside(bx, by)) return null;
        const beyond = this.index(bx, by);
        if (this.isWall(beyond) || this.boxes.has(beyond)) return null;

        const id = this.boxIdOf.get(target);
        this.boxes.delete(target);
        this.boxes.add(beyond);
        this.boxIdOf.delete(target);
        this.boxIdOf.set(beyond, id);
        box = { from: target, to: beyond, id };
      }

      this.history.push({ player: this.player, box });
      this.player = target;
      this.moves += 1;
      if (box) this.pushes += 1;
      this.solved = this._checkSolved();

      return { pushed: !!box, dir, player: target, box };
    }

    undo() {
      const last = this.history.pop();
      if (!last) return null;
      if (last.box) {
        this.boxes.delete(last.box.to);
        this.boxes.add(last.box.from);
        this.boxIdOf.delete(last.box.to);
        this.boxIdOf.set(last.box.from, last.box.id);
        this.pushes -= 1;
      }
      this.player = last.player;
      this.moves -= 1;
      this.solved = this._checkSolved();
      return last;
    }

    /** 反复撤销直到回到出发点（清空历史）。 */
    undoAll() {
      let count = 0;
      while (this.history.length) {
        this.undo();
        count += 1;
      }
      return count;
    }

    /**
     * 校验一条解法字符串（urdl / URDL 表示是否推箱）。
     * 生成脚本给出的 solution 为小写走位 + 大写推动字母。
     */
    verify(solution) {
      this.reset();
      for (const ch of solution) {
        const idx = 'URDL'.indexOf(ch.toUpperCase());
        if (idx < 0) return false;
        if (!this.move(DIR_ORDER[idx])) return false;
      }
      return this.solved;
    }
  }

  NS.Game = Game;
  NS.DIRS = DIRS;
  NS.DIR_ORDER = DIR_ORDER;
  NS.OPPOSITE = OPPOSITE;
})();
