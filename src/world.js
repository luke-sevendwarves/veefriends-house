"use strict";
/* =====================================================================
   world.js - the house, as real storeys.

   The old world was a height field: one floor height per grid cell. That
   can raise an area but it can never put a room ABOVE another room, which
   is why it always read as one floor with steps. Here each storey is its
   own grid, they overlap in plan, and stair shafts occupy the same cells
   on two storeys at once.

   Generation touches no DOM, so it can be exercised in node.
   ===================================================================== */

const W = {
  FLOORS: 3,
  CELL: 2.65,
  ROOMH: 4.6,           // floor to ceiling inside a storey
  SLAB: 0.7,            // thickness between storeys
  MAPW: 30, MAPH: 30,
  MARGIN: 2,            // the garden wall around the plot
  YARD: 4,              // cells of ground between that wall and the house
  STEP_UP: 0.48,
  POOL_DEPTH: 1.5,

  grid: [], roomOf: [], rooms: [], cellH: [], cornerH: [],
  shafts: [], pools: [], spawn: null,
  outside: [], windows: [], HOUSE: null,
};
W.STOREY = W.ROOMH + W.SLAB;

const wIdx = (x, y) => y * W.MAPW + x;
const wIn = (x, y) => x >= 0 && y >= 0 && x < W.MAPW && y < W.MAPH;

/* ------------------------------ queries ----------------------------- */
W.solid = function (f, x, y) {
  if (!wIn(x, y)) return true;
  const g = this.grid[f];
  return !g || g[wIdx(x, y)] === 1;
};
W.isDoor = function (f, x, y) {
  return wIn(x, y) && this.grid[f] && this.grid[f][wIdx(x, y)] === 2;
};
W.baseY = function (f) { return f * this.STOREY; };
W.floorOfY = function (y) {
  return Math.max(0, Math.min(this.FLOORS - 1, Math.round(y / this.STOREY)));
};
/* Corner k of cell (cx,cy): 0 = -x-y, 1 = +x-y, 2 = +x+y, 3 = -x+y. Each cell
   carries its own four, so neighbours in a different regime cannot warp it. */
W.corner = function (f, cx, cy, k) {
  const sx = Math.max(0, Math.min(this.MAPW - 1, cx));
  const sy = Math.max(0, Math.min(this.MAPH - 1, cy));
  return this.cornerH[f][(sy * this.MAPW + sx) * 4 + k];
};
/* Floor height under a world position, bilinear so shafts and pool sides ramp. */
W.groundY = function (wx, wz, f) {
  let cx = Math.floor(wx / this.CELL), cy = Math.floor(wz / this.CELL);
  const u = Math.max(0, Math.min(1, wx / this.CELL - cx));
  const v = Math.max(0, Math.min(1, wz / this.CELL - cy));
  cx = Math.max(0, Math.min(this.MAPW - 1, cx));
  cy = Math.max(0, Math.min(this.MAPH - 1, cy));
  const a = this.corner(f, cx, cy, 0), b = this.corner(f, cx, cy, 1);
  const c = this.corner(f, cx, cy, 3), d = this.corner(f, cx, cy, 2);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
};
W.centerOf = function (cx, cy) { return [(cx + .5) * this.CELL, (cy + .5) * this.CELL]; };
W.cellAt = function (wx, wz) { return [Math.floor(wx / this.CELL), Math.floor(wz / this.CELL)]; };

/* ------------------------- room partitioning ------------------------ */
function wSplit(x, y, w, h, depth, out, rnd) {
  const MIN = 4;
  const canH = w >= MIN * 2 + 1, canV = h >= MIN * 2 + 1;
  if (depth <= 0 || (!canH && !canV) || (w < 9 && h < 9 && rnd() < .45)) {
    out.push({ x, y, w, h }); return;
  }
  let horiz;
  if (canH && canV) horiz = w > h * 1.25 ? true : (h > w * 1.25 ? false : rnd() < .5);
  else horiz = canH;
  if (horiz) {
    const cut = MIN + Math.floor(rnd() * (w - MIN * 2 + 1));
    wSplit(x, y, cut, h, depth - 1, out, rnd);
    wSplit(x + cut, y, w - cut, h, depth - 1, out, rnd);
  } else {
    const cut = MIN + Math.floor(rnd() * (h - MIN * 2 + 1));
    wSplit(x, y, w, cut, depth - 1, out, rnd);
    wSplit(x, y + cut, w, h - cut, depth - 1, out, rnd);
  }
}

/* Builds one storey: rooms, a doorway between every pair, a few loops. */
W.genFloor = function (f, rnd) {
  const g = new Uint8Array(this.MAPW * this.MAPH).fill(1);
  const ro = new Int16Array(this.MAPW * this.MAPH).fill(-1);
  const H = this.HOUSE;
  const leaves = [];
  // Rooms carve from leaf.x + 1, so the near edge is left as wall -- but the
  // far edge is not, and the outermost rooms opened straight onto the garden
  // with no outside wall at all. Partition one cell short so the whole
  // perimeter survives as the shell of the house.
  wSplit(H.x0, H.y0, H.x1 - 1 - H.x0, H.y1 - 1 - H.y0, 6, leaves, rnd);

  const rooms = [];
  leaves.forEach(L => {
    // one shared wall column between neighbours - that is what a door punches
    const x0 = L.x + 1, y0 = L.y + 1, x1 = L.x + L.w, y1 = L.y + L.h;
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    const r = { x0, y0, x1, y1, cx: (x0 + x1) >> 1, cy: (y0 + y1) >> 1, i: rooms.length, f };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      g[wIdx(x, y)] = 0; ro[wIdx(x, y)] = r.i;
    }
    rooms.push(r);
  });

  // doorways, chosen so every room ends up reachable
  const parent = rooms.map((_, i) => i);
  const find = a => parent[a] === a ? a : (parent[a] = find(parent[a]));
  const cand = [];
  for (let y = H.y0; y < H.y1; y++) for (let x = H.x0; x < H.x1; x++) {
    if (g[wIdx(x, y)] !== 1) continue;
    const a = ro[wIdx(x - 1, y)], b = ro[wIdx(x + 1, y)];
    const c = ro[wIdx(x, y - 1)], d = ro[wIdx(x, y + 1)];
    if (a >= 0 && b >= 0 && a !== b && g[wIdx(x, y - 1)] === 1 && g[wIdx(x, y + 1)] === 1) cand.push([x, y, a, b]);
    else if (c >= 0 && d >= 0 && c !== d && g[wIdx(x - 1, y)] === 1 && g[wIdx(x + 1, y)] === 1) cand.push([x, y, c, d]);
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
  }
  for (const [x, y, a, b] of cand) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) { parent[ra] = rb; g[wIdx(x, y)] = 2; }
    else if (rnd() < .35) g[wIdx(x, y)] = 2;
  }

  this.grid[f] = g; this.roomOf[f] = ro; this.rooms[f] = rooms;
};

/* Everything between the garden wall and the house is ground you can walk on,
   but only on the storey that touches it. Upstairs, outside the house is
   nothing at all -- it stays solid so you cannot stroll into the night air. */
W.digYard = function () {
  this.outside = [];
  for (let f = 0; f < this.FLOORS; f++) this.outside.push(new Uint8Array(this.MAPW * this.MAPH));
  const H = this.HOUSE, M = this.MARGIN;
  for (let y = M; y < this.MAPH - M; y++) for (let x = M; x < this.MAPW - M; x++) {
    if (x >= H.x0 && x < H.x1 && y >= H.y0 && y < H.y1) continue;   // that is the house
    this.grid[0][wIdx(x, y)] = 0;
    this.outside[0][wIdx(x, y)] = 1;
  }
};

/* A front door and a back door, on opposite faces, each opening from a real
   room straight out onto the grass. */
W.punchDoors = function (rnd) {
  const H = this.HOUSE;
  const sides = [
    { name: "n", cells: [], inw: [0, 1] }, { name: "s", cells: [], inw: [0, -1] },
    { name: "w", cells: [], inw: [1, 0] }, { name: "e", cells: [], inw: [-1, 0] },
  ];
  for (let x = H.x0 + 1; x < H.x1 - 1; x++) {
    sides[0].cells.push([x, H.y0]);
    sides[1].cells.push([x, H.y1 - 1]);
  }
  for (let y = H.y0 + 1; y < H.y1 - 1; y++) {
    sides[2].cells.push([H.x0, y]);
    sides[3].cells.push([H.x1 - 1, y]);
  }
  let made = 0;
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  for (const si of order) {
    const S = sides[si];
    const ok = S.cells.filter(([x, y]) => {
      const ix = x + S.inw[0], iy = y + S.inw[1];
      const ox = x - S.inw[0], oy = y - S.inw[1];
      return wIn(ix, iy) && wIn(ox, oy) &&
        this.grid[0][wIdx(ix, iy)] === 0 && this.roomOf[0][wIdx(ix, iy)] >= 0 &&
        this.outside[0][wIdx(ox, oy)] === 1;
    });
    if (!ok.length) continue;
    const [dx, dy] = ok[Math.floor(rnd() * ok.length)];
    this.grid[0][wIdx(dx, dy)] = 2;
    made++;
  }
  return made;
};

/* Windows punched down every outside wall, on every storey. They are solid to
   walk into but the renderer leaves a band open, so you really do see the
   night through them. */
W.placeWindows = function (rnd) {
  this.windows = [];
  for (let f = 0; f < this.FLOORS; f++) this.windows.push(new Uint8Array(this.MAPW * this.MAPH));
  const H = this.HOUSE;
  const edge = [];
  for (let x = H.x0; x < H.x1; x++) { edge.push([x, H.y0, 0, 1]); edge.push([x, H.y1 - 1, 0, -1]); }
  for (let y = H.y0; y < H.y1; y++) { edge.push([H.x0, y, 1, 0]); edge.push([H.x1 - 1, y, -1, 0]); }
  for (let f = 0; f < this.FLOORS; f++) {
    for (const [x, y, ix, iy] of edge) {
      if (this.grid[f][wIdx(x, y)] !== 1) continue;              // never a doorway
      const nx = x + ix, ny = y + iy;
      if (!wIn(nx, ny) || this.grid[f][wIdx(nx, ny)] !== 0) continue;   // needs a room behind it
      if (rnd() < .42) this.windows[f][wIdx(x, y)] = 1;
    }
  }
};

W.isOutside = function (f, x, y) {
  return wIn(x, y) && !!this.outside[f] && !!this.outside[f][wIdx(x, y)];
};
W.isWindow = function (f, x, y) {
  return wIn(x, y) && !!this.windows[f] && !!this.windows[f][wIdx(x, y)];
};

/* ----------------------------- stair shafts -------------------------- */
/* A shaft is an L of cells that exists on both storeys. Its cells carry a
   height ramp spanning one storey, drawn later as a flight with a landing. */
W.placeShafts = function (rnd) {
  this.shafts = [];
  for (let f = 0; f < this.FLOORS - 1; f++) {
    let made = 0, tries = 0;
    const want = 2;
    while (made < want && tries < 600) {
      tries++;
      const r = this.rooms[f][Math.floor(rnd() * this.rooms[f].length)];
      if (!r || r.isShaft) continue;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      if (w < 3 || h < 4) continue;

      // Nothing else may share the well on either of its two storeys, and it
      // needs a cell of clearance or two flights blend together at the corners.
      let clash = false;
      for (const s of this.shafts) {
        if (s.f !== f && s.to !== f && s.f !== f + 1 && s.to !== f + 1) continue;
        for (const c of s.cells)
          if (c.x >= r.x0 - 1 && c.x <= r.x1 && c.y >= r.y0 - 1 && c.y <= r.y1) clash = true;
      }
      if (clash) continue;

      // A single straight run up the middle of the well. The whole room goes
      // solid on BOTH storeys and only this column is opened, so the flight is
      // walled in the entire way up. When the path hugged the room edge, the
      // cells beside it upstairs belonged to that storey's own layout and were
      // usually open -- which left the stairs standing in the middle of a room.
      const cx = r.x0 + ((w - 1) >> 1);
      const ys = [];
      for (let y = r.y0; y < r.y1; y++) ys.push(y);
      if (rnd() < .5) ys.reverse();                  // climb either way
      const path = ys.map(y => [cx, y]);

      const loY = this.baseY(f), hiY = this.baseY(f + 1);
      const rise = hiY - loY;
      // ~1.3m of rise per cell is about 27 degrees, a normal stair pitch;
      // spreading it over the whole run gives a wheelchair ramp instead.
      const steps = Math.min(path.length - 1, Math.max(3, Math.ceil(rise / 1.33)));
      const first = path.length - 1 - steps;         // last cell of the flat approach
      const cells = path.map(([x, y], k) =>
        ({ x, y, h: k <= first ? loY : loY + rise * ((k - first) / steps) }));

      // wall the well off on both storeys, then open just the run
      for (const f2 of [f, f + 1]) {
        for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++)
          this.grid[f2][wIdx(x, y)] = 1;
        for (const c of cells) this.grid[f2][wIdx(c.x, c.y)] = 0;
      }

      // a way in at the bottom and out at the top, preferring straight ahead
      const punch = (f2, px, py, pref) => {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (pref) dirs.sort((a, b) =>
          (b[0] === pref[0] && b[1] === pref[1]) - (a[0] === pref[0] && a[1] === pref[1]));
        for (const [dx, dy] of dirs) {
          const nx = px + dx, ny = py + dy;
          if (!wIn(nx, ny)) continue;
          if (this.roomOf[f2][wIdx(nx, ny)] >= 0 && this.grid[f2][wIdx(nx, ny)] === 0) return true;
          if (this.grid[f2][wIdx(nx, ny)] === 1 && wIn(nx + dx, ny + dy) &&
              this.roomOf[f2][wIdx(nx + dx, ny + dy)] >= 0) {
            this.grid[f2][wIdx(nx, ny)] = 2; return true;
          }
        }
        return false;
      };
      const n = cells.length;
      const inDir = [cells[0].x - cells[1].x, cells[0].y - cells[1].y];
      const outDir = [cells[n - 1].x - cells[n - 2].x, cells[n - 1].y - cells[n - 2].y];
      if (!punch(f, cells[0].x, cells[0].y, inDir)) continue;
      if (!punch(f + 1, cells[n - 1].x, cells[n - 1].y, outDir)) continue;

      // Seal each end on the storey it does not belong to: upstairs must not
      // open onto the foot of the flight, downstairs not onto its head.
      const seal = (f2, c, dir) => {
        const x = c.x + dir[0], y = c.y + dir[1];
        if (wIn(x, y) && this.grid[f2][wIdx(x, y)] !== 1) this.grid[f2][wIdx(x, y)] = 1;
      };
      seal(f + 1, cells[0], inDir);
      seal(f, cells[n - 1], outDir);

      r.isShaft = true;
      this.shafts.push({ f, to: f + 1, room: r, cells, loY, hiY });
      made++;
    }
  }
};

/* --------------------------- height fields --------------------------- */
W.buildMasks = function () {
  this.shaftAt = [];
  for (let f = 0; f < this.FLOORS; f++) this.shaftAt.push(new Uint8Array(this.MAPW * this.MAPH));
  for (const s of this.shafts) for (const c of s.cells) {
    this.shaftAt[s.f][wIdx(c.x, c.y)] = 1;
    this.shaftAt[s.to][wIdx(c.x, c.y)] = 1;
  }
};

W.buildHeights = function () {
  this.cellH = []; this.cornerH = [];
  for (let f = 0; f < this.FLOORS; f++) {
    const h = new Float32Array(this.MAPW * this.MAPH).fill(this.baseY(f));
    this.cellH[f] = h;
  }
  for (const s of this.shafts) {
    for (const c of s.cells) {
      this.cellH[s.f][wIdx(c.x, c.y)] = c.h;
      this.cellH[s.to][wIdx(c.x, c.y)] = c.h;
    }
  }
  for (const p of this.pools) {
    for (const [x, y] of p.cells) this.cellH[p.f][wIdx(x, y)] -= this.POOL_DEPTH;
  }
  for (let f = 0; f < this.FLOORS; f++) {
    const ramp = new Uint8Array(this.MAPW * this.MAPH);
    for (const s of this.shafts) if (s.f === f || s.to === f)
      for (const c of s.cells) ramp[wIdx(c.x, c.y)] = 1;
    // Corners are shared by four cells, so a stair cell touching a room cell
    // DIAGONALLY used to drag that room's floor corner up with it -- by a whole
    // storey in the worst case, which is where the stray blocks and ramps in
    // the middle of rooms came from. Resolve corners per cell instead: a cell
    // only averages with neighbours in the same regime (both stairs, or both
    // flat, or close enough in height to be a genuine landing or doorway).
    const cc = new Float32Array(this.MAPW * this.MAPH * 4);
    const QUAD = [[[-1, -1], [0, -1], [-1, 0], [0, 0]],     // corner 00
                  [[0, -1], [1, -1], [0, 0], [1, 0]],       // corner 10
                  [[0, 0], [1, 0], [0, 1], [1, 1]],         // corner 11
                  [[-1, 0], [0, 0], [-1, 1], [0, 1]]];      // corner 01
    for (let cy = 0; cy < this.MAPH; cy++) for (let cx = 0; cx < this.MAPW; cx++) {
      const i = wIdx(cx, cy);
      const h0 = this.cellH[f][i], r0 = !!ramp[i];
      for (let k = 0; k < 4; k++) {
        let sum = 0, n = 0;
        for (const [dx, dy] of QUAD[k]) {
          const ax = cx + dx, ay = cy + dy;
          if (!wIn(ax, ay) || this.solid(f, ax, ay)) continue;
          const j = wIdx(ax, ay), h = this.cellH[f][j];
          if (!!ramp[j] !== r0 && Math.abs(h - h0) > .12) continue;
          sum += h; n++;
        }
        cc[i * 4 + k] = n ? sum / n : h0;
      }
    }
    this.cornerH[f] = cc;
  }

  // A flight's corners are known exactly, so set them rather than average:
  // averaging is sample-count sensitive, and something like the doorway beside
  // the bottom step feeds one corner but not the other, tilting the tread.
  // Each cell gets its entry edge and its exit edge, level right across.
  for (const sh of this.shafts) {
    const cs = sh.cells;
    for (let k = 0; k < cs.length; k++) {
      const c = cs[k];
      const nxt = cs[k + 1] || c, prv = cs[k - 1] || c;
      const dir = k < cs.length - 1 ? [nxt.x - c.x, nxt.y - c.y] : [c.x - prv.x, c.y - prv.y];
      const entry = k > 0 ? (prv.h + c.h) / 2 : c.h;
      const exit = k < cs.length - 1 ? (c.h + nxt.h) / 2 : c.h;
      // corner order: 0 = -x-y, 1 = +x-y, 2 = +x+y, 3 = -x+y
      let e0, e1, x0, x1;
      if (dir[1] > 0)      { e0 = 0; e1 = 1; x0 = 3; x1 = 2; }
      else if (dir[1] < 0) { e0 = 3; e1 = 2; x0 = 0; x1 = 1; }
      else if (dir[0] > 0) { e0 = 0; e1 = 3; x0 = 1; x1 = 2; }
      else                 { e0 = 1; e1 = 2; x0 = 0; x1 = 3; }
      for (const f of [sh.f, sh.to]) {
        const base = wIdx(c.x, c.y) * 4;
        this.cornerH[f][base + e0] = entry; this.cornerH[f][base + e1] = entry;
        this.cornerH[f][base + x0] = exit;  this.cornerH[f][base + x1] = exit;
      }
    }
  }
};

/* --------------------------- reachability ---------------------------- */
/* One BFS over the whole building: cells on every storey, plus the shaft
   links between them. Anything it cannot reach is filled in, so there is
   never a room you can see but not get to. */
W.reachable = function (fromF, fromX, fromY) {
  const seen = [];
  for (let f = 0; f < this.FLOORS; f++) seen.push(new Uint8Array(this.MAPW * this.MAPH));
  const shaftLink = new Map();
  for (const s of this.shafts) for (const c of s.cells) {
    shaftLink.set(s.f + ":" + wIdx(c.x, c.y), s.to);
    shaftLink.set(s.to + ":" + wIdx(c.x, c.y), s.f);
  }
  const q = [[fromF, fromX, fromY]];
  seen[fromF][wIdx(fromX, fromY)] = 1;
  let head = 0, count = 0;
  while (head < q.length) {
    const [f, x, y] = q[head++]; count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!wIn(nx, ny) || this.solid(f, nx, ny) || seen[f][wIdx(nx, ny)]) continue;
      seen[f][wIdx(nx, ny)] = 1; q.push([f, nx, ny]);
    }
    const other = shaftLink.get(f + ":" + wIdx(x, y));
    if (other !== undefined && !seen[other][wIdx(x, y)]) {
      seen[other][wIdx(x, y)] = 1; q.push([other, x, y]);
    }
  }
  return { seen, count };
};

W.pruneUnreachable = function (fromF, fromX, fromY) {
  const { seen } = this.reachable(fromF, fromX, fromY);
  let filled = 0;
  for (let f = 0; f < this.FLOORS; f++)
    for (let i = 0; i < this.grid[f].length; i++)
      if (this.grid[f][i] !== 1 && !seen[f][i]) { this.grid[f][i] = 1; filled++; }
  return filled;
};

/* ------------------------------ pools -------------------------------- */
W.digPools = function (rnd) {
  this.pools = [];
  const f = 0;                                   // the pool lives downstairs
  const cands = this.rooms[f].filter(r => !r.isShaft &&
    (r.x1 - r.x0) >= 4 && (r.y1 - r.y0) >= 4);
  if (!cands.length) return;
  const r = cands[Math.floor(rnd() * cands.length)];
  const cells = [];
  for (let y = r.y0 + 1; y < r.y1 - 1; y++) for (let x = r.x0 + 1; x < r.x1 - 1; x++)
    if (!this.solid(f, x, y)) cells.push([x, y]);
  if (cells.length < 4) return;
  r.typeName = "THE POOL";
  this.pools.push({
    f, room: r, cells,
    x0: (r.x0 + 1) * this.CELL, z0: (r.y0 + 1) * this.CELL,
    x1: (r.x1 - 1) * this.CELL, z1: (r.y1 - 1) * this.CELL,
    y: this.baseY(f) - .45,
  });
};

/* ------------------------------ build -------------------------------- */
/* A flight is only useful if you can step off it at the top. The exit is
   punched when the shaft is placed, but pruning can seal the room it opened
   into -- and because the stair itself stays reachable through the shaft link,
   nothing catches it. Cheap to check, so lay the house out again if it happens. */
/* The garden is only worth having if you can get out into it. */
/* Pruning is allowed to tidy up, not to gut a storey. */
W.storeysIntact = function () {
  const H = this.HOUSE;
  for (let f = 0; f < this.FLOORS; f++) {
    let c = 0;
    for (let y = H.y0; y < H.y1; y++) for (let x = H.x0; x < H.x1; x++)
      if (this.grid[f][wIdx(x, y)] !== 1) c++;
    if (c < 110) return false;
  }
  return true;
};

W.yardReachable = function () {
  let open = 0, got = 0;
  const { seen } = this.reachable(this.spawn.f, this.spawn.x, this.spawn.y);
  for (let i = 0; i < this.outside[0].length; i++) {
    if (!this.outside[0][i] || this.grid[0][i] === 1) continue;
    open++; if (seen[0][i]) got++;
  }
  return open > 40 && got === open;
};

W.shaftsUsable = function () {
  // Every storey pair needs at least one flight, or the floor above it is
  // unreachable and pruning quietly erases the whole thing.
  for (let f = 0; f < this.FLOORS - 1; f++)
    if (!this.shafts.some(s => s.f === f)) return false;
  for (const sh of this.shafts) {
    let exits = 0;
    for (const c of sh.cells) {
      if (Math.abs(c.h - sh.hiY) > .01) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx, y = c.y + dy;
        if (!wIn(x, y) || this.solid(sh.to, x, y)) continue;
        if (!this.shaftAt[sh.to][wIdx(x, y)]) exits++;
      }
    }
    if (!exits) return false;
  }
  return true;
};

W.generate = function (rnd) {
  rnd = rnd || Math.random;
  for (let attempt = 0; attempt < 48; attempt++) {
    const res = this.layout(rnd);
    if (this.shaftsUsable() && this.doorsOut >= 2 && this.yardReachable() &&
        this.storeysIntact()) return res;
  }
  return this.layout(rnd);          // give up gracefully rather than hang
};

W.layout = function (rnd) {
  this.grid = []; this.roomOf = []; this.rooms = []; this.shafts = []; this.pools = [];
  const M = this.MARGIN, Y = this.YARD;
  this.HOUSE = { x0: M + Y, y0: M + Y, x1: this.MAPW - M - Y, y1: this.MAPH - M - Y };
  for (let f = 0; f < this.FLOORS; f++) this.genFloor(f, rnd);
  this.placeShafts(rnd);
  this.digPools(rnd);
  this.digYard();
  this.doorsOut = this.punchDoors(rnd);
  this.placeWindows(rnd);

  // start somewhere sensible on the ground floor: a real room, not a corridor
  const ground = this.rooms[0].filter(r => !r.isShaft &&
    (r.x1 - r.x0) >= 3 && (r.y1 - r.y0) >= 3);
  const home = ground.length ? ground[Math.floor(rnd() * ground.length)] : this.rooms[0][0];
  this.spawn = { f: 0, x: home.cx, y: home.cy };

  const filled = this.pruneUnreachable(0, home.cx, home.cy);
  this.buildMasks(); this.buildHeights();
  return { filled };
};

/* How much of the building is actually reachable, per storey. */
W.audit = function () {
  const { seen } = this.reachable(this.spawn.f, this.spawn.x, this.spawn.y);
  const per = [];
  for (let f = 0; f < this.FLOORS; f++) {
    let open = 0, got = 0;
    for (let i = 0; i < this.grid[f].length; i++) {
      if (this.grid[f][i] === 1) continue;
      open++; if (seen[f][i]) got++;
    }
    per.push({ floor: f, open, reachable: got, rooms: this.rooms[f].length });
  }
  return { per, shafts: this.shafts.map(s => `${s.f}->${s.to}`), pools: this.pools.length };
};

if (typeof module !== "undefined") module.exports = W;
