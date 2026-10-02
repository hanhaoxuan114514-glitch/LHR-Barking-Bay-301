/* =====================================================================
   伦敦希思罗机场传奇 · 共用界面脚本
   - LHRUI.svg(name)：线条图标（取代 emoji）
   - 按钮点击音效、机场广播「叮咚」提示音
   - 页面跳转时的淡出过渡
   图标路径参考 Lucide（ISC 许可），部分为自绘。
   ===================================================================== */
(function (root) {
  'use strict';
  const P = {
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.2"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    meter: '<rect x="2" y="9" width="20" height="6" rx="3"/><path d="M5 12h8"/>',
    vest: '<path d="M8.5 3 5 5v15h5l2-3.5 2 3.5h5V5l-3.5-2L12 9z"/><path d="M5 13.5h5.5M13.5 13.5H19"/>',
    shoe: '<path d="M3 17v-6.5l4.5-1.5 3 3.5 4-1 5.2 2.2a2.2 2.2 0 0 1 1.3 2V17z"/><path d="M3 20h18"/><path d="M9 13l1-1M11.5 14l1-1"/>',
    can: '<path d="M8 3h8l1 2v14l-1 2H8l-1-2V5z"/><path d="M7 8h10M7 16h10"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
    vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    joystick: '<circle cx="12" cy="8" r="4"/><path d="M12 12v5"/><rect x="4" y="17" width="16" height="4" rx="2"/>',
    hand: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V4a1.5 1.5 0 0 1 3 0v6M15 10V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.4-4a1.5 1.5 0 0 1 2.5-1.6L9 14"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    runner: '<circle cx="14" cy="4" r="2"/><path d="m6 22 4-7 3 2v5M8 11l3-4 4 2 3 3M11 7l-2 5 4 3"/>'
  };
  function svg(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  }
  function hydrate(scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML(el.dataset.iconAfter ? 'beforeend' : 'afterbegin', svg(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  }

  /* ---------- 界面音效 ---------- */
  let ac = null, out = null;
  const muted = () => document.documentElement.dataset.muted === '1';
  function ctx() {
    if (!ac) {
      try {
        ac = new (root.AudioContext || root.webkitAudioContext)();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
        out = ac.createGain(); out.gain.value = 1.6; out.connect(comp); comp.connect(ac.destination);
      } catch (e) { ac = null; }
    }
    if (ac && ac.state !== 'running') ac.resume();
    return ac;
  }
  function tone(f, d, v, type, delay, f2) {
    if (muted()) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + (delay || 0) + .005, o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    lp.type = 'lowpass'; lp.frequency.value = 4200;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + .05);
  }
  const sfx = {
    tap() { tone(1046, .07, .07, 'sine'); tone(1568, .05, .03, 'sine', .015); },
    select() { tone(784, .09, .08, 'triangle'); tone(1175, .14, .07, 'triangle', .06); },
    back() { tone(880, .07, .06, 'sine'); tone(587, .1, .05, 'sine', .05); },
    toggle() { tone(1320, .04, .05, 'square'); },
    /* 英国机场广播前的三音「叮—叮—咚」 */
    chime() { [[659, 0], [831, .26], [988, .52]].forEach(([f, d]) => { tone(f, 1.4, .09, 'sine', d); tone(f * 2, .7, .025, 'sine', d); }); },
    unlock() { [[784, 0], [988, .09], [1175, .18], [1568, .27]].forEach(([f, d]) => tone(f, .35, .07, 'triangle', d)); }
  };
  ['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => ctx(), { passive: true, once: true }));

  /* 按钮点击音：只给界面按钮，不给游戏里的触控按键 */
  document.addEventListener('click', e => {
    const el = e.target.closest('button,a.brow,a.back,.lbtab');
    if (!el || el.disabled || el.closest('#touch')) return;
    if (el.matches('.back,[id^="bMenu"],#bLoginClose,#bShareClose,.achievement-close')) sfx.back();
    else if (el.matches('.go:not(.alt),.brow,.choices button')) sfx.select();
    else if (el.matches('.btn-ic,.lbtab')) sfx.toggle();
    else sfx.tap();
  }, true);

  /* 跳转到另一个页面时：先播放广播提示音并淡出 */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    e.preventDefault();
    if (a.classList.contains('brow')) sfx.chime();
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = url.href; }, a.classList.contains('brow') ? 520 : 300);
  });
  root.addEventListener('pageshow', () => document.body && document.body.classList.remove('leaving'));

  root.LHRUI = { svg, hydrate, sfx };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrate());
  else hydrate();
})(window);
