/* ==========================================================================
   main.js — 应用入口
   ========================================================================== */
(function () {
  'use strict';

  const NS = window.Sokoban;

  function boot() {
    NS.Storage.load();

    const pack = window.SOKOBAN_LEVELS || {};
    const missing = ['beginner', 'intermediate', 'advanced'].filter(
      (key) => !pack[key] || !pack[key].length
    );

    if (missing.length) {
      const box = document.getElementById('tier-list');
      if (box) {
        box.innerHTML =
          '<div class="tier-card" style="cursor:default">' +
          '<div class="tier-body"><div class="tier-name">关卡数据缺失</div>' +
          '<div class="tier-meta">请先运行 scripts/build_levels.py 生成 src/data/levels.js</div>' +
          '</div></div>';
      }
      return;
    }

    window.app = new NS.App(pack);

    if ('serviceWorker' in navigator && /^https?:/.test(window.location.protocol)) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
