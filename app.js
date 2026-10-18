/* Ayo Arena: UI, ladder, and start.ng hookup. Rules live in engine.js. */
(function () {
  'use strict';
  window.__appLoaded = true;
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- start.ng connect page (from the docs) ---------- */
  const START_NG = 'https://start.ng';
  let frame;
  function connectFrame() {
    frame ??= new Promise((resolve, reject) => {
      const el = document.createElement('iframe');
      el.src = `${START_NG}/connect`;
      el.hidden = true;
      el.onload = () => resolve(el);
      el.onerror = reject;
      document.body.append(el);
    });
    return frame;
  }
  async function askStartNg(message, replyType, timeoutMs = 5000) {
    let el;
    try { el = await connectFrame(); } catch (_) { return null; }
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
      const timer = setTimeout(() => done(null), timeoutMs);
      function onMessage(e) {
        if (e.origin !== START_NG || e.source !== el.contentWindow) return;
        if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
      }
      addEventListener('message', onMessage);
      el.contentWindow.postMessage({ ...message, requestId }, START_NG);
    });
  }
  const signInUrl = () => `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;

  /* ---------- player / profile card ---------- */
  let me = { id: null, name: 'Guest', account: null, face: null, signedIn: false };

  function fallbackFace(name) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#d8fd71'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#292a23'; g.font = '700 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name || 'G')[0].toUpperCase(), 48, 52);
    return c.toDataURL('image/png');
  }

  async function refreshPlayer() {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
    const u = reply?.user, p = u ?? reply?.guest;
    me = {
      id: u?.id ?? null,
      name: p?.name || 'Guest',
      account: u?.account || null,
      face: p?.face || fallbackFace(p?.name || 'Guest'),
      signedIn: !!u,
    };
    $('player-face').src = me.face;
    $('player-name').textContent = me.name;
    $('player-account').textContent = me.account ? `@${me.account}` : 'Not signed in';
    $('player-sign-in').hidden = me.signedIn;
    $('player-card').hidden = false;
    if (game && game.mode === 'ladder') $('store0-label').textContent = me.name;
    if (game && game.mode === 'duo') $('store0-label').textContent = me.name === 'Guest' ? 'Player 1' : me.name;
  }
  $('player-sign-in').onclick = () => { location.href = signInUrl(); };
  addEventListener('focus', refreshPlayer);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPlayer(); });

  /* ---------- sound ---------- */
  let muted = false;
  try { muted = localStorage.getItem('ayo_muted') === '1'; } catch (_) {}
  let ac;
  function tone(freq, dur, type = 'sine', vol = 0.06, slide = 0) {
    if (muted) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, ac.currentTime + dur);
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (_) {}
  }
  const sfx = {
    drop: (i) => tone(300 + (i % 6) * 22, 0.07, 'triangle', 0.07, 0.6),
    grab: () => tone(180, 0.1, 'triangle', 0.08, 0.7),
    capture: () => { tone(520, 0.12, 'square', 0.04); setTimeout(() => tone(780, 0.18, 'square', 0.04), 90); },
    win: () => [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), k * 120)),
    lose: () => [392, 330, 262].forEach((f, k) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.04), k * 160)),
  };
  function paintSoundBtn() { $('btn-sound').textContent = muted ? '🔇' : '🔊'; }
  $('btn-sound').onclick = () => {
    muted = !muted; paintSoundBtn();
    try { localStorage.setItem('ayo_muted', muted ? '1' : '0'); } catch (_) {}
  };
  paintSoundBtn();

  /* ---------- opponents ---------- */
  const OPPONENTS = [
    { name: 'Mama Put', emoji: '🍲', depth: 1, noise: 0.45, sub: 'Plays while the stew simmers' },
    { name: 'Danfo Conductor', emoji: '🚌', depth: 2, noise: 0.25, sub: 'Fast hands, no plan' },
    { name: 'Aunty Ngozi', emoji: '👩🏾', depth: 3, noise: 0.12, sub: 'Has won every wedding tournament' },
    { name: 'Okada Rider', emoji: '🏍️', depth: 4, noise: 0.05, sub: 'Weaves through your defences' },
    { name: 'Baba Ijebu', emoji: '👴🏾', depth: 5, noise: 0, sub: 'Counts seeds in his sleep' },
    { name: 'Chief Oga', emoji: '🎩', depth: 6, noise: 0, sub: 'Does not lose. Ask anyone.' },
    { name: 'Iya Agba', emoji: '👵🏾', depth: 8, noise: 0, sub: 'Taught your grandfather' },
    { name: 'Olopon Grandmaster', emoji: '👑', depth: 10, noise: 0, sub: 'The board answers to him' },
  ];
  function opponentFor(level) {
    if (level < OPPONENTS.length) return OPPONENTS[level];
    const n = level - OPPONENTS.length + 1;
    return { name: `Ayo Legend ${n}`, emoji: '🔥', depth: 11, noise: 0, sub: 'Beyond the ladder' };
  }
  const TAUNT = {
    start: ['Sit down well, let us play.', 'You don come. Okay.', 'Oya, make we start.', 'I go dey patient with you.'],
    aiCapture: ['Ehen! Those seeds are mine now.', 'Sorry o, na so e be.', 'Chop knuckle!', 'You no dey look well?'],
    youCapture: ['Wahala! You see my seeds?', 'Haba! Why you wicked like this?', 'Okay o, I see you.', 'Beginner luck.'],
    aiWin: ['I tire for you o.', 'Come back when you don learn.', 'Next!'],
    aiLose: ['You try. The next one is hungry.', 'Na luck. Go on, climb.', 'Ah! Who taught you?'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- 3D board (three.js, see board3d.js) ---------- */
  let view = null;
  function ensureView() {
    if (view) { view.resize(); return true; }
    const stage = $('stage');
    try {
      if (typeof THREE === 'undefined') throw new Error('three.js did not load');
      view = Board3D.create(stage, { onPick: (i) => onPit(i) });
      return true;
    } catch (err) {
      console.error(err);
      stage.innerHTML = '<div class="fail">The 3D board could not start. Check your connection and that your browser supports WebGL, then reload.</div>';
      return false;
    }
  }

  let game = null;       // current game
  let dispStore = [0, 0];

  function render(legal) {
    if (view) view.setLegal(legal || null);
    $('store0-count').textContent = dispStore[0];
    $('store1-count').textContent = dispStore[1];
  }
  function flash(i, kind) { if (view) view.flash(i, kind); }
  function say(html) { $('status').innerHTML = html; }
  function bubble(text) {
    const b = $('bubble');
    if (!text) { b.hidden = true; return; }
    b.textContent = text; b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }

  /* ---------- game flow ---------- */
  const SPEED = 260;
  function startGame(mode, level = 0, run = null) {
    const aiFirst = mode === 'ladder' && level % 2 === 1;
    const s = Ayo.newState();
    s.turn = aiFirst ? 1 : 0;
    game = {
      mode, level, s, busy: false, over: false,
      opp: mode === 'ladder' ? opponentFor(level) : null,
      run: run || { beaten: 0, seeds: 0 },
      myCaptured: 0,
    };
    show('game');
    $('overlay').hidden = true;
    $('store0-label').textContent = mode === 'duo' ? (me.signedIn ? me.name : 'Player 1') : me.name;
    $('store1-label').textContent = mode === 'duo' ? 'Player 2' : game.opp.name;
    if (mode === 'ladder') {
      $('opp-avatar').textContent = game.opp.emoji;
      $('opp-name').textContent = game.opp.name;
      $('opp-sub').textContent = `Round ${level + 1} · ${game.opp.sub}`;
      bubble(pick(TAUNT.start));
    } else {
      $('opp-avatar').textContent = '🫱🏾‍🫲🏽';
      $('opp-name').textContent = 'Two players';
      $('opp-sub').textContent = 'Pass the phone after each move';
      bubble('');
    }
    dispStore = [0, 0];
    if (!ensureView()) return;
    view.setPits(s.pits, [0, 0]);
    paintRunStats();
    render(null);
    nextTurn();
  }

  function paintRunStats() {
    const r = $('runstats');
    if (game.mode !== 'ladder') { r.innerHTML = ''; return; }
    r.innerHTML = `<span class="chip">Beaten <b>${game.run.beaten}</b></span><span class="chip">Seeds won <b>${game.run.seeds + game.myCaptured}</b></span>`;
  }

  function isAI(turn) { return game.mode === 'ladder' && turn === 1; }

  function nextTurn() {
    if (!game || game.over) return;
    const s = game.s;
    const moves = Ayo.legalMoves(s);
    if (isAI(s.turn)) {
      game.busy = true; render(null);
      say(`${game.opp.name} is thinking…`);
      setTimeout(() => {
        if (!game || game.over) return;
        const m = Ayo.chooseMove(s, game.opp);
        play(m);
      }, 650);
      return;
    }
    game.busy = false;
    render(moves);
    if (game.mode === 'duo') {
      const who = s.turn === 0 ? (me.signedIn ? me.name : 'Player 1') : 'Player 2';
      say(`<b>${esc(who)}</b>, your move. ${s.turn === 0 ? 'Pick a pit on the bottom row.' : 'Pick a pit on the top row.'}`);
    } else {
      const fed = Ayo.seedsOn(s, 1) === 0;
      say(fed ? 'Rival has no seeds. <b>You must feed them.</b>' : 'Your move. Tap a glowing pit on your row.');
    }
  }

  function onPit(i) {
    if (!game || game.busy || game.over) return;
    if (!Ayo.legalMoves(game.s).includes(i)) return;
    play(i);
  }
  addEventListener('keydown', (e) => {
    if (!game || $('game').hidden || !$('overlay').hidden) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 6) {
      const i = game.s.turn === 0 ? n - 1 : 12 - n;
      if (game.mode === 'ladder' && game.s.turn === 1) return;
      onPit(i);
    }
  });

  async function play(pit) {
    const g = game;
    g.busy = true; render(null);
    const before = g.s;
    const r = Ayo.applyMove(before, pit);
    const mover = before.turn;
    flash(pit, 'grab'); sfx.grab();
    say(`${isAI(mover) ? esc(g.opp.name) : 'Sowing'}: ${before.pits[pit]} seeds from pit ${mover === 0 ? pit + 1 : 12 - pit}`);
    await view.lift(pit);
    for (const idx of r.sown) {
      if (g !== game) return;
      await view.drop(idx, SPEED);
      sfx.drop(idx); flash(idx, 'drop');
    }
    await sleep(220);
    if (g !== game) return;
    if (r.captured.length) {
      for (const i of r.captured) flash(i, 'cap');
      sfx.capture();
      say(`<b>${mover === 0 || g.mode === 'duo' ? (mover === 0 ? 'You capture' : 'Player 2 captures') : esc(g.opp.name) + ' captures'} ${r.gained}</b>`);
      await sleep(500);
      await view.capture(r.captured, mover);
      dispStore[mover] += r.gained;
      $('store' + mover).classList.remove('flash'); void $('store' + mover).offsetWidth; $('store' + mover).classList.add('flash');
      if (g.mode === 'ladder') {
        if (mover === 0) { g.myCaptured += r.gained; bubble(pick(TAUNT.youCapture)); }
        else bubble(pick(TAUNT.aiCapture));
        paintRunStats();
      }
      render(null);
      await sleep(250);
    } else if (r.grandSlam) {
      say('Grand slam: capturing every seed is not allowed, so nothing is taken.');
      await sleep(900);
    }
    g.s = r.state;
    if (r.ended) {
      dispStore = r.state.store.slice();
      if (r.state.reason === 'starved' || r.state.reason === 'cycle') say('No more moves: each side keeps the seeds on its own pits.');
      view.setPits(r.state.pits, r.state.store);
      render(null);
      await sleep(r.state.reason === 'majority' ? 400 : 1100);
      return finish();
    }
    nextTurn();
  }

  /* ---------- results ---------- */
  function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function modal(html) { $('modal').innerHTML = html; $('overlay').hidden = false; const b = $('modal').querySelector('.btn'); if (b) b.focus(); }
  function closeModal() { $('overlay').hidden = true; }

  async function finish() {
    const g = game; g.over = true;
    const st = g.s;
    const mine = st.store[0], theirs = st.store[1];
    if (g.mode === 'duo') {
      const name = st.winner === 0 ? (me.signedIn ? me.name : 'Player 1') : st.winner === 1 ? 'Player 2' : null;
      sfx.win();
      modal(`<h2>${name ? esc(name) + ' wins!' : 'A draw!'}</h2><div class="big">${mine} : ${theirs}</div>
        <p>${name ? 'Well played. Rematch?' : 'Evenly matched. Rematch?'}</p>
        <div class="row"><button class="btn primary" id="m-again">Play again</button><button class="btn light" id="m-menu">Menu</button></div>`);
      $('m-again').onclick = () => startGame('duo');
      $('m-menu').onclick = toMenu;
      return;
    }
    if (st.winner === 0) {
      g.run.beaten++; g.run.seeds += g.myCaptured;
      g.myCaptured = 0;
      paintRunStats();
      sfx.win();
      bubble(pick(TAUNT.aiLose));
      const next = opponentFor(g.level + 1);
      saveRun(g.run);
      modal(`<h2>You beat ${esc(g.opp.name)}!</h2><div class="big">${mine} : ${theirs}</div>
        <p>That's <b>${g.run.beaten}</b> in a row. Next up: <b>${esc(next.name)}</b> ${next.emoji}</p>
        ${me.signedIn ? '' : '<p class="nudge">You are playing as a guest. Sign in on start.ng to put your run on the leaderboard.</p>'}
        <div class="row"><button class="btn primary" id="m-next">Next rival</button></div>`);
      $('m-next').onclick = () => startGame('ladder', g.level + 1, g.run);
    } else if (st.winner === 1) {
      sfx.lose();
      bubble(pick(TAUNT.aiWin));
      g.run.seeds += g.myCaptured; g.myCaptured = 0;
      const total = g.run.seeds;
      saveRun(g.run, true);
      const prev = bestLocal();
      modal(`<h2>${esc(g.opp.name)} wins</h2><div class="big">${mine} : ${theirs}</div>
        <p>Run over. You beat <b>${g.run.beaten}</b> ${g.run.beaten === 1 ? 'rival' : 'rivals'} and won <b>${total}</b> seeds along the way.</p>
        ${prev && prev.beaten === g.run.beaten && prev.seeds === total && g.run.beaten > 0 ? '<p><b>That is your best run.</b></p>' : ''}
        ${me.signedIn ? '<p class="nudge">Your best run is on the leaderboard.</p>' : '<p class="nudge">Sign in on start.ng to save runs to the leaderboard.</p>'}
        <div class="row"><button class="btn primary" id="m-again">Climb again</button><button class="btn light" id="m-board">Leaderboard</button><button class="btn light" id="m-menu">Menu</button></div>`);
      $('m-again').onclick = () => startGame('ladder', 0);
      $('m-board').onclick = () => showBoard(() => finishRetry(g));
      $('m-menu').onclick = toMenu;
    } else {
      bubble('A draw? Again, then.');
      modal(`<h2>A draw</h2><div class="big">${mine} : ${theirs}</div><p>Nobody wins, nobody loses. Rematch against ${esc(g.opp.name)}.</p>
        <div class="row"><button class="btn primary" id="m-next">Rematch</button></div>`);
      $('m-next').onclick = () => startGame('ladder', g.level, g.run);
    }
  }
  function finishRetry(g) {
    // re-open the loss dialog after viewing the leaderboard
    game = g; closeModal(); finish();
  }

  /* ---------- scores ---------- */
  function bestLocal() { try { return JSON.parse(localStorage.getItem('ayo_best') || 'null'); } catch (_) { return null; } }
  function betterThan(a, b) { return !b || a.beaten > b.beaten || (a.beaten === b.beaten && a.seeds > b.seeds); }
  async function saveRun(run) {
    const stats = { beaten: Math.min(run.beaten, 1e9), seeds: Math.min(run.seeds, 1e9) };
    if (stats.beaten === 0 && stats.seeds === 0) return;
    if (betterThan(stats, bestLocal())) { try { localStorage.setItem('ayo_best', JSON.stringify(stats)); } catch (_) {} }
    if (me.signedIn) {
      const saved = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
      if (saved?.ok && saved.result?.rank) game && (game.lastRank = saved.result.rank);
    }
    paintBest();
  }
  function paintBest() {
    const b = bestLocal();
    $('best-line').textContent = b ? `Your best run: ${b.beaten} ${b.beaten === 1 ? 'rival' : 'rivals'} beaten, ${b.seeds} seeds won.` : '';
  }

  async function showBoard(onBack) {
    modal('<h2>Leaderboard</h2><p>Loading…</p>');
    const r = await askStartNg({ type: 'startng:leaderboard', limit: 20 }, 'startng:leaderboardData', 6000);
    const close = onBack || closeModal;
    if (!r?.ok) {
      modal(`<h2>Leaderboard</h2><p>The board is only reachable when the game is open on start.ng.</p><div class="row"><button class="btn" id="m-close">Close</button></div>`);
      $('m-close').onclick = close; return;
    }
    const rows = r.entries.length ? r.entries.map((e) => `
      <tr class="${me.id != null && e.player_id === me.id ? 'me' : ''}"><td>${e.rank}</td><td>${esc(e.name)}</td>
      <td class="num">${e.stats?.beaten ?? e.score}</td><td class="num">${e.stats?.seeds ?? ''}</td></tr>`).join('')
      : '<tr><td colspan="4">No runs yet. Be the first.</td></tr>';
    modal(`<h2>Leaderboard</h2><p>Best run per player: most rivals beaten, then seeds won.</p>
      <table class="lb"><thead><tr><th>#</th><th>Player</th><th class="num">Beaten</th><th class="num">Seeds</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="row"><button class="btn" id="m-close">Close</button></div>`);
    $('m-close').onclick = close;
  }

  function showHelp() {
    modal(`<h2>How to play</h2>
      <ul>
        <li>Each side has <b>6 pits</b> with <b>4 seeds</b>. Tap one of your glowing pits to lift all its seeds and sow them one by one, counter-clockwise around the board.</li>
        <li>If your last seed lands in a <b>rival pit that now holds 2 or 3 seeds</b>, you capture them. Keep going backwards through rival pits that also hold 2 or 3.</li>
        <li>A pit with 12 or more seeds skips the pit it started from.</li>
        <li>You may not take <b>every</b> rival seed in one capture (grand slam), and if the rival has no seeds you must give them some.</li>
        <li>First to <b>25 seeds</b> wins. Keys 1 to 6 also work.</li>
        <li><b>Ladder:</b> beat each rival to climb. One loss ends the run. Your best run goes on the start.ng leaderboard.</li>
      </ul>
      <div class="row"><button class="btn" id="m-close">Got it</button></div>`);
    $('m-close').onclick = closeModal;
  }

  /* ---------- navigation ---------- */
  function show(which) { $('menu').hidden = which !== 'menu'; $('game').hidden = which !== 'game'; }
  function toMenu() { game = null; closeModal(); show('menu'); paintBest(); }
  $('btn-ladder').onclick = () => { startGame('ladder', 0); };
  $('btn-duo').onclick = () => startGame('duo');
  $('btn-board').onclick = () => showBoard();
  $('btn-help').onclick = showHelp;
  $('btn-quit').onclick = () => {
    if (!game || game.over) return toMenu();
    modal(`<h2>Leave this game?</h2><p>${game.mode === 'ladder' ? 'Leaving ends your run' + (game.run.beaten ? ` (${game.run.beaten} beaten so far is already saved).` : '.') : 'The current game will be lost.'}</p>
      <div class="row"><button class="btn" id="m-stay">Keep playing</button><button class="btn light" id="m-leave">Leave</button></div>`);
    $('m-stay').onclick = closeModal;
    $('m-leave').onclick = toMenu;
  };
  $('overlay').addEventListener('click', (e) => { if (e.target === $('overlay') && game && !game.over) closeModal(); else if (e.target === $('overlay') && !game) closeModal(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('overlay').hidden && (!game || !game.over)) closeModal(); });

  paintBest();
  refreshPlayer();
})();
