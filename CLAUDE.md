# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Vanilla JavaScript Tetris implementation. No dependencies, no build step, no package.json — just `index.html`, `style.css`, and `game.js` opened directly in a browser or served statically.

## Running the game

```bash
open index.html                # macOS, or just open the file in a browser
python3 -m http.server 8000    # or serve statically, then visit http://localhost:8000
npx serve .
```

There is no build, lint, or test tooling in this repo.

## Architecture

Everything lives in `game.js` (~300 lines), driven by a single `requestAnimationFrame` loop:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` defines each tetromino as a square matrix. `rotateCW` rotates by transposing + reversing rows.
- **Collision** (`collide`): checks board bounds and existing locked cells for a shape at a given offset.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` until a non-colliding position is found, else the rotation is discarded.
- **Game loop** (`loop`): accumulates elapsed time each frame; when it exceeds `dropInterval`, the piece drops one row or locks via `lockPiece`.
- **Locking** (`lockPiece` → `merge` → `clearLines` → `spawn`): merges the piece into `board`, clears completed rows (scanned bottom-up, with the row index bumped back after a splice so the shifted row is re-checked), then spawns the next piece.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 points/cell dropped, soft drop adds 1 point/row.
- **Level/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece**: `ghostY()` projects the current piece straight down to its landing row; drawn at `globalAlpha = 0.2`.
- **Game over**: triggered in `spawn()` if the newly spawned piece immediately collides.

All state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) is module-level, reset by `init()`.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size — must stay in sync with the `<canvas id="board">` width/height in `index.html`, which is `COLS × BLOCK` by `ROWS × BLOCK`), `COLORS`, `LINE_SCORES`, initial `dropInterval`.

### Controls

Arrow keys move/rotate/soft-drop, Space hard-drops, `P` toggles pause — all wired via a single `keydown` listener at the bottom of `game.js`.
