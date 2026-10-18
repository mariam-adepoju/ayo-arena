/* Ayo Arena 3D board, built with three.js (global THREE).
 * 12 pits + 2 stores carved into a wooden slab, 48 seeds that physically fly between pits.
 * Public API (Board3D.create): setPits, setLegal, lift, drop, capture, flash, resize, onPick */
(function (root) {
  'use strict';

  // ----- layout (board-local units; pits 0-5 = player 0 row, 6-11 = player 1 row) -----
  const SP = 1.6;            // pit spacing
  const R = 0.62;            // pit radius
  const TOP = 0.42;          // slab thickness / board surface height
  const HW = 7.05, HD = 1.9; // slab half width / depth
  const STORE_X = 5.8, SXR = 0.8, SZR = 1.4;
  const PIT_DEPTH = 0.55 * R;
  const STORE_DEPTH = 0.38;
  const SEED_COLORS = [0xf6f5ee, 0xf2b84b, 0xd9503a, 0x4fa36b];
  const TOTAL_SEEDS = 48;

  const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function pitPos(i) {
    return i < 6 ? { x: (i - 2.5) * SP, z: SP / 2 } : { x: (11 - i - 2.5) * SP, z: -SP / 2 };
  }
  const storePos = (p) => ({ x: p === 0 ? STORE_X : -STORE_X, z: 0 });

  function pitSlot(i, k) {
    const c = pitPos(i);
    const a = k * 2.399963 + i;
    const rr = k === 0 ? 0 : Math.min(R * 0.5, 0.17 + 0.075 * Math.sqrt(k));
    const depth = PIT_DEPTH * Math.sqrt(Math.max(0, 1 - (rr / R) * (rr / R)));
    return { x: c.x + Math.cos(a) * rr + (rnd(k + i * 7) - 0.5) * 0.05, y: TOP - depth + 0.1 + 0.095 * Math.floor(k / 9), z: c.z + Math.sin(a) * rr + (rnd(k * 3 + i) - 0.5) * 0.05 };
  }
  function storeSlot(p, k) {
    const c = storePos(p);
    const a = k * 2.399963 + p * 2;
    const f = Math.min(0.82, 0.11 * Math.sqrt(k + 0.5));
    const x = Math.cos(a) * f * SXR, z = Math.sin(a) * f * SZR;
    const depth = STORE_DEPTH * Math.sqrt(Math.max(0, 1 - f * f));
    return { x: c.x + x, y: TOP - depth + 0.1 + 0.095 * Math.floor(k / 14), z: c.z + z };
  }
  function handSlot(j, c) {
    const a = j * 2.4, rr = 0.13 * Math.sqrt(j);
    return { x: c.x + Math.cos(a) * rr, y: 1.35 + 0.09 * (j % 3), z: c.z + Math.sin(a) * rr };
  }

  function woodTexture(T) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#8a4a24'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const y = rnd(i) * 512, h = 1 + rnd(i + 50) * 5;
      g.fillStyle = rnd(i + 9) > 0.5 ? 'rgba(40,16,4,' + (0.05 + rnd(i + 3) * 0.12) + ')' : 'rgba(255,200,140,' + (0.03 + rnd(i + 5) * 0.07) + ')';
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 64) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      g.lineTo(512, y + h); g.lineTo(0, y + h); g.fill();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(0.16, 0.45);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }

  function create(stage, opts) {
    const T = root.THREE;
    opts = opts || {};
    const api = { onPick: opts.onPick || null };

    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Ayo board in 3D. Tap one of the glowing pits to sow.');
    stage.prepend(canvas);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'plabels';
    stage.append(labelLayer);

    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    if (T.PCFSoftShadowMap) renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 2, 0.1, 100);
    const board = new T.Group();
    scene.add(board);

    // lights
    scene.add(new T.HemisphereLight(0xfff1dc, 0x3a2414, 0.95));
    const sun = new T.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-4, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 7; sc.bottom = -7; sc.near = 0.5; sc.far = 30;
    sun.shadow.bias = -0.0006;
    scene.add(sun);

    // floor that only shows the board's shadow
    const floor = new T.Mesh(new T.PlaneGeometry(60, 40), new T.ShadowMaterial({ opacity: 0.38 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; floor.receiveShadow = true;
    scene.add(floor);

    // ----- slab with carved holes -----
    const cr = 0.6;
    const shape = new T.Shape();
    shape.moveTo(-HW + cr, -HD); shape.lineTo(HW - cr, -HD); shape.quadraticCurveTo(HW, -HD, HW, -HD + cr);
    shape.lineTo(HW, HD - cr); shape.quadraticCurveTo(HW, HD, HW - cr, HD);
    shape.lineTo(-HW + cr, HD); shape.quadraticCurveTo(-HW, HD, -HW, HD - cr);
    shape.lineTo(-HW, -HD + cr); shape.quadraticCurveTo(-HW, -HD, -HW + cr, -HD);
    for (let i = 0; i < 12; i++) {
      const p = pitPos(i); const h = new T.Path();
      h.absarc(p.x, -p.z, R, 0, Math.PI * 2, true); shape.holes.push(h);
    }
    for (let s = 0; s < 2; s++) {
      const p = storePos(s); const h = new T.Path();
      h.absellipse(p.x, -p.z, SXR, SZR, 0, Math.PI * 2, true, 0); shape.holes.push(h);
    }
    const woodTop = new T.MeshStandardMaterial({ map: woodTexture(T), roughness: 0.62, metalness: 0.0 });
    const woodSide = new T.MeshStandardMaterial({ color: 0x4a2410, roughness: 0.7 });
    const slab = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: TOP, bevelEnabled: false, curveSegments: 40 }), [woodTop, woodSide]);
    slab.rotation.x = -Math.PI / 2;
    slab.castShadow = true; slab.receiveShadow = true;
    board.add(slab);

    // bowls under each hole
    const bowlMat = new T.MeshStandardMaterial({ color: 0x2a1409, roughness: 0.95, side: T.BackSide });
    const bowlGeo = new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const p = pitPos(i); const m = new T.Mesh(bowlGeo, bowlMat);
      m.scale.set(R, PIT_DEPTH, R); m.position.set(p.x, TOP, p.z); m.receiveShadow = true; board.add(m);
    }
    for (let s = 0; s < 2; s++) {
      const p = storePos(s); const m = new T.Mesh(bowlGeo, bowlMat);
      m.scale.set(SXR, STORE_DEPTH, SZR); m.position.set(p.x, TOP, p.z); m.receiveShadow = true; board.add(m);
    }

    // hit discs, glow rings, flash rings
    const hitMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hitGeo = new T.CylinderGeometry(R + 0.12, R + 0.12, 0.5, 20);
    const ringGeo = new T.TorusGeometry(R + 0.07, 0.05, 8, 48);
    const flashGeo = new T.TorusGeometry(R + 0.02, 0.07, 8, 48);
    const hits = [], legalRings = [], flashRings = [], flashes = [];
    for (let i = 0; i < 12; i++) {
      const p = pitPos(i);
      const h = new T.Mesh(hitGeo, hitMat); h.position.set(p.x, TOP + 0.1, p.z); h.userData.pit = i; board.add(h); hits.push(h);
      const lr = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xd8fd71, transparent: true }));
      lr.rotation.x = Math.PI / 2; lr.position.set(p.x, TOP + 0.03, p.z); lr.visible = false; board.add(lr); legalRings.push(lr);
      const fr = new T.Mesh(flashGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      fr.rotation.x = Math.PI / 2; fr.position.set(p.x, TOP + 0.05, p.z); fr.visible = false; board.add(fr); flashRings.push(fr);
      flashes.push(null);
    }

    // ----- seeds -----
    const seedGeo = new T.SphereGeometry(1, 14, 10);
    const seedMats = SEED_COLORS.map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.05 }));
    const allSeeds = [];
    for (let n = 0; n < TOTAL_SEEDS; n++) {
      const m = new T.Mesh(seedGeo, seedMats[n % 4]);
      m.scale.set(0.17, 0.115, 0.13);
      m.rotation.y = rnd(n) * Math.PI * 2;
      m.castShadow = true;
      board.add(m); allSeeds.push(m);
    }
    const piles = Array.from({ length: 12 }, () => []);
    const stores = [[], []];
    let hand = [];
    let tweens = [];
    let clock = (typeof performance !== 'undefined' ? performance.now() : 0);

    function place(m, s) { m.position.set(s.x, s.y, s.z); }
    function layoutPile(i) { piles[i].forEach((m, k) => place(m, pitSlot(i, k))); }
    function layoutStore(p) { stores[p].forEach((m, k) => place(m, storeSlot(p, k))); }

    function cancelTweens() {
      const t = tweens; tweens = [];
      t.forEach((w) => w.res());
    }
    function tween(m, to, dur, arc, delay) {
      tweens = tweens.filter((w) => { if (w.m === m) { w.res(); return false; } return true; });
      return new Promise((res) => {
        tweens.push({ m, x0: m.position.x, y0: m.position.y, z0: m.position.z, x1: to.x, y1: to.y, z1: to.z, t0: clock + (delay || 0), dur: Math.max(1, dur), arc: arc || 0, res });
      });
    }
    function stepTweens() {
      if (!tweens.length) return;
      const keep = [];
      for (const w of tweens) {
        if (clock < w.t0) { keep.push(w); continue; }
        const u = Math.min(1, (clock - w.t0) / w.dur);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        w.m.position.set(w.x0 + (w.x1 - w.x0) * e, w.y0 + (w.y1 - w.y0) * e + w.arc * Math.sin(Math.PI * u), w.z0 + (w.z1 - w.z0) * e);
        if (u >= 1) w.res(); else keep.push(w);
      }
      tweens = keep;
    }

    // ----- state control -----
    api.setPits = function (pits, store) {
      cancelTweens();
      hand = [];
      const pool = allSeeds.slice();
      for (let i = 0; i < 12; i++) piles[i] = pool.splice(0, pits[i]);
      for (let p = 0; p < 2; p++) stores[p] = pool.splice(0, store[p] || 0);
      // any left-over seeds (should not happen) go to the first pit so nothing floats
      if (pool.length) piles[0] = piles[0].concat(pool);
      for (let i = 0; i < 12; i++) layoutPile(i);
      for (let p = 0; p < 2; p++) layoutStore(p);
    };
    api.setLegal = function (list) {
      for (let i = 0; i < 12; i++) legalRings[i].visible = !!list && list.indexOf(i) >= 0;
      api.legal = list || [];
    };
    api.legal = [];

    api.lift = function (i) {
      const seeds = piles[i]; piles[i] = []; hand = seeds;
      const c = pitPos(i);
      return Promise.all(seeds.map((m, j) => tween(m, handSlot(j, c), 280, 0.25, j * 18)));
    };
    api.drop = function (idx, dur) {
      const m = hand.shift();
      if (!m) return Promise.resolve();
      const k = piles[idx].length;
      piles[idx].push(m);
      const p = tween(m, pitSlot(idx, k), dur || 220, 0.5, 0);
      const c = pitPos(idx);
      hand.forEach((s, j) => { tween(s, handSlot(j, c), (dur || 220) + 60, 0, 0); });
      return p;
    };
    api.capture = function (indices, player) {
      const proms = []; let n = 0;
      for (const i of indices) {
        const seeds = piles[i]; piles[i] = [];
        for (const m of seeds) {
          const k = stores[player].length; stores[player].push(m);
          proms.push(tween(m, storeSlot(player, k), 480, 0.9, Math.min(n, 12) * 40)); n++;
        }
      }
      return Promise.all(proms);
    };
    api.flash = function (i, kind) {
      const color = kind === 'cap' ? 0xd9503a : kind === 'grab' ? 0xf2b84b : 0xffffff;
      flashRings[i].material.color.setHex(color);
      flashes[i] = { t0: clock, dur: kind === 'cap' ? 650 : 420 };
    };

    // ----- labels (HTML pills projected from 3D) -----
    const labels = [];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span'); s.className = 'plabel'; labelLayer.append(s); labels.push(s);
    }
    const tmp = new T.Vector3();
    let lastText = new Array(12).fill(null);
    function updateLabels() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      board.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      for (let i = 0; i < 12; i++) {
        const n = piles[i].length;
        const text = n ? String(n) : '';
        if (lastText[i] !== text) { labels[i].textContent = text; labels[i].style.display = text ? '' : 'none'; lastText[i] = text; }
        if (!text) continue;
        const p = pitPos(i);
        tmp.set(p.x, TOP + 0.02, p.z + (i < 6 ? 1 : -1) * (R + 0.2));
        board.localToWorld(tmp);
        tmp.project(camera);
        labels[i].style.left = ((tmp.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
        labels[i].style.top = ((-tmp.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
      }
    }

    // ----- camera fit -----
    let portrait = false;
    function fit() {
      const v = camera.fov * Math.PI / 180, a = camera.aspect;
      const el = (portrait ? 64 : 56) * Math.PI / 180;
      const halfW = (portrait ? HD : HW) + 0.45, halfD = (portrait ? HW : HD) + 0.45;
      const d1 = halfW / (Math.tan(v / 2) * a);
      const d2 = (halfD * Math.sin(el) + 1.3 * Math.cos(el) + 0.5) / Math.tan(v / 2);
      const d = Math.max(d1, d2) * 1.04;
      const target = { x: 0, y: 0.25, z: portrait ? 0 : 0.1 };
      camera.position.set(target.x, target.y + d * Math.sin(el), target.z + d * Math.cos(el));
      camera.lookAt(target.x, target.y, target.z);
    }
    api.resize = function () {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      portrait = camera.aspect < 0.95;
      board.rotation.y = portrait ? -Math.PI / 2 : 0;
      fit();
      camera.updateProjectionMatrix();
    };
    if (root.ResizeObserver) new root.ResizeObserver(() => api.resize()).observe(stage);
    root.addEventListener('resize', api.resize);

    // ----- picking -----
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pickAt(ev) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hits, false)[0];
      return hit ? hit.object.userData.pit : -1;
    }
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 12) return;
      const i = pickAt(e);
      if (i >= 0 && api.onPick) api.onPick(i);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const i = pickAt(e);
      canvas.style.cursor = i >= 0 && api.legal.indexOf(i) >= 0 ? 'pointer' : 'default';
    });

    // ----- loop -----
    function frame(now) {
      requestAnimationFrame(frame);
      clock = now;
      stepTweens();
      for (let i = 0; i < 12; i++) {
        if (legalRings[i].visible) legalRings[i].material.opacity = 0.55 + 0.45 * Math.sin(now * 0.005 + i);
        const f = flashes[i];
        if (f) {
          const u = (now - f.t0) / f.dur;
          if (u >= 1) { flashRings[i].visible = false; flashes[i] = null; }
          else { flashRings[i].visible = true; flashRings[i].material.opacity = 1 - u; const s = 1 + 0.3 * u; flashRings[i].scale.set(s, s, 1); }
        }
      }
      renderer.render(scene, camera);
      updateLabels();
    }
    api.resize();
    api.setPits([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], [0, 0]);
    requestAnimationFrame(frame);
    return api;
  }

  root.Board3D = { create, layout: { pitPos, storePos, pitSlot, storeSlot, TOTAL_SEEDS } };
})(typeof self !== 'undefined' ? self : this);
