/*
 * Akwarium: a long-running aquarium. Fish, decorations and backgrounds are bought with stars (ctx.spend)
 * and unlock by player level. Fish wander (boid-ish), scatter when the glass is tapped, swim to food.
 * Feeding once per day keeps them smiling; a hungry fish only looks sad. Decorations can be dragged; the
 * layout is saved. Tapping a fish shows its Polish and English name.
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', MUTED = '#5a6690', LVL = '#7a4fc4';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var MAX_FISH = 20, MAX_DECO = 14;
  // fish caught in Wędkarz wait here (JSON array of FISH[].k ids) until the aquarium has room
  var INBOX = 'naukagry.akwarium.inbox', RARE_LV = 10;

  var FISH = [
    { k: 'gupik', pl: 'gupik', en: 'guppy', lv: 1, price: 25, size: 0.6, shape: 'basic', body: '#a8dcf2', fin: '#f47fb0', pat: 'spots', tail: 'fan', speed: 1.2 },
    { k: 'zlota', pl: 'złota rybka', en: 'goldfish', lv: 1, price: 30, size: 0.85, shape: 'basic', body: '#f6982a', fin: '#fbc75e', tail: 'double', b: 0.66, speed: 0.9 },
    { k: 'neonek', pl: 'neonek', en: 'neon tetra', lv: 2, price: 35, size: 0.55, shape: 'basic', body: '#d9e2ee', fin: '#e8eef6', pat: 'neon', speed: 1.3, b: 0.48 },
    { k: 'danio', pl: 'danio', en: 'zebrafish', lv: 3, price: 40, size: 0.6, shape: 'basic', body: '#f4e7b4', fin: '#f4e7b4', pat: 'hstripes', speed: 1.5, b: 0.45 },
    { k: 'kirysek', pl: 'kirysek', en: 'catfish', lv: 4, price: 45, size: 0.7, shape: 'basic', body: '#cdb48c', fin: '#e2d2b0', pat: 'cat', speed: 0.8, zone: 'bottom', b: 0.55 },
    { k: 'skalar', pl: 'skalar', en: 'angelfish', lv: 5, price: 55, size: 0.95, shape: 'angel', body: '#f3f1ea', fin: '#e8e2d2', pat: 'vstripes', speed: 0.7 },
    { k: 'blazenek', pl: 'błazenek', en: 'clownfish', lv: 6, price: 60, size: 0.75, shape: 'basic', body: '#f67c1e', fin: '#f67c1e', pat: 'clown', speed: 1.0, b: 0.58 },
    { k: 'bojownik', pl: 'bojownik', en: 'betta fish', lv: 7, price: 65, size: 0.8, shape: 'betta', body: '#4466dd', fin: '#c440b4', speed: 0.6, b: 0.45 },
    { k: 'mieczyk', pl: 'mieczyk', en: 'swordtail', lv: 8, price: 70, size: 0.8, shape: 'sword', body: '#ea4b3a', fin: '#f08a5a', speed: 1.2, b: 0.48 },
    { k: 'rozdymka', pl: 'rozdymka', en: 'pufferfish', lv: 9, price: 80, size: 0.8, shape: 'puffer', body: '#f3d56c', fin: '#f6e3a0', pat: 'pspots', speed: 0.6 },
    { k: 'pokolec', pl: 'pokolec', en: 'blue tang', lv: 10, price: 90, size: 0.95, shape: 'basic', body: '#3d7fe2', fin: '#2f5fc0', pat: 'tang', tail: 'yellow', speed: 1.0, b: 0.66 },
    { k: 'dyskowiec', pl: 'dyskowiec', en: 'discus', lv: 11, price: 100, size: 1.0, shape: 'disc', body: '#ec6b3a', fin: '#e85a3a', pat: 'waves', speed: 0.6 },
    { k: 'konik', pl: 'konik morski', en: 'seahorse', lv: 12, price: 115, size: 0.95, shape: 'seahorse', body: '#f5b82a', fin: '#fbe08a', speed: 0.35, zone: 'mid' },
    { k: 'plaszczka', pl: 'płaszczka', en: 'stingray', lv: 13, price: 130, size: 1.15, shape: 'ray', body: '#9d8cc6', fin: '#b8aade', speed: 0.6, zone: 'bottom' },
    { k: 'teczanka', pl: 'tęczanka', en: 'rainbowfish', lv: 14, price: 150, size: 0.85, shape: 'basic', body: '#5aa0e8', fin: '#f6a23a', pat: 'rainbow', speed: 1.1, b: 0.55 }
  ];
  var DECOS = [
    { k: 'kamyki', n: 'kamyki', lv: 1, price: 25, w: 46, h: 20 },
    { k: 'roslinka', n: 'roślinka', lv: 1, price: 30, w: 34, h: 74 },
    { k: 'muszla', n: 'muszla', lv: 2, price: 40, w: 34, h: 26 },
    { k: 'koral', n: 'koralowiec', lv: 3, price: 50, w: 44, h: 52 },
    { k: 'zamek', n: 'zamek', lv: 4, price: 100, w: 74, h: 82 },
    { k: 'amfora', n: 'amfora', lv: 5, price: 60, w: 52, h: 30 },
    { k: 'skrzynia', n: 'skrzynia skarbów', lv: 7, price: 125, w: 46, h: 36 }
  ];
  var BGS = [
    { k: 'zwykle', n: 'zwykła woda', lv: 1, price: 0, top: '#86ccf2', bot: '#2c74c2', sand: '#f2dca0' },
    { k: 'rafa', n: 'rafa koralowa', lv: 5, price: 75, top: '#86dcf0', bot: '#2483b4', sand: '#f6e1b0' },
    { k: 'jezioro', n: 'jezioro', lv: 10, price: 100, top: '#a6d6b0', bot: '#357a68', sand: '#ccb68a' },
    { k: 'statek', n: 'zatopiony statek', lv: 15, price: 150, top: '#74b4e2', bot: '#1d4b8a', sand: '#e6cf98' }
  ];
  var FB = {}, DB = {}, BB = {};
  FISH.forEach(function (f) { FB[f.k] = f; });
  DECOS.forEach(function (d) { DB[d.k] = d; });
  BGS.forEach(function (b) { BB[b.k] = b; });

  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hexMix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ---------- drawing helpers ----------
  var G, U = 1.5;
  function path(fn, fill, noStroke) {
    G.beginPath(); fn();
    if (fill) { G.fillStyle = fill; G.fill(); }
    if (!noStroke) { G.lineWidth = U; G.strokeStyle = INK; G.stroke(); }
  }
  function circ(x, y, r, fill, ns) { path(function () { G.arc(x, y, r, 0, Math.PI * 2); }, fill, ns); }
  function ell(x, y, rx, ry, rot, fill, ns) { path(function () { G.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }, fill, ns); }
  function dot(x, y, r, fill) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = fill; G.fill(); }

  // ---------- fish (local units: body half-length a = 20, facing +x, centre 0,0) ----------
  function eye(x, y, r, sad, look) {
    circ(x, y, r, '#fff');
    dot(x + r * 0.25 * (look || 1), y + r * 0.1, r * 0.58, INK);
    dot(x + r * 0.05, y - r * 0.25, r * 0.22, '#fff');
    G.lineCap = 'round';
    if (sad) { G.beginPath(); G.moveTo(x - r * 0.9, y - r * 1.15); G.lineTo(x + r * 0.7, y - r * 1.55); G.lineWidth = U; G.strokeStyle = INK; G.stroke(); }
  }
  function mouth(x, y, s, sad) {
    G.beginPath();
    if (sad) G.arc(x - 1 * s, y + 3.2 * s, 3 * s, -Math.PI * 0.85, -Math.PI * 0.2);
    else G.arc(x - 1.2 * s, y - 1.6 * s, 3.2 * s, Math.PI * 0.1, Math.PI * 0.7);
    G.lineWidth = U; G.strokeStyle = INK; G.stroke();
  }
  function blush(x, y, r) { G.fillStyle = 'rgba(240,110,130,.4)'; G.beginPath(); G.ellipse(x, y, r, r * 0.6, 0, 0, 7); G.fill(); }

  function bodyPath(a, b) {
    G.moveTo(a, 0);
    G.bezierCurveTo(a * 0.95, -b * 1.3, -a * 0.6, -b * 1.15, -a * 0.95, 0);
    G.bezierCurveTo(-a * 0.6, b * 1.15, a * 0.95, b * 1.3, a, 0);
  }
  function tailFan(a, b, wag, col, kind) {
    G.save(); G.translate(-a * 0.85, 0); G.rotate(wag);
    if (kind === 'double') {
      path(function () { G.moveTo(0, 0); G.quadraticCurveTo(-a * 0.5, -b * 0.4, -a * 0.8, -b * 1.15); G.quadraticCurveTo(-a * 0.55, -b * 0.15, -a * 0.75, 0); G.quadraticCurveTo(-a * 0.55, b * 0.15, -a * 0.8, b * 1.15); G.quadraticCurveTo(-a * 0.5, b * 0.4, 0, 0); }, col);
    } else if (kind === 'fan') {
      path(function () { G.moveTo(0, 0); G.lineTo(-a * 0.75, -b * 1.2); G.quadraticCurveTo(-a * 1.0, 0, -a * 0.75, b * 1.2); G.closePath(); }, col);
      G.strokeStyle = 'rgba(29,47,111,.25)'; G.lineWidth = U * 0.7;
      for (var i = -2; i <= 2; i++) { G.beginPath(); G.moveTo(-a * 0.1, 0); G.lineTo(-a * 0.8, b * 0.45 * i); G.stroke(); }
    } else {
      path(function () { G.moveTo(0, 0); G.quadraticCurveTo(-a * 0.4, -b * 0.3, -a * 0.65, -b * 1.0); G.quadraticCurveTo(-a * 0.45, 0, -a * 0.65, b * 1.0); G.quadraticCurveTo(-a * 0.4, b * 0.3, 0, 0); }, col);
    }
    G.restore();
  }

  // g translated to fish centre and scaled; ph: swim phase; sad: hungry
  function drawFish(g, F, ph, sad, look) {
    G = g; g.lineJoin = 'round'; g.lineCap = 'round';
    var a = 20, b = a * (F.b || 0.55), wag = Math.sin(ph) * 0.32, fin = Math.sin(ph * 1.3) * 0.3;
    var body = sad ? hexMix(F.body, '#a7b3c6', 0.3) : F.body, finc = sad ? hexMix(F.fin, '#a7b3c6', 0.3) : F.fin;
    if (F.shape === 'seahorse') return drawSeahorse(F, ph, sad, body, finc);
    if (F.shape === 'ray') return drawRay(F, ph, sad, body, finc);
    if (F.shape === 'puffer') {
      var r = a * 0.8;
      tailFan(a * 0.85, r * 0.55, wag, finc);
      G.strokeStyle = INK; G.lineWidth = U;
      for (var i = 0; i < 14; i++) { var an = i * Math.PI * 2 / 14; G.beginPath(); G.moveTo(Math.cos(an) * r, Math.sin(an) * r * 0.9); G.lineTo(Math.cos(an) * (r + 4), Math.sin(an) * (r + 4) * 0.9); G.stroke(); }
      ell(0, 0, r, r * 0.9, 0, body);
      G.save(); G.beginPath(); G.ellipse(0, 0, r, r * 0.9, 0, 0, 7); G.clip();
      ell(0, r * 0.55, r, r * 0.5, 0, '#fff8dc', true);
      [[-6, -8], [2, -11], [-10, 0], [6, -4], [-3, -2]].forEach(function (p) { dot(p[0], p[1], 1.6, 'rgba(120,80,20,.55)'); });
      G.restore();
      ell(0, 0, r, r * 0.9, 0, null);
      ell(2, r * 0.25, 4, 2.6, 0.6 + fin, finc);
      eye(r * 0.45, -r * 0.2, 5.2, sad, look); mouth(r * 0.92, r * 0.2, 1, sad); blush(r * 0.35, r * 0.25, 3);
      return;
    }
    if (F.shape === 'betta') {
      G.save(); G.translate(-a * 0.75, 0); G.rotate(wag * 0.6);
      var tw = Math.sin(ph * 0.8) * 3;
      path(function () { G.moveTo(0, 0); G.bezierCurveTo(-a * 0.6, -b * 2.4, -a * 1.5, -b * 2.8 + tw, -a * 1.5, -b * 0.8); G.quadraticCurveTo(-a * 1.3, 0, -a * 1.5, b * 0.8); G.bezierCurveTo(-a * 1.5, b * 2.8 - tw, -a * 0.6, b * 2.4, 0, 0); }, finc);
      G.strokeStyle = 'rgba(255,255,255,.35)'; G.lineWidth = U;
      for (var j = -2; j <= 2; j++) { G.beginPath(); G.moveTo(-a * 0.2, 0); G.quadraticCurveTo(-a * 0.8, b * j * 0.7, -a * 1.3, b * j * 0.95); G.stroke(); }
      G.restore();
      path(function () { G.moveTo(-a * 0.5, -b * 0.8); G.quadraticCurveTo(-a * 0.6, -b * 2.6, -a * 1.0, -b * 1.9); G.quadraticCurveTo(-a * 0.8, -b * 1.0, -a * 0.75, -b * 0.4); }, finc);
      path(function () { G.moveTo(-a * 0.1, b * 0.8); G.quadraticCurveTo(-a * 0.5, b * 2.8, -a * 1.0, b * 2.1); G.quadraticCurveTo(-a * 0.8, b * 1.0, -a * 0.6, b * 0.6); }, finc);
    } else if (F.shape === 'angel') {
      b = a * 0.78;
      path(function () { G.moveTo(-a * 0.15, -b * 0.75); G.quadraticCurveTo(-a * 0.5, -b * 1.9, -a * 1.0, -b * 2.2); G.quadraticCurveTo(-a * 0.75, -b * 1.1, -a * 0.75, -b * 0.35); }, finc);
      path(function () { G.moveTo(-a * 0.15, b * 0.75); G.quadraticCurveTo(-a * 0.5, b * 1.9, -a * 1.0, b * 2.2); G.quadraticCurveTo(-a * 0.75, b * 1.1, -a * 0.75, b * 0.35); }, finc);
      tailFan(a, b * 0.6, wag, finc);
    } else if (F.shape === 'disc') {
      b = a * 0.9;
      ell(-1, 0, a * 1.1, b * 1.1, 0, finc);
      tailFan(a, b * 0.45, wag, finc);
    } else {
      tailFan(a, b, wag, F.tail === 'yellow' ? (sad ? '#d8cf8a' : '#f7d23a') : finc, F.tail);
      if (F.shape === 'sword') {
        G.save(); G.translate(-a * 0.85, 0); G.rotate(wag);
        path(function () { G.moveTo(-a * 0.4, b * 0.55); G.lineTo(-a * 1.55, b * 0.95); G.lineTo(-a * 0.5, b * 0.95); G.closePath(); }, sad ? '#d8cf8a' : '#f7d23a');
        G.restore();
      }
      path(function () { G.moveTo(-a * 0.35, -b * 0.85); G.quadraticCurveTo(-a * 0.1, -b * 1.75, a * 0.25, -b * 0.9); G.closePath(); }, finc);
      if (F.zone === 'bottom') path(function () { G.moveTo(-a * 0.3, b * 0.8); G.quadraticCurveTo(-a * 0.2, b * 1.4, a * 0.1, b * 0.85); G.closePath(); }, finc);
    }
    // body
    if (F.shape === 'disc' || F.shape === 'angel') path(function () { G.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); }, body);
    else path(function () { bodyPath(a, b); }, body);
    G.save(); G.beginPath();
    if (F.shape === 'disc' || F.shape === 'angel') G.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); else bodyPath(a, b);
    G.clip();
    pattern(F, a, b, sad);
    G.fillStyle = 'rgba(255,255,255,.28)'; G.beginPath(); G.ellipse(a * 0.15, -b * 0.45, a * 0.55, b * 0.3, -0.1, 0, 7); G.fill();
    G.restore();
    if (F.shape === 'disc' || F.shape === 'angel') path(function () { G.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); }, null);
    else path(function () { bodyPath(a, b); }, null);
    G.beginPath(); G.arc(a * 0.05, 0, b * 0.75, -0.7, 0.7); G.strokeStyle = 'rgba(29,47,111,.35)'; G.lineWidth = U * 0.8; G.stroke();
    G.save(); G.translate(-a * 0.12, b * 0.3); G.rotate(0.5 + fin);
    path(function () { G.moveTo(0, 0); G.quadraticCurveTo(-a * 0.2, -b * 0.3, -a * 0.38, 0); G.quadraticCurveTo(-a * 0.2, b * 0.25, 0, 0); }, hexMix(finc, '#ffffff', 0.25));
    G.restore();
    if (F.k === 'kirysek') { G.strokeStyle = INK; G.lineWidth = U * 0.8; G.beginPath(); G.moveTo(a * 0.9, b * 0.35); G.quadraticCurveTo(a * 1.15, b * 0.7, a * 1.2, b * 0.95); G.moveTo(a * 0.85, b * 0.45); G.quadraticCurveTo(a * 0.95, b * 0.9, a * 0.9, b * 1.15); G.stroke(); }
    var er = Math.max(4.2, b * 0.36);
    eye(a * 0.5, -b * 0.18, er, sad, look);
    mouth(a * 0.86, b * 0.22, 1, sad);
    blush(a * 0.42, b * 0.35, 2.6);
  }
  function pattern(F, a, b, sad) {
    var i;
    if (F.pat === 'spots') { for (i = 0; i < 6; i++) dot(-a * 0.6 + (i % 3) * a * 0.22, -b * 0.3 + Math.floor(i / 3) * b * 0.6, 2, sad ? '#c79ab0' : '#f47fb0'); }
    else if (F.pat === 'neon') {
      G.fillStyle = sad ? '#d68f8f' : '#e8463a'; G.fillRect(-a, 0, a * 1.1, b * 1.4);
      G.fillStyle = sad ? '#7fa6c9' : '#2fd0f2'; G.fillRect(-a, -b * 0.35, a * 1.5, b * 0.38);
    } else if (F.pat === 'hstripes') {
      G.fillStyle = sad ? '#7a8ab0' : '#3f63c4';
      for (i = -1; i <= 1; i++) G.fillRect(-a, i * b * 0.55 - b * 0.12, a * 1.6, b * 0.24);
    } else if (F.pat === 'vstripes') {
      G.fillStyle = '#2a2e3a';
      [a * 0.35, -a * 0.15, -a * 0.6].forEach(function (x) { G.fillRect(x - 2, -b * 1.2, 4, b * 2.4); });
    } else if (F.pat === 'clown') {
      [a * 0.42, -a * 0.1, -a * 0.65].forEach(function (x, j) {
        var w = j === 1 ? 6 : 4.5;
        G.fillStyle = INK; G.fillRect(x - w / 2 - 1.2, -b * 1.4, w + 2.4, b * 2.8);
        G.fillStyle = '#fff'; G.fillRect(x - w / 2, -b * 1.4, w, b * 2.8);
      });
    } else if (F.pat === 'tang') {
      G.fillStyle = '#20264a';
      G.beginPath(); G.moveTo(a * 0.4, -b * 0.6); G.quadraticCurveTo(-a * 0.2, -b * 1.1, -a * 0.9, -b * 0.2); G.quadraticCurveTo(-a * 0.5, b * 0.1, -a * 0.2, -b * 0.15); G.quadraticCurveTo(a * 0.1, -b * 0.3, a * 0.4, -b * 0.6); G.fill();
    } else if (F.pat === 'waves') {
      G.strokeStyle = sad ? '#8ea2c0' : '#3f86d8'; G.lineWidth = 2;
      for (i = -2; i <= 2; i++) { G.beginPath(); for (var x = -a; x <= a; x += 3) G.lineTo(x, i * b * 0.35 + Math.sin(x * 0.35) * 1.5); G.stroke(); }
    } else if (F.pat === 'cat') {
      for (i = 0; i < 7; i++) dot(-a * 0.7 + i * a * 0.22, -b * 0.35 + (i % 2) * b * 0.35, 1.7, 'rgba(70,50,30,.55)');
    } else if (F.pat === 'rainbow') {
      var gr = G.createLinearGradient(a, 0, -a, 0);
      gr.addColorStop(0, sad ? '#9fb3cc' : '#5aa0e8'); gr.addColorStop(0.5, sad ? '#c6b9cc' : '#c77fe0'); gr.addColorStop(1, sad ? '#d8c09a' : '#f6a23a');
      G.fillStyle = gr; G.fillRect(-a, -b * 1.4, a * 2, b * 2.8);
    }
  }
  function drawSeahorse(F, ph, sad, body, finc) {
    var bob = Math.sin(ph * 0.5) * 1.5;
    G.save(); G.translate(0, bob);
    var pts = [[-1, -6, 8], [-3, 2, 8.5], [-1, 10, 7], [2, 16, 5.5], [3, 21, 4.2], [0, 24.5, 3.2], [-3, 23.5, 2.6], [-4, 20.5, 2.2]];
    // dorsal fin flutter
    G.save(); G.translate(-9, 2); G.rotate(Math.sin(ph * 3) * 0.25);
    path(function () { G.moveTo(0, -5); G.quadraticCurveTo(-7, 0, 0, 6); G.closePath(); }, finc);
    G.restore();
    for (var i = pts.length - 1; i >= 0; i--) circ(pts[i][0], pts[i][1], pts[i][2], body);
    // head + snout + crest
    path(function () { G.moveTo(4, -17); G.lineTo(14, -15.5); G.quadraticCurveTo(16, -13.5, 14, -12); G.lineTo(4, -11); G.closePath(); }, body);
    circ(1, -14, 7.5, body);
    path(function () { G.moveTo(-3, -20); G.lineTo(-1, -25); G.lineTo(2, -21); G.lineTo(4, -25); G.lineTo(5, -20); }, finc);
    G.fillStyle = 'rgba(255,255,255,.3)'; G.beginPath(); G.ellipse(-2, -2, 3, 6, 0.2, 0, 7); G.fill();
    G.strokeStyle = 'rgba(29,47,111,.3)'; G.lineWidth = U * 0.8;
    for (var j = 0; j < 4; j++) { G.beginPath(); G.moveTo(3 - j * 0.5, -2 + j * 5); G.lineTo(7 - j * 1.2, -2 + j * 5); G.stroke(); }
    eye(2.5, -15, 3.6, sad, 1);
    blush(4, -10.5, 2.2);
    if (sad) { G.beginPath(); G.moveTo(12, -12.5); G.lineTo(14, -13.5); G.strokeStyle = INK; G.lineWidth = U; G.stroke(); }
    G.restore();
  }
  function drawRay(F, ph, sad, body, finc) {
    var a = 22, ry = 7;
    // tail
    G.lineCap = 'round';
    G.beginPath(); G.moveTo(-a * 0.9, 0);
    for (var t = 0; t <= 1; t += 0.1) G.lineTo(-a * 0.9 - t * a * 1.3, Math.sin(ph * 1.2 - t * 4) * 2.5 * t);
    G.strokeStyle = INK; G.lineWidth = 3 + U * 2; G.stroke(); G.strokeStyle = body; G.lineWidth = 3; G.stroke();
    path(function () {
      for (var i = 0; i <= 40; i++) {
        var th = i / 40 * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        var flap = Math.sin(ph * 1.4 + c * 1.5) * 3.2 * Math.abs(s) * (s < 0 ? 1 : 0.6);
        var x = c * a * (1 + 0.12 * Math.abs(s)), y = s * ry * (1.6 - 0.6 * Math.abs(c)) - flap - Math.abs(s) * 2;
        if (i === 0) G.moveTo(x, y); else G.lineTo(x, y);
      }
      G.closePath();
    }, body);
    G.fillStyle = 'rgba(255,255,255,.3)'; G.beginPath(); G.ellipse(a * 0.1, -ry * 0.6, a * 0.55, ry * 0.45, 0, 0, 7); G.fill();
    [[-8, -2], [-2, 2], [-12, 2], [4, -1]].forEach(function (p) { dot(p[0], p[1], 1.6, sad ? 'rgba(80,80,110,.4)' : 'rgba(80,50,140,.45)'); });
    eye(a * 0.55, -ry * 0.9, 3.4, sad, 1);
    eye(a * 0.3, -ry * 1.0, 3.0, sad, 1);
    mouth(a * 0.92, ry * 0.1, 0.8, sad);
  }

  // ---------- decorations (units: base centre 0,0, up is -y, ~1 unit = 1px at u=1) ----------
  function drawDeco(g, k, t, phase) {
    G = g; g.lineJoin = 'round'; g.lineCap = 'round';
    var i;
    if (k === 'kamyki') {
      [[-14, -6, 10, 7, '#b9b3a8'], [12, -5, 9, 6, '#e8c9a8'], [1, -8, 11, 8.5, '#8f9cad'], [-4, -15, 6, 5, '#d9a6b8'], [16, -12, 5, 4, '#a9c7a2']].forEach(function (p) {
        ell(p[0], p[1], p[2], p[3], 0, p[4]); dot(p[0] - p[2] * 0.35, p[1] - p[3] * 0.4, p[3] * 0.25, 'rgba(255,255,255,.55)');
      });
    } else if (k === 'roslinka') {
      for (i = 0; i < 5; i++) {
        var bx = (i - 2) * 5, h = 74 - Math.abs(i - 2) * 12, sw = Math.sin(t * 1.1 + i * 0.9 + phase) * 6;
        var col = i % 2 ? '#3fae5f' : '#5cc46a';
        path(function () {
          G.moveTo(bx - 3, 0);
          G.quadraticCurveTo(bx - 6 + sw * 0.5, -h * 0.5, bx + sw, -h);
          G.quadraticCurveTo(bx + 4 + sw * 0.5, -h * 0.5, bx + 3, 0);
          G.closePath();
        }, col);
        G.beginPath(); G.moveTo(bx, -2); G.quadraticCurveTo(bx - 1 + sw * 0.5, -h * 0.5, bx + sw, -h + 4); G.strokeStyle = 'rgba(255,255,255,.35)'; G.lineWidth = 1; G.stroke();
      }
    } else if (k === 'muszla') {
      path(function () { G.moveTo(0, -2); G.lineTo(-16, -14); G.quadraticCurveTo(-14, -28, 0, -28); G.quadraticCurveTo(14, -28, 16, -14); G.closePath(); }, '#f9b8c6');
      G.strokeStyle = 'rgba(29,47,111,.4)'; G.lineWidth = 1.2;
      for (i = -2; i <= 2; i++) { G.beginPath(); G.moveTo(0, -3); G.lineTo(i * 6.5, -26 + Math.abs(i) * 3.5); G.stroke(); }
      path(function () { G.moveTo(-6, 0); G.lineTo(6, 0); G.lineTo(3, -5); G.lineTo(-3, -5); G.closePath(); }, '#f4a0b4');
      dot(-6, -20, 2, 'rgba(255,255,255,.6)');
    } else if (k === 'koral') {
      var br = [[0, 0, 0, -30], [0, -14, -14, -30], [-14, -30, -18, -44], [-14, -30, -6, -42], [0, -22, 14, -36], [14, -36, 12, -50], [14, -36, 22, -44], [0, -30, 3, -48]];
      G.strokeStyle = INK; G.lineWidth = 9;
      br.forEach(function (s) { G.beginPath(); G.moveTo(s[0], s[1]); G.lineTo(s[2], s[3]); G.stroke(); });
      G.strokeStyle = '#ff8a6a'; G.lineWidth = 6;
      br.forEach(function (s) { G.beginPath(); G.moveTo(s[0], s[1]); G.lineTo(s[2], s[3]); G.stroke(); });
      [[-18, -44], [-6, -42], [12, -50], [22, -44], [3, -48]].forEach(function (p) { dot(p[0], p[1], 1.6, '#ffd0c0'); });
    } else if (k === 'amfora') {
      G.save(); G.rotate(-0.25);
      ell(0, -13, 20, 12, 0, '#d9824a');
      path(function () { G.moveTo(17, -19); G.lineTo(28, -21); G.lineTo(28, -7); G.lineTo(17, -8); G.closePath(); }, '#d9824a');
      ell(28, -14, 3, 7, 0, '#7a3e1e');
      G.strokeStyle = '#f2c38e'; G.lineWidth = 2.5;
      G.beginPath(); G.ellipse(0, -13, 20, 12, 0, -0.9, 0.9); G.stroke();
      G.beginPath(); G.ellipse(-4, -13, 16, 12, 0, -1.0, 1.0); G.stroke();
      G.restore();
      dot(-8, -18, 2.2, 'rgba(255,255,255,.4)');
    } else if (k === 'zamek') {
      var stone = '#dcd5c6';
      // towers
      [[-26, 0], [26, 0]].forEach(function (p) {
        path(function () { G.rect(p[0] - 9, -62, 18, 62); }, stone);
        for (i = 0; i < 3; i++) path(function () { G.rect(p[0] - 9 + i * 6.5, -68, 5, 6); }, stone);
        path(function () { G.moveTo(p[0] - 5, -42); G.lineTo(p[0] - 5, -48); G.arc(p[0], -48, 5, Math.PI, 0); G.lineTo(p[0] + 5, -42); G.closePath(); }, '#2a3a6a');
      });
      path(function () { G.rect(-18, -46, 36, 46); }, stone);
      for (i = 0; i < 5; i++) path(function () { G.rect(-18 + i * 7.6, -51, 5.5, 5); }, stone);
      path(function () { G.moveTo(-8, 0); G.lineTo(-8, -18); G.arc(0, -18, 8, Math.PI, 0); G.lineTo(8, 0); G.closePath(); }, '#2a3a6a');
      // roofs + flag
      path(function () { G.moveTo(-37, -68); G.lineTo(-26, -86); G.lineTo(-15, -68); G.closePath(); }, '#e2533f');
      path(function () { G.moveTo(15, -68); G.lineTo(26, -86); G.lineTo(37, -68); G.closePath(); }, '#e2533f');
      G.beginPath(); G.moveTo(26, -86); G.lineTo(26, -98); G.strokeStyle = INK; G.lineWidth = 1.5; G.stroke();
      var fw = Math.sin(t * 2 + phase) * 2;
      path(function () { G.moveTo(26, -98); G.quadraticCurveTo(32, -97 + fw, 38, -95); G.quadraticCurveTo(32, -93 - fw, 26, -91); G.closePath(); }, '#f2b51d');
      G.strokeStyle = 'rgba(29,47,111,.18)'; G.lineWidth = 1;
      for (i = 0; i < 4; i++) { G.beginPath(); G.moveTo(-18, -10 - i * 10); G.lineTo(18, -10 - i * 10); G.stroke(); }
    } else if (k === 'skrzynia') {
      var cyc = (t + phase * 3) % 9, open = cyc < 7 ? 0 : cyc < 7.4 ? (cyc - 7) / 0.4 : cyc < 8.6 ? 1 : 1 - (cyc - 8.6) / 0.4;
      // glow + coins when open
      if (open > 0) {
        G.save(); G.globalAlpha = open * 0.6; dot(0, -26, 22, 'rgba(255,230,120,.6)'); G.restore();
        [[-10, -26], [-3, -28], [5, -27], [11, -25], [0, -31]].forEach(function (p) { circ(p[0], p[1], 3.5, '#f7c51e'); });
      }
      path(function () { G.rect(-22, -24, 44, 24); }, '#a8653a');
      G.fillStyle = '#f2b51d'; G.strokeStyle = INK; G.lineWidth = 1.5;
      [-14, 14].forEach(function (x) { G.beginPath(); G.rect(x - 3, -24, 6, 24); G.fill(); G.stroke(); });
      // lid hinged at back (top edge y=-24)
      G.save(); G.translate(0, -24); G.scale(1, 1 - open * 1.6);
      path(function () { G.moveTo(-22, 0); G.lineTo(-22, -6); G.quadraticCurveTo(0, -18, 22, -6); G.lineTo(22, 0); G.closePath(); }, '#b8743f');
      G.restore();
      path(function () { G.rect(-4, -27, 8, 9); }, '#f2b51d');
    }
  }

  // ---------- background scenes (static) ----------
  function drawScene(b, bg, W, H, sandTop, surf, uo) {
    var gr = b.createLinearGradient(0, surf, 0, H);
    gr.addColorStop(0, bg.top); gr.addColorStop(1, bg.bot);
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    var far = function (c, a) { return hexMix(c, bg.bot, a); };
    var u = uo || Math.min(W, H * 0.8) / 360;
    b.lineJoin = 'round'; b.lineCap = 'round';
    if (bg.k === 'zwykle') {
      b.fillStyle = far('#9fd2f0', 0.45);
      b.beginPath(); b.moveTo(0, sandTop);
      for (var x = 0; x <= W; x += 10) b.lineTo(x, sandTop - 30 * u - Math.sin(x / (60 * u)) * 16 * u - Math.sin(x / (21 * u)) * 6 * u);
      b.lineTo(W, sandTop); b.fill();
    } else if (bg.k === 'rafa') {
      var cols = ['#f49ab8', '#f7b267', '#b892e0', '#f57a7a'];
      for (var i = 0; i < 9; i++) {
        var cx = (i + 0.5) * W / 9 + Math.sin(i * 7) * 12 * u, base = sandTop + 4, c = far(cols[i % 4], 0.35);
        b.fillStyle = c; b.strokeStyle = c;
        if (i % 3 === 0) { // fan coral
          b.beginPath(); b.moveTo(cx, base); b.quadraticCurveTo(cx - 36 * u, base - 70 * u, cx, base - 84 * u); b.quadraticCurveTo(cx + 36 * u, base - 70 * u, cx, base); b.fill();
          b.strokeStyle = far('#ffffff', 0.6); b.lineWidth = 1.2 * u;
          for (var j = -3; j <= 3; j++) { b.beginPath(); b.moveTo(cx, base); b.lineTo(cx + j * 9 * u, base - 72 * u + Math.abs(j) * 8 * u); b.stroke(); }
        } else if (i % 3 === 1) { // brain coral
          b.beginPath(); b.ellipse(cx, base, 26 * u, 22 * u, 0, Math.PI, 0); b.fill();
          b.strokeStyle = far('#ffffff', 0.55); b.lineWidth = 1.5 * u;
          for (j = 0; j < 3; j++) { b.beginPath(); for (var xx = -20; xx <= 20; xx += 2) b.lineTo(cx + xx * u, base - (5 + j * 6) * u + Math.sin(xx * 0.6 + j) * 2 * u); b.stroke(); }
        } else { // branch coral
          b.lineWidth = 7 * u;
          [[0, 0, 0, -50], [0, -20, -16, -42], [0, -28, 15, -55], [-16, -42, -20, -60], [15, -55, 22, -66]].forEach(function (s) { b.beginPath(); b.moveTo(cx + s[0] * u, base + s[1] * u); b.lineTo(cx + s[2] * u, base + s[3] * u); b.stroke(); });
        }
      }
    } else if (bg.k === 'jezioro') {
      b.strokeStyle = far('#6f9a5a', 0.35); b.lineWidth = 3 * u;
      for (i = 0; i < 26; i++) { var rx = (i * 37 % 100) / 100 * W, h = (60 + (i * 53 % 70)) * u; b.beginPath(); b.moveTo(rx, sandTop + 4); b.quadraticCurveTo(rx + 6 * u, sandTop - h * 0.5, rx + (i % 2 ? 10 : -6) * u, sandTop - h); b.stroke(); }
      b.fillStyle = far('#7a6a55', 0.4);
      b.save(); b.translate(W * 0.62, sandTop - 6 * u); b.rotate(-0.12); b.beginPath(); b.ellipse(0, 0, 70 * u, 9 * u, 0, 0, 7); b.fill(); b.restore();
      b.fillStyle = far('#8c8f88', 0.4);
      [[0.15, 18], [0.3, 12], [0.85, 22]].forEach(function (s) { b.beginPath(); b.ellipse(W * s[0], sandTop + 2, s[1] * 1.4 * u, s[1] * u, 0, Math.PI, 0); b.fill(); });
    } else if (bg.k === 'statek') {
      b.save(); b.translate(W * 0.55, sandTop + 6 * u); b.rotate(-0.1); b.scale(u, u);
      b.fillStyle = far('#3c4a6a', 0.35);
      b.beginPath(); b.moveTo(-150, 0); b.lineTo(-135, -55); b.lineTo(120, -62); b.lineTo(150, -90); b.lineTo(140, 0); b.closePath(); b.fill();
      b.fillRect(-40, -150, 7, 95); b.fillRect(40, -120, 6, 60);
      b.fillRect(-75, -125, 80, 5);
      b.beginPath(); b.moveTo(-36, -150); b.lineTo(-16, -150); b.lineTo(-20, -138); b.lineTo(-36, -138); b.fill();
      b.fillStyle = far('#9fc3ea', 0.5);
      for (i = 0; i < 6; i++) { b.beginPath(); b.arc(-100 + i * 40, -32, 7, 0, 7); b.fill(); }
      b.restore();
    }
    // sand
    b.fillStyle = bg.sand;
    b.beginPath(); b.moveTo(0, H);
    for (x = 0; x <= W; x += 8) b.lineTo(x, sandTop + Math.sin(x / (50 * u)) * 4 * u + Math.sin(x / (17 * u)) * 1.5 * u);
    b.lineTo(W, H); b.closePath(); b.fill();
    b.strokeStyle = INK; b.lineWidth = 2; b.beginPath();
    for (x = 0; x <= W; x += 8) b.lineTo(x, sandTop + Math.sin(x / (50 * u)) * 4 * u + Math.sin(x / (17 * u)) * 1.5 * u);
    b.stroke();
    var seed = 3; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (i = 0; i < W * (H - sandTop) / 120; i++) { b.fillStyle = ['rgba(150,110,60,.25)', 'rgba(255,255,255,.4)', 'rgba(200,150,90,.3)'][i % 3]; b.beginPath(); b.arc(r() * W, sandTop + 6 + r() * (H - sandTop), 1 + r() * 1.3, 0, 7); b.fill(); }
  }

  // ---------- thumbnails ----------
  var thumbs = {};
  function fishThumb(F, size, lock) {
    var key = 'f' + F.k + size + (lock ? 'l' : '');
    if (thumbs[key]) return thumbs[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    var s = size / (F.shape === 'betta' ? 74 : F.shape === 'ray' ? 82 : F.shape === 'angel' ? 60 : 58);
    g.translate(size * (F.shape === 'betta' ? 0.6 : F.shape === 'ray' ? 0.6 : 0.55), size * (F.shape === 'seahorse' ? 0.5 : 0.52)); g.scale(s, s);
    U = 1.6 / s;
    drawFish(g, F, 0.6, false, 1);
    if (lock) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, c.width, c.height); }
    return (thumbs[key] = c.toDataURL());
  }
  function decoThumb(D, size, lock) {
    var key = 'd' + D.k + size + (lock ? 'l' : '');
    if (thumbs[key]) return thumbs[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    var s = size * 0.82 / Math.max(D.w, D.h + (D.k === 'zamek' ? 16 : 0));
    g.translate(size / 2, size * 0.88); g.scale(s, s);
    U = 1.6 / s;
    drawDeco(g, D.k, 0.5, 0);
    if (lock) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, c.width, c.height); }
    return (thumbs[key] = c.toDataURL());
  }
  function bgThumb(B, w, h) {
    var key = 'b' + B.k + w;
    if (thumbs[key]) return thumbs[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    g.save(); g.scale(w / 360, w / 360); drawScene(g, B, 360, h * 360 / w, h * 360 / w * 0.8, 4, 0.9); g.restore();
    return (thumbs[key] = c.toDataURL());
  }

  var CSS = [
    '.aq{display:flex;flex-direction:column;font-family:var(--hand);color:#1d2f6f;background:#2c74c2}',
    '.aq-cv{flex:1;position:relative;min-height:0}',
    '.aq-cv canvas{position:absolute;inset:0}',
    '.aq-bar{flex:none;display:flex;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f}',
    '.aq-btn{flex:1;min-height:56px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-size:1.3rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;padding:4px}',
    '.aq-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.aq-btn svg{width:34px;height:30px;flex:none}',
    '.aq-btn.hungry{background:#fff4d6;animation:aqglow 1.6s ease-in-out infinite}',
    '.aq-btn.on{background:#e3a008;color:#2a1d00}',
    '.aq-btn.done{color:#5a6690}',
    '@keyframes aqglow{50%{box-shadow:0 3px 0 #1d2f6f,0 0 0 5px rgba(227,160,8,.35)}}',
    '.aq-banner{position:absolute;left:50%;top:8px;transform:translateX(-50%);max-width:calc(100% - 20px);width:max-content;background:#fff;border:2px solid #1d2f6f;border-radius:14px;padding:4px 12px;font-size:1.05rem;text-align:center;box-shadow:0 3px 0 rgba(29,47,111,.2);z-index:2;pointer-events:none}',
    '.aq-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.aq-sheetw.on{opacity:1}',
    '.aq-sheet{position:absolute;left:0;right:0;bottom:0;max-height:88%;display:flex;flex-direction:column;background:#f5fbff;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.aq-sheetw.on .aq-sheet{transform:none}',
    '.aq-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 4px 16px}',
    '.aq-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.aq-sh-h .bal{font-size:1.2rem}.aq-sh-h .bal span{color:#e3a008}',
    '.aq-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1}',
    '.aq-tabs{display:flex;gap:6px;padding:4px 12px 6px}',
    '.aq-tab{flex:1;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.2rem}',
    '.aq-tab.on{background:#3f86d8;color:#fff}',
    '.aq-sh-b{overflow-y:auto;touch-action:pan-y;padding:2px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.aq-note{color:#5a6690;font-size:1.05rem;margin:4px 4px}',
    '.aq-note.warn{color:#cf412d}',
    '.aq-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.aq-row img{width:60px;height:60px;flex:none}',
    '.aq-row img.wide{width:84px;height:56px;border:2px solid #1d2f6f;border-radius:8px}',
    '.aq-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.aq-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.aq-row .tx i{font-style:normal;color:#7a4fc4;font-size:1.1rem}',
    '.aq-row .tx small{color:#5a6690;font-size:1rem;display:block}',
    '.aq-row.lock{opacity:.6}',
    '.aq-row.cur{border-color:#3f86d8;background:#eaf4ff}',
    '.aq-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font-size:1.25rem;box-shadow:0 3px 0 #1d2f6f}',
    '.aq-buy.pick{background:#fff;color:#1d2f6f}',
    '.aq-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.aq-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.aq-lockt{color:#7a4fc4;font-size:1.05rem;white-space:nowrap}'
  ].join('');
  var SVG_SHOP = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M6 12 h28 l-3 18 h-22 z" fill="#ffe7a3" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 12 q0 -9 7 -9 q7 0 7 9" fill="none" stroke="#1d2f6f" stroke-width="2.5"/><path d="M14 21 q6 -6 12 0 q-6 6 -12 0 z M14 21 l-4 -3 v6 z" fill="#f6982a" stroke="#1d2f6f" stroke-width="1.8"/></svg>';
  function svgFood(full) {
    return '<svg viewBox="0 0 40 34" aria-hidden="true"><rect x="10" y="9" width="20" height="22" rx="4" fill="' + (full ? '#f7c25a' : '#e6e9f2') + '" stroke="#1d2f6f" stroke-width="2.5"/><rect x="12" y="4" width="16" height="6" rx="2" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.5"/>' +
      '<circle cx="16" cy="19" r="2" fill="#a8653a"/><circle cx="23" cy="22" r="2" fill="#e2533f"/><circle cx="19" cy="26" r="2" fill="#5cbc4b"/></svg>';
  }

  NG.register('akwarium', {
    meta: { music: 'water' },
    medals: [
      { id: 'kinds3', stat: 'kinds', at: 3, tier: 1, text: '3 rodzaje rybek' },
      { id: 'feed7', stat: 'feed', at: 7, tier: 2, text: '7 dni karmienia' },
      { id: 'kinds10', stat: 'kinds', at: 10, tier: 3, text: '10 rodzajów rybek' }
    ],
    quests: [
      { id: 'feed', stat: 'feed', n: [1], text: 'Nakarm rybki w Akwarium' },
      { id: 'names', stat: 'names', n: [5, 8], text: 'Dotknij {n} rybek w Akwarium' }
    ],
    stickers: [
      { id: 'first', emoji: '🐟', name: 'Pierwsza rybka' },
      { id: 'rare', emoji: '🐠', name: 'Rzadka rybka' },
      { id: 'wedka', emoji: '🎣', name: 'Rybka z wędki' },
      { id: 'full', emoji: '🌊', name: 'Pełne akwarium' }
    ],
    mount: function (el, ctx) {
      var st = ctx.load({ v: 1, fish: [], deco: [], bg: 'zwykle', bgs: ['zwykle'], fedDay: '', seenHelp: false, nextId: 1 });
      ['fish', 'deco', 'bgs'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
      if (st.bgs.indexOf('zwykle') < 0) st.bgs.push('zwykle');
      if (!BB[st.bg]) st.bg = 'zwykle';
      st.fish = st.fish.filter(function (f) { return f && FB[f.sp]; });
      st.deco = st.deco.filter(function (d) { return d && DB[d.k]; });
      var lvl = ctx.level();

      var root = document.createElement('div'); root.className = 'aq';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var cvWrap = document.createElement('div'); cvWrap.className = 'aq-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var banner = document.createElement('div'); banner.className = 'aq-banner'; banner.hidden = true; cvWrap.appendChild(banner);
      var bar = document.createElement('div'); bar.className = 'aq-bar'; root.appendChild(bar);
      var bShop = document.createElement('button'); bShop.type = 'button'; bShop.className = 'aq-btn'; bShop.innerHTML = SVG_SHOP + '<span>Sklep</span>'; bar.appendChild(bShop);
      var bFood = document.createElement('button'); bFood.type = 'button'; bFood.className = 'aq-btn'; bar.appendChild(bFood);
      el.appendChild(root);
      var g = cv.getContext('2d');
      cv._aqFish = function () { return fish; }; // test hook (read-only use)

      var W = 0, H = 0, dpr = 1, u = 1, surf = 0, sandTop = 0, bgCache = null;
      var raf = 0, running = true, timers = [], last = 0, T = 0;
      var fish = [], food = [], bubbles = [], ripples = [], labels = [], hearts = [];
      var foodMode = 0, sheet = null, drag = null, bubbleClock = 0;

      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function save() { ctx.save(st); }
      function toast(text) {
        ctx.toast(text);
        var ts = el.querySelectorAll('.ng-toast'), t = ts[ts.length - 1];
        // #stage > * gives every stage child inset:0; pin the toast to the top centre instead
        if (t) t.style.cssText += ';inset:auto;top:14px;left:50%;right:auto;bottom:auto;white-space:normal;width:max-content;max-width:calc(100% - 24px);text-align:center';
      }
      function hungry(f) { return st.fedDay !== today() && f.born !== today(); }

      // ---------- stats, stickers, Wędkarz inbox ----------
      function fishStats() {
        if (!st.fish.length) return;
        var kinds = {};
        st.fish.forEach(function (f) { kinds[f.sp] = 1; });
        var nk = Object.keys(kinds).length;
        if (ctx.getStat('kinds') < nk) ctx.stat('kinds', nk, 'max');
        ctx.sticker('first');
        if (st.fish.some(function (f) { return FB[f.sp].lv >= RARE_LV; })) ctx.sticker('rare');
        if (st.fish.length >= MAX_FISH) ctx.sticker('full');
      }
      function takeInbox() {
        var box;
        try { box = JSON.parse(localStorage.getItem(INBOX) || '[]'); } catch (e) { box = []; }
        if (!Array.isArray(box) || !box.length) return;
        var keep = [], got = [];
        box.forEach(function (it) {
          var k = it && typeof it === 'object' ? (it.k || it.kind || it.sp) : it;
          if (!FB[k]) return; // unknown fish: drop it
          if (st.fish.length >= MAX_FISH) { keep.push(k); return; }
          var rec = { id: st.nextId++, sp: k, born: today(), from: 'wedka' };
          st.fish.push(rec);
          var o = spawn(rec, true);
          labels.push({ o: o, pl: FB[k].pl, en: FB[k].en, life: 3.5 });
          got.push(FB[k].pl);
        });
        save();
        try { if (keep.length) localStorage.setItem(INBOX, JSON.stringify(keep)); else localStorage.removeItem(INBOX); } catch (e) {}
        var wait = keep.length ? 'Akwarium jest pełne. ' + (keep.length === 1 ? 'Jedna rybka czeka' : keep.length + ' ' + (keep.length < 5 ? 'rybki czekają' : 'rybek czeka')) + ' w wiaderku.' : '';
        if (got.length) {
          later(function () { ctx.sfx('splash'); }, 150);
          toast('Z wędki: ' + got.join(', ') + '!' + (wait ? ' ' + wait : ''));
          ctx.sticker('wedka');
        } else if (wait) toast(wait);
      }

      // ---------- fish runtime ----------
      function zone(F) {
        if (F.zone === 'bottom') return [sandTop - 22 * u * F.size, sandTop - 8 * u];
        if (F.zone === 'mid') return [surf + (sandTop - surf) * 0.3, sandTop - 40 * u];
        return [surf + 26 * u, sandTop - 26 * u * F.size];
      }
      function spawn(rec, fromTop) {
        var F = FB[rec.sp], z = zone(F);
        var o = { rec: rec, F: F, x: rnd(40, Math.max(41, W - 40)), y: fromTop ? surf - 10 * u : rnd(z[0], z[1]), vx: rnd(-1, 1), vy: 0, face: 1, ph: rnd(0, 6), tx: 0, ty: 0, tt: 0, scare: 0, ate: 0, wig: 0 };
        o.face = o.vx < 0 ? -1 : 1;
        pickTarget(o);
        if (fromTop) { o.ty = rnd(z[0], z[1]); for (var i = 0; i < 10; i++) bubbles.push({ x: o.x + rnd(-14, 14) * u, y: surf + rnd(0, 20) * u, r: rnd(2, 4) * u, vy: -rnd(20, 40) * u, w: rnd(0, 6) }); }
        fish.push(o);
        return o;
      }
      function pickTarget(o) {
        var z = zone(o.F), m = 30 * u;
        if (o.F.zone === 'mid') { o.tx = clamp(o.x + rnd(-60, 60) * u, m, W - m); o.ty = rnd(z[0], z[1]); }
        else { o.tx = rnd(m, W - m); o.ty = rnd(z[0], z[1]); }
        o.tt = rnd(3, 8);
      }
      function stepFish(o, dt) {
        var F = o.F, base = 34 * u * F.speed * (hungry(o.rec) ? 0.7 : 1);
        var tx = o.tx, ty = o.ty, chase = null;
        o.tt -= dt;
        if (food.length && o.ate < 4) {
          var best = 1e9;
          for (var i = 0; i < food.length; i++) { var fd = food[i]; if (fd.rest > 6) continue; var d = Math.hypot(fd.x - o.x, fd.y - o.y); if (d < best) { best = d; chase = fd; } }
          if (chase) { tx = chase.x; ty = chase.y; base *= 1.7; if (best < 12 * u * Math.max(0.7, F.size)) { food.splice(food.indexOf(chase), 1); o.ate++; o.wig = 1; hearts.push({ x: o.x, y: o.y - 18 * u, life: 1.2 }); } }
        }
        if (!chase && (o.tt <= 0 || Math.hypot(tx - o.x, ty - o.y) < 14 * u)) { pickTarget(o); tx = o.tx; ty = o.ty; }
        var dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy) || 1;
        var max = base * (1 + o.scare * 2.5);
        var ax = dx / dd * max - o.vx, ay = dy / dd * max * 0.7 - o.vy;
        // separation
        for (var j = 0; j < fish.length; j++) {
          var q = fish[j]; if (q === o) continue;
          var sx = o.x - q.x, sy = o.y - q.y, s2 = sx * sx + sy * sy, rr = (10 + 18 * (F.size + q.F.size)) * u;
          if (s2 < rr * rr && s2 > 0.01) { var sd = Math.sqrt(s2); ax += sx / sd * (rr - sd) * 2.2; ay += sy / sd * (rr - sd) * 2.2; }
        }
        var k = Math.min(1, dt * (1.2 + o.scare * 3));
        o.vx += ax * k; o.vy += ay * k;
        var sp = Math.hypot(o.vx, o.vy), lim = max * 1.2;
        if (sp > lim) { o.vx *= lim / sp; o.vy *= lim / sp; }
        o.x += o.vx * dt; o.y += o.vy * dt;
        var z = zone(F), m = 16 * u;
        if (o.x < m) { o.x = m; o.vx = Math.abs(o.vx); }
        if (o.x > W - m) { o.x = W - m; o.vx = -Math.abs(o.vx); }
        var top = Math.min(z[0], surf + 18 * u), bot = Math.max(z[1], sandTop - 10 * u);
        if (o.scare > 0.05) { top = surf + 14 * u; }
        if (o.y < top) { o.y = top; o.vy = Math.abs(o.vy) * 0.5; }
        if (o.y > bot) { o.y = bot; o.vy = -Math.abs(o.vy) * 0.5; }
        o.scare = Math.max(0, o.scare - dt * 0.8);
        o.wig = Math.max(0, o.wig - dt * 1.5);
        if (Math.abs(o.vx) > 2 * u) { var want = o.vx < 0 ? -1 : 1; o.face += (want - o.face) * Math.min(1, dt * 5); }
        o.ph += dt * (5 + Math.hypot(o.vx, o.vy) / (8 * u)) * (F.shape === 'betta' ? 0.6 : 1);
      }
      function fishScale(F) { return u * F.size * 1.25; }
      function drawOne(o) {
        var F = o.F, s = fishScale(F), tilt = F.shape === 'seahorse' ? 0 : clamp(Math.atan2(o.vy, Math.abs(o.vx) + 1) * 0.6, -0.5, 0.5);
        g.save(); g.translate(o.x, o.y);
        g.scale(o.face >= 0 ? Math.max(0.15, o.face) : Math.min(-0.15, o.face), 1);
        g.rotate(tilt + Math.sin(o.wig * 14) * 0.15 * o.wig);
        g.scale(s, s);
        U = 1.8 / s;
        drawFish(g, F, o.ph, hungry(o.rec), 1);
        g.restore();
      }

      // ---------- decorations runtime ----------
      function decoPos(d) { return { x: d.x * W, y: sandTop + 6 * u + d.y * Math.max(4, H - sandTop - 12 * u) }; }
      function decoScale(d) { return u * (0.88 + 0.22 * d.y); }
      function decoHit(d, x, y) {
        var D = DB[d.k], p = decoPos(d), s = decoScale(d), w = D.w * s / 2 + 8, h = D.h * s + 8;
        return x > p.x - w && x < p.x + w && y > p.y - h && y < p.y + 10;
      }

      // ---------- layout ----------
      function layout() {
        var r = cvWrap.getBoundingClientRect();
        var oW = W, oH = H;
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        u = Math.min(W, H * 0.8) / 360;
        surf = 16 * u; sandTop = H - Math.max(56, H * 0.14);
        if (oW && oH) fish.forEach(function (o) { o.x *= W / oW; o.y = surf + (o.y - surf) * (H / oH); pickTarget(o); });
        buildBg();
      }
      function buildBg() {
        bgCache = document.createElement('canvas'); bgCache.width = cv.width; bgCache.height = cv.height;
        var b = bgCache.getContext('2d'); b.scale(dpr, dpr);
        drawScene(b, BB[st.bg], W, H, sandTop, surf);
      }

      // ---------- frame ----------
      function drawFrame(dt) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (bgCache) g.drawImage(bgCache, 0, 0, W, H);
        // light rays
        g.save(); g.globalCompositeOperation = 'lighter';
        for (var i = 0; i < 4; i++) {
          var x = W * (0.12 + i * 0.26) + Math.sin(T * 0.25 + i * 1.7) * 24 * u, wdt = (26 + 10 * Math.sin(T * 0.3 + i)) * u;
          var grd = g.createLinearGradient(0, 0, 0, sandTop);
          grd.addColorStop(0, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grd;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + wdt, 0); g.lineTo(x + wdt * 2.4 + 40 * u, sandTop); g.lineTo(x + 40 * u, sandTop); g.closePath(); g.fill();
        }
        g.restore();
        // built-in plants at the back corners
        drawWeeds(W * 0.06, 0.95, 0); drawWeeds(W * 0.93, 1.15, 2);
        // aerator
        var ax = W * 0.2;
        g.save(); g.translate(ax, sandTop + 2 * u); g.scale(u, u); U = 1.6 / u;
        G = g; ell(0, 0, 9, 4, 0, '#8f9cad'); g.restore();
        bubbleClock -= dt;
        if (bubbleClock <= 0) { bubbleClock = rnd(0.35, 0.7); bubbles.push({ x: ax + rnd(-3, 3) * u, y: sandTop - 2 * u, r: rnd(1.6, 4) * u, vy: -rnd(30, 46) * u, w: rnd(0, 6) }); }
        // decorations sorted by depth
        var ds = st.deco.slice().sort(function (a, b) { return a.y - b.y; });
        ds.forEach(function (d) {
          var p = decoPos(d), s = decoScale(d), lifted = drag && drag.d === d && drag.moving;
          g.save(); g.translate(p.x, p.y);
          if (lifted) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 4 * u, DB[d.k].w * s * 0.5, 5 * u, 0, 0, 7); g.fill(); g.translate(0, -8 * u); }
          g.scale(s, s); U = 1.7 / s;
          drawDeco(g, d.k, T, d.id % 7);
          g.restore();
          if ((d.k === 'zamek' || d.k === 'skrzynia') && Math.random() < dt * (d.k === 'zamek' ? 0.6 : 0)) bubbles.push({ x: p.x + (Math.random() < 0.5 ? -26 : 26) * s, y: p.y - 46 * s, r: rnd(1.5, 3) * u, vy: -rnd(25, 40) * u, w: rnd(0, 6) });
          if (d.k === 'skrzynia') { var cyc = (T + (d.id % 7) * 3) % 9; if (cyc > 7.1 && cyc < 8.4 && Math.random() < dt * 14) bubbles.push({ x: p.x + rnd(-12, 12) * s, y: p.y - 30 * s, r: rnd(1.5, 3.5) * u, vy: -rnd(30, 50) * u, w: rnd(0, 6) }); }
        });
        // food
        food = food.filter(function (f) {
          if (f.y < sandTop - 3 * u + (f.k % 3) * 2 * u) { f.y += 14 * u * dt; f.x += Math.sin(T * 2 + f.k) * 6 * u * dt; }
          else f.rest += dt;
          if (f.rest > 16) return false;
          g.globalAlpha = f.rest > 12 ? (16 - f.rest) / 4 : 1;
          g.fillStyle = ['#a8653a', '#e2533f', '#5cbc4b', '#f2b51d'][f.k % 4];
          g.beginPath(); g.ellipse(f.x, f.y, 2.6 * u, 1.8 * u, f.k, 0, 7); g.fill();
          g.globalAlpha = 1;
          return true;
        });
        // fish
        fish.forEach(function (o) { stepFish(o, dt); });
        fish.slice().sort(function (a, b) { return a.F.size - b.F.size; }).forEach(drawOne);
        // front weeds
        drawWeeds(W * 0.8, 0.75, 4);
        // bubbles
        bubbles = bubbles.filter(function (b) {
          b.y += b.vy * dt; b.x += Math.sin(T * 3 + b.w) * 8 * u * dt;
          if (b.y < surf + b.r) return false;
          g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
          g.beginPath(); g.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, 7); g.fillStyle = '#fff'; g.fill();
          return true;
        });
        // hearts
        hearts = hearts.filter(function (h) {
          h.life -= dt; h.y -= 18 * u * dt; if (h.life <= 0) return false;
          g.save(); g.globalAlpha = Math.min(1, h.life * 2); g.translate(h.x, h.y); g.scale(u, u);
          g.fillStyle = '#f47fb0'; g.strokeStyle = INK; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(0, 5); g.bezierCurveTo(-9, -1, -5, -9, 0, -4); g.bezierCurveTo(5, -9, 9, -1, 0, 5); g.fill(); g.stroke();
          g.restore(); return true;
        });
        // ripples
        ripples = ripples.filter(function (r) {
          r.t += dt; if (r.t > 0.7) return false;
          g.beginPath(); g.arc(r.x, r.y, (10 + r.t * 90) * u, 0, 7); g.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - r.t / 0.7)) + ')'; g.lineWidth = 3; g.stroke();
          return true;
        });
        // water surface
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, surf);
        for (var xx = 0; xx <= W; xx += 8) g.lineTo(xx, surf + Math.sin(xx / (22 * u) + T * 1.5) * 2.5 * u);
        g.lineTo(W, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath();
        for (xx = 0; xx <= W; xx += 8) g.lineTo(xx, surf + Math.sin(xx / (22 * u) + T * 1.5) * 2.5 * u);
        g.stroke();
        // glass shine
        g.fillStyle = 'rgba(255,255,255,.10)';
        g.beginPath(); g.moveTo(W * 0.68, 0); g.lineTo(W * 0.76, 0); g.lineTo(W * 0.5, H); g.lineTo(W * 0.42, H); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(W * 0.8, 0); g.lineTo(W * 0.83, 0); g.lineTo(W * 0.57, H); g.lineTo(W * 0.54, H); g.closePath(); g.fill();
        // labels
        labels = labels.filter(function (l) {
          l.life -= dt; if (l.life <= 0) return false;
          var x = l.o ? l.o.x : l.x, y = l.o ? l.o.y - 26 * u * (l.o.F ? l.o.F.size : 1) - 14 : l.y;
          drawLabel(x, y, l.pl, l.en, Math.min(1, l.life * 3));
          return true;
        });
      }
      function drawWeeds(x0, sc, seed) {
        g.save(); g.translate(x0, sandTop + 6 * u); g.scale(u * sc, u * sc); U = 1.6 / (u * sc); G = g;
        g.lineJoin = 'round';
        for (var i = 0; i < 4; i++) {
          var bx = (i - 1.5) * 7, h = 90 - (i % 2) * 22 - seed * 2, sw = Math.sin(T * 0.9 + i + seed) * 8;
          path(function () { G.moveTo(bx - 3.5, 0); G.bezierCurveTo(bx - 10 + sw * 0.3, -h * 0.35, bx + 6 + sw * 0.7, -h * 0.7, bx + sw, -h); G.bezierCurveTo(bx + 10 + sw * 0.7, -h * 0.7, bx + 3 + sw * 0.3, -h * 0.35, bx + 3.5, 0); G.closePath(); }, i % 2 ? '#2f9a55' : '#46b866');
        }
        g.restore();
      }
      function drawLabel(x, y, pl, en, a) {
        g.save(); g.globalAlpha = a;
        g.font = Math.round(19 * Math.max(0.9, Math.min(1.2, u))) + 'px ' + FONT;
        var t1 = pl, t2 = en ? ' / ' + en : '', w1 = g.measureText(t1).width, w2 = g.measureText(t2).width, w = w1 + w2 + 22, h = 32;
        var lx = clamp(x - w / 2, 6, W - w - 6), ly = clamp(y - h, surf + 4, H - h - 4);
        g.beginPath(); g.moveTo(lx + 12, ly); g.arcTo(lx + w, ly, lx + w, ly + h, 12); g.arcTo(lx + w, ly + h, lx, ly + h, 12); g.arcTo(lx, ly + h, lx, ly, 12); g.arcTo(lx, ly, lx + w, ly, 12); g.closePath();
        g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = INK; g.fillText(t1, lx + 11, ly + h / 2 + 1);
        if (t2) { g.fillStyle = LVL; g.fillText(t2, lx + 11 + w1, ly + h / 2 + 1); }
        g.restore();
      }

      function frame(now) {
        raf = 0; if (!running) return;
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; T += dt;
        if (W) drawFrame(dt);
      }
      function start() { if (!raf && running) { last = 0; raf = requestAnimationFrame(frame); } }

      // ---------- UI ----------
      function updateBar() {
        var fed = st.fedDay === today();
        bFood.className = 'aq-btn' + (foodMode ? ' on' : fed ? ' done' : st.fish.length ? ' hungry' : '');
        bFood.innerHTML = svgFood(!fed || foodMode) + '<span>' + (foodMode ? 'Sypnij (' + foodMode + ')' : fed ? 'Najedzone ✓' : 'Karm') + '</span>';
        if (foodMode) { banner.hidden = false; banner.textContent = 'Dotknij wody, żeby sypnąć jedzenie.'; }
        else if (!st.fish.length) { banner.hidden = false; banner.textContent = 'Kup pierwszą rybkę w sklepie.'; }
        else if (!fed && fish.some(function (o) { return hungry(o.rec); })) { banner.hidden = false; banner.textContent = 'Rybki są głodne. Nakarm je!'; }
        else banner.hidden = true;
      }
      function feedBtn() {
        if (foodMode) { foodMode = 0; updateBar(); return; }
        if (!st.fish.length) { ctx.sfx('error'); toast('Najpierw kup rybkę w sklepie.'); return; }
        if (st.fedDay === today()) { ctx.sfx('tap'); toast('Rybki już dziś jadły. Jutro znowu!'); return; }
        foodMode = 3; updateBar();
        ctx.sfx('tap');
      }
      function sprinkle(x) {
        for (var i = 0; i < 7; i++) food.push({ x: clamp(x + rnd(-18, 18) * u, 10, W - 10), y: surf + rnd(-4, 6) * u, rest: 0, k: Math.floor(Math.random() * 1000) });
        fish.forEach(function (o) { o.ate = Math.min(o.ate, 1); });
        ctx.sfx('splash');
        if (st.fedDay !== today()) { st.fedDay = today(); save(); ctx.stat('feed', 1); }
        foodMode--;
        updateBar();
      }

      function closeSheet() {
        if (!sheet) return;
        ctx.sfx('close');
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        later(function () { s.wrap.remove(); }, 260);
      }
      function openShop(tab) {
        closeSheet();
        var wrap = document.createElement('div'); wrap.className = 'aq-sheetw';
        var sh = document.createElement('div'); sh.className = 'aq-sheet'; wrap.appendChild(sh);
        sh.innerHTML = '<div class="aq-sh-h"><h3>Sklep</h3><span class="bal"><span>★</span> <b style="font-weight:400"></b></span><button type="button" class="aq-x" aria-label="Zamknij">×</button></div>' +
          '<div class="aq-tabs"><button type="button" class="aq-tab" data-t="fish">Rybki</button><button type="button" class="aq-tab" data-t="deco">Ozdoby</button><button type="button" class="aq-tab" data-t="bg">Tła</button></div><div class="aq-sh-b"></div>';
        var body = sh.querySelector('.aq-sh-b');
        sh.querySelector('.aq-x').onclick = closeSheet;
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        Array.prototype.forEach.call(sh.querySelectorAll('.aq-tab'), function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); render(); }; });
        root.appendChild(wrap); void wrap.offsetWidth; wrap.classList.add('on');
        ctx.sfx('open');
        sheet = { wrap: wrap };
        function note(text, warn) { var p = document.createElement('p'); p.className = 'aq-note' + (warn ? ' warn' : ''); p.innerHTML = text; body.appendChild(p); }
        function row(img, wide, title, sub, extra) {
          var r = document.createElement('div'); r.className = 'aq-row';
          r.innerHTML = '<img alt="" class="' + (wide ? 'wide' : '') + '" src="' + img + '"><div class="tx"><b></b><small></small></div>';
          r.querySelector('b').innerHTML = title; r.querySelector('small').textContent = sub || '';
          if (!sub) r.querySelector('small').remove();
          body.appendChild(r);
          if (extra) r.appendChild(extra);
          return r;
        }
        function buyBtn(label, disabled, fn, cls) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'aq-buy' + (cls ? ' ' + cls : '');
          b.textContent = label; b.disabled = !!disabled; b.onclick = fn; return b;
        }
        function lockT(lv) { var s = document.createElement('span'); s.className = 'aq-lockt'; s.textContent = 'od poziomu ' + lv; return s; }
        function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
        function render() {
          if (!wrap.isConnected) return;
          var bal = ctx.balance();
          sh.querySelector('.bal b').textContent = bal;
          Array.prototype.forEach.call(sh.querySelectorAll('.aq-tab'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); });
          body.innerHTML = '';
          if (tab === 'fish') {
            var full = st.fish.length >= MAX_FISH;
            note('Rybki w akwarium: ' + st.fish.length + ' z ' + MAX_FISH + (full ? '. Akwarium jest pełne!' : ''), full);
            FISH.forEach(function (F) {
              var locked = F.lv > lvl, have = st.fish.filter(function (f) { return f.sp === F.k; }).length;
              var r = row(fishThumb(F, 120, locked), false, esc(F.pl) + ' <i>/ ' + esc(F.en) + '</i>', have ? 'masz: ' + have : '',
                locked ? lockT(F.lv) : buyBtn(F.price + ' ★', full || F.price > bal, function () { buyFish(F); }));
              if (locked) r.classList.add('lock');
            });
          } else if (tab === 'deco') {
            var dfull = st.deco.length >= MAX_DECO;
            note(dfull ? 'Nie ma już miejsca na ozdoby.' : 'Ozdoby możesz przesuwać palcem po piasku.', dfull);
            DECOS.forEach(function (D) {
              var locked = D.lv > lvl, have = st.deco.filter(function (d) { return d.k === D.k; }).length;
              var r = row(decoThumb(D, 120, locked), false, esc(D.n), have ? 'masz: ' + have : '',
                locked ? lockT(D.lv) : buyBtn(D.price + ' ★', dfull || D.price > bal, function () { buyDeco(D); }));
              if (locked) r.classList.add('lock');
            });
          } else {
            note('Nowe tło co 5 poziomów.');
            BGS.forEach(function (B) {
              var locked = B.lv > lvl, own = st.bgs.indexOf(B.k) >= 0, cur = st.bg === B.k, btn;
              if (cur) btn = buyBtn('Teraz', true, null, 'pick');
              else if (own) btn = buyBtn('Wybierz', false, function () { ctx.sfx('click'); setBg(B.k); render(); }, 'pick');
              else if (locked) btn = lockT(B.lv);
              else btn = buyBtn(B.price + ' ★', B.price > bal, function () { if (ctx.spend(B.price, 'tło: ' + B.n)) { ctx.sfx('buy'); st.bgs.push(B.k); setBg(B.k); toast('Nowe tło: ' + B.n + '!'); render(); } else render(); });
              var r = row(bgThumb(B, 168, 112), true, esc(B.n), '', btn);
              if (cur) r.classList.add('cur');
              if (locked && !own) r.classList.add('lock');
            });
          }
          var cheapest = 50;
          if (bal < cheapest) note('Brakuje gwiazdek. Zdobądź je w <a href="/matma/">Matmie</a>, <a href="/angielski/">Angielskim</a> albo <a href="/polski/">Polskim</a>.', true);
        }
        function buyFish(F) {
          if (st.fish.length >= MAX_FISH) return;
          if (!ctx.spend(F.price, 'rybka: ' + F.pl)) { render(); return; }
          var rec = { id: st.nextId++, sp: F.k, born: today() };
          st.fish.push(rec); save();
          ctx.sfx('buy');
          closeSheet();
          later(function () { ctx.sfx('splash'); }, 250);
          fishStats();
          var o = spawn(rec, true);
          labels.push({ o: o, pl: F.pl, en: F.en, life: 3.5 });
          updateBar();
        }
        function buyDeco(D) {
          if (st.deco.length >= MAX_DECO) return;
          if (!ctx.spend(D.price, 'ozdoba: ' + D.n)) { render(); return; }
          var d = { id: st.nextId++, k: D.k, x: rnd(0.15, 0.85), y: rnd(0.2, 0.8) };
          st.deco.push(d); save();
          ctx.sfx('buy');
          closeSheet();
          var p = decoPos(d);
          labels.push({ x: p.x, y: p.y - DB[D.k].h * u - 10, pl: D.n, en: '', life: 2.5 });
          toast('Przesuń ozdobę palcem, gdzie chcesz.');
        }
        render();
      }
      function setBg(k) { st.bg = k; save(); buildBg(); }

      // ---------- input ----------
      var down = null;
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function fishAt(x, y) {
        var best = null, bd = 1e9;
        for (var i = 0; i < fish.length; i++) {
          var o = fish[i], d = Math.hypot(o.x - x, o.y - y), r = Math.max(26, 30 * u * o.F.size);
          if (d < r && d < bd) { bd = d; best = o; }
        }
        return best;
      }
      function onDown(e) {
        var p = pos(e);
        down = { x: p.x, y: p.y, id: e.pointerId };
        if (!foodMode && !fishAt(p.x, p.y)) {
          var sorted = st.deco.slice().sort(function (a, b) { return b.y - a.y; }); // front first
          for (var j = 0; j < sorted.length; j++) if (decoHit(sorted[j], p.x, p.y)) { var dp = decoPos(sorted[j]); drag = { d: sorted[j], ox: p.x - dp.x, oy: p.y - dp.y, moving: false }; break; }
        }
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      }
      function onMove(e) {
        if (!drag || !down || down.id !== e.pointerId) return;
        var p = pos(e);
        if (!drag.moving && Math.hypot(p.x - down.x, p.y - down.y) > 8) drag.moving = true;
        if (drag.moving) {
          var band = Math.max(4, H - sandTop - 12 * u);
          drag.d.x = clamp((p.x - drag.ox) / W, 0.04, 0.96);
          drag.d.y = clamp((p.y - drag.oy - sandTop - 6 * u) / band, 0, 1);
        }
      }
      function onUp(e) {
        if (!down || down.id !== e.pointerId) return;
        var p = pos(e), moved = Math.hypot(p.x - down.x, p.y - down.y);
        down = null;
        if (drag) {
          var d = drag.d, was = drag.moving; drag = null;
          if (was) { save(); ctx.sfx('place'); return; }
          if (moved < 12) { var dp = decoPos(d); labels.push({ x: dp.x, y: dp.y - DB[d.k].h * decoScale(d) - 6, pl: DB[d.k].n, en: '', life: 2 }); return; }
        }
        if (moved > 14) return;
        if (foodMode) { if (p.y < sandTop) sprinkle(p.x); return; }
        var o = fishAt(p.x, p.y);
        if (o) {
          labels = labels.filter(function (l) { return l.o !== o; });
          labels.push({ o: o, pl: o.F.pl, en: o.F.en, life: 2.8 });
          o.wig = 1;
          ctx.sfx('pop');
          if (!o.named || T - o.named > 4) ctx.stat('names', 1); // same fish counts again after a short while
          o.named = T || 0.001;
          return;
        }
        // tap on the glass: fish scatter
        ripples.push({ x: p.x, y: p.y, t: 0 });
        ctx.sfx('bubble');
        fish.forEach(function (q) {
          var dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, R = 150 * u;
          if (d < R) {
            var f = (1 - d / R);
            q.scare = Math.max(q.scare, 0.4 + f * 0.6);
            q.vx += dx / d * 140 * u * f; q.vy += dy / d * 100 * u * f;
            q.tx = clamp(q.x + dx / d * 120 * u, 20, W - 20); q.ty = q.y + dy / d * 60 * u; q.tt = 1.5;
          }
        });
      }
      function onCancel() { down = null; if (drag && drag.moving) save(); drag = null; }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onCancel);
      bShop.onclick = function () { if (foodMode) { foodMode = 0; updateBar(); } openShop('fish'); };
      bFood.onclick = feedBtn;

      // ---------- boot ----------
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      layout();
      st.fish.forEach(function (r) { spawn(r, false); });
      takeInbox();
      fishStats();
      updateBar();
      var offS = window.Skarbonka.on(function () { var l = ctx.level(); if (l !== lvl) lvl = l; });
      var iv = setInterval(function () { if (running) updateBar(); }, 20000);
      start();
      if (!st.seenHelp) {
        st.seenHelp = true; save();
        ctx.panel({ title: 'Akwarium', medals: true, lines: ['Kup rybki i ozdoby w sklepie.', 'Karm rybki raz dziennie.', { text: 'Dotknij rybki, a powie, jak się nazywa po polsku i po angielsku.', muted: true }], button: 'Do akwarium', closable: false });
      }

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (running) return; running = true; var n = st.fish.length; takeInbox(); if (st.fish.length > n) fishStats(); updateBar(); start(); },
        destroy: function () {
          running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          timers.forEach(clearTimeout); clearInterval(iv);
          ro.disconnect(); offS();
          cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
          cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onCancel);
          root.remove();
        }
      };
    }
  });
})();
