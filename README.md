# Ayo Arena

Ayo (Oware) for [start.ng](https://start.ng): beat a ladder of ever-smarter rivals, or play two players on one device.

- `index.html`, `style.css`, `app.js`: the game and its start.ng hookup (connect page, profile card, leaderboard)
- `engine.js`: rules (Abapa Oware) and the minimax AI; `node test/engine.test.js` runs the tests
- `startng.json`: leaderboard columns (Rivals beaten, Seeds won)
- `cover.png`: 16:10 card cover

No build step. Publish: `POST https://api.start.ng/games/publish` with `{ "repo_url": "...", "name": "ayo-arena" }`.
