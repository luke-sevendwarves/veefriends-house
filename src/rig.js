"use strict";
/* =====================================================================
   rig.js - draws the VeeFriends as animated cut-out puppets.

   Each character is the original artwork sliced into body parts
   (see tools/rig.py). Parts hang off each other in a little hierarchy
   and are posed every frame by a per-species animation function, then
   drawn as camera-facing quads with a small depth offset per part so
   limbs layer correctly without z-fighting.
   ===================================================================== */

/* --------------------------- 2D transforms -------------------------- */
/* [a,b,c,d,e,f]  ->  x' = a*x + c*y + e ,  y' = b*x + d*y + f */
const T2 = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
  /* rotate + scale about a pivot, then shift */
  pose(px, py, rot, sx, sy, dx, dy) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
    return [a, b, cc, d, px + dx - (a * px + cc * py), py + dy - (b * px + d * py)];
  },
};

/* ------------------------- animation library ------------------------ */
/* Each returns a map of partName -> {rot, dx, dy, sx, sy}.
   `w` is walk phase, `t` free-running time, `e` the entity.          */
const NOPE = {};

function bob(e, t, amt) { return Math.sin(t * 6 + e.seed) * amt; }

const RIG_ANIM = {
  termite(e, t, w, atk) {
    const sw = Math.sin(w), sw2 = Math.sin(w * 2);
    return {
      body: { dy: -Math.abs(sw2) * 5, sy: 1 + sw2 * 0.05 },
      head: { rot: sw * 0.10, dy: -Math.abs(sw2) * 3 },
      antL: { rot: -0.22 + Math.sin(t * 5 + e.seed) * 0.28 },
      antR: { rot: 0.22 + Math.sin(t * 5.4 + e.seed + 1) * 0.28 },
      legL: { rot: sw * 0.75 },
      legR: { rot: -sw * 0.75 },
      _lunge: atk,
    };
  },
  hermit(e, t, w, atk) {
    const sw = Math.sin(w);
    return {
      body: { dy: -Math.abs(Math.sin(w * 2)) * 7 },
      shell: { rot: sw * 0.06, dy: -Math.abs(Math.sin(w * 2)) * 4 },
      // the big claw waves when idle and hammers down on an attack
      clawUp: { rot: atk > 0 ? -1.5 * atk : Math.sin(t * 3 + e.seed) * 0.42 - 0.1 },
      legs: { rot: sw * 0.30 },
      _lunge: atk,
    };
  },
  creativecrab(e, t, w, atk) {
    const sw = Math.sin(w);
    return {
      body: { dy: -Math.abs(Math.sin(w * 2)) * 6, sx: 1 + Math.sin(w * 2) * 0.04 },
      clawR: { rot: atk > 0 ? -1.3 * atk : -0.18 + Math.sin(t * 4 + e.seed) * 0.35 },
      clawL: { rot: atk > 0 ? 1.1 * atk : 0.15 + Math.sin(t * 4 + e.seed + 2) * 0.30 },
      legsL: { rot: sw * 0.42 },
      legsR: { rot: -sw * 0.42 },
      _lunge: atk,
    };
  },
  iguana(e, t, w, atk) {
    const sw = Math.sin(w);
    return {
      body: { dy: -Math.abs(Math.sin(w * 2)) * 6 },
      head: { rot: sw * 0.09, dy: -Math.abs(Math.sin(w * 2)) * 3 },
      armL: { rot: -sw * 0.45 + (atk > 0 ? -0.9 * atk : 0) },
      armR: { rot: sw * 0.45 + (atk > 0 ? 0.9 * atk : 0) },
      tail: { rot: Math.sin(t * 3.2 + e.seed) * 0.30 },
      legL: { rot: sw * 0.80 },
      legR: { rot: -sw * 0.80 },
      _lunge: atk,
    };
  },
  giant(e, t, w, atk) {
    const sw = Math.sin(w);
    // a slow, heavy stride; the tree swings with the raised arm
    return {
      body: { dy: -Math.abs(Math.sin(w * 2)) * 9, rot: sw * 0.035 },
      head: { rot: -sw * 0.06, dy: -Math.abs(Math.sin(w * 2)) * 4 },
      armUp: { rot: atk > 0 ? 1.4 * atk : -0.30 + sw * 0.32 },
      tree: { rot: Math.sin(t * 2.4 + e.seed) * 0.18 },
      armOut: { rot: -sw * 0.38 },
      legF: { rot: sw * 0.55 },
      legB: { rot: -sw * 0.55 },
      _lunge: atk * 1.3,
    };
  },
  garyvee(e, t, w, atk) {
    const sw = Math.sin(w);
    return {
      body: { dy: -Math.abs(Math.sin(w * 2)) * 10, rot: sw * 0.05 },
      // he leans in when he shouts
      head: { rot: sw * 0.09 - atk * 0.25, dy: -Math.abs(Math.sin(w * 2)) * 5 - atk * 14 },
      _lunge: atk * 1.5,
    };
  },
};

/* --------------------------- rig loading ---------------------------- */
const RIGS = {};   // kind -> {w,h,order:[{name,tex,part}], byName}

function loadRigs(gl, mkTex) {
  const jobs = [];
  for (const kind of Object.keys(PARTS)) {
    const src = PARTS[kind];
    const rig = { w: src.w, h: src.h, parts: {}, order: [] };
    RIGS[kind] = rig;
    for (const name of Object.keys(src.parts)) {
      const p = src.parts[name];
      const rec = { name, x: p.x, y: p.y, w: p.w, h: p.h, px: p.px, py: p.py, parent: p.parent, z: p.z };
      rig.parts[name] = rec;
      rig.order.push(rec);
      jobs.push(new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => { rec.tex = mkTex(im, false); res(); };
        im.onerror = rej;
        im.src = p.img;
      }));
    }
    for (const r of rig.order) r.parentRec = r.parent ? rig.parts[r.parent] : null;
    // Two orderings: pose parents before children, but DRAW by z so limbs
    // layer correctly. Conflating the two poses a child off a stale parent.
    rig.chain = [];
    const seen = new Set();
    const visit = r => {
      if (seen.has(r.name)) return;
      seen.add(r.name);
      if (r.parentRec) visit(r.parentRec);
      rig.chain.push(r);
    };
    for (const r of rig.order) visit(r);
    rig.order = rig.order.slice().sort((a, b) => a.z - b.z);
  }
  return Promise.all(jobs);
}

/* ---------------------------- posing -------------------------------- */
/* Walks the hierarchy and caches each part's 2D transform on the rig. */
function poseRig(kind, e, t, walkPhase, atk) {
  const rig = RIGS[kind];
  const anim = (RIG_ANIM[kind] || (() => NOPE))(e, t, walkPhase, atk || 0);
  for (const rec of rig.chain) {
    const a = anim[rec.name] || NOPE;
    const local = T2.pose(rec.px, rec.py, a.rot || 0,
      a.sx === undefined ? 1 : a.sx, a.sy === undefined ? 1 : a.sy,
      a.dx || 0, a.dy || 0);
    rec.mat = rec.parentRec ? T2.mul(rec.parentRec.mat, local) : local;
  }
  return anim._lunge || 0;
}

/* ---------------------------- drawing ------------------------------- */
/* Draws a posed character standing at (x,z) with its feet on `groundY`.
   `height` is its world height; the artwork is scaled to match.        */
function drawRigged(gl, W, kind, e, x, groundY, z, height, opts) {
  const o = opts || {};
  const rig = RIGS[kind];
  const S = height / rig.h;                       // image px -> world units
  const ox = rig.w / 2, oy = rig.h;               // origin: bottom centre

  // camera-facing basis, mirrored when the character reads as facing left
  const mir = o.mirror ? -1 : 1;
  const rx = Math.cos(o.yaw) * S * mir, rz = Math.sin(o.yaw) * S * mir;
  const fx = o.fwd[0], fz = o.fwd[2];

  // Parts layer by draw order with depth writes off, so they never z-fight
  // each other or shimmer against a wall the character is standing near.
  // Depth TEST stays on, so the world still occludes them correctly.
  for (const rec of rig.order) {
    if (!rec.tex) continue;
    const m = rec.mat;
    const px = x, pz = z;
    const c = [];
    for (const [cx, cy] of [[rec.x, rec.y + rec.h], [rec.x + rec.w, rec.y + rec.h],
                            [rec.x + rec.w, rec.y], [rec.x, rec.y]]) {
      const [sx, sy] = T2.apply(m, cx, cy);
      c.push(px + rx * (sx - ox), groundY + (oy - sy) * S * (o.squash || 1), pz + rz * (sx - ox));
    }
    W.quad(rec.tex,
      c[0], c[1], c[2], mir > 0 ? 0 : 1, 1,
      c[3], c[4], c[5], mir > 0 ? 1 : 0, 1,
      c[6], c[7], c[8], mir > 0 ? 1 : 0, 0,
      c[9], c[10], c[11], mir > 0 ? 0 : 1, 0,
      o);
  }
}

/* Where a character's eyes sit, for glowing-eye effects and headshots. */
const RIG_HEAD = {
  termite: 0.72, hermit: 0.62, creativecrab: 0.72,
  iguana: 0.78, giant: 0.74, garyvee: 0.70,
};
