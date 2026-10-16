/* ==========================================================================
   storage.js — 本地进度存档（localStorage）
   ========================================================================== */
(function () {
  'use strict';

  const NS = (window.Sokoban = window.Sokoban || {});
  const KEY = 'sokoban.save.v1';

  const Storage = {
    data: { levels: {}, settings: { sound: true } },

    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.data.levels = parsed.levels || {};
            this.data.settings = Object.assign(
              { sound: true },
              parsed.settings || {}
            );
          }
        }
      } catch (err) {
        /* 隐私模式或存储不可用时静默降级为内存存档 */
      }
      return this.data;
    },

    save() {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (err) {
        /* ignore */
      }
    },

    /** 只在刷新纪录时写入，返回是否破纪录。 */
    record(id, moves, pushes) {
      const cur = this.data.levels[id];
      if (
        !cur ||
        moves < cur.moves ||
        (moves === cur.moves && pushes < cur.pushes)
      ) {
        this.data.levels[id] = { moves, pushes, at: Date.now() };
        this.save();
        return true;
      }
      return false;
    },

    get(id) {
      return this.data.levels[id] || null;
    },

    isDone(id) {
      return Boolean(this.data.levels[id]);
    },

    doneCount(ids) {
      let n = 0;
      for (const id of ids) if (this.data.levels[id]) n += 1;
      return n;
    },

    clearAll() {
      this.data.levels = {};
      this.save();
    },

    clearIds(ids) {
      for (const id of ids) delete this.data.levels[id];
      this.save();
    },

    setSound(on) {
      this.data.settings.sound = Boolean(on);
      this.save();
    },

    soundOn() {
      return this.data.settings.sound !== false;
    },
  };

  NS.Storage = Storage;
})();
