const assert = require('assert');
const A = require('../engine.js');

const mk = (pits, turn = 0, store = [0, 0]) => ({ pits, store, turn, over: false, winner: null, plies: 0 });
const total = (s) => s.pits.reduce((a, b) => a + b, 0) + s.store[0] + s.store[1];

// 1. basic sowing: 4 seeds from pit 0 -> 1..4
{
  const r = A.applyMove(A.newState(), 0);
  assert.deepStrictEqual(r.state.pits, [0,5,5,5,5,4,4,4,4,4,4,4]);
  assert.strictEqual(r.state.turn, 1);
  assert.strictEqual(r.gained, 0);
}
// 2. capture 2s and 3s chain backwards
{
  // player0 pit 5 has 2 seeds: lands on 6, 7. opp pits: 6=1,7=2 -> become 2,3 => capture both (5), need opp to keep seeds elsewhere
  const s = mk([0,0,0,0,0,2, 1,2,0,0,0,5]);
  const r = A.applyMove(s, 5);
  assert.deepStrictEqual(r.captured.sort((a, b) => a - b), [6, 7]);
  assert.strictEqual(r.state.store[0], 5);
  assert.strictEqual(total(r.state), total(s));
}
// 3. grand slam: capturing everything is not allowed
{
  const s = mk([0,0,0,0,0,2, 1,2,0,0,0,0]);
  const r = A.applyMove(s, 5);
  assert.strictEqual(r.grandSlam, true);
  assert.strictEqual(r.state.store[0], 0);
  assert.ok(r.state.over); // opponent can't feed p0 afterwards, so each side keeps its seeds
  assert.deepStrictEqual(r.state.store, [0, 5]);
}
// 4. no capture on own side, chain stops at a non 2/3 pit
{
  const s = mk([0,0,0,0,0,3, 1,5,1,0,0,9]);
  const r = A.applyMove(s, 5); // sow 6,7,8 -> 2,6,2 ; last=8 (2) capture, 7 has 6 -> stop
  assert.deepStrictEqual(r.captured, [8]);
}
// 5. skip origin pit with 12+ seeds
{
  const s = mk([12,0,0,0,0,0, 1,1,1,1,1,1]);
  const r = A.applyMove(s, 0);
  assert.strictEqual(r.state.pits[0], 0);
  assert.strictEqual(r.sown.length, 12);
  assert.ok(!r.sown.slice(0, 11).includes(0));
  assert.strictEqual(total(r.state), 18);
}
// 6. feeding rule
{
  const s = mk([1,0,0,0,0,3, 0,0,0,0,0,0]);
  assert.deepStrictEqual(A.legalMoves(s), [5]); // only pit 5 reaches opp side
}
// 7. starvation: cannot feed -> mover takes the rest, game over
{
  const s = mk([1,0,0,0,0,0, 0,0,0,0,0,0], 0, [10, 12]);
  // no legal moves for p0 at all -> engine expects caller to end; simulate via move that leaves opp empty
  const t = mk([0,0,0,0,0,0, 0,0,1,0,0,1], 1, [10, 12]); // p1's turn, p0 empty, pit 11 reaches idx 0
  const r = A.applyMove(t, 11);
  assert.ok(!r.ended); // fed p0 so game continues
  const u = mk([0,2,0,0,0,0, 0,0,0,0,0,0], 0, [10, 10]);
  const r2 = A.applyMove(u, 1); // 2 seeds stay on own side, opp stays empty -> can't be fed
  assert.ok(r2.ended);
  assert.strictEqual(r2.state.store[0], 12);
}
// 8. 25 wins
{
  const s = mk([0,0,0,0,0,2, 1,2,0,0,0,5], 0, [22, 0]);
  const r = A.applyMove(s, 5);
  assert.ok(r.ended && r.state.winner === 0);
}
// 9. random playouts conserve 48 seeds and always terminate
for (let g = 0; g < 400; g++) {
  let s = A.newState();
  while (!s.over) {
    const m = A.legalMoves(s);
    assert.ok(m.length > 0, 'stuck with no legal moves');
    s = A.applyMove(s, m[Math.floor(Math.random() * m.length)]).state;
    if (!s.over) assert.strictEqual(total(s), 48);
  }
  assert.strictEqual(total(s), 48);
}
// 10. AI strength: depth 5 should beat random almost always; and be fast enough
{
  let wins = 0;
  for (let g = 0; g < 30; g++) {
    let s = A.newState();
    const aiSide = g % 2;
    while (!s.over) {
      const m = s.turn === aiSide ? A.chooseMove(s, { depth: 5 }) : (() => { const l = A.legalMoves(s); return l[Math.floor(Math.random() * l.length)]; })();
      s = A.applyMove(s, m).state;
    }
    if (s.winner === aiSide) wins++;
  }
  console.log('AI d5 vs random:', wins + '/30');
  assert.ok(wins >= 27);
  let t = Date.now(), mx = 0;
  for (let g = 0; g < 6; g++) {
    let s = A.newState();
    while (!s.over && s.plies < 60) {
      const a = Date.now();
      const m = A.chooseMove(s, { depth: 9 });
      mx = Math.max(mx, Date.now() - a);
      s = A.applyMove(s, m).state;
    }
  }
  console.log('depth 9 slowest move ms:', mx);
}
console.log('all engine tests passed');
