const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#64b5f6", // J - pale blue
  "#ffb74d", // L - orange
  "#f06292", // O3 - marco 3x3 (especial)
  "#78909c", // Pentominós (especial)
];

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // O3 - marco 3x3 hueco
  [
    [9, 9, 0],
    [9, 9, 0],
    [9, 0, 0],
  ], // P5
  [
    [9, 0, 9],
    [9, 9, 9],
    [0, 0, 0],
  ], // U5
  [
    [9, 9, 9],
    [0, 9, 0],
    [0, 9, 0],
  ], // T5
  [
    [0, 9, 0, 0],
    [0, 9, 0, 0],
    [0, 9, 0, 0],
    [0, 9, 9, 0],
  ], // L5
  [
    [0, 9, 0, 0],
    [0, 9, 0, 0],
    [0, 9, 9, 0],
    [0, 0, 9, 0],
  ], // N5
  [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [9, 9, 9, 9, 9],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ], // I5
];

const LINE_SCORES = [0, 100, 300, 500, 800, 1200];

const STANDARD_PIECE_TYPES = 7;
const PENTOMINO_TYPES = [9, 10, 11, 12, 13, 14];

// Piezas especiales: `chance` es la probabilidad (0–1) de que salga el grupo en
// cada generación. Se evalúan en orden; el resto de las veces sale una estándar.
const SPECIAL_PIECES = [
  { chance: 0.12, types: PENTOMINO_TYPES }, // pentominós (5 celdas)
  { chance: 0.03, types: [8] }, // marco 3x3 hueco
];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayScore = document.getElementById("overlay-score");
const restartBtn = document.getElementById("restart-btn");
const themeToggleBtn = document.getElementById("theme-toggle");

const startScreen = document.getElementById("start-screen");
const startScoresEl = document.getElementById("start-scores");
const playBtn = document.getElementById("play-btn");
const hsForm = document.getElementById("hs-form");
const hsName = document.getElementById("hs-name");
const hsSave = document.getElementById("hs-save");
const hsBadge = document.getElementById("hs-badge");
const overScoresEl = document.getElementById("over-scores");
const clearBtns = document.querySelectorAll(".clear-scores-btn");

const HS_KEY = "tetris-highscores";
const HS_STATS_KEY = "tetris-highscores-stats";
const HS_MAX = 5;
const THEME_STORAGE_KEY = "tetris-theme";

let combo, maxCombo, started = false;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor = "#22222e";

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  themeToggleBtn.textContent = isLight ? "☀️" : "🌙";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {}
  gridLineColor = getComputedStyle(document.body).getPropertyValue("--grid-line").trim();
}

// ---- Récords locales ----
let hsEntry = null; // entrada recién guardada (para resaltarla)
let highscores = loadJSON(HS_KEY, [])
  .filter((h) => h && typeof h.score === "number")
  .map((h) => ({ name: String(h.name || "Anónimo").slice(0, 12), score: h.score, lines: Number(h.lines) || 0, maxCombo: Number(h.maxCombo) || 0, date: h.date }))
  .slice(0, HS_MAX);
const rawStats = loadJSON(HS_STATS_KEY, {});
let stats = { bestCombo: Number(rawStats.bestCombo) || 0, maxLines: Number(rawStats.maxLines) || 0 };

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    if (v && typeof v === "object") return Array.isArray(fallback) === Array.isArray(v) ? v : fallback;
  } catch (e) {}
  return fallback;
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function registerCombo(cleared) {
  combo = cleared ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
}

function qualifies() {
  return score > 0 && (highscores.length < HS_MAX || score > highscores[highscores.length - 1].score);
}

function renderScores(container, st, highlight) {
  container.textContent = "";
  const table = document.createElement("table");
  table.className = "hs-table";
  const head = table.createTHead().insertRow();
  ["#", "Nombre", "Puntos", "Líneas", "Combo"].forEach((t) => (head.insertCell().textContent = t));
  const body = table.createTBody();
  if (!highscores.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 5;
    cell.className = "hs-empty";
    cell.textContent = "Sin récords todavía";
  }
  highscores.forEach((h, i) => {
    const row = body.insertRow();
    if (h === highlight) row.className = "hs-current";
    [i + 1, h.name, h.score.toLocaleString(), h.lines, h.maxCombo].forEach((t) => (row.insertCell().textContent = t));
  });
  const info = document.createElement("p");
  info.className = "hs-stats";
  info.textContent = `Mejor combo: ${st.bestCombo} · Máx. líneas: ${st.maxLines}`;
  container.append(table, info);
}

function showGameOverScores() {
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveJSON(HS_STATS_KEY, stats);
  const q = qualifies();
  hsBadge.classList.toggle("hidden", !q);
  hsForm.classList.toggle("hidden", !q);
  hsName.value = "";
  renderScores(overScoresEl, stats, null);
  if (q) hsName.focus();
}

function saveHighscore() {
  if (hsEntry || !qualifies()) return;
  hsEntry = { name: hsName.value.trim().slice(0, 12) || "Anónimo", score, lines, maxCombo, date: new Date().toISOString() };
  highscores.push(hsEntry);
  highscores.sort((a, b) => b.score - a.score);
  highscores.length = Math.min(highscores.length, HS_MAX);
  saveJSON(HS_KEY, highscores);
  hsForm.classList.add("hidden");
  renderScores(overScoresEl, stats, hsEntry);
}

function clearHighscores() {
  highscores = [];
  stats = { bestCombo: 0, maxLines: 0 };
  hsEntry = null;
  try {
    localStorage.removeItem(HS_KEY);
    localStorage.removeItem(HS_STATS_KEY);
  } catch (e) {}
  hsBadge.classList.add("hidden");
  hsForm.classList.add("hidden");
  renderScores(startScoresEl, stats, null);
  renderScores(overScoresEl, stats, null);
}

function startGame() {
  started = true;
  startScreen.classList.add("hidden");
  init();
}

playBtn.addEventListener("click", startGame);
hsSave.addEventListener("click", saveHighscore);
hsName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveHighscore();
});
clearBtns.forEach((b) => b.addEventListener("click", clearHighscores));

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function pickPieceType() {
  for (const special of SPECIAL_PIECES) {
    if (Math.random() < special.chance) {
      return special.types[Math.floor(Math.random() * special.types.length)];
    }
  }
  return Math.floor(Math.random() * STANDARD_PIECE_TYPES) + 1;
}

function randomPiece() {
  const type = pickPieceType();
  const shape = PIECES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length,
    cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++) for (let c = 0; c < current.shape[r].length; c++) if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  registerCombo(cleared);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++) for (let c = 0; c < current.shape[r].length; c++) if (current.shape[r][c]) drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++) for (let c = 0; c < current.shape[r].length; c++) drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const gridSize = Math.max(4, shape.length, shape[0].length);
  const NB = nextCanvas.width / gridSize;
  const offX = Math.floor((gridSize - shape[0].length) / 2);
  const offY = Math.floor((gridSize - shape.length) / 2);
  for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  overlayTitle.textContent = "GAME OVER";
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove("hidden");
  showGameOverScores();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = "PAUSA";
    overlayScore.textContent = "";
    overlay.classList.remove("hidden");
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  combo = 0;
  maxCombo = 0;
  hsEntry = null;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add("hidden");
  hsForm.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (!started || (e.target && e.target.tagName === "INPUT")) return;
  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case "ArrowLeft":
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case "ArrowRight":
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate();
      break;
    case "Space":
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener("click", init);

themeToggleBtn.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light-theme") ? "dark" : "light");
});

let themeSaved = null;
try {
  themeSaved = localStorage.getItem(THEME_STORAGE_KEY);
} catch (e) {}
applyTheme(themeSaved === "light" ? "light" : "dark");
init();
// La partida no arranca hasta pulsar "Jugar"
cancelAnimationFrame(animId);
animId = null;
renderScores(startScoresEl, stats, null);
