/* ==========================================================================
   ui.js — 界面与交互控制器
   ========================================================================== */
(function () {
  'use strict';

  const NS = (window.Sokoban = window.Sokoban || {});
  const Game = NS.Game;
  const BoardView = NS.BoardView;
  const Storage = NS.Storage;
  const Audio = NS.Audio;

  const TIER_ORDER = ['beginner', 'intermediate', 'advanced'];

  const TIERS = {
    beginner: {
      label: '初级',
      desc: '20 关 · 轻松上手',
      tint: 'rgba(47,211,154,.16)',
    },
    intermediate: {
      label: '中级',
      desc: '50 关 · 需要规划',
      tint: 'rgba(91,157,255,.16)',
    },
    advanced: {
      label: '高级',
      desc: '100 关 · 硬核挑战',
      tint: 'rgba(247,201,72,.16)',
    },
  };

  const ICONS = {
    beginner:
      '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4" fill="#2fd39a"/></svg>',
    intermediate:
      '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="11" width="8" height="10" rx="3" fill="#5b9dff"/><rect x="13" y="3" width="8" height="18" rx="3" fill="#5b9dff"/></svg>',
    advanced:
      '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2.5" y="14" width="6" height="7.5" rx="2.2" fill="#f7c948"/><rect x="9" y="8.5" width="6" height="13" rx="2.2" fill="#f7c948"/><rect x="15.5" y="3" width="6" height="18.5" rx="2.2" fill="#f7c948"/></svg>',
  };

  function $(id) {
    return document.getElementById(id);
  }

  class App {
    constructor(pack) {
      this.pack = pack || {};
      this.tierKey = 'beginner';
      this.list = [];
      this.index = 0;
      this.game = null;
      this.locked = false;

      this.dom = {
        screens: {
          home: $('screen-home'),
          levels: $('screen-levels'),
          game: $('screen-game'),
        },
        tierList: $('tier-list'),
        overall: $('overall-progress'),
        btnResetProgress: $('btn-reset-progress'),
        btnSound: $('btn-sound'),

        levelsBack: $('btn-levels-back'),
        levelsTitle: $('levels-title'),
        levelsSubtitle: $('levels-subtitle'),
        levelsHead: $('levels-head'),
        levelsGrid: $('levels-grid'),
        levelsReset: $('btn-levels-reset'),

        gameBack: $('btn-game-back'),
        gameTitle: $('game-title'),
        gameSubtitle: $('game-subtitle'),
        btnPrev: $('btn-prev'),
        btnNext: $('btn-next'),

        statMoves: $('stat-moves'),
        statPushes: $('stat-pushes'),
        statBest: $('stat-best'),

        stage: $('stage'),
        board: $('board'),

        undo: $('btn-undo'),
        restart: $('btn-restart'),

        modal: $('modal-win'),
        winBadge: $('win-badge'),
        winTitle: $('win-title'),
        winSubtitle: $('win-subtitle'),
        winMoves: $('win-moves'),
        winPushes: $('win-pushes'),
        winBest: $('win-best'),
        winReplay: $('win-replay'),
        winNext: $('win-next'),

        toast: $('toast'),
      };

      this.view = new BoardView(this.dom.board, this.dom.stage);
      this._bind();
      this._syncSoundLabel();
      this.renderHome();
    }

    /* --------------------------------------------------------- 屏幕切换 */

    showScreen(name) {
      Object.keys(this.dom.screens).forEach((key) => {
        this.dom.screens[key].classList.toggle('active', key === name);
      });
      if (name === 'game') {
        window.requestAnimationFrame(() => this.view.layout());
      }
    }

    /* ------------------------------------------------------------ 首页 */

    renderHome() {
      const host = this.dom.tierList;
      host.innerHTML = '';
      let doneTotal = 0;
      let countTotal = 0;

      TIER_ORDER.forEach((key) => {
        const list = this.pack[key] || [];
        if (!list.length) return;
        const done = Storage.doneCount(list.map((lv) => lv.id));
        doneTotal += done;
        countTotal += list.length;
        const pct = list.length ? (done / list.length) * 100 : 0;

        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'tier-card';
        card.innerHTML =
          '<div class="tier-icon" style="background:' +
          TIERS[key].tint +
          '">' +
          ICONS[key] +
          '</div>' +
          '<div class="tier-body">' +
          '<div class="tier-name">' +
          TIERS[key].label +
          '</div>' +
          '<div class="tier-meta">' +
          TIERS[key].desc +
          '</div>' +
          '<div class="bar"><i style="width:' +
          pct.toFixed(1) +
          '%"></i></div>' +
          '</div>' +
          '<div class="tier-meta">' +
          done +
          '/' +
          list.length +
          '</div>' +
          '<div class="chev">›</div>';
        card.addEventListener('click', () => {
          Audio.unlock();
          this.showLevels(key);
        });
        host.appendChild(card);
      });

      this.dom.overall.textContent = '总进度 ' + doneTotal + ' / ' + countTotal;
    }

    /* -------------------------------------------------------- 关卡选择 */

    showLevels(tierKey) {
      this.tierKey = tierKey;
      this.list = this.pack[tierKey] || [];
      const tier = TIERS[tierKey];

      const done = Storage.doneCount(this.list.map((lv) => lv.id));
      this.dom.levelsTitle.textContent = tier.label + '关卡';
      this.dom.levelsSubtitle.textContent =
        done + ' / ' + this.list.length + ' 已完成';
      this.dom.levelsHead.innerHTML =
        '<span>按顺序由易到难</span><span>共 ' + this.list.length + ' 关</span>';

      const grid = this.dom.levelsGrid;
      grid.innerHTML = '';

      this.list.forEach((lv, i) => {
        const rec = Storage.get(lv.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-btn' + (rec ? ' done' : '');
        btn.innerHTML =
          (rec ? '<span class="tick">✓</span>' : '') +
          '<span class="num">' +
          (i + 1) +
          '</span>' +
          '<span class="pips">' +
          lv.boxes +
          ' 箱</span>';
        btn.addEventListener('click', () => {
          Audio.unlock();
          this.startLevel(i);
        });
        grid.appendChild(btn);
      });

      this.showScreen('levels');
    }

    /* ------------------------------------------------------------ 游戏 */

    startLevel(index) {
      if (!this.list.length) return;
      this.index = Math.max(0, Math.min(index, this.list.length - 1));
      const lv = this.list[this.index];

      this.game = new Game(lv);
      this.view.mount(this.game);

      this.dom.gameTitle.textContent = '第 ' + (this.index + 1) + ' 关';
      this.dom.gameSubtitle.textContent =
        TIERS[this.tierKey].label + ' · ' + lv.boxes + ' 个箱子 · 参考推动 ' +
        lv.pushes;

      this.dom.btnPrev.disabled = this.index === 0;
      this.dom.btnNext.disabled = this.index >= this.list.length - 1;

      this.hideModal();
      this.updateHud();
      this.showScreen('game');
      this.view.layout();
    }

    updateHud() {
      if (!this.game) return;
      const lv = this.list[this.index];
      this.dom.statMoves.textContent = this.game.moves;
      this.dom.statPushes.textContent = this.game.pushes;
      const rec = Storage.get(lv.id);
      this.dom.statBest.textContent = rec ? rec.moves : '—';
      this.dom.undo.disabled = this.game.history.length === 0;
    }

    move(dir) {
      if (!this.game || this.game.solved || this.locked) return;
      const res = this.game.move(dir);
      if (!res) {
        Audio.blocked();
        this.view.shake();
        return;
      }
      if (res.pushed) Audio.push();
      else Audio.move();

      this.view.sync(true);
      this.updateHud();

      if (this.game.solved) {
        this._onSolved();
        return;
      }

      // 箱子被推进了死角，提示玩家及时撤销
      if (res.box && this.game.isBoxDeadlocked(res.box.to)) {
        this.view.shake();
        this.toast('箱子没法再推了，撤销一步试试');
      }
    }

    undo() {
      if (!this.game || this.game.solved || !this.game.history.length) return;
      this.game.undo();
      Audio.undo();
      this.view.sync(true);
      this.updateHud();
    }

    restart() {
      if (!this.game) return;
      this.game.reset();
      Audio.reset();
      this.view.sync(false);
      this.updateHud();
    }

    _onSolved() {
      const lv = this.list[this.index];
      const improved = Storage.record(lv.id, this.game.moves, this.game.pushes);
      const rec = Storage.get(lv.id);
      this.locked = true;

      Audio.win();
      this.view.celebrate();

      window.setTimeout(() => {
        this.locked = false;
        this.openWin(improved, rec);
      }, 340);
    }

    openWin(improved, rec) {
      const hasNext = this.index < this.list.length - 1;

      this.dom.winBadge.textContent = improved ? '🏆' : '🎉';
      this.dom.winTitle.textContent = improved ? '新纪录！' : '过关！';
      this.dom.winSubtitle.textContent = improved
        ? '刷新了本关最好成绩'
        : '继续保持';
      this.dom.winMoves.textContent = this.game.moves;
      this.dom.winPushes.textContent = this.game.pushes;
      this.dom.winBest.textContent = rec ? rec.moves : this.game.moves;
      this.dom.winNext.textContent = hasNext ? '下一关' : '返回选关';

      this.dom.modal.classList.add('show');
      this.renderHome();
    }

    hideModal() {
      this.dom.modal.classList.remove('show');
    }

    nextLevel() {
      this.hideModal();
      if (this.index < this.list.length - 1) {
        this.startLevel(this.index + 1);
      } else {
        this.showLevels(this.tierKey);
      }
    }

    toast(text) {
      const el = this.dom.toast;
      el.textContent = text;
      el.classList.add('show');
      window.clearTimeout(this._toastTimer);
      this._toastTimer = window.setTimeout(() => {
        el.classList.remove('show');
      }, 1600);
    }

    _syncSoundLabel() {
      this.dom.btnSound.textContent = Storage.soundOn() ? '音效：开' : '音效：关';
      Audio.setEnabled(Storage.soundOn());
    }

    /* ----------------------------------------------------------- 输入 */

    _bind() {
      // 首页
      this.dom.btnSound.addEventListener('click', () => {
        const on = !Storage.soundOn();
        Storage.setSound(on);
        this._syncSoundLabel();
        if (on) Audio.star();
      });

      this.dom.btnResetProgress.addEventListener('click', () => {
        if (window.confirm('确定要清空全部关卡的进度与纪录吗？')) {
          Storage.clearAll();
          this.renderHome();
          this.toast('进度已清空');
        }
      });

      // 关卡选择
      this.dom.levelsBack.addEventListener('click', () => {
        this.renderHome();
        this.showScreen('home');
      });
      this.dom.levelsReset.addEventListener('click', () => {
        if (window.confirm('确定要重置「' + TIERS[this.tierKey].label + '」的所有纪录吗？')) {
          Storage.clearIds(this.list.map((lv) => lv.id));
          this.showLevels(this.tierKey);
        }
      });

      // 游戏
      this.dom.gameBack.addEventListener('click', () => {
        this.showLevels(this.tierKey);
      });
      this.dom.btnPrev.addEventListener('click', () => this.startLevel(this.index - 1));
      this.dom.btnNext.addEventListener('click', () => this.startLevel(this.index + 1));
      this.dom.undo.addEventListener('click', () => this.undo());
      this.dom.restart.addEventListener('click', () => this.restart());

      // 方向键按钮（支持长按连发）
      document.querySelectorAll('.pad button').forEach((btn) => {
        this._holdable(btn, () => this.move(btn.dataset.dir));
      });

      // 弹窗
      this.dom.winReplay.addEventListener('click', () => {
        this.hideModal();
        this.restart();
        this.view.layout();
      });
      this.dom.winNext.addEventListener('click', () => this.nextLevel());
      this.dom.modal.addEventListener('click', (e) => {
        if (e.target === this.dom.modal) this.hideModal();
      });

      // 键盘
      window.addEventListener('keydown', (e) => this._onKey(e));

      // 触摸滑动
      this._bindSwipe();

      // 首次交互解锁音频
      const unlock = () => {
        Audio.unlock();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }

    _holdable(el, fn) {
      let repeat = null;
      let down = false;
      let consumed = false;   // pointerdown 已处理过 click，标记避免双触发

      const stop = () => {
        down = false;
        if (repeat) {
          window.clearInterval(repeat);
          repeat = null;
        }
      };

      const press = (e) => {
        if (e && e.pointerType === 'mouse' && e.button !== 0) return;
        if (el.disabled || down) return;
        down = true;
        consumed = true;
        if (e && e.preventDefault) e.preventDefault();
        fn();
        repeat = window.setInterval(() => {
          if (!down) return;
          fn();
        }, 115);
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', stop);
      el.addEventListener('pointercancel', stop);
      el.addEventListener('pointerleave', stop);
      el.addEventListener('contextmenu', (e) => e.preventDefault());

      // 兜底 1：iOS 模拟器 + 旧 WebView 只触发 mouse/click 不触发 pointer 事件
      el.addEventListener('click', (e) => {
        if (consumed) {
          consumed = false;
          return;
        }
        if (el.disabled) return;
        e.preventDefault();
        fn();
      });
      // 兜底 2：极少数 WKWebView 也不冒 click 时，至少响应 touch
      el.addEventListener(
        'touchstart',
        (e) => {
          if (consumed) return;
          if (el.disabled) return;
          e.preventDefault();
          consumed = true;
          fn();
          // 触摸：启动单次连发直到松开
          down = true;
          repeat = window.setInterval(() => {
            if (!down) return;
            fn();
          }, 115);
        },
        { passive: false }
      );
      el.addEventListener('touchend', stop);
      el.addEventListener('touchcancel', stop);
    }

    _onKey(e) {
      if (!this.dom.screens.game.classList.contains('active')) return;

      if (this.dom.modal.classList.contains('show')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.nextLevel();
        } else if (e.key === 'Escape') {
          this.hideModal();
        }
        return;
      }

      const map = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };
      const key = e.key.toLowerCase();

      if (map[key]) {
        e.preventDefault();
        this.move(map[key]);
        return;
      }
      if (key === 'u' || (e.ctrlKey && key === 'z')) {
        e.preventDefault();
        this.undo();
        return;
      }
      if (key === 'r') {
        e.preventDefault();
        this.restart();
      }
    }

    _bindSwipe() {
      const stage = this.dom.stage;
      const threshold = 22;
      let sx = 0;
      let sy = 0;
      let tracking = false;

      stage.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return;
          sx = e.touches[0].clientX;
          sy = e.touches[0].clientY;
          tracking = true;
        },
        { passive: true }
      );

      stage.addEventListener(
        'touchmove',
        (e) => {
          if (!tracking || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - sx;
          const dy = e.touches[0].clientY - sy;
          if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

          if (Math.abs(dx) > Math.abs(dy)) {
            this.move(dx > 0 ? 'right' : 'left');
          } else {
            this.move(dy > 0 ? 'down' : 'up');
          }
          sx = e.touches[0].clientX;
          sy = e.touches[0].clientY;
        },
        { passive: true }
      );

      stage.addEventListener(
        'touchend',
        () => {
          tracking = false;
        },
        { passive: true }
      );
    }
  }

  NS.App = App;
})();
