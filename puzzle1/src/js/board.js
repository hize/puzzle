/* ==========================================================================
   board.js — 棋盘渲染层（DOM + CSS transform 动画）
   ========================================================================== */
(function () {
  'use strict';

  const NS = (window.Sokoban = window.Sokoban || {});
  const GAP = 3;
  const MAX_CELL = 60;
  const MIN_CELL = 14;

  class BoardView {
    constructor(root, stage) {
      this.root = root;
      this.stage = stage;
      this.game = null;
      this.cell = 40;
      this.cells = [];
      this.boxEls = [];
      this.playerEl = null;
      this._relayout = this.layout.bind(this);

      window.addEventListener('resize', this._relayout);
      window.addEventListener('orientationchange', () => {
        window.setTimeout(this._relayout, 120);
      });
    }

    /* ------------------------------------------------------------- 构建 */

    mount(game) {
      this.game = game;
      const width = game.width;
      const height = game.height;

      this.root.innerHTML = '';
      this.root.classList.remove('solved', 'shake', 'no-anim');
      this.cells = [];
      this.boxEls = [];

      const frag = document.createDocumentFragment();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const cell = document.createElement('div');
          cell.className = 'cell ' + (game.isWall(i) ? 'wall' : 'floor');
          if (game.goals.has(i)) {
            const dot = document.createElement('span');
            dot.className = 'goal-dot';
            cell.appendChild(dot);
          }
          frag.appendChild(cell);
          this.cells.push(cell);
        }
      }

      for (let id = 0; id < game.startBoxes.length; id++) {
        const el = document.createElement('div');
        el.className = 'entity box';
        el.appendChild(document.createElement('i'));
        frag.appendChild(el);
        this.boxEls[id] = el;
      }

      const player = document.createElement('div');
      player.className = 'entity player';
      player.appendChild(document.createElement('i'));
      frag.appendChild(player);
      this.playerEl = player;

      this.root.appendChild(frag);

      this.layout();
      this.sync(false);
    }

    /* ----------------------------------------------------------- 尺寸 */

    layout() {
      const game = this.game;
      if (!game || !this.root.isConnected) return;

      const availW = Math.max(120, this.stage.clientWidth - 36);
      const availH = Math.max(120, this.stage.clientHeight - 28);
      const w = game.width;
      const h = game.height;

      let cell = Math.floor(
        Math.min(
          (availW - GAP * (w - 1)) / w,
          (availH - GAP * (h - 1)) / h
        )
      );
      cell = Math.max(MIN_CELL, Math.min(cell, MAX_CELL));
      this.cell = cell;

      this.root.style.gridTemplateColumns = `repeat(${w}, ${cell}px)`;
      this.root.style.gridTemplateRows = `repeat(${h}, ${cell}px)`;
      this.root.style.gap = GAP + 'px';

      for (const el of this.boxEls) {
        el.style.width = cell + 'px';
        el.style.height = cell + 'px';
      }
      if (this.playerEl) {
        this.playerEl.style.width = cell + 'px';
        this.playerEl.style.height = cell + 'px';
      }

      this.sync(false);
    }

    /* ----------------------------------------------------------- 同步 */

    sync(animate) {
      const game = this.game;
      if (!game) return;

      const step = this.cell + GAP;
      const flip = animate !== true;

      if (flip) this.root.classList.add('no-anim');

      for (const [pos, id] of game.boxIdOf) {
        const el = this.boxEls[id];
        if (!el) continue;
        const x = pos % game.width;
        const y = (pos - x) / game.width;
        el.style.transform = `translate(${x * step}px, ${y * step}px)`;
        el.classList.toggle('on-goal', game.goals.has(pos));
      }

      const px = game.player % game.width;
      const py = (game.player - px) / game.width;
      this.playerEl.style.transform = `translate(${px * step}px, ${py * step}px)`;

      if (flip) {
        void this.root.offsetWidth; // 强制样式刷新，避免出现过渡动画
        this.root.classList.remove('no-anim');
      }

      this.root.classList.toggle('solved', game.solved);
    }

    /* ----------------------------------------------------------- 反馈 */

    shake() {
      this.root.classList.remove('shake');
      void this.root.offsetWidth;
      this.root.classList.add('shake');
      window.setTimeout(() => this.root.classList.remove('shake'), 260);
    }

    celebrate() {
      this.root.classList.add('solved');
    }

    destroy() {
      this.game = null;
      this.root.innerHTML = '';
      this.cells = [];
      this.boxEls = [];
      this.playerEl = null;
    }
  }

  NS.BoardView = BoardView;
})();
