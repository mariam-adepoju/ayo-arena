# Ayo Arena (three.js)

Ayo (Oware) for [start.ng](https://start.ng), rebuilt as a **three.js 3D game**: a carved wooden board with 48 seeds that physically fly between pits, and a ladder of ever-smarter rivals. Also plays as two players on one device.

- `index.html`, `style.css`, `app.js`: UI, ladder, and start.ng hookup (connect page, profile card, leaderboard)
- `board3d.js`: the three.js scene (extruded slab with carved pits, bowls, seed meshes, tween animation, raycast picking, shadows)
- `engine.js`: rules (Abapa Oware) and the minimax AI; `node test/engine.test.js` runs the tests
- `startng.json`: leaderboard columns (Rivals beaten, Seeds won)
- `cover.png`: 16:10 card cover
- three.js r149 is loaded from jsDelivr; `vendor/three.min.js` is an optional offline fallback (download https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js into `vendor/`)

No build step. Publish: `POST https://api.start.ng/games/publish` with `{ "repo_url": "...", "name": "ayo-arena" }`.
