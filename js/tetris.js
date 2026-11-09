// Tetris game engine — SRS rotation, 7-bag, line clears, scoring.
// Public API: new Tetris({ boardCanvas, nextCanvas, onStats, onGameOver, audio })

const COLS = 10;
const ROWS = 20;
const HIDDEN_ROWS = 2;
const CELL = 30; // px per cell on the board canvas (300x600)

const COLORS = {
  I: "#2ec4ff",
  O: "#ffd34d",
  T: "#b06bff",
  S: "#4ade80",
  Z: "#ff6b7a",
  J: "#4a7cff",
  L: "#ff9a4d",
  ghost: "#ffffff22",
};

// SRS piece shapes. Each piece has 4 rotation states expressed as (x,y) offsets.
const SHAPES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};

// SRS wall kick data (JLSTZ and I separately). Index: [fromRot][toRot] -> tests.
// Standard Guideline tests for JLSTZ.
const WALL_KICKS_JLSTZ = {
  "0>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "1>0": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "1>2": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "2>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "2>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "3>2": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "3>0": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "0>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};
const WALL_KICKS_I = {
  "0>1": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "1>0": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "1>2": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  "2>1": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "2>3": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "3>2": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "3>0": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "0>3": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};

// Gravity table — frames per row at 60fps (converted to ms below).
// Approximates NES speed curve, capped so it stays playable.
const LEVEL_FRAMES = [48,43,38,33,28,23,18,13,8,6,5,5,5,4,4,4,3,3,3,2];

function framesToMs(f) { return (f / 60) * 1000; }

function emptyBoard() {
  const b = [];
  for (let r = 0; r < ROWS + HIDDEN_ROWS; r++) {
    b.push(new Array(COLS).fill(null));
  }
  return b;
}

function cloneCells(cells) { return cells.map(([x,y]) => [x,y]); }

class Bag {
  constructor() { this.queue = []; this._refill(); }
  _refill() {
    const pieces = ["I","O","T","S","Z","J","L"];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.queue.push(...pieces);
  }
  next() {
    if (this.queue.length < 2) this._refill();
    return this.queue.shift();
  }
  peek() {
    if (this.queue.length < 1) this._refill();
    return this.queue[0];
  }
}

export class Tetris {
  constructor({ boardCanvas, nextCanvas, onStats, onGameOver, audio }) {
    this.board = boardCanvas;
    this.bctx = boardCanvas.getContext("2d");
    this.next = nextCanvas;
    this.nctx = nextCanvas.getContext("2d");
    this.onStats = onStats || (() => {});
    this.onGameOver = onGameOver || (() => {});
    this.audio = audio;

    this.state = "idle"; // idle | playing | paused | over
    this.reset();
  }

  reset() {
    this.grid = emptyBoard();
    this.bag = new Bag();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.current = null;
    this.nextType = null;
    this.dropAccum = 0;
    this.lastTime = 0;
    this.softDropping = false;
    this._emitStats();
    this._renderBoard();
    this._renderNext();
  }

  start() {
    this.reset();
    this.state = "playing";
    this._spawn();
    this.lastTime = performance.now();
    this._loop();
  }

  pause() {
    if (this.state === "playing") {
      this.state = "paused";
      return true;
    }
    if (this.state === "paused") {
      this.state = "playing";
      this.lastTime = performance.now();
      this._loop();
      return false;
    }
    return null;
  }

  isPaused() { return this.state === "paused"; }
  isPlaying() { return this.state === "playing"; }
  isOver() { return this.state === "over"; }

  _emitStats() {
    this.onStats({ score: this.score, lines: this.lines, level: this.level });
  }

  _spawn() {
    const type = this.nextType ?? this.bag.next();
    this.nextType = this.bag.next();
    const cells = cloneCells(SHAPES[type][0]);
    const piece = {
      type,
      rot: 0,
      // Spawn in top hidden rows. For I, spawn one row higher.
      x: 3,
      y: 0,
      cells,
    };
    this.current = piece;
    if (this._collides(piece, piece.x, piece.y, piece.cells)) {
      this.state = "over";
      this.current = null;
      this._renderBoard();
      this.audio?.play("gameover");
      this.onGameOver({ score: this.score, lines: this.lines, level: this.level });
      return;
    }
    this._renderNext();
  }

  _collides(piece, nx, ny, cells) {
    for (const [cx, cy] of cells) {
      const x = nx + cx;
      const y = ny + cy;
      if (x < 0 || x >= COLS) return true;
      if (y >= ROWS + HIDDEN_ROWS) return true;
      if (y >= 0 && this.grid[y][x]) return true;
    }
    return false;
  }

  _move(dx, dy) {
    const p = this.current;
    if (!p) return false;
    if (!this._collides(p, p.x + dx, p.y + dy, p.cells)) {
      p.x += dx; p.y += dy;
      return true;
    }
    return false;
  }

  _rotate(dir) {
    const p = this.current;
    if (!p || p.type === "O") return;
    const from = p.rot;
    const to = (p.rot + (dir === 1 ? 1 : 3)) % 4;
    const cells = cloneCells(SHAPES[p.type][to]);
    const table = p.type === "I" ? WALL_KICKS_I : WALL_KICKS_JLSTZ;
    const kicks = table[`${from}>${to}`] || [[0,0]];
    for (const [kx, ky] of kicks) {
      // SRS y is "up positive"; our y grows downward → invert ky.
      const nx = p.x + kx;
      const ny = p.y - ky;
      if (!this._collides(p, nx, ny, cells)) {
        p.rot = to;
        p.cells = cells;
        p.x = nx; p.y = ny;
        this.audio?.play("rotate");
        return;
      }
    }
  }

  _lock() {
    const p = this.current;
    for (const [cx, cy] of p.cells) {
      const x = p.x + cx, y = p.y + cy;
      if (y >= 0 && y < this.grid.length) {
        this.grid[y][x] = p.type;
      }
    }
    this.audio?.play("lock");
    const cleared = this._clearLines();
    if (cleared > 0) {
      const lineScores = [0, 100, 300, 500, 800];
      this.score += lineScores[cleared] * this.level;
      this.lines += cleared;
      const newLevel = Math.min(20, 1 + Math.floor(this.lines / 10));
      if (newLevel !== this.level) this.level = newLevel;
      this.audio?.play(cleared >= 4 ? "tetris" : "clear");
    }
    this._emitStats();
    this.current = null;
    this._spawn();
  }

  _clearLines() {
    let cleared = 0;
    for (let y = this.grid.length - 1; y >= 0; y--) {
      if (this.grid[y].every(c => c !== null)) {
        this.grid.splice(y, 1);
        this.grid.unshift(new Array(COLS).fill(null));
        cleared++;
        y++; // re-check this index
      }
    }
    return cleared;
  }

  hardDrop() {
    const p = this.current;
    if (!p || this.state !== "playing") return;
    let dist = 0;
    while (!this._collides(p, p.x, p.y + 1, p.cells)) {
      p.y++; dist++;
    }
    this.score += dist * 2;
    this._lock();
  }

  softDrop() {
    if (this.state !== "playing") return;
    if (this._move(0, 1)) {
      this.score += 1;
      this._emitStats();
    } else {
      this._lock();
    }
  }

  moveLeft()  { if (this.state==="playing" && this._move(-1,0)) this.audio?.play("move"); }
  moveRight() { if (this.state==="playing" && this._move( 1,0)) this.audio?.play("move"); }
  rotateCW()  { if (this.state==="playing") this._rotate(1); }
  rotateCCW() { if (this.state==="playing") this._rotate(-1); }

  _gravityMs() {
    const idx = Math.max(0, Math.min(LEVEL_FRAMES.length - 1, this.level - 1));
    return framesToMs(LEVEL_FRAMES[idx]);
  }

  _loop = () => {
    if (this.state !== "playing") return;
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    this.dropAccum += dt;
    const g = this._gravityMs();
    while (this.dropAccum >= g) {
      this.dropAccum -= g;
      if (this.state !== "playing") break;
      if (!this._move(0, 1)) {
        this._lock();
        if (this.state !== "playing") break;
      }
    }
    this._renderBoard();
    requestAnimationFrame(this._loop);
  };

  // --- Rendering ---
  _renderBoard() {
    const ctx = this.bctx;
    const w = this.board.width, h = this.board.height;
    ctx.clearRect(0,0,w,h);
    // background grid
    ctx.fillStyle = "#0a0f1f";
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "#131a33";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x*CELL+0.5, 0);
      ctx.lineTo(x*CELL+0.5, h);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y*CELL+0.5);
      ctx.lineTo(w, y*CELL+0.5);
      ctx.stroke();
    }

    // locked cells (skip hidden rows)
    for (let y = HIDDEN_ROWS; y < this.grid.length; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.grid[y][x];
        if (t) this._drawCell(ctx, x, y - HIDDEN_ROWS, COLORS[t]);
      }
    }
    // current piece
    if (this.current) {
      for (const [cx, cy] of this.current.cells) {
        const gx = this.current.x + cx;
        const gy = this.current.y + cy - HIDDEN_ROWS;
        if (gy >= 0) this._drawCell(ctx, gx, gy, COLORS[this.current.type]);
      }
    }
  }

  _drawCell(ctx, gx, gy, color) {
    const x = gx * CELL;
    const y = gy * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x+1, y+1, CELL-2, CELL-2);
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x+1, y+1, CELL-2, 4);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x+1, y+CELL-5, CELL-2, 4);
  }

  _renderNext() {
    const ctx = this.nctx;
    const w = this.next.width, h = this.next.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#0a0f1f";
    ctx.fillRect(0,0,w,h);
    if (!this.nextType) return;
    const cells = SHAPES[this.nextType][0];
    // center the piece inside the box (assume 4x4 piece grid).
    const cell = 24;
    // compute bbox of cells
    let minX=4,minY=4,maxX=-1,maxY=-1;
    for (const [cx,cy] of cells) {
      if (cx<minX) minX=cx; if (cy<minY) minY=cy;
      if (cx>maxX) maxX=cx; if (cy>maxY) maxY=cy;
    }
    const pxW = (maxX-minX+1) * cell;
    const pxH = (maxY-minY+1) * cell;
    const offX = Math.round((w - pxW) / 2) - minX * cell;
    const offY = Math.round((h - pxH) / 2) - minY * cell;
    for (const [cx, cy] of cells) {
      const x = offX + cx * cell;
      const y = offY + cy * cell;
      ctx.fillStyle = COLORS[this.nextType];
      ctx.fillRect(x+1, y+1, cell-2, cell-2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x+1, y+1, cell-2, 3);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x+1, y+cell-4, cell-2, 3);
    }
  }
}
