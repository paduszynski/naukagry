/*
 * Zwierzątko: up to four pets in a little house (hedgehog, red fox, fennec, squirrel, badger, hamster,
 * guinea pig). Each pet has its own four needs (brzuszek, humor, czystość, sen) that drop slowly in real
 * time, from timestamps, also while the app is closed. Nothing bad ever happens: at worst a pet looks a bit
 * sad and says it missed you.
 * Pets level up from care: care actions give growth points (capped per day) and every pet has its own level.
 * At level 10 a Maluch and at level 20 a Młode can grow: a big "Urośnij!" button appears and the child taps it.
 * Pets grow from care (Maluch -> Młode -> Dorosłe): care actions give growth points, capped per day, so
 * growing takes days and never goes back. Pets that are not at home live on "Leśna Polana" (a happy
 * meadow; they don't grow there) and can come back to a free home slot any time for free.
 * Home upgrades (Rodzina -> Ulepszenia domku: basket, bed, bubble bath, toy box), each can be switched off.
 * Feed (food 10-25 ★, a free apple basket every day, produce from the Ogródek pantry for free), bath (drag the sponge), sleep, stroke (zones; a good
 * petting session makes the pet roll over and show its belly), tickle (quick taps), dress up with the
 * items the child owns in Jeżyk w biegu (read-only), and seven mini-games for 30 ★ that fill "humor".
 * Now and then (every 25-60 s, when nothing else happens) two awake pets at home play on their own: toss a ball,
 * chase each other or hop together. Purely cosmetic (no needs, points or saves); any tap or action ends it.
 * Logical coordinates: 1 unit = S css px, a portrait phone is ~400 units wide.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var GAME_PRICE = 30, BASKET = 3, MIN_NEED = 5, ROUNDS = 5;
  var ADOPT_PRICE = 50, SLOT_PRICE = [0, 100, 150, 200], MAX_PETS = 30;
  var NEEDS = ['food', 'fun', 'clean', 'sleep'];
  var RATES = { food: 2, fun: 2.5, clean: 1.5, sleep: 2 };   // points lost per hour (100 = full)
  var SLEEP_GAIN_H = 60, SLEEP_GAIN_S = 4;                  // asleep: per hour while away, per second on screen
  var PET_FUN_CAP = 70;                                    // petting alone fills "humor" up to here
  // growth: points per care action, a cap per kind of care per day, and a cap per pet per day
  var GP = { feed: 1, bath: 2, sleep: 1, pet: 1, game: 2 };
  var GP_SRC_CAP = { feed: 2, bath: 2, sleep: 1, pet: 1, game: 2 };
  var GP_DAY = 6, GROW_AT = [0, 15, 50];                   // Młode after ~3 days of care, Dorosłe after ~9
  // levels: growth points needed for each level (1..20); after 20 every level needs 4 more (about 2/3 of a day of care)
  var LVL_GP = [0, 0, 1, 2, 4, 5, 7, 9, 11, 13, 15, 18, 21, 25, 28, 32, 35, 39, 42, 46, 50];
  var GROW_LVL = [10, 20];                                 // the level at which a Maluch / a Młode may grow

  var STAGES = [
    { n: 'Maluch', kb: 0.58, kh: 0.8, kl: 0.55, ke: 1.45 },
    { n: 'Młode', kb: 0.78, kh: 0.9, kl: 0.8, ke: 1.2 },
    { n: 'Dorosłe', kb: 1, kh: 1, kl: 1, ke: 1 }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pl(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  // Polish past tense needs a gender; pet names ending in -a are taken as feminine (Ruda, Kita, Pepa)
  function fem(name) { return /a$/i.test(String(name || '').trim()); }
  function vb(name, m, f) { return fem(name) ? f : m; }
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
  var shades = {};
  function shade(hex, f) {
    var k = hex + f; if (shades[k]) return shades[k];
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)); }
    return (shades[k] = 'rgb(' + c(r) + ',' + c(gg) + ',' + c(b) + ')');
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
  // ---------- more food (centre 0,0, size r) ----------
  THING.marchewka = function (g, r) {
    g.save(); g.rotate(0.6);
    g.beginPath(); g.moveTo(-r * 0.38, -r * 0.7); g.quadraticCurveTo(0, -r * 0.85, r * 0.38, -r * 0.7); g.lineTo(r * 0.05, r * 1.1); g.quadraticCurveTo(0, r * 1.18, -r * 0.05, r * 1.1); g.closePath();
    g.fillStyle = '#f08a2c'; g.fill(); outline(g, Math.max(1, r * 0.15));
    g.beginPath(); g.moveTo(-r * 0.22, -r * 0.2); g.lineTo(-r * 0.02, -r * 0.25); g.moveTo(r * 0.18, r * 0.25); g.lineTo(-r * 0.02, r * 0.2); g.moveTo(-r * 0.12, r * 0.6); g.lineTo(r * 0.05, r * 0.58);
    g.strokeStyle = '#b8571a'; g.lineWidth = Math.max(1, r * 0.08); g.stroke();
    g.fillStyle = '#3fae5f';
    [[-0.35, -1.3, -0.4], [0, -1.45, 0], [0.35, -1.3, 0.4]].forEach(function (l) {
      g.save(); g.translate(l[0] * r * 0.5, -r * 0.75); g.rotate(l[2]); g.beginPath(); g.ellipse(0, -r * 0.35, r * 0.14, r * 0.38, 0, 0, Math.PI * 2); g.fill(); outline(g, Math.max(0.8, r * 0.1)); g.restore();
    });
    g.restore();
  };
  THING.salata = function (g, r) {
    [[-0.45, 0.1, -0.5, '#7fcf5a'], [0.45, 0.1, 0.5, '#7fcf5a'], [0, -0.1, 0, '#a5e07a']].forEach(function (l) {
      g.save(); g.translate(l[0] * r, l[1] * r); g.rotate(l[2]);
      g.beginPath(); g.moveTo(0, r * 0.8);
      g.bezierCurveTo(-r * 0.9, r * 0.4, -r * 0.8, -r * 0.9, 0, -r * 0.95);
      g.bezierCurveTo(r * 0.8, -r * 0.9, r * 0.9, r * 0.4, 0, r * 0.8); g.closePath();
      g.fillStyle = l[3]; g.fill(); outline(g, Math.max(1, r * 0.12));
      g.beginPath(); g.moveTo(0, r * 0.75); g.lineTo(0, -r * 0.6); g.moveTo(0, 0); g.lineTo(-r * 0.3, -r * 0.3); g.moveTo(0, r * 0.25); g.lineTo(r * 0.3, -r * 0.05);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(0.8, r * 0.07); g.stroke();
      g.restore();
    });
  };
  THING.ziarenka = function (g, r) {
    g.beginPath(); g.ellipse(0, r * 0.45, r * 1.05, r * 0.42, 0, 0, Math.PI * 2); g.fillStyle = '#c98f5a'; g.fill(); outline(g, Math.max(1, r * 0.12));
    g.beginPath(); g.ellipse(0, r * 0.3, r * 0.85, r * 0.28, 0, 0, Math.PI * 2); g.fillStyle = '#8a5a33'; g.fill();
    var S = [[-0.5, 0.05], [-0.2, -0.15], [0.15, -0.05], [0.45, 0.1], [-0.05, 0.2], [0.3, -0.3], [-0.35, -0.35], [0, -0.45]];
    S.forEach(function (p, i) {
      g.save(); g.translate(p[0] * r, p[1] * r); g.rotate(i * 0.9);
      g.beginPath(); g.ellipse(0, 0, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
      g.fillStyle = i % 3 ? '#f5e2b0' : '#3a2a24'; g.fill(); g.lineWidth = Math.max(0.6, r * 0.05); g.strokeStyle = INK; g.stroke();
      g.restore();
    });
  };
  THING.orzechy = function (g, r) {
    [[-0.42, 0.2], [0.42, 0.25], [0, -0.3]].forEach(function (p) {
      g.save(); g.translate(p[0] * r, p[1] * r);
      g.beginPath(); g.moveTo(0, -r * 0.62); g.bezierCurveTo(r * 0.55, -r * 0.5, r * 0.58, r * 0.5, 0, r * 0.52); g.bezierCurveTo(-r * 0.58, r * 0.5, -r * 0.55, -r * 0.5, 0, -r * 0.62);
      g.fillStyle = '#b97a3e'; g.fill(); outline(g, Math.max(1, r * 0.11));
      g.beginPath(); g.ellipse(0, r * 0.28, r * 0.36, r * 0.2, 0, 0, Math.PI * 2); g.fillStyle = '#e0b07a'; g.fill();
      g.beginPath(); g.arc(-r * 0.15, -r * 0.2, r * 0.1, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      g.restore();
    });
  };
  THING.winogrona = function (g, r) {
    var B = [[-0.4, -0.35], [0, -0.4], [0.4, -0.35], [-0.2, 0.05], [0.2, 0.05], [0, 0.45]];
    g.beginPath(); g.moveTo(0, -r * 0.7); g.quadraticCurveTo(r * 0.1, -r * 1.1, r * 0.35, -r * 1.15); outline(g, Math.max(1, r * 0.12));
    g.beginPath(); g.ellipse(-r * 0.3, -r * 0.95, r * 0.35, r * 0.17, -0.4, 0, Math.PI * 2); g.fillStyle = '#3fae5f'; g.fill(); outline(g, Math.max(0.8, r * 0.1));
    B.forEach(function (p) {
      g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.3, 0, Math.PI * 2); g.fillStyle = '#9b5ac8'; g.fill(); outline(g, Math.max(0.8, r * 0.1));
      g.beginPath(); g.arc(p[0] * r - r * 0.09, p[1] * r - r * 0.09, r * 0.08, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
    });
  };
  THING.jajko = function (g, r) {
    g.beginPath(); g.moveTo(0, -r * 1.05);
    g.bezierCurveTo(r * 0.75, -r * 1.0, r * 0.85, r * 0.85, 0, r * 0.85);
    g.bezierCurveTo(-r * 0.85, r * 0.85, -r * 0.75, -r * 1.0, 0, -r * 1.05);
    g.fillStyle = '#fff6e6'; g.fill(); outline(g, Math.max(1, r * 0.14));
    g.beginPath(); g.ellipse(-r * 0.25, -r * 0.35, r * 0.13, r * 0.25, -0.3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = 'rgba(201,143,90,.45)'; [[0.3, 0.2, 0.1], [-0.1, 0.45, 0.08], [0.15, -0.4, 0.07]].forEach(function (p) { g.beginPath(); g.arc(p[0] * r, p[1] * r, p[2] * r, 0, Math.PI * 2); g.fill(); });
  };
  THING.miod = function (g, r) {
    rr(g, -r * 0.75, -r * 0.55, r * 1.5, r * 1.5, r * 0.35); g.fillStyle = '#f5b82a'; g.fill(); outline(g, Math.max(1, r * 0.13));
    g.beginPath(); g.arc(-r * 0.35, -r * 0.1, r * 0.14, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.65)'; g.fill();
    rr(g, -r * 0.85, -r * 0.95, r * 1.7, r * 0.45, r * 0.15); g.fillStyle = '#e2533f'; g.fill(); outline(g, Math.max(1, r * 0.12));
    g.fillStyle = '#fff'; for (var i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * r * 0.34, -r * 0.72, r * 0.07, 0, Math.PI * 2); g.fill(); }
    rr(g, -r * 0.45, -r * 0.2, r * 0.9, r * 0.6, r * 0.12); g.fillStyle = '#fff4d6'; g.fill(); g.lineWidth = Math.max(0.8, r * 0.07); g.strokeStyle = INK; g.stroke();
    g.font = Math.round(r * 0.5) + 'px ' + FONT; g.fillStyle = '#b5651d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MIÓD', 0, r * 0.1);
  };
  THING.mleko = function (g, r) {
    g.beginPath(); g.ellipse(0, -r * 0.1, r * 1.05, r * 0.32, 0, 0, Math.PI * 2); g.fillStyle = '#fffdf6'; g.fill();
    g.beginPath(); g.moveTo(-r * 1.05, -r * 0.1); g.quadraticCurveTo(-r * 0.95, r * 0.75, 0, r * 0.75); g.quadraticCurveTo(r * 0.95, r * 0.75, r * 1.05, -r * 0.1);
    g.ellipse(0, -r * 0.1, r * 1.05, r * 0.32, 0, 0, Math.PI, false); g.closePath();
    g.fillStyle = '#7fb6ea'; g.fill(); outline(g, Math.max(1, r * 0.13));
    g.beginPath(); g.ellipse(0, -r * 0.1, r * 1.05, r * 0.32, 0, 0, Math.PI * 2); outline(g, Math.max(1, r * 0.13));
    g.beginPath(); g.ellipse(-r * 0.25, -r * 0.14, r * 0.3, r * 0.08, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(-r * 0.55, r * 0.3); g.quadraticCurveTo(0, r * 0.45, r * 0.55, r * 0.3); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, r * 0.1); g.stroke();
    heart(g, 0, r * 0.33, r * 0.16, '#ff7eb6');
  };

  // ---------- produce from Ogródek (the child grows it there; fed for free) ----------
  function lw(r, k) { return Math.max(0.8, r * (k || 0.13)); }
  function gloss(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill(); }
  function sepals(g, x, y, r, n, col) {
    g.beginPath();
    for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.75; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a - 0.4) * r * 0.6, y + Math.sin(a - 0.4) * r * 0.25 - r * 0.1, x + Math.cos(a) * r, y + Math.abs(Math.sin(a)) * r * 0.15 - r * 0.08); }
    g.strokeStyle = INK; g.lineWidth = lw(r, 0.42); g.lineCap = 'round'; g.stroke(); g.strokeStyle = col || '#3fae5f'; g.lineWidth = lw(r, 0.22); g.stroke();
  }
  THING.rzezucha = function (g, r) {
    for (var i = -3; i <= 3; i++) {
      var x = i * r * 0.22, h = r * (0.9 + (i % 2 ? 0.25 : 0));
      g.beginPath(); g.moveTo(x, r * 0.3); g.lineTo(x + i * r * 0.04, r * 0.3 - h); g.strokeStyle = '#c9e9a8'; g.lineWidth = lw(r, 0.08); g.stroke();
      g.save(); g.translate(x + i * r * 0.04, r * 0.3 - h);
      [-1, 1].forEach(function (sd) { g.beginPath(); g.ellipse(sd * r * 0.13, 0, r * 0.15, r * 0.09, sd * 0.4, 0, Math.PI * 2); g.fillStyle = '#6cc04a'; g.fill(); g.lineWidth = lw(r, 0.05); g.strokeStyle = INK; g.stroke(); });
      g.restore();
    }
    rr(g, -r * 0.9, r * 0.25, r * 1.8, r * 0.65, r * 0.2); g.fillStyle = '#fff'; g.fill(); outline(g, lw(r));
    g.beginPath(); g.moveTo(-r * 0.6, r * 0.55); g.lineTo(r * 0.6, r * 0.55); g.strokeStyle = '#f4c542'; g.lineWidth = lw(r, 0.1); g.stroke();
  };
  THING.szczypiorek = function (g, r) {
    [[-0.35, -0.25], [-0.12, -0.1], [0.12, 0.08], [0.35, 0.22]].forEach(function (b, i) {
      g.beginPath(); g.moveTo(b[0] * r, r * 0.6); g.quadraticCurveTo(b[0] * r * 1.4, -r * 0.2, b[0] * r * 2 + b[1] * r, -r * (1.1 - (i % 2) * 0.15));
      g.strokeStyle = INK; g.lineWidth = lw(r, 0.24); g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#4fb64a'; g.lineWidth = lw(r, 0.14); g.stroke();
    });
    g.beginPath(); g.ellipse(0, r * 0.62, r * 0.42, r * 0.16, 0, 0, Math.PI * 2); g.fillStyle = '#c58ae0'; g.fill(); outline(g, lw(r, 0.1));
  };
  THING.rzodkiewka = function (g, r) {
    [[-0.3, -0.5], [0.05, 0], [0.4, 0.45]].forEach(function (l) { g.save(); g.translate(0, -r * 0.55); g.rotate(l[1]); g.beginPath(); g.ellipse(0, -r * 0.45, r * 0.2, r * 0.45, 0, 0, Math.PI * 2); g.fillStyle = '#4fb64a'; g.fill(); outline(g, lw(r, 0.08)); g.restore(); });
    g.beginPath(); g.moveTo(0, -r * 0.6); g.bezierCurveTo(r * 0.85, -r * 0.6, r * 0.85, r * 0.45, 0, r * 0.75); g.bezierCurveTo(-r * 0.85, r * 0.45, -r * 0.85, -r * 0.6, 0, -r * 0.6);
    g.fillStyle = '#e2405a'; g.fill(); outline(g, lw(r));
    g.beginPath(); g.moveTo(0, r * 0.72); g.lineTo(r * 0.05, r * 1.05); outline(g, lw(r, 0.08));
    g.beginPath(); g.ellipse(0, r * 0.45, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    gloss(g, -r * 0.3, -r * 0.2, r * 0.12, r * 0.2, 0.3);
  };
  THING.pomidor = function (g, r) {
    g.beginPath(); g.ellipse(0, r * 0.1, r * 0.95, r * 0.82, 0, 0, Math.PI * 2); g.fillStyle = '#e2402f'; g.fill(); outline(g, lw(r));
    gloss(g, -r * 0.4, -r * 0.15, r * 0.15, r * 0.25, 0.4);
    sepals(g, 0, -r * 0.62, r * 0.55, 5);
  };
  THING.truskawka = function (g, r) {
    g.beginPath(); g.moveTo(0, r * 1.0); g.bezierCurveTo(-r * 0.9, r * 0.2, -r * 1.0, -r * 0.65, 0, -r * 0.6); g.bezierCurveTo(r * 1.0, -r * 0.65, r * 0.9, r * 0.2, 0, r * 1.0);
    g.fillStyle = '#e8344a'; g.fill(); outline(g, lw(r));
    g.fillStyle = '#ffe27a'; [[-0.4, -0.2], [0, -0.25], [0.4, -0.2], [-0.25, 0.15], [0.2, 0.15], [0, 0.5], [-0.5, 0.05], [0.5, 0.05]].forEach(function (q) { g.beginPath(); g.ellipse(q[0] * r, q[1] * r, r * 0.05, r * 0.08, 0, 0, Math.PI * 2); g.fill(); });
    sepals(g, 0, -r * 0.62, r * 0.55, 5);
  };
  THING.kukurydza = function (g, r) {
    g.save(); g.rotate(0.5);
    g.beginPath(); g.ellipse(0, 0, r * 0.45, r * 1.05, 0, 0, Math.PI * 2); g.fillStyle = '#f6cf3a'; g.fill(); outline(g, lw(r));
    g.save(); g.beginPath(); g.ellipse(0, 0, r * 0.45, r * 1.05, 0, 0, Math.PI * 2); g.clip();
    g.strokeStyle = '#d9a514'; g.lineWidth = lw(r, 0.06);
    for (var y = -r; y < r; y += r * 0.24) { g.beginPath(); g.moveTo(-r * 0.5, y); g.lineTo(r * 0.5, y); g.stroke(); }
    [-0.15, 0.15].forEach(function (x) { g.beginPath(); g.moveTo(x * r, -r * 1.1); g.lineTo(x * r, r * 1.1); g.stroke(); });
    g.restore();
    [-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(0, r * 1.1); g.quadraticCurveTo(sd * r * 0.8, r * 0.4, sd * r * 0.35, -r * 0.35); g.quadraticCurveTo(sd * r * 0.25, r * 0.5, 0, r * 1.1); g.fillStyle = '#7fcf5a'; g.fill(); outline(g, lw(r, 0.1)); });
    g.restore();
  };
  THING.groszek = function (g, r) {
    g.save(); g.rotate(-0.35);
    g.beginPath(); g.moveTo(-r * 1.1, 0); g.quadraticCurveTo(0, -r * 0.85, r * 1.1, 0); g.quadraticCurveTo(0, r * 0.75, -r * 1.1, 0); g.fillStyle = '#74c94e'; g.fill(); outline(g, lw(r));
    [-0.55, -0.05, 0.45].forEach(function (x) { g.beginPath(); g.arc(x * r, -r * 0.02, r * 0.25, 0, Math.PI * 2); g.fillStyle = '#a5e07a'; g.fill(); outline(g, lw(r, 0.07)); gloss(g, x * r - r * 0.08, -r * 0.1, r * 0.06, r * 0.06); });
    g.beginPath(); g.moveTo(r * 1.05, 0); g.quadraticCurveTo(r * 1.3, -r * 0.1, r * 1.35, -r * 0.35); outline(g, lw(r, 0.1));
    g.restore();
  };
  THING.dynia = function (g, r) {
    [[-0.5, 0.5, '#e57a1c'], [0.5, 0.5, '#e57a1c'], [0, 0.55, '#f08a24']].forEach(function (q) { g.beginPath(); g.ellipse(q[0] * r, r * 0.15, q[1] * r, r * 0.75, 0, 0, Math.PI * 2); g.fillStyle = q[2]; g.fill(); outline(g, lw(r)); });
    gloss(g, -r * 0.15, -r * 0.1, r * 0.08, r * 0.22);
    rr(g, -r * 0.12, -r * 0.85, r * 0.24, r * 0.32, r * 0.08); g.fillStyle = '#7a5a2e'; g.fill(); outline(g, lw(r, 0.1));
    g.beginPath(); g.ellipse(r * 0.38, -r * 0.72, r * 0.3, r * 0.14, -0.4, 0, Math.PI * 2); g.fillStyle = '#3fae5f'; g.fill(); outline(g, lw(r, 0.08));
  };
  THING.papryka = function (g, r) {
    g.beginPath(); g.moveTo(-r * 0.75, -r * 0.45); g.bezierCurveTo(-r * 1.0, r * 0.4, -r * 0.6, r * 0.95, -r * 0.2, r * 0.85); g.quadraticCurveTo(0, r * 0.7, r * 0.2, r * 0.85);
    g.bezierCurveTo(r * 0.6, r * 0.95, r * 1.0, r * 0.4, r * 0.75, -r * 0.45); g.quadraticCurveTo(0, -r * 0.75, -r * 0.75, -r * 0.45); g.closePath();
    g.fillStyle = '#f6c21b'; g.fill(); outline(g, lw(r));
    g.beginPath(); g.moveTo(0, -r * 0.55); g.quadraticCurveTo(-r * 0.05, r * 0.2, 0, r * 0.7); g.strokeStyle = 'rgba(180,120,0,.5)'; g.lineWidth = lw(r, 0.07); g.stroke();
    gloss(g, -r * 0.45, -r * 0.05, r * 0.1, r * 0.25, 0.1);
    g.beginPath(); g.moveTo(0, -r * 0.6); g.quadraticCurveTo(r * 0.05, -r * 0.95, r * 0.35, -r * 1.05); g.strokeStyle = INK; g.lineWidth = lw(r, 0.3); g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#3fae5f'; g.lineWidth = lw(r, 0.16); g.stroke();
  };
  THING.ogorek = function (g, r) {
    g.save(); g.rotate(-0.5);
    rr(g, -r * 1.1, -r * 0.42, r * 2.2, r * 0.84, r * 0.42); g.fillStyle = '#3f9a45'; g.fill(); outline(g, lw(r));
    g.fillStyle = '#a8dc8a'; [[-0.6, -0.12], [-0.2, 0.15], [0.2, -0.12], [0.6, 0.15], [-0.85, 0.1], [0.85, -0.05]].forEach(function (q) { g.beginPath(); g.arc(q[0] * r, q[1] * r, r * 0.07, 0, Math.PI * 2); g.fill(); });
    g.beginPath(); g.ellipse(-r * 0.2, -r * 0.24, r * 0.5, r * 0.06, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
    g.restore();
  };
  THING.baklazan = function (g, r) {
    g.save(); g.rotate(0.45);
    g.beginPath(); g.moveTo(0, -r * 0.55); g.bezierCurveTo(r * 0.5, -r * 0.55, r * 0.45, -r * 0.1, r * 0.6, r * 0.35); g.bezierCurveTo(r * 0.75, r * 1.05, -r * 0.75, r * 1.05, -r * 0.6, r * 0.35); g.bezierCurveTo(-r * 0.45, -r * 0.1, -r * 0.5, -r * 0.55, 0, -r * 0.55);
    g.fillStyle = '#6a3d9a'; g.fill(); outline(g, lw(r));
    gloss(g, -r * 0.25, r * 0.25, r * 0.1, r * 0.28, 0.2);
    sepals(g, 0, -r * 0.5, r * 0.5, 4, '#5aa84a');
    g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(0, -r * 0.95); g.strokeStyle = INK; g.lineWidth = lw(r, 0.26); g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#5aa84a'; g.lineWidth = lw(r, 0.13); g.stroke();
    g.restore();
  };
  THING.pilka = function (g, r) {
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#f5d84a'; g.fill(); outline(g, Math.max(1, r * 0.16));
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
    g.beginPath(); g.arc(-r * 1.25, 0, r * 0.95, -0.9, 0.9); g.moveTo(r * 1.25 - r * 0.95 * Math.cos(0.9), -r * 0.95 * Math.sin(0.9)); g.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.9, Math.PI + 0.9, false);
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, r * 0.16); g.stroke(); g.restore();
    g.beginPath(); g.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
  };

  // =====================================================================
  // Species. All pets are drawn side view facing right, feet at y=0, by one parametric drawer
  // (body ellipse + neck + head + snout + ears + tail + legs with paws + markings); the hedgehog keeps its own
  // drawing from Jeżyk w biegu. Lying belly-up, every pet shows a front-view face (frontFace). Sizes are adult units; STAGES scale body/head/legs/eyes for the young.
  // =====================================================================
  var SP = {
    jez: { n: 'Jeż', names: ['Kolec', 'Igiełka', 'Jeżynka', 'Kolczak'], fav: ['jablko', 'gruszka'], game: 'catch', hog: true },
    lis: {
      n: 'Lis rudy', names: ['Ruda', 'Rudek', 'Liska', 'Kita'], fav: ['jagody', 'jajko'], game: 'aport',
      col: '#ea7a32', head: '#ea7a32', leg: '#ea7a32', sock: '#33263f', pad: '#8d7f9c', chest: '#fff7ec', bl: 50, bh: 23, legH: 12, legW: 4, bx: -2,
      nk: [0.62, -0.5], hdx: 6, hdy: -9, hr: 11.5, hw: 1, snout: { t: 'point', l: 12, y: 2.5 }, nose: INK, nr: 2.4,
      ear: { t: 'point', x: -3.5, y: -8, w: 10.5, h: 14, ang: -0.14, bulge: 0.3, farX: 6, farA: 0.34, col: '#ea7a32', inner: '#fff1e0', tip: '#33263f' },
      tail: { c: [[-11, 0], [-25, 4], [-36, -9]], r: 9.5, shape: 'brush', n: 15, flat: 38, col: '#ea7a32', tip: '#fff7ec', tipFrom: 0.78 },
      eye: { x: 0.32, y: -0.18, r: 2.5 }, low: '#fff7ec'
    },
    fenek: {
      n: 'Fenek', names: ['Fenio', 'Uszatek', 'Sara', 'Piasek'], fav: ['winogrona', 'gruszka'], game: 'bubbles',
      col: '#f2d29b', head: '#f2d29b', leg: '#dcb274', pad: '#f3c9b4', belly: '#fff8ea', bl: 40, bh: 21, legH: 11, legW: 3.8, bx: -2,
      nk: [0.62, -0.5], hdx: 5, hdy: -8, hr: 10.5, hw: 1, snout: { t: 'point', l: 9, y: 2.5 }, nose: INK, nr: 2.2,
      ear: { t: 'point', x: -4, y: -6, w: 15.5, h: 23, ang: -0.34, bulge: 0.62, root: 4, farX: 7.5, farA: 0.62, col: '#f2d29b', inner: '#ffc4b0' },
      tail: { c: [[-9, 1], [-19, 4], [-27, -6]], r: 7, shape: 'brush', n: 13, flat: 29, col: '#f2d29b', tip: '#4a3020', tipFrom: 0.8 },
      eye: { x: 0.3, y: -0.15, r: 2.9 }, low: '#fffaf0'
    },
    wiew: {
      n: 'Wiewiórka', names: ['Kita', 'Orzeszek', 'Basia', 'Ruda'], fav: ['orzechy', 'szyszka'], game: 'dig',
      col: '#cf5a22', head: '#cf5a22', leg: '#b84a1a', pad: '#ffc9a8', belly: '#fff1d6', bl: 34, bh: 21, legH: 7, legW: 5, bx: 2,
      nk: [0.6, -0.5], hdx: 5, hdy: -7, hr: 10.5, hw: 1, snout: { t: 'round', l: 5.5, h: 6, y: 2.5 }, nose: '#5a2a12', nr: 1.8,
      ear: { t: 'tuft', x: -2.5, y: -8, w: 8, h: 9.5, ang: -0.1, farX: 5, farA: 0.3, col: '#cf5a22', inner: '#ffc9a8' },
      tail: { c: [[-13, -4], [-23, -30], [-7, -39]], r: 10.5, shape: 'bushy', col: '#dc6a2c', n: 16, up: 52 },
      eye: { x: 0.32, y: -0.15, r: 2.9 }, low: '#fff1d6', whisk: true
    },
    borsuk: {
      n: 'Borsuk', names: ['Borys', 'Pasiak', 'Bodzio', 'Bunia'], fav: ['miod', 'grzybek'], game: 'hide',
      col: '#9da3ae', head: '#f6f6f0', leg: '#2d2d39', pad: '#8a8a98', belly: '#3a3b48', bl: 54, bh: 25, legH: 7, legW: 6.5, bx: -2,
      nk: [0.62, -0.35], hdx: 7, hdy: -5, hr: 11.5, hw: 1.05, snout: { t: 'point', l: 12, y: 3 }, nose: INK, nr: 2.6,
      ear: { t: 'round', x: -6, y: -8, w: 7.5, h: 6.5, ang: 0, farX: 5, farA: 0.1, col: '#2d2d39', inner: '#f6f6f0' },
      tail: { c: [[-4, 1], [-8, 2], [-11, 0]], r: 4.5, col: '#9da3ae', n: 6 },
      eye: { x: 0.3, y: -0.12, r: 2.4 }, ring: true, mark: 'badger'
    },
    chomik: {
      n: 'Chomik', names: ['Pucek', 'Pyzia', 'Ziarenko', 'Bąbel'], fav: ['ziarenka', 'orzechy'], game: 'wheel',
      col: '#f0b65a', head: '#f0b65a', leg: '#ffb4a8', pad: '#e97f86', belly: '#fff7ea', bigBelly: true, bl: 36, bh: 30, legH: 3, legW: 5, bx: -2,
      nk: [0.55, -0.3], neck: false, hdx: 3, hdy: -4, hr: 13, hw: 1, snout: { t: 'round', l: 5, h: 6.5, y: 2.5 }, nose: '#e57a8a', nr: 1.8,
      ear: { t: 'round', x: -4.5, y: -10, w: 8, h: 7, ang: -0.1, farX: 6, farA: 0.15, col: '#f0b65a', inner: '#ffc0b8' },
      chub: { x: 3, y: 6, r: 7.5, col: '#fff4e2' },
      eye: { x: 0.36, y: -0.18, r: 2.8 }, low: '#fff7ea', whisk: true
    },
    swinka: {
      n: 'Świnka morska', names: ['Pepa', 'Łatka', 'Kiki', 'Fasolka'], fav: ['marchewka', 'salata'], game: 'dance',
      col: '#fffaf2', head: '#fffaf2', leg: '#f2c6b8', pad: '#dc958a', belly: null, bl: 48, bh: 26, legH: 3, legW: 5.5, bx: -3,
      nk: [0.62, -0.2], neck: false, hdx: 5, hdy: -2, hr: 13, hw: 1.15, snout: { t: 'round', l: 6.5, h: 8, y: 3 }, nose: '#e58a95', nr: 1.8,
      ear: { t: 'flap', x: -4.5, y: -10, w: 10, h: 9.5, ang: -2, mir: true, lw: 1.6, farX: -4, farA: 0.3, col: '#e8a88e', inner: '#f6c2b0', front: true },
      eye: { x: 0.36, y: -0.2, r: 2.6 }, mark: 'guinea', p1: '#b9682f', p2: '#3a2a24', whisk: true
    }
  };
  // rabbit: long upright ears (a baby's flop back a bit), white puff tail, big hind feet, hops
  SP.krolik = {
    n: 'Królik', names: ['Kicek', 'Puszek', 'Śnieżka', 'Tuptuś'], fav: ['marchewka', 'salata'], game: 'dance', hops: true, twitch: true,
    col: '#a8927e', head: '#a8927e', leg: '#a8927e', pad: '#f6bcc4', belly: '#f5eee4', bl: 36, bh: 27, legH: 4, legW: 5, bx: 0, hind: true,
    nk: [0.55, -0.45], neck: false, hdx: 3, hdy: -9, hr: 11, hw: 1, snout: { t: 'round', l: 5, h: 5.5, y: 3 }, nose: '#e58a95', nr: 1.7,
    ear: { t: 'petal', x: -3.5, y: -7, w: 7.5, h: 24, ang: -0.2, farX: 4.5, farA: 0.32, col: '#a8927e', inner: '#f6bcc4', flop: -0.75 },
    puff: { r: 6.5, col: '#ffffff' },
    eye: { x: 0.28, y: -0.15, r: 2.9 }, low: '#f1e7da', whisk: true
  };
  // long-haired pale grey cat with one dark stripe from the head along the back to the tail tip
  SP.kotsz = {
    n: 'Kot szary', names: ['Szaruś', 'Popiel', 'Mruczek', 'Pręgus'], fav: ['mleko', 'ciastko'], game: 'bubbles', cat: true, fluffy: true,
    col: '#bcc0c9', head: '#bcc0c9', leg: '#bcc0c9', pad: '#f6bcc4', belly: '#e6e8ee', bl: 44, bh: 24, legH: 9, legW: 5, bx: 0,
    nk: [0.62, -0.45], hdx: 5, hdy: -8, hr: 11.5, hw: 1, snout: { t: 'round', l: 4, h: 5, y: 3.2 }, nose: '#e58a95', nr: 1.7,
    ear: { t: 'point', x: -3, y: -7, w: 9.5, h: 11, ang: -0.12, farX: 6.5, farA: 0.3, col: '#bcc0c9', inner: '#f6bcc4' },
    tail: { c: [[-9, -5], [-22, -6], [-27, -25]], r: 6.6, shape: 'plume', flat: 34, col: '#bcc0c9', n: 14, stripe: '#6b6f7b' },
    eye: { x: 0.32, y: -0.14, r: 2.8 }, iris: '#e3b23c', low: '#eceef2', whisk: true, mark: 'stripe', dark: '#6b6f7b'
  };
  // sleek flame-ginger tabby: slim, a long thin tail curling up, green eyes
  SP.kotr = {
    n: 'Kot rudy', names: ['Płomyk', 'Iskra', 'Miodek', 'Rudzia'], fav: ['mleko', 'jajko'], game: 'hide', cat: true,
    col: '#f39a3a', head: '#f39a3a', leg: '#f39a3a', pad: '#f6bcc4', belly: '#ffc98a', bl: 42, bh: 18, legH: 12, legW: 4.3, bx: 0,
    nk: [0.64, -0.45], hdx: 5, hdy: -9, hr: 10.5, hw: 1, snout: { t: 'round', l: 3.8, h: 4.6, y: 3 }, nose: '#e58a95', nr: 1.6,
    ear: { t: 'point', x: -3, y: -6.5, w: 9, h: 11, ang: -0.12, farX: 6.5, farA: 0.3, col: '#f39a3a', inner: '#f6bcc4' },
    tail: { c: [[-9, -2], [-21, -3], [-22, -27]], r: 3.5, shape: 'thin', flat: 34, col: '#f39a3a', n: 14, rings: '#c25e17' },
    eye: { x: 0.32, y: -0.14, r: 2.8 }, iris: '#5cbc4b', low: '#ffd29e', whisk: true, mark: 'tabby', dark: '#c25e17'
  };
  // a brave forest she-cat after Piaskowa Burza (Sandstorm) from "Wojownicy": pale sandy ginger with faint darker
  // stripes, cream chest, green eyes, lean and long-legged, a medium tail with soft rings
  SP.kotp = {
    n: 'Kotka piaskowa', names: ['Piaskowa Burza', 'Piaskunia', 'Burzyczka', 'Wydma'], fav: ['jajko', 'jagody'], game: 'catch', cat: true,
    col: '#e9bf86', head: '#e9bf86', leg: '#e9bf86', pad: '#f6bcc4', belly: '#fbe9cc', bl: 43, bh: 19, legH: 12.5, legW: 4.4, bx: 0,
    nk: [0.64, -0.45], hdx: 5, hdy: -9.5, hr: 10.8, hw: 1, snout: { t: 'round', l: 3.9, h: 4.6, y: 3 }, nose: '#e58a95', nr: 1.6,
    ear: { t: 'point', x: -3, y: -6.5, w: 9.5, h: 11.5, ang: -0.14, farX: 6.5, farA: 0.3, col: '#e9bf86', inner: '#f6bcc4' },
    tail: { c: [[-9, -2], [-21, -5], [-26, -24]], r: 4.6, shape: 'thin', flat: 34, col: '#e9bf86', n: 14, rings: '#d39a5a' },
    eye: { x: 0.32, y: -0.14, r: 2.8 }, iris: '#4fb35a', low: '#fbe9cc', whisk: true, mark: 'tabby', dark: '#d6a062'
  };
  var SP_ORDER = ['jez', 'lis', 'fenek', 'wiew', 'borsuk', 'chomik', 'swinka', 'krolik', 'kotsz', 'kotr', 'kotp'];
  var SP_STICKER = { jez: '🦔', lis: '🦊', fenek: '🏜️', wiew: '🐿️', borsuk: '🦡', chomik: '🐹', swinka: '🥕', krolik: '🐰', kotsz: '🐈', kotr: '🐱', kotp: '🌪️' };

  // big animals (a fox with its tail) are drawn a bit smaller at home and on the meadow, so three fit in the room
  var sizeKs = {};
  function sizeK(sp) {
    if (sizeKs[sp] == null) { var G = geo(sp, 2), H = geo('jez', 2); sizeKs[sp] = clamp(Math.pow((H.x1 - H.x0) * -H.top / ((G.x1 - G.x0) * -G.top), 0.75), 0.65, 1.12); }
    return sizeKs[sp];
  }
  function stageOf(gp) { return gp >= GROW_AT[2] ? 2 : gp >= GROW_AT[1] ? 1 : 0; }
  function lvlGp(L) { return L <= 20 ? LVL_GP[Math.max(1, L)] : LVL_GP[20] + (L - 20) * 4; }
  function levelOf(gp) { var L = 1; while (gp >= lvlGp(L + 1)) L++; return L; }
  // ready to grow: the child sees the "Urośnij!" button
  function canGrow(p) { return p.stage < 2 && levelOf(p.gp) >= GROW_LVL[p.stage]; }

  // geometry of a pet (units, feet at y=0, facing right) for drawing, hit tests and anchors
  function geo(sp, stage, pose) {
    var K = STAGES[stage | 0], P = SP[sp] || SP.jez, o;
    if (P.hog) {
      var kb = K.kb, kh = K.kh;
      o = { kb: kb, kh: kh, cx: -2 * kb, cy: -17 * kb, rx: 25 * kb, ry: 20 * kb, hx: 3 * kb + 15 * kh, hy: -14 * kb - 2 * kh, hr: 12 * kh,
        x0: -30 * kb, x1: 3 * kb + 30 * kh, top: Math.min(-45 * kb, -14 * kb - 14 * kh), back: { x: -4 * kb, y: -44 * kb },
        mouth: { x: 3 * kb + 25 * kh, y: -14 * kb + 6 * kh } };
      if (pose === 'belly') {
        // drawHogBelly: feet up, the front face (with its crown of spines) beside the tummy
        o.hx = 19 * kb + 5 * kh; o.hy = -11.5 * kh; o.rot = FRONT_ROT; o.hr = 11 * kh;
        o.top = Math.min(-43 * kb, o.hy - 17 * kh) - 1; o.x1 = o.hx + 18 * kh;
        o.mouth = { x: o.hx - 7 * kh * Math.sin(FRONT_ROT), y: o.hy + 7 * kh * Math.cos(FRONT_ROT) };
      }
      return o;
    }
    var kb2 = K.kb, kh2 = K.kh, rx = P.bl / 2 * kb2, ry = P.bh / 2 * kb2, legH = P.legH * K.kl;
    if (pose === 'sleep') legH = Math.min(legH, 1.5);
    var cx = P.bx * kb2, cy = -(legH + ry);
    var nx = cx + rx * P.nk[0], ny = cy + ry * P.nk[1];
    var hx = nx + P.hdx * kh2, hy = ny + P.hdy * kh2;
    if (pose === 'sleep') { hy += P.hr * kh2 * 0.3; hx += 1; }
    var s = P.snout, tipX = s.t === 'point' ? P.hr * P.hw * 0.8 + s.l : P.hr * 0.55 + s.l;
    var mx = s.t === 'point' ? tipX - s.l * 0.45 : P.hr * 0.55 + s.l * 0.5, my = s.t === 'point' ? s.y + 3.6 : s.y + s.h * 0.75;
    o = { kb: kb2, kh: kh2, cx: cx, cy: cy, rx: rx, ry: ry, nx: nx, ny: ny, hx: hx, hy: hy, hr: P.hr * kh2, legH: legH,
      tipX: tipX, mx: mx, my: my, rot: 0,
      x0: cx - rx - 3,
      x1: hx + tipX * kh2 + 2,
      top: Math.min(hy - (P.hr + P.ear.h * 0.8 - P.ear.y * 0.15) * kh2, hy + kh2 * (P.ear.y - P.ear.h * Math.cos(P.ear.ang + earFlop(P, stage))) - 2.5),
      back: { x: cx - rx * 0.05, y: cy - ry * 0.98 },
      mouth: { x: hx + mx * kh2, y: hy + my * kh2 } };
    if (pose === 'belly') {
      // lying on its back: drawBellyUp draws exactly this geometry
      var bry = ry * 0.92, rot = BELLY_ROT, ll = Math.max(6 * kb2 + 3, legH * 0.8 + 3);
      o.cx = 0; o.ry = bry; o.cy = -bry * 0.98; o.hx = rx * 0.92; o.hy = o.cy - bry * 0.35; o.rot = rot; o.ll = ll;
      var ex = P.ear.x, ey = P.ear.y - P.ear.h;
      o.top = Math.min(o.cy - bry - ll - 3, o.hy + kh2 * (Math.sin(rot) * ex + Math.cos(rot) * ey) - 3, o.hy - P.hr * kh2 - 2);
      o.x1 = o.hx + kh2 * (tipX * Math.cos(rot) + 2) + 2;
      o.x0 = -rx - 3;
      var fr = FRONT_ROT, fc = Math.cos(fr), fs = Math.sin(fr), fe = frontEar(P, stage), er = fe.t === 'round' ? fe.h * 0.95 : fe.t === 'tuft' ? fe.h + 4 : fe.h;
      o.rot = fr; o.hx = rx * 0.9 + P.hr * kh2 * 0.45; o.hy = -P.hr * 1.0 * kh2;
      o.top = Math.min(o.cy - bry - ll - (P.legH < 6 ? 3 : P.legW * Math.max(0.75, kb2) * 0.8 + 2.2), o.hy - P.hr * P.hw * 1.1 * kh2 - 2); o.x1 = o.hx + kh2 * P.hr * 1.05 + 3;   // raised legs end in a round paw
      [-1, 1].forEach(function (sd) {   // both ear tips (mirrored, plus the lean), turned with the head
        var a = sd * fe.ang + (fe.lean || 0), ex2 = sd * fe.x + er * Math.sin(a), ey2 = fe.y - er * Math.cos(a);
        o.top = Math.min(o.top, o.hy + kh2 * (ex2 * fs + ey2 * fc) - 3); o.x1 = Math.max(o.x1, o.hx + kh2 * (ex2 * fc - ey2 * fs) + 3);
      });
      o.mouth = { x: o.hx - kh2 * P.hr * 0.64 * fs, y: o.hy + kh2 * P.hr * 0.64 * fc };   // frontFace: my + 0.24 r
    }
    if (P.puff) {
      o.puff = pose === 'belly' ? { x: o.cx - rx * 0.92, y: o.cy + o.ry * 0.25 } : { x: cx - rx * 0.98, y: cy - ry * 0.12 };
      o.x0 = Math.min(o.x0, o.puff.x - P.puff.r * kb2 * 1.15 - 3);
    }
    if (P.tail) {
      // the tail's real extent (a bushy squirrel tail curls far up and back)
      o.tailBase = pose === 'belly' ? { x: o.cx - rx * 0.9, y: o.cy + o.ry * 0.35 } : P.tail.low ? { x: cx - rx * 0.8, y: cy + ry * 0.35 } : { x: cx - rx * 0.9, y: cy - ry * 0.1 };
      tailPts(P, o, {}, o.tailBase, pose === 'belly').forEach(function (q) { o.x0 = Math.min(o.x0, q.x - q.r * 1.3 - 2.5); o.top = Math.min(o.top, q.y - q.r * 1.3 - 2.5); });
    }
    return o;
  }
  var BELLY_ROT = -0.55;
  function earFlop(P, stage) { return P.ear.flop ? P.ear.flop * [1, 0.35, 0][stage | 0] : 0; }

  // ---------- hedgehog (the Jeżyk w biegu drawing, split into body + face so the young get a big face) ----------
  var APPLE_SPOTS = [262, 236, 290, 212, 316, 249, 276, 224, 303, 196, 256, 284];
  var DIRT = [[-12, -24, 3.4], [6, -9, 2.6], [-6, -5, 2.4], [2, -34, 3], [-20, -20, 2.2], [-17, -13, 2.8]];
  function hogBody(g, st) {
    var wear = st.wear || {}, t = st.t || 0, lp = Math.sin(st.legs || 0) * 4;
    g.fillStyle = '#5a3a22';
    if (st.pose !== 'sleep') {
      g.beginPath(); g.ellipse(-8 + lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
      g.beginPath(); g.ellipse(10 - lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    }
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
    var nd = Math.round((st.dirt || 0) * DIRT.length);
    for (var m = 0; m < nd; m++) {
      var dp = DIRT[m];
      g.beginPath(); g.ellipse(dp[0], dp[1], dp[2] * 1.3, dp[2], 0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(110,84,52,.75)'; g.fill();
    }
  }
  function hogFacePath(g) {
    g.moveTo(3, -22); g.quadraticCurveTo(14, -27, 22, -18); g.quadraticCurveTo(28, -15, 32, -12);
    g.quadraticCurveTo(28, -7, 20, -6); g.quadraticCurveTo(10, -2, 3, -6); g.quadraticCurveTo(-1, -14, 3, -22); g.closePath();
  }
  function hogFace(g, st, eK) {
    var wear = st.wear || {}, eye = st.eye || 'open', t = st.t || 0;
    g.beginPath(); g.arc(8, -24, 4, 0, Math.PI * 2); g.fillStyle = '#e4b98a'; g.fill(); outline(g, 1.6);
    g.beginPath(); hogFacePath(g); g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 2);
    g.beginPath(); g.arc(31.5, -12.5, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    var blush = eye === 'happy' || eye === 'purr';
    g.beginPath(); g.arc(18, -10, blush ? 3.4 : 2.8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,' + (blush ? 0.65 : 0.45) + ')'; g.fill();
    if (wear.neck === 'szalik') { g.save(); g.translate(4, -12); g.rotate(-0.25); WEAR.szalik(g); g.restore(); }
    g.save(); g.translate(16.5, -16.5); g.scale(eK, eK);
    drawEye(g, 0, 0, 2.6, eye, isBlink(st), false);
    g.restore();
    drawMouth(g, 26.3, -8.6, st.mouth, 1);
    if (wear.eyes === 'okulary' && eye !== 'closed' && st.pose !== 'belly') { var ge = 1 + 0.3 * (eK - 1); g.save(); g.translate(16.5, -16.5); g.scale(ge, ge); WEAR.okulary(g); g.restore(); }
    if (st.carry) { g.save(); g.translate(31, -6); THING.pilka(g, 4.2); g.restore(); }
  }
  function hogBlanket(g) {
    function sh() { g.beginPath(); g.moveTo(-26, -2); g.quadraticCurveTo(-30, -30, -6, -40); g.quadraticCurveTo(10, -42, 12, -26); g.quadraticCurveTo(14, -10, 10, 0); g.closePath(); }
    sh(); g.fillStyle = '#9fd0f5'; g.fill(); outline(g, 2);
    g.save(); g.clip();
    g.fillStyle = '#ffd6ec'; for (var qx = -30; qx < 16; qx += 12) for (var qy = -44; qy < 2; qy += 12) if (((qx + qy) / 12 | 0) % 2 === 0) g.fillRect(qx, qy, 12, 12);
    g.restore();
    sh(); outline(g, 2);
  }
  function hogHat(g, wear) {
    if (wear.head === 'kokardka') { g.translate(4, -31); g.rotate(-0.15); }
    else { g.translate(10, -30); g.rotate(0.32); }
    WEAR[wear.head](g);
  }
  function drawHog(g, st) {
    var K = STAGES[st.stage | 0], wear = st.wear || {};
    function F() { g.translate(3 * K.kb, -14 * K.kb); g.scale(K.kh, K.kh); g.translate(-3, 14); }
    if (st.pose === 'ball') { g.save(); g.scale(K.kb, K.kb); drawBall(g, st.t * 6); g.restore(); return; }
    if (st.pose === 'belly') { drawHogBelly(g, st, K); return; }
    g.save(); g.scale(K.kb, K.kb); hogBody(g, st); g.restore();
    g.save(); F(); hogFace(g, st, K.ke / K.kh); g.restore();
    if (st.pose === 'sleep') { g.save(); g.scale(K.kb, K.kb); hogBlanket(g); g.restore(); }
    if (wear.head && st.pose !== 'sleep') { g.save(); F(); hogHat(g, wear); g.restore(); }
    if (st.basket != null) drawBackBasket(g, -4 * K.kb, -40 * K.kb, 0, K.kb);
  }
  // lying on its back: spines on the floor, the soft belly up, little feet in the air
  function drawHogBelly(g, st, K) {
    var t = st.t || 0, w = Math.sin(t * 10) * 2.5;
    g.save(); g.scale(K.kb, K.kb);
    var cx = 0, cy = -18, N = 12;
    // feet up
    g.fillStyle = '#5a3a22';
    [[-12, -1], [-4, 1], [5, -1], [13, 1]].forEach(function (f, i) {
      g.beginPath(); g.ellipse(f[0] + (i % 2 ? w : -w) * 0.6, -36 + f[1] * 2, 3.6, 5, (i - 1.5) * 0.25, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    });
    g.beginPath();
    for (var i = 0; i <= N * 2; i++) {
      var a = 0.05 * Math.PI + 0.9 * Math.PI * i / (N * 2), r = i % 2 ? 22 : 16;
      g.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r);
    }
    g.closePath(); g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2.2);
    g.beginPath(); g.ellipse(cx, cy - 2, 22, 13, 0, 0, Math.PI * 2); g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 2.2);
    g.beginPath(); g.ellipse(cx - 2, cy - 5, 14, 7, 0, 0, Math.PI * 2); g.fillStyle = '#ffe2bd'; g.fill();
    g.restore();
    g.save(); g.translate(19 * K.kb + 5 * K.kh, -11.5 * K.kh); g.rotate(FRONT_ROT); g.scale(K.kh, K.kh);
    // a crown of spines around the top of the face, so the head belongs to the spiny body
    g.beginPath();
    for (var j = 0; j <= 14; j++) { var b = Math.PI * (0.9 + 1.2 * j / 14), br = j % 2 ? 16.5 : 10.5; g.lineTo(Math.cos(b) * br, Math.sin(b) * br); }
    g.closePath(); g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2);
    frontEars(g, frontEar(HOG_FRONT, 0));
    g.beginPath(); headShapeFront(g, HOG_FRONT); g.fillStyle = HOG_FRONT.head; g.fill(); outline(g, 2.2);
    frontFace(g, HOG_FRONT, { t: t, eye: 'happy', mouth: 'open', seed: st.seed }, K.ke / K.kh);
    g.restore();
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

  // ---------- shared face parts ----------
  function isBlink(st) { var p = (st.t || 0) + (st.seed || 0) * 1.7; return (p % 3.6) > 3.45; }
  function drawEye(g, x, y, r, mode, blink, ring, iris) {
    var lw = Math.max(1.3, r * 0.68);
    if (mode === 'open' || mode === 'sad' || !mode) {
      if (blink) { g.beginPath(); g.moveTo(x - r * 0.95, y); g.quadraticCurveTo(x, y + r * 0.6, x + r * 0.95, y); outline(g, lw); }
      else {
        if (ring) { g.beginPath(); g.arc(x, y, r * 1.45, 0, Math.PI * 2); g.fillStyle = '#fbfbf6'; g.fill(); }
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        if (iris) {   // cat eyes: coloured iris, tall pupil
          g.beginPath(); g.arc(x, y, r * 0.78, 0, Math.PI * 2); g.fillStyle = iris; g.fill();
          g.beginPath(); g.ellipse(x + r * 0.05, y, r * 0.32, r * 0.62, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        }
        g.beginPath(); g.arc(x + r * 0.3, y - r * 0.35, r * 0.36, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        g.beginPath(); g.arc(x - r * 0.32, y + r * 0.35, r * 0.15, 0, Math.PI * 2); g.fill();
      }
      if (mode === 'sad') { g.beginPath(); g.moveTo(x - r * 1.15, y - r * 1.45); g.lineTo(x + r * 1.15, y - r * 2.3); outline(g, lw * 0.85); }
    } else if (mode === 'happy') {
      g.beginPath(); g.moveTo(x - r * 0.95, y + r * 0.35); g.quadraticCurveTo(x, y - r * 1.25, x + r * 0.95, y + r * 0.35); outline(g, lw);
    } else if (mode === 'tired') {
      // half-closed: the lower half of the eye under a heavy, slightly drooping lid
      if (blink) { g.beginPath(); g.moveTo(x - r * 0.95, y); g.quadraticCurveTo(x, y + r * 0.6, x + r * 0.95, y); outline(g, lw); }
      else {
        g.beginPath(); g.moveTo(x - r, y - r * 0.05); g.arc(x, y - r * 0.05, r, Math.PI, 0, true); g.closePath(); g.fillStyle = iris || INK; g.fill();
        if (iris) { g.beginPath(); g.ellipse(x + r * 0.05, y + r * 0.25, r * 0.3, r * 0.5, 0, 0, Math.PI); g.fillStyle = INK; g.fill(); }
        g.beginPath(); g.arc(x - r * 0.3, y + r * 0.4, r * 0.15, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        g.beginPath(); g.moveTo(x - r * 1.15, y - r * 0.2); g.quadraticCurveTo(x, y - r * 0.45, x + r * 1.15, y + r * 0.05); outline(g, lw);
      }
    } else if (mode === 'purr') {
      g.beginPath(); g.moveTo(x - r * 0.95, y - r * 0.1); g.quadraticCurveTo(x, y - r * 0.75, x + r * 0.95, y - r * 0.1); outline(g, lw);
    } else {
      g.beginPath(); g.moveTo(x - r * 0.95, y); g.quadraticCurveTo(x, y + r * 0.8, x + r * 0.95, y); outline(g, lw);
    }
  }
  function drawMouth(g, x, y, mouth, s) {
    s = s || 1;
    if (mouth === 'open' || mouth === 'giggle') {
      g.beginPath(); g.ellipse(x, y + 0.4 * s, 2.4 * s, (mouth === 'giggle' ? 2.6 : 2.1) * s, 0, 0, Math.PI * 2); g.fillStyle = '#b8352a'; g.fill(); outline(g, 1.3);
      g.beginPath(); g.ellipse(x, y + 1.4 * s, 1.3 * s, 0.8 * s, 0, 0, Math.PI * 2); g.fillStyle = '#ff8ca0'; g.fill();
    } else if (mouth === 'frown') {
      g.beginPath(); g.moveTo(x - 2.3 * s, y + 1 * s); g.quadraticCurveTo(x, y - 1 * s, x + 2.3 * s, y + 1 * s); outline(g, 1.4);
    } else if (mouth === 'chew') {
      g.beginPath(); g.moveTo(x - 2.2 * s, y); g.lineTo(x + 2.2 * s, y); outline(g, 1.4);
    } else {
      g.beginPath(); g.moveTo(x - 2.4 * s, y - 0.4 * s); g.quadraticCurveTo(x, y + 1.6 * s, x + 2.4 * s, y - 0.4 * s); outline(g, 1.4);
    }
  }
  function drawBackBasket(g, x, y, rot, k) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(k || 1, k || 1);
    g.beginPath(); g.moveTo(-11, -6); g.lineTo(11, -6); g.lineTo(8, 5); g.lineTo(-8, 5); g.closePath();
    g.fillStyle = '#c98f5a'; g.fill(); outline(g, 1.8);
    g.beginPath(); g.moveTo(-10, -2); g.lineTo(10, -2); g.moveTo(-9, 1.5); g.lineTo(9, 1.5); g.strokeStyle = '#8a5a33'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }

  // ---------- the parametric drawer ----------
  function earShape(g, e) {
    if (e.t === 'round') { g.moveTo(e.w / 2, -e.h * 0.45); g.arc(0, -e.h * 0.45, e.w / 2, 0, Math.PI * 2); }
    else if (e.t === 'petal') { g.moveTo(e.w / 2, -e.h * 0.5); g.ellipse(0, -e.h * 0.5, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); }
    else if (e.t === 'flap') {
      // a guinea pig's soft ear: a rounded flap whose tip droops to one side
      var m = e.mir ? -1 : 1, w = e.w, h = e.h;
      g.moveTo(m * w * 0.4, 0); g.bezierCurveTo(m * w * 0.62, -h * 0.45, m * w * 0.38, -h, -m * w * 0.08, -h);
      g.bezierCurveTo(-m * w * 0.62, -h, -m * w * 0.8, -h * 0.42, -m * w * 0.52, -h * 0.08); g.quadraticCurveTo(-m * w * 0.3, h * 0.12, m * w * 0.4, 0); g.closePath();
    }
    else {
      // a leaf: rounded sides, a soft tip, and a base that sinks into the head so no flat edge shows
      var b = e.bulge == null ? 0.3 : e.bulge, d = e.root == null ? 3 : e.root;
      g.moveTo(-e.w / 2, d);
      g.bezierCurveTo(-e.w * (0.5 + b * 0.4), -e.h * 0.35, -e.w * b * 0.55, -e.h * 0.88, 0, -e.h);
      g.bezierCurveTo(e.w * b * 0.55, -e.h * 0.88, e.w * (0.5 + b * 0.4), -e.h * 0.35, e.w / 2, d);
      g.closePath();
    }
  }
  // the far ear sits a little further forward and leans forward; the near one leans back (a soft V)
  function drawEar(g, e, far, rot) {
    var fx = e.farX == null ? e.w * 0.5 : e.farX, fa = e.farA == null ? 0.3 : e.farA;
    g.save(); g.translate(e.x + (far ? fx : 0), e.y + (far ? 0.8 : 0)); g.rotate(e.ang + rot + (far ? fa : 0));
    if (far) g.scale(0.94, 0.94);
    g.beginPath(); earShape(g, e); g.fillStyle = far ? shade(e.col, 0.86) : e.col; g.fill();
    g.save(); g.clip();
    if (e.tip) { g.fillStyle = far ? shade(e.tip, 0.9) : e.tip; g.fillRect(-e.w, -e.h * 1.2, e.w * 2, e.h * 0.55); }
    if (!e.noIn && (!far || e.t === 'point')) {
      g.save(); g.translate(0, e.t === 'round' ? -e.h * 0.4 : e.t === 'point' ? -e.h * 0.16 : -e.h * 0.25); g.scale(e.t === 'point' ? 0.56 : 0.55, e.t === 'point' ? (e.tip ? 0.56 : 0.66) : 0.62);
      g.beginPath(); earShape(g, e); g.fillStyle = far ? shade(e.inner, 0.93) : e.inner; g.fill(); g.restore();
    }
    g.restore();
    g.beginPath(); earShape(g, e); outline(g, e.lw || 2);
    if (e.t === 'flap' && !far) { var fm = e.mir ? -1 : 1; g.beginPath(); g.moveTo(fm * e.w * 0.3, -e.h * 0.1); g.quadraticCurveTo(-fm * e.w * 0.05, -e.h * 0.45, -fm * e.w * 0.42, -e.h * 0.3); g.strokeStyle = 'rgba(29,47,111,.4)'; g.lineWidth = 1.2; g.stroke(); }
    if (e.t === 'tuft') {
      g.beginPath(); g.moveTo(-1.8, -e.h + 2.5); g.quadraticCurveTo(-2.6, -e.h - 2, -0.6, -e.h - 4.2); g.quadraticCurveTo(0.2, -e.h - 1.5, 1.8, -e.h - 3.2); g.quadraticCurveTo(1.6, -e.h, 1.6, -e.h + 2.5); g.closePath();
      g.fillStyle = shade(e.col, 0.82); g.fill(); outline(g, 1.4);
    }
    g.restore();
  }
  // tail thickness along its length (0 = at the body, 1 = the tip), per kind of tail
  function tailR(shape, t) {
    if (shape === 'brush') return t < 0.62 ? 0.34 + 0.66 * Math.sin(t / 0.62 * Math.PI / 2) : 0.3 + 0.7 * Math.cos((t - 0.62) / 0.38 * Math.PI / 2);
    if (shape === 'plume') return t < 0.7 ? 0.45 + 0.55 * Math.sin(t / 0.7 * Math.PI / 2) : 0.62 + 0.38 * Math.cos((t - 0.7) / 0.3 * Math.PI / 2);
    if (shape === 'thin') return 1 - 0.18 * t;
    if (shape === 'bushy') return t < 0.6 ? 0.42 + 0.58 * Math.sin(t / 0.6 * Math.PI / 2) : 0.7 + 0.3 * Math.cos((t - 0.6) / 0.4 * Math.PI / 2);
    var r = 0.4 + 0.6 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2);
    return t > 0.88 ? r * (1 - (t - 0.88) * 2) : r;
  }
  function tailPts(P, G, st, base, flat) {
    var T = P.tail, n = T.n || 11, k = Math.pow(G.kb, 0.8), out = [];
    var wag = st.wag || 0, a = Math.sin((st.t || 0) * (2 + 12 * wag) + (st.seed || 0)) * (0.06 + 0.16 * wag), ca = Math.cos(a), sa = Math.sin(a);
    var C = T.c;
    if (flat) {
      // lying on its back: the tail lies flat on the floor, stretched out behind
      var len = T.up ? 36 : Math.max(Math.abs(C[1][0]), Math.abs(C[2][0]), T.flat || 0);
      C = [[-len * 0.35, 1.5], [-len * 0.7, 2.5], [-len, 0.5]];
    }
    function rp(p) { var x = p[0] * k, y = p[1] * k; return [x * ca - y * sa, x * sa + y * ca]; }
    var c1 = rp(C[0]), c2 = rp(C[1]), c3 = rp(C[2]);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), u = 1 - t;
      var x = 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * c3[0];
      var y = 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * c3[1];
      out.push({ x: base.x + x, y: base.y + y, r: T.r * k * tailR(T.shape, t), tip: T.tip && t >= T.tipFrom });
    }
    return out;
  }
  // one smooth outline around the tail's spine (instead of a chain of circles)
  function tailPath(g, P, pts) {
    var n = pts.length, L = [], R = [], i;
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, p = pts[i];
      L.push([p.x - dy / d * p.r, p.y + dx / d * p.r]); R.push([p.x + dy / d * p.r, p.y - dx / d * p.r]);
    }
    var e = pts[n - 1], q = pts[n - 2], ex = e.x - q.x, ey = e.y - q.y, ed = Math.hypot(ex, ey) || 1, tk = P.tail.shape === 'brush' ? 1.5 : 1.05;
    var poly = L.concat([[e.x + ex / ed * e.r * tk, e.y + ey / ed * e.r * tk]], R.reverse()), m = poly.length;
    g.moveTo((poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[1][1]) / 2);
    for (i = 1; i <= m; i++) { var c = poly[i % m], nx = poly[(i + 1) % m]; g.quadraticCurveTo(c[0], c[1], (c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2); }
    g.closePath();
  }
  function drawTail(g, P, pts) {
    var T = P.tail;
    g.beginPath(); tailPath(g, P, pts);
    g.lineWidth = 4.2; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); g.fillStyle = T.col; g.fill();
    g.save(); g.clip();
    if (T.tip) { g.beginPath(); pts.forEach(function (p) { if (p.tip) { g.moveTo(p.x + p.r * 1.3, p.y); g.arc(p.x, p.y, p.r * 1.3, 0, Math.PI * 2); } }); g.fillStyle = T.tip; g.fill(); }
    if (T.stripe || T.rings) {
      g.beginPath();
      if (T.stripe) { pts.forEach(function (p, j) { if (j) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.lineWidth = T.r * 0.5 * Math.max(0.6, pts[Math.floor(pts.length / 2)].r / T.r); g.strokeStyle = T.stripe; }
      else {
        for (var q = 2; q < pts.length - 1; q += 2) { var a = pts[q - 1], b = pts[q + 1], nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1; g.moveTo(pts[q].x + nx / nl * pts[q].r * 1.2, pts[q].y + ny / nl * pts[q].r * 1.2); g.lineTo(pts[q].x - nx / nl * pts[q].r * 1.2, pts[q].y - ny / nl * pts[q].r * 1.2); }
        g.lineWidth = T.r * 0.5; g.strokeStyle = T.rings;
      }
      g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
    }
    g.restore();
    if (T.shape !== 'thin') {
      // a few fur strokes that follow the tail
      g.beginPath();
      for (var i = 2; i < pts.length - 2; i += 3) { var p = pts[i], n2 = pts[i + 1], ux = n2.x - p.x, uy = n2.y - p.y, ul = Math.hypot(ux, uy) || 1; g.moveTo(p.x - ux / ul * p.r * 0.3, p.y - uy / ul * p.r * 0.3); g.lineTo(p.x + ux / ul * p.r * 0.3, p.y + uy / ul * p.r * 0.3); }
      g.strokeStyle = 'rgba(29,47,111,.22)'; g.lineWidth = 1.2; g.lineCap = 'round'; g.stroke();
    }
  }
  // a limb with a paw: o.paw 1 = a foot on the floor pointing forward, 2 = a round paw in the air;
  // o.bend bows the limb backwards (a hind leg), o.sock paints the lower half and the paw
  function leg(g, x0, y0, x1, y1, w, col, o) {
    o = o || {};
    var mx = (x0 + x1) / 2 - (o.bend || 0), my = (y0 + y1) / 2, pw = o.paw || 0;
    function limb(half) {
      g.beginPath();
      if (!half) { g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); }
      else { g.moveTo(0.25 * x0 + 0.5 * mx + 0.25 * x1, 0.25 * y0 + 0.5 * my + 0.25 * y1); g.quadraticCurveTo((mx + x1) / 2, (my + y1) / 2, x1, y1); }
    }
    function paw() {
      g.beginPath();
      if (pw === 1) g.ellipse(x1 + w * 0.42, y1 + w * 0.02, w * 0.86, w * 0.52, 0, 0, Math.PI * 2);
      else g.ellipse(x1, y1, w * 0.7, w * 0.78, Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2, 0, Math.PI * 2);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    limb(); g.lineWidth = w + 3.6; g.strokeStyle = INK; g.stroke();
    if (pw) { paw(); g.lineWidth = 3.6; g.strokeStyle = INK; g.stroke(); }
    limb(); g.lineWidth = w; g.strokeStyle = col; g.stroke();
    if (o.sock) { limb(1); g.strokeStyle = o.sock; g.stroke(); }
    if (pw) { paw(); g.fillStyle = o.sock || col; g.fill(); }
    if (pw === 2 && o.pad) { g.beginPath(); g.arc(x1, y1, w * 0.36, 0, Math.PI * 2); g.fillStyle = o.pad; g.fill(); }
  }
  // a soft rounded lobe of fur between two points on an outline (k: how far it bulges, along the normal)
  function tuft(g, ax, ay, bx, by, k) {
    var dx = bx - ax, dy = by - ay, nx = -dy * k, ny = dx * k;
    g.moveTo(ax, ay); g.bezierCurveTo(ax + nx * 1.2 + dx * 0.1, ay + ny * 1.2 + dy * 0.1, bx + nx * 1.1 + dx * 0.1, by + ny * 1.1 + dy * 0.1, bx, by);
  }
  // ---------- belly-up: the pet rolls its head to look at you, so the face is drawn from the front ----------
  var FRONT_ROT = 0.3;   // the head is lifted towards you, tilted a little away from the paws
  var HOG_FRONT = { hr: 11, hw: 1, head: '#f0cf9f', low: '#f8e2bf', nose: INK, nr: 2.6, snout: { t: 'point' }, eye: { r: 2.6 },
    ear: { t: 'round', x: 0, y: -8, w: 7.5, h: 6.5, ang: 0, col: '#e4b98a', inner: '#f6dcb8' } };
  function frontEar(P, stage) {
    var e = P.ear, r = P.hr, o = {}; for (var k in e) o[k] = e[k];
    if (e.t === 'round') { o.x = r * 0.66; o.y = -r * 0.6; o.ang = 0.5; }
    else if (e.t === 'flap') { o.x = r * P.hw * 0.65; o.y = -r * 0.7; o.ang = 1.1; o.h = e.h * 1.15; o.mir = true; }
    else if (e.t === 'petal') { o.x = r * 0.3; o.y = -r * 0.72; o.ang = 0.22 + Math.abs(earFlop(P, stage)) * 0.6; o.lean = -FRONT_ROT * 0.8; }   // long ears hang with gravity, not with the tilted head
    else { o.x = r * 0.5; o.y = -r * 0.6; o.ang = e.w > 13 ? 0.55 : 0.32; }
    return o;
  }
  function frontEars(g, fe) { [-1, 1].forEach(function (s) { g.save(); g.scale(s, 1); drawEar(g, fe, false, s * (fe.lean || 0)); g.restore(); }); }
  function headShapeFront(g, P) {
    var rx = P.hr * P.hw * 1.06, ry = P.hr * 0.96;
    g.moveTo(rx, 0); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    if (P.chub) [-1, 1].forEach(function (s) { g.moveTo(s * rx * 0.58 + P.chub.r * 0.85, ry * 0.42); g.arc(s * rx * 0.58, ry * 0.42, P.chub.r * 0.85, 0, Math.PI * 2); });
    // long-haired: soft fluffy cheeks, part of the outline
    if (P.fluffy) [-1, 1].forEach(function (s) { for (var i = 0; i < 2; i++) { var a = 0.15 + i * 0.5, b = a + 0.5; tuft(g, s * Math.cos(a) * rx * 0.97, Math.sin(a) * ry * 0.97, s * Math.cos(b) * rx * 0.97, Math.sin(b) * ry * 0.97, -0.24 * s); } });
  }
  function frontFace(g, P, st, eyeK) {
    var r = P.hr, rx = r * P.hw * 1.06, ry = r * 0.96, eye = st.eye || 'open', pt = P.snout.t === 'point', my = r * 0.4;
    eyeK = Math.min(eyeK, 1.3);   // two big baby eyes side by side would collide
    g.save(); g.beginPath(); headShapeFront(g, P); g.clip();
    if (P.low) { g.beginPath(); g.ellipse(0, r * 0.66, rx * 0.98, r * 0.56, 0, 0, Math.PI * 2); g.fillStyle = P.low; g.fill(); }
    if (P.mark === 'badger') {
      g.beginPath();
      [-1, 1].forEach(function (s) { g.moveTo(s * r * 0.14, r * 0.3); g.quadraticCurveTo(s * r * 0.2, -r * 0.5, s * r * 0.32, -r * 1.1); g.lineTo(s * r * 0.92, -r * 1.1); g.quadraticCurveTo(s * r * 0.85, -r * 0.1, s * r * 0.4, r * 0.38); g.closePath(); });
      g.fillStyle = '#2d2d39'; g.fill();
    }
    if (P.mark === 'guinea') { g.beginPath(); g.arc(-r * 0.55, -r * 0.3, r * 0.82, 0, Math.PI * 2); g.fillStyle = P.p1; g.fill(); }
    if (P.mark === 'stripe') { g.beginPath(); g.ellipse(0, -r * 0.88, r * 0.5, r * 0.34, 0, 0, Math.PI * 2); g.fillStyle = P.dark; g.fill(); }
    if (P.mark === 'tabby') {
      g.beginPath();
      [-0.24, 0, 0.24].forEach(function (f) { g.moveTo(f * r, -r * 0.96); g.lineTo(f * r * 0.7, -r * 0.6); });
      [-1, 1].forEach(function (s) { g.moveTo(s * r * 1.05, r * 0.02); g.lineTo(s * r * 0.7, r * 0.1); g.moveTo(s * r * 1.0, r * 0.3); g.lineTo(s * r * 0.72, r * 0.3); });
      g.strokeStyle = P.dark; g.lineWidth = r * 0.13; g.lineCap = 'round'; g.stroke();
    }
    g.restore();
    if (P.chub) [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * rx * 0.58, ry * 0.42, P.chub.r * 0.85, 0, Math.PI * 2); g.fillStyle = P.chub.col; g.fill(); });
    // blush, eyes, then a small muzzle low on the face: nose on top, mouth under it, whiskers to the sides (kept apart so a baby's face stays clear)
    var blush = eye === 'happy' || eye === 'purr';
    [-1, 1].forEach(function (s) {
      g.beginPath(); g.arc(s * r * 0.7, r * 0.3, r * 0.17, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,' + (blush ? 0.6 : 0.38) + ')'; g.fill();
      drawEye(g, s * r * 0.42, -r * 0.12, P.eye.r * eyeK, eye, isBlink(st), P.ring, P.iris);
    });
    g.beginPath(); g.ellipse(0, my + r * 0.08, r * (pt ? 0.42 : 0.38), r * (pt ? 0.34 : 0.3), 0, 0, Math.PI * 2); g.fillStyle = P.low || shade(P.head, 1.12); g.fill();
    var ny = my - r * 0.12, nr = P.nr * 0.85;
    if (pt) { g.beginPath(); g.ellipse(0, ny, nr * 1.25, nr * 0.95, 0, 0, Math.PI * 2); g.fillStyle = P.nose; g.fill(); }
    else { g.beginPath(); g.moveTo(-nr, ny - nr * 0.6); g.lineTo(nr, ny - nr * 0.6); g.lineTo(0, ny + nr * 0.8); g.closePath(); g.fillStyle = P.nose; g.fill(); outline(g, 1); }
    drawMouth(g, 0, my + r * 0.24, st.mouth, r / 14);
    if (P.whisk) {
      g.beginPath();
      [-1, 1].forEach(function (s) { var wx = s * r * 0.42, wy = my + r * 0.12; g.moveTo(wx, wy); g.lineTo(wx + s * r * 0.55, wy - r * 0.08); g.moveTo(wx, wy + r * 0.1); g.lineTo(wx + s * r * 0.55, wy + r * 0.2); });
      g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 0.9; g.stroke();
    }
  }
  function headShape(g, P) {
    var r = P.hr, s = P.snout;
    g.moveTo(r * P.hw, 0); g.ellipse(0, 0, r * P.hw, r, 0, 0, Math.PI * 2);
    if (s.t === 'point') {
      g.moveTo(r * 0.1, -r * 0.55); g.quadraticCurveTo(r * 0.85, -r * 0.5 + s.y * 0.3, r * P.hw * 0.8 + s.l, s.y);
      g.quadraticCurveTo(r * 0.8 + s.l * 0.4, r * 0.55 + s.y * 0.4, r * 0.05, r * 0.7); g.closePath();
    } else { g.moveTo(r * 0.55 + s.l, s.y); g.ellipse(r * 0.55, s.y, s.l, s.h, 0, 0, Math.PI * 2); }
    if (P.chub) { g.moveTo(P.chub.x + P.chub.r, P.chub.y); g.arc(P.chub.x, P.chub.y, P.chub.r, 0, Math.PI * 2); }
  }
  function drawPuff(g, P, G) {
    var c = G.puff, r = P.puff.r * Math.max(0.75, G.kb);
    g.beginPath();
    for (var i = 0; i <= 18; i++) { var a = i / 18 * Math.PI * 2, rr2 = r * (i % 2 ? 0.88 : 1.08); if (i) g.lineTo(c.x + Math.cos(a) * rr2, c.y + Math.sin(a) * rr2); else g.moveTo(c.x + rr2, c.y); }
    g.closePath(); g.fillStyle = P.puff.col; g.fill(); outline(g, 2);
  }
  function headFeatures(g, P, G, st, eyeK) {
    var r = P.hr, s = P.snout, eye = st.eye || 'open';
    // markings (clipped to the head)
    g.save(); g.beginPath(); headShape(g, P); g.clip();
    if (P.low) { g.beginPath(); g.ellipse(r * 0.75, r * 0.8, r * 1.15, r * 0.52, -0.12, 0, Math.PI * 2); g.fillStyle = P.low; g.fill(); }
    if (P.mark === 'badger') {
      g.beginPath(); g.moveTo(-r * 1.2, -r * 0.62); g.quadraticCurveTo(-r * 0.2, -r * 0.75, r * 0.5, -r * 0.42); g.lineTo(G.tipX - 3, s.y - 1.2);
      g.lineTo(G.tipX - 4, s.y + 1.6); g.quadraticCurveTo(r * 0.4, r * 0.35, -r * 1.2, r * 0.25); g.closePath();
      g.fillStyle = '#2d2d39'; g.fill();
    }
    if (P.mark === 'guinea') { g.beginPath(); g.arc(-r * 0.15, -r * 0.45, r * 0.85, 0, Math.PI * 2); g.fillStyle = P.p1; g.fill(); }
    if (P.mark === 'stripe') { g.beginPath(); g.ellipse(-r * 0.55, -r * 0.92, r * 0.8, r * 0.3, 0.25, 0, Math.PI * 2); g.fillStyle = P.dark; g.fill(); }
    if (P.mark === 'tabby') {
      // the forehead "M" and a cheek stripe
      g.beginPath(); g.moveTo(-r * 0.05, -r * 0.98); g.lineTo(r * 0.12, -r * 0.62); g.moveTo(r * 0.3, -r * 0.95); g.lineTo(r * 0.36, -r * 0.62); g.moveTo(-r * 0.4, -r * 0.9); g.lineTo(-r * 0.16, -r * 0.58);
      g.moveTo(-r * 0.75, r * 0.05); g.quadraticCurveTo(-r * 0.4, -r * 0.05, -r * 0.15, r * 0.12);
      g.strokeStyle = P.dark; g.lineWidth = r * 0.13; g.lineCap = 'round'; g.stroke();
    }
    g.restore();
    if (P.fluffy) {
      // long-haired: a fluffy ruff along the back of the cheeks
      g.beginPath(); for (var fi = 0; fi < 2; fi++) { var fa = 1.95 + fi * 0.55; tuft(g, Math.cos(fa) * r * 0.95, Math.sin(fa) * r * 0.95, Math.cos(fa + 0.55) * r * 0.95, Math.sin(fa + 0.55) * r * 0.95, -0.26); }
      g.fillStyle = P.head; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    }
    if (P.chub) {
      g.beginPath(); g.arc(P.chub.x, P.chub.y, P.chub.r, 0, Math.PI * 2); g.fillStyle = P.chub.col; g.fill();
      g.beginPath(); g.arc(P.chub.x, P.chub.y, P.chub.r, Math.PI * 1.05, Math.PI * 1.75); g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 1.3; g.stroke();
    }
    if (P.ear.front) drawEar(g, P.ear, false, st.earRot || 0);
    // whiskers
    if (P.whisk) {
      var wx = r * 0.55 + s.l * 0.7, wy = s.y + 0.5;
      g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 7, wy - 2); g.moveTo(wx, wy + 1); g.lineTo(wx + 7, wy + 2.5); g.moveTo(wx - 1, wy + 1.5); g.lineTo(wx + 5, wy + 5);
      g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 0.9; g.stroke();
    }
    // cheek
    var blush = eye === 'happy' || eye === 'purr';
    g.beginPath(); g.arc(r * (P.chub ? 0.3 : 0.12), r * (P.chub ? 0.42 : 0.4), r * 0.2, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,' + (blush ? 0.6 : 0.38) + ')'; g.fill();
    // nose
    if (s.t === 'point') { g.beginPath(); g.ellipse(G.tipX - 0.6, s.y - 0.3, P.nr * 1.1, P.nr * 0.9, 0, 0, Math.PI * 2); g.fillStyle = P.nose; g.fill(); }
    else {
      var nx = r * 0.55 + s.l * 0.85, ny = s.y - s.h * 0.3 + (P.twitch ? Math.sin((st.t || 0) * 17) * (Math.sin((st.t || 0) * 1.3) > 0.2 ? 0.45 : 0) : 0);
      g.beginPath(); g.moveTo(nx - P.nr, ny - P.nr * 0.6); g.lineTo(nx + P.nr * 0.9, ny - P.nr * 0.6); g.lineTo(nx, ny + P.nr * 0.8); g.closePath();
      g.fillStyle = P.nose; g.fill(); outline(g, 1);
    }
    drawMouth(g, G.mx, G.my, st.mouth, P.hr / 12);
    // eye
    drawEye(g, P.eye.x * r, P.eye.y * r, P.eye.r * eyeK, eye, isBlink(st), P.ring, P.iris);
    if (st.carry) { g.save(); g.translate(G.mx + 1, G.my + 2.5); THING.pilka(g, 4.6); g.restore(); }
  }
  function headWear(g, P, st, eyeK) {
    var w = st.wear || {}, r = P.hr, sc = r / 12;
    if (w.eyes === 'okulary' && st.eye !== 'closed') {
      g.save(); g.translate(P.eye.x * r, P.eye.y * r); var es = P.eye.r / 2.6 * (0.72 + 0.25 * (eyeK - 1)); g.scale(es, es); WEAR.okulary(g); g.restore();
    }
    if (w.head) {
      g.save();
      if (w.head === 'kokardka') { g.translate(P.ear.t === 'flap' ? r * 0.3 : -r * 0.3, -r * 0.9); g.rotate(-0.2); g.scale(sc * 0.7, sc * 0.7); }   // not on top of a guinea pig's ear
      else { g.translate(r * 0.1, -r * 0.82); g.rotate(0.18); g.scale(sc * 0.78, sc * 0.78); }
      WEAR[w.head](g); g.restore();
    }
  }
  function drawCritter(g, sp, st) {
    var P = SP[sp];
    if (!P || P.hog) { drawHog(g, st); return; }
    var G = geo(sp, st.stage | 0, st.pose), K = STAGES[st.stage | 0], eyeK = K.ke / K.kh;
    if (st.pose === 'belly') { drawBellyUp(g, P, G, st, eyeK); return; }
    var sleep = st.pose === 'sleep', t = st.t || 0, ph = st.legs || 0, sw = Math.sin(ph) * 3 * G.kb;
    var hrot = (sleep ? 0.12 : 0) + (st.headRot || 0);
    function HT() { g.translate(G.hx, G.hy); g.rotate(hrot); g.scale(G.kh, G.kh); }
    var legTop = G.cy + G.ry * 0.25, lw = P.legW * Math.max(0.75, G.kb), lx0 = G.cx - G.rx * 0.55, lx1 = G.cx + G.rx * 0.5;
    var fy = -lw / 2 + 0.5, farCol = shade(P.leg, 0.78), farSock = P.sock ? shade(P.sock, 0.78) : null, bend = G.legH > 6 ? lw * 0.75 : 0;
    // far legs + tail (behind)
    var fo = lw * 1.25;
    if (!sleep) {
      leg(g, lx0 + fo, legTop, lx0 + fo + sw, fy - 1, lw, farCol, { paw: P.hind ? 0 : 1, bend: bend, sock: farSock }); leg(g, lx1 + fo, legTop, lx1 + fo - sw, fy - 1, lw, farCol, { paw: 1, sock: farSock });
      if (P.hind) { g.beginPath(); g.ellipse(lx0 + fo + 2 * G.kb + sw, -3.4 * G.kb, 7.5 * G.kb, 2.8 * G.kb, 0, 0, Math.PI * 2); g.fillStyle = farCol; g.fill(); outline(g, 1.8); }
    }
    var tp = null;
    if (P.tail) { tp = tailPts(P, G, st, G.tailBase, false); drawTail(g, P, tp); }
    if (P.puff) drawPuff(g, P, G);
    // ears (behind the head)
    var ef = earFlop(P, st.stage);
    g.save(); HT();
    drawEar(g, P.ear, true, ef);
    if (!P.ear.front) drawEar(g, P.ear, false, ef + (st.earRot || 0));
    g.restore();
    if (st.wear && st.wear.neck === 'szalik') { g.save(); var sa = scarfAt(P, G); g.translate(sa.x, sa.y); g.rotate(sa.a); g.scale(G.kh * 0.72, G.kh * 0.72); g.translate(-2, 2); WEAR.szalikTail(g, t); g.restore(); }
    // near legs
    if (!sleep) {
      leg(g, lx0, legTop, lx0 - sw, fy, lw, P.leg, { paw: P.hind ? 0 : 1, bend: bend, sock: P.sock });
      if (P.hind) { g.beginPath(); g.ellipse(lx0 + 2 * G.kb - sw, -2.6 * G.kb, 8 * G.kb, 3 * G.kb, 0, 0, Math.PI * 2); g.fillStyle = P.leg; g.fill(); outline(g, 1.8); }
      leg(g, lx1, legTop, lx1 + sw, fy, lw, P.leg, { paw: 1, sock: P.sock });
      if (st.wave != null) { var wa = -1.2 + Math.sin(st.wave) * 0.5; leg(g, G.nx, G.ny + G.ry * 0.3, G.nx + Math.cos(wa) * 14 * G.kb, G.ny + G.ry * 0.3 + Math.sin(wa) * 14 * G.kb, lw, P.leg, { paw: 2, sock: P.sock, pad: P.pad }); }
    } else {
      g.beginPath(); g.ellipse(lx1 + 4 * G.kb, -2, 5 * G.kb, 2.6 * G.kb, 0, 0, Math.PI * 2); g.fillStyle = P.leg; g.fill(); outline(g, 1.6);
    }
    // one silhouette: stroke the union of body + neck + head, then fill the parts
    var neck = P.neck !== false;
    var ndx = G.hx - G.nx, ndy = G.hy - G.ny, nlen = Math.hypot(ndx, ndy), na = Math.atan2(ndy, ndx);
    function neckPath() { g.moveTo(G.nx + ndx / 2 + Math.cos(na) * (nlen / 2 + 3), G.ny + ndy / 2 + Math.sin(na) * (nlen / 2 + 3)); g.ellipse(G.nx + ndx / 2, G.ny + ndy / 2, nlen / 2 + 3, P.hr * G.kh * 0.62, na, 0, Math.PI * 2); }
    g.beginPath();
    g.moveTo(G.cx + G.rx, G.cy); g.ellipse(G.cx, G.cy, G.rx, G.ry, 0, 0, Math.PI * 2);
    if (neck) neckPath();
    g.save(); HT(); headShape(g, P); g.restore();
    // long-haired: soft fur hanging under the tummy, one outline with the body (the legs come out from under it)
    function fluffPath() { for (var fu = 0; fu < 3; fu++) { var a0 = Math.PI * (0.28 + fu * 0.15), a2 = a0 + Math.PI * 0.15; tuft(g, G.cx + Math.cos(a0) * G.rx * 0.97, G.cy + Math.sin(a0) * G.ry * 0.97, G.cx + Math.cos(a2) * G.rx * 0.97, G.cy + Math.sin(a2) * G.ry * 0.97, -0.25); } }
    if (P.fluffy && !sleep) fluffPath();
    g.lineWidth = 4.4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); g.ellipse(G.cx, G.cy, G.rx, G.ry, 0, 0, Math.PI * 2); g.fillStyle = P.col; g.fill();
    if (neck) { g.beginPath(); neckPath(); g.fill(); }
    // body markings
    g.save(); g.beginPath(); g.ellipse(G.cx, G.cy, G.rx, G.ry, 0, 0, Math.PI * 2); if (neck) neckPath(); g.clip();
    if (P.belly) { g.beginPath(); g.ellipse(G.cx + G.rx * 0.08, G.cy + G.ry * (P.bigBelly ? 0.75 : 0.95), G.rx * (P.bigBelly ? 0.95 : 0.85), G.ry * (P.bigBelly ? 0.7 : 0.55), 0, 0, Math.PI * 2); g.fillStyle = P.belly; g.fill(); }
    if (P.chest) { g.beginPath(); g.ellipse(G.nx + 2 * G.kb, G.ny + G.ry * 0.75, G.rx * 0.32, G.ry * 0.95, -0.35, 0, Math.PI * 2); g.fillStyle = P.chest; g.fill(); }
    if (P.mark === 'guinea') {
      g.beginPath(); g.ellipse(G.cx + G.rx * 0.12, G.cy - G.ry * 0.55, G.rx * 0.42, G.ry * 0.6, 0, 0, Math.PI * 2); g.fillStyle = P.p1; g.fill();
      g.beginPath(); g.ellipse(G.cx - G.rx * 0.78, G.cy - G.ry * 0.1, G.rx * 0.45, G.ry * 0.95, 0, 0, Math.PI * 2); g.fillStyle = P.p2; g.fill();
    }
    if (P.mark === 'badger') { g.beginPath(); g.ellipse(G.cx - G.rx * 0.1, G.cy - G.ry * 1.05, G.rx * 0.9, G.ry * 0.45, 0, 0, Math.PI * 2); g.fillStyle = shade(P.col, 0.85); g.fill(); }
    if (P.mark === 'stripe') {
      // one dark stripe along the back and up the neck
      g.beginPath(); g.moveTo(G.cx - G.rx * 1.05, G.cy - G.ry * 0.62); g.quadraticCurveTo(G.cx, G.cy - G.ry * 1.25, G.cx + G.rx * 0.7, G.cy - G.ry * 0.85);
      if (neck) g.lineTo(G.hx - G.hr * 0.55, G.hy - G.hr * 0.45);
      g.strokeStyle = P.dark; g.lineWidth = G.ry * 0.42; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
    }
    if (P.mark === 'tabby') {
      g.beginPath();
      [-0.62, -0.3, 0.02, 0.34].forEach(function (f) { var x = G.cx + G.rx * f; g.moveTo(x - G.rx * 0.08, G.cy - G.ry * 1.05); g.quadraticCurveTo(x + G.rx * 0.07, G.cy - G.ry * 0.5, x - G.rx * 0.02, G.cy + G.ry * 0.05); });
      g.strokeStyle = P.dark; g.lineWidth = Math.max(1.6, G.ry * 0.17); g.lineCap = 'round'; g.stroke();
    }
    if (P.haunch) { g.beginPath(); g.arc(lx0 + G.rx * 0.06, G.cy + G.ry * 0.3, G.ry * 0.62, Math.PI * 1.12, Math.PI * 1.82); g.strokeStyle = 'rgba(29,47,111,.3)'; g.lineWidth = 1.5; g.lineCap = 'round'; g.stroke(); }
    if (P.hind) { g.beginPath(); g.arc(G.cx - G.rx * 0.42, G.cy + G.ry * 0.28, G.ry * 0.62, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 1.6; g.stroke(); }
    var nd = Math.round((st.dirt || 0) * 6);
    for (var m = 0; m < nd; m++) {
      var dp = [[-0.4, -0.3, 3.2], [0.2, -0.55, 2.6], [-0.1, 0.2, 2.4], [0.45, -0.1, 2.2], [-0.7, 0.05, 2.8], [0.05, -0.2, 3]][m];
      g.beginPath(); g.ellipse(G.cx + dp[0] * G.rx, G.cy + dp[1] * G.ry, dp[2] * 1.3 * G.kb, dp[2] * G.kb, 0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(110,84,52,.7)'; g.fill();
    }
    g.restore();
    if (P.fluffy && !sleep) { g.beginPath(); fluffPath(); g.fillStyle = P.belly || P.col; g.fill(); }
    if (sleep) drawBlanket(g, G);
    // head
    g.save(); HT();
    g.beginPath(); headShape(g, P); g.fillStyle = P.head; g.fill();
    headFeatures(g, P, G, st, eyeK);
    g.restore();
    if (st.wear && st.wear.neck === 'szalik') { g.save(); var sb = scarfAt(P, G); g.translate(sb.x, sb.y); g.rotate(sb.a); g.scale(G.kh * 0.72, G.kh * 0.72); WEAR.szalik(g); g.restore(); }
    if (!sleep) { g.save(); HT(); headWear(g, P, st, eyeK); g.restore(); }
    if (st.basket != null) drawBackBasket(g, G.back.x, G.back.y - 3 * G.kb, 0, Math.max(0.7, G.kb));
  }
  function scarfAt(P, G) {
    if (P.neck === false) return { x: G.hx - G.hr * 0.75, y: G.hy + G.hr * 0.55, a: -0.35 };
    var a = Math.atan2(G.hy - G.ny, G.hx - G.nx);
    return { x: G.nx + (G.hx - G.nx) * 0.55, y: G.ny + (G.hy - G.ny) * 0.55, a: a };
  }
  function drawBlanket(g, G) {
    var cx = G.cx, cy = G.cy, rx = G.rx, ry = G.ry;
    function sh() { g.beginPath(); g.moveTo(cx - rx * 1.15, 0); g.quadraticCurveTo(cx - rx * 1.3, cy - ry * 1.55, cx - rx * 0.05, cy - ry * 1.3); g.quadraticCurveTo(cx + rx * 0.7, cy - ry * 1.15, cx + rx * 0.62, 0); g.closePath(); }
    sh(); g.fillStyle = '#9fd0f5'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#ffd6ec';
    var q = Math.max(8, rx * 0.4);
    for (var qx = cx - rx * 1.4; qx < cx + rx; qx += q) for (var qy = cy - ry * 1.6; qy < 2; qy += q) if ((Math.round((qx - cx) / q) + Math.round(qy / q)) % 2 === 0) g.fillRect(qx, qy, q, q);
    g.restore();
    sh(); outline(g, 2);
  }
  // lying on its back, belly up, paws in the air
  function drawBellyUp(g, P, G, st, eyeK) {
    var t = st.t || 0, rx = G.rx, ry = G.ry, cy = G.cy, cx = G.cx, w = Math.sin(t * 9) * 3 * G.kb;
    var hx = G.hx, hy = G.hy, rot = G.rot;
    function HT() { g.translate(hx, hy); g.rotate(rot); g.scale(G.kh, G.kh); }
    if (P.tail) { var tp = tailPts(P, G, st, G.tailBase, true); drawTail(g, P, tp); }
    var lw = P.legW * Math.max(0.75, G.kb), ll = G.ll;
    [[-0.5, -1, 0.82], [0.4, 1, 0.82], [-0.3, -1, 1], [0.55, 1, 1]].forEach(function (L, i) {
      var x0 = cx + rx * L[0], y0 = cy - ry * 0.4, dx = L[1] * ll * 0.45 + (i % 2 ? w : -w), col = L[2] < 1 ? shade(P.leg, 0.8) : P.leg;
      if (P.legH < 6) {
        // hamster, guinea pig: tiny round paws waving just above the tummy (long sticks would look like ears)
        var top = cy - ry * Math.sqrt(Math.max(0, 1 - L[0] * L[0])), pr = lw * (P.hind ? 0.85 : 0.62);
        var px = x0 + dx * 0.3, py = top - pr * 0.95;
        g.beginPath(); g.ellipse(px, py, pr, pr * 1.2, L[1] * 0.35, 0, Math.PI * 2); g.fillStyle = col; g.fill(); outline(g, 1.8);
        if (P.pad) { g.beginPath(); g.ellipse(px, py - pr * 0.2, pr * 0.5, pr * 0.58, L[1] * 0.35, 0, Math.PI * 2); g.fillStyle = L[2] < 1 ? shade(P.pad, 0.85) : P.pad; g.fill(); }   // a pad, so it reads as a paw
      } else leg(g, x0, y0, x0 + dx, cy - ry - ll, lw, col, { paw: 2, sock: P.sock ? (L[2] < 1 ? shade(P.sock, 0.8) : P.sock) : null, pad: P.pad });
    });
    var fe = frontEar(P, st.stage);
    g.save(); HT(); frontEars(g, fe); g.restore();
    if (P.puff) drawPuff(g, P, G);
    g.beginPath(); g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.save(); HT(); headShapeFront(g, P); g.restore();
    g.lineWidth = 4.4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = P.col; g.fill();
    g.save(); g.clip();
    var bc = P.belly || P.chest || P.low || shade(P.col, 1.25);
    g.beginPath(); g.ellipse(cx, cy - ry * 0.7, rx * 0.85, ry * 0.75, 0, 0, Math.PI * 2); g.fillStyle = bc; g.fill();
    if (P.mark === 'guinea') { g.beginPath(); g.ellipse(cx - rx * 0.75, cy + ry * 0.2, rx * 0.4, ry * 0.8, 0, 0, Math.PI * 2); g.fillStyle = P.p2; g.fill(); }
    g.beginPath(); g.ellipse(cx - rx * 0.1, cy - ry * 0.85, rx * 0.4, ry * 0.25, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
    g.restore();
    g.save(); HT();
    g.beginPath(); headShapeFront(g, P); g.fillStyle = P.head; g.fill();
    frontFace(g, P, { t: t, eye: st.eye || 'happy', mouth: st.mouth || 'giggle', seed: st.seed }, eyeK);
    g.restore();
  }

  // ---------- food, wardrobe, mini-games ----------
  var FOODS = [
    { k: 'jablko',    n: 'Jabłko',     price: 10, food: 20 },
    { k: 'marchewka', n: 'Marchewka',  price: 10, food: 20 },
    { k: 'salata',    n: 'Sałata',     price: 12, food: 22 },
    { k: 'mleko',     n: 'Miseczka mleka', price: 12, food: 24 },
    { k: 'ziarenka',  n: 'Ziarenka',   price: 12, food: 22 },
    { k: 'szyszka',   n: 'Szyszka',    price: 12, food: 22 },
    { k: 'gruszka',   n: 'Gruszka',    price: 12, food: 25 },
    { k: 'orzechy',   n: 'Orzechy',    price: 15, food: 30 },
    { k: 'jagody',    n: 'Jagody',     price: 15, food: 30 },
    { k: 'winogrona', n: 'Winogrona',  price: 15, food: 30 },
    { k: 'jajko',     n: 'Jajko',      price: 18, food: 35 },
    { k: 'grzybek',   n: 'Grzybek',    price: 18, food: 35 },
    { k: 'miod',      n: 'Miód',       price: 20, food: 40, fun: 5 },
    { k: 'ciastko',   n: 'Ciasteczko', price: 20, food: 40, fun: 5 },
    { k: 'babeczka',  n: 'Babeczka',   price: 25, food: 55, fun: 10 }
  ];
  var FOOD_BY = {}; FOODS.forEach(function (f) { FOOD_BY[f.k] = f; });
  // produce from the Ogródek pantry: g = plant key there, k = drawing (and favourite) key here; costs no stars
  var GARDEN = [
    { g: 'rzezucha', k: 'rzezucha', n: 'Rzeżucha', food: 15 },
    { g: 'szczypiorek', k: 'szczypiorek', n: 'Szczypiorek', food: 15 },
    { g: 'rzodkiewka', k: 'rzodkiewka', n: 'Rzodkiewka', food: 18 },
    { g: 'slonecznik', k: 'ziarenka', n: 'Pestki słonecznika', food: 22 },
    { g: 'marchewka', k: 'marchewka', n: 'Marchewka', food: 22 },
    { g: 'salata', k: 'salata', n: 'Sałata', food: 24 },
    { g: 'pomidor', k: 'pomidor', n: 'Pomidor', food: 28 },
    { g: 'truskawka', k: 'truskawka', n: 'Truskawka', food: 28, fun: 5 },
    { g: 'kukurydza', k: 'kukurydza', n: 'Kukurydza', food: 30 },
    { g: 'groszek', k: 'groszek', n: 'Groszek', food: 28 },
    { g: 'winogrono', k: 'winogrona', n: 'Winogrona', food: 30 },
    { g: 'dynia', k: 'dynia', n: 'Dynia', food: 40, fun: 5 },
    { g: 'papryka', k: 'papryka', n: 'Papryka', food: 28 },
    { g: 'ogorek', k: 'ogorek', n: 'Ogórek', food: 28 },
    { g: 'baklazan', k: 'baklazan', n: 'Bakłażan', food: 30 }
  ];
  var GARDEN_KEY = 'naukagry.ogrodek';
  function gardenRead() { try { var o = JSON.parse(localStorage.getItem(GARDEN_KEY)); return o && typeof o === 'object' && o.pantry && typeof o.pantry === 'object' ? o : null; } catch (e) { return null; } }
  function pantryCount(o, gk) { var p = o && o.pantry[gk]; return p ? Math.max(0, (+p.f || 0) + (+p.b || 0)) : 0; }
  // takes one piece out of the garden pantry (grown from free seeds first: those pay less in garden orders)
  function pantryTake(gk) {
    var o = gardenRead(), p = o && o.pantry[gk];
    if (!p || pantryCount(o, gk) <= 0) return false;
    if ((+p.f || 0) > 0) p.f = +p.f - 1; else p.b = +p.b - 1;
    if (!((+p.f || 0) > 0) && !((+p.b || 0) > 0)) delete o.pantry[gk];
    try { localStorage.setItem(GARDEN_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  var FAV_FUN = 8;
  // home upgrades (Rodzina -> Ulepszenia domku): v = value per level (0 = not bought), price/lv = cost and player
  // level needed for the next level. Every bought upgrade can be switched off (save.off) and then acts as level 0.
  var UPS = [
    { k: 'basket', n: 'Większy koszyk', v: [3, 4, 5], price: [250, 600], lv: [1, 5],
      say: function (v) { return v + ' ' + pl(v, 'darmowe jabłko', 'darmowe jabłka', 'darmowych jabłek') + ' dziennie'; } },
    { k: 'bed', n: 'Wygodne posłanie', v: [1, 1.5, 2], price: [300, 700], lv: [2, 6],
      say: function (v) { return v > 1 ? 'Sen wraca ' + (v === 2 ? '2 razy' : '1,5 raza') + ' szybciej' : 'Zwykłe spanie'; } },
    { k: 'tub', n: 'Wanna z bąbelkami', v: [0, 10, 20], price: [250, 550], lv: [1, 5],
      say: function (v) { return v ? 'Kąpiel daje też +' + v + ' humoru' : 'Zwykła kąpiel'; } },
    { k: 'toys', n: 'Pudło z zabawkami', v: [1, 0.85, 0.7], price: [400, 900], lv: [3, 8],
      say: function (v) { return v < 1 ? 'Potrzeby spadają o ' + Math.round((1 - v) * 100) + '% wolniej' : 'Zwykłe tempo'; } }
  ];
  var UPB = {}; UPS.forEach(function (U) { UPB[U.k] = U; });
  function drawUpPic(g, k) {   // centre (0,0), about 40 units across
    function o(w) { outline(g, w || 2.2); }
    if (k === 'basket') {
      [[-9, -6], [0, -9], [9, -6], [-4, -1], [5, -1]].forEach(function (a) { drawApple(g, a[0], a[1], 6); });
      g.beginPath(); g.moveTo(-17, -2); g.lineTo(17, -2); g.lineTo(13, 16); g.lineTo(-13, 16); g.closePath(); g.fillStyle = '#d99a52'; g.fill(); o();
      g.strokeStyle = '#a8692e'; g.lineWidth = 1.6; [4, 10].forEach(function (y) { g.beginPath(); g.moveTo(-15 + (y / 8), y); g.lineTo(15 - (y / 8), y); g.stroke(); });
      g.beginPath(); g.arc(0, -2, 17, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    } else if (k === 'bed') {
      g.beginPath(); g.ellipse(0, 6, 20, 10, 0, 0, Math.PI * 2); g.fillStyle = '#7fb6ea'; g.fill(); o();
      g.beginPath(); g.ellipse(0, 3, 14, 6, 0, 0, Math.PI * 2); g.fillStyle = '#d9ecff'; g.fill(); o(1.6);
      rr(g, -12, -8, 13, 8, 4); g.fillStyle = '#fff'; g.fill(); o(1.6);
      g.fillStyle = PURPLE; g.font = '13px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 8, -10); g.fillText('z', 14, -17);
    } else if (k === 'tub') {
      [[-8, -12, 5], [2, -16, 4], [10, -11, 3.5], [-2, -9, 3]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, Math.PI * 2); g.fillStyle = '#e8f6ff'; g.fill(); o(1.4); });
      g.beginPath(); g.moveTo(-19, -4); g.lineTo(19, -4); g.quadraticCurveTo(19, 12, 6, 12); g.lineTo(-6, 12); g.quadraticCurveTo(-19, 12, -19, -4); g.closePath(); g.fillStyle = '#ff9ec7'; g.fill(); o();
      g.beginPath(); g.moveTo(-12, 12); g.lineTo(-14, 17); g.moveTo(12, 12); g.lineTo(14, 17); o(2.4);
      heart(g, 0, 4, 4, '#fff');
    } else if (k === 'toys') {
      rr(g, -17, -2, 34, 18, 3); g.fillStyle = '#f5c330'; g.fill(); o();
      g.beginPath(); g.moveTo(-17, 4); g.lineTo(17, 4); g.strokeStyle = '#c98a10'; g.lineWidth = 2; g.stroke();
      g.save(); g.translate(-7, -7); THING.pilka(g, 7); g.restore();
      rr(g, 3, -14, 10, 10, 2); g.fillStyle = '#5cbc4b'; g.fill(); o(1.8); rr(g, 8, -8, 9, 9, 2); g.fillStyle = '#3f86d8'; g.fill(); o(1.8);
    }
  }                                 // a favourite snack also cheers the pet up
  // same ids/slots as Jeżyk w biegu (the child buys them there)
  var ITEMS = [
    { id: 'czapka',   name: 'Czapka',   slot: 'head' },
    { id: 'szalik',   name: 'Szalik',   slot: 'neck' },
    { id: 'kokardka', name: 'Kokardka', slot: 'head' },
    { id: 'korona',   name: 'Korona',   slot: 'head' },
    { id: 'okulary',  name: 'Okulary',  slot: 'eyes' }
  ];
  var MINI = [
    { k: 'catch',   n: 'Łap jabłka',          sub: 'Jabłka spadają z drzewa. Łap je!' },
    { k: 'hide',    n: 'Chowany',             sub: 'Zwierzątko chowa się w liściach. Patrz uważnie!' },
    { k: 'aport',   n: 'Aport',               sub: 'Rzuć piłkę palcem. Złap ją, gdy wraca!' },
    { k: 'dig',     n: 'Szukanie smakołyków', sub: 'Smakołyki są zakopane. Kop tam, gdzie ciepło!' },
    { k: 'bubbles', n: 'Bańki',               sub: 'Dmuchaj bańki, a zwierzątko je łapie.' },
    { k: 'dance',   n: 'Powtórz taniec',      sub: 'Zapamiętaj ruchy i powtórz je.' },
    { k: 'wheel',   n: 'Kołowrotek',          sub: 'Stukaj w rytm, żeby biec szybko!' }
  ];
  var MINI_BY = {}; MINI.forEach(function (m) { MINI_BY[m.k] = m; });
  var SURPRISES = [
    { k: 'biedronka', n: 'biedronka' }, { k: 'zoladz', n: 'żołądź' }, { k: 'slimak', n: 'ślimak' },
    { k: 'szyszka', n: 'szyszka' }, { k: 'grzybek', n: 'grzybek' }, { k: 'jablko', n: 'jabłko' }
  ];
  var LEAF_COLS = ['#e9813c', '#f5c330', '#cf412d', '#d9622b', '#f0a43a'];

  // ---------- DOM icons ----------
  var ICON = {
    food: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="10" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.4"/><circle cx="12.5" cy="15" r="2.6" fill="#fff" opacity=".7"/><path d="M16 8 q6 -6 9 -1 q-5 0 -9 1 z" fill="#3fae5f" stroke="#1d2f6f" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    fun: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="#fff" stroke="#1d2f6f" stroke-width="2.4"/><path d="M16 5 a11 11 0 0 1 10.4 7.4 L16 16 z" fill="#e2533f"/><path d="M26.4 19.6 a11 11 0 0 1 -10.4 7.4 L16 16 z" fill="#3f86d8"/><path d="M8 24 a11 11 0 0 1 -2.8 -11 L16 16 z" fill="#f5c330"/><circle cx="16" cy="16" r="11" fill="none" stroke="#1d2f6f" stroke-width="2.4"/></svg>',
    clean: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="18" r="8" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="2.2"/><circle cx="23" cy="11" r="5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="2"/><circle cx="24" cy="24" r="3.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.8"/><path d="M9 15 a4.5 4.5 0 0 1 4 -3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    sleep: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M20 5 a11 11 0 1 0 8 17 a9 9 0 0 1 -8 -17 z" fill="#f5c330" stroke="#1d2f6f" stroke-width="2.3" stroke-linejoin="round"/><path d="M8 7 l1.2 2.6 l2.8 .4 l-2 2 l.5 2.8 l-2.5 -1.3 l-2.5 1.3 l.5 -2.8 l-2 -2 l2.8 -.4 z" fill="#fff4c4" stroke="#1d2f6f" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    bath: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="9" r="3.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.6"/><circle cx="18" cy="6" r="2.5" fill="#d9f0ff" stroke="#1d2f6f" stroke-width="1.4"/><path d="M3 15 h26 q0 10 -9 11 h-8 q-9 -1 -9 -11 z" fill="#9fd4f5" stroke="#1d2f6f" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 26 l-1 3 M23 26 l1 3" stroke="#1d2f6f" stroke-width="2.4" stroke-linecap="round"/><path d="M6 18 h20" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    hat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 22 q-1 -15 10 -15 q11 0 10 15 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.3" stroke-linejoin="round"/><rect x="4" y="20" width="24" height="6" rx="3" fill="#fff" stroke="#1d2f6f" stroke-width="2.3"/><circle cx="16" cy="6" r="3.5" fill="#fff" stroke="#1d2f6f" stroke-width="2"/></svg>',
    fam: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15 L16 5 L28 15" fill="none" stroke="#1d2f6f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 13 v14 h18 v-14" fill="#fbe6c8" stroke="#1d2f6f" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 25 c-6 -4 -7 -7 -4.5 -9 c1.7 -1.3 3.5 -.4 4.5 1 c1 -1.4 2.8 -2.3 4.5 -1 c2.5 2 1.5 5 -4.5 9 z" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    hop: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4 l7 8 h-4.5 v8 h-5 v-8 h-4.5 z" fill="#5cbc4b" stroke="#1d2f6f" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 27 h20" stroke="#1d2f6f" stroke-width="2.6" stroke-linecap="round"/></svg>',
    spin: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 16 a9 9 0 1 1 -3 -6.7" fill="none" stroke="#3f86d8" stroke-width="4" stroke-linecap="round"/><path d="M25 16 a9 9 0 1 1 -3 -6.7" fill="none" stroke="#1d2f6f" stroke-width="1.2" stroke-linecap="round" opacity=".5"/><path d="M18 5 l6 4 l-6 4 z" fill="#3f86d8" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/></svg>',
    wave: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 27 v-11 q0 -3 2.5 -3 q2.5 0 2.5 3 v-8 q0 -3 2.5 -3 q2.5 0 2.5 3 v12 q3 -4 5 -2 q1 1 -1 4 l-5 8 z" fill="#ffd0a8" stroke="#1d2f6f" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 10 q-2 -3 0 -6 M4 14 q-3 -2 -2 -5" fill="none" stroke="#f5c330" stroke-width="2.4" stroke-linecap="round"/></svg>',
    roll: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="#ff9ec7" stroke="#1d2f6f" stroke-width="2.4"/><path d="M16 6 a10 10 0 0 1 0 20" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="2"/><circle cx="12" cy="13" r="1.8" fill="#1d2f6f"/><circle cx="20" cy="19" r="1.8" fill="#1d2f6f"/></svg>'
  };
  var LOW_NEED = 30;                                // below this a pet shows the need (tired, hungry, dirty, bored)
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
    '.zw-top{flex:none;display:flex;gap:5px;padding:5px 6px 0;background:#fff}',
    '.zw-chip{flex:1 1 0;min-width:0;max-width:150px;min-height:50px;border:2px solid #1d2f6f;border-radius:14px;background:#fff;color:inherit;font:inherit;display:flex;align-items:center;gap:3px;padding:2px 5px 2px 2px;position:relative}',
    '.zw-chip canvas{width:42px!important;height:37px!important;flex:none}',
    '.zw-chip .tx{flex:1;min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:2px;line-height:1}',
    '.zw-chip .nm{font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}',
    '.zw-chip .st{font-size:.82rem;color:#7a4fc4;text-align:left;white-space:nowrap;overflow:hidden}',
    '.zw-gb{display:block;height:7px;border:1.5px solid #1d2f6f;border-radius:5px;background:#f1ecfb;overflow:hidden}',
    '.zw-gb i{display:block;height:100%;background:#9b74dc;transition:width .6s ease}',
    '@media (max-width:400px){.zw-top{gap:4px;padding:4px 4px 0}.zw-chip{gap:2px;padding:2px 4px 2px 1px}.zw-chip canvas{width:38px!important;height:34px!important}.zw-chip .nm{font-size:1.05rem}.zw-chip .st{font-size:.76rem}.zw-top .zw-fam{width:50px;font-size:.78rem}}',
    '.zw-chip.ready{border-color:#e3a008}',
    '.zw-chip.ready::before{content:"\\2605";position:absolute;top:-4px;right:-5px;width:20px;height:20px;border-radius:50%;background:#ffe27a;border:2px solid #1d2f6f;font-size:.8rem;line-height:16px;text-align:center;color:#c47a00;z-index:1}',
    '.zw-grow{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:4;min-height:62px;min-width:210px;padding:6px 26px;border:3px solid #1d2f6f;border-radius:32px;background:linear-gradient(#ffe98f,#f5b82a);color:#2a1d00;font:inherit;font-size:1.7rem;box-shadow:0 4px 0 #1d2f6f;white-space:nowrap;animation:zwglow 1.3s ease-in-out infinite}',
    '.zw-grow:active{box-shadow:0 1px 0 #1d2f6f;margin-bottom:-3px}',
    '@keyframes zwglow{50%{transform:translateX(-50%) scale(1.07)}}',
    '.zw-chip.on{background:#fff4d6;border-color:#e3a008;box-shadow:0 0 0 2px #e3a008 inset}',
    '.zw-chip.zz::after{content:"z";position:absolute;top:-2px;left:34px;font-size:1rem;color:#7a4fc4}',
    '.zw-fam{flex:none;width:58px;min-height:50px;border:2px solid #1d2f6f;border-radius:14px;background:#fff;color:inherit;font:inherit;font-size:.86rem;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:2px}',
    '.zw-fam svg{width:26px;height:26px}',
    '.zw-top{border-bottom:3px solid #1d2f6f;padding-bottom:6px!important}',
    '.zw-chip{flex-direction:column;align-items:stretch!important;max-width:280px!important;padding:3px 6px 5px 3px!important;gap:3px!important}',
    '.zw-chip .hd{display:flex;align-items:center;gap:3px;min-width:0}',
    '.zw-chip .nb{display:flex;flex-direction:column;gap:2px;padding-left:3px}',
    '.zw-chip .nr{display:flex;align-items:center;gap:4px;min-width:0}',
    '.zw-chip .nr svg{width:15px;height:15px;flex:none}',
    '.zw-chip .nr .zw-bar{height:9px;border-width:1.5px}',
    '.zw-chip .nr.low svg{animation:zwbob 1.4s ease-in-out infinite}',
    '.zw-chip .nr.low .zw-bar{border-color:#cf412d}',
    '.zw-chip.need{border-color:#f08a24;background:#fff3e8}',
    '.zw-chip.need.on{background:#fff4d6;border-color:#e3a008}',
    '.zw-chip .wb{position:absolute;top:-7px;right:-6px;width:26px;height:26px;border-radius:50%;background:#fff;border:2px solid #cf412d;display:none;align-items:center;justify-content:center;z-index:1}',
    '.zw-chip.need .wb{display:flex;animation:zwbob 1.2s ease-in-out infinite}',
    '.zw-chip .wb svg{width:18px;height:18px}',
    '.zw-chip.zz::after{left:auto;right:6px;top:2px}',
    '.zw-chip.need.ready::before{right:22px}',
    '@media (max-width:480px){.zw-top.many .zw-chip canvas{display:none!important}.zw-top.many .zw-chip .hd{padding-left:4px}.zw-chip canvas{width:28px!important;height:25px!important}.zw-chip .hd{gap:1px}.zw-chip .nm{font-size:.98rem!important}.zw-chip .st{font-size:.72rem}.zw-chip .nr svg{width:13px;height:13px}.zw-chip .nr{gap:2px}}',
    '@media (min-width:700px){.zw-chip .nr svg{width:18px;height:18px}.zw-chip .nr .zw-bar{height:11px}.zw-chip canvas{width:52px!important;height:45px!important}}',
    '.zw-need{flex:1;min-width:0;min-height:44px;border:2px solid #1d2f6f;border-radius:14px;background:#fff;display:flex;align-items:center;gap:4px;padding:3px 6px;color:inherit;font:inherit}',
    '.zw-need svg{width:28px;height:28px;flex:none}',
    '.zw-need.low svg{animation:zwbob 1.4s ease-in-out infinite}',
    '.zw-bar{flex:1;min-width:0;height:13px;border:2px solid #1d2f6f;border-radius:8px;overflow:hidden;background:#eef1f8}',
    '.zw-bar i{display:block;height:100%;border-radius:0 5px 5px 0;transition:width .6s ease}',
    '@keyframes zwbob{50%{transform:translateY(-3px) rotate(-8deg)}}',
    '.zw-cv{flex:1;position:relative;min-height:0}',
    '.zw-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
    '.zw-bb{flex:none;display:flex;gap:6px;align-items:center;padding:7px 8px calc(7px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f;min-height:76px}',
    '.zw-act{flex:1;min-width:0;min-height:60px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:1.02rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;padding:3px 2px}',
    '.zw-act svg{width:30px;height:30px;flex:none}',
    '.zw-act:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-act[disabled]{opacity:.45;box-shadow:none}',
    '.zw-act.zw-hint{background:#fff4d6}',
    '.zw-act.lit{background:#ffe27a}',
    '.zw-msg{flex:1;min-width:0;font-size:1.25rem;line-height:1.1;padding:0 4px}',
    '.zw-big{min-height:56px;min-width:120px;border:3px solid #1d2f6f;border-radius:16px;background:#e3a008;color:#2a1d00;font:inherit;font-size:1.35rem;box-shadow:0 3px 0 #1d2f6f;padding:4px 14px}',
    '.zw-big.sec{background:#fff;color:#1d2f6f}',
    '.zw-big:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-big[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.zw-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.zw-sheetw.on{opacity:1}',
    '.zw-sheet{position:absolute;left:0;right:0;bottom:0;max-height:92%;display:flex;flex-direction:column;background:#fffaf2;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.zw-sheetw.on .zw-sheet{transform:none}',
    '.zw-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 4px 16px}',
    '.zw-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.zw-sh-h .bal{font-size:1.2rem}.zw-sh-h .bal span{color:#e3a008}',
    '.zw-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1;color:inherit}',
    '.zw-sh-b{overflow-y:auto;touch-action:pan-y;padding:2px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.zw-note{color:#5a6690;font-size:1.08rem;margin:4px 4px}',
    '.zw-note.warn{color:#cf412d}.zw-note.ok{color:#2a8a56}',
    '.zw-h4{font-size:1.3rem;margin:12px 4px 2px;color:#7a4fc4}',
    '.zw-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #e6d6bd;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.zw-row img{width:56px;height:56px;flex:none;object-fit:contain}',
    '.zw-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.zw-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.zw-row .tx small{color:#5a6690;font-size:1rem;display:block}',
    '.zw-row .tx small.fav{color:#e8559a}',
    '.zw-row.cur{border-color:#e3a008;background:#fff7e0}',
    '.zw-row.lock{opacity:.6}',
    '.zw-sw{display:flex;width:fit-content;align-items:center;gap:6px;margin-top:5px;min-height:34px;border:2px solid #1d2f6f;border-radius:999px;background:#e6e9f2;color:#5a6690;font:inherit;font-size:1rem;padding:0 12px 0 4px}',
    '.zw-sw::before{content:"";width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #1d2f6f}',
    '.zw-sw.on{background:#8fd06b;color:#1d2f6f;flex-direction:row-reverse;padding:0 4px 0 12px}',
    '.zw-up.off img{filter:grayscale(1);opacity:.6}',
    '.zw-top-ok{font-size:1.6rem;color:#3fae5f;padding:0 10px}',
    '.zw-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font:inherit;font-size:1.2rem;box-shadow:0 3px 0 #1d2f6f;padding:2px 8px}',
    '.zw-buy.pick{background:#fff;color:#1d2f6f}',
    '.zw-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.zw-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-seg{display:flex;gap:6px;margin:4px 0 2px}',
    '.zw-seg button{flex:1;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font:inherit;font-size:1.2rem;color:inherit}',
    '.zw-seg button.on{background:#7a4fc4;color:#fff}',
    '.zw-prev{display:block;margin:2px auto 4px;border:2px solid #1d2f6f;border-radius:16px;max-width:100%}',
    '.zw-name{font:inherit;font-size:1.7rem;text-align:center;border:3px solid #1d2f6f;border-radius:14px;padding:6px 10px;width:100%;color:#1d2f6f;background:#fffaf2}',
    '.zw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;margin:6px 0}',
    '.zw-sp{min-height:110px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;color:inherit;font:inherit;font-size:1.15rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;line-height:1.05;box-shadow:0 3px 0 #1d2f6f}',
    '.zw-sp img{width:88px;height:66px;object-fit:contain}',
    '.zw-sp:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.zw-wide{width:100%;margin-top:8px}',
    '.zw-card canvas{display:block;margin:0 auto}',
    '@media (prefers-reduced-motion: reduce){.zw-grow{animation:none}.zw-chip .nr.low svg,.zw-chip.need .wb{animation:none}.zw-sheet,.zw-sheetw{transition:none}}'
  ].join('');

  var PIC = '<rect x="0" y="60" width="120" height="12" fill="#8fd06b"/>' +
    '<path d="M4 34 L30 12 L56 34 Z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<rect x="10" y="33" width="40" height="28" fill="#fbe6c8" stroke="#1d2f6f" stroke-width="2.5"/>' +
    '<path d="M23 61 v-12 a7 7 0 0 1 14 0 v12" fill="#b07f52" stroke="#1d2f6f" stroke-width="2"/>' +
    '<circle cx="30" cy="25" r="4" fill="#9fd6ff" stroke="#1d2f6f" stroke-width="1.8"/>' +
    // fox
    '<path d="M58 52 q-12 4 -14 -4 q8 -2 14 0 z" fill="#ea7a32" stroke="#1d2f6f" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M46 48 q-3 -1 -2 0 q1 3 4 3" fill="#fff7ec"/>' +
    '<ellipse cx="66" cy="52" rx="10" ry="6" fill="#ea7a32" stroke="#1d2f6f" stroke-width="2"/>' +
    '<path d="M60 57 v4 M72 57 v4" stroke="#33263f" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M70 41 l2 -7 l4 6 M76 40 l3 -6 l2 7" fill="#ea7a32" stroke="#1d2f6f" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M69 44 q6 -6 12 0 l7 3 q-3 4 -8 3 q-6 3 -11 -1 z" fill="#ea7a32" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="78" cy="44" r="1.6" fill="#1d2f6f"/><circle cx="88" cy="47" r="1.5" fill="#1d2f6f"/>' +
    // hamster
    '<ellipse cx="102" cy="53" rx="11" ry="9" fill="#f0b65a" stroke="#1d2f6f" stroke-width="2"/>' +
    '<ellipse cx="103" cy="57" rx="9" ry="5" fill="#fff7ea"/>' +
    '<circle cx="97" cy="43" r="3" fill="#f0b65a" stroke="#1d2f6f" stroke-width="1.6"/>' +
    '<circle cx="105" cy="49" r="1.8" fill="#1d2f6f"/><circle cx="109" cy="54" r="3" fill="#ff8ca0" opacity=".5"/>' +
    '<path d="M110 51 l2 1 l-2 1 z" fill="#e57a8a"/>' +
    '<path d="M84 22 c-3 -5 -11 -1 -6 4 l6 5 l6 -5 c5 -5 -3 -9 -6 -4 z" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="1.8"/>' +
    '<path d="M104 14 c-2 -3 -7 -1 -4 3 l4 3 l4 -3 c3 -4 -2 -6 -4 -3 z" fill="#ff7eb6" stroke="#1d2f6f" stroke-width="1.5"/>';

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
  // the top of a worn hat (pet units), so thumbnails don't cut it off
  function wearTop(sp, stage, G, wear, pose) {
    if (!wear || !wear.head || pose === 'sleep' || pose === 'belly' || pose === 'ball') return G.top;
    var H = { czapka: 22, korona: 16, kokardka: 12 }[wear.head] || 16, P = SP[sp] || SP.jez, K = STAGES[stage | 0];
    if (P.hog) return Math.min(G.top, -14 * K.kb + (-30 - H + 14) * K.kh - 2);
    var r = P.hr, sc = r / 12;
    return Math.min(G.top, G.hy + G.kh * (-r * (wear.head === 'kokardka' ? 0.9 : 0.82) - H * sc * (wear.head === 'kokardka' ? 0.7 : 0.78)) - 2);
  }
  // a pet fitted into a w x h box (feet on the bottom, centred)
  function fitPet(cg, sp, stage, w, h, st, pad) {
    var G = geo(sp, stage, st && st.pose), bw = G.x1 - G.x0, bh = -wearTop(sp, stage, G, st && st.wear, st && st.pose), p = pad == null ? 3 : pad;
    var s = Math.min((w - p * 2) / bw, (h - p * 2) / bh);
    cg.save(); cg.translate(w / 2 - (G.x0 + G.x1) / 2 * s, h - p); cg.scale(s, s);
    var o = { t: 0.5, stage: stage, eye: 'happy', mouth: 'smile' }; if (st) for (var k in st) o[k] = st[k];
    drawCritter(cg, sp, o); cg.restore();
  }
  function petThumb(sp, stage, w, h, wear) {
    var wk = wear ? (wear.head || '') + (wear.neck || '') + (wear.eyes || '') : '';
    return thumb('p' + sp + stage + w + 'x' + h + wk, w, h, function (cg) { fitPet(cg, sp, stage, w, h, { wear: wear || {} }); });
  }

  // ---------- visiting pets (Pokoik draws one of them walking around the room) ----------
  NG.petArt = {
    // the saved pets: [{ id, sp, stage, name, home, wear }], wear limited to what the child owns in Jeżyk w biegu
    pets: function () {
      var z, j;
      try { z = JSON.parse(localStorage.getItem('naukagry.zwierzak')); } catch (e) { z = null; }
      try { j = JSON.parse(localStorage.getItem('naukagry.jezyk')); } catch (e) { j = null; }
      var own = j && j.owned && typeof j.owned === 'object' ? j.owned : {};
      if (!z || !Array.isArray(z.pets)) return [];
      return z.pets.filter(function (p) { return p && typeof p === 'object' && SP[p.sp]; }).map(function (p) {
        var w = {}, pw = p.wear && typeof p.wear === 'object' ? p.wear : {};
        ITEMS.forEach(function (it) { if (pw[it.slot] === it.id && own[it.id]) w[it.slot] = it.id; });
        return { id: p.id, sp: p.sp, stage: clamp(p.stage | 0, 0, 2), name: String(p.name || SP[p.sp].n), home: !!p.home, wear: w };
      });
    },
    // drawn side view facing right, feet at (0,0), in pet units; st: { t, legs, eye, mouth, wear, pose: 'stand'|'sleep' }
    draw: function (g, pet, st) { var o = { t: 0, stage: pet.stage, eye: 'open', mouth: 'smile', wear: pet.wear }; for (var k in st) o[k] = st[k]; drawCritter(g, pet.sp, o); },
    geo: function (pet, pose) { return geo(pet.sp, pet.stage, pose); },
    size: function (pet) { return sizeK(pet.sp); },
    hops: function (pet) { return !!SP[pet.sp].hops; },
    fem: function (pet) { return fem(pet.name); }
  };

  NG.register('zwierzak', {
    meta: { name: 'Zwierzątko', price: 'jedzenie od 10 ★', bg: '#fdeedd', pic: PIC, music: 'cozy' },
    ownMusic: true,
    medals: [
      { id: 'feeds10', stat: 'feeds', at: 10, tier: 1, text: '10 posiłków' },
      { id: 'days7', stat: 'days', at: 7, tier: 2, text: '7 dni opieki' },
      { id: 'days20', stat: 'days', at: 20, tier: 3, text: '20 dni opieki' },
      { id: 'adult', stat: 'adults', at: 1, tier: 3, text: 'Dorosłe zwierzątko' }
    ],
    quests: [
      { id: 'feed', stat: 'feeds', n: [2, 3], text: 'Nakarm zwierzątko {n} razy' },
      { id: 'play', stat: 'plays', n: [1, 2], text: 'Pobaw się ze zwierzątkiem {n} {raz}', forms: ['raz', 'razy', 'razy'] },
      { id: 'belly', stat: 'bellies', n: [1], text: 'Pogłaszcz brzuszek zwierzątka' }
    ],
    stickers: [
      { id: 'feed', emoji: '🍎', name: 'Pierwszy posiłek' },
      { id: 'bath', emoji: '🛁', name: 'Pierwsza kąpiel' },
      { id: 'sleep', emoji: '🌙', name: 'Pierwsza drzemka' },
      { id: 'tickle', emoji: '😆', name: 'Łaskotki' },
      { id: 'dress', emoji: '🎀', name: 'Strojniś' },
      { id: 'belly', emoji: '💗', name: 'Brzuszek do góry' },
      { id: 'grown', emoji: '🌳', name: 'Dorosłe zwierzątko' },
      { id: 'full', emoji: '🏡', name: 'Pełny domek' }
    ].concat(SP_ORDER.map(function (k) { return { id: 'sp-' + k, emoji: SP_STICKER[k], name: SP[k].n }; })),

    _drawPet: drawCritter, _geo: geo, _species: SP_ORDER,

    mount: function (el, ctx) {
      var NOW = Date.now();
      var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      // ---------- save (v2: several pets) + migration of the single-hedgehog save ----------
      var raw = ctx.load({}) || {};
      var save = {
        v: 2, pets: [], slots: 1, sel: 0, nextId: 1, basketDay: '', basketLeft: BASKET, careDay: '',
        diff: 0, best: {}, seenHelp: false, seenV2: true, seenLvl: false, lastSeen: 0, wearInit: false
      };
      if (Array.isArray(raw.pets)) { for (var rk in raw) save[rk] = raw[rk]; }
      else if (raw.needs && typeof raw.needs === 'object') {
        // v1: one hedgehog. It becomes pet #1 and keeps its name, needs, outfit; growth from its care days.
        var days = +ctx.getStat('days') || 0;
        var gp0 = days >= 7 ? GROW_AT[2] : days >= 3 ? GROW_AT[1] : Math.min(GROW_AT[1] - 1, days * 4);
        save.pets.push({ id: 1, sp: 'jez', name: raw.name, needs: raw.needs, t: raw.t, asleep: !!raw.asleep, wear: raw.wear, home: true, gp: gp0, stage: stageOf(gp0), gDay: '', gSrc: {}, gToday: 0 });
        save.nextId = 2; save.sel = 1;
        ['basketDay', 'basketLeft', 'careDay', 'diff', 'seenHelp', 'lastSeen', 'wearInit'].forEach(function (k) { if (raw[k] != null) save[k] = raw[k]; });
        if (raw.best && typeof raw.best === 'object') save.best = raw.best;
        save.seenV2 = false; save.wearInit = true;
      }
      if (typeof save.best !== 'object' || !save.best) save.best = {};
      if (!save.up || typeof save.up !== 'object' || Array.isArray(save.up)) save.up = {};
      if (!save.off || typeof save.off !== 'object' || Array.isArray(save.off)) save.off = {};
      save.slots = clamp(Math.round(+save.slots || 1), 1, SLOT_PRICE.length);
      save.diff = save.diff ? 1 : 0;
      save.pets = save.pets.filter(function (p) { return p && typeof p === 'object'; });
      var maxId = 0;
      save.pets.forEach(function (p) {
        if (!SP[p.sp]) p.sp = 'jez';
        if (!isFinite(+p.id) || +p.id <= 0) p.id = ++maxId + 1000;
        maxId = Math.max(maxId, +p.id);
        if (typeof p.name !== 'string' || !p.name.trim()) p.name = SP[p.sp].names[0];
        if (!p.needs || typeof p.needs !== 'object') p.needs = {};
        NEEDS.forEach(function (k) { var v = +p.needs[k]; p.needs[k] = isFinite(v) ? clamp(v, MIN_NEED, 100) : 80; });
        if (!isFinite(+p.t) || +p.t <= 0) p.t = NOW;
        if (!p.wear || typeof p.wear !== 'object') p.wear = { head: null, neck: null, eyes: null };
        p.stage = clamp(p.stage | 0, 0, 2);   // never auto-grow from points (the child taps "Urośnij!") and never shrink
        p.gp = Math.max(0, +p.gp || 0, p.stage ? lvlGp(GROW_LVL[p.stage - 1]) : 0);
        if (!p.gSrc || typeof p.gSrc !== 'object') p.gSrc = {};
        p.home = p.home !== false; p.asleep = !!p.asleep;
      });
      save.nextId = Math.max(+save.nextId || 1, maxId + 1);
      // never more pets at home than slots (a broken save): the rest go to the meadow
      (function () { var n = 0; save.pets.forEach(function (p) { if (p.home) { n++; if (n > save.slots) p.home = false; } }); })();
      if (save.pets.length && !save.pets.some(function (p) { return p.home; })) save.pets[0].home = true;

      // ---------- Jeżyk w biegu wardrobe (read-only) ----------
      function jezyk() {
        try { var j = JSON.parse(localStorage.getItem('naukagry.jezyk')) || {}; return { owned: (j.owned && typeof j.owned === 'object') ? j.owned : {}, wear: (j.wear && typeof j.wear === 'object') ? j.wear : {} }; }
        catch (e) { return { owned: {}, wear: {} }; }
      }
      function validWear(p) {
        var own = jezyk().owned, w = {};
        if (!p) return w;
        ITEMS.forEach(function (it) { if (p.wear[it.slot] === it.id && own[it.id]) w[it.slot] = it.id; });
        return w;
      }
      var wearCache = {};
      function wearOf(p) { return wearCache[p.id] || (wearCache[p.id] = validWear(p)); }

      // ---------- pets ----------
      function byId(id) { for (var i = 0; i < save.pets.length; i++) if (save.pets[i].id === id) return save.pets[i]; return null; }
      function homePets() { return save.pets.filter(function (p) { return p.home; }); }
      function meadowPets() { return save.pets.filter(function (p) { return !p.home; }); }
      function sel() { var p = byId(save.sel); if (p && p.home) return p; var h = homePets()[0] || null; if (h) save.sel = h.id; return h; }
      function freeSlots() { return save.slots - homePets().length; }

      var rt = {};                // runtime state per pet id (position, animation)
      function R(p) {
        var r = rt[p.id];
        if (!r) {
          r = rt[p.id] = { x: 0, y: 0, tx: 0, ty: 0, face: Math.random() < 0.5 ? 1 : -1, walking: false, legs: 0, hop: -1, wig: 0, happy: 0, spin: 0, ball: 0,
            belly: 0, roll: 0, rollIn: false, pm: 0, rub: 0, rubbed: false, purr: 0, wagT: 0, earT: rnd(2, 6), earK: 0, wanderT: rnd(1, 3), seed: Math.random() * 10, zT: rnd(0, 1), wakeT: -1, placed: false };
        }
        return r;
      }

      // ---------- DOM ----------
      var root = document.createElement('div'); root.className = 'zw';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var top = document.createElement('div'); top.className = 'zw-top'; root.appendChild(top);
      var cvWrap = document.createElement('div'); cvWrap.className = 'zw-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var growBtn = document.createElement('button'); growBtn.type = 'button'; growBtn.className = 'zw-grow'; growBtn.hidden = true;
      growBtn.innerHTML = 'Urośnij! <span aria-hidden="true">✨</span>'; cvWrap.appendChild(growBtn);
      growBtn.onclick = function () { if (!growBtn.hidden) growUp(sel()); };
      var bar = document.createElement('div'); bar.className = 'zw-bb'; root.appendChild(bar);
      el.appendChild(root);
      var g = cv.getContext('2d');

      var W = 1, H = 1, DPR = 1, S = 1, LW = 400, LH = 600, FY = 330, HS = 2.4;
      var mode = 'home';           // home | bath | polana | catch | hide | aport | dig | bubbles | dance | wheel
      var raf = 0, running = true, last = 0, T = 0, timers = [], hudT = 0, saveT = 0, hintT = rnd(16, 24), duoT = rnd(10, 16);
      var parts = [], speech = null, food = null, bath = null, dark = 0, duo = null, curMusic = null, play = null, playT = rnd(8, 25);
      var GS = null, sheet = null, overlay = null, panel = null, growQ = [];
      var taps = [], drag = null, plate = { x: 0, y: 0, w: 0, h: 0 }, win = { x: 0, y: 0, w: 0, h: 0 };

      function later(fn, ms) { var id = setTimeout(function () { var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); fn(); }, ms); timers.push(id); return id; }
      function persist() { save.lastSeen = Date.now(); ctx.save(save); }
      function isMini(m) { return !!MG[m || mode]; }

      // ---------- needs over real time ----------
      function settleP(p, now) {
        var dt = (now - p.t) / 3600000;
        if (dt < 0 || !p.home) { p.t = now; return; }      // on the meadow nothing drops
        if (dt < 1e-6) return;
        NEEDS.forEach(function (k) {
          var v = p.needs[k];
          if (p.asleep) v += k === 'sleep' ? SLEEP_GAIN_H * upV('bed') * dt : -RATES[k] * 0.5 * upV('toys') * dt;
          else v -= RATES[k] * upV('toys') * dt;
          p.needs[k] = clamp(v, MIN_NEED, 100);
        });
        p.t = now;
      }
      function settle(now) { save.pets.forEach(function (p) { settleP(p, now); }); }
      function addNeed(p, k, n, cap) {
        if (!p) return;
        settleP(p, Date.now());
        var v = clamp(p.needs[k] + n, MIN_NEED, 100);
        if (cap != null) v = Math.max(p.needs[k], Math.min(v, cap));
        p.needs[k] = v;
      }
      function isTired(p) { return !p.asleep && p.needs.sleep < LOW_NEED; }
      function minNeed(p) { return Math.min(p.needs.food, p.needs.fun, p.needs.clean, p.needs.sleep); }
      function lowest(p) { var k = 'food'; NEEDS.forEach(function (n) { if (p.needs[n] < p.needs[k]) k = n; }); return k; }
      function cared() { var d = today(); if (save.careDay !== d) { save.careDay = d; ctx.stat('days', 1); } }
      function upLv(k) { return clamp(save.up[k] | 0, 0, UPB[k].v.length - 1); }
      function upV(k) { return UPB[k].v[save.off[k] ? 0 : upLv(k)]; }
      function basket() {
        if (save.basketDay !== today()) { save.basketDay = today(); save.basketLeft = upV('basket'); }
        return Math.min(save.basketLeft, upV('basket'));
      }

      // ---------- growth ----------
      function growLeft(p) { return p.gDay === today() ? Math.max(0, GP_DAY - (p.gToday || 0)) : GP_DAY; }
      function grow(p, src) {
        if (!p || !p.home) return 0;
        var d = today();
        if (p.gDay !== d) { p.gDay = d; p.gSrc = {}; p.gToday = 0; }
        var have = p.gSrc[src] || 0, amt = Math.min(GP[src] || 1, GP_SRC_CAP[src] - have, GP_DAY - p.gToday);
        if (amt <= 0) return 0;
        var L0 = levelOf(p.gp), ready0 = canGrow(p);
        p.gSrc[src] = have + amt; p.gToday += amt; p.gp += amt;
        var r = R(p), L1 = levelOf(p.gp);
        burst('grow', r.x, r.y - 30 * petScale(p), 3);
        if (L1 > L0) levelUp(p, L1, !ready0 && canGrow(p));
        renderChips(); syncGrow();
        return amt;
      }
      function levelUp(p, L, ready) {
        var r = R(p), s = petScale(p);
        ctx.toast(p.name + ' ma poziom ' + L + '!');
        later(function () { ctx.sfx('star'); }, 120);
        popText('poz. ' + L + '!', r.x, r.y - 52 * s, PURPLE);
        burst('spark', r.x, r.y - 40 * s, 4);
        if (ready && mode === 'home') later(function () { if (p.home && canGrow(p) && !p.asleep) say(p, 'Hura! Mogę urosnąć!', 2.4); }, 900);
      }
      // the stage changes only when the child taps "Urośnij!"
      function growUp(p) {
        if (!p || !p.home || !canGrow(p) || overlay || panel || mode !== 'home') return;
        p.stage++; persist();
        growBtn.hidden = true;
        statsPets();
        growQ.push(p.id); showGrowCard();
        syncGrow();
      }
      function syncGrow() {
        var p = sel(), show = !!(mode === 'home' && p && !p.asleep && canGrow(p) && !food && !overlay && !panel && !(rt[p.id] && rt[p.id].belly > 0));
        if (growBtn.hidden === show) growBtn.hidden = !show;
      }
      function growFrac(p) {
        var L = levelOf(p.gp), a = lvlGp(L), b = lvlGp(L + 1);
        return clamp((p.gp - a) / (b - a), 0, 1);
      }
      function statsPets() {
        var adults = save.pets.filter(function (p) { return p.stage >= 2; }).length;
        if (adults) { ctx.stat('adults', adults, 'max'); ctx.sticker('grown'); }
        ctx.stat('pets', save.pets.length, 'max');
        var nh = homePets().length; ctx.stat('home', nh, 'max');
        if (nh >= 3) ctx.sticker('full');
      }

      // ---------- layout ----------
      function floorY(k) { return FY + (LH - FY) * (0.3 + 0.48 * k); }
      function crowd() { var n = homePets().length; return n <= 1 ? 1 : n === 2 ? 0.86 : n === 3 ? 0.76 : 0.68; }
      function petScale(p) {
        var r = R(p), k = clamp((r.y - floorY(0)) / Math.max(1, floorY(1) - floorY(0)), 0, 1);
        return HS * crowd() * (0.9 + 0.12 * k) * sizeK(p.sp);
      }
      // how far from the walls a pet must stay so its tail or nose never leaves the screen
      function edge(p) { var G = geo(p.sp, p.stage); return Math.min(LW / 2 - 4, Math.max(LW * 0.14, Math.max(-G.x0, G.x1) * petScale(p) + 4)); }
      function placePet(p, i, n) {
        var r = R(p);
        r.x = LW * (n <= 1 ? 0.5 : 0.25 + 0.5 * i / (n - 1)); r.y = floorY(n <= 1 ? 0.45 : [0.55, 0.25, 0.8][i % 3]);
        r.tx = r.x; r.ty = r.y; r.placed = true;
      }
      function layout() {
        var rc = cvWrap.getBoundingClientRect();
        W = Math.max(1, rc.width); H = Math.max(1, rc.height);
        DPR = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        S = clamp(Math.min(W / 400, H / 560), 0.6, 2.6);
        LW = W / S; LH = H / S;
        FY = Math.round(LH * 0.5);
        HS = clamp(Math.min(LW * 0.46 / 64, LH * 0.27 / 50), 1.2, 3.4);
        var hp = homePets();
        hp.forEach(function (p, i) {
          var r = R(p);
          if (!r.placed) placePet(p, i, hp.length);
          var mg = edge(p); r.x = clamp(r.x, mg, LW - mg); r.tx = clamp(r.tx, mg, LW - mg);
          r.y = clamp(r.y, floorY(0), floorY(1)); r.ty = clamp(r.ty, floorY(0), floorY(1));
        });
        if (GS && MG[mode] && MG[mode].layout) MG[mode].layout();
        if (!raf) draw();
      }

      // ---------- speech + particles ----------
      function say(p, text, dur) { if (!p) return; speech = { text: text, t: dur || 2.4, id: p.id }; }
      function burst(kind, x, y, n, o) {
        if (reduce) n = Math.ceil(n / 2);
        for (var i = 0; i < n; i++) {
          var q = { kind: kind, x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-90, -40), t: 0, life: rnd(0.9, 1.4), r: rnd(5, 9), rot: rnd(0, 6), col: LEAF_COLS[i % LEAF_COLS.length] };
          if (o) for (var k in o) q[k] = typeof o[k] === 'function' ? o[k](i) : o[k];
          parts.push(q);
        }
      }
      function popText(text, x, y, col, life) { parts.push({ kind: 'text', text: text, x: x, y: y, vx: 0, vy: life ? -24 : -50, t: 0, life: life || 0.9, col: col || '#cf412d' }); }
      function purr() {
        if (!NG.sound.pref().sfx) return;
        try { NG.sound.tone({ f: 70, to: 58, dur: 0.32, type: 'sawtooth', vol: 0.05, attack: 0.04 }); NG.sound.tone({ f: 140, to: 120, dur: 0.3, type: 'sine', vol: 0.08, attack: 0.04 }); } catch (e) {}
      }

      // ---------- top: pet chips ----------
      var chipEls = {};
      function renderChips() {
        top.innerHTML = ''; chipEls = {};
        top.classList.toggle('many', homePets().length >= 3);
        var cur = sel();
        homePets().forEach(function (p) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-chip' + (cur && p.id === cur.id ? ' on' : '') + (p.asleep ? ' zz' : '') + (canGrow(p) ? ' ready' : '');
          b.setAttribute('aria-label', p.name);
          b.innerHTML = '<span class="hd"><canvas width="92" height="80"></canvas><span class="tx"><span class="nm"></span><span class="st"></span><span class="zw-gb"><i></i></span></span></span>' +
            '<span class="nb">' + NEEDS.map(function (k) { return '<span class="nr" data-k="' + k + '">' + ICON[k] + '<span class="zw-bar"><i></i></span></span>'; }).join('') + '</span>' +
            '<span class="wb" aria-hidden="true"></span>';
          b.querySelector('.nm').textContent = p.name;
          if (p.name.length >= 7) b.querySelector('.nm').style.fontSize = p.name.length >= 8 ? '.86rem' : '.96rem';   // long names shrink a little instead of being cut
          b.querySelector('.st').textContent = 'poz. ' + levelOf(p.gp);
          b.querySelector('.zw-gb i').style.width = Math.round(growFrac(p) * 100) + '%';
          var c = b.querySelector('canvas'), cg = c.getContext('2d'); cg.scale(2, 2);
          fitPet(cg, p.sp, p.stage, 46, 40, { wear: wearOf(p), eye: p.asleep ? 'closed' : 'open', pose: p.asleep ? 'sleep' : 'stand' }, 2);
          b.onclick = function (e) {
            // a tap on a bar of the chosen pet: it says how that need is
            var nr = e.target.closest && e.target.closest('.nr');
            if (nr && save.sel === p.id && mode === 'home' && !food) {
              var k = nr.getAttribute('data-k'); ctx.sfx('tap');
              say(p, NEED_NAME[k] + ': ' + (p.asleep && k !== 'sleep' ? 'Chrr...' : needSay(k, p.needs[k])), 2.6); return;
            }
            tapChip(p);
          };
          top.appendChild(b); chipEls[p.id] = b;
          fillChip(p);
        });
        var f = document.createElement('button'); f.type = 'button'; f.className = 'zw-fam';
        f.innerHTML = ICON.fam + '<span>Rodzina</span>'; f.onclick = function () { if (mode === 'home' && !food) openFamily(); };
        top.appendChild(f);
      }
      function fillChip(q) {
        var c = chipEls[q.id]; if (!c) return;
        var low = null;
        NEEDS.forEach(function (k) {
          var v = q.needs[k], nr = c.querySelector('.nr[data-k="' + k + '"]'), i = nr.querySelector('i');
          i.style.width = Math.round(v) + '%'; i.style.background = needCol(v);
          var isLow = v < LOW_NEED && !(q.asleep && k === 'sleep');
          nr.classList.toggle('low', isLow);
          if (isLow && (!low || v < q.needs[low])) low = k;
        });
        // the badge shows the most urgent need, so it is easy to see who needs help
        c.classList.toggle('need', !!low && !q.asleep);
        var wb = c.querySelector('.wb');
        if (low && !q.asleep) { if (wb.getAttribute('data-k') !== low) { wb.innerHTML = ICON[low]; wb.setAttribute('data-k', low); } } else { wb.innerHTML = ''; wb.removeAttribute('data-k'); }
        c.querySelector('.zw-gb i').style.width = Math.round(growFrac(q) * 100) + '%';
        c.classList.toggle('zz', !!q.asleep); c.classList.toggle('ready', canGrow(q));
      }
      function tapChip(p) {
        if (mode !== 'home' || food || bellyBusy()) return;
        stopPlay(); ctx.sfx('tap');
        if (save.sel !== p.id) { select(p); return; }
        var r = R(p);
        if (p.asleep) { say(p, 'Chrr...', 1.2); return; }
        r.hop = 0;
        var L = levelOf(p.gp);
        say(p, canGrow(p) ? 'Mogę urosnąć! Dotknij: Urośnij!' : growLeft(p) ? 'Mam poziom ' + L + '. ' + (p.stage < 2 ? 'Na poziomie ' + GROW_LVL[p.stage] + ' urosnę!' : 'Opiekuj się mną!') : 'Poziom ' + L + '. Na dziś mam dość punktów, jutro więcej!', 2.6);
      }
      function select(p) {
        if (!p || !p.home) return;
        stopPlay();
        save.sel = p.id; persist();
        var r = R(p); if (!p.asleep) { r.hop = 0; r.happy = Math.max(r.happy, 0.8); }
        say(p, p.asleep ? 'Chrr...' : pick(['To ja, ' + p.name + '!', 'Hej!', 'Jestem!']), 1.4);
        renderChips(); buildBar(); updateHud(); syncMusic();
      }

      // ---------- bottom bar ----------
      function actBtn(icon, label, fn, hint) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-act' + (hint ? ' zw-hint' : '');
        b.innerHTML = ICON[icon] + '<span>' + label + '</span>'; b.onclick = fn; bar.appendChild(b); return b;
      }
      var barMsg = null, actBtns = [];
      function buildBar() {
        bar.innerHTML = ''; barMsg = null; actBtns = [];
        var p = sel();
        if (mode === 'home' && p && !p.asleep) {
          actBtns.push(actBtn('food', 'Jedzenie', openFood, p.needs.food < 35));
          actBtns.push(actBtn('bath', 'Kąpiel', startBath, p.needs.clean < 35));
          actBtns.push(actBtn('sleep', 'Spanie', startSleep, p.needs.sleep < 35));
          actBtns.push(actBtn('fun', 'Zabawa', openPlay, p.needs.fun < 35));
          actBtns.push(actBtn('hat', 'Szafa', openDress));
          syncBusy();
          return;
        }
        if (mode === 'dance' && GS) { MG.dance.bar(); return; }
        barMsg = document.createElement('div'); barMsg.className = 'zw-msg'; bar.appendChild(barMsg);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-big';
        if (mode === 'home') { b.textContent = 'Obudź'; b.onclick = function () { wake(sel(), false); }; }
        else if (mode === 'bath') { b.textContent = 'Gotowe'; b.className += ' sec'; b.onclick = function () { endBath(false); }; }
        else if (mode === 'polana') { b.textContent = 'Do domku'; b.onclick = leavePolana; }
        else { b.textContent = 'Koniec'; b.className += ' sec'; b.onclick = function () { if (GS && MG[mode]) MG[mode].finish(); }; }
        bar.appendChild(b);
        updateBarMsg();
      }
      function syncBusy() { actBtns.forEach(function (b) { b.disabled = !!food; }); }
      function updateBarMsg() {
        if (!barMsg) return;
        var s = '', p = sel();
        if (mode === 'home' && p) s = 'Cii... ' + p.name + ' śpi.';
        else if (mode === 'bath') s = bath && bath.rinse > 0 ? 'Płuczemy!' : 'Szoruj gąbką! ' + Math.round((bath ? Math.min(1, bath.prog) : 0) * 100) + '%';
        else if (mode === 'polana') s = meadowPets().length ? 'Leśna Polana. Dotknij zwierzątka.' : 'Leśna Polana';
        else if (GS && MG[mode] && MG[mode].msg) s = MG[mode].msg();
        barMsg.textContent = s;
      }
      function updateHud() {
        var p = sel();
        if (!p) return;
        if (mode === 'home' && !p.asleep) {
          var hints = [p.needs.food < 35, p.needs.clean < 35, p.needs.sleep < 35, p.needs.fun < 35];
          actBtns.forEach(function (b, i) { if (i < 4) b.classList.toggle('zw-hint', hints[i]); });
        }
        homePets().forEach(fillChip);
        syncGrow();
      }
      function syncMusic() {
        var p = sel(), want = isMini() ? 'play' : (mode === 'home' && p && p.asleep) ? 'calm' : 'cozy';
        if (mode === 'polana') want = 'cozy';
        if (want !== curMusic) { curMusic = want; ctx.music(want); }
      }
      function setMode(m) {
        stopPlay(); if (m === 'home') playT = Math.max(playT, rnd(8, 12));
        mode = m; drag = null;
        var showTop = m === 'home' || m === 'bath';
        top.style.display = showTop && save.pets.length ? '' : 'none';
        buildBar(); updateHud(); syncMusic();
        layout();
      }

      // ---------- sheets ----------
      function closeSheet() {
        if (!sheet) return;
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        s.wrap.style.pointerEvents = 'none';   // sliding away: a second tap must not buy again
        ctx.sfx('close');
        later(function () { s.wrap.remove(); }, reduce ? 0 : 260);
      }
      function openSheet(title, render, locked) {
        stopPlay();
        if (sheet) { sheet.wrap.remove(); sheet = null; }
        var wrap = document.createElement('div'); wrap.className = 'zw-sheetw';
        var sh = document.createElement('div'); sh.className = 'zw-sheet'; wrap.appendChild(sh);
        sh.innerHTML = '<div class="zw-sh-h"><h3></h3><span class="bal"><span>★</span> <b style="font-weight:400"></b></span>' + (locked ? '' : '<button type="button" class="zw-x" aria-label="Zamknij">×</button>') + '</div><div class="zw-sh-b"></div>';
        sh.querySelector('h3').textContent = title;
        var body = sh.querySelector('.zw-sh-b');
        if (!locked) {
          sh.querySelector('.zw-x').onclick = closeSheet;
          wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        }
        root.appendChild(wrap); void wrap.offsetWidth; wrap.classList.add('on');
        ctx.sfx('open');
        var S2 = { wrap: wrap, body: body, msg: null, step: null, data: {} };
        S2.render = function () {
          if (!wrap.isConnected) return;
          sh.querySelector('.bal b').textContent = ctx.balance();
          var sc = body.scrollTop;
          body.innerHTML = '';
          if (S2.msg) { note(body, S2.msg.text, S2.msg.cls); S2.msg = null; }
          render(body, S2);
          body.scrollTop = S2.keepScroll ? sc : 0; S2.keepScroll = false;
          if (S2.drawn) S2.cool = Date.now() + 350;   // a double tap must not hit the button that appears in the same place
          S2.drawn = true;
        };
        S2.title = function (t) { sh.querySelector('h3').textContent = t; };
        sheet = S2; S2.render();
        return S2;
      }
      function live(S2) { return sheet === S2 && S2.wrap.isConnected && Date.now() >= (S2.cool || 0); }
      function note(body, text, cls) { var p = document.createElement('p'); p.className = 'zw-note' + (cls ? ' ' + cls : ''); p.textContent = text; body.appendChild(p); return p; }
      function h4(body, text) { var p = document.createElement('div'); p.className = 'zw-h4'; p.textContent = text; body.appendChild(p); return p; }
      function row(body, img, title, sub, button, cls, subCls) {
        var r = document.createElement('div'); r.className = 'zw-row' + (cls ? ' ' + cls : '');
        r.innerHTML = '<img alt=""><div class="tx"><b></b><small></small></div>';
        r.querySelector('img').src = img; r.querySelector('b').textContent = title;
        var sm = r.querySelector('small');
        if (sub) { sm.textContent = sub; if (subCls) sm.className = subCls; } else sm.remove();
        if (button) { (Array.isArray(button) ? button : [button]).forEach(function (b) { r.appendChild(b); }); }
        body.appendChild(r); return r;
      }
      function btn(label, fn, cls, disabled) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-buy' + (cls ? ' ' + cls : '');
        b.textContent = label; b.disabled = !!disabled; b.onclick = fn; return b;
      }
      function bigBtn(body, label, fn, cls, disabled) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-big zw-wide' + (cls ? ' ' + cls : '');
        b.textContent = label; b.disabled = !!disabled; b.onclick = fn; body.appendChild(b); return b;
      }
      function poor(S2) { S2.msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', cls: 'warn' }; S2.render(); }

      // ---------- rename ----------
      function openRename(p) {
        if (overlay || !p) return;
        stopPlay();
        var o = document.createElement('div'); o.className = 'ng-panel';
        o.innerHTML = '<div class="ng-card"><h2>Imię zwierzątka</h2><input class="zw-name" maxlength="14" autocomplete="off" aria-label="Imię"><div class="ng-row"><button type="button" class="ng-btn">Zapisz</button><button type="button" class="ng-btn sec">Anuluj</button></div></div>';
        var inp = o.querySelector('input'); inp.value = p.name;
        function done(ok) {
          if (!overlay) return;
          if (ok) {
            var v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 14);
            p.name = v || SP[p.sp].names[0]; persist(); ctx.sfx('pop');
            R(p).happy = 1.2; say(p, 'Hura! Jestem ' + p.name + '!', 2.2);
            renderChips(); updateBarMsg();
          }
          o.remove(); overlay = null;
        }
        o.querySelector('.ng-btn').onclick = function () { done(true); };
        o.querySelector('.ng-btn.sec').onclick = function () { done(false); };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
        root.appendChild(o); overlay = o;
        try { inp.focus(); inp.select(); } catch (e) {}
      }

      // ---------- stage-up card ----------
      function showGrowCard() {
        var p = byId(growQ.shift());
        if (!p) return;
        stopPlay();
        var o = document.createElement('div'); o.className = 'ng-panel';
        o.innerHTML = '<div class="ng-card zw-card"><h2></h2><canvas></canvas><p></p><p class="muted"></p><button type="button" class="ng-btn">Hura!</button></div>';
        o.querySelector('h2').textContent = p.name + ' ' + vb(p.name, 'urósł', 'urosła') + '!';
        var c = o.querySelector('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
        c.width = 220 * d; c.height = 130 * d; c.style.width = '220px'; c.style.height = '130px';
        var cg = c.getContext('2d'); cg.scale(d, d);
        cg.fillStyle = '#fff4d6'; rr(cg, 0, 0, 220, 130, 18); cg.fill();
        for (var i = 0; i < 9; i++) star(cg, 14 + (i * 53) % 200, 14 + (i * 37) % 60, 5, i % 2 ? '#ffe066' : '#ffb3d1');
        fitPet(cg, p.sp, p.stage, 220, 128, { wear: wearOf(p), eye: 'happy', mouth: 'open' }, 10);
        o.querySelectorAll('p')[0].textContent = p.stage >= 2 ? 'Teraz ' + p.name + ' jest ' + vb(p.name, 'dorosły', 'dorosła') + '!' : 'Teraz to już nie maluch, tylko Młode!';
        o.querySelectorAll('p')[1].textContent = p.stage >= 2 ? 'Dziękuję za opiekę! Poziomy dalej rosną.' : 'Na poziomie 20 urośnie jeszcze raz!';
        o.querySelector('.ng-btn').onclick = function () {
          if (!overlay) return;
          o.remove(); overlay = null; ctx.sfx('star');
          var r = R(p); r.hop = 0; r.happy = 2; burst('heart', r.x, r.y - 40 * petScale(p), 6);
        };
        root.appendChild(o); overlay = o;
        ctx.sfx('win'); if (p.stage >= 2) ctx.sticker('grown');
        renderChips();
      }

      function bellyBusy() { return false; }

      // ---------- feeding ----------
      function isFav(p, k) { return SP[p.sp].fav.indexOf(k) >= 0; }
      function openFood() {
        var p0 = sel();
        if (mode !== 'home' || food || !p0 || p0.asleep) return;
        openSheet('Jedzenie', function (body, S2) {
          settle(Date.now());
          var p = sel(); if (!p) return;
          var full = p.needs.food >= 95;
          note(body, full ? p.name + ' ma pełny brzuszek. Może później!' : p.name + ': brzuszek ' + Math.round(p.needs.food) + ' na 100. Co dasz do jedzenia?', full ? 'ok' : '');
          var left = basket();
          row(body, thingThumb('koszyk'), 'Koszyk jabłek', left ? 'Za darmo · ' + left + ' ' + pl(left, 'jabłko', 'jabłka', 'jabłek') + ' na dziś (dla wszystkich)' : 'Pusty. Jutro znowu pełny!',
            btn(left ? 'Daj' : 'jutro', function () {
              if (!live(S2) || food || mode !== 'home' || basket() <= 0) return;
              if (p.needs.food >= 95) { S2.msg = { text: 'Brzuszek pełny! Może później.', cls: 'ok' }; S2.render(); return; }
              save.basketLeft = basket() - 1; persist(); closeSheet(); feed(p, FOODS[0], true);
            }, 'pick', !left || full));
          var garden = gardenRead(), crops = GARDEN.filter(function (c) { return pantryCount(garden, c.g) > 0; });
          if (crops.length) {
            h4(body, 'Z Twojego ogródka (za darmo)');
            crops.sort(function (a, b) { return (isFav(p, b.k) ? 1 : 0) - (isFav(p, a.k) ? 1 : 0); }).forEach(function (c) {
              var fav = isFav(p, c.k), n = pantryCount(garden, c.g);
              row(body, thingThumb(c.k), (fav ? '♥ ' : '') + c.n, 'Masz ' + n + ' · +' + c.food + ' do brzuszka' + (fav ? ' i humor' : c.fun ? ' · + humor' : ''),
                btn('Daj', function () {
                  if (!live(S2) || food || mode !== 'home') return;
                  if (p.needs.food >= 95) { S2.msg = { text: 'Brzuszek pełny! Może później.', cls: 'ok' }; S2.render(); return; }
                  if (!pantryTake(c.g)) { S2.render(); return; }
                  closeSheet(); feed(p, { k: c.k, n: c.n, food: c.food, fun: c.fun, garden: true }, true);
                }, 'pick', full), fav ? 'cur' : '', fav ? 'fav' : '');
            });
            h4(body, 'Ze sklepiku');
          } else note(body, 'Warzywa i owoce z Ogródka (ze Spiżarni) też można tu dawać za darmo.');
          var bal = ctx.balance();
          var list = FOODS.slice().sort(function (a, b) { return (isFav(p, b.k) ? 1 : 0) - (isFav(p, a.k) ? 1 : 0); });
          list.forEach(function (f) {
            var fav = isFav(p, f.k);
            row(body, thingThumb(f.k), (fav ? '♥ ' : '') + f.n, fav ? 'Ulubione! +' + f.food + ' do brzuszka i humor' : '+' + f.food + ' do brzuszka' + (f.fun ? ' · + humor' : ''),
              btn(f.price + ' ★', function () {
                if (!live(S2) || food || mode !== 'home') return;
                if (p.needs.food >= 95) { S2.msg = { text: 'Brzuszek pełny! Może później.', cls: 'ok' }; S2.render(); return; }
                if (!ctx.spend(f.price, f.n)) { poor(S2); return; }
                ctx.sfx('coin'); closeSheet(); feed(p, f, false);
              }, '', full || bal < f.price), fav ? 'cur' : '', fav ? 'fav' : '');
          });
          if (bal < 10) note(body, 'Gwiazdki zdobędziesz w Matmie, Angielskim i Polskim.');
        });
      }
      function feed(p, f, free) {
        var r = R(p), s = petScale(p), G = geo(p.sp, p.stage);
        stopPlay(); r.walking = false; r.tx = r.x; r.ty = r.y; if (duo && (duo.a === p.id || duo.b === p.id)) duo = null;
        var fx = r.x + r.face * (G.x1 + 10) * s;
        if (fx > LW - 24 || fx < 24) { r.face = -r.face; fx = r.x + r.face * (G.x1 + 10) * s; }
        speech = null;
        food = { f: f, id: p.id, x: fx, y: r.y - 4 * s, drop: 0, bites: 0, bt: 0.55, free: free };
        syncBusy();
      }
      function updateFood(dt) {
        var F = food, p = byId(F.id);
        if (!p || !p.home) { food = null; syncBusy(); return; }
        if (F.drop < 1) { F.drop = Math.min(1, F.drop + dt / 0.35); if (F.drop >= 1) ctx.sfx('land'); return; }
        F.bt -= dt;
        if (F.bt <= 0 && F.bites < 3) {
          F.bites++; F.bt = 0.5; ctx.sfx('pop');
          burst('crumb', F.x, F.y - 6 * HS, 5, { vy: function () { return rnd(-80, -30); }, col: '#d99a52', life: 0.6, r: 2.5 });
          if (F.bites === 3) F.bt = 0.35;
        } else if (F.bt <= 0 && F.bites >= 3) {
          food = null;
          var fav = isFav(p, F.f.k), r = R(p), s = petScale(p);
          addNeed(p, 'food', F.f.food); if (F.f.fun) addNeed(p, 'fun', F.f.fun); if (fav) addNeed(p, 'fun', FAV_FUN);
          ctx.stat('feeds', 1); cared(); ctx.sticker('feed'); grow(p, 'feed');
          r.happy = fav ? 2.2 : 1.6; r.hop = 0; if (fav) r.wagT = 2;
          burst('heart', r.x + r.face * 10 * s, r.y - 40 * s, fav ? 9 : 4);
          say(p, fav ? pick(['Moje ulubione!', 'Mniam! Uwielbiam to!']) : F.f.garden ? pick(['Prosto z ogródka! Mniam!', 'Ale świeże!', 'Pyszne z ogródka!']) : pick(['Mniam!', 'Pyszne!', 'Dziękuję!', 'Mniam, mniam!']), 1.9);
          persist(); updateHud(); syncBusy();
        }
      }

      // ---------- bath ----------
      function bathPos() { return { x: LW / 2, y: floorY(0.55) }; }
      function startBath() {
        var p = sel();
        if (mode !== 'home' || food || !p || p.asleep) return;
        var r = R(p), bp = bathPos(); r.x = bp.x; r.y = bp.y; r.tx = r.x; r.ty = r.y; r.face = 1; r.walking = false; r.belly = 0; r.roll = 0;
        duo = null;
        bath = { id: p.id, prog: 0, foam: [], sx: LW * 0.85, sy: bp.y + 10 * HS, rinse: 0, sndT: 0 };
        setMode('bath');
        ctx.sfx('splash');
        say(p, 'Szoruj gąbką!', 2);
      }
      function scrub(px, py, d) {
        var p = byId(bath.id), r = R(p), s = petScale(p), G = geo(p.sp, p.stage);
        var lx = (px - r.x) / s, ly = (py - (r.y - 9 * HS)) / s;
        if (lx < G.x0 - 4 || lx > G.x1 + 4 || ly < G.top - 4 || ly > 2) return;
        bath.prog += d / 1100;
        if (bath.foam.length < 34 && Math.random() < 0.5) bath.foam.push({ x: lx + rnd(-4, 4), y: ly + rnd(-4, 4), r: rnd(3, 6) });
        if (Math.random() < 0.35) parts.push({ kind: 'bubble', x: px, y: py, vx: rnd(-20, 20), vy: rnd(-70, -35), t: 0, life: rnd(0.9, 1.6), r: rnd(4, 9) });
        if (T - bath.sndT > 0.14) { bath.sndT = T; ctx.sfx('bubble'); }
        if (bath.prog >= 1 && bath.rinse === 0) {
          bath.rinse = 0.0001; ctx.sfx('splash'); later(function () { ctx.sfx('water'); }, 250);
          say(p, 'Płuczemy!', 1.4); updateBarMsg();
        }
      }
      function updateBath(dt) {
        var p = byId(bath.id), r = R(p), s = petScale(p), G = geo(p.sp, p.stage);
        if (bath.rinse > 0) {
          bath.rinse += dt;
          for (var i = 0; i < (reduce ? 1 : 3); i++) parts.push({ kind: 'drop', x: r.x + rnd(G.x0, G.x1) * s, y: Math.max(20, r.y + G.top * s - 40) + 10, vx: 0, vy: rnd(300, 400), t: 0, life: Math.min(0.9, (40 - G.top * s * 0.8) / 330), r: 3 });
          if (bath.foam.length && Math.random() < 0.4) { var f = bath.foam.pop(); parts.push({ kind: 'bubble', x: r.x + f.x * s, y: r.y - 9 * HS + f.y * s, vx: 0, vy: -40, t: 0, life: 0.5, r: f.r * s * 0.6 }); }
          if (bath.rinse > 1.5) endBath(true);
        } else if (!drag) {
          bath.sx += (LW * 0.85 - bath.sx) * Math.min(1, dt * 4);
          bath.sy += (r.y + 10 * HS - bath.sy) * Math.min(1, dt * 4);
        }
      }
      function endBath(full) {
        if (mode !== 'bath' || !bath) return;
        var p = byId(bath.id), pr = full ? 1 : Math.min(1, bath.prog);
        addNeed(p, 'clean', (100 - p.needs.clean) * pr);
        if (full) { ctx.stat('baths', 1); ctx.sticker('bath'); ctx.sfx('clear'); grow(p, 'bath'); if (upV('tub')) addNeed(p, 'fun', upV('tub')); }
        if (pr >= 0.3) cared();
        bath = null; parts = parts.filter(function (q) { return q.kind !== 'drop'; });
        setMode('home');
        var r = R(p);
        if (full) { r.happy = 1.8; r.hop = 0; burst('spark', r.x, r.y - 40 * HS, 6); say(p, 'Pachnę jak kwiatek!', 2.2); }
        else if (pr > 0.1) say(p, 'Trochę czyściej!', 1.8);
        persist();
      }

      // ---------- sleep ----------
      function sleepSpot(p) {
        var zs = homePets().filter(function (q) { return q.asleep; }), i = Math.max(0, zs.indexOf(p)), n = Math.max(1, zs.length);
        return { x: LW * (0.5 + (i - (n - 1) / 2) * (n > 3 ? 0.21 : 0.27)), y: floorY(0.42) };
      }
      function startSleep() {
        var p = sel();
        if (mode !== 'home' || food || !p || p.asleep) return;
        settle(Date.now());
        var friends = homePets().filter(function (q) { return q !== p && !q.asleep && q.needs.sleep < 60 && !(rt[q.id] && rt[q.id].belly > 0); });
        stopPlay();
        [p].concat(friends).forEach(function (q) { var r = R(q); q.asleep = true; r.wakeT = -1; r.walking = false; r.belly = 0; r.roll = 0; grow(q, 'sleep'); });
        duo = null;
        ctx.sfx('close'); ctx.sticker('sleep'); cared(); persist();
        setMode('home'); renderChips();
        say(p, 'Dobranoc!', 1.6);
        if (friends.length) later(function () { if (friends[0].asleep && !speech) say(friends[0], 'Ja też!', 1.4); }, 1700);
      }
      function wake(p, rested) {
        if (!p || !p.asleep) return;
        settleP(p, Date.now());
        p.asleep = false; persist();
        var r = R(p); r.hop = 0; r.happy = rested ? 1.6 : 0; r.wakeT = -1;
        ctx.sfx('open');
        if (mode === 'home' && p === sel()) { buildBar(); updateHud(); syncMusic(); }
        renderChips();
        say(p, rested ? 'Dzień dobry! Mam dużo siły!' : 'Ziew... Dzień dobry!', 2.2);
      }

      // ---------- dress up ----------
      function openDress() {
        var p0 = sel();
        if (mode !== 'home' || food || !p0 || p0.asleep) return;
        openSheet('Szafa', function (body, S2) {
          var p = sel(); if (!p) return;
          var own = jezyk().owned, wear = validWear(p), any = ITEMS.some(function (it) { return own[it.id]; });
          var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
          c.width = 220 * d; c.height = 120 * d; c.style.width = '220px'; c.style.height = '120px'; c.className = 'zw-prev';
          var cg = c.getContext('2d'); cg.scale(d, d);
          cg.fillStyle = '#fbe6c8'; cg.fillRect(0, 0, 220, 120); cg.fillStyle = '#e0b07a'; cg.fillRect(0, 96, 220, 24);
          cg.save(); cg.translate(0, -16); fitPet(cg, p.sp, p.stage, 220, 128, { wear: wear, eye: 'happy', mouth: 'smile' }, 8); cg.restore();
          body.appendChild(c);
          if (!any) note(body, 'Czapki, szaliki i okulary kupisz w grze Jeżyk w biegu (w Szafie). Potem ' + p.name + ' może je tu założyć!');
          ITEMS.forEach(function (it) {
            var has = !!own[it.id], worn = wear[it.slot] === it.id;
            var b = has ? btn(worn ? 'Zdejmij' : 'Załóż', function () {
              if (!live(S2)) return;
              p.wear[it.slot] = worn ? null : it.id; delete wearCache[p.id]; persist();
              ctx.sfx(worn ? 'close' : 'pop');
              if (!worn) { ctx.sticker('dress'); R(p).happy = 1.2; say(p, 'Ale ładnie!', 1.6); }
              renderChips(); S2.keepScroll = true; S2.render();
            }, 'pick') : btn('brak', null, 'pick', true);
            row(body, wearThumb(it), it.name, has ? (worn ? 'założone' : '') : 'kup w Jeżyku w biegu', b, worn ? 'cur' : has ? '' : 'lock');
          });
          if (!any) bigBtn(body, 'Idź do Jeżyka w biegu', function () { location.hash = 'jezyk'; }, 'sec');
        });
      }

      // ---------- family: home slots, the meadow, adoption ----------
      function newPet(sp, name) {
        var p = { id: save.nextId++, sp: sp, name: name, needs: { food: 80, fun: 80, clean: 80, sleep: 80 }, t: Date.now(), asleep: false,
          wear: { head: null, neck: null, eyes: null }, home: true, gp: 0, stage: 0, gDay: '', gSrc: {}, gToday: 0, born: today() };
        if (!save.wearInit) {
          var jz = jezyk();
          ITEMS.forEach(function (it) { if (jz.wear[it.slot] === it.id && jz.owned[it.id]) p.wear[it.slot] = it.id; });
          save.wearInit = true;
        }
        return p;
      }
      function defaultName(sp) {
        var used = {}; save.pets.forEach(function (p) { used[p.name.toLowerCase()] = 1; });
        var list = SP[sp].names;
        for (var i = 0; i < list.length; i++) if (!used[list[i].toLowerCase()]) return list[i];
        for (var n = 2; n < 99; n++) if (!used[(list[0] + ' ' + n).toLowerCase()]) return list[0] + ' ' + n;
        return list[0];
      }
      // the floor spot farthest from the other pets (a new pet must not land on top of another)
      function freeSpot(p) {
        var best = [LW / 2, floorY(0.5)], bd = -1;
        for (var i = 0; i < 12; i++) {
          var mg = edge(p), cx = mg + (LW - 2 * mg) * ((i % 4) / 3), cy = floorY([0.15, 0.5, 0.85][(i / 4) | 0]), md = 1e9;
          homePets().forEach(function (q) { if (q !== p && rt[q.id]) md = Math.min(md, Math.hypot(rt[q.id].x - cx, (rt[q.id].y - cy) * 2)); });
          if (md > bd) { bd = md; best = [cx, cy]; }
        }
        return best;
      }
      function toMeadow(p) {
        stopPlay(); p.home = false; p.asleep = false;
        delete rt[p.id];
        if (speech && speech.id === p.id) speech = null;
        if (duo && (duo.a === p.id || duo.b === p.id)) duo = null;
      }
      function toHome(p) {
        stopPlay(); p.home = true; p.asleep = false; p.t = Date.now();
        NEEDS.forEach(function (k) { p.needs[k] = Math.max(p.needs[k], 70); });   // rested and happy after the meadow
        delete rt[p.id];
        var r = R(p), fs = freeSpot(p); r.x = fs[0]; r.y = fs[1]; r.tx = r.x; r.ty = r.y; r.placed = true; r.hop = 0; r.happy = 1.6; r.wanderT = rnd(3, 5);
      }
      function familyChanged() {
        sel(); statsPets(); persist();
        renderChips(); if (mode === 'home') { buildBar(); updateHud(); syncMusic(); }
        layout();
      }
      function openFamily() {
        openSheet('Rodzina', function (body, S2) {
          if (S2.step === 'swap') { swapStep(body, S2, byId(S2.data.id)); return; }
          var hp = homePets(), mp = meadowPets(), bal = ctx.balance();
          note(body, 'W domku: ' + hp.length + ' z ' + save.slots + ' ' + pl(save.slots, 'miejsca', 'miejsc', 'miejsc') + '. Każde ma swoje potrzeby i rośnie od opieki.');
          hp.forEach(function (p) {
            row(body, petThumb(p.sp, p.stage, 64, 56, wearOf(p)), p.name, SP[p.sp].n + ' · ' + STAGES[p.stage].n + ' · poz. ' + levelOf(p.gp),
              btn('Na polanę', function () {
                if (!live(S2) || homePets().length < 2) return;
                toMeadow(p); ctx.sfx('whoosh'); ctx.toast(p.name + ' bawi się teraz na Leśnej Polanie.');
                familyChanged(); S2.render();
              }, 'pick', hp.length < 2), p.id === save.sel ? 'cur' : '');
          });
          for (var s = hp.length; s < save.slots; s++) row(body, slotThumb(true), 'Wolne miejsce', mp.length ? 'Adoptuj albo zaproś kogoś z polany.' : 'Adoptuj nowe zwierzątko.', null);
          if (save.slots < SLOT_PRICE.length) {
            var price = SLOT_PRICE[save.slots];
            row(body, slotThumb(false), 'Miejsce nr ' + (save.slots + 1) + ' w domku', 'Wtedy w domku zmieszczą się ' + (save.slots + 1) + ' zwierzątka naraz.',
              btn(price + ' ★', function () {
                if (!live(S2) || save.slots >= SLOT_PRICE.length || SLOT_PRICE[save.slots] !== price) return;
                if (!ctx.spend(price, 'miejsce w domku')) { poor(S2); return; }
                save.slots++; ctx.sfx('buy'); persist();
                S2.msg = { text: 'Hura! W domku jest nowe miejsce.', cls: 'ok' }; S2.render();
              }, '', bal < price), bal < price ? 'lock' : '');
          }
          if (mp.length) {
            h4(body, 'Na Leśnej Polanie');
            mp.forEach(function (p) {
              var free = freeSlots() > 0;
              row(body, petThumb(p.sp, p.stage, 64, 56, wearOf(p)), p.name, SP[p.sp].n + ' · poz. ' + levelOf(p.gp) + ' · za darmo',
                btn(free ? 'Do domku' : 'Zamień', function () {
                  if (!live(S2) || p.home) return;
                  if (freeSlots() > 0) { toHome(p); ctx.sfx('jump'); familyChanged(); closeSheet(); later(function () { select(p); say(p, 'Hura, jestem w domku!', 2); }, 50); }
                  else { S2.step = 'swap'; S2.data.id = p.id; S2.render(); }
                }, 'pick'));
            });
          }
          var full = save.pets.length >= MAX_PETS;
          bigBtn(body, 'Adoptuj zwierzątko · ' + ADOPT_PRICE + ' ★', function () { if (!live(S2) || full) return; openAdopt(); }, '', full || bal < ADOPT_PRICE);
          if (full) note(body, 'Masz już ' + MAX_PETS + ' zwierzątek. Wszystkie bawią się w domku albo na polanie.');
          else if (bal < ADOPT_PRICE) note(body, 'Na adopcję potrzeba ' + ADOPT_PRICE + ' ★. Zbieraj je w nauce!');
          bigBtn(body, 'Ulepszenia domku', function () { if (!live(S2)) return; openUps(); }, 'sec');
          bigBtn(body, 'Idź na Leśną Polanę', function () { if (!live(S2)) return; closeSheet(); enterPolana(); }, 'sec');
        });
      }
      function upThumb(k) { return thumb('up' + k, 56, 56, function (cg) { cg.translate(28, 28); cg.scale(1.2, 1.2); drawUpPic(cg, k); }); }
      function openUps() {
        openSheet('Ulepszenia domku', function (body, S2) {
          var bal = ctx.balance(), lvl = ctx.level();
          note(body, 'Ulepszenia zostają na zawsze i działają dla wszystkich zwierzątek. Każde można wyłączyć.');
          UPS.forEach(function (U) {
            var L = upLv(U.k), top = L >= U.v.length - 1, need = top ? 0 : U.lv[L], locked = !top && need > lvl, off = !!save.off[U.k];
            var sub = [L ? U.say(U.v[L]) : '', top ? 'Najwyższy poziom!' : (L ? 'Dalej: ' : '') + U.say(U.v[L + 1])].filter(Boolean).join(' · ');
            var buttons = [];
            if (top) { var ok = document.createElement('span'); ok.className = 'zw-top-ok'; ok.textContent = '✓'; buttons.push(ok); }
            else buttons.push(btn(locked ? 'poz. ' + need : U.price[L] + ' ★', function () {
              if (!live(S2) || upLv(U.k) !== L || U.lv[L] > ctx.level()) return;
              if (!ctx.spend(U.price[L], U.n)) { poor(S2); return; }
              settle(Date.now()); save.up[U.k] = L + 1; delete save.off[U.k];
              if (U.k === 'basket' && save.basketDay === today()) save.basketLeft = (save.basketLeft | 0) + 1;
              ctx.sfx('buy'); persist();
              S2.msg = { text: U.n + ': poziom ' + (L + 1) + '!', cls: 'ok' }; S2.render();
            }, '', locked || bal < U.price[L]));
            var dots = ''; for (var i = 1; i < U.v.length; i++) dots += i <= L ? '●' : '○';
            var r = row(body, upThumb(U.k), U.n + ' ' + dots, sub, buttons, 'zw-up' + (off ? ' off' : '') + (locked ? ' lock' : ''));
            if (L) {
              var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'zw-sw' + (off ? '' : ' on');
              sw.textContent = off ? 'Wyłączone' : 'Włączone'; sw.setAttribute('aria-pressed', off ? 'false' : 'true');
              sw.onclick = function () {
                if (!live(S2)) return;
                settle(Date.now());   // needs so far count with the old setting
                if (save.off[U.k]) delete save.off[U.k]; else save.off[U.k] = true;
                ctx.sfx(save.off[U.k] ? 'close' : 'open'); persist(); updateHud(); S2.render();
              };
              r.querySelector('.tx').appendChild(sw);
            }
          });
          bigBtn(body, 'Wróć', function () { if (!live(S2)) return; openFamily(); }, 'sec');
        });
      }
      function slotThumb(free) {
        return thumb('slot' + free, 56, 56, function (cg) {
          cg.beginPath(); cg.moveTo(8, 26); cg.lineTo(28, 9); cg.lineTo(48, 26); cg.lineWidth = 3; cg.strokeStyle = INK; cg.lineCap = 'round'; cg.lineJoin = 'round'; cg.stroke();
          rr(cg, 13, 24, 30, 24, 3); cg.fillStyle = free ? '#fbe6c8' : '#e6e9f2'; cg.fill(); outline(cg, 2.5);
          if (free) heart(cg, 28, 36, 6, '#ff7eb6');
          else { rr(cg, 21, 32, 14, 11, 2); cg.fillStyle = GOLD; cg.fill(); outline(cg, 2); cg.beginPath(); cg.arc(28, 32, 4.5, Math.PI, 0); outline(cg, 2); }
        });
      }
      // a meadow pet comes home and one home pet goes to the meadow instead
      function swapStep(body, S2, p) {
        if (!p || p.home) { S2.step = null; S2.render(); return; }
        S2.title('Zamiana');
        var c = document.createElement('img'); c.className = 'zw-prev'; c.src = petThumb(p.sp, p.stage, 160, 100, wearOf(p)); c.style.width = '160px'; c.style.height = '100px'; c.style.background = '#e8f7d8'; body.appendChild(c);
        note(body, p.name + ' chce wrócić do domku. Kto pójdzie się bawić na Leśną Polanę?');
        homePets().forEach(function (q) {
          row(body, petThumb(q.sp, q.stage, 64, 56, wearOf(q)), q.name, SP[q.sp].n + ' · poz. ' + levelOf(q.gp),
            btn('Na polanę', function () {
              if (!live(S2) || p.home || !q.home) return;
              toMeadow(q); toHome(p); ctx.sfx('jump'); closeSheet(); if (mode === 'polana') setMode('home'); familyChanged();
              later(function () { select(p); say(p, 'Hura, jestem w domku!', 2); }, 50);
            }, 'pick'));
        });
        bigBtn(body, 'Wróć', function () { if (!live(S2)) return; S2.step = null; S2.title('Rodzina'); S2.render(); }, 'sec');
      }
      function adoptCard(sp) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'zw-sp';
        b.innerHTML = '<img alt=""><span></span>';
        b.querySelector('img').src = petThumb(sp, 0, 88, 66);
        b.querySelector('span').textContent = SP[sp].n;
        return b;
      }
      function openAdopt() {
        var first = save.pets.length === 0;
        openSheet(first ? 'Wybierz zwierzątko' : 'Adopcja', function (body, S2) {
          var price = save.pets.length ? ADOPT_PRICE : 0, bal = ctx.balance();
          if (S2.step === 'name') {
            var sp = S2.data.sp;
            var img = document.createElement('img'); img.className = 'zw-prev'; img.src = petThumb(sp, 0, 180, 110); img.style.width = '180px'; img.style.height = '110px'; img.style.background = '#fbe6c8'; body.appendChild(img);
            note(body, SP[sp].n + '. Ulubione jedzenie: ' + SP[sp].fav.map(function (k) { return FOOD_BY[k].n.toLowerCase(); }).join(' i ') + '. Ulubiona zabawa: ' + MINI_BY[SP[sp].game].n + '.');
            note(body, 'Jak będzie mieć na imię?');
            var inp = document.createElement('input'); inp.className = 'zw-name'; inp.maxLength = 14; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Imię');
            inp.value = S2.data.name || defaultName(sp); body.appendChild(inp);
            inp.oninput = function () { S2.data.name = inp.value; };
            var full = freeSlots() <= 0;
            bigBtn(body, price ? 'Adoptuj za ' + price + ' ★' : 'Adoptuj (za darmo)', function () {
              if (!live(S2) || S2.busy) return;
              S2.data.name = inp.value.replace(/\s+/g, ' ').trim().slice(0, 14) || defaultName(sp);
              if (price && ctx.balance() < price) { poor(S2); return; }
              if (freeSlots() <= 0) { S2.step = 'where'; S2.render(); return; }
              adopt(S2, sp, S2.data.name, null);
            }, '', price > bal);
            if (full) note(body, 'Domek jest pełny. Za chwilę wybierzesz, kto zamieszka na Leśnej Polanie.');
            bigBtn(body, 'Wróć', function () { if (!live(S2)) return; S2.step = null; S2.render(); }, 'sec');
            return;
          }
          if (S2.step === 'where') {
            var sp2 = S2.data.sp;
            note(body, 'Domek jest pełny. Kto zamieszka na Leśnej Polanie? Stamtąd można wrócić do domku za darmo.');
            row(body, petThumb(sp2, 0, 64, 56), S2.data.name + ' (nowe)', 'zamieszka na polanie', btn('Na polanę', function () { adopt(S2, sp2, S2.data.name, 'new'); }, 'pick'));
            homePets().forEach(function (q) {
              row(body, petThumb(q.sp, q.stage, 64, 56, wearOf(q)), q.name, 'pójdzie na polanę, a ' + S2.data.name + ' do domku', btn('Na polanę', function () { adopt(S2, sp2, S2.data.name, q.id); }, 'pick'));
            });
            bigBtn(body, 'Wróć', function () { if (!live(S2)) return; S2.step = 'name'; S2.render(); }, 'sec');
            return;
          }
          note(body, first ? 'Kto zamieszka w Twoim domku? Pierwsze zwierzątko jest za darmo. Na początku to maluch. Opieka daje poziomy, a na poziomie 10 i 20 zwierzątko urośnie!' : 'Nowe zwierzątko: ' + ADOPT_PRICE + ' ★. Na początku to maluch.');
          if (!first && bal < price) note(body, 'Za mało gwiazdek. Zbieraj je w nauce!', 'warn');
          var grid = document.createElement('div'); grid.className = 'zw-grid'; body.appendChild(grid);
          SP_ORDER.forEach(function (sp) {
            var b = adoptCard(sp);
            b.onclick = function () { if (!live(S2)) return; ctx.sfx('tap'); S2.step = 'name'; S2.data = { sp: sp, name: defaultName(sp) }; S2.render(); };
            grid.appendChild(b);
          });
          if (!first) bigBtn(body, 'Wróć', function () { if (!live(S2)) return; openFamily(); }, 'sec');
        }, first);
      }
      function adopt(S2, sp, name, send) {
        if (!live(S2) || S2.busy) return;
        if (save.pets.length >= MAX_PETS) { S2.msg = { text: 'Masz już ' + MAX_PETS + ' zwierzątek.', cls: 'warn' }; S2.step = null; S2.render(); return; }
        var first = save.pets.length === 0, price = first ? 0 : ADOPT_PRICE;
        if (send == null && freeSlots() <= 0) { S2.step = 'where'; S2.render(); return; }
        if (price && !ctx.spend(price, 'adopcja: ' + SP[sp].n)) { poor(S2); return; }
        S2.busy = true;
        var p = newPet(sp, name);
        if (send === 'new') p.home = false;
        else if (send != null) { var q = byId(send); if (q && q.home) toMeadow(q); }
        save.pets.push(p);
        if (p.home) { var r = R(p), fs = freeSpot(p); r.x = fs[0]; r.y = fs[1]; r.tx = r.x; r.ty = r.y; r.placed = true; r.hop = 0; r.happy = 2; r.wanderT = rnd(3, 5); save.sel = p.id; }
        ctx.sfx(price ? 'buy' : 'star'); ctx.sticker('sp-' + sp);
        closeSheet();
        if (first) setMode('home');
        familyChanged();
        if (p.home) { say(p, 'Cześć! Jestem ' + p.name + '!', 2.4); burst('heart', R(p).x, R(p).y - 40 * petScale(p), 6); }
        else ctx.toast(p.name + ' ' + vb(p.name, 'zamieszkał', 'zamieszkała') + ' na Leśnej Polanie.');
        if (first && !save.seenHelp) { save.seenLvl = true; later(showHelp, 400); }
      }

      // ---------- the meadow ----------
      var mrt = {};                // meadow positions
      function MR(p) {
        var r = mrt[p.id];
        if (!r) {
          var mp = meadowPets(), i = Math.max(0, mp.indexOf(p)), n = mp.length;
          r = mrt[p.id] = { x: LW * (n <= 1 ? 0.55 : 0.16 + 0.68 * i / (n - 1)), y: 0, k: [0.2, 0.8, 0.45, 1, 0.05, 0.65, 0.3][i % 7], tx: 0, tk: 0, face: Math.random() < 0.5 ? 1 : -1, legs: 0, walking: false, hop: -1, wT: rnd(0.5, 3), seed: Math.random() * 10 };
        }
        return r;
      }
      function meadowY(k) { return LH * 0.6 + k * (LH * 0.32); }
      function enterPolana() {
        if (mode !== 'home') return;
        food = null; duo = null; speech = null;
        setMode('polana');
        ctx.sfx('whoosh');
      }
      function leavePolana() { if (mode !== 'polana') return; closeSheet(); setMode('home'); ctx.sfx('open'); }
      function openMeadowPet(p) {
        openSheet(p.name, function (body, S2) {
          if (S2.step === 'swap') { swapStep(body, S2, p); return; }
          var img = document.createElement('img'); img.className = 'zw-prev'; img.src = petThumb(p.sp, p.stage, 160, 100, wearOf(p)); img.style.width = '160px'; img.style.height = '100px'; img.style.background = '#e8f7d8'; body.appendChild(img);
          note(body, p.name + ' (' + SP[p.sp].n.toLowerCase() + ', ' + STAGES[p.stage].n.toLowerCase() + ', poziom ' + levelOf(p.gp) + ') bawi się na Leśnej Polanie. Poziomy zdobywa tylko w domku, od opieki.');
          bigBtn(body, freeSlots() > 0 ? 'Zabierz do domku (za darmo)' : 'Zamień z kimś z domku', function () {
            if (!live(S2) || p.home) return;
            if (freeSlots() > 0) { toHome(p); ctx.sfx('jump'); closeSheet(); setMode('home'); familyChanged(); later(function () { select(p); say(p, 'Hura, jestem w domku!', 2); }, 50); }
            else { S2.step = 'swap'; S2.render(); }
          });
          bigBtn(body, 'Niech się bawi', function () { if (live(S2)) closeSheet(); }, 'sec');
        });
      }
      function updatePolana(dt) {
        meadowPets().forEach(function (p) {
          var r = MR(p);
          if (r.hop >= 0) { r.hop += dt / 0.5; if (r.hop >= 1) r.hop = -1; }
          r.wT -= dt;
          if (r.wT <= 0) {
            r.wT = rnd(2, 5);
            if (Math.random() < 0.3) { r.hop = 0; }
            else {
              // somewhere free: the farthest of a few random spots from the other meadow pets
              var bd = -1;
              for (var c = 0; c < 5; c++) {
                var cx = rnd(LW * 0.12, LW * 0.88), ck = rnd(0, 1), md = 1e9;
                meadowPets().forEach(function (q) { if (q !== p) { var rq = MR(q); md = Math.min(md, Math.hypot(rq.x - cx, (meadowY(rq.k) - meadowY(ck)) * 2.2)); } });
                if (md > bd) { bd = md; r.tx = cx; r.tk = ck; }
              }
            }
          }
          var dx = r.tx - r.x, dk = r.tk - r.k;
          if (r.tx && (Math.abs(dx) > 2 || Math.abs(dk) > 0.01)) {
            r.walking = true; if (Math.abs(dx) > 2) r.face = dx > 0 ? 1 : -1;
            var sp = 40 * dt * HS / 2;
            r.x += Math.sign(dx) * Math.min(Math.abs(dx), sp); r.k += Math.sign(dk) * Math.min(Math.abs(dk), sp / (LH * 0.3)); r.legs += dt * 9;
          } else r.walking = false;
          r.y = meadowY(r.k);
        });
      }
      function meadowScale(p) { var r = MR(p), n = meadowPets().length; return HS * 0.62 * (n > 9 ? Math.max(0.62, Math.sqrt(9 / n)) : 1) * (0.85 + 0.25 * r.k) * sizeK(p.sp); }   // a crowded meadow draws everyone smaller

      // ---------- play sheet + mini-game frame ----------
      function openPlay() {
        var p0 = sel();
        if (mode !== 'home' || food || !p0 || p0.asleep) return;
        openSheet('Zabawa', function (body, S2) {
          var p = sel(); if (!p) return;
          note(body, p.name + ' uwielbia zabawy! Po grze ma super humor. Jedna gra: ' + GAME_PRICE + ' ★. ♥ to ulubiona zabawa.');
          var seg = document.createElement('div'); seg.className = 'zw-seg';
          ['Łatwo', 'Trudniej'].forEach(function (lab, i) {
            var b = document.createElement('button'); b.type = 'button'; b.textContent = lab; b.className = save.diff === i ? 'on' : '';
            b.onclick = function () { if (!live(S2)) return; save.diff = i; persist(); ctx.sfx('tap'); S2.keepScroll = true; S2.render(); };
            seg.appendChild(b);
          });
          body.appendChild(seg);
          var bal = ctx.balance(), favK = SP[p.sp].game;
          MINI.slice().sort(function (a, b) { return (b.k === favK) - (a.k === favK); }).forEach(function (gm) {
            var best = save.best[gm.k] || 0, fav = gm.k === favK;
            row(body, gameThumb(gm.k, p), (fav ? '♥ ' : '') + gm.n, (fav ? 'Ulubiona zabawa! ' : '') + gm.sub + (best ? ' Rekord: ' + best + '.' : ''),
              btn(GAME_PRICE + ' ★', function () {
                if (!live(S2) || mode !== 'home') return;
                if (!ctx.spend(GAME_PRICE, gm.n)) { poor(S2); return; }
                ctx.sfx('coin'); closeSheet(); startMini(gm.k);
              }, '', bal < GAME_PRICE), fav ? 'cur' : '', fav ? 'fav' : '');
          });
        });
      }
      function gameThumb(k, p) {
        return thumb('g' + k + p.sp + p.stage, 56, 56, function (cg) {
          var bg = { catch: '#e2f4ff', hide: '#fff0d8', aport: '#e3f5d6', dig: '#f3e2c8', bubbles: '#e6f0ff', dance: '#f1e6ff', wheel: '#fff4d6' }[k];
          cg.fillStyle = bg; rr(cg, 1, 1, 54, 54, 12); cg.fill();
          if (k === 'catch') { drawApple(cg, 16, 13, 6); drawApple(cg, 40, 20, 6, '#f5c330'); }
          if (k === 'hide') { cg.save(); cg.translate(36, 50); leafPile(cg, 17, seedLeaves(17, 6)); cg.restore(); }
          if (k === 'aport') { cg.save(); cg.translate(42, 14); THING.pilka(cg, 7); cg.restore(); }
          if (k === 'dig') { cg.beginPath(); cg.ellipse(40, 46, 13, 6, 0, 0, Math.PI * 2); cg.fillStyle = '#8a5a33'; cg.fill(); outline(cg, 1.5); cg.save(); cg.translate(40, 38); THING.orzechy(cg, 6); cg.restore(); }
          if (k === 'bubbles') { [[14, 14, 7], [38, 10, 5], [44, 24, 6]].forEach(function (b) { cg.beginPath(); cg.arc(b[0], b[1], b[2], 0, Math.PI * 2); cg.fillStyle = 'rgba(200,230,255,.7)'; cg.fill(); cg.lineWidth = 1.4; cg.strokeStyle = '#3f86d8'; cg.stroke(); }); }
          if (k === 'dance') { cg.font = '16px ' + FONT; cg.fillStyle = PURPLE; cg.fillText('♪', 8, 18); cg.fillText('♫', 40, 14); }
          if (k === 'wheel') { cg.beginPath(); cg.arc(28, 28, 22, 0, Math.PI * 2); cg.lineWidth = 3; cg.strokeStyle = '#c98f5a'; cg.stroke(); }
          var box = k === 'hide' ? [2, 10, 34, 32] : k === 'dig' ? [2, 14, 34, 40] : [6, 14, 44, 40];
          cg.save(); cg.translate(box[0], box[1]); fitPet(cg, p.sp, p.stage, box[2], box[3], { eye: 'happy', mouth: 'open' }, 1); cg.restore();
        });
      }
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function startMini(k) {
        closePanel(); closeSheet(); food = null; speech = null; parts = []; GS = null; duo = null;
        mode = k; MG[k].start();
        setMode(k);
      }
      function endMini(k, title, lines, frac, score) {
        var p = sel(), fav = p && SP[p.sp].game === k;
        var gain = 25 + 45 * clamp(frac, 0, 1); if (fav) gain *= 1.3; gain = Math.round(gain);
        var fresh = score > (save.best[k] || 0);
        save.best[k] = Math.max(save.best[k] || 0, score);
        addNeed(p, 'fun', gain);
        ctx.stat('plays', 1); cared();
        var gp = grow(p, 'game');
        persist();
        ctx.sfx('win');
        lines.push('Humor: +' + gain + (fav ? ' (ulubiona zabawa ♥)' : ''));
        if (gp) lines.push({ text: p.name + ': poziom ' + levelOf(p.gp) + (canGrow(p) ? '. Może urosnąć!' : ''), muted: true });
        if (fresh && score > 0) lines.push({ text: 'Nowy rekord!', muted: true });
        panel = ctx.panel({
          title: title, lines: lines, price: GAME_PRICE, note: MINI_BY[k].n, button: 'Jeszcze raz',
          onPlay: function () { panel = null; ctx.sfx('coin'); startMini(k); },
          secondary: [{ label: 'Do domku', onClick: function () { panel = null; goHome(); } }]
        });
      }
      function goHome() {
        GS = null; parts = [];
        setMode('home');
        var p = sel(); if (!p) return;
        var r = R(p); r.happy = 1.6; r.hop = 0; burst('heart', r.x, r.y - 40 * petScale(p), 4);
        say(p, 'Ale było fajnie!', 2);
      }
      // fit a pet to a width (mini-games): the same size for every species and stage
      function fitScale(p, w, h) { var G = geo(p.sp, p.stage); return Math.min(w / (G.x1 - G.x0), h ? h / -G.top : 99); }
      function drawPetAt(p, x, y, s, face, st, rot) {
        g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(s * face, s);
        var o = { t: T, stage: p.stage, wear: wearOf(p), seed: R(p).seed }; for (var k in st) o[k] = st[k];
        drawCritter(g, p.sp, o); g.restore();
      }
      function shadow(x, y, w) { g.beginPath(); g.ellipse(x, y + 1, w, w * 0.16, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(60,40,20,.13)'; g.fill(); }

      // ---------- petting ----------
      function petAt(px, py) {
        var list = homePets().slice().sort(function (a, b) { return R(b).y - R(a).y; });
        for (var i = 0; i < list.length; i++) {
          var p = list[i], r = R(p), s = petScale(p), G = geo(p.sp, p.stage, poseOf(p));
          var lx = (px - r.x) / (s * r.face), ly = (py - petY(p)) / s;
          if (lx > G.x0 - 6 && lx < G.x1 + 6 && ly > G.top - 6 && ly < 4) return p;
        }
        return null;
      }
      function zoneAt(p, px, py) {
        var r = R(p), s = petScale(p), G = geo(p.sp, p.stage);
        if (r.belly > 0) return 'belly';
        var lx = (px - r.x) / (s * r.face), ly = (py - petY(p)) / s;
        if (Math.hypot(lx - G.hx, ly - G.hy) < G.hr * 1.35) return (ly > G.hy + G.hr * 0.15 && lx > G.hx - G.hr * 0.2) ? 'cheek' : 'head';
        if (SP[p.sp].tail && lx < G.cx - G.rx * 0.6) return 'tail';
        return 'back';
      }
      function petTap(p) {
        var r = R(p), s = petScale(p), now = T;
        taps = taps.filter(function (t) { return now - t < 2; }); taps.push(now);
        if (taps.length >= 5) {
          taps = [];
          r.wig = 1.6; r.happy = 1.8; ctx.sfx('combo'); ctx.sticker('tickle');
          say(p, 'Ha ha ha! Łaskocze!', 1.8);
          burst('note', r.x, r.y - 45 * s, 5, { col: PURPLE });
        } else {
          var x = Math.random();
          if (x < 0.3) { r.hop = 0; ctx.sfx('jump'); }
          else if (x < 0.55) { r.wig = 0.6; ctx.sfx('pop'); say(p, pick(['Hi hi!', 'Hej!', 'To ja!']), 1.2); }
          else if (x < 0.75 && !r.ball && !r.spin) { if (SP[p.sp].hog) r.ball = 0.9; else r.spin = 0.001; ctx.sfx('rotate'); }
          else { r.happy = 1; ctx.sfx('bubble'); }
          burst('heart', r.x + r.face * 6 * s, r.y - 42 * s, 2);
        }
        addNeed(p, 'fun', 1.5, PET_FUN_CAP);
      }
      function stroke(p, d, x, y) {
        var r = R(p), s = petScale(p);
        if (r.roll > 0) return;
        if (r.belly > 0) { bellyRub(p, d, x, y); return; }
        r.strokeT = 0.4;
        r.acc = (r.acc || 0) + d; r.facc = (r.facc || 0) + d;
        r.pm += d / 1000;
        if (r.facc > 70) { r.facc = 0; addNeed(p, 'fun', 0.5, PET_FUN_CAP); }
        if (r.acc > 45) {
          r.acc = 0;
          var z = zoneAt(p, x, y);
          if (SP[p.sp].cat && z !== 'cheek') { r.purr = 0.9; if (T - (r.purrS || 0) > 0.45) { r.purrS = T; purr(); } if (Math.random() < 0.14 && !speech) say(p, pick(['Mrrr...', 'Mrrau!', 'Mrr, mrr...']), 1.1); if (z === 'tail') r.wagT = 1; }
          else if (z === 'head') { r.purr = 0.9; if (T - (r.purrS || 0) > 0.55) { r.purrS = T; purr(); } if (Math.random() < 0.08 && !speech) say(p, 'Mrrr...', 1.1); }
          else if (z === 'cheek') { r.happy = Math.max(r.happy, 0.9); if (Math.random() < 0.15) { ctx.sfx('bubble'); if (!speech) say(p, 'Hi hi!', 1); } }
          else if (z === 'tail') { r.wagT = 1.3; if (Math.random() < 0.2) ctx.sfx('swap'); if (Math.random() < 0.1 && !speech) say(p, 'Mój ogonek!', 1.2); }
          else { r.wig = Math.max(r.wig, 0.35); r.happy = Math.max(r.happy, 0.5); if (Math.random() < 0.15) ctx.sfx('pop'); }
          burst('heart', x, y - 10, 1);
        }
        if (r.pm >= 1 && !p.asleep) startBelly(p);
      }
      function startBelly(p) {
        var r = R(p);
        r.pm = 0; r.belly = 6; r.rollIn = true; r.roll = reduce ? 0 : 0.4; r.rub = 0; r.rubbed = false; r.walking = false; r.hop = -1; r.ball = 0; r.spin = 0;
        if (duo && (duo.a === p.id || duo.b === p.id)) duo = null;
        stopPlay();
        ctx.sfx('whoosh');
        grow(p, 'pet'); cared(); persist();
        later(function () { if (p.home && R(p).belly > 0) say(p, 'Pogłaszcz mi brzuszek!', 2.2); }, reduce ? 0 : 420);
      }
      function bellyRub(p, d, x, y) {
        var r = R(p);
        r.rub += d; r.belly = Math.min(9, r.belly + d / 500); r.wig = Math.max(r.wig, 0.3);
        r.racc = (r.racc || 0) + d;
        if (r.racc > 28) {
          r.racc = 0; burst('heart', x, y - 8, 2, { r: function () { return rnd(6, 10); } });
          if (T - (r.gigT || 0) > 0.16) { r.gigT = T; ctx.sfx(Math.random() < 0.5 ? 'bubble' : 'pop'); }
          addNeed(p, 'fun', 0.8, PET_FUN_CAP + 15);
        }
        if (!r.rubbed && r.rub > 80) {
          r.rubbed = true;
          ctx.stat('bellies', 1); ctx.sticker('belly'); ctx.sfx('combo');
          say(p, SP[p.sp].hog ? 'Hi hi! Brzuszek jest mięciutki!' : 'Hi hi hi! Łaskocze!', 2);
          burst('note', R(p).x, R(p).y - 40 * petScale(p), 4, { col: PURPLE });
          persist();
        }
      }
      function poseOf(p) {
        var r = R(p);
        if (p.asleep) return 'sleep';
        if (r.belly > 0 && !(r.roll > 0 && r.roll > 0.2 && r.rollIn)) return 'belly';
        if (r.roll > 0 && !r.rollIn && r.roll > 0.2) return 'belly';
        if (r.ball > 0 && SP[p.sp].hog) return 'ball';
        return 'stand';
      }
      function petY(p) { var r = R(p); return r.y - (r.hop >= 0 ? Math.sin(Math.PI * r.hop) * 16 : 0); }

      // =====================================================================
      // Mini-games. Each: start, layout, update, draw, down/move/up, finish, msg, frac (0..1 for "humor").
      // The selected pet plays; its size is fitted so every species/stage plays the same.
      // =====================================================================
      function text(s, x, y, size, col, align) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = size * 0.26; g.strokeStyle = '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col || INK; g.fillText(s, x, y);
      }
      function pill(x, y, w, h, s, col) { rr(g, x, y, w, h, h / 2); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5); text(s, x + w / 2, y + h / 2 + 1, Math.round(h * 0.6), col || INK); }
      function skyGrad(a, b, y1) { var sk = g.createLinearGradient(0, 0, 0, y1); sk.addColorStop(0, a); sk.addColorStop(1, b); g.fillStyle = sk; g.fillRect(0, 0, LW + 2, LH + 2); }
      function hedge(y, col) {
        g.beginPath(); g.moveTo(0, y);
        for (var x = 0; x <= LW + 30; x += 30) g.arc(x, y, 22, Math.PI, 0);
        g.lineTo(LW + 30, y + 30); g.lineTo(0, y + 30); g.closePath(); g.fillStyle = col || '#58b25c'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
      }
      var MG = {};

      // ----- Łap jabłka -----
      MG.catch = {
        start: function () {
          var hard = save.diff === 1;
          GS = { hard: hard, total: hard ? 26 : 20, spawned: 0, caught: 0, pts: 0, gold: false, items: [], spawnT: 0.8, x: LW / 2, tx: LW / 2, face: 1, legs: 0, gy: LH - 46, endT: -1, done: false };
        },
        layout: function () { GS.gy = LH - 46; },
        msg: function () { return 'Złapane: ' + GS.caught + ' · zostało ' + (GS.total - GS.spawned + GS.items.length); },
        frac: function () { return GS.caught / GS.total; },
        hs: function () { return fitScale(sel(), LW * 0.3, LH * 0.2); },
        update: function (dt) {
          var c = GS; if (c.done) return;
          var p = sel(), hs = this.hs(), G = geo(p.sp, p.stage), half = (G.x1 - G.x0) / 2 * hs;
          var dx = c.tx - c.x, mv = Math.max(-700 * dt, Math.min(700 * dt, dx));
          c.x = clamp(c.x + mv, half, LW - half);
          if (Math.abs(mv) > 0.5) { c.face = mv > 0 ? 1 : -1; c.legs += dt * 14; }
          c.spawnT -= dt;
          if (c.spawnT <= 0 && c.spawned < c.total) {
            c.spawned++;
            var sp = (c.hard ? 210 : 140) * rnd(0.85, 1.15) * Math.max(1, LH / 640);
            c.items.push({ x: rnd(28, LW - 28), y: -20, vy: sp, gold: Math.random() < 0.12, rot: rnd(-0.4, 0.4), sway: c.hard ? rnd(0, 6) : 0 });
            c.spawnT = (c.hard ? 0.72 : 1.0) * rnd(0.8, 1.2);
            updateBarMsg();
          }
          var bx = c.x + c.face * G.back.x * hs, by = c.gy + G.back.y * hs, rad = LW * (c.hard ? 0.076 : 0.1);
          for (var i = c.items.length - 1; i >= 0; i--) {
            var it = c.items[i];
            if (it.land) { it.land += dt; if (it.land > 0.7) { c.items.splice(i, 1); updateBarMsg(); } continue; }
            it.y += it.vy * dt; if (it.sway) it.x = clamp(it.x + Math.sin(T * 2 + it.sway) * 30 * dt, 20, LW - 20);
            if (it.y >= by - 14 && it.y <= by + 18 && Math.abs(it.x - bx) < rad + 12) {
              c.items.splice(i, 1); c.caught++; c.pts += it.gold ? 3 : 1; if (it.gold) c.gold = true;
              ctx.sfx(it.gold ? 'star' : 'pop');
              popText(it.gold ? '+3' : '+1', it.x, it.y - 16, it.gold ? GOLD : '#cf412d');
              updateBarMsg();
            } else if (it.y >= c.gy - 9) { it.y = c.gy - 9; it.land = 0.001; ctx.sfx('land'); }
          }
          if (c.spawned >= c.total && !c.items.length && c.endT < 0) c.endT = 0.7;
          if (c.endT > 0) { c.endT -= dt; if (c.endT <= 0) this.finish(); }
        },
        draw: function () {
          var c = GS, p = sel();
          skyGrad('#8fcdf8', '#e8f7ff', c.gy);
          g.beginPath(); g.arc(LW - 50, 60, 26, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
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
          var hs = this.hs(), G = geo(p.sp, p.stage), hog = SP[p.sp].hog;
          shadow(c.x, c.gy, (G.x1 - G.x0) * hs * 0.4);
          drawPetAt(p, c.x, c.gy, hs, c.face, { legs: c.legs, eye: 'open', mouth: 'smile', apples: hog ? c.caught : 0, gold: c.gold, basket: hog ? null : 1 });
          if (!hog && c.caught) {
            var bx = c.x + c.face * G.back.x * hs, by = c.gy + (G.back.y - 3 * Math.max(0.7, G.kb)) * hs - 6 * hs * Math.max(0.7, G.kb);
            for (var k = 0; k < Math.min(5, c.caught); k++) drawApple(g, bx + [0, -6, 6, -3, 3][k] * hs * 0.9, by - [0, 1, 1, 6, 6][k] * hs * 0.9, 4.2 * hs * 0.9, k === 0 && c.gold ? '#f5c330' : null);
          }
          rr(g, 10, 12, 92, 40, 18); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5);
          drawApple(g, 34, 33, 11); text(String(c.caught), 54, 32, 28, '#cf412d', 'left');
        },
        down: function (q) { GS.tx = q.x; drag = { kind: 'move' }; return true; },
        move: function (q) { GS.tx = q.x; },
        key: function (e) { if (e.key === 'ArrowLeft') { GS.tx = GS.x - 60; e.preventDefault(); } if (e.key === 'ArrowRight') { GS.tx = GS.x + 60; e.preventDefault(); } },
        finish: function () {
          var c = GS; if (!c || c.done) return; c.done = true;
          var seen = Math.max(1, c.spawned - c.items.length); c.items = [];
          endMini('catch', c.caught >= c.total * 0.8 ? 'Super łapanie!' : 'Koniec zabawy', [
            'Złapane jabłka: ' + c.caught + ' z ' + c.total + (seen < c.total ? ' (koniec wcześniej)' : ''), 'Punkty: ' + c.pts
          ], c.caught / c.total, c.pts);
        }
      };

      // ----- Chowany -----
      function seedLeaves(r, n) {
        var out = [];
        for (var i = 0; i < n; i++) {
          var dx = rnd(-0.95, 0.95) * r, tp = 0.9 * r * Math.sqrt(Math.max(0, 1 - (dx / r) * (dx / r)));
          out.push({ dx: dx, dy: -rnd(0.05, 1) * tp, rot: rnd(0, 6.28), col: LEAF_COLS[(Math.random() * LEAF_COLS.length) | 0], s: rnd(0.8, 1.2) });
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
      MG.hide = {
        start: function () {
          var hard = save.diff === 1;
          GS = { hard: hard, n: hard ? 4 : 3, round: 0, found: 0, first: 0, tries: 0, piles: [], phase: 'show', t: 0, swaps: [], sw: null, msg: '', done: false };
          this.layout(); this.round();
        },
        layout: function () {
          var h = GS, y1 = LH * 0.5, y2 = LH * 0.8;
          h.r = clamp(Math.min(LW * 0.2, (y2 - y1) * 0.5, 100), 36, 100);
          h.top = y1 - h.r * 1.5;
          h.slots = (h.n === 3 ? [[0.27, y1], [0.73, y1], [0.5, y2]] : [[0.27, y1], [0.73, y1], [0.27, y2], [0.73, y2]]).map(function (q) { return { x: LW * q[0], y: q[1] }; });
          h.piles.forEach(function (p) { if (!h.sw || (p !== h.sw.a && p !== h.sw.b)) { p.x = h.slots[p.slot].x; p.y = h.slots[p.slot].y; } });
        },
        round: function () {
          var h = GS, items = SURPRISES.slice().sort(function () { return Math.random() - 0.5; });
          h.piles = [];
          var at = (Math.random() * h.n) | 0;
          for (var i = 0; i < h.n; i++) h.piles.push({ slot: i, x: h.slots[i].x, y: h.slots[i].y, hog: i === at, item: items[i], open: 0, leaves: seedLeaves(h.r, 16) });
          h.tries = 0; h.phase = 'show'; h.t = 0; h.msg = sel().name + ' chowa się tutaj!';
          var nsw = (h.hard ? 5 : 3) + Math.floor(h.round / 2);
          h.swaps = []; for (var s = 0; s < nsw; s++) { var a = (Math.random() * h.n) | 0, b = (a + 1 + ((Math.random() * (h.n - 1)) | 0)) % h.n; h.swaps.push([a, b]); }
          h.dur = (h.hard ? 0.5 : 0.75) * Math.pow(0.95, h.round);
          updateBarMsg();
        },
        msg: function () { return 'Runda ' + Math.min(ROUNDS, GS.round + 1) + ' z ' + ROUNDS + ' · znalezione: ' + GS.found; },
        frac: function () { return GS.first / ROUNDS * Math.min(1, GS.round / ROUNDS + (GS.done ? 1 : 0)); },
        update: function (dt) {
          var h = GS; if (h.done) return;
          h.t += dt;
          if (h.phase === 'show' && h.t > 1.5) { h.phase = 'cover'; h.t = 0; ctx.sfx('whoosh'); }
          else if (h.phase === 'cover' && h.t > 0.6) { h.phase = 'shuffle'; h.t = 0; h.msg = 'Patrz uważnie!'; }
          else if (h.phase === 'shuffle') {
            if (!h.sw) {
              if (!h.swaps.length) { h.phase = 'pick'; h.msg = 'Gdzie jest ' + sel().name + '?'; return; }
              var s = h.swaps.shift();
              h.sw = { a: h.piles.filter(function (p) { return p.slot === s[0]; })[0], b: h.piles.filter(function (p) { return p.slot === s[1]; })[0], sa: s[0], sb: s[1], k: 0 };
              ctx.sfx('swap');
            }
            var w = h.sw; w.k = Math.min(1, w.k + dt / h.dur);
            var e = w.k < 0.5 ? 2 * w.k * w.k : 1 - Math.pow(-2 * w.k + 2, 2) / 2;
            var A = h.slots[w.sa], B = h.slots[w.sb], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
            var nx = -dy / len, ny = dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
            var arc = Math.sin(Math.PI * w.k) * h.r * (reduce ? 0.4 : 0.7);
            w.a.x = A.x + dx * e + nx * arc; w.a.y = A.y + dy * e + ny * arc;
            w.b.x = B.x - dx * e - nx * arc * 0.6; w.b.y = B.y - dy * e - ny * arc * 0.6;
            if (w.k >= 1) { w.a.slot = w.sb; w.b.slot = w.sa; w.a.x = B.x; w.a.y = B.y; w.b.x = A.x; w.b.y = A.y; h.sw = null; }
          } else if (h.phase === 'found' && h.t > 1.6) {
            h.round++;
            if (h.round >= ROUNDS) this.finish(); else this.round();
          }
          h.piles.forEach(function (p) { if (p.open > 0 && p.open < 1) p.open = Math.min(1, p.open + dt / 0.4); });
        },
        down: function (q) {
          var h = GS; if (h.phase !== 'pick') return false;
          for (var i = 0; i < h.piles.length; i++) {
            var p = h.piles[i];
            if (p.open) continue;
            if (Math.abs(q.x - p.x) < h.r * 1.05 && q.y > p.y - h.r * 1.15 && q.y < p.y + h.r * 0.3) {
              p.open = 0.001;
              burst('leaf', p.x, p.y - h.r * 0.4, 10, { vx: function () { return rnd(-140, 140); }, vy: function () { return rnd(-220, -100); }, life: 1.1, r: h.r * 0.18 });
              ctx.sfx('whoosh');
              if (p.hog) {
                h.found++; if (h.tries === 0) h.first++;
                h.phase = 'found'; h.t = 0; h.msg = 'Brawo! Tu jest ' + sel().name + '!';
                later(function () { ctx.sfx('star'); }, 150);
                burst('spark', p.x, p.y - h.r, 6);
              } else {
                h.tries++; h.msg = 'Tu jest ' + p.item.n + '! Szukaj dalej.';
                later(function () { ctx.sfx('pop'); }, 150);
              }
              updateBarMsg();
              return true;
            }
          }
          return false;
        },
        draw: function () {
          var h = GS, tp = h.top, p0 = sel();
          skyGrad('#f6c98a', '#fff0d8', tp);
          for (var i = 0; i < Math.ceil(LW / 110) + 1; i++) {
            var tx = i * 110 + 40, ty = tp;
            rr(g, tx - 6, ty - 70, 12, 72, 3); g.fillStyle = '#8a6142'; g.fill(); outline(g, 1.5);
            g.beginPath(); g.arc(tx, ty - 90, 42, 0, Math.PI * 2); g.moveTo(tx - 2, ty - 68); g.arc(tx - 28, ty - 68, 26, 0, Math.PI * 2); g.moveTo(tx + 54, ty - 68); g.arc(tx + 28, ty - 68, 26, 0, Math.PI * 2);
            g.lineWidth = 3; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke();
            g.fillStyle = i % 2 ? '#e9813c' : '#f0a43a'; g.fill();
          }
          g.fillStyle = '#d8b36a'; g.fillRect(0, tp, LW + 2, LH - tp + 2);
          g.beginPath(); g.moveTo(0, tp); g.lineTo(LW + 2, tp); outline(g, 2);
          for (var q = 0; q < 26; q++) {
            var lx = ((Math.sin(q * 12.9898) * 43758.5453) % 1 + 1) % 1 * LW, ly = tp + 12 + ((Math.sin(q * 78.233) * 12345.678) % 1 + 1) % 1 * (LH - tp - 20);
            g.save(); g.translate(lx, ly); g.rotate(q); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); g.fillStyle = LEAF_COLS[q % 5]; g.globalAlpha = 0.7; g.fill(); g.restore();
          }
          var G = geo(p0.sp, p0.stage), hs = fitScale(p0, h.r * 1.8, h.r * 1.15), cxo = -(G.x0 + G.x1) / 2 * hs, ph = -G.top * hs;
          h.piles.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
            g.beginPath(); g.ellipse(p.x, p.y + 2, h.r * 1.05, h.r * 0.16, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(120,80,30,.25)'; g.fill();
            if (p.hog && (h.phase === 'show' || h.phase === 'cover' || h.phase === 'found' || (h.phase === 'pick' && p.open))) {
              var rise = h.phase === 'show' ? Math.min(1, h.t / 0.4) : h.phase === 'cover' ? 1 - Math.min(1, h.t / 0.5) : Math.min(1, p.open * 1.4);
              g.save(); g.beginPath(); g.rect(p.x - h.r * 2, 0, h.r * 4, p.y - 2); g.clip();
              drawPetAt(p0, p.x + cxo, p.y + (1 - rise) * (ph + 4) - rise * h.r * 0.42, hs, 1, { eye: h.phase === 'found' ? 'happy' : 'open', mouth: h.phase === 'found' ? 'open' : 'smile' });
              g.restore();
            }
            if (p.open > 0) {
              if (!p.hog) { g.save(); g.translate(p.x, p.y - h.r * 0.3 - p.open * 6); THING[p.item.k](g, h.r * 0.34); g.restore(); }
              g.save(); g.translate(p.x, p.y);
              for (var j = 0; j < 7; j++) { g.save(); g.translate((j - 3) * h.r * 0.3, 4 + (j % 2) * 4); g.rotate(j); g.beginPath(); g.ellipse(0, 0, h.r * 0.18, h.r * 0.08, 0, 0, Math.PI * 2); g.fillStyle = LEAF_COLS[j % 5]; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(29,47,111,.5)'; g.stroke(); g.restore(); }
              g.restore();
            } else { g.save(); g.translate(p.x, p.y); leafPile(g, h.r, p.leaves); g.restore(); }
          });
          if (h.msg) {
            var my = Math.max(36, tp - 170) + (h.phase === 'pick' && !reduce ? Math.sin(T * 4) * 3 : 0);
            g.font = '28px ' + FONT; var mw = Math.min(LW - 16, g.measureText(h.msg).width + 36);
            rr(g, LW / 2 - mw / 2, my - 24, mw, 48, 22); g.fillStyle = h.phase === 'found' ? '#fff4d6' : '#fff'; g.fill(); outline(g, 2.5);
            g.fillStyle = h.phase === 'pick' ? PURPLE : INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.msg, LW / 2, my + 1);
          }
        },
        finish: function () {
          var h = GS; if (!h || h.done) return; h.done = true;
          var frac = h.first / ROUNDS * Math.min(1, h.round / ROUNDS);
          endMini('hide', h.first >= 4 ? 'Świetne oczy!' : 'Koniec zabawy', [
            'Znalezione od razu: ' + h.first + ' z ' + ROUNDS,
            h.found > h.first ? 'Za drugim razem: ' + (h.found - h.first) : (h.round < ROUNDS ? 'Zagrane rundy: ' + h.round : 'Za każdym razem bez pomyłki!')
          ], frac, h.first);
        }
      };

      // ----- Aport: swipe up to throw, the pet brings the ball back and tosses it; tap to catch -----
      MG.aport = {
        start: function () {
          var hard = save.diff === 1;
          GS = { hard: hard, throws: hard ? 8 : 6, n: 0, pts: 0, catches: 0, fars: 0, phase: 'aim', t: 0, ball: { x: 0, y: 0, h: 0 }, px: 0, py: 0, face: -1, legs: 0, sw: null, done: false, msg: 'Przesuń palcem w górę!', mt: 0 };
          this.layout(); GS.px = GS.rest.x; GS.py = GS.rest.y;
        },
        layout: function () {
          var a = GS; a.top = LH * 0.3; a.hand = { x: LW / 2, y: LH - 56 }; a.rest = { x: LW / 2 + Math.min(110, LW * 0.24), y: LH - 92 };
          a.maxD = a.hand.y - a.top - 24;
          if (a.phase === 'aim') { a.ball.x = a.hand.x; a.ball.y = a.hand.y; a.ball.h = 0; }
        },
        depth: function (y) { var a = GS; return 0.5 + 0.5 * clamp((y - a.top) / (a.hand.y - a.top), 0, 1); },
        msg: function () { return 'Rzut ' + Math.min(GS.n + 1, GS.throws) + ' z ' + GS.throws + ' · punkty: ' + GS.pts; },
        frac: function () { return GS.pts / (GS.throws * 4); },
        say: function (s) { GS.msg = s; GS.mt = 1.6; },
        update: function (dt) {
          var a = GS, b = a.ball; if (a.done) return;
          a.t += dt; if (a.mt > 0) a.mt -= dt;
          var p = sel(), sp = 300 * this.depth(a.py);
          function goTo(x, y) {
            var dx = x - a.px, dy = y - a.py, d = Math.hypot(dx, dy);
            if (d < 4) return true;
            var st = Math.min(d, sp * dt); a.px += dx / d * st; a.py += dy / d * st; if (Math.abs(dx) > 2) a.face = dx > 0 ? 1 : -1; a.legs += dt * 16; return false;
          }
          if (a.phase === 'aim') { b.x = a.hand.x; b.y = a.hand.y; b.h = 0; goTo(a.rest.x, a.rest.y); }
          else if (a.phase === 'fly' || a.phase === 'down') {
            if (a.phase === 'fly') {
              var k = Math.min(1, a.t / a.dur);
              b.x = a.sx + (a.tx - a.sx) * k; b.y = a.sy + (a.ty - a.sy) * k; b.h = 4 * a.H * k * (1 - k) + (1 - k) * 26;
              if (k >= 1) { a.phase = 'down'; a.t = 0; ctx.sfx('land'); }
            } else b.h = Math.abs(Math.sin(a.t * 9)) * 14 * Math.max(0, 1 - a.t * 1.6);
            var G = geo(p.sp, p.stage), s = this.depth(a.py) * fitScale(p, LW * 0.24);
            // run to the side of the ball it is coming from (a side that follows "face" would flip back and forth forever)
            if (goTo(b.x - a.side * (G.mx * G.kh + G.hx) * s * 0.9, b.y) && a.phase === 'down') {
              a.phase = 'carry'; a.t = 0; a.face = a.side; ctx.sfx('pop');
              var far = a.d > a.maxD * 0.62;
              a.pts += far ? 2 : 1; if (far) a.fars++;
              popText(far ? 'Daleko! +2' : '+1', a.px, a.py - 70 * s, far ? GOLD : '#2a8a56');
              updateBarMsg();
            }
          } else if (a.phase === 'carry') {
            if (goTo(a.hand.x + 70, a.hand.y - 46)) {
              a.phase = 'toss'; a.t = 0; ctx.sfx('jump'); a.face = -1;
              var G2 = geo(p.sp, p.stage), s2 = this.depth(a.py) * fitScale(p, LW * 0.24);
              a.sx = a.px + a.face * (G2.hx + G2.mx * G2.kh) * s2; a.sy = a.py; a.sh = -(G2.hy + G2.my * G2.kh) * s2;
              a.tdur = a.hard ? 0.95 : 1.1;
              this.say('Łap piłkę!');
            }
          } else if (a.phase === 'toss') {
            var k2 = a.t / a.tdur;
            b.x = a.sx + (a.hand.x - a.sx) * Math.min(1, k2); b.y = a.sy + (a.hand.y - a.sy) * Math.min(1, k2);
            b.h = Math.max(0, a.sh * (1 - k2) + 4 * 70 * k2 * (1 - k2)); if (k2 > 1) b.h = 0;
            if (k2 > 1.15) { a.phase = 'next'; a.t = 0; ctx.sfx('land'); this.say('Prawie! Następnym razem.'); }
          } else if (a.phase === 'next') {
            goTo(a.rest.x, a.rest.y);
            if (a.t > 0.8) { a.n++; updateBarMsg(); if (a.n >= a.throws) this.finish(); else { a.phase = 'aim'; a.t = 0; this.say('Przesuń palcem w górę!'); } }
          }
        },
        win: function () { var a = GS, k = a.t / a.tdur; return a.phase === 'toss' && k >= (a.hard ? 0.8 : 0.66) && k <= 1.12; },
        down: function (q) {
          var a = GS;
          if (a.phase === 'aim') { a.sw = { x: q.x, y: q.y, lx: q.x, ly: q.y, t: T }; drag = { kind: 'swipe' }; return true; }
          if (a.phase === 'toss') {
            if (this.win()) {
              a.phase = 'next'; a.t = 0; a.pts += 2; a.catches++; ctx.sfx('star');
              popText('Złapane! +2', a.hand.x, a.hand.y - 50, GOLD); burst('spark', a.hand.x, a.hand.y - 20, 5); this.say('Super złapane!');
              updateBarMsg();
            } else if (a.t / a.tdur < 0.66) this.say('Jeszcze nie... teraz czekaj!');
            return true;
          }
          return false;
        },
        move: function (q) { if (GS.sw) { GS.sw.lx = q.x; GS.sw.ly = q.y; } },
        up: function () {
          var a = GS, s = a.sw; a.sw = null;
          if (!s || a.phase !== 'aim') return;
          var dx = s.lx - s.x, dy = s.ly - s.y, d;
          if (dy < -25) d = clamp(-dy * 2.1, 90, a.maxD);
          else if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { d = a.maxD * 0.45; dx = 0; }
          else { this.say('Przesuń palcem w górę!'); return; }
          a.d = d; a.sx = a.hand.x; a.sy = a.hand.y; a.tx = clamp(a.hand.x + dx * 1.4, 30, LW - 30); a.ty = a.hand.y - d;
          a.H = 70 + d * 0.35; a.dur = 0.65 + d / 900; a.phase = 'fly'; a.t = 0; a.side = a.px <= a.tx ? 1 : -1;
          ctx.sfx('whoosh');
        },
        draw: function () {
          var a = GS, b = a.ball, p = sel();
          skyGrad('#9fd6ff', '#e8f7ff', a.top);
          g.beginPath(); g.arc(LW * 0.82, a.top * 0.35, 22, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
          hedge(a.top - 12, '#5fb35f');
          g.fillStyle = '#9ad672'; g.fillRect(0, a.top, LW + 2, LH - a.top + 2);
          for (var i = 0; i < 7; i++) { var y0 = a.top + (a.hand.y - a.top) * Math.pow(i / 7, 1.3); g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(0,80,0,.05)'; g.fillRect(0, y0, LW + 2, (a.hand.y - a.top) / 7); }
          g.beginPath(); g.moveTo(0, a.top); g.lineTo(LW + 2, a.top); outline(g, 2);
          // "far" line
          var fy = a.hand.y - a.maxD * 0.62;
          g.setLineDash([10, 9]); g.beginPath(); g.moveTo(16, fy); g.lineTo(LW - 16, fy); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
          text('daleko', LW - 40, fy - 14, 18, '#2a8a56');
          // ball shadow + pet + ball (sorted by depth)
          var G = geo(p.sp, p.stage), ps = this.depth(a.py) * fitScale(p, LW * 0.24), bs = this.depth(b.y);
          g.beginPath(); g.ellipse(b.x, b.y, 9 * bs, 3 * bs, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(40,60,20,.25)'; g.fill();
          var carry = a.phase === 'carry';
          function drawBall() { if (carry) return; g.save(); g.translate(b.x, b.y - b.h - 9 * bs); THING.pilka(g, 9 * bs); g.restore(); }
          function drawP() { shadow(a.px, a.py, (G.x1 - G.x0) * ps * 0.4); drawPetAt(p, a.px, a.py, ps, a.face, { legs: a.phase === 'aim' && Math.abs(a.px - a.rest.x) < 5 ? 0 : a.legs, eye: carry || a.phase === 'toss' ? 'happy' : 'open', mouth: carry ? 'smile' : 'smile', carry: carry, wag: carry ? 1 : 0.3 }); }
          if (b.y < a.py) { drawBall(); drawP(); } else { drawP(); drawBall(); }
          // the catching hand + ring
          var hx = a.hand.x, hy = a.hand.y;
          if (a.phase === 'toss') {
            var ok = this.win();
            g.beginPath(); g.arc(hx, hy - 6, 30, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = ok ? '#5cbc4b' : 'rgba(255,255,255,.8)'; g.stroke(); outline(g, 1.5);
          }
          g.save(); g.translate(hx, hy + 6);
          g.beginPath(); g.ellipse(0, 0, 22, 15, 0, 0, Math.PI * 2); g.fillStyle = '#ffd0a8'; g.fill(); outline(g, 2.5);
          g.beginPath(); g.moveTo(-14, -6); g.lineTo(-14, -14); g.moveTo(-5, -10); g.lineTo(-5, -18); g.moveTo(4, -10); g.lineTo(4, -18); g.moveTo(13, -6); g.lineTo(13, -14); outline(g, 2);
          g.restore();
          if (a.phase === 'aim' && !reduce) { var ay = hy - 40 - (T * 40 % 30); g.globalAlpha = 0.7; g.beginPath(); g.moveTo(hx, ay + 26); g.lineTo(hx, ay); g.moveTo(hx - 9, ay + 9); g.lineTo(hx, ay); g.lineTo(hx + 9, ay + 9); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(); g.globalAlpha = 1; }
          pill(10, 10, 112, 38, 'Punkty: ' + a.pts);
          if (a.mt > 0) { g.font = '26px ' + FONT; var w = Math.min(LW - 20, g.measureText(a.msg).width + 30); rr(g, LW / 2 - w / 2, a.top - 64, w, 44, 20); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5); text(a.msg, LW / 2, a.top - 41, 26, PURPLE); }
        },
        finish: function () {
          var a = GS; if (!a || a.done) return; a.done = true;
          endMini('aport', a.pts >= a.throws * 3 ? 'Mistrz aportu!' : 'Koniec zabawy', [
            'Przyniesione piłki: ' + Math.min(a.n, a.throws) + ' · daleko: ' + a.fars, 'Złapane: ' + a.catches + ' · punkty: ' + a.pts
          ], a.pts / (a.throws * 4), a.pts);
        }
      };

      // ----- Szukanie smakołyków: tap a mound, the pet sniffs and digs; hot / warm / cold hints -----
      MG.dig = {
        start: function () {
          var hard = save.diff === 1, cols = hard ? 5 : 4, rows = hard ? 4 : 3, n = cols * rows, cells = [];
          for (var i = 0; i < n; i++) cells.push({ c: i % cols, r: (i / cols) | 0, dug: false, treat: false, found: false, hint: 0 });
          var idx = cells.map(function (c, i) { return i; }).sort(function () { return Math.random() - 0.5; });
          var treats = hard ? 4 : 3;
          for (var t = 0; t < treats; t++) cells[idx[t]].treat = true;
          GS = { hard: hard, cols: cols, rows: rows, cells: cells, treats: treats, found: 0, digs: hard ? 11 : 8, used: 0, pet: { x: LW / 2, y: LH * 0.95, face: 1, legs: 0, state: 'idle', t: 0, cell: null, hop: -1 }, endT: -1, msg: 'Dotknij kopczyka!', done: false };
          this.layout(); GS.pet.x = LW / 2; GS.pet.y = GS.y1 + 8;
        },
        layout: function () {
          var d = GS; d.x0 = LW * 0.06; d.x1 = LW * 0.94; d.y0 = LH * 0.34; d.y1 = LH * 0.9;
          d.cw = (d.x1 - d.x0) / d.cols; d.ch = (d.y1 - d.y0) / d.rows;
        },
        pos: function (cell) { var d = GS; return { x: d.x0 + d.cw * (cell.c + 0.5), y: d.y0 + d.ch * (cell.r + 0.62) }; },
        ps: function () { return fitScale(sel(), GS.cw * 0.95, GS.ch * 0.95); },
        msg: function () { return 'Smakołyki: ' + GS.found + '/' + GS.treats + ' · kopnięcia: ' + (GS.digs - GS.used); },
        frac: function () { return GS.found / GS.treats; },
        update: function (dt) {
          var d = GS, pt = d.pet; if (d.done) return;
          pt.t += dt;
          if (pt.hop >= 0) { pt.hop += dt / 0.45; if (pt.hop >= 1) pt.hop = -1; }
          if (pt.state === 'walk') {
            var to = this.pos(pt.cell), G = geo(sel().sp, sel().stage), s = this.ps();
            var tx = to.x - (G.x1 - 4) * s, ty = to.y + 2;
            if (tx < 20) tx = Math.max(to.x - (G.x1 - 4) * s * 0.5, -G.x0 * s * 0.7);
            var dx = tx - pt.x, dy = ty - pt.y, dd = Math.hypot(dx, dy), sp = 320 * (LW / 400);
            if (dd < 4) { pt.x = tx; pt.y = ty; pt.face = 1; pt.state = 'sniff'; pt.t = 0; ctx.sfx('tick'); }
            else { var st = Math.min(dd, sp * dt); pt.x += dx / dd * st; pt.y += dy / dd * st; if (Math.abs(dx) > 2) pt.face = dx > 0 ? 1 : -1; pt.legs += dt * 15; }
          } else if (pt.state === 'sniff') {
            if (pt.t > 0.25 && pt.t - dt <= 0.25) ctx.sfx('tick');
            if (pt.t > 0.6) { pt.state = 'dig'; pt.t = 0; ctx.sfx('plant'); }
          } else if (pt.state === 'dig') {
            var cp = this.pos(pt.cell);
            if (Math.random() < 0.5) parts.push({ kind: 'crumb', x: cp.x + rnd(-8, 8), y: cp.y - 4, vx: rnd(-90, 90), vy: rnd(-170, -90), t: 0, life: 0.6, r: rnd(2.5, 4.5), col: '#7a4a28' });
            if (pt.t > 0.55) this.reveal(pt.cell);
          } else if (pt.state === 'react' && pt.t > 0.9) pt.state = 'idle';
          if (d.endT > 0) { d.endT -= dt; if (d.endT <= 0) this.finish(); }
        },
        reveal: function (cell) {
          var d = GS, pt = d.pet, p = sel(), cp = this.pos(cell);
          cell.dug = true; d.used++; pt.state = 'react'; pt.t = 0;
          if (cell.treat) {
            cell.found = true; d.found++; ctx.sfx('harvest'); pt.hop = 0;
            popText('Mniam!', cp.x, cp.y - 40, '#2a8a56'); burst('spark', cp.x, cp.y - 20, 5);
            d.msg = d.found >= d.treats ? 'Wszystko znalezione!' : 'Smakołyk! Szukaj dalej.';
          } else {
            var best = 9;
            d.cells.forEach(function (c) { if (c.treat && !c.found) best = Math.min(best, Math.max(Math.abs(c.c - cell.c), Math.abs(c.r - cell.r))); });
            cell.hint = best <= 1 ? 3 : best === 2 ? 2 : 1;
            if (cell.hint === 3) { d.msg = 'Gorąco! Smakołyk jest tuż obok!'; pt.hop = 0; ctx.sfx('jump'); }
            else if (cell.hint === 2) { d.msg = 'Ciepło... gdzieś niedaleko.'; ctx.sfx('pop'); }
            else { d.msg = 'Zimno. Tu daleko.'; ctx.sfx('tap'); }
          }
          updateBarMsg();
          if (d.found >= d.treats) d.endT = 1.3;
          else if (d.used >= d.digs) {
            d.cells.forEach(function (c) { if (c.treat && !c.found) c.show = true; });
            d.msg = 'Kopnięcia się skończyły. Tu były smakołyki!'; d.endT = 2;
          }
        },
        down: function (q) {
          var d = GS; if (d.pet.state !== 'idle' || d.endT > 0) return true;
          for (var i = 0; i < d.cells.length; i++) {
            var c = d.cells[i], cp = this.pos(c);
            if (Math.abs(q.x - cp.x) < d.cw * 0.48 && Math.abs(q.y - (cp.y - d.ch * 0.12)) < d.ch * 0.5) {
              if (c.dug) { ctx.sfx('tap'); d.msg = c.found ? 'Ten smakołyk już jest.' : 'Tu już było kopane.'; return true; }
              d.pet.cell = c; d.pet.state = 'walk'; d.pet.t = 0; ctx.sfx('tap');
              return true;
            }
          }
          return true;
        },
        draw: function () {
          var d = GS, p = sel(), fk = SP[p.sp].fav[0];
          skyGrad('#a8dcff', '#eaf8ff', d.y0 - 30);
          hedge(d.y0 - 40, '#62b960');
          // fence
          g.fillStyle = '#fff4e2';
          for (var x = 10; x < LW; x += 34) { rr(g, x, d.y0 - 80, 18, 50, 4); g.fill(); outline(g, 1.8); }
          g.fillStyle = '#9ad672'; g.fillRect(0, d.y0 - 34, LW + 2, LH);
          rr(g, d.x0 - 8, d.y0 - 6, d.x1 - d.x0 + 16, d.y1 - d.y0 + 14, 22); g.fillStyle = '#b07f52'; g.fill(); outline(g, 2.5);
          var self = this, ps = this.ps(), G = geo(p.sp, p.stage), pt = d.pet;
          var list = d.cells.slice();
          list.forEach(function (c) {
            var cp = self.pos(c), w = d.cw * 0.4, h = d.ch * 0.2;
            if (!c.dug) {
              g.beginPath(); g.ellipse(cp.x, cp.y, w, h, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2);
              g.beginPath(); g.moveTo(cp.x - 4, cp.y - h * 0.95); g.lineTo(cp.x - 7, cp.y - h * 1.5); g.moveTo(cp.x, cp.y - h); g.lineTo(cp.x + 1, cp.y - h * 1.7); g.moveTo(cp.x + 4, cp.y - h * 0.95); g.lineTo(cp.x + 8, cp.y - h * 1.45);
              g.lineWidth = 2.4; g.strokeStyle = '#3fae5f'; g.stroke();
              if (c.show) { g.save(); g.globalAlpha = 0.85; g.translate(cp.x, cp.y - h * 1.6); THING[fk](g, Math.min(w, h * 2) * 0.45); g.restore(); }
            } else {
              g.beginPath(); g.ellipse(cp.x, cp.y - h * 0.2, w * 0.85, h * 0.6, 0, 0, Math.PI * 2); g.fillStyle = '#4a2c18'; g.fill(); outline(g, 2);
              g.beginPath(); g.ellipse(cp.x + w * 0.8, cp.y + 1, w * 0.32, h * 0.4, 0, Math.PI, 0); g.fillStyle = '#8a5a33'; g.fill(); outline(g, 1.5);
              if (c.found) { g.save(); g.translate(cp.x, cp.y - h * 0.9); THING[fk](g, Math.min(w, h * 2) * 0.5); g.restore(); }
              else if (c.hint) {
                var lab = ['', 'zimno', 'ciepło', 'gorąco'][c.hint], col = ['', '#3f86d8', '#e9813c', '#cf412d'][c.hint];
                text(lab, cp.x, cp.y + h * 0.75, Math.max(14, Math.min(20, d.cw * 0.2)), col);
              }
            }
          });
          // the pet
          var sniff = pt.state === 'sniff' ? Math.sin(pt.t * 30) * 0.08 : 0, dig = pt.state === 'dig';
          var lift = pt.hop >= 0 ? Math.sin(Math.PI * pt.hop) * 14 : 0;
          var eye = pt.state === 'react' && pt.cell && pt.cell.found ? 'happy' : pt.state === 'sniff' ? 'purr' : 'open';
          var shiver = pt.state === 'react' && pt.cell && pt.cell.hint === 1 ? Math.sin(pt.t * 50) * 0.04 : 0;
          shadow(pt.x, pt.y, (G.x1 - G.x0) * ps * 0.4);
          drawPetAt(p, pt.x, pt.y - lift, ps, pt.face, { legs: pt.state === 'walk' || dig ? pt.legs + (dig ? pt.t * 30 : 0) : 0, eye: eye, mouth: eye === 'happy' ? 'open' : 'smile', headRot: sniff + (dig ? 0.2 : 0), wag: pt.state === 'react' && pt.cell && pt.cell.hint >= 2 ? 1 : 0.2 }, shiver);
          pill(10, 10, 150, 38, 'Kopnięcia: ' + (d.digs - d.used));
          g.save(); g.translate(LW - 64, 29); THING[fk](g, 12); g.restore(); text(d.found + '/' + d.treats, LW - 30, 30, 26, '#2a8a56');
          g.font = '25px ' + FONT; var mw = Math.min(LW - 20, g.measureText(d.msg).width + 30);
          rr(g, LW / 2 - mw / 2, Math.max(56, d.y0 - 128), mw, 42, 20); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5);
          text(d.msg, LW / 2, Math.max(56, d.y0 - 128) + 22, 25, PURPLE);
        },
        finish: function () {
          var d = GS; if (!d || d.done) return; d.done = true;
          var left = Math.max(0, d.digs - d.used);
          endMini('dig', d.found >= d.treats ? 'Super nosek!' : 'Koniec szukania', [
            'Znalezione smakołyki: ' + d.found + ' z ' + d.treats, d.found >= d.treats ? 'Zostało kopnięć: ' + left : 'Następnym razem kop tam, gdzie gorąco!'
          ], d.found / d.treats, d.found * 10 + (d.found >= d.treats ? left : 0));
        }
      };

      // ----- Bańki: tap to blow a bubble, the pet jumps to pop it; 30 seconds -----
      MG.bubbles = {
        start: function () {
          var hard = save.diff === 1;
          GS = { hard: hard, time: 30, left: 30, bubbles: [], pts: 0, pops: 0, cool: 0, x: LW / 2, face: 1, legs: 0, jump: -1, gy: LH - 50, endT: -1, done: false, goal: hard ? 24 : 18 };
        },
        layout: function () { GS.gy = LH - 50; },
        ps: function () { return fitScale(sel(), LW * 0.26, LH * 0.18); },
        msg: function () { return 'Pęknięte: ' + GS.pops + ' · zostało ' + Math.max(0, Math.ceil(GS.left)) + ' s'; },
        frac: function () { return Math.min(1, GS.pts / GS.goal); },
        jumpH: function () { return Math.min(LH * 0.32, 190); },
        update: function (dt) {
          var b = GS; if (b.done) return;
          if (b.endT < 0) { b.left -= dt; if (b.left <= 0) { b.left = 0; b.endT = 1; ctx.sfx('clear'); } }
          else { b.endT -= dt; if (b.endT <= 0) { this.finish(); return; } }
          b.cool -= dt;
          var p = sel(), G = geo(p.sp, p.stage), s = this.ps(), half = (G.x1 - G.x0) / 2 * s, jh = this.jumpH();
          b.bubbles.forEach(function (q) { q.t += dt; q.y += q.vy * dt; q.x = clamp(q.x + Math.sin(q.t * 2 + q.ph) * 24 * dt, 14, LW - 14); });
          b.bubbles = b.bubbles.filter(function (q) { return q.y > -40 && !q.pop; });
          // pick the most reachable bubble
          var head = { x: b.x + b.face * G.hx * s, top: -G.top * s };
          var reachTop = b.gy - head.top - jh, target = null, bestD = 1e9;
          b.bubbles.forEach(function (q) { if (q.y > reachTop - q.r && q.y < b.gy) { var dd = Math.abs(q.x - b.x) + (b.gy - q.y) * 0.2; if (dd < bestD) { bestD = dd; target = q; } } });
          if (b.jump >= 0) { b.jump += dt / 0.62; if (b.jump >= 1) { b.jump = -1; ctx.sfx('land'); } }
          if (target && b.endT < 0) {
            var dx = target.x - (b.x + b.face * G.hx * s * 0.6), spd = (b.hard ? 210 : 250) * LW / 400 * (b.jump >= 0 ? 0.6 : 1);
            if (Math.abs(dx) > 6) { b.x = clamp(b.x + Math.sign(dx) * Math.min(Math.abs(dx), spd * dt), half, LW - half); b.face = dx > 0 ? 1 : -1; b.legs += dt * 15; }
            var need = b.gy - head.top - target.y;
            if (b.jump < 0 && Math.abs(dx) < 34 && need > 10) { b.jump = 0; ctx.sfx('jump'); }
          }
          var lift = b.jump >= 0 ? Math.sin(Math.PI * b.jump) * jh : 0;
          var hx = b.x + b.face * G.hx * s, hy = b.gy - lift + G.hy * s, hr = G.hr * s * 1.3;
          b.bubbles.forEach(function (q) {
            if (Math.hypot(q.x - hx, q.y - hy) < q.r + hr || (Math.abs(q.x - b.x) < half && q.y > b.gy - lift + G.top * s && q.y < b.gy - lift)) {
              q.pop = true; b.pops++; b.pts += q.gold ? 3 : 1;
              ctx.sfx(q.gold ? 'star' : 'pop'); popText(q.gold ? '+3' : '+1', q.x, q.y - 10, q.gold ? GOLD : '#3f86d8');
              burst('spark', q.x, q.y, q.gold ? 5 : 3, { r: function () { return rnd(3, 6); } });
              updateBarMsg();
            }
          });
          if (Math.random() < dt) updateBarMsg();
        },
        down: function (q) {
          var b = GS; if (b.endT >= 0) return true;
          if (q.y > b.gy - 8 || b.cool > 0 || b.bubbles.length >= (b.hard ? 6 : 7)) return true;
          b.cool = 0.22;
          b.bubbles.push({ x: q.x, y: q.y, r: rnd(16, 24), vy: b.hard ? -rnd(48, 66) : -rnd(24, 38), t: 0, ph: rnd(0, 6), gold: Math.random() < 0.1, pop: false });
          ctx.sfx('bubble');
          return true;
        },
        draw: function () {
          var b = GS, p = sel();
          skyGrad('#b8e2ff', '#f1fbff', b.gy);
          g.fillStyle = 'rgba(255,255,255,.9)';
          [[0.18, 0.16], [0.7, 0.1], [0.5, 0.28]].forEach(function (c) { var x = LW * c[0], y = LH * c[1]; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.arc(x + 18, y - 6, 20, 0, Math.PI * 2); g.arc(x + 38, y, 15, 0, Math.PI * 2); g.fill(); });
          g.fillStyle = '#86cf62'; g.fillRect(0, b.gy, LW + 2, LH - b.gy + 2);
          g.beginPath(); g.moveTo(0, b.gy); g.lineTo(LW + 2, b.gy); outline(g, 2);
          for (var f = 0; f < 9; f++) { var fx = (f * 97 + 23) % LW; g.beginPath(); g.arc(fx, b.gy + 16 + (f % 3) * 8, 4, 0, Math.PI * 2); g.fillStyle = ['#ff7eb6', '#f5c330', '#fff'][f % 3]; g.fill(); }
          var G = geo(p.sp, p.stage), s = this.ps(), lift = b.jump >= 0 ? Math.sin(Math.PI * b.jump) * this.jumpH() : 0;
          shadow(b.x, b.gy, (G.x1 - G.x0) * s * 0.4 * (1 - lift / 400));
          drawPetAt(p, b.x, b.gy - lift, s, b.face, { legs: b.jump >= 0 ? 0 : b.legs, eye: b.jump >= 0 ? 'happy' : 'open', mouth: b.jump >= 0 ? 'open' : 'smile', wag: 0.6 });
          b.bubbles.forEach(function (q) {
            g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
            g.fillStyle = q.gold ? 'rgba(255,224,102,.45)' : 'rgba(210,235,255,.45)'; g.fill();
            g.lineWidth = 2; g.strokeStyle = q.gold ? '#e3a008' : 'rgba(63,134,216,.75)'; g.stroke();
            g.beginPath(); g.arc(q.x, q.y, q.r * 0.8, -2.6, -1.6); g.strokeStyle = 'rgba(255,126,182,.6)'; g.lineWidth = 2; g.stroke();
            g.beginPath(); g.arc(q.x - q.r * 0.35, q.y - q.r * 0.35, q.r * 0.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
          });
          // time bar
          rr(g, 12, 12, LW - 24, 18, 9); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          var k = clamp(b.left / b.time, 0, 1); if (k > 0) { rr(g, 15, 15, (LW - 30) * k, 12, 6); g.fillStyle = k > 0.3 ? '#5cbc4b' : '#f2b51d'; g.fill(); }
          pill(12, 38, 110, 36, 'Bańki: ' + b.pts, '#3f86d8');
          if (b.pops === 0 && b.left > 26) text('Dotknij nieba, żeby puścić bańkę!', LW / 2, LH * 0.42, 24, PURPLE);
        },
        finish: function () {
          var b = GS; if (!b || b.done) return; b.done = true;
          endMini('bubbles', b.pts >= b.goal ? 'Bańkowy mistrz!' : 'Koniec zabawy', ['Pęknięte bańki: ' + b.pops, 'Punkty: ' + b.pts + ' (złota bańka: +3)'], Math.min(1, b.pts / b.goal), b.pts);
        }
      };

      // ----- Powtórz taniec: Simon says with pet moves -----
      var MOVES = [
        { k: 'hop', n: 'Skok', icon: 'hop', note: 60, col: '#5cbc4b' },
        { k: 'spin', n: 'Obrót', icon: 'spin', note: 64, col: '#3f86d8' },
        { k: 'wave', n: 'Machanie', icon: 'wave', note: 67, col: '#f5c330' },
        { k: 'roll', n: 'Turlanie', icon: 'roll', note: 72, col: '#ff7eb6' }
      ];
      MG.dance = {
        start: function () {
          var hard = save.diff === 1, len = hard ? 3 : 2;
          GS = { hard: hard, start: len, maxLen: hard ? 8 : 6, seq: [], i: 0, phase: 'intro', t: 0, step: -1, move: null, lives: 3, best: 0, done: false, msg: 'Patrz uważnie!', btns: [], sd: hard ? 0.7 : 0.9 };
          for (var i = 0; i < len; i++) GS.seq.push((Math.random() * 4) | 0);
        },
        bar: function () {
          GS.btns = MOVES.map(function (m, i) { var b = actBtn(m.icon, m.n, function () { MG.dance.tap(i); }); return b; });
          this.sync();
        },
        sync: function () { var on = GS.phase === 'input'; GS.btns.forEach(function (b, i) { b.disabled = !on; b.classList.toggle('lit', !!(GS.move && GS.move.i === i && GS.move.t < 0.45)); }); },
        msg: function () { return ''; },
        frac: function () { return clamp((GS.best - GS.start + 1) / (GS.maxLen - GS.start + 1), 0, 1); },
        perform: function (i) { GS.move = { i: i, t: 0 }; ctx.note(MOVES[i].note, 0.4); this.sync(); },
        tap: function (i) {
          var d = GS; if (!d || d.phase !== 'input' || d.done) return;
          this.perform(i);
          if (d.seq[d.i] === i) {
            d.i++;
            if (d.i >= d.seq.length) { d.best = d.seq.length; d.phase = 'ok'; d.t = 0; d.msg = 'Brawo!'; later(function () { ctx.sfx('star'); }, 300); this.sync(); }
          } else {
            d.lives--; d.phase = d.lives > 0 ? 'oops' : 'end'; d.t = 0;
            d.msg = d.lives > 0 ? 'Ups! Pokażę jeszcze raz.' : 'Dobry taniec!';
            later(function () { ctx.sfx('tap'); }, 200); this.sync();
          }
        },
        update: function (dt) {
          var d = GS; if (d.done) return;
          d.t += dt;
          if (d.move) { d.move.t += dt / 0.6; if (d.move.t >= 1) { d.move = null; this.sync(); } else if (d.move.t > 0.45) this.sync(); }
          if (d.phase === 'intro' && d.t > 1.1) { d.phase = 'demo'; d.t = 0; d.step = -1; }
          else if (d.phase === 'demo') {
            var st = Math.floor(d.t / d.sd);
            if (st !== d.step) {
              d.step = st;
              if (st < d.seq.length) this.perform(d.seq[st]);
              else { d.phase = 'input'; d.i = 0; d.t = 0; d.msg = 'Teraz Ty!'; this.sync(); }
            }
          } else if (d.phase === 'ok' && d.t > 1.1) {
            if (d.seq.length >= d.maxLen) { this.finish(); return; }
            d.seq.push((Math.random() * 4) | 0); d.phase = 'demo'; d.t = 0; d.step = -1; d.msg = 'Patrz uważnie!';
          } else if (d.phase === 'oops' && d.t > 1.4) { d.phase = 'demo'; d.t = 0; d.step = -1; d.msg = 'Patrz uważnie!'; }
          else if (d.phase === 'end' && d.t > 1.1) this.finish();
        },
        down: function () { return true; },
        draw: function () {
          var d = GS, p = sel();
          skyGrad('#3d2f78', '#7a5fc4', LH * 0.62);
          // curtains
          g.fillStyle = '#c63c5a';
          [0, 1].forEach(function (s) { g.beginPath(); var x = s ? LW : 0, w = LW * 0.14 * (s ? -1 : 1); g.moveTo(x, 0); g.lineTo(x + w * 1.4, 0); g.quadraticCurveTo(x + w, LH * 0.35, x + w * 1.1, LH * 0.62); g.lineTo(x, LH * 0.62); g.closePath(); g.fill(); outline(g, 2.5); });
          var fy = LH * 0.62;
          g.fillStyle = '#c98f5a'; g.fillRect(0, fy, LW + 2, LH - fy + 2);
          g.beginPath(); g.moveTo(0, fy); g.lineTo(LW + 2, fy); outline(g, 2.5);
          var py = fy + (LH - fy) * 0.55;
          g.save(); g.globalAlpha = 0.22; g.beginPath(); g.moveTo(LW / 2 - 30, 0); g.lineTo(LW / 2 + 30, 0); g.lineTo(LW / 2 + 120, py + 10); g.lineTo(LW / 2 - 120, py + 10); g.closePath(); g.fillStyle = '#fff4c4'; g.fill(); g.restore();
          g.beginPath(); g.ellipse(LW / 2, py + 2, 120, 22, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,244,196,.35)'; g.fill();
          // the pet does the move
          var G = geo(p.sp, p.stage), s = fitScale(p, LW * 0.42, LH * 0.3), m = d.move, k = m ? m.t : 0, mv = m ? MOVES[m.i].k : null;
          var lift = 0, sx = 1, rot = 0, st = { eye: 'open', mouth: 'smile', wag: 0.4 };
          if (mv === 'hop') { lift = Math.sin(Math.PI * k) * 60; st.eye = 'happy'; }
          if (mv === 'spin') { sx = Math.cos(k * Math.PI * 2); st.eye = 'happy'; }
          if (mv === 'wave') { st.wave = k * Math.PI * 5; st.mouth = 'open'; }
          if (mv === 'roll') { rot = (reduce ? 0.4 * Math.sin(k * Math.PI) : k * Math.PI * 2); lift = Math.sin(Math.PI * k) * 20; st.eye = 'happy'; }
          if (d.phase === 'ok') { st.eye = 'happy'; st.mouth = 'open'; st.wag = 1; }
          shadow(LW / 2, py, (G.x1 - G.x0) * s * 0.4);
          var cy = (G.cy || -20) * s;
          g.save(); g.translate(LW / 2 - (G.x0 + G.x1) / 2 * s * sx, py - lift); g.translate(0, cy); g.rotate(rot); g.translate(0, -cy);
          g.scale(s * (Math.abs(sx) < 0.08 ? 0.08 * Math.sign(sx || 1) : sx), s);
          var o = { t: T, stage: p.stage, wear: wearOf(p), seed: R(p).seed }; for (var kk in st) o[kk] = st[kk];
          drawCritter(g, p.sp, o); g.restore();
          if (m && m.t < 0.6) { var mc = MOVES[m.i]; text(mc.n + '!', LW / 2, py - (-G.top) * s - lift - 30, 30, mc.col); }
          // progress dots + hearts
          var n = d.seq.length, dw = Math.min(34, (LW - 40) / n), x0 = LW / 2 - dw * (n - 1) / 2;
          for (var i = 0; i < n; i++) {
            var done = d.phase === 'input' ? i < d.i : d.phase === 'ok';
            g.beginPath(); g.arc(x0 + i * dw, 70, 10, 0, Math.PI * 2); g.fillStyle = done ? '#ffe066' : 'rgba(255,255,255,.35)'; g.fill(); outline(g, 2);
          }
          for (var h = 0; h < 3; h++) heart(g, LW - 26 - h * 26, 30, 9, h < d.lives ? '#ff7eb6' : 'rgba(255,255,255,.35)');
          pill(10, 12, 116, 36, 'Runda ' + (n - d.start + 1));
          g.font = '30px ' + FONT; var mw = Math.min(LW - 20, g.measureText(d.msg).width + 34);
          rr(g, LW / 2 - mw / 2, 98, mw, 46, 20); g.fillStyle = '#fff'; g.fill(); outline(g, 2.5);
          text(d.msg, LW / 2, 122, 30, d.phase === 'input' ? '#2a8a56' : PURPLE);
        },
        finish: function () {
          var d = GS; if (!d || d.done) return; d.done = true;
          endMini('dance', d.best >= d.maxLen ? 'Mistrz tańca!' : 'Pięknie zatańczone!', ['Najdłuższy taniec: ' + d.best + ' ' + pl(d.best, 'ruch', 'ruchy', 'ruchów'), 'Szanse: ' + d.lives + ' z 3'],
            clamp((d.best - d.start + 1) / (d.maxLen - d.start + 1), 0, 1), d.best);
        }
      };

      // ----- Kołowrotek: tap in rhythm to run fast; 20 seconds, three flags -----
      MG.wheel = {
        start: function () {
          var hard = save.diff === 1;
          GS = { hard: hard, beat: hard ? 0.42 : 0.55, tol: hard ? 0.1 : 0.13, time: 20, clock: 0, first: 1.2, v: 0, m: 0, rot: 0, legs: 0, lastTap: -9, lastBeat: -1, goals: hard ? [30, 55, 75] : [25, 45, 60], flags: 0, hits: 0, fb: null, endT: -1, done: false };
        },
        msg: function () { return 'Stukaj w rytm! ' + Math.round(GS.m) + ' m'; },
        frac: function () { return Math.min(1, GS.m / GS.goals[2]); },
        update: function (dt) {
          var w = GS; if (w.done) return;
          if (w.endT >= 0) { w.endT -= dt; w.v *= Math.exp(-dt * 3); if (w.endT <= 0) { this.finish(); return; } }
          else {
            w.clock += dt;
            var bi = Math.floor((w.clock - w.first) / w.beat);
            if (w.clock >= w.first && bi !== w.lastBeat) { w.lastBeat = bi; ctx.sfx('tick'); }
            if (w.clock >= w.time + w.first) { w.endT = 1.2; ctx.sfx('clear'); }
          }
          w.v *= Math.exp(-dt * 1.2); w.m += w.v * dt; w.rot += w.v * dt * 0.8; w.legs += (2 + w.v * 3.5) * dt * 3;
          while (w.flags < 3 && w.m >= w.goals[w.flags]) { w.flags++; ctx.sfx('star'); popText('Flaga ' + w.flags + '!', LW / 2, LH * 0.25, GOLD); }
          if (w.fb) { w.fb.t -= dt; if (w.fb.t <= 0) w.fb = null; }
          if (Math.random() < dt * 3) updateBarMsg();
        },
        down: function () {
          var w = GS; if (w.endT >= 0 || w.clock < w.first - w.tol) return true;
          if (w.clock - w.lastTap < 0.16) return true;
          w.lastTap = w.clock;
          var e = ((w.clock - w.first) % w.beat + w.beat) % w.beat, err = Math.min(e, w.beat - e);
          if (err <= w.tol) { w.v = Math.min(7, w.v + 2.2); w.hits++; w.fb = { s: 'Rytm!', c: '#2a8a56', t: 0.5 }; ctx.sfx('jump'); }
          else { w.v = Math.min(7, w.v + 0.45); w.fb = { s: 'stuk', c: MUTED, t: 0.4 }; ctx.sfx('tap'); }
          return true;
        },
        draw: function () {
          var w = GS, p = sel();
          g.fillStyle = '#fbe6c8'; g.fillRect(0, 0, LW + 2, LH + 2);
          g.fillStyle = '#f6d9b3'; for (var x = 8; x < LW; x += 40) g.fillRect(x, 0, 18, LH * 0.7);
          g.fillStyle = '#e0b07a'; g.fillRect(0, LH * 0.7, LW + 2, LH * 0.3 + 2);
          g.beginPath(); g.moveTo(0, LH * 0.7); g.lineTo(LW + 2, LH * 0.7); outline(g, 2);
          // track with flags
          var tx0 = 24, tx1 = LW - 24, ty = 66, k = clamp(w.m / w.goals[2], 0, 1);
          rr(g, tx0, ty - 9, tx1 - tx0, 18, 9); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          if (k > 0) { rr(g, tx0 + 3, ty - 6, Math.max(12, (tx1 - tx0 - 6) * k), 12, 6); g.fillStyle = '#9b74dc'; g.fill(); }
          w.goals.forEach(function (gm, i) {
            var fx = tx0 + (tx1 - tx0) * gm / w.goals[2] - (i === 2 ? 6 : 0);
            g.beginPath(); g.moveTo(fx, ty + 9); g.lineTo(fx, ty - 30); outline(g, 2.5);
            g.beginPath(); g.moveTo(fx, ty - 30); g.lineTo(fx + 18, ty - 24); g.lineTo(fx, ty - 18); g.closePath(); g.fillStyle = i < w.flags ? GOLD : '#fff'; g.fill(); outline(g, 2);
          });
          pill(12, 92, 130, 38, Math.round(w.m) + ' m', PURPLE);
          var left = Math.max(0, w.time + w.first - Math.max(w.clock, w.first));
          pill(LW - 102, 92, 90, 38, Math.ceil(left) + ' s');
          // wheel
          var R0 = Math.min(LW * 0.34, LH * 0.25), cx = LW / 2, cy = LH * 0.7 - R0 - 6;
          g.beginPath(); g.moveTo(cx - R0 * 0.6, cy + R0 * 1.0 + 6); g.lineTo(cx, cy); g.lineTo(cx + R0 * 0.6, cy + R0 * 1.0 + 6); g.lineWidth = 10; g.strokeStyle = INK; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#9aa6b8'; g.stroke();
          g.beginPath(); g.arc(cx, cy, R0, 0, Math.PI * 2); g.lineWidth = 14; g.strokeStyle = INK; g.stroke(); g.lineWidth = 9; g.strokeStyle = '#7fc4f0'; g.stroke();
          g.save(); g.translate(cx, cy); g.rotate(-w.rot);
          g.beginPath(); for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2; g.moveTo(Math.cos(a) * R0 * 0.93, Math.sin(a) * R0 * 0.93); g.lineTo(Math.cos(a) * R0 * 1.0, Math.sin(a) * R0 * 1.0); }
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
          g.beginPath(); for (var j = 0; j < 6; j++) { var b = j / 6 * Math.PI * 2; g.moveTo(0, 0); g.lineTo(Math.cos(b) * R0 * 0.9, Math.sin(b) * R0 * 0.9); }
          g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 2; g.stroke();
          g.restore();
          g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fillStyle = '#9aa6b8'; g.fill(); outline(g, 2);
          var G = geo(p.sp, p.stage), s = fitScale(p, R0 * 1.15, R0 * 0.85), bob = Math.abs(Math.sin(w.legs)) * Math.min(4, w.v);
          drawPetAt(p, cx - (G.x0 + G.x1) / 2 * s, cy + R0 * 0.88 - bob, s, 1, { legs: w.legs, eye: w.v > 3 ? 'happy' : 'open', mouth: w.v > 3 ? 'open' : 'smile', wag: Math.min(1, w.v / 4) });
          // the beat: a ring that shrinks onto the target exactly on the beat
          var bx = LW / 2, by = LH * 0.7 + (LH * 0.3) * 0.5, rT = 26;
          var ph = w.clock < w.first ? (w.first - w.clock) / w.beat : 1 - (((w.clock - w.first) % w.beat) / w.beat);
          if (ph > 1) ph = 1;
          g.beginPath(); g.arc(bx, by, rT, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 3);
          heart(g, bx, by + 2, 10, '#ff7eb6');
          if (w.endT < 0) { g.beginPath(); g.arc(bx, by, rT + ph * 46, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = ph < 0.25 ? '#5cbc4b' : 'rgba(122,79,196,.7)'; g.stroke(); }
          if (w.fb) text(w.fb.s, bx + 70, by, 24, w.fb.c);
          if (w.clock < w.first + 2 && w.endT < 0) text('Stukaj, gdy kółko dotknie serduszka!', LW / 2, by - 50, 21, PURPLE);
        },
        finish: function () {
          var w = GS; if (!w || w.done) return; w.done = true;
          endMini('wheel', w.flags >= 3 ? 'Wielki biegacz!' : 'Koniec biegu', ['Przebiegnięte: ' + Math.round(w.m) + ' m · flagi: ' + w.flags + ' z 3', 'Stuknięcia w rytm: ' + w.hits], Math.min(1, w.m / w.goals[2]), Math.round(w.m));
        }
      };

      // ---------- input ----------
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; }
      function capture(e) { try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
      function onDown(e) {
        if (e.button > 0 || overlay) return;
        var q = pos(e);
        if (mode === 'home') {
          stopPlay(); playT = Math.max(playT, 10);
          if (food) return;
          var p0 = sel();
          if (p0 && q.x > plate.x && q.x < plate.x + plate.w && q.y > plate.y - 14 && q.y < plate.y + plate.h + 6) { ctx.sfx('tap'); openRename(p0); return; }
          var p = petAt(q.x, q.y);
          if (p) {
            capture(e);
            if (p.id !== save.sel) { select(p); drag = { kind: 'stroke', id: p.id, x: q.x, y: q.y }; }
            else if (p.asleep) { R(p).wig = 0.3; ctx.sfx('tap'); say(p, 'Chrr...', 1); }
            else { drag = { kind: 'stroke', id: p.id, x: q.x, y: q.y }; if (R(p).belly > 0) bellyRub(p, 20, q.x, q.y); else if (!(R(p).roll > 0)) petTap(p); }
          }
        } else if (mode === 'bath' && bath) {
          if (bath.rinse > 0) return;
          drag = { kind: 'sponge', x: q.x, y: q.y }; bath.sx = q.x; bath.sy = q.y; capture(e);
        } else if (mode === 'polana') {
          var list = meadowPets().slice().sort(function (a, b) { return MR(b).y - MR(a).y; });
          for (var i = 0; i < list.length; i++) {
            var mp = list[i], r = MR(mp), s = meadowScale(mp), G = geo(mp.sp, mp.stage);
            var lx = (q.x - r.x) / (s * r.face), ly = (q.y - r.y) / s;
            if (lx > G.x0 - 8 && lx < G.x1 + 8 && ly > G.top - 8 && ly < 6) { ctx.sfx('tap'); r.hop = 0; openMeadowPet(mp); break; }
          }
        } else if (GS && MG[mode] && !GS.done) {
          if (MG[mode].down(q)) capture(e);
        }
        e.preventDefault();
      }
      function onMove(e) {
        if (!drag) return;
        var q = pos(e);
        if (drag.kind === 'stroke') {
          var p = byId(drag.id), d = Math.hypot(q.x - drag.x, q.y - drag.y);
          drag.x = q.x; drag.y = q.y;
          if (p && p.home && !p.asleep && mode === 'home' && petAt(q.x, q.y) === p) stroke(p, d, q.x, q.y);
        } else if (drag.kind === 'sponge' && bath && bath.rinse === 0) {
          var d2 = Math.hypot(q.x - drag.x, q.y - drag.y);
          drag.x = q.x; drag.y = q.y; bath.sx = q.x; bath.sy = q.y;
          scrub(q.x, q.y, d2); updateBarMsg();
        } else if (GS && MG[mode] && MG[mode].move) MG[mode].move(q);
      }
      function onUp() { if (GS && MG[mode] && MG[mode].up) MG[mode].up(); drag = null; }
      function onKey(e) { if (GS && MG[mode] && MG[mode].key) MG[mode].key(e); }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);

      // ---------- update ----------
      function petTimers(p, dt) {
        var r = R(p);
        if (r.hop >= 0) { r.hop += dt / 0.45; if (r.hop >= 1) r.hop = -1; }
        if (r.wig > 0) r.wig = Math.max(0, r.wig - dt);
        if (r.ball > 0) r.ball = Math.max(0, r.ball - dt);
        if (r.happy > 0) r.happy = Math.max(0, r.happy - dt);
        if (r.purr > 0) r.purr = Math.max(0, r.purr - dt);
        if (r.wagT > 0) r.wagT = Math.max(0, r.wagT - dt);
        if (r.spin > 0) { r.spin += dt / 0.6; if (r.spin >= 1) r.spin = 0; }
        if (r.strokeT > 0) r.strokeT -= dt; else if (r.pm > 0) r.pm = Math.max(0, r.pm - dt * 0.15);
        r.earT -= dt;
        if (r.earT <= 0) { r.earT = rnd(3, 8); r.earP = 0.0001; }
        if (r.earP > 0) { r.earP += dt / 0.3; if (r.earP >= 1) r.earP = 0; }
        r.earK = r.earP > 0 ? Math.sin(r.earP * Math.PI) * 0.35 : 0;
        if (r.roll > 0) r.roll = Math.max(0, r.roll - dt);
        if (r.yawn > 0) r.yawn = Math.max(0, r.yawn - dt);
        // a pet that needs something shows it now and then: yawns, a rumbling tummy, a sigh (dirt shows by itself)
        if (mode === 'home' && !p.asleep && !food) {
          r.moodT = (r.moodT == null ? rnd(2, 6) : r.moodT) - dt;
          if (r.moodT <= 0) {
            r.moodT = rnd(6, 11);
            var s0 = petScale(p), want = NEEDS.filter(function (k) { return p.needs[k] < LOW_NEED; });
            if (want.length && !(r.happy > 0) && !(r.belly > 0)) {
              var k = pick(want), hx = r.x + r.face * 14 * s0, hy = r.y - 34 * s0;
              if (k === 'sleep') { r.yawn = 1.4; popText(pick(['Ziew...', 'Aaaa... ziew!', 'Ziew!']), hx, hy, PURPLE, 1.8); }
              else if (k === 'food') { r.wig = Math.max(r.wig, 0.45); popText(pick(['Burrr!', 'Burczy mi...', 'Burr burr!']), r.x, r.y - 18 * s0, '#d9622b', 1.8); }
              else if (k === 'fun') { popText(pick(['Eh... nudno.', 'Nudzę się...', 'Ehh...']), hx, hy, MUTED, 1.8); }
              else { popText(pick(['Fuj, śmierdzę!', 'Pfu...', 'Fe!']), hx, hy, '#5e8a2e', 1.8); }
            }
          }
        }
        if (r.belly > 0) {
          r.belly -= dt;
          if (r.belly <= 0) { r.belly = 0; r.rollIn = false; r.roll = reduce ? 0 : 0.4; r.happy = 1.5; say(p, r.rubbed ? 'Ale było miło!' : 'Hop, wstaję!', 1.6); }
        }
      }
      function wander(p, r, dt) {
        r.wanderT -= dt;
        if (r.wanderT <= 0) {
          r.wanderT = rnd(3, 7);
          var best = null, bd = -1;
          for (var i = 0; i < 6; i++) {
            var mg = edge(p), cx = rnd(mg, LW - mg), cy = floorY(rnd(0, 1)), md = 1e9;
            homePets().forEach(function (q) { if (q !== p) { var rq = R(q); md = Math.min(md, Math.hypot(rq.x - cx, (rq.y - cy) * 2)); } });
            if (md > bd) { bd = md; best = [cx, cy]; }
          }
          r.tx = best[0]; r.ty = best[1];
        }
        moveTo(p, r, r.tx, r.ty, dt, 1);
      }
      function moveTo(p, r, tx, ty, dt, k) {
        var dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy * 1.6);
        if (d > 2) {
          r.walking = true; if (Math.abs(dx) > 1.5) r.face = dx > 0 ? 1 : -1;
          var sp = 34 * dt * HS / 2 * (k || 1) * (p.stage === 0 ? 0.8 : 1) * (isTired(p) ? 0.6 : 1), st = Math.min(1, sp / d);
          r.x += dx * st; r.y += dy * st; r.legs += dt * (p.stage === 0 ? 11 : 9);
          return false;
        }
        r.walking = false; return true;
      }
      function busy(p, r) { return (food && food.id === p.id) || r.belly > 0 || r.roll > 0 || (drag && drag.id === p.id) || r.hop >= 0 || r.ball > 0 || r.spin > 0; }
      function updateDuo(dt) {
        if (play) return;
        if (!duo) {
          duoT -= dt;
          if (duoT > 0) return;
          duoT = rnd(14, 22);
          var free = homePets().filter(function (p) { return !p.asleep && !busy(p, R(p)); });
          if (free.length < 2) return;
          free.sort(function () { return Math.random() - 0.5; });
          var A = free[0], B = free[1], ra = R(A), rb = R(B), mx = clamp((ra.x + rb.x) / 2, LW * 0.25, LW * 0.75), my = (ra.y + rb.y) / 2, gap = 24 * HS * crowd();
          duo = { a: A.id, b: B.id, phase: 'go', t: 0, ax: mx - gap, bx: mx + gap, y: my };
          return;
        }
        var a = byId(duo.a), b = byId(duo.b);
        if (!a || !b || !a.home || !b.home || a.asleep || b.asleep) { duo = null; return; }
        var ra2 = R(a), rb2 = R(b);
        duo.t += dt;
        if (duo.phase === 'go') {
          var okA = busy(a, ra2) || moveTo(a, ra2, duo.ax, duo.y, dt, 1.4), okB = busy(b, rb2) || moveTo(b, rb2, duo.bx, duo.y, dt, 1.4);
          if ((okA && okB) || duo.t > 5) {
            duo.phase = 'play'; duo.t = 0; ra2.face = 1; rb2.face = -1; ra2.walking = rb2.walking = false;
            if (!speech) say(a, pick(['Bawimy się?', 'Gonimy się!', 'Hop, hop!', 'Cześć, ' + b.name + '!']), 1.6);
          }
        } else {
          var beat = Math.floor(duo.t / 0.45);
          if (beat !== duo.beat) {
            duo.beat = beat;
            var who = beat % 2 ? rb2 : ra2; if (who.hop < 0) { who.hop = 0; }
            if (beat % 2 === 0) burst(beat % 4 ? 'heart' : 'note', (ra2.x + rb2.x) / 2, Math.min(ra2.y, rb2.y) - 45 * HS * crowd(), 1, { col: PURPLE });
          }
          if (duo.t > 2.7) {
            addNeed(a, 'fun', 3, PET_FUN_CAP); addNeed(b, 'fun', 3, PET_FUN_CAP);
            ra2.happy = rb2.happy = 1; ra2.wanderT = rnd(1, 3); rb2.wanderT = rnd(1, 3);
            duo = null;
          }
        }
      }
      // ---------- pets playing together on their own (cosmetic: no needs, points or saves) ----------
      // play = { k: ball|chase|hug|calm, a, b, c (a third pet watching), ph (phase), t (in phase), T (total), ... }
      function inPlay(p) { return !!play && (play.a === p.id || play.b === p.id || play.c === p.id); }
      function playable(p) { var r = p && p.home && !p.asleep && rt[p.id]; return !!r && !(r.belly > 0 || r.roll > 0 || r.ball > 0 || r.spin > 0 || (drag && drag.id === p.id)); }
      function playQuiet() { return mode === 'home' && running && !overlay && !panel && !sheet && !food && !bath && !drag && !GS && !duo && !growQ.length; }
      function stopPlay() {
        if (!play) return;
        [play.a, play.b, play.c].forEach(function (id) { var r = id && rt[id]; if (r) { r.walking = false; r.tx = r.x; r.ty = r.y; r.wanderT = rnd(1.5, 3); } });
        play = null; playT = rnd(25, 60); duoT = Math.max(duoT, rnd(8, 14));
      }
      function faceUp(a, b) { var ra = R(a), rb = R(b); ra.face = rb.x >= ra.x ? 1 : -1; rb.face = -ra.face; }
      function gapTo(p, x) { var r = R(p); if (Math.abs(x - r.x) > 8) r.face = x > r.x ? 1 : -1; }
      // two spots at one depth, facing each other with `gap` units between the noses, inside the walls
      function pairSpots(A, B, gap) {
        var L = R(A).x <= R(B).x ? A : B, Rt = L === A ? B : A, rl = R(L), rq = R(Rt);
        var D = gap + geo(L.sp, L.stage).x1 * petScale(L) + geo(Rt.sp, Rt.stage).x1 * petScale(Rt), lo = edge(L), hi = LW - edge(Rt);
        D = Math.min(D, hi - lo);
        var x = clamp((rl.x + rq.x) / 2 - D / 2, lo, hi - D), o = { y: clearY([x, x + D], clamp((rl.y + rq.y) / 2, floorY(0.1), floorY(0.9)), [A.id, B.id]) };
        o[L.id] = x; o[Rt.id] = x + D;
        return o;
      }
      // a floor depth where no other pet stands at these x (keeps y0 when it is free)
      function clearY(xs, y0, skip) {
        var best = y0, bd = -1;
        [y0, floorY(0.1), floorY(0.4), floorY(0.7), floorY(0.95)].forEach(function (y, i) {
          var md = 1e9;
          homePets().forEach(function (o) { if (skip.indexOf(o.id) < 0) xs.forEach(function (x) { md = Math.min(md, Math.hypot(R(o).x - x, (R(o).y - y) * 1.5)); }); });
          if (i === 0 && md > 110) md = 1e10;
          if (md > bd) { bd = md; best = y; }
        });
        return best;
      }
      // the ball in a pet's mouth (the same spot and size as drawCritter's st.carry)
      function mouthAt(p) {
        var r = R(p), s = petScale(p), G = geo(p.sp, p.stage), hog = SP[p.sp].hog;
        var lx = hog ? 3 * G.kb + 28 * G.kh : G.hx + (G.mx + 1) * G.kh, ly = hog ? -14 * G.kb + 8 * G.kh : G.hy + (G.my + 2.5) * G.kh;
        return { x: r.x + r.face * lx * s, y: petY(p) + ly * s, r: (hog ? 4.2 : 4.6) * G.kh * s, rot: 0, a: 1 };
      }
      function startPlay(k) {
        if (play || !playQuiet()) return false;
        var free = homePets().filter(function (p) { return playable(p) && !busy(p, R(p)); });
        if (free.length < 2) return false;
        free.sort(function () { return Math.random() - 0.5; });
        var A = free[0], B = free[1], ra = R(A), rb = R(B);
        k = reduce ? 'calm' : (k === 'ball' || k === 'chase' || k === 'hug') ? k : pick(['ball', 'chase', 'hug']);
        play = { k: k, a: A.id, b: B.id, c: free[2] ? free[2].id : 0, ph: 'go', t: 0, T: 0, n: 3 + Math.floor(Math.random() * 3), hold: 0, fly: null, beat: -1 };
        if (k === 'ball' || k === 'hug') play.at = pairSpots(A, B, k === 'ball' ? clamp(LW * 0.3, 80, 190) : 2);
        else if (k === 'chase') {
          // round the rug: the runner does a lap, the chaser trots right behind its tail (no walls, no passing)
          var run = pick([A, B]), chs = run === A ? B : A;
          var E = play.E = { x: LW / 2, y: floorY(0.5), rx: Math.max(10, Math.min(LW / 2 - Math.max(edge(A), edge(B)) - 4, LW * 0.32, 170)), ry: (floorY(1) - floorY(0)) * 0.45 };
          var ang = function (r) { return Math.atan2((r.y - E.y) / E.ry, (r.x - E.x) / E.rx); }, d = ang(R(run)) - ang(R(chs));
          play.run = run.id; play.chs = chs.id; play.dir = Math.sin(d) >= 0 ? 1 : -1; play.th = ang(R(run)); play.go = 0; play.ph = 'lap';
          play.lag = (-geo(run.sp, run.stage).x0 * petScale(run) + geo(chs.sp, chs.stage).x1 * petScale(chs) + 10) / ((E.rx + E.ry) / 2);
          if (!speech) say(run, pick(['Goń mnie!', 'Gonisz mnie!']), 1.6);
        } else { faceUp(A, B); ra.walking = rb.walking = false; play.ph = 'calm'; if (!speech) say(A, pick(['Cześć, ' + B.name + '!', 'Lubię Cię!']), 1.8); }
        return true;
      }
      function headsY(a, b) { return Math.min(petY(a) + geo(a.sp, a.stage).top * petScale(a), petY(b) + geo(b.sp, b.stage).top * petScale(b)) - 6; }
      function endPlay(a, b, who, line) {
        var P = play, ra = R(a), rb = R(b);
        P.ph = 'end'; P.t = 0; faceUp(a, b); ra.walking = rb.walking = false;
        ra.happy = rb.happy = 1.6;
        var c = P.c && byId(P.c); if (c) R(c).happy = 1;
        var hx = (ra.x + rb.x) / 2, hy = headsY(a, b);
        burst('heart', hx, hy, 3); if (P.k === 'ball') burst('spark', hx, hy, 2);
        if (line) say(who, line, 1.6);
        if (P.k !== 'calm') ctx.sfx('swap');
      }
      function updatePlay(dt) {
        if (!play) {
          if (playQuiet() || (duo && mode === 'home')) playT -= dt;   // the pets' own hop-together does not stop the clock
          if (playT > 0 || !playQuiet()) return;
          playT = rnd(4, 8);   // nobody free to play: look again soon
          startPlay();
          return;
        }
        var P = play, a = byId(P.a), b = byId(P.b), c = P.c ? byId(P.c) : null;
        if (!playQuiet() || !playable(a) || !playable(b)) { stopPlay(); return; }
        if (c && !playable(c)) { P.c = 0; c = null; }
        var ra = R(a), rb = R(b), hop = function (r) { if (r.hop < 0) r.hop = 0; };
        P.t += dt; P.T += dt;
        if (P.ph === 'end') { if (P.t > 1.4) stopPlay(); return; }
        if (P.T > 12) { endPlay(a, b); return; }   // safety net
        var mid = (ra.x + rb.x) / 2;
        if (P.k === 'calm') {
          var bt = Math.floor(P.t / 0.8);
          if (bt !== P.beat) { P.beat = bt; ra.happy = rb.happy = 1; burst('heart', mid, headsY(a, b), 2); }
          if (P.t > 3) endPlay(a, b);
        } else if (P.ph === 'go') {
          // walk to the spots, then turn to face each other
          var okA = moveTo(a, ra, P.at[a.id], P.at.y, dt, 1.4), okB = moveTo(b, rb, P.at[b.id], P.at.y, dt, 1.4);
          if (okA) gapTo(a, rb.x); if (okB) gapTo(b, ra.x);
          if ((okA && okB) || P.t > 4) {
            if (P.k === 'chase') { var w = byId(P.who); endPlay(a, b, w, vb(w.name, 'Złapałem Cię!', 'Złapałam Cię!')); return; }
            ra.walking = rb.walking = false; faceUp(a, b); P.ph = P.k === 'ball' ? 'hold' : 'hop'; P.t = 0; P.fy = (ra.y + rb.y) / 2;
            if (P.k === 'ball') { var h = Math.random() < 0.5 ? a : b; P.hold = h.id; R(h).happy = 0.8; if (!speech) say(h, 'Łap!', 1.2); }
          }
        } else if (P.ph === 'hold') {
          if (P.t > (P.thrown ? 0.4 : 0.6)) {
            var from = byId(P.hold), to = from === a ? b : a;
            if (!P.n) { endPlay(a, b, from, pick(['Jeszcze raz!', 'Ale zabawa!'])); return; }
            var d = Math.abs(R(to).x - R(from).x);
            P.fly = { f: from.id, to: to.id, t: 0, dur: 0.6 + d / 500, H: 26 + d * 0.22, bo: Math.random() < 0.35 };
            if (P.thrown && !speech && Math.random() < 0.3) say(from, 'Łap!', 0.9);
            P.hold = 0; P.n--; P.ph = 'fly'; P.t = 0; P.thrown = true;
          }
        } else if (P.ph === 'fly') {
          P.fly.t += dt;
          if (P.fly.t >= P.fly.dur) {
            var q = byId(P.fly.to), rq = R(q);
            P.hold = q.id; P.fly = null; P.ph = 'hold'; P.t = 0;
            hop(rq); rq.happy = Math.max(rq.happy, 0.9);
            if (P.n && !speech && Math.random() < 0.35) say(q, pick(['Mam!', 'Złapane!']), 1);
          }
        } else if (P.ph === 'hop') {
          // hug: hop together a few times, hearts between them
          var beat = Math.floor(P.t / 0.6);
          if (beat !== P.beat && beat < 4) {
            P.beat = beat; hop(ra); hop(rb); ra.happy = rb.happy = 0.7;
            burst('heart', mid, headsY(a, b), 1, { r: function () { return rnd(6, 10); } });
            if (beat === 0 && !speech) say(a, pick(['Hop, hop!', 'Przytulas!', 'Skaczemy!']), 1.4);
          }
          if (P.t > 2.5) endPlay(a, b, b, pick(['Lubię Cię!', 'Jeszcze raz!']));
        } else if (P.ph === 'lap') {
          // the runner follows a point going round the ellipse (the point waits if the runner lags), the chaser a point behind it
          var run = byId(P.run), chs = byId(P.chs), rr = R(run), rc = R(chs), E = P.E;
          var ex = function (th) { return E.x + Math.cos(th) * E.rx; }, ey = function (th) { return E.y + Math.sin(th) * E.ry; };
          if (Math.hypot(ex(P.th) - rr.x, ey(P.th) - rr.y) < 14) { var st = Math.PI * 2 / 4.2 * dt; P.th += P.dir * st; P.go += st; }
          moveTo(run, rr, ex(P.th), ey(P.th), dt, 3); moveTo(chs, rc, ex(P.th - P.dir * P.lag), ey(P.th - P.dir * P.lag), dt, 3.3);
          if (P.go > Math.PI && !P.mid) { P.mid = 1; if (!speech && Math.random() < 0.6) say(chs, 'Zaraz Cię złapię!', 1.4); }
          if (P.go >= Math.PI * 2) { P.ph = 'go'; P.t = 0; P.at = pairSpots(a, b, 4); P.who = chs.id; }   // caught: come together nose to nose
        }
        if (c) {   // the third pet watches the fun
          var rcw = R(c), fb = playBall();
          rcw.walking = false; gapTo(c, fb ? fb.x : (ra.x + rb.x) / 2);
        }
      }
      // where the ball is now: in a mouth or flying in an arc (with a bounce on the floor now and then)
      function playBall() {
        var P = play; if (!P || P.k !== 'ball' || (!P.hold && !P.fly)) return null;
        if (!P.fly) { var m = mouthAt(byId(P.hold)); if (P.ph === 'end') m.a = clamp((1.4 - P.t) / 0.4, 0, 1); return m; }
        var F = P.fly, A = mouthAt(byId(F.f)), B = mouthAt(byId(F.to)), k = clamp(F.t / F.dur, 0, 1), r = A.r + (B.r - A.r) * k, y;
        if (F.bo) { var fy = P.fy - r, k1 = k < 0.5 ? k * 2 : k * 2 - 1; y = k < 0.5 ? A.y + (fy - A.y) * k1 * k1 - 20 * k1 * (1 - k1) : fy + (B.y - fy) * (2 * k1 - k1 * k1) - 30 * k1 * (1 - k1); }
        else y = A.y + (B.y - A.y) * k - 4 * F.H * k * (1 - k);
        return { x: A.x + (B.x - A.x) * k, y: y, r: r, rot: P.T * 9 * (B.x > A.x ? 1 : -1), a: 1 };
      }
      function drawPlay(front) {
        var b = playBall(); if (!b) return;
        g.save(); g.globalAlpha = b.a;
        if (!front) { if (play.fly) { var w = b.r * clamp(1.2 - (play.fy - b.y) / 160, 0.5, 1.2); g.beginPath(); g.ellipse(b.x, play.fy + 1, w, w * 0.3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(60,40,20,.15)'; g.fill(); } }
        else { g.translate(b.x, b.y); g.rotate(b.rot); THING.pilka(g, b.r); }
        g.restore();
      }
      function updateHome(dt) {
        if (food) updateFood(dt);
        homePets().forEach(function (p) {
          var r = R(p);
          if (p.asleep) {
            p.needs.sleep = Math.min(100, p.needs.sleep + SLEEP_GAIN_S * upV('bed') * dt);
            var sp = sleepSpot(p); moveTo(p, r, sp.x, sp.y, dt, 2.5); r.walking = false;
            r.zT -= dt;
            if (r.zT <= 0) { r.zT = 1.1 + Math.random() * 0.3; var s = petScale(p); parts.push({ kind: 'z', x: r.x + 14 * s, y: r.y - 28 * s, vx: 14, vy: -26, t: 0, life: 2.4, r: 14 + Math.random() * 8 }); }
            if (p.needs.sleep >= 100 && r.wakeT < 0) r.wakeT = 1.6;
            if (r.wakeT > 0) { r.wakeT -= dt; if (r.wakeT <= 0) wake(p, true); }
          } else if (busy(p, r) || (duo && (duo.a === p.id || duo.b === p.id)) || inPlay(p)) { if (!(drag && drag.id === p.id)) r.walking = false; }
          else wander(p, r, dt);
        });
        updateDuo(dt);
        updatePlay(dt);
        var cur = sel();
        hintT -= dt;
        if (hintT <= 0 && cur) {
          hintT = rnd(18, 28);
          if (!speech && !food && !cur.asleep) {
            var lk = lowest(cur), v = cur.needs[lk];
            if (v < 45) say(cur, needSay(lk, v), 2.6);
            else if (Math.random() < 0.5) say(cur, pick(['Lubię Cię!', 'Ale tu przytulnie.', 'Pobawimy się?', 'Tra la la!', 'Pogłaszcz mnie!']), 2);
          }
        }
        if (growQ.length && !overlay && !panel && !sheet && !food) showGrowCard();
      }
      function update(dt) {
        T += dt;
        settle(Date.now());
        var cur = sel(), hp = homePets();
        var allZ = hp.length && hp.every(function (p) { return p.asleep; });
        var want = mode === 'home' && cur && cur.asleep ? (allZ ? 1 : 0.55) : 0;
        dark += (want - dark) * Math.min(1, dt * (reduce ? 20 : 2.5));
        if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
        if (mode === 'home' || mode === 'bath') hp.forEach(function (p) { petTimers(p, dt); });
        if (mode === 'home') updateHome(dt);
        else if (mode === 'bath' && bath) updateBath(dt);
        else if (mode === 'polana') updatePolana(dt);
        else if (GS && MG[mode]) MG[mode].update(dt);
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
      function isNight() { var h = new Date().getHours(); return h >= 20 || h < 7; }
      function drawWindow(night) {
        var ww = Math.min(124, LW * 0.28), wh = ww * 1.05, wx = LW * 0.07, wy = Math.max(56, FY * 0.26);
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
        var night = isNight() || dark > 0.5, cur = sel();
        g.fillStyle = '#fbe6c8'; g.fillRect(0, 0, LW + 2, FY);
        g.fillStyle = '#f6d9b3'; for (var x = 8; x < LW; x += 40) g.fillRect(x, 0, 18, FY);
        g.fillStyle = '#ffffff55';
        for (var hx = 17; hx < LW; hx += 40) for (var hy = 30; hy < FY - 20; hy += 60) { g.beginPath(); g.arc(hx, hy + ((hx / 40) % 2) * 30, 2.4, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#e0b07a'; g.fillRect(0, FY, LW + 2, LH - FY + 2);
        g.beginPath();
        for (var py = FY + 30, row2 = 0; py < LH; py += 34, row2++) {
          g.moveTo(0, py); g.lineTo(LW, py);
          for (var px = (row2 % 2) * 60 + 40; px < LW; px += 120) { g.moveTo(px, py - 34); g.lineTo(px, py); }
        }
        g.strokeStyle = 'rgba(138,90,51,.35)'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#c98f5a'; g.fillRect(0, FY - 12, LW + 2, 14);
        g.beginPath(); g.moveTo(0, FY - 12); g.lineTo(LW, FY - 12); g.moveTo(0, FY + 2); g.lineTo(LW, FY + 2); outline(g, 2);
        drawWindow(night);
        var fw = Math.min(70, LW * 0.16), fx = LW - fw - LW * 0.08, fy = Math.max(60, FY * 0.3);
        rr(g, fx, fy, fw, fw * 1.15, 6); g.fillStyle = '#fffaf0'; g.fill(); outline(g, 3);
        rr(g, fx + 6, fy + 6, fw - 12, fw * 1.15 - 12, 3); g.strokeStyle = '#e3a008'; g.lineWidth = 2; g.stroke();
        heart(g, fx + fw / 2, fy + fw * 0.6, fw * 0.2, '#ff9ec7');
        // name plate (the selected pet)
        var nm = cur ? cur.name : 'Domek';
        g.font = '24px ' + FONT;
        var tw = Math.max(70, g.measureText(nm).width + 30), ph = 34, pxp = LW / 2 - tw / 2, pyp = Math.max(22, FY * 0.09);
        g.beginPath(); g.moveTo(LW / 2, pyp - 16); g.lineTo(pxp + 12, pyp); g.moveTo(LW / 2, pyp - 16); g.lineTo(pxp + tw - 12, pyp); outline(g, 1.6);
        g.beginPath(); g.arc(LW / 2, pyp - 16, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        rr(g, pxp, pyp, tw, ph, 10); g.fillStyle = '#b07f52'; g.fill(); outline(g, 2.5);
        rr(g, pxp + 4, pyp + 4, tw - 8, ph - 8, 7); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#fff8ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nm, LW / 2, pyp + ph / 2 + 1);
        plate = cur ? { x: pxp, y: pyp, w: tw, h: ph } : { x: -99, y: -99, w: 0, h: 0 };
        var plx = LW - LW * 0.08, ply = FY + 14;
        g.save(); g.translate(plx, ply);
        [[-0.5, '#3fae5f'], [0, '#58b25c'], [0.5, '#3fae5f'], [-0.9, '#58b25c'], [0.9, '#58b25c']].forEach(function (l) {
          g.save(); g.rotate(l[0]); g.beginPath(); g.ellipse(0, -30, 8, 22, 0, 0, Math.PI * 2); g.fillStyle = l[1]; g.fill(); outline(g, 1.8); g.restore();
        });
        g.beginPath(); g.moveTo(-16, -10); g.lineTo(16, -10); g.lineTo(12, 14); g.lineTo(-12, 14); g.closePath(); g.fillStyle = '#e2714f'; g.fill(); outline(g, 2);
        g.restore();
        var ry = floorY(0.5), rw = Math.min(LW * 0.42, 260), rh = Math.min(40, (LH - FY) * 0.22);
        g.beginPath(); g.ellipse(LW / 2, ry, rw, rh, 0, 0, Math.PI * 2); g.fillStyle = '#f7b7c8'; g.fill(); outline(g, 2.5);
        g.beginPath(); g.ellipse(LW / 2, ry, rw * 0.78, rh * 0.7, 0, 0, Math.PI * 2);
        g.setLineDash([8, 7]); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
      }
      function petState(p, pose) {
        var r = R(p), low = minNeed(p) < 25, chewing = food && food.id === p.id && food.drop >= 1 && food.bites < 3;
        var tired = isTired(p), yawn = r.yawn > 0;
        var eye = p.asleep ? 'closed' : r.purr > 0 ? 'purr' : (r.happy > 0 || r.wig > 0) ? 'happy' : yawn ? 'closed' : tired ? 'tired' : low ? 'sad' : 'open';
        var mouth = chewing ? (Math.sin(T * 16) > 0 ? 'open' : 'chew') : p.asleep ? 'chew' : yawn ? 'open' : r.wig > 0.2 ? 'giggle' : r.happy > 0.8 ? 'open' : low ? 'frown' : 'smile';
        if (pose === 'belly') { eye = 'happy'; mouth = r.wig > 0 ? 'giggle' : 'open'; }
        var dirt = mode === 'bath' ? 0 : p.needs.clean < 55 ? clamp((55 - p.needs.clean) / 45, 0, 1) : 0;
        var droop = tired && pose === 'stand' && !(r.happy > 0) ? 0.16 + (yawn ? -0.25 * Math.sin(Math.min(1, r.yawn / 1.4) * Math.PI) : 0) : 0;
        return { t: T, stage: p.stage, pose: pose, legs: r.walking ? r.legs : 0, wear: wearOf(p), eye: eye, mouth: mouth, dirt: dirt, seed: r.seed, earRot: (r.earK || 0) + (tired ? 0.25 : 0), headRot: droop, wag: (r.happy > 0 || r.wagT > 0) ? 1 : 0 };
      }
      function drawPetHome(p, xo, yo, so, faceO) {
        var r = R(p), pose = poseOf(p), s = so || petScale(p), G = geo(p.sp, p.stage, pose);
        var x = xo != null ? xo : r.x, y = yo != null ? yo : petY(p), face = faceO || r.face;
        var br = 1 + Math.sin(T * (p.asleep ? 1.4 : 2.2) + r.seed) * (p.asleep ? 0.03 : 0.015);
        var wg = r.wig > 0 ? Math.sin(T * 30) * 0.1 * Math.min(1, r.wig) : 0;
        var wob = r.walking && p.stage === 0 && !reduce ? Math.sin(r.legs) * 0.07 : 0;
        var sx = r.spin > 0 ? Math.cos(r.spin * Math.PI * 2) : 1; if (Math.abs(sx) < 0.06) sx = 0.06 * (sx < 0 ? -1 : 1);
        var ra = r.roll > 0 ? Math.sin((1 - r.roll / 0.4) * Math.PI) * 0.9 * (r.rollIn ? -1 : 1) : 0;
        shadow(x, yo != null ? yo : r.y, (G.x1 - G.x0) * s * 0.42);
        var hopY = SP[p.sp].hops && r.walking && pose === 'stand' && !reduce ? Math.abs(Math.sin(r.legs * 0.55)) * 7 * s : 0;   // a rabbit hops along
        g.save(); g.translate(x, y - hopY); g.rotate(wg + wob + ra * face); g.scale(s * face * sx, s * br);
        drawCritter(g, p.sp, petState(p, pose)); g.restore();
        if (mode === 'home' && p.needs.clean < LOW_NEED) drawStink(x, y, s, G, r.seed, (LOW_NEED - p.needs.clean) / LOW_NEED);
        if (mode === 'home' && pose === 'stand' && !p.asleep && canGrow(p)) {
          var hw = (G.x1 - G.x0) * s * 0.55, cy2 = y + G.top * s * 0.55;
          for (var i = 0; i < 4; i++) {
            var a = (reduce ? 0 : T * 1.4) + i * Math.PI / 2;
            star(g, x + Math.cos(a) * hw, cy2 + Math.sin(a) * hw * 0.55, 4.5 + (reduce ? 0 : Math.sin(T * 5 + i) * 1.5), i % 2 ? '#ffe066' : '#fff4c4');
          }
        }
      }
      // a dirty pet smells: wavy green lines rise from its back and a little fly circles above
      function drawStink(x, y, s, G, seed, k) {
        var w = (G.x1 - G.x0) * s, top = y + G.top * s, n = k > 0.5 ? 3 : 2;
        g.save(); g.lineCap = 'round';
        for (var i = 0; i < n; i++) {
          var ph = reduce ? 0.5 : ((T * 0.45 + i / n + seed) % 1), bx = x + (i - (n - 1) / 2) * w * 0.28, by = top + 6 - ph * 34;
          g.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
          g.beginPath();
          for (var j = 0; j <= 12; j++) { var yy = by - j * 1.6, xx = bx + Math.sin(j * 0.9 + T * 3 + i) * 3.2; if (j) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
          g.lineWidth = 3.4; g.strokeStyle = '#7cae3c'; g.stroke();
        }
        g.globalAlpha = 1;
        var a = reduce ? 0.6 : T * 2.6 + seed * 3, fx = x + Math.cos(a) * w * 0.32, fy = top - 12 + Math.sin(a * 1.7) * 6;
        g.beginPath(); g.ellipse(fx - 2, fy - 3, 3, 2, -0.5 + Math.sin(T * 40) * 0.4, 0, Math.PI * 2); g.ellipse(fx + 2, fy - 3, 3, 2, 0.5 - Math.sin(T * 40) * 0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(220,240,255,.85)'; g.fill();
        g.beginPath(); g.arc(fx, fy, 2.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.restore();
      }
      function drawSpeech() {
        if (!speech) return;
        var p = byId(speech.id); if (!p || !p.home) return;
        var r = R(p), s = petScale(p), G = geo(p.sp, p.stage, poseOf(p));
        var a = Math.min(1, speech.t * 4);
        g.save(); g.globalAlpha = a;
        g.font = '22px ' + FONT;
        var words = speech.text.split(' '), lines = [], cur = '';
        words.forEach(function (w) { var tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > Math.min(230, LW - 60) && cur) { lines.push(cur); cur = w; } else cur = tt; });
        if (cur) lines.push(cur);
        var bw = 0; lines.forEach(function (l) { bw = Math.max(bw, g.measureText(l).width); });
        bw += 24; var bh = lines.length * 24 + 14;
        var ax = r.x + r.face * (G.hx || 10) * s, ay = petY(p) + G.top * s - 4;
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
          else if (p.kind === 'note') text('♪', p.x, p.y, 26, p.col);
          else if (p.kind === 'spark') star(g, p.x, p.y, p.r, '#ffe066');
          else if (p.kind === 'grow') { g.translate(p.x, p.y); g.rotate(p.rot * 0.2 - 0.3); g.beginPath(); g.ellipse(0, 0, p.r * 0.55, p.r, 0.5, 0, Math.PI * 2); g.fillStyle = '#7fcf5a'; g.fill(); outline(g, 1.4); g.beginPath(); g.moveTo(-p.r * 0.3, p.r * 0.5); g.lineTo(p.r * 0.3, -p.r * 0.5); g.strokeStyle = '#3fae5f'; g.lineWidth = 1.2; g.stroke(); }
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
      function drawTub(front, cx, y, w) {
        var top = y - 14 * HS, bot = y + 14 * HS;
        if (!front) { g.beginPath(); g.ellipse(cx, top, w / 2, 9 * HS, 0, 0, Math.PI * 2); g.fillStyle = '#5aa8ea'; g.fill(); outline(g, 2.5); return; }
        g.beginPath(); g.moveTo(cx - w / 2, top); g.quadraticCurveTo(cx - w / 2, bot, cx - w * 0.3, bot); g.lineTo(cx + w * 0.3, bot); g.quadraticCurveTo(cx + w / 2, bot, cx + w / 2, top);
        g.ellipse(cx, top, w / 2, 9 * HS, 0, 0, Math.PI, false); g.closePath();
        g.fillStyle = '#ffffff'; g.fill(); outline(g, 3);
        g.beginPath(); g.moveTo(cx - w * 0.36, top + 9 * HS); g.quadraticCurveTo(cx, top + 14 * HS, cx + w * 0.36, top + 9 * HS); g.strokeStyle = '#9fd4f5'; g.lineWidth = 3 * HS / 2; g.stroke();
        [-0.3, 0.3].forEach(function (f) { g.beginPath(); g.ellipse(cx + w * f, bot + 3 * HS, 5 * HS, 3 * HS, 0, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill(); outline(g, 2); });
        g.fillStyle = '#fff';
        for (var i = -5; i <= 5; i++) { g.beginPath(); g.arc(cx + i * w * 0.085, top - 1 + (i % 2) * 2, 4 * HS, Math.PI, 0); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(63,134,216,.5)'; g.stroke(); }
      }
      function drawSponge() {
        var s = HS / 2;
        g.save(); g.translate(bath.sx, bath.sy); g.rotate(-0.2); g.scale(s, s);
        rr(g, -18, -12, 36, 24, 7); g.fillStyle = '#ffd84a'; g.fill(); outline(g, 2.5);
        rr(g, -18, 4, 36, 8, 4); g.fillStyle = '#5cbc4b'; g.fill(); outline(g, 2);
        g.fillStyle = '#e3a008'; [[-9, -5, 2.5], [2, -6, 2], [10, -2, 2.6], [-2, 0, 1.6]].forEach(function (h) { g.beginPath(); g.arc(h[0], h[1], h[2], 0, Math.PI * 2); g.fill(); });
        g.restore();
      }
      function drawHome() {
        drawRoom();
        var hp = homePets();
        if (mode === 'bath' && bath) {
          var bp = byId(bath.id), r = R(bp), s = petScale(bp), G = geo(bp.sp, bp.stage);
          var others = hp.filter(function (q) { return q !== bp; });
          others.forEach(function (q, i) { var left = i === 0; drawPetHome(q, LW * (left ? 0.12 : 0.88), floorY(0.05), HS * 0.5, left ? 1 : -1); });
          var tw = Math.max(70 * HS, (G.x1 - G.x0) * s * 1.2);
          drawTub(false, r.x + (G.x0 + G.x1) / 2 * s * 0.5, r.y, tw);
          drawPetHome(bp, r.x, r.y - 9 * HS, s, 1);
          bath.foam.forEach(function (f) {
            g.beginPath(); g.arc(r.x + f.x * s, r.y - 9 * HS + f.y * s, f.r * s * 0.55, 0, Math.PI * 2);
            g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(63,134,216,.55)'; g.stroke();
          });
          drawTub(true, r.x + (G.x0 + G.x1) / 2 * s * 0.5, r.y, tw);
          if (bath.rinse > 0) {
            var sx = r.x + (G.x0 + G.x1) / 2 * s * 0.5, sy = Math.max(30, r.y + G.top * s - 50);
            g.beginPath(); g.moveTo(LW + 6, sy - 44); g.lineTo(sx + 16, sy - 44); g.quadraticCurveTo(sx, sy - 44, sx, sy - 28); g.lineTo(sx, sy - 14); g.lineWidth = 9; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#c7d3e8'; g.stroke();
            g.beginPath(); g.moveTo(sx - 30 * HS, sy); g.quadraticCurveTo(sx, sy - 30, sx + 30 * HS, sy); g.closePath(); g.fillStyle = '#c7d3e8'; g.fill(); outline(g, 2.5);
            g.fillStyle = INK; for (var hh = -3; hh <= 3; hh++) { g.beginPath(); g.arc(sx + hh * 7 * HS, sy - 3, 1.6, 0, Math.PI * 2); g.fill(); }
          } else drawSponge();
        } else {
          var list = hp.slice().sort(function (a, b) { return R(a).y - R(b).y; });
          drawPlay(false);
          list.forEach(function (p) {
            if (food && food.id === p.id) {
              var f = food, fy = f.y - (1 - f.drop) * 140, rad = 13 * HS / 2.2 * (1 - f.bites * 0.25);
              g.save(); g.translate(f.x, fy); if (f.bites < 3) THING[f.f.k](g, rad); g.restore();
            }
            drawPetHome(p);
          });
          drawPlay(true);
          if (!hp.length) text('Tu zamieszka Twoje zwierzątko!', LW / 2, floorY(0.4), 26, PURPLE);
        }
        drawParts(function (p) { return p.kind !== 'z'; });
        if (dark > 0.01) {
          g.fillStyle = 'rgba(16,24,64,' + (0.6 * dark).toFixed(3) + ')'; g.fillRect(0, 0, LW + 2, LH + 2);
          g.save(); g.globalAlpha = dark; drawWindow(true); g.restore();
        }
        drawParts(function (p) { return p.kind === 'z'; });
        drawSpeech();
      }
      function drawPolana() {
        skyGrad('#9fd6ff', '#eaf8ff', LH * 0.55);
        g.beginPath(); g.arc(LW * 0.8, LH * 0.12, 28, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
        g.fillStyle = 'rgba(255,255,255,.95)';
        [[0.15, 0.1], [0.5, 0.18]].forEach(function (c) { var x = LW * c[0] + Math.sin(T * 0.1 + c[0] * 9) * 10, y = LH * c[1]; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.arc(x + 17, y - 6, 19, 0, Math.PI * 2); g.arc(x + 36, y, 14, 0, Math.PI * 2); g.fill(); });
        // forest
        for (var i = 0; i < Math.ceil(LW / 46) + 1; i++) {
          var tx = i * 46 + (i % 2) * 12, ty = LH * 0.5 - (i % 3) * 10;
          g.beginPath(); g.moveTo(tx, ty - 70); g.lineTo(tx + 24, ty); g.lineTo(tx - 24, ty); g.closePath(); g.fillStyle = i % 2 ? '#3f8f4f' : '#4aa451'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
        }
        g.beginPath(); g.moveTo(0, LH * 0.52); g.quadraticCurveTo(LW * 0.3, LH * 0.46, LW * 0.6, LH * 0.53); g.quadraticCurveTo(LW * 0.85, LH * 0.58, LW + 2, LH * 0.5); g.lineTo(LW + 2, LH + 2); g.lineTo(0, LH + 2); g.closePath();
        g.fillStyle = '#9ad672'; g.fill(); outline(g, 2);
        for (var f = 0; f < 22; f++) {
          var fx = ((Math.sin(f * 12.9898) * 43758.5453) % 1 + 1) % 1 * LW, fy = LH * 0.58 + ((Math.sin(f * 78.233) * 12345.678) % 1 + 1) % 1 * LH * 0.4;
          g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy + 8); g.strokeStyle = '#3fae5f'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.arc(fx, fy, 3.5, 0, Math.PI * 2); g.fillStyle = ['#ff7eb6', '#fff', '#f5c330', '#b48cf0'][f % 4]; g.fill();
        }
        // sign
        var sx = LW * 0.06, sy = LH * 0.52;
        rr(g, sx + 26, sy - 6, 7, 40, 2); g.fillStyle = '#8a6142'; g.fill(); outline(g, 1.8);
        rr(g, sx, sy - 34, 120, 32, 8); g.fillStyle = '#c98f5a'; g.fill(); outline(g, 2.5);
        g.font = '20px ' + FONT; g.fillStyle = '#fff8ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Leśna Polana', sx + 60, sy - 17);
        // butterflies
        for (var bI = 0; bI < 3; bI++) {
          var bx = LW * (0.3 + 0.25 * bI) + Math.sin(T * 0.7 + bI * 2) * 40, by = LH * (0.4 + 0.08 * bI) + Math.sin(T * 1.3 + bI) * 16, fl = Math.abs(Math.sin(T * 9 + bI)) * 0.8 + 0.2;
          g.save(); g.translate(bx, by); g.fillStyle = ['#ffb3d1', '#ffe066', '#b9d8ff'][bI];
          g.beginPath(); g.ellipse(-4, 0, 5 * fl, 7, -0.4, 0, Math.PI * 2); g.ellipse(4, 0, 5 * fl, 7, 0.4, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
          g.restore();
        }
        var mp = meadowPets();
        mp.slice().sort(function (a, b) { return MR(a).y - MR(b).y; }).forEach(function (p) {
          var r = MR(p), s = meadowScale(p), G = geo(p.sp, p.stage), lift = r.hop >= 0 ? Math.sin(Math.PI * r.hop) * 18 : 0;
          if (SP[p.sp].hops && r.walking && !reduce) lift += Math.abs(Math.sin(r.legs * 0.55)) * 7 * s;
          shadow(r.x, r.y, (G.x1 - G.x0) * s * 0.4);
          g.save(); g.translate(r.x, r.y - lift); g.scale(s * r.face, s);
          drawCritter(g, p.sp, { t: T, stage: p.stage, legs: r.walking ? r.legs : 0, wear: wearOf(p), eye: r.hop >= 0 ? 'happy' : 'open', mouth: r.hop >= 0 ? 'open' : 'smile', seed: r.seed, wag: 0.5 });
          g.restore();
          g.font = '17px ' + FONT; var tw = g.measureText(p.name).width + 14;
          rr(g, r.x - tw / 2, r.y + 6, tw, 22, 10); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
          g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.name, r.x, r.y + 17.5);
        });
        if (!mp.length) {
          g.font = '24px ' + FONT; var msg = 'Na polanie nikogo nie ma.', msg2 = 'Tu przychodzą zwierzątka z domku.';
          rr(g, LW / 2 - 170, LH * 0.66, 340, 70, 18); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); outline(g, 2.5);
          text(msg, LW / 2, LH * 0.66 + 22, 24, INK); text(msg2, LW / 2, LH * 0.66 + 50, 20, MUTED);
        }
        drawParts();
      }
      function draw() {
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        if (GS && MG[mode]) { MG[mode].draw(); drawParts(); }
        else if (mode === 'polana') drawPolana();
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

      // ---------- help / news ----------
      function showHelp() {
        var p = sel(); if (!p || panel) return;
        save.seenHelp = true; persist();
        panel = ctx.panel({
          title: 'Zwierzątko', closable: false, button: 'Do domku',
          lines: ['To jest ' + p.name + ', Twój maluch!', 'Karm, kąp, usypiaj i baw się. Za opiekę są poziomy. Na poziomie 10 i 20 dotknij „Urośnij!”.', 'Głaszcz je palcem. Po dobrym głaskaniu wystawi brzuszek!',
            { text: 'Nic złego się nie stanie. Dotknij tabliczki z imieniem, żeby je zmienić. W Rodzinie adoptujesz więcej zwierzątek.', muted: true }],
          onPlay: function () { panel = null; var q = sel(); if (q) { R(q).hop = 0; say(q, 'Cześć! Jestem ' + q.name + '!', 2.4); } }
        });
      }
      function showNews() {
        var p = sel(); if (!p || panel) return;
        save.seenV2 = true; save.seenHelp = true; save.seenLvl = true; persist();
        panel = ctx.panel({
          title: 'Nowości w domku!', closable: false, button: 'Super!',
          lines: [p.name + ' ma poziom ' + levelOf(p.gp) + '. Za opiekę są poziomy, a na poziomie 10 i 20 dotknij „Urośnij!”.','W Rodzinie adoptujesz lisa, fenka, wiewiórkę, borsuka, chomika, świnkę morską, królika albo kotka. W domku zmieszczą się trzy naraz!',
            'Głaszcz zwierzątko palcem, a wystawi brzuszek. Jest też 5 nowych zabaw.'],
          onPlay: function () { panel = null; var q = sel(); if (q) { R(q).hop = 0; R(q).happy = 1.5; say(q, 'Hura! Będę mieć przyjaciół!', 2.4); } }
        });
      }

      function showLevels() {
        var p = sel(); if (!p || panel) return;
        save.seenLvl = true; persist();
        panel = ctx.panel({
          title: 'Nowość: poziomy!', closable: false, button: 'Super!',
          lines: ['Każde zwierzątko ma teraz swój poziom. ' + p.name + ' ma poziom ' + levelOf(p.gp) + '.', 'Karmienie, kąpiel, spanie, głaskanie i zabawy dają punkty.',
            'Na poziomie 10 i 20 pojawi się przycisk „Urośnij!”. Dotknij go, a zwierzątko urośnie!'],
          onPlay: function () { panel = null; var q = sel(); if (q) { R(q).hop = 0; R(q).happy = 1.5; say(q, canGrow(q) ? 'Hura! Mogę urosnąć!' : 'Zbieramy poziomy!', 2.4); } syncGrow(); }
        });
      }

      // test hook (read-only use)
      cv._zw = function () {
        return {
          mode: mode, S: S, LW: LW, LH: LH, HS: HS, FY: FY, sel: save.sel, slots: save.slots, basketLeft: save.basketLeft, food: !!food, dark: dark, plate: plate, duo: !!duo, growQ: growQ.length, overlay: !!overlay, growBtn: !growBtn.hidden,
          pets: save.pets.map(function (p) {
            var r = p.home ? R(p) : MR(p), pose = p.home ? poseOf(p) : 'stand', G = geo(p.sp, p.stage, pose);
            return { id: p.id, sp: p.sp, name: p.name, stage: p.stage, gp: p.gp, lvl: levelOf(p.gp), ready: canGrow(p), gToday: p.gToday || 0, home: p.home, asleep: p.asleep, needs: p.needs, wear: wearOf(p),
              x: r.x, y: p.home ? petY(p) : r.y, s: p.home ? petScale(p) : meadowScale(p), face: r.face, belly: r.belly || 0, pm: r.pm || 0, pose: pose,
              box: { x0: G.x0, x1: G.x1, top: G.top, hx: G.hx, hy: G.hy, hr: G.hr, cx: G.cx, cy: G.cy, rx: G.rx } };
          }),
          gs: GS ? JSON.parse(JSON.stringify(GS, function (k, v) { return k === 'btns' ? undefined : v; })) : null
        };
      };

      // debug hook (tests only): NG_DEBUG.zwierzak.play('ball' | 'chase' | 'hug') starts a scene now if two pets are free
      if (window.NG_DEBUG) window.NG_DEBUG.zwierzak = {
        play: function (k) { return startPlay(k); }, stop: stopPlay,
        scene: function () { return play ? JSON.parse(JSON.stringify(play)) : null; }, ball: function () { return playBall(); }, state: cv._zw
      };

      // ---------- boot ----------
      settle(NOW);
      var away = save.lastSeen ? NOW - save.lastSeen : 0;
      homePets().forEach(function (p) { if (p.asleep && p.needs.sleep >= 100) p.asleep = false; });
      save.pets.forEach(function (p) { ctx.sticker('sp-' + p.sp); });
      if (save.pets.length) statsPets();   // a migrated grown-up gets its medal and sticker right away
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      renderChips();
      setMode('home');
      start();
      var first = sel();
      if (!save.pets.length) openAdopt();
      else if (!save.seenV2) showNews();
      else if (!save.seenHelp) showHelp();
      else if (!save.seenLvl) showLevels();
      else if (first && first.asleep) say(first, 'Chrr...', 1.5);
      else if (first && away > 6 * 3600000) {
        homePets().forEach(function (p) { var r = R(p); r.hop = 0; r.happy = 1.5; });
        say(first, 'Hej! Brakowało mi Ciebie!', 2.8);
        burst('heart', R(first).x, R(first).y - 40 * petScale(first), 5);
        if (minNeed(first) < 45) { var lk0 = lowest(first); later(function () { if (mode === 'home' && !speech && !food && !first.asleep) say(first, needSay(lk0, first.needs[lk0]), 2.6); }, 3200); }
      } else if (first) say(first, pick(['Cześć!', 'Hej, to Ty!', 'Hura, jesteś!']), 1.8);
      persist();

      return {
        pause: function () { stopPlay(); running = false; if (raf) cancelAnimationFrame(raf); raf = 0; persist(); },
        resume: function () { if (running) return; running = true; settle(Date.now()); updateHud(); start(); },
        destroy: function () {
          stopPlay(); running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          if (GS && !GS.done && MG[mode]) { try { addNeed(sel(), 'fun', 25 * clamp(MG[mode].frac(), 0, 1)); } catch (e) {} }
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
