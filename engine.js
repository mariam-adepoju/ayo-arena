/* Ayo (Oware, Abapa rules) engine + AI. No DOM. Works in browser and node. */
(function (root) {
  'use strict';
  // pits 0-5 belong to player 0 (bottom, left->right); 6-11 to player 1 (top, right->left).
  // Sowing runs counter-clockwise = increasing index mod 12.

  function newState() {
    return { pits: [4,4,4,4,4,4,4,4,4,4,4,4], store: [0, 0], turn: 0, over: false, winner: null, plies: 0 };
  }
  function clone(s) {
    return { pits: s.pits.slice(), store: s.store.slice(), turn: s.turn, over: s.over, winner: s.winner, plies: s.plies };
  }
  const side = (i) => (i < 6 ? 0 : 1);
  const mine = (p) => (p === 0 ? [0,1,2,3,4,5] : [6,7,8,9,10,11]);
  function seedsOn(s, p) { let t = 0; for (const i of mine(p)) t += s.pits[i]; return t; }

  function legalMoves(s) {
    if (s.over) return [];
    const p = s.turn, opp = 1 - p;
    const own = mine(p).filter((i) => s.pits[i] > 0);
    if (seedsOn(s, opp) > 0) return own;
    // opponent is empty: must feed them if possible
    const reach = p === 0 ? 6 : 12; // first index of opponent side (as unwrapped from own pits)
    return own.filter((i) => s.pits[i] >= reach - i);
  }

  // Applies a move. Returns { state, sown:[indices in order], captured:[indices], gained, grandSlam, ended }
  function applyMove(s, pit) {
    const st = clone(s);
    const p = st.turn, opp = 1 - p;
    let n = st.pits[pit];
    st.pits[pit] = 0;
    const sown = [];
    let idx = pit;
    while (n > 0) {
      idx = (idx + 1) % 12;
      if (idx === pit) continue;
      st.pits[idx]++; sown.push(idx); n--;
    }
    const last = idx;
    let captured = [], gained = 0, grandSlam = false;
    if (side(last) === opp && (st.pits[last] === 2 || st.pits[last] === 3)) {
      let j = last;
      while (side(j) === opp && (st.pits[j] === 2 || st.pits[j] === 3)) {
        captured.push(j);
        j = (j + 11) % 12;
      }
      const total = captured.reduce((a, i) => a + st.pits[i], 0);
      if (total === seedsOn(st, opp)) { captured = []; grandSlam = true; } // grand slam: no capture
      else { for (const i of captured) { gained += st.pits[i]; st.pits[i] = 0; } st.store[p] += gained; }
    }
    st.plies++;
    st.turn = opp;
    let ended = false, reason = null;
    if (st.store[p] >= 25) { ended = true; reason = 'majority'; }
    else if (legalMoves(st).length === 0) {
      // next player cannot move (empty and unfeedable): each side keeps the seeds on its own pits
      st.store[0] += seedsOn(st, 0); st.store[1] += seedsOn(st, 1);
      st.pits.fill(0);
      ended = true; reason = 'starved';
    } else if (st.plies >= 300) {
      st.store[0] += seedsOn(st, 0); st.store[1] += seedsOn(st, 1);
      st.pits.fill(0); ended = true; reason = 'cycle';
    }
    if (ended) {
      st.over = true;
      st.winner = st.store[0] > st.store[1] ? 0 : st.store[1] > st.store[0] ? 1 : -1;
      st.reason = reason;
    }
    return { state: st, sown, captured, gained, grandSlam, ended, from: pit };
  }

  // ---------- AI ----------
  function evaluate(s, me) {
    if (s.over) {
      const d = s.store[me] - s.store[1 - me];
      return d > 0 ? 1000 + d : d < 0 ? -1000 + d : 0;
    }
    const opp = 1 - me;
    let v = (s.store[me] - s.store[opp]) * 10;
    // seeds in own pits are potential; pits with 1-2 seeds are vulnerable
    let vul = 0, oppVul = 0;
    for (const i of mine(me)) if (s.pits[i] === 1 || s.pits[i] === 2) vul++;
    for (const i of mine(opp)) if (s.pits[i] === 1 || s.pits[i] === 2) oppVul++;
    v += (seedsOn(s, me) - seedsOn(s, opp)) * 1.2;
    v += (oppVul - vul) * 1.5;
    // keep mobility
    v += (mine(me).filter((i) => s.pits[i] > 0).length - mine(opp).filter((i) => s.pits[i] > 0).length) * 1.0;
    return v;
  }

  function search(s, depth, alpha, beta, me) {
    if (depth === 0 || s.over) return evaluate(s, me);
    const moves = legalMoves(s);
    if (!moves.length) return evaluate(s, me);
    // order: captures first
    const outs = moves.map((m) => applyMove(s, m)).sort((a, b) => b.gained - a.gained);
    if (s.turn === me) {
      let best = -Infinity;
      for (const o of outs) {
        const v = search(o.state, depth - 1, alpha, beta, me);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const o of outs) {
      const v = search(o.state, depth - 1, alpha, beta, me);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // level: { depth, noise } noise = chance of picking a random legal move
  function chooseMove(s, level) {
    const moves = legalMoves(s);
    if (moves.length <= 1) return moves[0];
    if (Math.random() < (level.noise || 0)) return moves[Math.floor(Math.random() * moves.length)];
    const me = s.turn;
    let bestV = -Infinity, bestMoves = [];
    for (const m of moves) {
      const o = applyMove(s, m);
      const v = search(o.state, level.depth - 1, -Infinity, Infinity, me);
      if (v > bestV + 1e-9) { bestV = v; bestMoves = [m]; }
      else if (Math.abs(v - bestV) < 1e-9) bestMoves.push(m);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  const api = { newState, clone, legalMoves, applyMove, chooseMove, seedsOn, side, mine, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ayo = api;
})(typeof self !== 'undefined' ? self : this);
