/* =========================================================
   Halloweenowy kociołek czarownicy – przygoda w sześciu próbach
   Czysty JavaScript, bez bibliotek i bez kompilacji.

   Budowa:
   1. Ustawienia, nazwy przedmiotów, dźwięki
   2. Narzędzia wspólne (skalowanie, animacje lotu, przeciąganie)
   3. Wspólna rama: wprowadzenie, postęp, ekwipunek, nagrody
   4. SZEŚĆ MINIGIER (każda ma build() i destroy() – własny stan)
   5. Przebieg przygody i ekran końcowy
   ========================================================= */
(function () {
  'use strict';

  /* ===================== 1. USTAWIENIA ===================== */
  var STAGE_W = 1920, STAGE_H = 1080;

  var NAMES = {
    lizak: 'lizak', miotla: 'miotła', kot: 'kotek', dynia: 'dynia', duszek: 'duszek',
    nietoperz: 'nietoperz', swieca: 'świeca', pajeczyna: 'pajęczyna', eliksir_fioletowy: 'fiolka',
    eliksir_zielony: 'zielony eliksir', sowa: 'sowa', czaszka: 'czaszka', gwiazdka: 'gwiazdka',
    cukierek: 'cukierek', pajak: 'pająk', zaba: 'żabka', ksiezyc: 'księżyc',
    zoledzie: 'żołędzie', jajko: 'jajko', koniczyna: 'koniczyna', piorko: 'piórko', galazka: 'gałązka', kwiatek: 'kwiatek'
  };
  function nameOf(id) { return NAMES[id] || id; }
  function itemSrc(id) { return 'assets/items/' + id + '.png'; }

  var SOUNDS = {
    klik:    { src: 'sounds/klik.mp3',    vol: 0.6 },
    podnies: { src: 'sounds/podnies.mp3', vol: 0.5 },
    szum:    { src: 'sounds/szum.mp3',    vol: 0.5 },
    plusk:   { src: 'sounds/plusk.mp3',   vol: 0.8 },
    bulgot:  { src: 'sounds/bulgot.mp3',  vol: 0.7 },
    magia:   { src: 'sounds/magia.mp3',   vol: 0.7 },
    blad:    { src: 'sounds/blad.mp3',    vol: 0.55 },
    fanfara: { src: 'sounds/fanfara.mp3', vol: 0.8 }
  };

  var PRELOAD = [
    'backgrounds/tlo_start.jpg', 'backgrounds/tlo_gra.jpg', 'backgrounds/tlo_koniec.jpg',
    'characters/czarownica.png', 'characters/czarownica_radosna.png',
    'cauldron/kociolek.png', 'cauldron/kociolek_aktywny.png',
    'effects/babelki.png', 'effects/iskierki.png', 'effects/mgielka.png',
    'effects/dymek_magic.png', 'effects/ramka_koniec.png', 'effects/komunikat_sprobuj_ponownie.png',
    'ui/baner_tytul.png', 'ui/baner_polecenie.png',
    'ui/przycisk_start.png', 'ui/przycisk_dalej.png', 'ui/przycisk_zagraj_ponownie.png', 'ui/przycisk_dom.png'
  ].concat(Object.keys(NAMES).map(function (id) { return 'items/' + id + '.png'; }));

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function isReduced() { return !!(reduceMotion && reduceMotion.matches); }

  /* ===================== 2. NARZĘDZIA ===================== */
  var $ = function (id) { return document.getElementById(id); };
  var viewport = $('viewport');
  var stage = $('stage');
  var screens = { start: $('screen-start'), game: $('screen-game'), end: $('screen-end') };
  var board = $('board');
  var flyLayer = $('fly-layer');

  function el(tag, cls, parent, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function img(src, cls, parent) {
    var i = el('img', cls, parent, { alt: '', draggable: 'false' });
    i.src = src;
    return i;
  }
  function place(e, x, y, w, h) {
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (w != null) e.style.width = w + 'px';
    if (h != null) e.style.height = h + 'px';
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function restart(e, cls) { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }

  // Fokus przenosimy automatycznie tylko przy obsłudze klawiaturą
  var keyboardMode = false;
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key.indexOf('Arrow') === 0) keyboardMode = true;
  }, true);
  window.addEventListener('pointerdown', function () { keyboardMode = false; }, true);
  function focusIfKeyboard(e) { if (keyboardMode && e) e.focus({ preventScroll: true }); }

  // Skalowanie sceny 1920×1080 do okna / iframe.
  // Bierzemy najmniejszy zmierzony rozmiar i przeliczamy przy każdej zmianie
  // (także gdy ramka iframe zmienia rozmiar już po wczytaniu gry).
  var scale = 1;
  function fit() {
    var ws = [viewport.clientWidth, window.innerWidth, document.documentElement.clientWidth];
    var hs = [viewport.clientHeight, window.innerHeight, document.documentElement.clientHeight];
    if (window.visualViewport) { ws.push(window.visualViewport.width); hs.push(window.visualViewport.height); }
    var w = Math.min.apply(null, ws.filter(function (v) { return v > 0; }));
    var h = Math.min.apply(null, hs.filter(function (v) { return v > 0; }));
    if (!isFinite(w) || !isFinite(h)) return;
    scale = Math.min(w / STAGE_W, h / STAGE_H);
    stage.style.setProperty('--scale', scale);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(viewport);
  window.addEventListener('load', fit);
  [100, 400, 1000, 2500].forEach(function (ms) { setTimeout(fit, ms); });
  fit();
  function toStage(cx, cy) { var r = stage.getBoundingClientRect(); return { x: (cx - r.left) / scale, y: (cy - r.top) / scale }; }
  function rectOf(e) { var r = e.getBoundingClientRect(); var p = toStage(r.left, r.top); return { x: p.x, y: p.y, w: r.width / scale, h: r.height / scale }; }

  // Timery globalne (rama) – czyszczone przy powrocie do menu
  var globalTimers = [];
  function later(fn, ms, list) { var t = setTimeout(fn, ms); (list || globalTimers).push(t); return t; }
  function clearTimers(list) { list.forEach(clearTimeout); list.length = 0; }

  // Lot obrazka z punktu A do B (Web Animations API)
  var anims = [];
  function cancelAnims() { anims.splice(0).forEach(function (a) { try { a.cancel(); } catch (e) { /* ignoruj */ } }); }
  function fly(src, from, to, opt) {
    opt = opt || {};
    var g = opt.el || img(src, 'fly', flyLayer);
    if (!opt.el) { g.style.width = from.w + 'px'; g.style.height = from.h + 'px'; }
    var sx = from.x, sy = from.y;
    var ex = to.x + to.w / 2 - from.w / 2, ey = to.y + to.h / 2 - from.h / 2;
    var es = opt.endScale != null ? opt.endScale : Math.min(to.w / from.w, to.h / from.h);
    var s0 = opt.startScale || 1;
    var reduced = isReduced();
    var frames = reduced ? [
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(' + s0 + ')', opacity: 1 },
      { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(' + es + ')', opacity: opt.fade ? 0 : 1 }
    ] : [
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(' + s0 + ') rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(' + ((sx + ex) / 2) + 'px,' + (Math.min(sy, ey) - (opt.arc != null ? opt.arc : 140)) + 'px) scale(' + ((s0 + es) / 2 + 0.1) + ') rotate(' + (opt.spin ? -12 : 0) + 'deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(' + es + ') rotate(' + (opt.spin ? 18 : 0) + 'deg)', opacity: opt.fade ? 0 : 1, offset: 1 }
    ];
    return new Promise(function (resolve) {
      var a = g.animate(frames, { duration: reduced ? 250 : (opt.dur || 900), easing: 'ease-in-out', fill: 'forwards' });
      anims.push(a);
      a.onfinish = function () { if (!opt.keep) g.remove(); resolve(g); };
      a.oncancel = function () { g.remove(); };   // przerwane (np. powrót do menu) – nic dalej nie wykonujemy
    });
  }

  /* Przeciąganie z obsługą myszy, dotyku i klawiatury.
     opt.target() – element docelowy; opt.pick(btn, drag|null) – wybór (drag = dane upuszczenia lub null dla kliknięcia). */
  function makeDraggable(btn, opt) {
    var d = null, handled = false;
    btn.addEventListener('pointerdown', function (e) {
      if (btn.disabled || opt.locked()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var p = toStage(e.clientX, e.clientY);
      d = { id: e.pointerId, sx: p.x, sy: p.y, moved: false };
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignoruj */ }
    });
    btn.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      var p = toStage(e.clientX, e.clientY);
      if (!d.moved) {
        if (Math.hypot(p.x - d.sx, p.y - d.sy) < 10) return;
        if (opt.locked()) { d = null; return; }
        d.moved = true;
        var im = btn.querySelector('img');
        d.rect = rectOf(im);
        d.ghost = img(im.src, 'fly', flyLayer);
        d.ghost.style.width = d.rect.w + 'px'; d.ghost.style.height = d.rect.h + 'px';
        d.offX = d.sx - d.rect.x; d.offY = d.sy - d.rect.y;
        btn.classList.add('dragging');
        play('podnies');
      }
      d.gx = p.x - d.offX; d.gy = p.y - d.offY;
      d.ghost.style.transform = 'translate(' + d.gx + 'px,' + d.gy + 'px) scale(1.08)';
      var t = opt.target();
      if (t) t.classList.toggle('is-over', overTarget(p, t));
    });
    function end(e, cancelled) {
      if (!d || e.pointerId !== d.id) return;
      var dd = d; d = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignoruj */ }
      var t = opt.target(); if (t) t.classList.remove('is-over');
      handled = true; setTimeout(function () { handled = false; }, 400);
      if (!dd.moved) { if (!cancelled) opt.pick(btn, null); return; }
      var p = toStage(e.clientX, e.clientY);
      var info = { ghost: dd.ghost, x: dd.gx, y: dd.gy, rect: dd.rect };
      if (!cancelled && !opt.locked() && t && overTarget(p, t)) opt.pick(btn, info);
      else returnGhost(info, btn);
    }
    btn.addEventListener('pointerup', function (e) { end(e, false); });
    btn.addEventListener('pointercancel', function (e) { end(e, true); });
    btn.addEventListener('lostpointercapture', function (e) { if (d && d.moved) end(e, true); });
    btn.addEventListener('click', function (e) { e.preventDefault(); if (handled) return; opt.pick(btn, null); });
  }
  function overTarget(p, t) {
    var r = rectOf(t.querySelector('.cauldron-body') || t), pad = 60;
    return p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
  }
  function returnGhost(info, btn, bounce) {
    var to = info.rect;
    var frames = [
      { transform: 'translate(' + info.x + 'px,' + info.y + 'px) scale(1.08)' },
      bounce && !isReduced() ? { transform: 'translate(' + ((info.x + to.x) / 2) + 'px,' + (Math.min(info.y, to.y) - 160) + 'px) rotate(-18deg)' } : null,
      { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(1)' }
    ].filter(Boolean);
    return new Promise(function (resolve) {
      var a = info.ghost.animate(frames, { duration: isReduced() ? 1 : (bounce ? 600 : 320), easing: 'ease-out', fill: 'forwards' });
      anims.push(a);
      a.oncancel = function () { info.ghost.remove(); };
      a.onfinish = function () { info.ghost.remove(); btn.classList.remove('dragging'); resolve(); };
    });
  }

  /* ===================== DŹWIĘKI ===================== */
  var audio = { muted: false, pools: {}, played: [], errors: [] };
  try { audio.muted = window.localStorage.getItem('kociolek-muted') === '1'; } catch (e) { /* brak dostępu */ }
  Object.keys(SOUNDS).forEach(function (name) {
    var list = [];
    for (var i = 0; i < 3; i++) { var a = new Audio(); a.preload = 'auto'; a.src = SOUNDS[name].src; a.volume = SOUNDS[name].vol; list.push(a); }
    audio.pools[name] = { list: list, i: 0 };
  });
  function play(name) {
    audio.played.push(name);
    if (audio.muted) return;
    var p = audio.pools[name]; if (!p) return;
    var a = p.list[p.i]; p.i = (p.i + 1) % p.list.length;
    try {
      a.currentTime = 0;
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function (err) { audio.errors.push(name + ': ' + err.name); });
    } catch (err) { audio.errors.push(name + ': ' + err.name); }
  }
  var btnSound = $('btn-sound');
  function setMuted(m) {
    audio.muted = m;
    btnSound.setAttribute('aria-pressed', m ? 'true' : 'false');
    btnSound.setAttribute('aria-label', m ? 'Włącz dźwięki' : 'Wycisz dźwięki');
    try { window.localStorage.setItem('kociolek-muted', m ? '1' : '0'); } catch (e) { /* brak dostępu */ }
    if (m) { Object.keys(audio.pools).forEach(function (n) { audio.pools[n].list.forEach(function (a) { a.pause(); }); }); }
  }
  btnSound.addEventListener('click', function () { setMuted(!audio.muted); if (!audio.muted) play('klik'); });

  /* Pełny ekran */
  var btnFull = $('btn-full'), root = document.documentElement;
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) btnFull.hidden = false;
  function updateFullBtn() {
    var on = !!fsElement();
    btnFull.setAttribute('aria-pressed', on ? 'true' : 'false');
    btnFull.setAttribute('aria-label', on ? 'Zamknij pełny ekran' : 'Pełny ekran');
    setTimeout(fit, 60);
  }
  btnFull.addEventListener('click', function () {
    play('klik');
    try {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { var r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (r && r.catch) r.catch(function () {}); }
    } catch (e) { /* brak obsługi */ }
  });
  document.addEventListener('fullscreenchange', updateFullBtn);
  document.addEventListener('webkitfullscreenchange', updateFullBtn);

  /* ===================== 3. WSPÓLNA RAMA ===================== */
  var taskText = $('task-text');
  var sayEl = $('say');
  var witch = document.querySelector('.game-witch');
  var tryAgain = $('try-again');
  var btnNext = $('btn-next');
  var intro = $('intro');
  var rewardBox = $('reward');
  var inventoryEl = $('inventory');
  var progressLabel = $('progress-label');

  var game = {
    trial: 0,          // indeks bieżącej próby 0–5
    collected: [],     // zdobyte składniki
    current: null,     // obiekt bieżącej minigry
    busy: false        // blokada ramy (nagroda, przejścia)
  };

  function setTask(text) { taskText.textContent = text; }
  var sayTimer = null;
  function say(text, kind, ms) {
    clearTimeout(sayTimer);
    sayEl.classList.remove('show', 'oops');
    void sayEl.offsetWidth;
    sayEl.textContent = text;
    if (kind === 'oops') sayEl.classList.add('oops');
    sayEl.classList.add('show');
    if (ms) sayTimer = setTimeout(function () { sayEl.classList.remove('show'); }, ms);
  }
  function hideSay() { clearTimeout(sayTimer); sayEl.classList.remove('show'); }
  function happy(on) { witch.classList.toggle('is-happy', !!on); }
  var tryTimer = null;
  function showTryAgain() {
    clearTimeout(tryTimer);
    restart(tryAgain, 'show');
    tryTimer = setTimeout(function () { tryAgain.classList.remove('show'); }, 1500);
  }
  function wrongFeedback(text, big) {
    play('blad');
    say(text, 'oops');
    happy(false);
    if (big) showTryAgain();
  }

  function renderInventory() {
    inventoryEl.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var s = el('i', game.collected[i] ? 'on' : '', inventoryEl);
      if (game.collected[i]) { img(itemSrc(game.collected[i]), '', s); s.setAttribute('aria-label', nameOf(game.collected[i])); }
    }
  }
  function inventorySlotRect(i) { return rectOf(inventoryEl.children[i]); }

  // Ukończenie próby: nagroda leci do ekwipunku, pokazuje się DALEJ
  /* Ukończenie próby: nagroda zawsze przylatuje z lewego dolnego rogu na środek,
     pokazuje się z JEDNYM krótkim efektem, a potem leci do ekwipunku. */
  var FX_TIME = 2000;                       // jak długo trwa efekt (ms)
  function completeTrial(rewardId) {
    game.busy = true;
    happy(true);
    say('Brawo! Zdobywasz: ' + nameOf(rewardId) + '!');
    var slot = game.collected.length;
    var rImg = $('reward-img');
    rImg.src = itemSrc(rewardId);
    rImg.style.opacity = '0';
    rewardBox.classList.remove('fx-spark', 'fx-bubbles', 'fx-mist');
    rewardBox.classList.add('show');
    var corner = { x: -40, y: 940, w: 160, h: 160 };       // lewy dolny róg
    fly(itemSrc(rewardId), corner, rectOf(rImg), { arc: 220, dur: 1000, endScale: 1.5 }).then(function () {
      rImg.style.opacity = '1';
      play('magia');
      rewardBox.classList.add('fx-' + randomFx());
      later(function () { rewardBox.classList.remove('fx-spark', 'fx-bubbles', 'fx-mist'); }, isReduced() ? 700 : FX_TIME, trialTimers);
      later(function () {
        var r = rectOf(rImg);
        rImg.style.opacity = '0';
        fly(itemSrc(rewardId), r, inventorySlotRect(slot), { arc: 120, dur: 900 }).then(function () {
          game.collected.push(rewardId);
          renderInventory();
          rewardBox.classList.remove('show');
          game.busy = false;
          showNext();
        });
      }, isReduced() ? 900 : FX_TIME + 500, trialTimers);
    });
  }

  // Jeden losowy efekt: iskierki ALBO bąbelki ALBO mgiełka
  function randomFx() { return ['spark', 'bubbles', 'mist'][Math.floor(Math.random() * 3)]; }

  function showNext() {
    btnNext.hidden = false;
    btnNext.setAttribute('aria-label', game.trial >= 5 ? 'Dalej' : 'Dalej – następna próba');
    focusIfKeyboard(btnNext);
  }

  /* Kociołek – komponent wielokrotnego użytku */
  function makeCauldron(parent, x, y) {
    var c = el('div', 'cauldron', parent);
    place(c, x, y);
    var body = el('div', 'cauldron-body', c);
    img('assets/cauldron/kociolek.png', 'cauldron-img cauldron-base', body);
    img('assets/cauldron/kociolek_aktywny.png', 'cauldron-img cauldron-active', body);
    img('assets/effects/iskierki.png', 'fx fx-spark', c);   // jeden efekt na raz, nad kociołkiem
    img('assets/effects/babelki.png', 'fx fx-bubbles', c);
    img('assets/effects/mgielka.png', 'fx fx-mist', c);
    var fxTimer = null;
    return {
      el: c,
      mouth: function () {               // prostokąt nad wlotem kociołka
        var r = rectOf(body);
        return { x: r.x + r.w / 2 - 60, y: r.y + r.h - 386 + 20, w: 120, h: 70 };
      },
      // fx: nazwa JEDNEGO efektu ('spark' | 'bubbles' | 'mist') albo null; hue: odcień koloru
      react: function (fx, hue) {
        clearTimeout(fxTimer);
        c.classList.remove('fx-spark-on', 'fx-mist-on', 'fx-bubbles-on');
        c.classList.add('is-active');
        c.style.setProperty('--fxhue', (hue || 0) + 'deg');
        if (fx) {
          void c.offsetWidth;
          c.classList.add('fx-' + fx + '-on');
          fxTimer = setTimeout(function () { c.classList.remove('fx-spark-on', 'fx-mist-on', 'fx-bubbles-on'); }, isReduced() ? 700 : FX_TIME);
        }
        if (!isReduced()) restart(body, 'wobble');
        play('plusk');
        setTimeout(function () { play('bulgot'); }, 150);
      }
    };
  }

  /* Kafelek z przedmiotem */
  function makeTile(parent, id, x, y, small) {
    var b = el('button', 'tile' + (small ? ' small' : ''), parent, { type: 'button', 'aria-label': nameOf(id) });
    b.dataset.id = id;
    img(itemSrc(id), '', b);
    place(b, x, y);
    return b;
  }
  function wrongTile(btn, gray) {
    restart(btn, 'shake');
    if (gray) { btn.classList.add('wrong'); btn.disabled = true; btn.setAttribute('aria-label', nameOf(btn.dataset.id) + ' – nie ten'); }
  }

  /* ===================== 4. SZEŚĆ MINIGIER ===================== */
  /* Każda minigra: { title, intro, reward, build(ctx), destroy() }.
     ctx.timers – własne timery (czyszczone przy wyjściu), ctx.done(reward, opt) – ukończenie. */

  var TRIALS = [];

  /* ---------- LOSOWOŚĆ ----------
     Przy każdej próbie losujemy przedmioty. Nagrody nigdy się nie powtarzają
     (ostatnia próba potrzebuje 6 różnych składników). Gwiazdka jest zarezerwowana dla próby 5. */
  var ALL = Object.keys(NAMES);
  // Zwierzęta i stworki NIGDY nie trafiają do kociołka (mogą być tylko rozpraszaczami / na półce / w memory).
  var ANIMALS = ['kot', 'sowa', 'nietoperz', 'zaba', 'pajak', 'duszek'];
  // Składniki, które można wrzucać do kociołka (gwiazdka jest nagrodą za próbę 5)
  var INGREDIENTS = ALL.filter(function (id) { return ANIMALS.indexOf(id) === -1 && id !== 'gwiazdka'; });
  function freeItems() {   // składniki jeszcze niezdobyte
    return INGREDIENTS.filter(function (id) { return game.collected.indexOf(id) === -1; });
  }
  function othersFrom(list, exclude, n) {
    return shuffle(list.filter(function (id) { return exclude.indexOf(id) === -1; })).slice(0, n);
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function others(exclude, n) {
    return shuffle(ALL.filter(function (id) { return exclude.indexOf(id) === -1; })).slice(0, n);
  }
  // Zagadki do próby 1. exclude = przedmioty, które też mogłyby pasować (nie pokażą się obok)
  var RIDDLES = {
    lizak:     { text: 'Jest słodki, kolorowy i zaczyna się na literę L.', exclude: ['cukierek'] },
    dynia:     { text: 'Jest okrągła, pomarańczowa, ma wesołą buzię i zaczyna się na literę D.', exclude: ['cukierek'] },
    pajeczyna: { text: 'Utkał ją pająk z cieniutkich nitek. Zaczyna się na literę P.', exclude: ['pajak'] },
    miotla:    { text: 'Czarownica lata na niej po niebie. Zaczyna się na literę M.', exclude: [] },
    swieca:    { text: 'Ma knot i mały płomyczek. Zaczyna się na literę Ś.', exclude: [] },
    ksiezyc:   { text: 'Świeci nocą na niebie jak rogalik. Zaczyna się na literę K.', exclude: ['gwiazdka'] },
    czaszka:   { text: 'Jest z kości, ma wielkie oczy i kokardkę. Zaczyna się na literę C.', exclude: ['duszek'] },
    cukierek:  { text: 'Jest słodki, schowany w szeleszczącym papierku i zaczyna się na literę C.', exclude: ['lizak', 'dynia'] },
    eliksir_zielony:   { text: 'To zielona mikstura w szklanej butelce z korkiem.', exclude: ['eliksir_fioletowy', 'zaba'] },
    eliksir_fioletowy: { text: 'To fioletowa mikstura w szklanej butelce z korkiem.', exclude: ['eliksir_zielony'] },
    zoledzie:  { text: 'Rosną na dębie i mają małe czapeczki. Zaczynają się na literę Ż.', exclude: ['galazka'] },
    jajko:     { text: 'Ma gładką skorupkę i owalny kształt. Zaczyna się na literę J.', exclude: [] },
    koniczyna: { text: 'Ma cztery zielone listki i podobno przynosi szczęście. Zaczyna się na literę K.', exclude: ['kwiatek', 'galazka'] },
    piorko:    { text: 'Jest lekkie i miękkie, wypadło ptakowi ze skrzydła. Zaczyna się na literę P.', exclude: [] },
    galazka:   { text: 'Odłamała się od drzewa i ma zielone listki. Zaczyna się na literę G.', exclude: ['zoledzie', 'koniczyna', 'miotla'] },
    kwiatek:   { text: 'Ma kolorowe płatki i rośnie na łące. Zaczyna się na literę K.', exclude: ['koniczyna'] }
  };

  // ---------- PRÓBA 1: ZAGADKA OBRAZKOWA ----------
  TRIALS.push({
    key: 'zagadka',
    title: 'Zagadka obrazkowa',
    intro: 'Przeczytaj zagadkę i wrzuć do kociołka właściwy przedmiot. Możesz go przeciągnąć albo kliknąć.',
    prepare: function () {
      var target = pick(freeItems().filter(function (id) { return RIDDLES[id]; }));
      this.reward = target;
      this.plan = { target: target, items: shuffle([target].concat(othersFrom(INGREDIENTS, [target].concat(RIDDLES[target].exclude), 3))) };
    },
    build: function (ctx) {
      var s = this.s = { locked: false };
      var target = this.plan.target;
      setTask(RIDDLES[target].text + ' Co wrzucisz do kociołka?');
      var cauldron = makeCauldron(board, 720, 300);
      var ids = this.plan.items;
      ids.forEach(function (id, i) {
        var t = makeTile(board, id, 489 + i * 244, 790);
        t.classList.add('pop'); t.style.animationDelay = (i * 0.08) + 's';
        makeDraggable(t, {
          locked: function () { return s.locked; },
          target: function () { return cauldron.el; },
          pick: function (btn, drag) {
            if (s.locked || btn.disabled) return;
            if (btn.dataset.id === target) {
              s.locked = true;
              board.querySelectorAll('.tile').forEach(function (b) { b.disabled = true; });
              var from = drag ? { x: drag.x, y: drag.y, w: drag.rect.w, h: drag.rect.h } : rectOf(btn.querySelector('img'));
              btn.classList.add('used');
              play('szum');
              fly(btn.querySelector('img').src, from, cauldron.mouth(), { el: drag ? drag.ghost : null, endScale: 0.25, fade: true, spin: true }).then(function () {
                cauldron.react(null);
                ctx.done(target);
              });
            } else {
              s.locked = true;
              var finish = function () {
                wrongTile(btn, true);
                wrongFeedback('Ojej! To nie to. Spróbuj jeszcze raz!', true);
                ctx.later(function () { s.locked = false; focusIfKeyboard(board.querySelector('.tile:not(:disabled)')); }, 700);
              };
              if (drag) returnGhost(drag, btn, true).then(finish); else finish();
            }
          }
        });
      });
      say('Przeciągnij albo kliknij właściwy obrazek.');
      ctx.later(function () { focusIfKeyboard(board.querySelector('.tile')); }, 100);
    },
    destroy: function () { this.s = null; }
  });

  // ---------- PRÓBA 2: MEMORY ----------
  TRIALS.push({
    key: 'memory',
    title: 'Magiczne memory',
    intro: 'Najpierw przez 5 sekund zobaczysz wszystkie obrazki. Potem karty się odwrócą – odkrywaj po dwie i znajdź trzy pary.',
    prepare: function () {
      var prize = pick(freeItems());
      var pairs = [prize].concat(others([prize, 'gwiazdka'], 2));
      this.reward = prize;
      this.plan = { deck: shuffle(pairs.concat(pairs)) };
    },
    build: function (ctx) {
      var self = this;
      var s = this.s = { open: [], pairs: 0, lock: false, cards: [] };
      setTask('Odkrywaj po dwie karty i znajdź wszystkie trzy pary!');
      var deck = this.plan.deck;
      deck.forEach(function (id, i) {
        var c = el('button', 'card', board, { type: 'button', 'aria-label': 'Karta ' + (i + 1) + ', zakryta' });
        c.dataset.id = id;
        place(c, 615 + (i % 3) * 240, 330 + Math.floor(i / 3) * 280);
        var inner = el('div', 'card-inner', c);
        el('div', 'card-face card-back', inner);
        var front = el('div', 'card-face card-front', inner);
        img(itemSrc(id), '', front);
        c.addEventListener('click', function () { flip(c, i); });
        s.cards.push(c);
      });
      function flip(c, i) {
        if (s.lock || c.classList.contains('flipped') || c.classList.contains('matched')) return;
        c.classList.add('flipped');
        c.setAttribute('aria-label', 'Karta ' + (i + 1) + ': ' + nameOf(c.dataset.id));
        play('podnies');
        s.open.push(c);
        if (s.open.length < 2) return;
        s.lock = true;
        var a = s.open[0], b = s.open[1];
        if (a.dataset.id === b.dataset.id) {
          ctx.later(function () {
            a.classList.add('matched'); b.classList.add('matched');
            a.classList.remove('flipped'); b.classList.remove('flipped');
            a.disabled = b.disabled = true;
            s.open = []; s.pairs++;
            play('magia');
            if (s.pairs === 3) ctx.done(self.reward);
            else { say('Jest para! Szukaj dalej.', null, 1800); s.lock = false; }
          }, 450);
        } else {
          ctx.later(function () { wrongFeedback('To nie para. Zapamiętaj, gdzie są obrazki!'); }, 350);
          ctx.later(function () {
            [a, b].forEach(function (x) {
              x.classList.remove('flipped');
              x.setAttribute('aria-label', 'Karta ' + (s.cards.indexOf(x) + 1) + ', zakryta');
            });
            s.open = []; s.lock = false;
          }, isReduced() ? 900 : 1300);
        }
      }
      // Podgląd: wszystkie karty odkryte przez 5 sekund, potem same się odwracają
      s.lock = true;
      s.cards.forEach(function (c) { c.classList.add('flipped'); c.disabled = true; });
      setTask('Zapamiętaj, gdzie są obrazki! Za chwilę karty się odwrócą.');
      say('Patrz uważnie! Masz 5 sekund.');
      ctx.later(function () {
        s.cards.forEach(function (c, i) {
          c.classList.remove('flipped'); c.disabled = false;
          c.setAttribute('aria-label', 'Karta ' + (i + 1) + ', zakryta');
        });
        play('podnies');
        s.lock = false;
        setTask('Odkrywaj po dwie karty i znajdź wszystkie trzy pary!');
        say('Teraz kliknij kartę, żeby ją odkryć.');
        focusIfKeyboard(s.cards[0]);
      }, 5000);
    },
    destroy: function () { this.s = null; }
  });

  // ---------- PRÓBA 3: MAGICZNA KOLEJNOŚĆ ----------
  var ARROW_SVG = '<svg class="arrow" viewBox="0 0 64 44" aria-hidden="true"><path d="M2 16h38V4l22 18-22 18V28H2z"/></svg>';
  TRIALS.push({
    key: 'kolejnosc',
    title: 'Magiczna kolejność',
    intro: 'Obejrzyj recepturę i zapamiętaj kolejność składników. Potem wybierz je w tej samej kolejności.',
    prepare: function () {
      var last = pick(freeItems());                 // ostatni składnik receptury = nagroda
      var first = othersFrom(INGREDIENTS, [last], 2);
      this.order = first.concat([last]);
      this.reward = last;
      this.extra = others(this.order.concat(['gwiazdka']), 3);
    },
    build: function (ctx) {
      var self = this;
      var s = this.s = { step: 0, lock: false, tiles: [] };
      var panel = el('div', 'panel recipe', board);
      place(panel, 460, 330, 1000, 330);
      var btnMem = el('button', 'pill-btn', board, { type: 'button' });
      btnMem.textContent = 'ZAPAMIĘTAŁEM/AM';
      btnMem.style.left = '0'; btnMem.style.top = '720px';
      var btnHint = el('button', 'pill-btn small', board, { type: 'button' });
      btnHint.textContent = 'Pokaż recepturę';
      place(btnHint, 1500, 690);
      btnHint.hidden = true;

      var choices = shuffle(self.order.concat(self.extra));
      choices.forEach(function (id, i) {
        var t = makeTile(board, id, 415 + i * 184, 800, true);
        t.hidden = true;
        t.addEventListener('click', function () { choose(t); });
        s.tiles.push(t);
      });

      function showRecipe() {
        setTask('Zapamiętaj kolejność składników. Gdy będziesz gotowy lub gotowa, kliknij przycisk.');
        panel.innerHTML = '';
        self.order.forEach(function (id, i) {
          var sl = el('div', 'slot', panel);
          img(itemSrc(id), '', sl);
          el('span', 'num', sl).textContent = i + 1;
          if (i < 2) panel.insertAdjacentHTML('beforeend', ARROW_SVG);
        });
        s.tiles.forEach(function (t) { t.hidden = true; });
        btnHint.hidden = true;
        btnMem.hidden = false;
        centerBtn(btnMem);
        say('Przyjrzyj się recepturze. Nie spiesz się!');
        focusIfKeyboard(btnMem);
      }
      function showSlots() {
        setTask('Wybieraj składniki w tej samej kolejności co w recepturze.');
        panel.innerHTML = '';
        self.order.forEach(function (id, i) {
          var sl = el('div', 'slot' + (i < s.step ? ' filled' : ' empty'), panel);
          if (i < s.step) img(itemSrc(id), '', sl);
          el('span', 'num', sl).textContent = i + 1;
          if (i < 2) panel.insertAdjacentHTML('beforeend', ARROW_SVG);
        });
        s.tiles.forEach(function (t, i) { t.hidden = false; if (!t.classList.contains('used')) { restart(t, 'pop'); t.style.animationDelay = (i * 0.06) + 's'; } });
        btnMem.hidden = true;
        btnHint.hidden = false;
        say('Co było pierwsze?');
        focusIfKeyboard(s.tiles.filter(function (t) { return !t.disabled; })[0]);
      }
      function choose(t) {
        if (s.lock || t.disabled) return;
        var id = t.dataset.id;
        if (id === self.order[s.step]) {
          s.lock = true;
          var slot = panel.querySelectorAll('.slot')[s.step];
          var from = rectOf(t.querySelector('img'));
          t.classList.add('used'); t.disabled = true;
          play('podnies');
          fly(itemSrc(id), from, rectOf(slot), { arc: 120, dur: 700 }).then(function () {
            slot.classList.remove('empty'); slot.classList.add('filled');
            slot.insertBefore(img(itemSrc(id), ''), slot.firstChild);
            s.step++;
            if (s.step === 3) {
              btnHint.hidden = true;
              s.tiles.forEach(function (x) { x.disabled = true; });
              ctx.done(self.reward);
            } else {
              play('magia');
              say(s.step === 1 ? 'Dobrze! A co było drugie?' : 'Świetnie! A co było na końcu?');
              s.lock = false;
            }
          });
        } else {
          var inRecipe = self.order.indexOf(id) !== -1;
          wrongTile(t, !inRecipe);
          wrongFeedback('Ojej! Teraz potrzebny jest składnik numer ' + (s.step + 1) + '. Spróbuj jeszcze raz!', true);
        }
      }
      btnMem.addEventListener('click', function () { play('klik'); showSlots(); });
      btnHint.addEventListener('click', function () { play('klik'); showRecipe(); });
      showRecipe();
    },
    destroy: function () { this.s = null; }
  });
  function centerBtn(b) { b.style.left = (960 - b.offsetWidth / 2) + 'px'; }

  // ---------- PRÓBA 4: CO ZNIKNĘŁO? ----------
  TRIALS.push({
    key: 'zniknelo',
    title: 'Co zniknęło?',
    intro: 'Przyjrzyj się przedmiotom na półce. Po kliknięciu GOTOWE jeden z nich zniknie. Zgadnij który!',
    reward: null,               // nagrodą jest przedmiot, który zniknął
    prepare: function () {
      var missing = pick(freeItems());
      // bez par, które można pomylić na półce (pająk / pajęczyna z pająkiem)
      var pool = ALL.filter(function (id) { return id !== missing && id !== 'gwiazdka'; });
      if (missing === 'pajak') pool = pool.filter(function (id) { return id !== 'pajeczyna'; });
      if (missing === 'pajeczyna') pool = pool.filter(function (id) { return id !== 'pajak'; });
      var rest = shuffle(pool);
      if (rest.slice(0, 4).indexOf('pajak') !== -1 && rest.slice(0, 4).indexOf('pajeczyna') !== -1) rest = rest.filter(function (id) { return id !== 'pajeczyna'; });
      this.missing = missing;
      this.set = shuffle([missing].concat(rest.slice(0, 4)));
    },
    build: function (ctx) {
      var self = this;
      var s = this.s = { phase: 'look', missing: null, lock: false };
      setTask('Przyjrzyj się dokładnie przedmiotom na półce. Kiedy je zapamiętasz, kliknij GOTOWE.');
      var shelf = el('div', 'panel shelf', board);
      place(shelf, 460, 340, 1000, 300);
      var order = shuffle(self.set);
      var spots = order.map(function (id) {
        var sp = el('div', 'spot', shelf);
        sp.dataset.id = id;
        img(itemSrc(id), '', sp);
        return sp;
      });
      var curtain = img('assets/effects/dymek_magic.png', 'curtain', board);
      place(curtain, 640, 250, 640);
      var btnReady = el('button', 'pill-btn', board, { type: 'button' });
      btnReady.textContent = 'GOTOWE';
      btnReady.style.top = '720px';
      ctx.later(function () { centerBtn(btnReady); focusIfKeyboard(btnReady); }, 0);
      say('Zapamiętaj, co stoi na półce.');

      btnReady.addEventListener('click', function () {
        if (s.phase !== 'look') return;
        s.phase = 'hide';
        play('klik');
        btnReady.hidden = true;
        shelf.classList.add('hiding');
        restart(curtain, 'show');
        play('szum');
        say('Abrakadabra… coś znika!');
        s.missing = self.missing;
        ctx.later(function () {
          spots.forEach(function (sp) { if (sp.dataset.id === s.missing) sp.classList.add('gone'); });
          shelf.classList.remove('hiding');
          s.phase = 'ask';
          setTask('Co zniknęło z półki? Wybierz jedną odpowiedź.');
          say('Który przedmiot zniknął?');
          var others = shuffle(order.filter(function (id) { return id !== s.missing; })).slice(0, 2);
          shuffle([s.missing].concat(others)).forEach(function (id, i) {
            var t = makeTile(board, id, 585 + i * 270, 720);
            t.classList.add('pop');
            t.addEventListener('click', function () { answer(t); });
          });
          focusIfKeyboard(board.querySelector('.tile'));
        }, isReduced() ? 500 : 1500);
      });
      function answer(t) {
        if (s.lock || t.disabled) return;
        if (t.dataset.id === s.missing) {
          s.lock = true;
          board.querySelectorAll('.tile').forEach(function (b) { b.disabled = true; });
          spots.forEach(function (sp) { if (sp.dataset.id === s.missing) { sp.classList.add('back'); } });
          t.classList.add('used');
          ctx.done(s.missing);
        } else {
          wrongTile(t, true);
          wrongFeedback('Ten przedmiot nadal stoi na półce. Spróbuj jeszcze raz!', true);
        }
      }
    },
    destroy: function () { this.s = null; }
  });

  // ---------- PRÓBA 5: ZŁAP MAGICZNE GWIAZDKI ----------
  TRIALS.push({
    key: 'gwiazdki',
    title: 'Złap magiczne gwiazdki',
    intro: 'Po niebie fruwają różne stworki i przedmioty. Złap trzy gwiazdki – klikaj tylko gwiazdki! Jeśli wolisz, włącz tryb spokojny: wtedy nic się nie rusza.',
    reward: 'gwiazdka',
    build: function (ctx) {
      var SKY = { x: 460, y: 318, w: 1000, h: 730 };
      var s = this.s = { caught: 0, calm: isReduced(), sprites: [], raf: 0, last: 0, done: false };
      setTask('Złap trzy magiczne gwiazdki! Klikaj tylko gwiazdki.');
      var sky = el('div', 'sky', board);
      place(sky, SKY.x, SKY.y, SKY.w, SKY.h);
      var count = el('div', 'star-count', sky, { 'aria-label': 'Złapane gwiazdki: 0 z 3' });
      place(count, 20, 16);
      for (var k = 0; k < 3; k++) img(itemSrc('gwiazdka'), '', el('i', '', count));
      var calmBtn = el('button', 'pill-btn small', sky, { type: 'button', 'aria-pressed': s.calm ? 'true' : 'false' });
      calmBtn.textContent = 'Tryb spokojny';
      calmBtn.style.right = '20px'; calmBtn.style.top = '16px'; calmBtn.style.zIndex = '3';

      var ids = shuffle(['gwiazdka', 'gwiazdka', 'gwiazdka'].concat(others(['gwiazdka', 'ksiezyc'], 5)));
      var SZ = 150, TOP = 110;
      ids.forEach(function (id, i) {
        var b = el('button', 'sprite', sky, { type: 'button', 'aria-label': nameOf(id) });
        b.dataset.id = id;
        img(itemSrc(id), '', b);
        var ang = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 45;
        var o = {
          b: b, id: id,
          x: 40 + (i % 4) * ((SKY.w - SZ - 80) / 3) + (Math.random() * 40 - 20),
          y: TOP + 20 + Math.floor(i / 4) * 280 + Math.random() * 60,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp
        };
        s.sprites.push(o);
        b.addEventListener('click', function () { hit(o); });
      });
      function draw(o) { o.b.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)'; }
      function step(t) {
        if (!s.last) s.last = t;
        var dt = Math.min(0.05, (t - s.last) / 1000); s.last = t;
        s.sprites.forEach(function (o) {
          if (o.caught) return;
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx); }
          if (o.x > SKY.w - SZ - 12) { o.x = SKY.w - SZ - 12; o.vx = -Math.abs(o.vx); }
          if (o.y < TOP) { o.y = TOP; o.vy = Math.abs(o.vy); }
          if (o.y > SKY.h - SZ - 12) { o.y = SKY.h - SZ - 12; o.vy = -Math.abs(o.vy); }
          draw(o);
        });
        s.raf = requestAnimationFrame(step);
      }
      function startMoving() { s.sprites.forEach(function (o) { o.b.style.transition = ''; }); s.last = 0; cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(step); }
      function stopMoving() { cancelAnimationFrame(s.raf); s.raf = 0; }
      function arrangeCalm() {   // nieruchoma siatka 4 × 2
        stopMoving();
        s.sprites.forEach(function (o, i) {
          o.x = 45 + (i % 4) * 240; o.y = TOP + 70 + Math.floor(i / 4) * 260;
          o.b.style.transition = isReduced() ? '' : 'transform .6s ease';
          draw(o);
        });
      }
      function setCalm(on) {
        s.calm = on;
        calmBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (s.done) return;
        if (on) arrangeCalm(); else startMoving();
      }
      calmBtn.addEventListener('click', function () { play('klik'); setCalm(!s.calm); });
      s.sprites.forEach(draw);
      if (s.calm) arrangeCalm(); else startMoving();

      function hit(o) {
        if (o.caught || s.done) return;
        if (o.id === 'gwiazdka') {
          o.caught = true;
          var slot = count.children[s.caught];
          s.caught++;
          count.setAttribute('aria-label', 'Złapane gwiazdki: ' + s.caught + ' z 3');
          var from = rectOf(o.b.querySelector('img'));
          o.b.classList.add('caught'); o.b.disabled = true;
          play('magia');
          fly(itemSrc('gwiazdka'), from, rectOf(slot), { arc: 80, dur: 600 }).then(function () {
            slot.classList.add('on');
            if (s.caught === 3) {
              s.done = true;
              stopMoving();
              s.sprites.forEach(function (x) { x.b.disabled = true; });
              calmBtn.disabled = true;
              ctx.done('gwiazdka');
            } else {
              say('Złapana! Jeszcze ' + (3 - s.caught) + '.', null, 1800);
              focusIfKeyboard(sky.querySelector('.sprite:not(:disabled)'));
            }
          });
        } else {
          restart(o.b, 'nope');
          wrongFeedback('To nie gwiazdka. Szukaj gwiazdek!');
        }
      }
      say('Klikaj gwiazdki, gdy przelatują obok!');
      ctx.later(function () { focusIfKeyboard(sky.querySelector('.sprite')); }, 100);
      this.stop = stopMoving;
    },
    destroy: function () { if (this.stop) this.stop(); this.stop = null; this.s = null; }
  });

  // ---------- PRÓBA 6: PRZYGOTOWANIE ELIKSIRU ----------
  var COMBOS = [
    { fx: 'bubbles', hue: 0,   msg: 'Bul, bul! Bąbelki!' },
    { fx: 'spark',   hue: 0,   msg: 'Ale iskierki!' },
    { fx: 'mist',    hue: 0,   msg: 'Magiczna mgiełka!' },
    { fx: 'bubbles', hue: 120, msg: 'Bąbelki zmieniają kolor!' },
    { fx: 'spark',   hue: -90, msg: 'Hokus-pokus!' },
    { fx: 'mist',    hue: 200, msg: 'Eliksir gotowy!' }
  ];
  TRIALS.push({
    key: 'eliksir',
    title: 'Przygotowanie eliksiru',
    intro: '',
    prepare: function () {
      this.reward = pick(freeItems());              // sekretny składnik czarownicy
      this.intro = 'Czarownica dokłada swój sekretny składnik: ' + nameOf(this.reward) + '. Teraz wrzucaj wszystkie składniki do kociołka w kolejności z receptury.';
    },
    build: function (ctx) {
      var s = this.s = { step: 0, lock: false };
      setTask('Wrzucaj składniki do kociołka w kolejności z receptury. Zacznij od numeru 1!');
      // sekretny składnik czarownicy trafia do ekwipunku
      if (game.collected.length < 6 && game.collected.indexOf(this.reward) === -1) { game.collected.push(this.reward); renderInventory(); }
      var ingredients = game.collected.slice(0, 6);
      var order = s.order = shuffle(ingredients);
      var cauldron = makeCauldron(board, 720, 320);

      var col = el('div', 'panel recipe-col', board, { 'aria-label': 'Receptura' });
      place(col, 1556, 300, 334);
      el('h3', '', col).textContent = 'Receptura';
      var steps = order.map(function (id, i) {
        var st = el('div', 'step' + (i === 0 ? ' current' : ''), col);
        el('span', 'n', st).textContent = i + 1;
        img(itemSrc(id), '', st);
        st.insertAdjacentHTML('beforeend', '<svg class="check" viewBox="0 0 40 40" aria-hidden="true"><path d="M7 21l9 9 17-19"/></svg>');
        st.setAttribute('aria-label', (i + 1) + '. ' + nameOf(id));
        return st;
      });

      shuffle(ingredients).forEach(function (id, i) {
        var t = makeTile(board, id, 415 + i * 184, 830, true);
        t.classList.add('pop'); t.style.animationDelay = (i * 0.06) + 's';
        makeDraggable(t, {
          locked: function () { return s.lock; },
          target: function () { return cauldron.el; },
          pick: function (btn, drag) { add(btn, drag); }
        });
      });

      function add(btn, drag) {
        if (s.lock || btn.disabled) return;
        var id = btn.dataset.id;
        if (id === order[s.step]) {
          s.lock = true;
          btn.disabled = true; btn.classList.add('used');
          var from = drag ? { x: drag.x, y: drag.y, w: drag.rect.w, h: drag.rect.h } : rectOf(btn.querySelector('img'));
          play('szum');
          fly(itemSrc(id), from, cauldron.mouth(), { el: drag ? drag.ghost : null, endScale: 0.25, fade: true, spin: true }).then(function () {
            var combo = COMBOS[s.step];
            cauldron.react(combo.fx, combo.hue);
            steps[s.step].classList.remove('current'); steps[s.step].classList.add('done');
            s.step++;
            happy(true);
            if (s.step < order.length) {
              steps[s.step].classList.add('current');
              say(combo.msg + ' Teraz numer ' + (s.step + 1) + '.', null);
              play('magia'); s.lock = false;
              ctx.later(function () { happy(false); focusIfKeyboard(board.querySelector('.tile:not(:disabled)')); }, isReduced() ? 200 : 700);
            } else {
              say('Brawo! Halloweenowy eliksir jest gotowy!');
              ctx.final();
            }
          });
        } else {
          var need = order[s.step];
          var finish = function () {
            wrongTile(btn, false);
            restart(steps[s.step], 'hint');
            wrongFeedback('Najpierw dodaj numer ' + (s.step + 1) + ': ' + nameOf(need) + '.');
          };
          if (drag) returnGhost(drag, btn, true).then(finish); else finish();
        }
      }
      say('Spójrz na recepturę po prawej stronie.');
      ctx.later(function () { focusIfKeyboard(board.querySelector('.tile')); }, 100);
    },
    destroy: function () { this.s = null; }
  });

  /* ===================== 5. PRZEBIEG PRZYGODY ===================== */
  var trialTimers = [];
  var ctx = {
    later: function (fn, ms) { return later(fn, ms, trialTimers); },
    done: function (reward) { completeTrial(reward); },
    final: function () {
      play('fanfara');
      later(function () { showEnd(); }, isReduced() ? 900 : 2600, trialTimers);
    }
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (k) {
      var s = screens[k];
      if (k === name) { s.hidden = false; void s.offsetWidth; s.classList.add('is-active'); }
      else { s.classList.remove('is-active'); s.hidden = true; }
    });
  }

  function leaveTrial() {
    clearTimers(trialTimers);
    cancelAnims();
    game.busy = false;
    if (game.current && game.current.destroy) game.current.destroy();
    game.current = null;
    board.innerHTML = '';
    flyLayer.innerHTML = '';
    btnNext.hidden = true;
    rewardBox.classList.remove('show');
    tryAgain.classList.remove('show');
    hideSay();
    happy(false);
  }

  function showIntro(i) {
    leaveTrial();
    game.trial = i;
    var t = TRIALS[i];
    if (t.prepare) t.prepare();            // nowe losowanie przy każdym podejściu
    progressLabel.textContent = 'Magiczna próba ' + (i + 1) + '/6';
    $('intro-step').textContent = 'Magiczna próba ' + (i + 1) + '/6';
    $('intro-title').textContent = t.title;
    $('intro-text').textContent = t.intro;
    var rImg = $('intro-reward-img');
    if (t.key === 'zniknelo') { $('intro-reward-label').innerHTML = 'Nagroda: przedmiot,<br>który odnajdziesz!'; rImg.hidden = true; }
    else if (t.key === 'eliksir') { $('intro-reward-label').innerHTML = 'Sekretny składnik<br>czarownicy:'; rImg.hidden = false; rImg.src = itemSrc(t.reward); }
    else { $('intro-reward-label').textContent = 'Nagroda:'; rImg.hidden = false; rImg.src = itemSrc(t.reward); }
    setTask(t.title);
    intro.hidden = false;
    later(function () { focusIfKeyboard($('btn-go')); }, 50);
  }

  function startTrial() {
    intro.hidden = true;
    game.current = TRIALS[game.trial];
    game.current.build(ctx);
  }

  function startAdventure() {
    clearTimers(globalTimers);
    game.collected = [];
    renderInventory();
    showScreen('game');
    showIntro(0);
  }

  function goHome() {
    leaveTrial();
    intro.hidden = true;
    clearTimers(globalTimers);
    showScreen('start');
    focusIfKeyboard($('btn-start'));
  }

  function showEnd() {
    var items = game.collected.slice();
    ['kot', 'sowa', 'miotla'].forEach(function (id) { if (items.indexOf(id) === -1) items.push(id); });  // zawsze fruwają też kotek, sowa i miotła
    leaveTrial();
    showScreen('end');
    var shelf = $('end-shelf');
    shelf.innerHTML = '';
    // zdobyte składniki fruwają swobodnie po planszy
    var AREA = { x: 440, y: 560, w: 900, h: 200 };
    function rp() { return { x: AREA.x + Math.random() * AREA.w, y: AREA.y + Math.random() * AREA.h }; }
    items.forEach(function (id, i) {
      var im = img(itemSrc(id), '', shelf);
      var start = { x: AREA.x + (i % 3) * 330 + Math.random() * 120, y: AREA.y + (Math.floor(i / 3) % 2) * 120 + Math.random() * 40 };
      im.style.left = '0'; im.style.top = '0';
      im.style.transform = 'translate(' + start.x + 'px,' + start.y + 'px)';
      if (isReduced()) return;
      var pts = [start, rp(), rp(), rp(), start];
      var a = im.animate(pts.map(function (p, k) {
        return { transform: 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + (k % 2 ? 8 : -8) + 'deg)' };
      }), { duration: 14000 + Math.random() * 6000, iterations: Infinity, easing: 'ease-in-out', delay: -Math.random() * 8000 });
      anims.push(a);
    });
    later(function () { focusIfKeyboard($('btn-again')); }, 300);
  }

  // Wczytanie grafik przed startem
  function preload() {
    var n = 0, loadingEl = $('loading');
    return Promise.all(PRELOAD.map(function (src) {
      return new Promise(function (resolve) {
        var i = new Image();
        i.onload = i.onerror = function () { n++; loadingEl.textContent = 'Ładowanie magii… ' + Math.round(n / PRELOAD.length * 100) + '%'; resolve(); };
        i.src = 'assets/' + src;
      });
    })).then(function () {
      loadingEl.textContent = 'Gotowe!';
      loadingEl.classList.add('done');
      $('btn-start').disabled = false;
      focusIfKeyboard($('btn-start'));
    });
  }

  // Przyciski
  $('btn-start').addEventListener('click', function () { play('klik'); startAdventure(); });
  $('btn-go').addEventListener('click', function () { play('klik'); startTrial(); });
  btnNext.addEventListener('click', function () {
    if (game.busy) return;
    play('klik');
    if (game.trial < TRIALS.length - 1) showIntro(game.trial + 1);
  });
  $('btn-again').addEventListener('click', function () { play('klik'); startAdventure(); });
  $('btn-home').addEventListener('click', function () { play('klik'); goHome(); });
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Podgląd stanu do testów automatycznych (nie wpływa na rozgrywkę)
  window.__kociolek = {
    game: game, audio: audio, trials: TRIALS,
    goto: function (i, collected) {   // skok do wybranej próby (testy)
      clearTimers(globalTimers);
      game.collected = (collected || ['lizak', 'dynia', 'eliksir_fioletowy', 'koniczyna', 'gwiazdka']).slice(0, i);
      renderInventory();
      showScreen('game');
      showIntro(i);
    }
  };

  setMuted(audio.muted);
  renderInventory();
  preload();
})();
