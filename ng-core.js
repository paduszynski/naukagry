/*
 * ng-core.js: shared things every game gets through ctx (see README "ctx").
 *  - NG.register(id, impl): impl = { meta, medals, quests, stickers, mount(el, ctx) }
 *  - NG.sound: synthesized sound effects + gentle generated music (no audio files), mute switches
 *  - NG.meta: per-game stats -> medals (bronze/silver/gold), daily quests, sticker album
 * Loaded before games/*.js. Needs skarbonka.js.
 */
(function () {
  'use strict';
  var S = window.Skarbonka;
  var NG = window.NG = window.NG || {};
  NG.impl = NG.impl || {};
  NG.register = function (id, impl) { NG.impl[id] = impl; };

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // =====================================================================
  // Sound
  // =====================================================================
  var SND_KEY = 'naukagry.sound';
  var pref = lsGet(SND_KEY, { sfx: true, music: true });
  var ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  function audio() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    var len = ac.sampleRate * 0.6; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var ch = noiseBuf.getChannelData(0); for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return ac;
  }
  // browsers only start audio after a user gesture
  function unlock() { var a = audio(); if (a && a.state === 'suspended') a.resume().catch(function () {}); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });

  function tone(o) {
    // o: { f, to, dur, type, vol, at, attack, bus, q }
    var a = audio(); if (!a) return;
    var t = a.currentTime + (o.at || 0), dur = o.dur || 0.12, vol = o.vol == null ? 0.5 : o.vol;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(o) {
    // o: { dur, vol, at, filter: 'lowpass'|'bandpass'|'highpass', f, to, q }
    var a = audio(); if (!a) return;
    var t = a.currentTime + (o.at || 0), dur = o.dur || 0.2;
    var src = a.createBufferSource(); src.buffer = noiseBuf;
    var fl = a.createBiquadFilter(); fl.type = o.filter || 'lowpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f || 1200, t);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    var g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol == null ? 0.4 : o.vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function arp(notes, step, type, vol) { notes.forEach(function (m, i) { tone({ f: mtof(m), dur: step * 1.8, type: type || 'triangle', vol: vol || 0.35, at: i * step }); }); }

  var SFX = {
    tap:     function () { tone({ f: 700, dur: 0.05, type: 'sine', vol: 0.25 }); },
    click:   function () { tone({ f: 1200, dur: 0.03, type: 'square', vol: 0.08 }); },
    pop:     function () { tone({ f: 420, to: 900, dur: 0.09, type: 'triangle', vol: 0.4 }); },
    bubble:  function () { tone({ f: 380 + Math.random() * 120, to: 1100, dur: 0.08, type: 'sine', vol: 0.35 }); },
    coin:    function () { tone({ f: 988, dur: 0.07, type: 'square', vol: 0.12 }); tone({ f: 1319, dur: 0.16, type: 'square', vol: 0.12, at: 0.07 }); },
    star:    function () { arp([79, 83, 88], 0.05, 'triangle', 0.3); },
    jump:    function () { tone({ f: 280, to: 620, dur: 0.16, type: 'sine', vol: 0.35 }); },
    land:    function () { noise({ dur: 0.08, vol: 0.18, f: 500 }); },
    swap:    function () { tone({ f: 520, to: 700, dur: 0.07, type: 'triangle', vol: 0.25 }); },
    place:   function () { tone({ f: 200, dur: 0.07, type: 'triangle', vol: 0.4 }); noise({ dur: 0.05, vol: 0.12, f: 2500, filter: 'bandpass' }); },
    rotate:  function () { tone({ f: 330, to: 440, dur: 0.06, type: 'triangle', vol: 0.22 }); },
    clear:   function () { arp([72, 76, 79, 84], 0.045, 'triangle', 0.3); },
    combo:   function () { arp([72, 76, 79, 84, 88, 91], 0.04, 'square', 0.12); },
    splash:  function () { noise({ dur: 0.35, vol: 0.35, f: 2400, to: 300, filter: 'lowpass' }); tone({ f: 600, to: 200, dur: 0.15, vol: 0.12 }); },
    water:   function () { noise({ dur: 0.6, vol: 0.18, f: 900, filter: 'bandpass', q: 2 }); },
    whoosh:  function () { noise({ dur: 0.3, vol: 0.25, f: 400, to: 3000, filter: 'bandpass', q: 1.5 }); },
    hit:     function () { tone({ f: 160, to: 70, dur: 0.22, type: 'square', vol: 0.18 }); noise({ dur: 0.15, vol: 0.25, f: 800 }); },
    error:   function () { tone({ f: 220, dur: 0.1, type: 'square', vol: 0.12 }); tone({ f: 185, dur: 0.14, type: 'square', vol: 0.12, at: 0.11 }); },
    win:     function () { arp([72, 76, 79, 84, 79, 84], 0.09, 'triangle', 0.35); },
    lose:    function () { tone({ f: 392, to: 196, dur: 0.5, type: 'triangle', vol: 0.3 }); },
    medal:   function () { arp([67, 72, 76, 79, 84], 0.07, 'square', 0.12); arp([79, 84, 88], 0.07, 'triangle', 0.25); },
    plant:   function () { tone({ f: 300, to: 500, dur: 0.12, type: 'sine', vol: 0.3 }); noise({ dur: 0.1, vol: 0.12, f: 700 }); },
    harvest: function () { tone({ f: 500, to: 1000, dur: 0.12, type: 'triangle', vol: 0.3 }); arp([84, 88], 0.06, 'sine', 0.2); },
    buy:     function () { arp([76, 81], 0.06, 'square', 0.1); },
    paint:   function () { noise({ dur: 0.12, vol: 0.12, f: 1800, to: 900, filter: 'bandpass' }); },
    open:    function () { tone({ f: 440, to: 660, dur: 0.1, type: 'sine', vol: 0.2 }); },
    close:   function () { tone({ f: 660, to: 440, dur: 0.1, type: 'sine', vol: 0.2 }); },
    tick:    function () { tone({ f: 1500, dur: 0.02, type: 'sine', vol: 0.12 }); },
    reel:    function () { noise({ dur: 0.06, vol: 0.1, f: 3000, filter: 'highpass' }); }
  };
  function sfx(name) {
    if (!pref.sfx) return;
    var fn = SFX[name] || SFX.tap;
    try { fn(); } catch (e) {}
  }
  // a soft plucked note (Pianinko and anything musical); midi number
  function note(m, dur, vol) {
    if (!pref.sfx) return;
    var f = mtof(m);
    tone({ f: f, dur: dur || 0.6, type: 'triangle', vol: vol || 0.4, attack: 0.005 });
    tone({ f: f * 2, dur: (dur || 0.6) * 0.5, type: 'sine', vol: (vol || 0.4) * 0.25, attack: 0.005 });
  }

  // generated background music: a few chords with a wandering pentatonic tune, per theme
  var THEMES = {
    meadow: { root: 60, bpm: 104, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'triangle' },
    calm:   { root: 57, bpm: 76, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]], lead: 'sine' },
    water:  { root: 62, bpm: 84, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'sine' },
    sky:    { root: 65, bpm: 96, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: 'triangle' },
    play:   { root: 64, bpm: 120, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: 'square' },
    cozy:   { root: 58, bpm: 88, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], lead: 'triangle' }
  };
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  var music = { theme: null, timer: 0, beat: 0, nextT: 0, last: 4 };
  function musicStep() {
    var a = audio(); if (!a || !music.theme) return;
    var th = THEMES[music.theme], spb = 60 / th.bpm;
    while (music.nextT < a.currentTime + 0.25) {
      var b = music.beat, bar = Math.floor(b / 4) % th.chords.length, ch = th.chords[bar], t0 = music.nextT - a.currentTime;
      if (b % 4 === 0) {
        tone({ f: mtof(th.root - 12 + ch[0]), dur: spb * 3.6, type: 'sine', vol: 0.5, at: t0, attack: 0.02, bus: musicBus });
        ch.forEach(function (n) { tone({ f: mtof(th.root + n), dur: spb * 3.2, type: 'sine', vol: 0.12, at: t0, attack: 0.08, bus: musicBus }); });
      }
      if (Math.random() < 0.72) {
        var step = Math.max(0, Math.min(PENTA.length - 1, music.last + Math.round((Math.random() - 0.5) * 3)));
        music.last = step;
        tone({ f: mtof(th.root + 12 + PENTA[step]), dur: spb * (Math.random() < 0.3 ? 1.6 : 0.8), type: th.lead, vol: th.lead === 'square' ? 0.06 : 0.22, at: t0, attack: 0.01, bus: musicBus });
      }
      music.beat++; music.nextT += spb;
    }
  }
  function musicStart(theme) {
    music.theme = THEMES[theme] ? theme : 'meadow';
    if (!pref.music) return;
    var a = audio(); if (!a) return;
    clearInterval(music.timer);
    music.nextT = a.currentTime + 0.1; music.beat = 0;
    music.timer = setInterval(musicStep, 100);
  }
  function musicStop() { clearInterval(music.timer); music.timer = 0; music.theme = null; }
  function musicPause() { clearInterval(music.timer); music.timer = 0; }
  function musicResume() { if (music.theme && pref.music && !music.timer) musicStart(music.theme); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) musicPause(); else musicResume(); });

  var soundListeners = [];
  function setPref(k, v) {
    pref[k] = v; lsSet(SND_KEY, pref);
    if (k === 'music') { if (v && music.theme) musicStart(music.theme); else if (!v) { var th = music.theme; musicPause(); music.theme = th; } }
    soundListeners.forEach(function (f) { f(pref); });
  }
  NG.sound = {
    sfx: sfx, note: note, mtof: mtof, tone: tone, noise: noise,
    music: musicStart, stopMusic: musicStop,
    pref: function () { return { sfx: pref.sfx, music: pref.music }; },
    set: setPref,
    on: function (f) { soundListeners.push(f); },
    list: Object.keys(SFX)
  };

  // =====================================================================
  // Stats, medals, quests, album
  // =====================================================================
  var META_KEY = 'naukagry.meta';
  function readMeta() {
    var m = lsGet(META_KEY, null) || {};
    m.stats = m.stats || {}; m.medals = m.medals || {}; m.stickers = m.stickers || {}; m.q = m.q || null; m.questDays = m.questDays || 0;
    return m;
  }
  // quest rewards are paid only after the meta is saved: a gift fires wallet listeners that re-check quests,
  // and they must already see the quest as done (otherwise: endless gift -> check -> gift recursion)
  var owed = [];
  function writeMeta(m) {
    lsSet(META_KEY, m);
    var pay = owed; owed = [];
    pay.forEach(function (g) { S.gift(g[0], 'naukagry', g[1]); });
    metaListeners.forEach(function (f) { try { f(); } catch (e) {} });
  }
  var metaListeners = [];
  var TIER = { 1: { n: 'brązowy', e: '🥉', c: '#c8814a' }, 2: { n: 'srebrny', e: '🥈', c: '#9aa6b8' }, 3: { n: 'złoty', e: '🥇', c: '#e3a008' } };

  // learning quests never name a subject (each child learns different ones)
  var LEARN_QUESTS = [
    { id: 'sets', text: 'Ukończ {n} {zestaw} nauki', n: [1, 2, 3], forms: ['zestaw', 'zestawy', 'zestawów'] },
    { id: 'stars', text: 'Zdobądź {n} ★ w nauce', n: [60, 100, 150] }
  ];
  var QUEST_REWARD = 10, QUEST_ALL = 20;
  var QUEST_STICKERS = [1, 3, 7, 14, 30, 60, 100];

  function plural(n, forms) { if (n === 1) return forms[0]; var d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2]; }
  function fmtQuest(q) {
    var t = q.text.replace('{n}', q.need);
    if (q.forms) t = t.replace(/\{[^}]+\}/, plural(q.need, q.forms));
    return t;
  }
  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function questsFor(day) {
    var R = seeded(hash(day));
    var lq = LEARN_QUESTS[Math.floor(R() * LEARN_QUESTS.length)];
    var list = [{ id: 'learn.' + lq.id, kind: 'learn', key: lq.id, text: lq.text, forms: lq.forms, need: lq.n[Math.floor(R() * lq.n.length)], prog: 0, done: false }];
    var pool = [];
    Object.keys(NG.impl).forEach(function (gid) { (NG.impl[gid].quests || []).forEach(function (q) { pool.push({ gid: gid, q: q }); }); });
    var usedGames = {};
    for (var tries = 0; list.length < 3 && tries < 60 && pool.length; tries++) {
      var pick = pool[Math.floor(R() * pool.length)];
      if (usedGames[pick.gid]) continue;
      usedGames[pick.gid] = 1;
      var q = pick.q, n = Array.isArray(q.n) ? q.n[Math.floor(R() * q.n.length)] : q.n;
      list.push({ id: pick.gid + '.' + q.id, kind: 'game', game: pick.gid, stat: q.stat, mode: q.mode || 'add', text: q.text, forms: q.forms, need: n, prog: 0, done: false });
    }
    return { day: day, list: list, all: false };
  }
  function currentQuests(m) {
    var d = today();
    if (!m.q || m.q.day !== d) m.q = questsFor(d);
    else if (m.q.list.length < 3 && !m.q.all) {
      // games added after today's quests were drawn: top the list up
      var fresh = questsFor(d), have = {};
      m.q.list.forEach(function (x) { have[x.game || x.id] = 1; });
      fresh.list.forEach(function (x) { if (m.q.list.length < 3 && x.kind === 'game' && !have[x.game]) { m.q.list.push(x); have[x.game] = 1; } });
    }
    return m.q;
  }
  // learning progress comes from the wallet (any subject)
  function syncLearnQuests(m, notify) {
    var q = currentQuests(m), t = S.todayStats ? S.todayStats() : { sets: 0, earned: 0 }, changed = false;
    q.list.forEach(function (it) {
      if (it.kind !== 'learn' || it.done) return;
      var v = it.key === 'sets' ? t.sets : t.earned;
      if (v !== it.prog) { it.prog = Math.min(v, it.need); changed = true; }
      if (it.prog >= it.need) { completeQuest(m, it, notify); changed = true; }
    });
    return changed;
  }
  var pendingToasts = [];
  function completeQuest(m, it, notify) {
    if (it.done) return;
    it.done = true;
    owed.push([QUEST_REWARD, 'zadanie dnia']);
    queueToast('✔ Zadanie dnia: ' + fmtQuest(it) + ' +' + QUEST_REWARD + ' ★', notify);
    var q = m.q;
    if (!q.all && q.list.every(function (x) { return x.done; })) {
      q.all = true; m.questDays++;
      owed.push([QUEST_ALL, 'wszystkie zadania dnia']);
      queueToast('Wszystkie zadania dnia! +' + QUEST_ALL + ' ★', notify);
      QUEST_STICKERS.forEach(function (n) { if (m.questDays >= n) addSticker(m, 'quest:' + n, notify); });
    }
  }
  function queueToast(text, notify) { pendingToasts.push(text); if (notify) flushToasts(notify); }
  function flushToasts(fn) { while (pendingToasts.length) { var t = pendingToasts.shift(); fn(t); } }

  function addSticker(m, id, notify) {
    if (m.stickers[id]) return false;
    m.stickers[id] = today();
    return true;
  }
  function medalDefs(gid) { return (NG.impl[gid] && NG.impl[gid].medals) || []; }
  function stickerDefs(gid) { return (NG.impl[gid] && NG.impl[gid].stickers) || []; }

  // value of a stat; mode 'add' sums, 'max' keeps the best
  function stat(gid, key, value, mode, notify) {
    var m = readMeta();
    var st = m.stats[gid] = m.stats[gid] || {};
    mode = mode || 'add';
    value = +value || 0;
    if (mode === 'max') st[key] = Math.max(st[key] || 0, value);
    else st[key] = (st[key] || 0) + value;
    // quests
    var q = currentQuests(m);
    q.list.forEach(function (it) {
      if (it.done || it.kind !== 'game' || it.game !== gid || it.stat !== key) return;
      it.prog = Math.min(it.need, it.mode === 'max' ? Math.max(it.prog, value) : it.prog + value);
      if (it.prog >= it.need) completeQuest(m, it, notify);
    });
    syncLearnQuests(m, notify);
    // medals
    var got = m.medals[gid] = m.medals[gid] || [];
    medalDefs(gid).forEach(function (md) {
      if (got.indexOf(md.id) >= 0) return;
      if ((st[md.stat] || 0) >= md.at) {
        got.push(md.id);
        addSticker(m, 'medal:' + gid + ':' + md.id);
        queueToast(TIER[md.tier || 1].e + ' Medal: ' + md.text, notify);
        sfx('medal');
      }
    });
    writeMeta(m);
    return st[key];
  }
  function sticker(gid, id, notify) {
    var m = readMeta();
    if (addSticker(m, 'g:' + gid + ':' + id)) {
      var d = stickerDefs(gid).filter(function (x) { return x.id === id; })[0];
      queueToast('Nowa naklejka: ' + (d ? d.emoji + ' ' + d.name : id), notify);
      sfx('star');
      writeMeta(m);
    }
  }
  function getStat(gid, key) { var m = readMeta(); return (m.stats[gid] || {})[key] || 0; }
  function medalsOf(gid) {
    var m = readMeta(), st = m.stats[gid] || {}, got = m.medals[gid] || [];
    return medalDefs(gid).map(function (md) { return { id: md.id, text: md.text, tier: md.tier || 1, stat: md.stat, at: md.at, value: st[md.stat] || 0, got: got.indexOf(md.id) >= 0 }; });
  }

  // album: every slot the games declare, plus quest-day stickers
  function album() {
    var m = readMeta(), pages = [];
    Object.keys(NG.impl).forEach(function (gid) {
      var impl = NG.impl[gid], name = (impl.meta && impl.meta.name) || gid, slots = [];
      medalDefs(gid).forEach(function (md) { slots.push({ kind: 'medal', tier: md.tier || 1, emoji: TIER[md.tier || 1].e, name: md.text, got: !!m.stickers['medal:' + gid + ':' + md.id] }); });
      stickerDefs(gid).forEach(function (sd) { slots.push({ kind: 'sticker', emoji: sd.emoji, name: sd.name, got: !!m.stickers['g:' + gid + ':' + sd.id] }); });
      if (slots.length) pages.push({ id: gid, name: name, slots: slots });
    });
    pages.push({ id: 'quests', name: 'Zadania dnia', slots: QUEST_STICKERS.map(function (n) {
      return { kind: 'sticker', emoji: n >= 30 ? '🏆' : n >= 7 ? '🌟' : '⭐', name: n === 1 ? 'Pierwszy dzień z zadaniami' : n + ' dni z kompletem zadań', got: !!m.stickers['quest:' + n] };
    }) });
    var total = 0, got = 0;
    pages.forEach(function (p) { p.slots.forEach(function (s) { total++; if (s.got) got++; }); });
    return { pages: pages, total: total, got: got };
  }
  function quests() {
    var m = readMeta(), before = m.q && m.q.day;
    currentQuests(m);
    var changed = syncLearnQuests(m, null) || before !== m.q.day;
    if (changed) writeMeta(m); // listeners re-render the hub, so only write on a real change
    return { list: m.q.list.map(function (it) { return { text: fmtQuest(it), prog: it.prog, need: it.need, done: it.done, game: it.game || null }; }), all: m.q.all, days: m.questDays, reward: QUEST_REWARD, bonus: QUEST_ALL };
  }

  NG.meta = {
    stat: stat, getStat: getStat, sticker: sticker, medals: medalsOf, album: album, quests: quests,
    flushToasts: flushToasts, TIER: TIER,
    on: function (f) { metaListeners.push(f); },
    _read: readMeta, _write: writeMeta
  };
  // learning done in another tab/app shows up here
  // (only in a visible window: two open windows would otherwise both pay the same quest)
  if (S && S.on) S.on(function () { if (document.hidden) return; var m = readMeta(); if (syncLearnQuests(m, null)) writeMeta(m); });
})();
