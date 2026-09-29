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
const skinSelect = document.getElementById("skin-select");

const THEME_STORAGE_KEY = "tetris-theme";

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor = "#22222e";

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  themeToggleBtn.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  gridLineColor = getComputedStyle(document.body).getPropertyValue("--grid-line").trim();
  if (board && current) draw();
}

function rrect(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) context.roundRect(x, y, w, h, r);
  else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

// Cada skin: colores por índice (1-7 piezas, 8 O3, 9 pentominós), fondo del tablero
// (null = transparente, usa el fondo CSS), color de rejilla (null = var CSS --grid-line)
// y drawBlock(ctx, x, y, colorIndex, size, alpha) para dibujar una celda.
const SKINS = {
  retro: {
    name: "Retro",
    colors: COLORS,
    boardBg: null,
    gridLine: null,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    name: "Neon",
    colors: [null, "#00e5ff", "#ffee00", "#d500f9", "#39ff14", "#ff1744", "#2979ff", "#ff9100", "#ff4081", "#b0bec5"],
    boardBg: "#000000",
    gridLine: "#14142a",
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.save();
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.4;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.35;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.restore(); // restaura shadowBlur/shadowColor y alpha
    },
  },
  pastel: {
    name: "Pastel",
    colors: [null, "#a8e6ef", "#fff1a8", "#d7b8f0", "#b5ead0", "#f7b5b5", "#b3d4fc", "#ffd3a5", "#f8b7d3", "#c5d0d6"],
    boardBg: "#fdf6f0",
    gridLine: "#efe4da",
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = this.colors[colorIndex];
      rrect(context, x * size + 2, y * size + 2, size - 4, size - 4, size * 0.28);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.45)";
      rrect(context, x * size + 5, y * size + 4, size - 10, size * 0.18, size * 0.09);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    name: "Pixel art",
    colors: [null, "#29b6f6", "#fdd835", "#8e24aa", "#43a047", "#e53935", "#3949ab", "#fb8c00", "#d81b60", "#546e7a"],
    boardBg: "#1b1b2b",
    gridLine: "#26263a",
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const px = Math.max(1, Math.floor(size / 6));
      const bx = x * size + 1;
      const by = y * size + 1;
      const w = size - 2;
      context.globalAlpha = alpha;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(bx, by, w, w);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = "rgba(255,255,255,0.45)";
      context.fillRect(bx, by, w, px);
      context.fillRect(bx, by, px, w);
      context.fillStyle = "rgba(0,0,0,0.4)";
      context.fillRect(bx, by + w - px, w, px);
      context.fillRect(bx + w - px, by, px, w);
      // trama de píxeles interior
      context.fillStyle = "rgba(0,0,0,0.15)";
      for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) if ((i + j) % 2 === 0) context.fillRect(bx + i * px, by + j * px, px, px);
      context.globalAlpha = 1;
    },
  },
};

const SKIN_STORAGE_KEY = "tetris-skin";
let currentSkin = SKINS.retro;

function applySkin(id) {
  if (!SKINS[id]) id = "retro";
  currentSkin = SKINS[id];
  skinSelect.value = id;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch (e) {}
  if (board && current && next) {
    draw();
    drawNext();
  }
}

function loadSkin() {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

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
  currentSkin.drawBlock(context, x, y, colorIndex, size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = currentSkin.gridLine || gridLineColor;
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
  if (currentSkin.boardBg) {
    ctx.fillStyle = currentSkin.boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  if (currentSkin.boardBg) {
    nextCtx.fillStyle = currentSkin.boardBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.target === skinSelect) {
    // el select no debe robar las teclas de juego: soltar el foco y evitar que cambie de valor
    skinSelect.blur();
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  }
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

skinSelect.addEventListener("change", () => {
  applySkin(skinSelect.value);
  skinSelect.blur();
});

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark");
currentSkin = SKINS[loadSkin()] || SKINS.retro;
skinSelect.value = Object.keys(SKINS).find((k) => SKINS[k] === currentSkin);
init();
