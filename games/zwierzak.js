/*
 * Zwierzątko: a pet hedgehog (the same hero as Jeżyk w biegu) in its little house.
 * Four needs (brzuszek, humor, czystość, sen) drop slowly in real time, from timestamps, also while the
 * app is closed. Nothing bad ever happens: at worst the hedgehog looks a bit sad and says it missed you.
 * Feed (food for 10-25 ★, a free apple basket every day), bath (drag the sponge), sleep (lights off),
 * pet/tickle (tap), dress up with the items the child owns in Jeżyk w biegu (read-only), and two
 * mini-games for 30 ★ that fill "humor": catching apples and hide-and-seek in the leaves.
 * Logical coordinates: 1 unit = S css px, a portrait phone is ~400 units wide.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var GAME_PRICE = 30, BASKET = 3, MIN_NEED = 5, ROUNDS = 5;
  var NEEDS = ['food', 'fun', 'clean', 'sleep'];
  var RATES = { food: 2, fun: 2.5, clean: 1.5, sleep: 2 };   // points lost per hour (100 = full)
  var SLEEP_GAIN_H = 60, SLEEP_GAIN_S = 4;                  // asleep: per hour while away, per second on screen
  var PET_FUN_CAP = 70;                                    // petting alone fills "humor" up to here

  var FOODS = [
    { k: 'jablko',   n: 'Jabłko',     price: 10, food: 20 },
    { k: 'gruszka',  n: 'Gruszka',    price: 12, food: 25 },
    { k: 'jagody',   n: 'Jagody',     price: 15, food: 30 },
    { k: 'grzybek',  n: 'Grzybek',    price: 18, food: 35 },
    { k: 'ciastko',  n: 'Ciasteczko', price: 20, food: 40, fun: 5 },
    { k: 'babeczka', n: 'Babeczka',   price: 25, food: 55, fun: 10 }
  ];
  // same ids/slots as Jeżyk w biegu (the child buys them there)
  var ITEMS = [
    { id: 'czapka',   name: 'Czapka',   slot: 'head' },
    { id: 'szalik',   name: 'Szalik',   slot: 'neck' },
    { id: 'kokardka', name: 'Kokardka', slot: 'head' },
    { id: 'korona',   name: 'Korona',   slot: 'head' },
    { id: 'okulary',  name: 'Okulary',  slot: 'eyes' }
  ];
  var SURPRISES = [
    { k: 'biedronka', n: 'biedronka' }, { k: 'zoladz', n: 'żołądź' }, { k: 'slimak', n: 'ślimak' },
    { k: 'szyszka', n: 'szyszka' }, { k: 'grzybek', n: 'grzybek' }, { k: 'jablko', n: 'jabłko' }
  ];
  var LEAF_COLS = ['#e9813c', '#f5c330', '#cf412d', '#d9622b', '#f0a43a'];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pl(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function outline(g, w) { g.lineWidth = w || 2; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function star(g, x, y, r, col) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r2 = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    g.closePath(); g.fillStyle = col; g.fill(); outline(g, Math.max(1, r * 0.25));
  }
  function heart(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y + r * 0.9);
    g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5);
    g.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    g.closePath(); g.fillStyle = col || '#ff7eb6'; g.fill(); outline(g, Math.max(1, r * 0.22));
  }

  // ---------- food and little things (centre 0,0, size r) ----------
  function drawApple(g, x, y, r, col) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = col || '#e2533f'; g.fill(); outline(g, Math.max(1, r * 0.22));
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.3, r * 0.28, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + r * 0.9, y - r * 1.7, x + r * 1.2, y - r * 1.05);
    g.quadraticCurveTo(x + r * 0.5, y - r * 0.9, x, y - r); g.fillStyle = '#3fae5f'; g.fill(); outline(g, Math.max(0.8, r * 0.12));
  }
  var THING = {
    jablko: function (g, r) { drawApple(g, 0, 0, r); },
    gruszka: function (g, r) {
      g.beginPath(); g.moveTo(0, -r * 1.15);
      g.bezierCurveTo(r * 0.55, -r * 1.15, r * 0.35, -r * 0.35, r * 0.9, r * 0.25);
      g.bezierCurveTo(r * 1.2, r * 1.0, -r * 1.2, r * 1.0, -r * 0.9, r * 0.25);
      g.bezierCurveTo(-r * 0.35, -r * 0.35, -r * 0.55, -r * 1.15, 0, -r * 1.15);
      g.fillStyle = '#b5d84a'; g.fill(); outline(g, Math.max(1, r * 0.2));
      g.beginPath(); g.arc(-r * 0.3, r * 0.2, r * 0.22, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      g.beginPath(); g.moveTo(0, -r * 1.1); g.lineTo(r * 0.15, -r * 1.5); outline(g, Math.max(1, r * 0.18));
    },
    jagody: function (g, r) {
      [[-0.45, 0.25], [0.45, 0.25], [0, -0.38]].forEach(function (p) {
        g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.52, 0, Math.PI * 2); g.fillStyle = '#4a64c8'; g.fill(); outline(g, Math.max(1, r * 0.16));
        g.beginPath(); g.arc(p[0] * r - r * 0.16, p[1] * r - r * 0.16, r * 0.13, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
      });
      g.beginPath(); g.ellipse(r * 0.5, -r * 0.85, r * 0.45, r * 0.2, -0.5, 0, Math.PI * 2); g.fillStyle = '#3fae5f'; g.fill(); outline(g, Math.max(0.8, r * 0.12));
    },
    grzybek: function (g, r) {
      var k = r / 13;
      rr(g, -5 * k, -2 * k, 10 * k, 14 * k, 4 * k); g.fillStyle = '#fff4dc'; g.fill(); outline(g, Math.max(1, 1.8 * k));
      g.beginPath(); g.moveTo(-14 * k, 0); g.quadraticCurveTo(-14 * k, -17 * k, 0, -17 * k); g.quadraticCurveTo(14 * k, -17 * k, 14 * k, 0); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g, Math.max(1, 1.8 * k));
      g.fillStyle = '#fff';
      [[-7, -8, 2.8], [3, -12, 2.5], [8, -5, 2.1], [-1, -4, 1.7]].forEach(function (p) { g.beginPath(); g.arc(p[0] * k, p[1] * k, p[2] * k, 0, Math.PI * 2); g.fill(); });
    },
    ciastko: function (g, r) {
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#d99a52'; g.fill(); outline(g, Math.max(1, r * 0.18));
      g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.strokeStyle = 'rgba(160,100,40,.45)'; g.lineWidth = r * 0.08; g.stroke();
      g.fillStyle = '#5a3a22';
      [[-0.4, -0.3], [0.35, -0.4], [0.1, 0.15], [-0.35, 0.4], [0.5, 0.35]].forEach(function (p) { g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.13, 0, Math.PI * 2); g.fill(); });
    },
    babeczka: function (g, r) {
      g.beginPath(); g.moveTo(-r * 0.85, -r * 0.05); g.lineTo(r * 0.85, -r * 0.05); g.lineTo(r * 0.6, r); g.lineTo(-r * 0.6, r); g.closePath();
      g.fillStyle = '#7fc4f0'; g.fill(); outline(g, Math.max(1, r * 0.15));
      g.beginPath(); for (var i = -2; i <= 2; i++) { g.moveTo(i * r * 0.3, 0); g.lineTo(i * r * 0.22, r * 0.95); }
      g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = Math.max(0.8, r * 0.08); g.stroke();
      g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(-r * 1.05, -r * 0.6, -r * 0.4, -r * 0.65); g.quadraticCurveTo(-r * 0.3, -r * 1.2, r * 0.2, -r * 1.0);
      g.quadraticCurveTo(r * 0.9, -r * 0.95, r * 0.75, -r * 0.45); g.quadraticCurveTo(r * 1.1, -r * 0.2, r, 0); g.closePath();
      g.fillStyle = '#ffb3d1'; g.fill(); outline(g, Math.max(1, r * 0.15));
      g.beginPath(); g.arc(r * 0.05, -r * 1.12, r * 0.24, 0, Math.PI * 2); g.fillStyle = '#e2533f'; g.fill(); outline(g, Math.max(0.8, r * 0.1));
      g.fillStyle = '#fff'; [[-0.5, -0.3], [0.3, -0.55], [0.55, -0.2]].forEach(function (p) { g.fillRect(p[0] * r, p[1] * r, r * 0.14, r * 0.07); });
    },
    koszyk: function (g, r) {
      drawApple(g, -r * 0.42, -r * 0.45, r * 0.38); drawApple(g, r * 0.4, -r * 0.5, r * 0.38); drawApple(g, 0, -r * 0.62, r * 0.38);
      g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(r, -r * 0.3); g.lineTo(r * 0.75, r * 0.7); g.lineTo(-r * 0.75, r * 0.7); g.closePath();
      g.fillStyle = '#c98f5a'; g.fill(); outline(g, Math.max(1, r * 0.12));
      g.beginPath(); for (var y = 0; y < 3; y++) { g.moveTo(-r * 0.92 + y * 0.08 * r, -r * 0.02 + y * r * 0.27); g.lineTo(r * 0.92 - y * 0.08 * r, -r * 0.02 + y * r * 0.27); }
      g.strokeStyle = '#8a5a33'; g.lineWidth = Math.max(0.8, r * 0.07); g.stroke();
      g.beginPath(); g.ellipse(0, -r * 0.3, r * 0.75, r * 0.8, 0, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.1); g.stroke();
    },
    biedronka: function (g, r) {
      g.beginPath(); g.arc(r * 0.75, 0, r * 0.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.beginPath(); g.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); g.fillStyle = '#e2533f'; g.fill(); outline(g, Math.max(1, r * 0.15));
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); outline(g, Math.max(1, r * 0.1));
      g.fillStyle = INK; [[-0.45, -0.35], [0.3, -0.4], [-0.3, 0.38], [0.4, 0.35]].forEach(function (p) { g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.16, 0, Math.PI * 2); g.fill(); });
      g.beginPath(); g.arc(r * 0.95, -r * 0.12, r * 0.08, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    },
    zoladz: function (g, r) {
      g.beginPath(); g.ellipse(0, r * 0.2, r * 0.62, r * 0.8, 0, 0, Math.PI * 2); g.fillStyle = '#c98f3a'; g.fill(); outline(g, Math.max(1, r * 0.15));
      g.beginPath(); g.ellipse(0, -r * 0.4, r * 0.75, r * 0.38, 0, 0, Math.PI * 2); g.fillStyle = '#8a5a33'; g.fill(); outline(g, Math.max(1, r * 0.15));
      g.beginPath(); g.moveTo(0, -r * 0.75); g.lineTo(r * 0.1, -r * 1.05); outline(g, Math.max(1, r * 0.15));
    },
    slimak: function (g, r) {
      g.beginPath(); g.moveTo(-r * 1.1, r * 0.6); g.quadraticCurveTo(r * 0.2, r * 0.75, r * 1.0, r * 0.5); g.quadraticCurveTo(r * 1.2, -r * 0.1, r * 0.8, -r * 0.3);
      g.lineTo(r * 0.5, r * 0.3); g.lineTo(-r * 1.1, r * 0.3); g.closePath(); g.fillStyle = '#f0cf9f'; g.fill(); outline(g, Math.max(1, r * 0.12));
      g.beginPath(); g.moveTo(r * 0.8, -r * 0.25); g.lineTo(r * 0.75, -r * 0.75); g.moveTo(r * 1.0, -r * 0.2); g.lineTo(r * 1.15, -r * 0.65); outline(g, Math.max(1, r * 0.1));
      g.beginPath(); g.arc(-r * 0.15, -r * 0.05, r * 0.62, 0, Math.PI * 2); g.fillStyle = '#e9a15a'; g.fill(); outline(g, Math.max(1, r * 0.13));
      g.beginPath(); for (var a = 0; a < 9; a += 0.3) { var rr2 = r * 0.06 * a; g.lineTo(-r * 0.15 + Math.cos(a) * rr2, -r * 0.05 + Math.sin(a) * rr2); }
      g.strokeStyle = '#a8653a'; g.lineWidth = Math.max(1, r * 0.09); g.stroke();
    },
    szyszka: function (g, r) {
      g.beginPath(); g.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2); g.fillStyle = '#9b6a3f'; g.fill(); outline(g, Math.max(1, r * 0.13));
      g.save(); g.clip();
      g.beginPath(); for (var i = -3; i <= 3; i++) { g.moveTo(-r, i * r * 0.32 - r * 0.4); g.lineTo(r, i * r * 0.32 + r * 0.2); g.moveTo(r, i * r * 0.32 - r * 0.4); g.lineTo(-r, i * r * 0.32 + r * 0.2); }
      g.strokeStyle = '#6b4325'; g.lineWidth = Math.max(1, r * 0.09); g.stroke(); g.restore();
    }
  };

  // ---------- wearables (copied from Jeżyk w biegu so the look matches) ----------
  var WEAR = {
    czapka: function (g) {
      g.beginPath(); g.moveTo(-11, 2); g.quadraticCurveTo(-12, -15, 0, -16); g.quadraticCurveTo(12, -15, 11, 2); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-5, -1); g.lineTo(-4, -12); g.moveTo(1, -1); g.lineTo(1, -14); g.moveTo(6, -1); g.lineTo(5, -12);
      g.strokeStyle = '#b8352a'; g.lineWidth = 1.5; g.stroke();
      rr(g, -13, -2, 26, 7, 3.5); g.fillStyle = '#fff'; g.fill(); outline(g);
      g.beginPath(); g.arc(0, -17, 4.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g);
    },
    korona: function (g) {
      g.beginPath(); g.moveTo(-11, 3); g.lineTo(-12, -9); g.lineTo(-6, -3); g.lineTo(0, -13); g.lineTo(6, -3); g.lineTo(12, -9); g.lineTo(11, 3); g.closePath();
      g.fillStyle = '#f5c330'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke();
      [[-12, -9, '#3f86d8'], [0, -13, '#e2533f'], [12, -9, '#3fae5f']].forEach(function (p) {
        g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI * 2); g.fillStyle = p[2]; g.fill(); outline(g, 1.2);
      });
    },
    kokardka: function (g) {
      g.fillStyle = '#ff7eb6';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-12, -12, -13, -2); g.quadraticCurveTo(-12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(12, -12, 13, -2); g.quadraticCurveTo(12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fillStyle = '#e8559a'; g.fill(); outline(g, 1.6);
      g.beginPath(); g.arc(-7, -3, 1.4, 0, Math.PI * 2); g.arc(7, -3, 1.4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    },
    okulary: function (g) {
      g.beginPath(); g.moveTo(-4, -1); g.lineTo(-11, -3); outline(g, 1.8);
      g.beginPath(); g.ellipse(8.5, 0.5, 2.6, 4.2, 0, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.5);
      g.beginPath(); g.moveTo(4, -1); g.lineTo(6.5, -0.5); outline(g, 1.6);
      g.beginPath(); g.arc(0, 0, 5.2, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.moveTo(-2.5, -2); g.lineTo(0.5, -3.5); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.stroke();
    },
    szalikTail: function (g, t) {
      var w1 = Math.sin(t * 3) * 1.5, w2 = Math.sin(t * 3 + 1.5) * 2;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-5, 3 + w1, -8, 5 + w2, -11, 7 + w2);
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 8.5; g.stroke();
      g.strokeStyle = '#3f86d8'; g.lineWidth = 5; g.stroke();
      g.setLineDash([3, 4]); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.setLineDash([]);
    },
    szalik: function (g) {
      rr(g, -4.5, -11, 9, 22, 4.5); g.fillStyle = '#3f86d8'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#fff'; for (var y = -9; y < 12; y += 7) g.fillRect(-6, y, 12, 3);
      g.restore();
      rr(g, -4.5, -11, 9, 22, 4.5); outline(g);
    }
  };

  // ---------- the hedgehog (side view facing right, feet at y=0; same shape as Jeżyk w biegu) ----------
  var APPLE_SPOTS = [262, 236, 290, 212, 316, 249, 276, 224, 303, 196, 256, 284];
  var DIRT = [[-12, -24, 3.4], [6, -9, 2.6], [-6, -5, 2.4], [2, -34, 3], [12, -17, 2.2], [-17, -13, 2.8]];
  // st: { t, legs, wear, eye: open|closed|happy|sad, mouth: smile|frown|open|chew, dirt 0..1, apples, blanket }
  function drawPet(g, st) {
    var wear = st.wear || {}, t = st.t || 0;
    var lp = Math.sin(st.legs || 0) * 4;
    g.fillStyle = '#5a3a22';
    g.beginPath(); g.ellipse(-8 + lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    g.beginPath(); g.ellipse(10 - lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    if (wear.neck === 'szalik') { g.save(); g.translate(2, -10); WEAR.szalikTail(g, t); g.restore(); }
    var cx = -2, cy = -17, N = 13, a0 = 160 * Math.PI / 180, a1 = 332 * Math.PI / 180;
    g.beginPath();
    for (var i = 0; i <= N * 2; i++) {
      var a = a0 + (a1 - a0) * i / (N * 2), r = i % 2 ? 28 : 19;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.lineTo(18, -5); g.quadraticCurveTo(8, 1, -4, 0); g.quadraticCurveTo(-18, -1, -21, -9); g.closePath();
    g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2.2);
    g.beginPath();
    for (var j = 0; j < 9; j++) {
      var b = a0 + 0.2 + (a1 - a0 - 0.5) * j / 8;
      g.moveTo(cx + Math.cos(b) * 10, cy + Math.sin(b) * 10); g.lineTo(cx + Math.cos(b + 0.08) * 19, cy + Math.sin(b + 0.08) * 19);
    }
    g.strokeStyle = '#6b4325'; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); g.ellipse(2, -6, 13, 5, 0, 0, Math.PI); g.fillStyle = '#c8945e'; g.fill();
    for (var k = 0; k < Math.min(st.apples || 0, APPLE_SPOTS.length); k++) {
      var aa = APPLE_SPOTS[k] * Math.PI / 180, ar = k % 2 ? 22 : 25;
      drawApple(g, cx + Math.cos(aa) * ar, cy + Math.sin(aa) * ar + 1, 4.6, k === 0 && st.gold ? '#f5c330' : null);
    }
    // ear + face + snout
    g.beginPath(); g.arc(8, -24, 4, 0, Math.PI * 2); g.fillStyle = '#e4b98a'; g.fill(); outline(g, 1.6);
    g.beginPath();
    g.moveTo(3, -22); g.quadraticCurveTo(14, -27, 22, -18); g.quadraticCurveTo(28, -15, 32, -12);
    g.quadraticCurveTo(28, -7, 20, -6); g.quadraticCurveTo(10, -2, 3, -6); g.quadraticCurveTo(-1, -14, 3, -22); g.closePath();
    g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 2);
    g.beginPath(); g.arc(31.5, -12.5, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(18, -10, st.eye === 'happy' ? 3.4 : 2.8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,' + (st.eye === 'happy' ? 0.65 : 0.45) + ')'; g.fill();
    // mud spots (a dirty hedgehog just has a few smudges)
    var nd = Math.round((st.dirt || 0) * DIRT.length);
    for (var m = 0; m < nd; m++) {
      var dp = DIRT[m];
      g.beginPath(); g.ellipse(dp[0], dp[1], dp[2] * 1.3, dp[2], 0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(110,84,52,.75)'; g.fill();
    }
    if (wear.neck === 'szalik') { g.save(); g.translate(4, -12); g.rotate(-0.25); WEAR.szalik(g); g.restore(); }
    // eye
    var eye = st.eye || 'open';
    if (eye === 'open' || eye === 'sad') {
      var blink = (t % 3.6) > 3.45;
      if (blink) { g.beginPath(); g.moveTo(14, -16.5); g.quadraticCurveTo(16.5, -15, 19, -16.5); outline(g, 1.8); }
      else {
        g.beginPath(); g.arc(16.5, -16.5, 2.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(17.3, -17.4, 0.9, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      }
      if (eye === 'sad') { g.beginPath(); g.moveTo(13.5, -20.2); g.lineTo(19.5, -22.6); outline(g, 1.5); }
    } else if (eye === 'happy') {
      g.beginPath(); g.moveTo(14, -15.5); g.quadraticCurveTo(16.5, -19.5, 19, -15.5); outline(g, 1.9);
    } else {
      g.beginPath(); g.moveTo(14, -16.5); g.quadraticCurveTo(16.5, -14.5, 19, -16.5); outline(g, 1.8);
    }
    // mouth
    var mouth = st.mouth || 'smile';
    if (mouth === 'open') {
      g.beginPath(); g.ellipse(26.3, -8.2, 2.4, 2.1, 0, 0, Math.PI * 2); g.fillStyle = '#b8352a'; g.fill(); outline(g, 1.3);
    } else if (mouth === 'frown') {
      g.beginPath(); g.moveTo(24, -7.6); g.quadraticCurveTo(26.5, -9.6, 28.5, -7.6); outline(g, 1.4);
    } else if (mouth === 'chew') {
      g.beginPath(); g.moveTo(24, -8.5); g.lineTo(28.5, -8.5); outline(g, 1.4);
    } else {
      g.beginPath(); g.moveTo(24, -9); g.quadraticCurveTo(26.5, -7.5, 28.5, -9); outline(g, 1.4);
    }
    if (wear.eyes === 'okulary' && eye !== 'closed') { g.save(); g.translate(16.5, -16.5); WEAR.okulary(g); g.restore(); }
    if (st.blanket) {
      g.beginPath(); g.moveTo(-26, -2); g.quadraticCurveTo(-30, -30, -6, -40); g.quadraticCurveTo(10, -42, 12, -26); g.quadraticCurveTo(14, -10, 10, 0); g.closePath();
      g.fillStyle = '#9fd0f5'; g.fill(); outline(g, 2);
      g.save(); g.clip();
      g.fillStyle = '#ffd6ec'; for (var qx = -30; qx < 16; qx += 12) for (var qy = -44; qy < 2; qy += 12) if (((qx + qy) / 12 | 0) % 2 === 0) g.fillRect(qx, qy, 12, 12);
      g.fillStyle = 'rgba(255,255,255,.8)'; for (var sx = -26; sx < 14; sx += 12) { g.beginPath(); g.arc(sx + 6, -20 + (sx % 24 ? 6 : -6), 1.6, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.beginPath(); g.moveTo(-26, -2); g.quadraticCurveTo(-30, -30, -6, -40); g.quadraticCurveTo(10, -42, 12, -26); g.quadraticCurveTo(14, -10, 10, 0); g.closePath(); outline(g, 2);
    }
    if (wear.head) {
      g.save();
      if (wear.head === 'kokardka') { g.translate(4, -31); g.rotate(-0.15); }
      else { g.translate(10, -30); g.rotate(0.32); }
      WEAR[wear.head](g); g.restore();
    }
  }
  // curled up into a spiky ball (tap reaction)
  function drawBall(g, t) {
    var cx = 0, cy = -20, n = 22;
    g.beginPath();
    for (var i = 0; i <= n * 2; i++) {
      var a = i / (n * 2) * Math.PI * 2 + t * 0.5, r = i % 2 ? 27 : 20;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2.2);
    g.beginPath(); g.arc(cx + 6, cy + 4, 9, 0, Math.PI * 2); g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 1.8);
    g.beginPath(); g.arc(cx + 12, cy + 6, 2.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(cx + 5, cy + 1.5, 1.8, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  }

  // ---------- thumbnails for the sheets ----------
  var thumbs = {};
  function thumb(key, w, h, fn) {
    if (thumbs[key]) return thumbs[key];
    var d = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    var g = c.getContext('2d'); g.scale(d, d); fn(g);
    return (thumbs[key] = c.toDataURL());
  }
  function thingThumb(k) { return thumb('t' + k, 56, 56, function (g) { g.translate(28, 30); THING[k](g, 17); }); }
  function wearThumb(it) {
    return thumb('w' + it.id, 52, 52, function (cg) {
      cg.save(); cg.translate(it.slot === 'neck' ? 30 : 26, it.slot === 'head' ? 34 : 24); cg.scale(1.5, 1.5);
      if (it.slot === 'neck') { cg.save(); cg.translate(0, -6); WEAR.szalikTail(cg, 0); cg.restore(); }
      WEAR[it.id](cg); cg.restore();
    });
  }

  // ---------- DOM icons ----------
  var ICON = {
    food: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="10" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.4"/><circle cx="12.5" cy="15" r="2.6" fill="#fff" opacity=".7"/><path d="M16 8 q6 -6 9 -1 q-5 0 -9 1 z" fill="#3fae5f" stroke="#1d2f6f" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    fun: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="#fff" stroke="#1d2f6f" stroke-width="2.4"/><path d="M16 5 a11 11 0 0 1 10.4 7.4 L16 16 z" fill="#e2533f"/><path d="M26.4 19.6 a11 11 0 0 1 -10.4 7.4 L16 16 z" fill="#3f86d8"/><path d="M8 24 a11 11 0 0 1 -2.8 -11 L16 16 z" fill="#f5c330"/><circle cx="16" cy="16" r="11" fill="none" stroke="#1d2f6f" stroke-width="2.4"/></svg>',
    clean: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="18" r="8" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="2.2"/><circle cx="23" cy="11" r="5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="2"/><circle cx="24" cy="24" r="3.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.8"/><path d="M9 15 a4.5 4.5 0 0 1 4 -3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    sleep: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M20 5 a11 11 0 1 0 8 17 a9 9 0 0 1 -8 -17 z" fill="#f5c330" stroke="#1d2f6f" stroke-width="2.3" stroke-linejoin="round"/><path d="M8 7 l1.2 2.6 l2.8 .4 l-2 2 l.5 2.8 l-2.5 -1.3 l-2.5 1.3 l.5 -2.8 l-2 -2 l2.8 -.4 z" fill="#fff4c4" stroke="#1d2f6f" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    bath: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="9" r="3.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.6"/><circle cx="18" cy="6" r="2.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.4"/><path d="M3 15 h26 q0 10 -9 11 h-8 q-9 -1 -9 -11 z" fill="#9fd4f5" stroke="#1d2f6f" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 26 l-1 3 M23 26 l1 3" stroke="#1d2f6f" stroke-width="2.4" stroke-linecap="round"/><path d="M6 18 h20" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    hat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 22 q-1 -15 10 -15 q11 0 10 15 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.3" stroke-linejoin="round"/><rect x="4" y="20" width="24" height="6" rx="3" fill="#fff" stroke="#1d2f6f" stroke-width="2.3"/><circle cx="16" cy="6" r="3.5" fill="#fff" stroke="#1d2f6f" stroke-width="2"/></svg>'
  };
  var NEED_NAME = { food: 'Brzuszek', fun: 'Humor', clean: 'Czystość', sleep: 'Sen' };
  var NEED_SAY = {
    food: ['Burczy mi w brzuszku.', 'Chętnie coś zjem.', 'Brzuszek pełny!'],
    fun: ['Nudzi mi się trochę.', 'Pobawimy się?', 'Ale fajnie!'],
    clean: ['Chcę się wykąpać!', 'Przydałaby się kąpiel.', 'Pachnę ładnie!'],
    sleep: ['Oczka mi się kleją...', 'Trochę ziewam.', 'Mam dużo siły!']
  };
  function needSay(k, v) { return NEED_SAY[k][v < 35 ? 0 : v < 70 ? 1 : 2]; }
  function needCol(v) { return v >= 60 ? '#5cbc4b' : v >= 30 ? '#f2b51d' : '#f39a4a'; }

  var CSS = [
    '.zw{display:flex;flex-direction:column;font-family:' + FONT + ';color:#1d2f6f;background:#fbe6c8}',
    '.zw-hud{flex:none;display:flex;gap:6px;padding:6px 8px;background:#fff;border-bottom:3px solid #1d2f6f}',
    '.zw-need{flex:1;min-width:0;min-height:46px;border:2px solid #1d2f6f;border-radius:14px;background:#fff;display:flex;align-items:center;gap:4px;padding:3px 6px;color:inherit;font:inherit}',
    '.zw-need svg{width:28px;height:28px;flex:none}',
    '.zw-need.low svg{animation:zwbob 1.4s ease-in-out infinite}',
    '.zw-bar{flex:1;min-width:0;height:13px;border:2px solid #1d2f6f;border-radius:8px;overflow:hidden;background:#eef1f8}',
    '.zw-bar i{display:block;height:100%;border-radius:0 5px 5px 0;transition:width .6s ease}',
    '@keyframes zwbob{50%{transform:translateY(-3px) rotate(-8deg)}}',
    '.zw-cv{flex:1;position:relative;min-height:0}',
    '.zw-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.zw-bb{flex:none;display:flex;gap:6px;align-items:center;padding:7px 8px calc(7px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f;min-height:76px}',
    '.zw-act{flex:1;min-width:0;min-height:60px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:1.02rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;padding:3px 2px}',
    '.zw-act svg{width:30px;height:30px;flex:none}',
    '.zw-act:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-act[disabled]{opacity:.45;box-shadow:none}',
    '.zw-act.zw-hint{background:#fff4d6}',
    '.zw-msg{flex:1;min-width:0;font-size:1.25rem;line-height:1.1;padding:0 4px}',
    '.zw-big{min-height:56px;min-width:120px;border:3px solid #1d2f6f;border-radius:16px;background:#e3a008;color:#2a1d00;font:inherit;font-size:1.35rem;box-shadow:0 3px 0 #1d2f6f;padding:4px 14px}',
    '.zw-big.sec{background:#fff;color:#1d2f6f}',
    '.zw-big:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.zw-sheetw.on{opacity:1}',
    '.zw-sheet{position:absolute;left:0;right:0;bottom:0;max-height:90%;display:flex;flex-direction:column;background:#fffaf2;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.zw-sheetw.on .zw-sheet{transform:none}',
    '.zw-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 4px 16px}',
    '.zw-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.zw-sh-h .bal{font-size:1.2rem}.zw-sh-h .bal span{color:#e3a008}',
    '.zw-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1;color:inherit}',
    '.zw-sh-b{overflow-y:auto;touch-action:pan-y;padding:2px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.zw-note{color:#5a6690;font-size:1.08rem;margin:4px 4px}',
    '.zw-note.warn{color:#cf412d}.zw-note.ok{color:#2a8a56}',
    '.zw-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #e6d6bd;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.zw-row img{width:56px;height:56px;flex:none}',
    '.zw-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.zw-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.zw-row .tx small{color:#5a6690;font-size:1rem;display:block}',
    '.zw-row.cur{border-color:#e3a008;background:#fff7e0}',
    '.zw-row.lock{opacity:.6}',
    '.zw-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font:inherit;font-size:1.25rem;box-shadow:0 3px 0 #1d2f6f;padding:2px 8px}',
    '.zw-buy.pick{background:#fff;color:#1d2f6f}',
    '.zw-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.zw-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-seg{display:flex;gap:6px;margin:4px 0 2px}',
    '.zw-seg button{flex:1;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font:inherit;font-size:1.2rem;color:inherit}',
    '.zw-seg button.on{background:#7a4fc4;color:#fff}',
    '.zw-prev{display:block;margin:2px auto 4px;border:2px solid #1d2f6f;border-radius:16px}',
    '.zw-name{font:inherit;font-size:1.7rem;text-align:center;border:3px solid #1d2f6f;border-radius:14px;padding:6px 10px;width:100%;color:#1d2f6f;background:#fffaf2}',
    '@media (prefers-reduced-motion: reduce){.zw-need.low svg{animation:none}.zw-sheet,.zw-sheetw{transition:none}}'
  ].join('');

  var PIC = '<rect x="0" y="60" width="120" height="12" fill="#8fd06b"/>' +
    '<path d="M10 34 L38 10 L66 34 Z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<rect x="16" y="33" width="44" height="28" fill="#fbe6c8" stroke="#1d2f6f" stroke-width="2.5"/>' +
    '<path d="M31 61 v-13 a7 7 0 0 1 14 0 v13" fill="#b07f52" stroke="#1d2f6f" stroke-width="2"/>' +
    '<circle cx="38" cy="24" r="4.5" fill="#9fd6ff" stroke="#1d2f6f" stroke-width="1.8"/>' +
    '<path d="M70 61 l-3 -6 l5 -1 l-3 -6 l6 0 l-1 -7 l6 3 l2 -7 l4 6 l5 -5 l1 7 l6 -2 l-1 6 l5 1 l-2 5 l-6 6 z" fill="#8a5a33" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M90 47 q9 -3 13 5 q4 2 7 5 q-3 3 -9 3 q-8 2 -12 -1 q-2 -6 1 -12 z" fill="#f0cf9f" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="110" cy="56.5" r="2" fill="#1d2f6f"/><circle cx="99" cy="51" r="1.7" fill="#1d2f6f"/><circle cx="96" cy="55" r="1.8" fill="#ff8ca0" opacity=".6"/>' +
    '<path d="M101 58 q2 1.5 4 0" fill="none" stroke="#1d2f6f" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M93 41 q-1 -9 7 -10 q8 0 8 9 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="1.8" stroke-linejoin="round" transform="rotate(14 100 38)"/>' +
    '<path d="M86 22 c-3 -5 -11 -1 -6 4 l6 5 l6 -5 c5 -5 -3 -9 -6 -4 z" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="1.8"/>' +
    '<path d="M104 16 c-2 -3 -7 -1 -4 3 l4 3 l4 -3 c3 -4 -2 -6 -4 -3 z" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="1.5"/>';

  NG.register('zwierzak', {
    meta: { name: 'Zwierzątko', price: 'jedzenie od 10 ★', bg: '#fdeedd', pic: PIC, music: 'cozy' },
    medals: [
      { id: 'feeds10', stat: 'feeds', at: 10, tier: 1, text: '10 posiłków' },
      { id: 'days7', stat: 'days', at: 7, tier: 2, text: '7 dni opieki' },
      { id: 'days20', stat: 'days', at: 20, tier: 3, text: '20 dni opieki' }
    ],
    quests: [
      { id: 'feed', stat: 'feeds', n: [2, 3], text: 'Nakarm Zwierzątko {n} razy' },
      { id: 'play', stat: 'plays', n: [1, 2], text: 'Pobaw się ze Zwierzątkiem {n} {raz}', forms: ['raz', 'razy', 'razy'] }
    ],
    stickers: [
      { id: 'feed', emoji: '🍎', name: 'Pierwszy posiłek' },
      { id: 'bath', emoji: '🛁', name: 'Pierwsza kąpiel' },
      { id: 'sleep', emoji: '🌙', name: 'Pierwsza drzemka' },
      { id: 'tickle', emoji: '😆', name: 'Łaskotki' },
      { id: 'dress', emoji: '🎀', name: 'Strojniś' }
    ],

    mount: function (el, ctx) {
      var NOW = Date.now();
      var save = ctx.load({
        v: 1, name: 'Kolec', needs: { food: 80, fun: 80, clean: 80, sleep: 80 }, t: NOW, lastSeen: 0,
        basketDay: '', basketLeft: BASKET, wear: { head: null, neck: null, eyes: null }, wearInit: false,
        careDay: '', asleep: false, diff: 0, best: { catch: 0, hide: 0 }, seenHelp: false
      });
      if (!save.needs || typeof save.needs !== 'object') save.needs = {};
      NEEDS.forEach(function (k) { var v = +save.needs[k]; save.needs[k] = isFinite(v) ? clamp(v, MIN_NEED, 100) : 80; });
      if (!isFinite(+save.t) || +save.t <= 0) save.t = NOW;
      if (!save.wear || typeof save.wear !== 'object') save.wear = { head: null, neck: null, eyes: null };
      if (!save.best || typeof save.best !== 'object') save.best = { catch: 0, hide: 0 };
      if (typeof save.name !== 'string' || !save.name.trim()) save.name = 'Kolec';
      save.diff = save.diff ? 1 : 0;

      var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      // ---------- Jeżyk w biegu wardrobe (read-only) ----------
      function jezyk() {
        try { var j = JSON.parse(localStorage.getItem('naukagry.jezyk')) || {}; return { owned: (j.owned && typeof j.owned === 'object') ? j.owned : {}, wear: (j.wear && typeof j.wear === 'object') ? j.wear : {} }; }
        catch (e) { return { owned: {}, wear: {} }; }
      }
      function validWear() {
        var own = jezyk().owned, w = {};
        ITEMS.forEach(function (it) { if (save.wear[it.slot] === it.id && own[it.id]) w[it.slot] = it.id; });
        return w;
      }
      if (!save.wearInit) {
        var jz = jezyk();
        ITEMS.forEach(function (it) { if (jz.wear[it.slot] === it.id && jz.owned[it.id]) save.wear[it.slot] = it.id; });
        save.wearInit = true;
      }
      var wearNow = validWear();

      // ---------- DOM ----------
      var root = document.createElement('div'); root.className = 'zw';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var hud = document.createElement('div'); hud.className = 'zw-hud'; root.appendChild(hud);
      var needEl = {};
      NEEDS.forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-need';
        b.setAttribute('aria-label', NEED_NAME[k]);
        b.innerHTML = ICON[k] + '<span class="zw-bar"><i></i></span>';
        b.onclick = function () { if (mode === 'home' || mode === 'sleep') { ctx.sfx('tap'); say(NEED_NAME[k] + ': ' + (mode === 'sleep' && k !== 'sleep' ? 'Chrr...' : needSay(k, save.needs[k])), 2.6); } };
        hud.appendChild(b); needEl[k] = b;
      });
      var cvWrap = document.createElement('div'); cvWrap.className = 'zw-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var bar = document.createElement('div'); bar.className = 'zw-bb'; root.appendChild(bar);
      el.appendChild(root);
      var g = cv.getContext('2d');

      var W = 1, H = 1, DPR = 1, S = 1, LW = 400, LH = 600, FY = 330, HS = 2.4;
      var mode = 'home';           // home | bath | sleep | catch | hide
      var raf = 0, running = true, last = 0, T = 0, timers = [], hudT = 0, saveT = 0, hintT = rnd(16, 24);
      var pet = { x: 0, y: 0, face: 1, tx: 0, wanderT: rnd(2, 4), walking: false, legs: 0, hop: -1, wig: 0, ball: 0, happy: 0, petFun: 0 };
      var parts = [], speech = null, food = null, bath = null, dark = 0, zT = 0, wakeT = -1;
      var CG = null, HG = null, sheet = null, overlay = null, panel = null;
      var taps = [], drag = null, plate = { x: 0, y: 0, w: 0, h: 0 }, win = { x: 0, y: 0, w: 0, h: 0 };

      function later(fn, ms) { var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); fn(); }, ms); timers.push(id); return id; }
      function persist() { save.lastSeen = Date.now(); ctx.save(save); }

      // ---------- needs over real time ----------
      function settle(now) {
        var dt = (now - save.t) / 3600000;
        if (dt < 0) { save.t = now; return; }
        if (dt < 1e-6) return;
        NEEDS.forEach(function (k) {
          var v = save.needs[k];
          if (save.asleep) v += k === 'sleep' ? SLEEP_GAIN_H * dt : -RATES[k] * 0.5 * dt;
          else v -= RATES[k] * dt;
          save.needs[k] = clamp(v, MIN_NEED, 100);
        });
        save.t = now;
      }
      function addNeed(k, n) { settle(Date.now()); save.needs[k] = clamp(save.needs[k] + n, MIN_NEED, 100); }
      function minNeed() { return Math.min(save.needs.food, save.needs.fun, save.needs.clean, save.needs.sleep); }
      function lowest() { var k = 'food'; NEEDS.forEach(function (n) { if (save.needs[n] < save.needs[k]) k = n; }); return k; }
      function cared() {
        var d = today();
        if (save.careDay !== d) { save.careDay = d; ctx.stat('days', 1); }
      }
      function basket() { if (save.basketDay !== today()) { save.basketDay = today(); save.basketLeft = BASKET; } return save.basketLeft; }

      settle(NOW);
      var away = save.lastSeen ? NOW - save.lastSeen : 0;
      if (save.asleep && save.needs.sleep >= 100) save.asleep = false;
      if (save.asleep) { mode = 'sleep'; dark = 1; }

      // ---------- layout ----------
      function layout() {
        var r = cvWrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        DPR = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        S = clamp(Math.min(W / 400, H / 560), 0.6, 2.6);
        LW = W / S; LH = H / S;
        FY = Math.round(LH * 0.56);
        HS = clamp(Math.min(LW * 0.46 / 64, LH * 0.27 / 50), 1.2, 3.4);
        pet.y = FY + (LH - FY) * 0.48;
        if (!pet.x) { pet.x = LW / 2; pet.tx = pet.x; }
        pet.x = clamp(pet.x, LW * 0.22, LW * 0.78); pet.tx = clamp(pet.tx, LW * 0.22, LW * 0.78);
        if (CG) CG.gy = LH - 46;
        if (HG) hideLayout();
        if (!raf) draw();
      }

      // ---------- speech + particles ----------
      function say(text, dur) { speech = { text: text, t: dur || 2.4 }; }
      function burst(kind, x, y, n, o) {
        if (reduce) n = Math.ceil(n / 2);
        for (var i = 0; i < n; i++) {
          var p = { kind: kind, x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-90, -40), t: 0, life: rnd(0.9, 1.4), r: rnd(5, 9), rot: rnd(0, 6), col: LEAF_COLS[i % LEAF_COLS.length] };
          if (o) for (var k in o) p[k] = typeof o[k] === 'function' ? o[k](i) : o[k];
          parts.push(p);
        }
      }
      function popText(text, x, y, col) { parts.push({ kind: 'text', text: text, x: x, y: y, vx: 0, vy: -50, t: 0, life: 0.9, col: col || '#cf412d' }); }

      // ---------- bottom bar ----------
      function actBtn(icon, label, fn, hint) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-act' + (hint ? ' zw-hint' : '');
        b.innerHTML = ICON[icon] + '<span>' + label + '</span>'; b.onclick = fn; bar.appendChild(b); return b;
      }
      var barMsg = null, actBtns = [];
      function buildBar() {
        bar.innerHTML = ''; barMsg = null; actBtns = [];
        if (mode === 'home') {
          actBtns.push(actBtn('food', 'Jedzenie', openFood, save.needs.food < 35));
          actBtns.push(actBtn('bath', 'Kąpiel', startBath, save.needs.clean < 35));
          actBtns.push(actBtn('sleep', 'Spanie', startSleep, save.needs.sleep < 35));
          actBtns.push(actBtn('fun', 'Zabawa', openPlay, save.needs.fun < 35));
          actBtns.push(actBtn('hat', 'Szafa', openDress));
          syncBusy();
          return;
        }
        barMsg = document.createElement('div'); barMsg.className = 'zw-msg'; bar.appendChild(barMsg);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-big';
        if (mode === 'bath') { b.textContent = 'Gotowe'; b.className += ' sec'; b.onclick = function () { endBath(false); }; }
        else if (mode === 'sleep') { b.textContent = 'Obudź'; b.onclick = function () { wake(false); }; }
        else { b.textContent = 'Koniec'; b.className += ' sec'; b.onclick = function () { if (mode === 'catch') finishCatch(); else if (mode === 'hide') finishHide(); }; }
        bar.appendChild(b);
        updateBarMsg();
      }
      function syncBusy() { actBtns.forEach(function (b) { b.disabled = !!food; }); }
      function updateBarMsg() {
        if (!barMsg) return;
        var s = '';
        if (mode === 'bath') s = bath && bath.rinse > 0 ? 'Płuczemy!' : 'Szoruj gąbką! ' + Math.round((bath ? Math.min(1, bath.prog) : 0) * 100) + '%';
        else if (mode === 'sleep') s = 'Cii... ' + save.name + ' śpi.';
        else if (mode === 'catch' && CG) s = 'Złapane: ' + CG.caught + ' · zostało ' + (CG.total - CG.spawned + CG.items.length);
        else if (mode === 'hide' && HG) s = 'Runda ' + Math.min(ROUNDS, HG.round + 1) + ' z ' + ROUNDS + ' · znalezione: ' + HG.found;
        barMsg.textContent = s;
      }
      function updateHud() {
        NEEDS.forEach(function (k) {
          var v = save.needs[k], i = needEl[k].querySelector('i');
          i.style.width = Math.round(v) + '%'; i.style.background = needCol(v);
          needEl[k].classList.toggle('low', v < 30 && mode === 'home');
        });
        if (mode === 'home') {
          var hints = [save.needs.food < 35, save.needs.clean < 35, save.needs.sleep < 35, save.needs.fun < 35];
          actBtns.forEach(function (b, i) { if (i < 4) b.classList.toggle('zw-hint', hints[i]); });
        }
      }
      function setMode(m) {
        mode = m; drag = null;
        hud.style.display = (m === 'catch' || m === 'hide') ? 'none' : '';
        buildBar(); updateHud();
        layout();
      }

      // ---------- sheets ----------
      function closeSheet() {
        if (!sheet) return;
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        ctx.sfx('close');
        later(function () { s.wrap.remove(); }, reduce ? 0 : 260);
      }
      function openSheet(title, render) {
        if (sheet) { sheet.wrap.remove(); sheet = null; }
        var wrap = document.createElement('div'); wrap.className = 'zw-sheetw';
        var sh = document.createElement('div'); sh.className = 'zw-sheet'; wrap.appendChild(sh);
        sh.innerHTML = '<div class="zw-sh-h"><h3></h3><span class="bal"><span>★</span> <b style="font-weight:400"></b></span><button type="button" class="zw-x" aria-label="Zamknij">×</button></div><div class="zw-sh-b"></div>';
        sh.querySelector('h3').textContent = title;
        var body = sh.querySelector('.zw-sh-b');
        sh.querySelector('.zw-x').onclick = closeSheet;
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        root.appendChild(wrap); void wrap.offsetWidth; wrap.classList.add('on');
        ctx.sfx('open');
        var S2 = { wrap: wrap, body: body, msg: null };
        S2.render = function () {
          if (!wrap.isConnected) return;
          sh.querySelector('.bal b').textContent = ctx.balance();
          body.innerHTML = '';
          if (S2.msg) { note(body, S2.msg.text, S2.msg.cls); S2.msg = null; }
          render(body, S2);
        };
        sheet = S2; S2.render();
        return S2;
      }
      function note(body, text, cls) { var p = document.createElement('p'); p.className = 'zw-note' + (cls ? ' ' + cls : ''); p.textContent = text; body.appendChild(p); return p; }
      function row(body, img, title, sub, btn, cls) {
        var r = document.createElement('div'); r.className = 'zw-row' + (cls ? ' ' + cls : '');
        r.innerHTML = '<img alt=""><div class="tx"><b></b><small></small></div>';
        r.querySelector('img').src = img; r.querySelector('b').textContent = title;
        if (sub) r.querySelector('small').textContent = sub; else r.querySelector('small').remove();
        if (btn) r.appendChild(btn);
        body.appendChild(r); return r;
      }
      function btn(label, fn, cls, disabled) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-buy' + (cls ? ' ' + cls : '');
        b.textContent = label; b.disabled = !!disabled; b.onclick = fn; return b;
      }

      // ---------- feeding ----------
      function openFood() {
        if (mode !== 'home' || food) return;
        openSheet('Jedzenie', function (body, S2) {
          settle(Date.now());
          var full = save.needs.food >= 95;
          note(body, full ? save.name + ' ma pełny brzuszek. Może później!' : 'Brzuszek: ' + Math.round(save.needs.food) + ' na 100. Co dasz do jedzenia?', full ? 'ok' : '');
          var left = basket();
          row(body, thingThumb('koszyk'), 'Koszyk jabłek', left ? 'Za darmo · ' + left + ' ' + pl(left, 'jabłko', 'jabłka', 'jabłek') + ' na dziś' : 'Pusty. Jutro znowu pełny!',
            btn(left ? 'Daj' : 'jutro', function () {
              if (save.needs.food >= 95) { S2.msg = { text: 'Brzuszek pełny! Może później.', cls: 'ok' }; S2.render(); return; }
              save.basketLeft--; persist(); closeSheet(); feed(FOODS[0], true);
            }, 'pick', !left || full));
          var bal = ctx.balance();
          FOODS.forEach(function (f) {
            row(body, thingThumb(f.k), f.n, '+' + f.food + ' do brzuszka' + (f.fun ? ' · + humor' : ''),
              btn(f.price + ' ★', function () {
                if (save.needs.food >= 95) { S2.msg = { text: 'Brzuszek pełny! Może później.', cls: 'ok' }; S2.render(); return; }
                if (!ctx.spend(f.price, f.n)) { S2.msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', cls: 'warn' }; S2.render(); return; }
                ctx.sfx('coin'); closeSheet(); feed(f, false);
              }, '', full || bal < f.price));
          });
          if (bal < 10) note(body, 'Gwiazdki zdobędziesz w Matmie, Angielskim i Polskim.');
        });
      }
      function feed(f, free) {
        pet.walking = false; pet.tx = pet.x;
        var fx = pet.x + pet.face * 44 * HS;
        if (fx > LW - 24 || fx < 24) { pet.face = -pet.face; fx = pet.x + pet.face * 44 * HS; }
        speech = null;
        food = { f: f, x: fx, y: pet.y - 4 * HS, drop: 0, bites: 0, bt: 0.55, done: false, free: free };
        syncBusy();
      }
      function updateFood(dt) {
        var F = food;
        if (F.drop < 1) { F.drop = Math.min(1, F.drop + dt / 0.35); if (F.drop >= 1) ctx.sfx('land'); return; }
        F.bt -= dt;
        if (F.bt <= 0 && F.bites < 3) {
          F.bites++; F.bt = 0.5; ctx.sfx('pop');
          burst('crumb', F.x, F.y - 6 * HS, 5, { vy: function () { return rnd(-80, -30); }, col: '#d99a52', life: 0.6, r: 2.5 });
          if (F.bites === 3) F.bt = 0.35;
        } else if (F.bt <= 0 && F.bites >= 3) {
          food = null;
          addNeed('food', F.f.food); if (F.f.fun) addNeed('fun', F.f.fun);
          ctx.stat('feeds', 1); cared(); ctx.sticker('feed');
          pet.happy = 1.6; pet.hop = 0;
          burst('heart', pet.x + pet.face * 10 * HS, pet.y - 45 * HS, 4);
          say(['Mniam!', 'Pyszne!', 'Dziękuję!', 'Mniam, mniam!'][Math.floor(Math.random() * 4)], 1.8);
          persist(); updateHud(); syncBusy();
        }
      }

      // ---------- bath ----------
      function startBath() {
        if (mode !== 'home' || food) return;
        pet.x = LW / 2; pet.tx = pet.x; pet.face = 1; pet.walking = false;
        bath = { prog: 0, foam: [], sx: LW * 0.82, sy: pet.y + 22 * HS, rinse: 0, sndT: 0 };
        setMode('bath');
        ctx.sfx('splash');
        say('Szoruj gąbką!', 2);
      }
      function scrub(px, py, d) {
        var lx = (px - pet.x) / HS, ly = (py - (pet.y - 9 * HS)) / HS;
        if (lx < -32 || lx > 38 || ly < -52 || ly > 0) return;
        bath.prog += d / 1100;
        if (bath.foam.length < 34 && Math.random() < 0.5) bath.foam.push({ x: lx + rnd(-4, 4), y: ly + rnd(-4, 4), r: rnd(3, 6) });
        if (Math.random() < 0.35) parts.push({ kind: 'bubble', x: px, y: py, vx: rnd(-20, 20), vy: rnd(-70, -35), t: 0, life: rnd(0.9, 1.6), r: rnd(4, 9) });
        if (T - bath.sndT > 0.14) { bath.sndT = T; ctx.sfx('bubble'); }
        if (bath.prog >= 1 && bath.rinse === 0) {
          bath.rinse = 0.0001; ctx.sfx('splash'); later(function () { ctx.sfx('water'); }, 250);
          say('Płuczemy!', 1.4); updateBarMsg();
        }
      }
      function updateBath(dt) {
        if (bath.rinse > 0) {
          bath.rinse += dt;
          for (var i = 0; i < (reduce ? 1 : 3); i++) parts.push({ kind: 'drop', x: pet.x + rnd(-24, 30) * HS, y: Math.max(20, pet.y - 86 * HS) + 10, vx: 0, vy: rnd(300, 400), t: 0, life: Math.min(0.9, 70 * HS / 330), r: 3 });
          if (bath.foam.length && Math.random() < 0.4) { var f = bath.foam.pop(); parts.push({ kind: 'bubble', x: pet.x + f.x * HS, y: pet.y + (f.y - 9) * HS, vx: 0, vy: -40, t: 0, life: 0.5, r: f.r * HS * 0.6 }); }
          if (bath.rinse > 1.5) endBath(true);
        } else if (!drag) {
          bath.sx += (LW * 0.82 - bath.sx) * Math.min(1, dt * 4);
          bath.sy += (pet.y + 22 * HS - bath.sy) * Math.min(1, dt * 4);
        }
      }
      function endBath(full) {
        if (mode !== 'bath') return;
        var p = full ? 1 : Math.min(1, bath.prog);
        addNeed('clean', (100 - save.needs.clean) * p);
        if (full) { ctx.stat('baths', 1); ctx.sticker('bath'); ctx.sfx('clear'); }
        if (p >= 0.3) cared();
        bath = null; parts = parts.filter(function (q) { return q.kind !== 'drop'; });
        setMode('home');
        if (full) { pet.happy = 1.8; pet.hop = 0; burst('spark', pet.x, pet.y - 40 * HS, 6); say('Pachnę jak kwiatek!', 2.2); }
        else if (p > 0.1) say('Trochę czyściej!', 1.8);
        persist();
      }

      // ---------- sleep ----------
      function startSleep() {
        if (mode !== 'home' || food) return;
        pet.walking = false; pet.tx = pet.x;
        settle(Date.now()); save.asleep = true;
        setMode('sleep'); wakeT = -1;
        ctx.music('calm'); ctx.sfx('close');
        ctx.sticker('sleep'); cared(); persist();
        say('Dobranoc!', 1.6);
      }
      function wake(rested) {
        if (mode !== 'sleep') return;
        settle(Date.now());
        save.asleep = false; persist();
        setMode('home');
        ctx.music('cozy'); ctx.sfx('open');
        pet.hop = 0; pet.happy = rested ? 1.6 : 0;
        say(rested ? 'Dzień dobry! Mam dużo siły!' : 'Ziew... Dzień dobry!', 2.2);
      }

      // ---------- dress up ----------
      function openDress() {
        if (mode !== 'home' || food) return;
        openSheet('Szafa', function (body, S2) {
          var own = jezyk().owned, wear = validWear(), any = ITEMS.some(function (it) { return own[it.id]; });
          var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
          c.width = 200 * d; c.height = 110 * d; c.style.width = '200px'; c.style.height = '110px'; c.className = 'zw-prev';
          var cg = c.getContext('2d'); cg.scale(d, d);
          cg.fillStyle = '#fbe6c8'; cg.fillRect(0, 0, 200, 110); cg.fillStyle = '#e0b07a'; cg.fillRect(0, 84, 200, 26);
          cg.save(); cg.translate(96, 98); cg.scale(1.8, 1.8); drawPet(cg, { t: 0.5, wear: wear, eye: 'happy', mouth: 'smile' }); cg.restore();
          body.appendChild(c);
          if (!any) note(body, 'Czapki, szaliki i okulary kupisz w grze Jeżyk w biegu (w Szafie). Potem ' + save.name + ' może je tu założyć!');
          ITEMS.forEach(function (it) {
            var has = !!own[it.id], worn = wear[it.slot] === it.id;
            var b = has ? btn(worn ? 'Zdejmij' : 'Załóż', function () {
              save.wear[it.slot] = worn ? null : it.id; wearNow = validWear(); persist();
              ctx.sfx(worn ? 'close' : 'pop');
              if (!worn) { ctx.sticker('dress'); pet.happy = 1.2; say('Ale ładnie!', 1.6); }
              S2.render();
            }, 'pick') : btn('brak', null, 'pick', true);
            row(body, wearThumb(it), it.name, has ? (worn ? 'założone' : '') : 'kup w Jeżyku w biegu', b, worn ? 'cur' : has ? '' : 'lock');
          });
          if (!any) {
            var go = document.createElement('button'); go.type = 'button'; go.className = 'zw-big sec'; go.style.cssText = 'width:100%;margin-top:6px';
            go.textContent = 'Idź do Jeżyka w biegu'; go.onclick = function () { location.hash = 'jezyk'; };
            body.appendChild(go);
          }
        });
      }

      // ---------- rename ----------
      function openRename() {
        if (overlay) return;
        var p = document.createElement('div'); p.className = 'ng-panel';
        p.innerHTML = '<div class="ng-card"><h2>Imię jeżyka</h2><input class="zw-name" maxlength="14" autocomplete="off" aria-label="Imię"><div class="ng-row"><button type="button" class="ng-btn">Zapisz</button><button type="button" class="ng-btn sec">Anuluj</button></div></div>';
        var inp = p.querySelector('input'); inp.value = save.name;
        function done(ok) {
          if (ok) {
            var v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 14);
            save.name = v || 'Kolec'; persist(); ctx.sfx('pop');
            pet.happy = 1.2; say('Hura! Jestem ' + save.name + '!', 2.2);
            updateBarMsg();
          }
          p.remove(); overlay = null;
        }
        p.querySelector('.ng-btn').onclick = function () { done(true); };
        p.querySelector('.ng-btn.sec').onclick = function () { done(false); };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
        root.appendChild(p); overlay = p;
        try { inp.focus(); inp.select(); } catch (e) {}
      }

      // ---------- mini-games ----------
      var GAMES = [
        { k: 'catch', n: 'Łap jabłka', sub: 'Jabłka spadają z drzewa. Łap je na kolce!' },
        { k: 'hide', n: 'Chowany', sub: 'Jeżyk chowa się w liściach. Patrz uważnie i znajdź go!' }
      ];
      function gameThumb(k) {
        return thumb('g' + k, 56, 56, function (cg) {
          if (k === 'catch') {
            cg.fillStyle = '#e2f4ff'; rr(cg, 1, 1, 54, 54, 12); cg.fill();
            drawApple(cg, 18, 14, 6); drawApple(cg, 38, 22, 6, '#f5c330');
            cg.save(); cg.translate(26, 52); cg.scale(0.85, 0.85); drawPet(cg, { apples: 2 }); cg.restore();
          } else {
            cg.fillStyle = '#fff0d8'; rr(cg, 1, 1, 54, 54, 12); cg.fill();
            cg.save(); cg.translate(28, 46); leafPile(cg, 22, seedLeaves(22, 7)); cg.restore();
            cg.save(); cg.translate(20, 26); cg.scale(0.5, 0.5); drawPet(cg, { eye: 'happy' }); cg.restore();
          }
        });
      }
      function openPlay() {
        if (mode !== 'home' || food) return;
        openSheet('Zabawa', function (body, S2) {
          note(body, save.name + ' uwielbia zabawy! Po grze ma super humor. Jedna gra: ' + GAME_PRICE + ' ★.');
          var seg = document.createElement('div'); seg.className = 'zw-seg';
          ['Łatwo', 'Trudniej'].forEach(function (lab, i) {
            var b = document.createElement('button'); b.type = 'button'; b.textContent = lab; b.className = save.diff === i ? 'on' : '';
            b.onclick = function () { save.diff = i; persist(); ctx.sfx('tap'); S2.render(); };
            seg.appendChild(b);
          });
          body.appendChild(seg);
          var bal = ctx.balance();
          GAMES.forEach(function (gm) {
            var best = save.best[gm.k] || 0;
            row(body, gameThumb(gm.k), gm.n, gm.sub + (best ? ' Rekord: ' + best + '.' : ''),
              btn(GAME_PRICE + ' ★', function () {
                if (!ctx.spend(GAME_PRICE, gm.n)) { S2.msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', cls: 'warn' }; S2.render(); return; }
                ctx.sfx('coin'); closeSheet(); startMini(gm.k);
              }, '', bal < GAME_PRICE));
          });
        });
      }
      function startMini(k) {
        closePanel(); food = null; speech = null; parts = []; CG = null; HG = null;
        if (k === 'catch') { newCatch(); setMode('catch'); }
        else { setMode('hide'); newHide(); }
        ctx.music('play');
      }
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function endMini(k, title, lines, gain, score) {
        var fresh = score > (save.best[k] || 0);
        save.best[k] = Math.max(save.best[k] || 0, score);
        addNeed('fun', gain);
        ctx.stat('plays', 1); cared(); persist();
        ctx.sfx('win');
        lines.push('Humor: +' + Math.round(gain));
        if (fresh && score > 0) lines.push({ text: 'Nowy rekord!', muted: true });
        panel = ctx.panel({
          title: title, lines: lines, price: GAME_PRICE, note: k === 'catch' ? 'Łap jabłka' : 'Chowany', button: 'Jeszcze raz',
          onPlay: function () { panel = null; ctx.sfx('coin'); startMini(k); },
          secondary: [{ label: 'Do domku', onClick: function () { panel = null; goHome(); } }]
        });
      }
      function goHome() {
        CG = null; HG = null; parts = [];
        setMode('home'); ctx.music('cozy');
        pet.happy = 1.6; pet.hop = 0; burst('heart', pet.x, pet.y - 45 * HS, 4);
        say('Ale było fajnie!', 2);
      }

      // ----- catch apples -----
      function newCatch() {
        var hard = save.diff === 1;
        CG = { hard: hard, total: hard ? 26 : 20, spawned: 0, caught: 0, pts: 0, gold: false, items: [], spawnT: 0.8, x: LW / 2, tx: LW / 2, face: 1, legs: 0, gy: LH - 46, endT: -1, done: false };
      }
      function updateCatch(dt) {
        var c = CG; if (!c || c.done) return;
        var hs = clamp(LW * 0.26 / 64, 1.1, 2.2);
        var dx = c.tx - c.x, mv = Math.max(-700 * dt, Math.min(700 * dt, dx));
        c.x = clamp(c.x + mv, 30 * hs, LW - 30 * hs);
        if (Math.abs(mv) > 0.5) { c.face = mv > 0 ? 1 : -1; c.legs += dt * 14; }
        c.spawnT -= dt;
        if (c.spawnT <= 0 && c.spawned < c.total) {
          c.spawned++;
          var sp = (c.hard ? 210 : 140) * rnd(0.85, 1.15) * Math.max(1, LH / 640);
          c.items.push({ x: rnd(28, LW - 28), y: -20, vy: sp, gold: Math.random() < 0.12, rot: rnd(-0.4, 0.4), sway: c.hard ? rnd(0, 6) : 0 });
          c.spawnT = (c.hard ? 0.72 : 1.0) * rnd(0.8, 1.2);
          updateBarMsg();
        }
        var backY = c.gy - 34 * hs, rad = (c.hard ? 30 : 40) * hs / 1.6;
        for (var i = c.items.length - 1; i >= 0; i--) {
          var it = c.items[i];
          if (it.land) { it.land += dt; if (it.land > 0.7) { c.items.splice(i, 1); updateBarMsg(); } continue; }
          it.y += it.vy * dt; if (it.sway) it.x = clamp(it.x + Math.sin(T * 2 + it.sway) * 30 * dt, 20, LW - 20);
          if (it.y >= backY - 10 && it.y <= backY + 18 && Math.abs(it.x - (c.x + c.face * 4 * hs)) < rad + 12) {
            c.items.splice(i, 1); c.caught++; c.pts += it.gold ? 3 : 1; if (it.gold) c.gold = true;
            ctx.sfx(it.gold ? 'star' : 'pop');
            popText(it.gold ? '+3' : '+1', it.x, it.y - 16, it.gold ? GOLD : '#cf412d');
            updateBarMsg();
          } else if (it.y >= c.gy - 9) { it.y = c.gy - 9; it.land = 0.001; ctx.sfx('land'); }
        }
        if (c.spawned >= c.total && !c.items.length && c.endT < 0) c.endT = 0.7;
        if (c.endT > 0) { c.endT -= dt; if (c.endT <= 0) finishCatch(); }
      }
      function finishCatch() {
        if (!CG || CG.done) return;
        var c = CG; c.done = true;
        var seen = Math.max(1, c.spawned - c.items.length);
        var gain = 25 + Math.round(45 * Math.min(1, c.caught / c.total));
        c.items = [];
        endMini('catch', c.caught >= c.total * 0.8 ? 'Super łapanie!' : 'Koniec zabawy', [
          'Złapane jabłka: ' + c.caught + ' z ' + c.total + (seen < c.total ? ' (koniec wcześniej)' : ''),
          'Punkty: ' + c.pts
        ], gain, c.pts);
      }

      // ----- hide and seek -----
      function seedLeaves(r, n) {
        var out = [];
        for (var i = 0; i < n; i++) {
          var dx = rnd(-0.95, 0.95) * r, top = 0.9 * r * Math.sqrt(Math.max(0, 1 - (dx / r) * (dx / r)));
          out.push({ dx: dx, dy: -rnd(0.05, 1) * top, rot: rnd(0, 6.28), col: LEAF_COLS[(Math.random() * LEAF_COLS.length) | 0], s: rnd(0.8, 1.2) });
        }
        out.sort(function (a, b) { return a.dy - b.dy; });
        return out;
      }
      function leafPile(cg, r, leaves) {
        cg.beginPath(); cg.ellipse(0, 0, r, r * 0.92, 0, Math.PI, 0); cg.closePath();
        cg.fillStyle = '#c96a2a'; cg.fill(); outline(cg, 2);
        leaves.forEach(function (l) {
          cg.save(); cg.translate(l.dx, l.dy); cg.rotate(l.rot);
          cg.beginPath(); cg.ellipse(0, 0, r * 0.22 * l.s, r * 0.11 * l.s, 0, 0, Math.PI * 2);
          cg.fillStyle = l.col; cg.fill(); cg.lineWidth = 1.2; cg.strokeStyle = 'rgba(29,47,111,.6)'; cg.stroke();
          cg.beginPath(); cg.moveTo(-r * 0.2 * l.s, 0); cg.lineTo(r * 0.2 * l.s, 0); cg.strokeStyle = 'rgba(29,47,111,.35)'; cg.lineWidth = 1; cg.stroke();
          cg.restore();
        });
      }
      function newHide() {
        var hard = save.diff === 1;
        HG = { hard: hard, n: hard ? 4 : 3, round: 0, found: 0, first: 0, tries: 0, piles: [], phase: 'show', t: 0, swaps: [], sw: null, msg: '', done: false };
        hideLayout(); hideRound();
      }
      function hideLayout() {
        // two rows of leaf piles: 3 = two at the back + one in front, 4 = 2x2
        var h = HG, y1 = LH * 0.5, y2 = LH * 0.8;
        h.r = clamp(Math.min(LW * 0.2, (y2 - y1) * 0.5, 100), 36, 100);
        h.top = y1 - h.r * 1.5;
        h.slots = h.n === 3 ? [[0.27, y1], [0.73, y1], [0.5, y2]] : [[0.27, y1], [0.73, y1], [0.27, y2], [0.73, y2]];
        h.slots = h.slots.map(function (q) { return { x: LW * q[0], y: q[1] }; });
        h.piles.forEach(function (p) { if (!h.sw || (p !== h.sw.a && p !== h.sw.b)) { p.x = h.slots[p.slot].x; p.y = h.slots[p.slot].y; } });
      }
      function hideRound() {
        var h = HG, items = SURPRISES.slice().sort(function () { return Math.random() - 0.5; });
        h.piles = [];
        var hogAt = (Math.random() * h.n) | 0;
        for (var i = 0; i < h.n; i++) h.piles.push({ slot: i, x: h.slots[i].x, y: h.slots[i].y, hog: i === hogAt, item: items[i], open: 0, leaves: seedLeaves(h.r, 16) });
        h.tries = 0; h.phase = 'show'; h.t = 0; h.msg = save.name + ' chowa się tutaj!';
        var nsw = (h.hard ? 5 : 3) + Math.floor(h.round / 2);
        h.swaps = []; for (var s = 0; s < nsw; s++) { var a = (Math.random() * h.n) | 0, b = (a + 1 + ((Math.random() * (h.n - 1)) | 0)) % h.n; h.swaps.push([a, b]); }
        h.dur = (h.hard ? 0.5 : 0.75) * Math.pow(0.95, h.round);
        updateBarMsg();
      }
      function pileAtSlot(s) { return HG.piles.filter(function (p) { return p.slot === s; })[0]; }
      function updateHide(dt) {
        var h = HG; if (!h || h.done) return;
        h.t += dt;
        if (h.phase === 'show' && h.t > 1.5) { h.phase = 'cover'; h.t = 0; ctx.sfx('whoosh'); }
        else if (h.phase === 'cover' && h.t > 0.6) { h.phase = 'shuffle'; h.t = 0; h.msg = 'Patrz uważnie!'; }
        else if (h.phase === 'shuffle') {
          if (!h.sw) {
            if (!h.swaps.length) { h.phase = 'pick'; h.msg = 'Gdzie jest ' + save.name + '?'; return; }
            var s = h.swaps.shift();
            h.sw = { a: pileAtSlot(s[0]), b: pileAtSlot(s[1]), sa: s[0], sb: s[1], k: 0 };
            ctx.sfx('swap');
          }
          var w = h.sw; w.k = Math.min(1, w.k + dt / h.dur);
          var e = w.k < 0.5 ? 2 * w.k * w.k : 1 - Math.pow(-2 * w.k + 2, 2) / 2;
          // the two piles pass each other on opposite sides of the straight line
          var A = h.slots[w.sa], B = h.slots[w.sb], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
          var nx = -dy / len, ny = dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
          var arc = Math.sin(Math.PI * w.k) * h.r * (reduce ? 0.4 : 0.7);
          w.a.x = A.x + dx * e + nx * arc; w.a.y = A.y + dy * e + ny * arc;
          w.b.x = B.x - dx * e - nx * arc * 0.6; w.b.y = B.y - dy * e - ny * arc * 0.6;
          if (w.k >= 1) { w.a.slot = w.sb; w.b.slot = w.sa; w.a.x = B.x; w.a.y = B.y; w.b.x = A.x; w.b.y = A.y; h.sw = null; }
        } else if (h.phase === 'found' && h.t > 1.6) {
          h.round++;
          if (h.round >= ROUNDS) finishHide(); else hideRound();
        }
        h.piles.forEach(function (p) { if (p.open > 0 && p.open < 1) p.open = Math.min(1, p.open + dt / 0.4); });
      }
      function tapPile(px, py) {
        var h = HG; if (!h || h.phase !== 'pick') return;
        for (var i = 0; i < h.piles.length; i++) {
          var p = h.piles[i];
          if (p.open) continue;
          if (Math.abs(px - p.x) < h.r * 1.05 && py > p.y - h.r * 1.15 && py < p.y + h.r * 0.3) {
            p.open = 0.001;
            burst('leaf', p.x, p.y - h.r * 0.4, 10, { vx: function () { return rnd(-140, 140); }, vy: function () { return rnd(-220, -100); }, life: 1.1, r: h.r * 0.18 });
            ctx.sfx('whoosh');
            if (p.hog) {
              h.found++; if (h.tries === 0) h.first++;
              h.phase = 'found'; h.t = 0; h.msg = 'Brawo! Tu jest ' + save.name + '!';
              later(function () { ctx.sfx('star'); }, 150);
              burst('spark', p.x, p.y - h.r, 6);
            } else {
              h.tries++; h.msg = 'Tu jest ' + p.item.n + '! Szukaj dalej.';
              later(function () { ctx.sfx('pop'); }, 150);
            }
            updateBarMsg();
            return;
          }
        }
      }
      function finishHide() {
        if (!HG || HG.done) return;
        var h = HG; h.done = true;
        var gain = 25 + Math.round(45 * h.first / ROUNDS);
        if (h.round < ROUNDS) gain = 25 + Math.round(45 * h.first / ROUNDS * h.round / ROUNDS);
        endMini('hide', h.first >= 4 ? 'Świetne oczy!' : 'Koniec zabawy', [
          'Znalezione od razu: ' + h.first + ' z ' + ROUNDS,
          h.found > h.first ? 'Za drugim razem: ' + (h.found - h.first) : (h.round < ROUNDS ? 'Zagrane rundy: ' + h.round : 'Za każdym razem bez pomyłki!')
        ], gain, h.first);
      }

      // ---------- input ----------
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; }
      function onPet(lx, ly) {
        // lx/ly in hedgehog units
        return lx > -30 && lx < 36 && ly > -52 && ly < 2;
      }
      function petLocal(p) { return { x: (p.x - pet.x) / (HS * pet.face), y: (p.y - petY()) / HS }; }
      function petY() { return pet.y - (pet.hop >= 0 ? Math.sin(Math.PI * pet.hop) * 16 : 0); }
      function petTap() {
        var now = T;
        taps = taps.filter(function (t) { return now - t < 2; }); taps.push(now);
        if (taps.length >= 5) {
          taps = [];
          pet.wig = 1.6; pet.happy = 1.8; ctx.sfx('combo'); ctx.sticker('tickle');
          say('Ha ha ha! Łaskocze!', 1.8);
          burst('note', pet.x, pet.y - 45 * HS, 5, { col: PURPLE });
        } else {
          var r = Math.random();
          if (r < 0.3) { pet.hop = 0; ctx.sfx('jump'); }
          else if (r < 0.55) { pet.wig = 0.6; ctx.sfx('pop'); say(['Hi hi!', 'Hej!', 'To ja!'][Math.floor(Math.random() * 3)], 1.2); }
          else if (r < 0.75 && !pet.ball) { pet.ball = 0.9; ctx.sfx('rotate'); }
          else { pet.happy = 1; ctx.sfx('bubble'); }
          burst('heart', pet.x + pet.face * 6 * HS, pet.y - 42 * HS, 2);
        }
        if (save.needs.fun < PET_FUN_CAP) { addNeed('fun', 1.5); save.needs.fun = Math.min(save.needs.fun, PET_FUN_CAP); }
      }
      function onDown(e) {
        if (e.button > 0) return;
        var p = pos(e);
        if (mode === 'home') {
          if (food) return;
          if (p.x > plate.x && p.x < plate.x + plate.w && p.y > plate.y - 14 && p.y < plate.y + plate.h + 6) { ctx.sfx('tap'); openRename(); return; }
          var l = petLocal(p);
          if (onPet(l.x, l.y)) { drag = { kind: 'stroke', x: p.x, y: p.y, d: 0 }; petTap(); try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
        } else if (mode === 'sleep') {
          var l2 = petLocal(p);
          if (onPet(l2.x, l2.y)) { pet.wig = 0.3; ctx.sfx('tap'); say('Chrr...', 1); }
        } else if (mode === 'bath') {
          if (bath.rinse > 0) return;
          drag = { kind: 'sponge', x: p.x, y: p.y };
          bath.sx = p.x; bath.sy = p.y;
          try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        } else if (mode === 'catch') {
          if (CG) CG.tx = p.x;
          drag = { kind: 'move' };
          try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        } else if (mode === 'hide') {
          tapPile(p.x, p.y);
        }
        e.preventDefault();
      }
      function onMove(e) {
        if (!drag) return;
        var p = pos(e);
        if (drag.kind === 'stroke') {
          drag.d += Math.hypot(p.x - drag.x, p.y - drag.y); drag.x = p.x; drag.y = p.y;
          if (drag.d > 70) { drag.d = 0; burst('heart', p.x, p.y - 10, 1); pet.happy = Math.max(pet.happy, 0.6); if (save.needs.fun < PET_FUN_CAP) { addNeed('fun', 0.5); save.needs.fun = Math.min(save.needs.fun, PET_FUN_CAP); } }
        } else if (drag.kind === 'sponge' && bath && bath.rinse === 0) {
          var d = Math.hypot(p.x - drag.x, p.y - drag.y);
          drag.x = p.x; drag.y = p.y; bath.sx = p.x; bath.sy = p.y;
          scrub(p.x, p.y, d); updateBarMsg();
        } else if (drag.kind === 'move' && CG) CG.tx = p.x;
      }
      function onUp() { drag = null; }
      function onKey(e) {
        if (mode === 'catch' && CG) {
          if (e.key === 'ArrowLeft') { CG.tx = CG.x - 60; e.preventDefault(); }
          if (e.key === 'ArrowRight') { CG.tx = CG.x + 60; e.preventDefault(); }
        }
      }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);

      // ---------- update ----------
      function update(dt) {
        T += dt;
        if (mode === 'sleep') {
          save.needs.sleep = Math.min(100, save.needs.sleep + SLEEP_GAIN_S * dt);
          zT -= dt;
          if (zT <= 0) { zT = 1.1; parts.push({ kind: 'z', x: pet.x + 18 * HS, y: pet.y - 30 * HS, vx: 14, vy: -26, t: 0, life: 2.4, r: 16 + Math.random() * 8 }); }
          if (save.needs.sleep >= 100 && wakeT < 0) wakeT = 1.6;
          if (wakeT > 0) { wakeT -= dt; if (wakeT <= 0) wake(true); }
        }
        settle(Date.now());
        dark += ((mode === 'sleep' ? 1 : 0) - dark) * Math.min(1, dt * (reduce ? 20 : 2.5));
        if (pet.hop >= 0) { pet.hop += dt / 0.45; if (pet.hop >= 1) pet.hop = -1; }
        if (pet.wig > 0) pet.wig = Math.max(0, pet.wig - dt);
        if (pet.ball > 0) pet.ball = Math.max(0, pet.ball - dt);
        if (pet.happy > 0) pet.happy = Math.max(0, pet.happy - dt);
        if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
        if (mode === 'home') {
          if (food) updateFood(dt);
          else if (!drag && pet.hop < 0 && !pet.ball) {
            pet.wanderT -= dt;
            if (pet.wanderT <= 0) { pet.wanderT = rnd(3, 7); pet.tx = rnd(LW * 0.24, LW * 0.76); }
            var dx = pet.tx - pet.x;
            if (Math.abs(dx) > 2) { pet.walking = true; pet.face = dx > 0 ? 1 : -1; pet.x += Math.sign(dx) * Math.min(Math.abs(dx), 34 * dt * HS / 2); pet.legs += dt * 9; }
            else pet.walking = false;
          }
          hintT -= dt;
          if (hintT <= 0) {
            hintT = rnd(18, 28);
            if (!speech && !food) {
              var lk = lowest(), v = save.needs[lk];
              if (v < 45) say(needSay(lk, v), 2.6);
              else if (Math.random() < 0.5) say(['Lubię Cię!', 'Ale tu przytulnie.', 'Pobawimy się?', 'Tra la la!'][Math.floor(Math.random() * 4)], 2);
            }
          }
        } else if (mode === 'bath' && bath) updateBath(dt);
        else if (mode === 'catch') updateCatch(dt);
        else if (mode === 'hide') updateHide(dt);
        for (var i = parts.length - 1; i >= 0; i--) {
          var p = parts[i];
          p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.kind === 'crumb' || p.kind === 'leaf') p.vy += (p.kind === 'leaf' ? 260 : 400) * dt;
          if (p.kind === 'leaf') { p.vx *= 0.98; p.rot += dt * 5; }
          if (p.t >= p.life) parts.splice(i, 1);
        }
        hudT -= dt; if (hudT <= 0) { hudT = 0.5; updateHud(); }
        saveT -= dt; if (saveT <= 0) { saveT = 8; persist(); }
      }

      // ---------- draw ----------
      function text(s, x, y, size, col, align) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = size * 0.26; g.strokeStyle = '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col || INK; g.fillText(s, x, y);
      }
      function isNight() { var h = new Date().getHours(); return h >= 20 || h < 7; }
      function drawWindow(night) {
        var ww = Math.min(124, LW * 0.28), wh = ww * 1.05, wx = LW * 0.07, wy = Math.max(70, FY * 0.3);
        win = { x: wx, y: wy, w: ww, h: wh };
        function shape() { g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx, wy + ww / 2); g.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww, wy + wh); g.closePath(); }
        shape();
        var sk = g.createLinearGradient(0, wy, 0, wy + wh);
        if (night) { sk.addColorStop(0, '#24316e'); sk.addColorStop(1, '#4b5ea8'); } else { sk.addColorStop(0, '#8fcdf8'); sk.addColorStop(1, '#e8f7ff'); }
        g.fillStyle = sk; g.fill();
        g.save(); shape(); g.clip();
        if (night) {
          g.beginPath(); g.arc(wx + ww * 0.66, wy + ww * 0.36, ww * 0.15, 0, Math.PI * 2); g.fillStyle = '#fff4c4'; g.fill();
          g.beginPath(); g.arc(wx + ww * 0.72, wy + ww * 0.32, ww * 0.13, 0, Math.PI * 2); g.fillStyle = '#24316e'; g.fill();
          g.fillStyle = '#fff';
          [[0.2, 0.3], [0.35, 0.6], [0.8, 0.7], [0.5, 0.2], [0.25, 0.85]].forEach(function (s) { g.beginPath(); g.arc(wx + ww * s[0], wy + wh * s[1], 1.5, 0, Math.PI * 2); g.fill(); });
        } else {
          g.beginPath(); g.arc(wx + ww * 0.7, wy + ww * 0.34, ww * 0.13, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
          g.fillStyle = 'rgba(255,255,255,.95)';
          g.beginPath(); g.arc(wx + ww * 0.28, wy + wh * 0.6, ww * 0.1, 0, Math.PI * 2); g.arc(wx + ww * 0.4, wy + wh * 0.56, ww * 0.12, 0, Math.PI * 2); g.arc(wx + ww * 0.52, wy + wh * 0.61, ww * 0.09, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(wx + ww * 0.5, wy + wh * 1.02, ww * 0.7, wh * 0.2, 0, 0, Math.PI * 2); g.fillStyle = '#93d273'; g.fill();
        }
        g.restore();
        shape(); outline(g, 3);
        g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.55); g.lineTo(wx + ww, wy + wh * 0.55); outline(g, 2.5);
        rr(g, wx - 8, wy + wh - 2, ww + 16, 10, 4); g.fillStyle = '#c98f5a'; g.fill(); outline(g, 2);
      }
      function drawRoom() {
        var night = isNight() || dark > 0.5;
        g.fillStyle = '#fbe6c8'; g.fillRect(0, 0, LW + 2, FY);
        g.fillStyle = '#f6d9b3'; for (var x = 8; x < LW; x += 40) g.fillRect(x, 0, 18, FY);
        g.fillStyle = '#ffffff55';
        for (var hx = 17; hx < LW; hx += 40) for (var hy = 30; hy < FY - 20; hy += 60) { g.beginPath(); g.arc(hx, hy + ((hx / 40) % 2) * 30, 2.4, 0, Math.PI * 2); g.fill(); }
        // floor
        g.fillStyle = '#e0b07a'; g.fillRect(0, FY, LW + 2, LH - FY + 2);
        g.beginPath();
        for (var py = FY + 30, row = 0; py < LH; py += 34, row++) {
          g.moveTo(0, py); g.lineTo(LW, py);
          for (var px = (row % 2) * 60 + 40; px < LW; px += 120) { g.moveTo(px, py - 34); g.lineTo(px, py); }
        }
        g.strokeStyle = 'rgba(138,90,51,.35)'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#c98f5a'; g.fillRect(0, FY - 12, LW + 2, 14);
        g.beginPath(); g.moveTo(0, FY - 12); g.lineTo(LW, FY - 12); g.moveTo(0, FY + 2); g.lineTo(LW, FY + 2); outline(g, 2);
        drawWindow(night);
        // picture of an apple
        var fw = Math.min(70, LW * 0.16), fx = LW - fw - LW * 0.08, fy = Math.max(74, FY * 0.34);
        rr(g, fx, fy, fw, fw * 1.15, 6); g.fillStyle = '#fffaf0'; g.fill(); outline(g, 3);
        rr(g, fx + 6, fy + 6, fw - 12, fw * 1.15 - 12, 3); g.strokeStyle = '#e3a008'; g.lineWidth = 2; g.stroke();
        drawApple(g, fx + fw / 2, fy + fw * 0.62, fw * 0.2);
        // name plate on a string
        g.font = '24px ' + FONT;
        var tw = Math.max(70, g.measureText(save.name).width + 30), ph = 34, pxp = LW / 2 - tw / 2, pyp = Math.max(24, FY * 0.1);
        g.beginPath(); g.moveTo(LW / 2, pyp - 16); g.lineTo(pxp + 12, pyp); g.moveTo(LW / 2, pyp - 16); g.lineTo(pxp + tw - 12, pyp); outline(g, 1.6);
        g.beginPath(); g.arc(LW / 2, pyp - 16, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        rr(g, pxp, pyp, tw, ph, 10); g.fillStyle = '#b07f52'; g.fill(); outline(g, 2.5);
        rr(g, pxp + 4, pyp + 4, tw - 8, ph - 8, 7); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#fff8ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(save.name, LW / 2, pyp + ph / 2 + 1);
        plate = { x: pxp, y: pyp, w: tw, h: ph };
        // plant
        var plx = LW - LW * 0.1, ply = FY + 18;
        g.save(); g.translate(plx, ply);
        [[-0.5, '#3fae5f'], [0, '#58b25c'], [0.5, '#3fae5f'], [-0.9, '#58b25c'], [0.9, '#58b25c']].forEach(function (l) {
          g.save(); g.rotate(l[0]); g.beginPath(); g.ellipse(0, -30, 8, 22, 0, 0, Math.PI * 2); g.fillStyle = l[1]; g.fill(); outline(g, 1.8); g.restore();
        });
        g.beginPath(); g.moveTo(-16, -10); g.lineTo(16, -10); g.lineTo(12, 14); g.lineTo(-12, 14); g.closePath(); g.fillStyle = '#e2714f'; g.fill(); outline(g, 2);
        g.restore();
        // rug
        g.beginPath(); g.ellipse(LW / 2, pet.y + 2, Math.min(LW * 0.4, 230), Math.min(34, (LH - pet.y) * 0.6), 0, 0, Math.PI * 2);
        g.fillStyle = '#f7b7c8'; g.fill(); outline(g, 2.5);
        g.beginPath(); g.ellipse(LW / 2, pet.y + 2, Math.min(LW * 0.4, 230) * 0.78, Math.min(34, (LH - pet.y) * 0.6) * 0.7, 0, 0, Math.PI * 2);
        g.setLineDash([8, 7]); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
      }
      function petState() {
        var low = minNeed() < 25, chewing = food && food.drop >= 1 && food.bites < 3;
        var eye = mode === 'sleep' ? 'closed' : (pet.happy > 0 || pet.wig > 0) ? 'happy' : low ? 'sad' : 'open';
        var mouth = chewing ? (Math.sin(T * 16) > 0 ? 'open' : 'chew') : mode === 'sleep' ? 'chew' : pet.wig > 0 || pet.happy > 0.8 ? 'open' : low ? 'frown' : 'smile';
        var dirt = mode === 'bath' ? 0 : save.needs.clean < 55 ? clamp((55 - save.needs.clean) / 45, 0, 1) : 0;
        return { t: T, legs: pet.walking ? pet.legs : 0, wear: wearNow, eye: eye, mouth: mouth, dirt: dirt, blanket: mode === 'sleep' };
      }
      function drawPetAt(x, y, sc, face, st) {
        g.save(); g.translate(x, y);
        var br = 1 + Math.sin(T * (mode === 'sleep' ? 1.4 : 2.2)) * (mode === 'sleep' ? 0.03 : 0.015);
        var wg = pet.wig > 0 ? Math.sin(T * 30) * 0.1 * Math.min(1, pet.wig) : 0;
        g.rotate(wg); g.scale(sc * face, sc * br);
        if (pet.ball > 0 && mode === 'home') drawBall(g, T * 6); else drawPet(g, st);
        g.restore();
      }
      function drawSpeech() {
        if (!speech) return;
        var a = Math.min(1, speech.t * 4);
        g.save(); g.globalAlpha = a;
        g.font = '22px ' + FONT;
        var words = speech.text.split(' '), lines = [], cur = '';
        words.forEach(function (w) { var tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > Math.min(230, LW - 60) && cur) { lines.push(cur); cur = w; } else cur = tt; });
        if (cur) lines.push(cur);
        var bw = 0; lines.forEach(function (l) { bw = Math.max(bw, g.measureText(l).width); });
        bw += 24; var bh = lines.length * 24 + 14;
        var ax = pet.x + pet.face * 14 * HS, ay = petY() - 50 * HS - 6;
        if (mode === 'sleep') ay = pet.y - 46 * HS;
        var bx = clamp(ax - bw / 2, 8, LW - bw - 8), by = Math.max(8, ay - bh - 12);
        rr(g, bx, by, bw, bh, 14); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5);
        var tx = clamp(ax, bx + 18, bx + bw - 18);
        g.beginPath(); g.moveTo(tx - 8, by + bh - 1); g.lineTo(tx, by + bh + 11); g.lineTo(tx + 8, by + bh - 1); g.fillStyle = '#fff'; g.fill();
        g.beginPath(); g.moveTo(tx - 8, by + bh); g.lineTo(tx, by + bh + 11); g.lineTo(tx + 8, by + bh); outline(g, 2.5);
        g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
        lines.forEach(function (l, i) { g.fillText(l, bx + bw / 2, by + 19 + i * 24); });
        g.restore();
      }
      function drawParts(filter) {
        parts.forEach(function (p) {
          if (filter && !filter(p)) return;
          var k = p.t / p.life, a = k > 0.7 ? (1 - k) / 0.3 : 1;
          g.save(); g.globalAlpha = Math.max(0, a);
          if (p.kind === 'heart') heart(g, p.x, p.y, p.r, '#ff7eb6');
          else if (p.kind === 'note') { text('♪', p.x, p.y, 26, p.col); }
          else if (p.kind === 'spark') star(g, p.x, p.y, p.r, '#ffe066');
          else if (p.kind === 'crumb') { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fillStyle = p.col; g.fill(); }
          else if (p.kind === 'bubble') {
            g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fillStyle = 'rgba(220,240,255,.55)'; g.fill();
            g.lineWidth = 1.5; g.strokeStyle = 'rgba(63,134,216,.7)'; g.stroke();
            g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
          } else if (p.kind === 'drop') { g.beginPath(); g.ellipse(p.x, p.y, 2.2, 5, 0, 0, Math.PI * 2); g.fillStyle = '#5aa8ea'; g.fill(); }
          else if (p.kind === 'z') {
            g.font = Math.round(p.r * (1 + k * 0.6)) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('Z', p.x + Math.sin(p.t * 3) * 6, p.y);
            g.fillStyle = '#fff4c4'; g.fillText('Z', p.x + Math.sin(p.t * 3) * 6, p.y);
          }
          else if (p.kind === 'leaf') { g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); g.fillStyle = p.col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(29,47,111,.6)'; g.stroke(); }
          else if (p.kind === 'text') text(p.text, p.x, p.y, 24, p.col);
          g.restore();
        });
      }
      function drawTub(front) {
        var cx = LW / 2, w = 84 * HS, top = pet.y - 14 * HS, bot = pet.y + 14 * HS;
        if (!front) {
          g.beginPath(); g.ellipse(cx, top, w / 2, 9 * HS, 0, 0, Math.PI * 2); g.fillStyle = '#5aa8ea'; g.fill(); outline(g, 2.5);
          return;
        }
        g.beginPath(); g.moveTo(cx - w / 2, top); g.quadraticCurveTo(cx - w / 2, bot, cx - w * 0.3, bot); g.lineTo(cx + w * 0.3, bot); g.quadraticCurveTo(cx + w / 2, bot, cx + w / 2, top);
        g.ellipse(cx, top, w / 2, 9 * HS, 0, 0, Math.PI, false); g.closePath();
        g.fillStyle = '#ffffff'; g.fill(); outline(g, 3);
        g.beginPath(); g.moveTo(cx - w * 0.36, top + 9 * HS); g.quadraticCurveTo(cx, top + 14 * HS, cx + w * 0.36, top + 9 * HS); g.strokeStyle = '#9fd4f5'; g.lineWidth = 3 * HS / 2; g.stroke();
        [[-0.3, 1], [0.3, 1]].forEach(function (f) { g.beginPath(); g.ellipse(cx + w * f[0], bot + 3 * HS, 5 * HS, 3 * HS, 0, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill(); outline(g, 2); });
        // foam along the rim
        g.fillStyle = '#fff';
        for (var i = -5; i <= 5; i++) { g.beginPath(); g.arc(cx + i * w * 0.085, top - 1 + (i % 2) * 2, 4 * HS, Math.PI, 0); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(63,134,216,.5)'; g.stroke(); }
      }
      function drawSponge() {
        var x = bath.sx, y = bath.sy, s = HS / 2;
        g.save(); g.translate(x, y); g.rotate(-0.2); g.scale(s, s);
        rr(g, -18, -12, 36, 24, 7); g.fillStyle = '#ffd84a'; g.fill(); outline(g, 2.5);
        rr(g, -18, 4, 36, 8, 4); g.fillStyle = '#5cbc4b'; g.fill(); outline(g, 2);
        g.fillStyle = '#e3a008'; [[-9, -5, 2.5], [2, -6, 2], [10, -2, 2.6], [-2, 0, 1.6]].forEach(function (h) { g.beginPath(); g.arc(h[0], h[1], h[2], 0, Math.PI * 2); g.fill(); });
        g.restore();
      }
      function drawHome() {
        drawRoom();
        if (mode === 'bath') {
          drawTub(false);
          drawPetAt(pet.x, pet.y - 9 * HS, HS, 1, petState());
          bath.foam.forEach(function (f) {
            g.beginPath(); g.arc(pet.x + f.x * HS, pet.y + (f.y - 9) * HS, f.r * HS * 0.55, 0, Math.PI * 2);
            g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(63,134,216,.55)'; g.stroke();
          });
          drawTub(true);
          if (bath.rinse > 0) {
            var sx = pet.x, sy = Math.max(20, pet.y - 86 * HS);
            // shower: a pipe from the ceiling and a round head
            g.beginPath(); g.moveTo(LW + 6, sy - 44); g.lineTo(sx + 3 * HS + 16, sy - 44); g.quadraticCurveTo(sx + 3 * HS, sy - 44, sx + 3 * HS, sy - 28); g.lineTo(sx + 3 * HS, sy - 14); g.lineWidth = 9; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#c7d3e8'; g.stroke();
            g.beginPath(); g.moveTo(sx - 26 * HS, sy); g.quadraticCurveTo(sx + 3 * HS, sy - 30, sx + 32 * HS, sy); g.closePath(); g.fillStyle = '#c7d3e8'; g.fill(); outline(g, 2.5);
            g.fillStyle = INK; for (var hh = -3; hh <= 3; hh++) { g.beginPath(); g.arc(sx + 3 * HS + hh * 7 * HS, sy - 3, 1.6, 0, Math.PI * 2); g.fill(); }
          } else drawSponge();
        } else {
          if (food) {
            var f = food, fy = f.y - (1 - f.drop) * 140, r = 13 * HS / 2.2 * (1 - f.bites * 0.25);
            g.save(); g.translate(f.x, fy); if (f.bites < 3) THING[f.f.k](g, r); g.restore();
          }
          var py = petY();
          drawPetAt(pet.x, py, HS, pet.face, petState());
        }
        drawParts(function (p) { return p.kind !== 'z'; });
        if (dark > 0.01) {
          g.fillStyle = 'rgba(16,24,64,' + (0.6 * dark).toFixed(3) + ')'; g.fillRect(0, 0, LW + 2, LH + 2);
          g.save(); g.globalAlpha = dark; drawWindow(true); g.restore();
          g.save(); g.globalAlpha = 0.1 * dark;
          g.beginPath(); g.moveTo(win.x, win.y + win.h); g.lineTo(win.x + win.w, win.y + win.h); g.lineTo(pet.x + 70 * HS, pet.y + 20); g.lineTo(pet.x - 60 * HS, pet.y + 20); g.closePath();
          g.fillStyle = '#fff4c4'; g.fill(); g.restore();
        }
        drawParts(function (p) { return p.kind === 'z'; });
        drawSpeech();
      }
      function drawCatch() {
        var c = CG, sk = g.createLinearGradient(0, 0, 0, c.gy);
        sk.addColorStop(0, '#8fcdf8'); sk.addColorStop(1, '#e8f7ff');
        g.fillStyle = sk; g.fillRect(0, 0, LW + 2, LH + 2);
        g.beginPath(); g.arc(LW - 50, 60, 26, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
        // apple tree crowns along the top
        for (var i = 0; i < Math.ceil(LW / 90) + 1; i++) {
          var tx = i * 90 + 20;
          g.beginPath(); g.arc(tx, -10, 52, 0, Math.PI * 2); g.fillStyle = i % 2 ? '#58b25c' : '#4aa451'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
          drawApple(g, tx - 18, 22, 6); drawApple(g, tx + 20, 12, 6);
        }
        g.beginPath(); g.moveTo(0, c.gy - 30); g.quadraticCurveTo(LW * 0.3, c.gy - 70, LW * 0.6, c.gy - 34); g.quadraticCurveTo(LW * 0.85, c.gy - 10, LW + 2, c.gy - 40); g.lineTo(LW + 2, LH + 2); g.lineTo(0, LH + 2); g.closePath();
        g.fillStyle = '#b9e4a3'; g.fill();
        g.fillStyle = '#79c457'; g.fillRect(0, c.gy, LW + 2, LH - c.gy + 2);
        g.beginPath(); g.moveTo(0, c.gy); g.lineTo(LW + 2, c.gy); outline(g, 2);
        c.items.forEach(function (it) { g.save(); if (it.land) g.globalAlpha = Math.max(0, 1 - it.land / 0.7); g.translate(it.x, it.y); g.rotate(it.rot); drawApple(g, 0, 0, 11, it.gold ? '#f5c330' : null); g.restore(); });
        var hs = clamp(LW * 0.26 / 64, 1.1, 2.2);
        g.save(); g.translate(c.x, c.gy); g.scale(hs * c.face, hs);
        drawPet(g, { t: T, legs: c.legs, wear: wearNow, eye: 'open', mouth: 'smile', apples: c.caught, gold: c.gold });
        g.restore();
        rr(g, 10, 52, 92, 40, 18); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5);
        drawApple(g, 34, 73, 11); text(String(c.caught), 54, 72, 28, '#cf412d', 'left');
        drawParts();
      }
      function drawHide() {
        var h = HG, top = h.top;
        var sk = g.createLinearGradient(0, 0, 0, top);
        sk.addColorStop(0, '#f6c98a'); sk.addColorStop(1, '#fff0d8');
        g.fillStyle = sk; g.fillRect(0, 0, LW + 2, LH + 2);
        // autumn trees (stroke first, then fill, so only the outer outline shows)
        for (var i = 0; i < Math.ceil(LW / 110) + 1; i++) {
          var tx = i * 110 + 40, ty = top;
          rr(g, tx - 6, ty - 70, 12, 72, 3); g.fillStyle = '#8a6142'; g.fill(); outline(g, 1.5);
          g.beginPath(); g.arc(tx, ty - 90, 42, 0, Math.PI * 2); g.moveTo(tx - 2, ty - 68); g.arc(tx - 28, ty - 68, 26, 0, Math.PI * 2); g.moveTo(tx + 54, ty - 68); g.arc(tx + 28, ty - 68, 26, 0, Math.PI * 2);
          g.lineWidth = 3; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke();
          g.fillStyle = i % 2 ? '#e9813c' : '#f0a43a'; g.fill();
        }
        g.fillStyle = '#d8b36a'; g.fillRect(0, top, LW + 2, LH - top + 2);
        g.beginPath(); g.moveTo(0, top); g.lineTo(LW + 2, top); outline(g, 2);
        for (var q = 0; q < 26; q++) {
          var lx = ((Math.sin(q * 12.9898) * 43758.5453) % 1 + 1) % 1 * LW, ly = top + 12 + ((Math.sin(q * 78.233) * 12345.678) % 1 + 1) % 1 * (LH - top - 20);
          g.save(); g.translate(lx, ly); g.rotate(q); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); g.fillStyle = LEAF_COLS[q % 5]; g.globalAlpha = 0.7; g.fill(); g.restore();
        }
        var hs = h.r * 0.95 / 40;
        var list = h.piles.slice().sort(function (a, b) { return a.y - b.y; });
        list.forEach(function (p) {
          g.beginPath(); g.ellipse(p.x, p.y + 2, h.r * 1.05, h.r * 0.16, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(120,80,30,.25)'; g.fill();
          // what is under the pile
          if (p.hog && (h.phase === 'show' || h.phase === 'cover' || h.phase === 'found' || (h.phase === 'pick' && p.open))) {
            var rise = h.phase === 'show' ? Math.min(1, h.t / 0.4) : h.phase === 'cover' ? 1 - Math.min(1, h.t / 0.5) : Math.min(1, p.open * 1.4);
            g.save(); g.beginPath(); g.rect(p.x - h.r * 2, 0, h.r * 4, p.y - 2); g.clip();
            g.translate(p.x, p.y + (1 - rise) * 52 * hs - rise * h.r * 0.45); g.scale(hs, hs);
            drawPet(g, { t: T, wear: wearNow, eye: h.phase === 'found' ? 'happy' : 'open', mouth: h.phase === 'found' ? 'open' : 'smile' });
            g.restore();
          }
          if (p.open > 0) {
            if (!p.hog) { g.save(); g.translate(p.x, p.y - h.r * 0.3 - p.open * 6); THING[p.item.k](g, h.r * 0.34); g.restore(); }
            g.save(); g.translate(p.x, p.y);
            for (var j = 0; j < 7; j++) { g.save(); g.translate((j - 3) * h.r * 0.3, 4 + (j % 2) * 4); g.rotate(j); g.beginPath(); g.ellipse(0, 0, h.r * 0.18, h.r * 0.08, 0, 0, Math.PI * 2); g.fillStyle = LEAF_COLS[j % 5]; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(29,47,111,.5)'; g.stroke(); g.restore(); }
            g.restore();
          } else {
            g.save(); g.translate(p.x, p.y); leafPile(g, h.r, p.leaves); g.restore();
          }
        });
        if (h.msg) {
          var my = Math.max(36, top - 170) + (h.phase === 'pick' && !reduce ? Math.sin(T * 4) * 3 : 0);
          g.font = '28px ' + FONT; var mw = Math.min(LW - 16, g.measureText(h.msg).width + 36);
          rr(g, LW / 2 - mw / 2, my - 24, mw, 48, 22); g.fillStyle = h.phase === 'found' ? '#fff4d6' : '#fff'; g.fill(); outline(g, 2.5);
          g.fillStyle = h.phase === 'pick' ? PURPLE : INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.msg, LW / 2, my + 1);
        }
        drawParts();
      }
      function draw() {
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        if (mode === 'catch' && CG) drawCatch();
        else if (mode === 'hide' && HG) drawHide();
        else drawHome();
      }
      function frame(ts) {
        raf = 0;
        if (!running) return;
        var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
        last = ts;
        update(dt); draw();
        raf = requestAnimationFrame(frame);
      }
      function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

      // test hook (read-only use)
      cv._zw = function () {
        return { mode: mode, S: S, LW: LW, LH: LH, pet: { x: pet.x, y: pet.y, face: pet.face, HS: HS }, plate: plate, needs: save.needs, food: !!food,
          catch: CG && { x: CG.x, items: CG.items.length, caught: CG.caught, spawned: CG.spawned, total: CG.total, gy: CG.gy, done: CG.done },
          hide: HG && { phase: HG.phase, round: HG.round, found: HG.found, first: HG.first, r: HG.r, piles: HG.piles.map(function (p) { return { x: p.x, y: p.y, hog: p.hog, open: p.open }; }) } };
      };

      // ---------- boot ----------
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      setMode(mode);
      if (mode === 'sleep') ctx.music('calm');
      start();
      if (!save.seenHelp) {
        save.seenHelp = true; persist();
        panel = ctx.panel({
          title: 'Zwierzątko', closable: false, button: 'Do domku',
          lines: ['To jest ' + save.name + ', Twój jeżyk!', 'Karm go, kąp i usypiaj. Pobaw się z nim.', 'Dotknij go, a się ucieszy.', { text: 'Nic złego się nie stanie, ale ' + save.name + ' lubi, gdy wpadasz. Dotknij tabliczki z imieniem, żeby je zmienić.', muted: true }],
          onPlay: function () { panel = null; pet.hop = 0; say('Cześć! Jestem ' + save.name + '!', 2.4); }
        });
      } else if (mode === 'sleep') {
        say('Chrr...', 1.5);
      } else if (away > 6 * 3600000) {
        pet.hop = 0; pet.happy = 1.5;
        say('Hej! Brakowało mi Ciebie!', 2.8);
        burst('heart', pet.x, pet.y - 45 * HS, 5);
        if (minNeed() < 45) { var lk0 = lowest(); later(function () { if (mode === 'home' && !speech && !food) say(needSay(lk0, save.needs[lk0]), 2.6); }, 3200); }
      } else {
        say(['Cześć!', 'Hej, to Ty!', 'Hura, jesteś!'][Math.floor(Math.random() * 3)], 1.8);
      }
      persist();

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; persist(); },
        resume: function () { if (running) return; running = true; settle(Date.now()); updateHud(); start(); },
        destroy: function () {
          running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          if (CG && !CG.done) { addNeed('fun', 25 * Math.min(1, CG.caught / CG.total)); }
          if (HG && !HG.done) { addNeed('fun', 25 * HG.round / ROUNDS); }
          persist();
          timers.forEach(clearTimeout); timers = [];
          ro.disconnect();
          cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
          cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
          window.removeEventListener('keydown', onKey);
          if (panel) { try { panel.close(); } catch (e) {} panel = null; }
          root.remove();
        }
      };
    }
  });
})();
