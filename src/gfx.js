"use strict";
/* =====================================================================
   gfx.js - math, mesh building and the two shader programs.

   Program A ("world"): textured, vertex-shaded, fogged. Walls/floors.
   Program B ("char"):  vertex-coloured with toon banding and an
                        inverted-hull black outline, so hand-built
                        character meshes read like the VeeFriends art.
   ===================================================================== */

/* ------------------------------ math ------------------------------ */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = n => (Math.random() * n) | 0;
const pick = a => a[(Math.random() * a.length) | 0];
const TAU = Math.PI * 2;

const M4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b, o) {
    o = o || new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      o[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      o[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  },
  persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  },
  lookAt(o, ex, ey, ez, cx, cy, cz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz;
    let l = 1 / (Math.hypot(zx, zy, zz) || 1); zx *= l; zy *= l; zz *= l;
    let xx = zz, xy = 0, xz = -zx;
    l = Math.hypot(xx, xy, xz); l = l ? 1 / l : 0; xx *= l; xy *= l; xz *= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
  /* translate * rotY * rotX * rotZ * scale, in that order */
  compose(o, x, y, z, ry, rx, rz, sx, sy, sz) {
    const cy = Math.cos(ry), sy_ = Math.sin(ry);
    const cx = Math.cos(rx), sx_ = Math.sin(rx);
    const cz = Math.cos(rz), sz_ = Math.sin(rz);
    // R = Ry * Rx * Rz
    const m00 = cy * cz + sy_ * sx_ * sz_, m01 = -cy * sz_ + sy_ * sx_ * cz, m02 = sy_ * cx;
    const m10 = cx * sz_,                  m11 = cx * cz,                    m12 = -sx_;
    const m20 = -sy_ * cz + cy * sx_ * sz_, m21 = sy_ * sz_ + cy * sx_ * cz, m22 = cy * cx;
    o[0] = m00 * sx; o[1] = m10 * sx; o[2] = m20 * sx; o[3] = 0;
    o[4] = m01 * sy; o[5] = m11 * sy; o[6] = m21 * sy; o[7] = 0;
    o[8] = m02 * sz; o[9] = m12 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  },
};

function hex(h) {
  let t = h[0] === "#" ? h.slice(1) : h;
  if (t.length === 3) t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
  const v = parseInt(t, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
function shade(c, k) { return [clamp(c[0] * k, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k, 0, 1)]; }

/* --------------------------- mesh builder -------------------------- */
/* A Mesh accumulates triangles with position, normal and colour.
   Everything is built in the character's own space: +Y up, +Z toward
   the viewer (the character faces +Z), origin at the floor centre.   */
class Mesh {
  constructor() { this.p = []; this.n = []; this.c = []; }
  get count() { return this.p.length / 3; }

  vert(x, y, z, nx, ny, nz, col) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.c.push(col[0], col[1], col[2]);
  }
  /* flat-shaded triangle: normal derived from the winding */
  triFlat(a, b, c, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.vert(a[0], a[1], a[2], nx, ny, nz, col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, col);
  }
  quadFlat(a, b, c, d, col) { this.triFlat(a, b, c, col); this.triFlat(a, c, d, col); }

  /* smooth triangle with explicit normals */
  triN(a, na, b, nb, c, nc, col) {
    this.vert(a[0], a[1], a[2], na[0], na[1], na[2], col);
    this.vert(b[0], b[1], b[2], nb[0], nb[1], nb[2], col);
    this.vert(c[0], c[1], c[2], nc[0], nc[1], nc[2], col);
  }

  toBuffers(gl) {
    const b = {
      pos: gl.createBuffer(), norm: gl.createBuffer(), col: gl.createBuffer(), count: this.count,
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.p), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.norm); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.n), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.col); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.c), gl.STATIC_DRAW);
    return b;
  }
  /* bounding box, handy for sanity-checking a model's height */
  bounds() {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < this.p.length; i += 3)
      for (let k = 0; k < 3; k++) {
        if (this.p[i + k] < lo[k]) lo[k] = this.p[i + k];
        if (this.p[i + k] > hi[k]) hi[k] = this.p[i + k];
      }
    return { lo, hi };
  }
}

/* ---- a tiny transform stack so parts can be posed while building ---- */
class Builder {
  constructor(mesh) {
    this.m = mesh;
    this.stack = [M4.ident()];
  }
  get top() { return this.stack[this.stack.length - 1]; }
  push() { this.stack.push(new Float32Array(this.top)); return this; }
  pop() { this.stack.pop(); return this; }
  xform(mat) { this.stack[this.stack.length - 1] = M4.mul(this.top, mat, new Float32Array(16)); return this; }
  translate(x, y, z) { return this.xform(M4.compose(new Float32Array(16), x, y, z, 0, 0, 0, 1, 1, 1)); }
  rotate(ry, rx, rz) { return this.xform(M4.compose(new Float32Array(16), 0, 0, 0, ry || 0, rx || 0, rz || 0, 1, 1, 1)); }
  scale(sx, sy, sz) { return this.xform(M4.compose(new Float32Array(16), 0, 0, 0, 0, 0, 0, sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz)); }

  pt(x, y, z) {
    const m = this.top;
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  }
  nrm(x, y, z) {
    const m = this.top;
    // good enough while scales stay roughly uniform per part
    let nx = m[0] * x + m[4] * y + m[8] * z;
    let ny = m[1] * x + m[5] * y + m[9] * z;
    let nz = m[2] * x + m[6] * y + m[10] * z;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  /* ---------------------------- primitives ---------------------------- */
  /* Ellipsoid. `cut` trims the bottom (0..1 of the height) for domes. */
  ellipsoid(cx, cy, cz, rx, ry, rz, col, o) {
    o = o || {};
    const su = o.su || 16, sv = o.sv || 12;
    const v0 = o.v0 === undefined ? 0 : o.v0, v1 = o.v1 === undefined ? 1 : o.v1;
    const grid = [];
    for (let j = 0; j <= sv; j++) {
      const t = v0 + (v1 - v0) * (j / sv);
      const phi = t * Math.PI;          // 0 = top
      const row = [];
      for (let i = 0; i <= su; i++) {
        const th = (i / su) * TAU;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        row.push({
          p: this.pt(cx + nx * rx, cy + ny * ry, cz + nz * rz),
          n: this.nrm(nx / rx, ny / ry, nz / rz),
        });
      }
      grid.push(row);
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const a = grid[j][i], b = grid[j + 1][i], c = grid[j + 1][i + 1], d = grid[j][i + 1];
      // wound CCW when seen from outside so face culling picks the right side
      this.m.triN(a.p, a.n, c.p, c.n, b.p, b.n, col);
      this.m.triN(a.p, a.n, d.p, d.n, c.p, c.n, col);
    }
    return this;
  }
  sphere(cx, cy, cz, r, col, o) { return this.ellipsoid(cx, cy, cz, r, r, r, col, o); }

  /* Tapered tube between two points - limbs, antennae, tails, fingers. */
  tube(a, b, r0, r1, col, o) {
    o = o || {};
    const seg = o.seg || 10;
    let ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
    const len = Math.hypot(ax, ay, az) || 1e-6;
    ax /= len; ay /= len; az /= len;
    // orthonormal frame
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(az) > 0.9) { ux = 1; uy = 0; uz = 0; }
    let px = uy * az - uz * ay, py = uz * ax - ux * az, pz = ux * ay - uy * ax;
    let l = Math.hypot(px, py, pz) || 1; px /= l; py /= l; pz /= l;
    const qx = ay * pz - az * py, qy = az * px - ax * pz, qz = ax * py - ay * px;

    const ring = (base, r) => {
      const out = [];
      for (let i = 0; i <= seg; i++) {
        const t = (i / seg) * TAU, c = Math.cos(t), s = Math.sin(t);
        const nx = px * c + qx * s, ny = py * c + qy * s, nz = pz * c + qz * s;
        out.push({
          p: this.pt(base[0] + nx * r, base[1] + ny * r, base[2] + nz * r),
          n: this.nrm(nx, ny, nz),
        });
      }
      return out;
    };
    const A = ring(a, r0), B = ring(b, r1);
    for (let i = 0; i < seg; i++) {
      this.m.triN(A[i].p, A[i].n, B[i + 1].p, B[i + 1].n, B[i].p, B[i].n, col);
      this.m.triN(A[i].p, A[i].n, A[i + 1].p, A[i + 1].n, B[i + 1].p, B[i + 1].n, col);
    }
    if (o.cap !== false) {
      const ca = this.pt(a[0], a[1], a[2]), cb = this.pt(b[0], b[1], b[2]);
      const na = this.nrm(-ax, -ay, -az), nb = this.nrm(ax, ay, az);
      if (r0 > 0.0005) for (let i = 0; i < seg; i++) this.m.triN(ca, na, A[i + 1].p, na, A[i].p, na, col);
      if (r1 > 0.0005) for (let i = 0; i < seg; i++) this.m.triN(cb, nb, B[i].p, nb, B[i + 1].p, nb, col);
    }
    return this;
  }
  cone(a, b, r, col, o) { return this.tube(a, b, r, 0.0001, col, o); }

  box(cx, cy, cz, hx, hy, hz, col) {
    const P = (x, y, z) => this.pt(cx + x, cy + y, cz + z);
    const v = [
      P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz),
      P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, -hy, -hz),
    ];
    this.m.quadFlat(v[0], v[1], v[2], v[3], col);   // +z
    this.m.quadFlat(v[4], v[5], v[6], v[7], col);   // -z
    this.m.quadFlat(v[1], v[7], v[6], v[2], col);   // +x
    this.m.quadFlat(v[4], v[0], v[3], v[5], col);   // -x
    this.m.quadFlat(v[3], v[2], v[6], v[5], col);   // +y
    this.m.quadFlat(v[4], v[7], v[1], v[0], col);   // -y
    return this;
  }

  /* Flattened dome used for eyes, shells and spots that sit on a surface. */
  disc(cx, cy, cz, r, col, o) {
    o = o || {};
    const seg = o.seg || 16, nz = o.n || [0, 0, 1];
    const c = this.pt(cx, cy, cz), n = this.nrm(nz[0], nz[1], nz[2]);
    let ux = 1, uy = 0, uz = 0;
    if (Math.abs(nz[0]) > 0.9) { ux = 0; uy = 1; uz = 0; }
    let px = uy * nz[2] - uz * nz[1], py = uz * nz[0] - ux * nz[2], pz = ux * nz[1] - uy * nz[0];
    let l = Math.hypot(px, py, pz) || 1; px /= l; py /= l; pz /= l;
    const qx = nz[1] * pz - nz[2] * py, qy = nz[2] * px - nz[0] * pz, qz = nz[0] * py - nz[1] * px;
    const ring = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * TAU, cc = Math.cos(t), ss = Math.sin(t);
      ring.push(this.pt(cx + (px * cc + qx * ss) * r, cy + (py * cc + qy * ss) * r, cz + (pz * cc + qz * ss) * r));
    }
    for (let i = 0; i < seg; i++) this.m.triN(c, n, ring[i], n, ring[i + 1], n, col);
    return this;
  }

  /* A cartoon eye: white ball, coloured iris, black pupil, white glint.
     `dir` is the outward direction the eye looks along. */
  /* A flat coin facing `dir`. Because the outline pass wraps every solid,
     stacking coins gives the crisp concentric rings of the drawn artwork. */
  coin(c, dir, r, t, col, seg) {
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l;
    return this.tube(
      [c[0] - dx * t, c[1] - dy * t, c[2] - dz * t],
      [c[0] + dx * t, c[1] + dy * t, c[2] + dz * t],
      r, r, col, { seg: seg || 20 });
  }

  /* A closed spherical cap ("contact lens") of radius R about `dir`, opening
     to `half` radians. Closed with a flat base so the outline hull behaves.
     Stacking these on an eyeball gives a conformal iris/pupil/glint. */
  capSolid(c, dir, R, half, col, seg, nv) {
    seg = seg || 22; nv = nv || 5;
    const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ax = dir[0] / L, ay = dir[1] / L, az = dir[2] / L;
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(az) > 0.9) { ux = 1; uz = 0; }
    let px = uy * az - uz * ay, py = uz * ax - ux * az, pz = ux * ay - uy * ax;
    const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
    const qx = ay * pz - az * py, qy = az * px - ax * pz, qz = ax * py - ay * px;

    const ring = [];
    for (let j = 0; j <= nv; j++) {
      const phi = half * (j / nv), cp = Math.cos(phi), sp = Math.sin(phi);
      const row = [];
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, ct = Math.cos(th), st = Math.sin(th);
        const nx = ax * cp + (px * ct + qx * st) * sp;
        const ny = ay * cp + (py * ct + qy * st) * sp;
        const nz = az * cp + (pz * ct + qz * st) * sp;
        row.push({ p: this.pt(c[0] + nx * R, c[1] + ny * R, c[2] + nz * R), n: this.nrm(nx, ny, nz) });
      }
      ring.push(row);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < seg; i++) {
      const A = ring[j][i], B = ring[j + 1][i], C = ring[j + 1][i + 1], D = ring[j][i + 1];
      this.m.triN(A.p, A.n, B.p, B.n, D.p, D.n, col);
      this.m.triN(B.p, B.n, C.p, C.n, D.p, D.n, col);
    }
    // flat base so the solid is closed
    const k = Math.cos(half);
    const ctr = this.pt(c[0] + ax * R * k, c[1] + ay * R * k, c[2] + az * R * k);
    const bn = this.nrm(-ax, -ay, -az);
    const rim = ring[nv];
    for (let i = 0; i < seg; i++) this.m.triN(ctr, bn, rim[i + 1].p, bn, rim[i].p, bn, col);
    return this;
  }

  /* A rounded line through a list of points - mouths, brows, seams, laces. */
  stroke(pts, r, col, o) {
    o = o || {};
    const seg = o.seg || 7;
    for (let i = 0; i < pts.length - 1; i++) {
      const r0 = o.taper ? r * (1 - i / (pts.length - 1) * o.taper) : r;
      const r1 = o.taper ? r * (1 - (i + 1) / (pts.length - 1) * o.taper) : r;
      this.tube(pts[i], pts[i + 1], r0, r1, col, { seg, cap: false });
      if (i > 0) this.sphere(pts[i][0], pts[i][1], pts[i][2], r0, col, { su: seg, sv: 6 });
    }
    if (o.round !== false) {
      this.sphere(pts[0][0], pts[0][1], pts[0][2], r, col, { su: seg, sv: 6 });
      const e = pts[pts.length - 1];
      this.sphere(e[0], e[1], e[2], o.taper ? r * (1 - o.taper) : r, col, { su: seg, sv: 6 });
    }
    return this;
  }

  /* An arc of points in the plane spanned by two axes - handy for smiles. */
  static arc(c, ax, ay, a0, a1, n, bulge) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = a0 + (a1 - a0) * (i / n);
      const s = bulge ? 1 + Math.sin((i / n) * Math.PI) * bulge : 1;
      out.push([
        c[0] + Math.cos(t) * ax[0] * s + Math.sin(t) * ay[0] * s,
        c[1] + Math.cos(t) * ax[1] * s + Math.sin(t) * ay[1] * s,
        c[2] + Math.cos(t) * ax[2] * s + Math.sin(t) * ay[2] * s,
      ]);
    }
    return out;
  }

  capsule(a, b, r, col, o) {
    this.tube(a, b, r, (o && o.r1) || r, col, Object.assign({ cap: false }, o));
    this.sphere(a[0], a[1], a[2], r, col, { su: 10, sv: 8 });
    this.sphere(b[0], b[1], b[2], (o && o.r1) || r, col, { su: 10, sv: 8 });
    return this;
  }

  /* A cartoon eye: oval white, big iris, pupil, glint, and - crucially -
     an upper lid in skin tone, which is what makes it read as an eye
     rather than a ball stuck on a head. */
  eye(cx, cy, cz, r, dir, opt) {
    opt = opt || {};
    const iris = opt.iris || hex("#3b2a1b");
    const white = opt.white || hex("#fdfdfa");
    const ir = opt.ir === undefined ? 0.60 : opt.ir;      // iris size, fraction of r
    const tall = opt.tall === undefined ? 1.12 : opt.tall; // ovalness
    const pr = opt.pr === undefined ? 0.46 : opt.pr;
    let [dx, dy, dz] = dir;
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;

    // Build the whole eye in a local frame looking down +Z, then swing that
    // frame onto `dir`. Scaling the frame keeps the iris conformal to the ball.
    const yaw = Math.atan2(dx, dz), pitch = Math.asin(clamp(dy, -1, 1));
    this.push().translate(cx, cy, cz).rotate(yaw, -pitch, 0).scale(1, tall, 1);

    this.sphere(0, 0, 0, r, white, { su: 24, sv: 18 });
    // Each layer sits a few percent proud of the last. Anything tighter
    // z-fights with the eyeball and the iris collapses to a thin ring.
    const F = [0, 0, 1];
    if (ir > 0.001) this.capSolid([0, 0, 0], F, r * 1.03, Math.asin(clamp(ir, 0, 0.97)), iris, 24, 5);
    this.capSolid([0, 0, 0], F, r * 1.06, Math.asin(clamp(ir * pr, 0.04, 0.9)), hex("#0d0d0e"), 20, 4);
    const gd = [-0.42, 0.55, 0.72];
    this.capSolid([0, 0, 0], gd, r * 1.09, Math.asin(0.20), hex("#ffffff"), 14, 3);

    // Optional upper lid. Kept shallow - the reference art has wide-open eyes,
    // so this is only for the two humans, who read as heavy-lidded.
    if (opt.lid) {
      const drop = opt.lidDrop === undefined ? 0.22 : opt.lidDrop;
      this.push().translate(0, r * (1 - drop * 0.55), -r * 0.06).rotate(0, opt.lidTilt || 0, 0);
      this.ellipsoid(0, 0, 0, r * 1.09, r * drop * 1.15, r * 1.06, opt.lid, { su: 20, sv: 12 });
      this.pop();
    }
    this.pop();
    return this;
  }
}

/* ----------------------------- programs ---------------------------- */
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src);
  return s;
}
function program(gl, vs, fs, attrs, unis) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const o = { prog: p, a: {}, u: {} };
  attrs.forEach(n => o.a[n] = gl.getAttribLocation(p, n));
  unis.forEach(n => o.u[n] = gl.getUniformLocation(p, n));
  return o;
}

const WORLD_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute float aShade;
uniform mat4 uVP;
varying vec2 vUV; varying float vShade; varying float vDist; varying vec3 vWorld;
void main(){
  vec4 p = uVP * vec4(aPos,1.0);
  gl_Position = p; vUV = aUV; vShade = aShade; vDist = p.w; vWorld = aPos;
}`;
const WORLD_FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uFog; uniform float uFogD; uniform float uBright;
uniform vec4 uTint; uniform float uCut; uniform float uAlpha;
uniform vec3 uCam; uniform float uLamp;
varying vec2 vUV; varying float vShade; varying float vDist; varying vec3 vWorld;
void main(){
  vec4 c = texture2D(uTex, vUV);
  float a = c.a * uAlpha;
  if (a < uCut) discard;
  vec3 col = mix(c.rgb, uTint.rgb, uTint.a);
  float d = distance(vWorld, uCam);
  col *= vShade * uBright * (1.0 + uLamp * exp(-d * 0.24));
  float f = 1.0 - exp(-uFogD * uFogD * vDist * vDist);
  col = mix(col, uFog, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}`;

const CHAR_VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec3 aCol;
uniform mat4 uMVP; uniform mat4 uModel; uniform float uGrow;
varying vec3 vCol; varying vec3 vNorm; varying vec3 vWorld; varying float vDist;
void main(){
  vec3 p = aPos + aNorm * uGrow;
  vec4 cp = uMVP * vec4(p,1.0);
  gl_Position = cp; vDist = cp.w; vCol = aCol;
  vNorm = normalize(mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNorm);
  vWorld = (uModel * vec4(p,1.0)).xyz;
}`;
const CHAR_FS = `
precision mediump float;
uniform vec3 uFog; uniform float uFogD; uniform float uBright;
uniform vec4 uTint; uniform float uInk; uniform vec3 uLightDir;
uniform vec3 uCam; uniform float uLamp; uniform vec3 uRim;
varying vec3 vCol; varying vec3 vNorm; varying vec3 vWorld; varying float vDist;
void main(){
  vec3 col;
  if (uInk > 0.5) {
    col = vec3(0.045,0.04,0.032);
  } else {
    vec3 N = normalize(vNorm);
    float d = dot(N, normalize(uLightDir));
    // three flat bands keeps the hand-drawn cel look
    float band = d > 0.42 ? 1.0 : (d > -0.08 ? 0.80 : 0.62);
    float dist = distance(vWorld, uCam);
    col = vCol * band * uBright * (1.0 + uLamp * exp(-dist * 0.24));
    vec3 V = normalize(uCam - vWorld);
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    col += uRim * rim;
    col = mix(col, uTint.rgb, uTint.a);
  }
  float f = 1.0 - exp(-uFogD * uFogD * vDist * vDist);
  gl_FragColor = vec4(mix(col, uFog, clamp(f, 0.0, 1.0)), 1.0);
}`;

function makePrograms(gl) {
  return {
    world: program(gl, WORLD_VS, WORLD_FS,
      ["aPos", "aUV", "aShade"],
      ["uVP", "uTex", "uFog", "uFogD", "uBright", "uTint", "uCut", "uAlpha", "uCam", "uLamp"]),
    char: program(gl, CHAR_VS, CHAR_FS,
      ["aPos", "aNorm", "aCol"],
      ["uMVP", "uModel", "uGrow", "uFog", "uFogD", "uBright", "uTint", "uInk", "uLightDir", "uCam", "uLamp", "uRim"]),
  };
}

/* Draw a character mesh: black inverted hull first, then the shaded fill. */
function drawChar(gl, P, buf, mvp, model, opts) {
  const o = opts || {};
  gl.useProgram(P.char.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.enableVertexAttribArray(P.char.a.aPos); gl.vertexAttribPointer(P.char.a.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.norm);
  gl.enableVertexAttribArray(P.char.a.aNorm); gl.vertexAttribPointer(P.char.a.aNorm, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.col);
  gl.enableVertexAttribArray(P.char.a.aCol); gl.vertexAttribPointer(P.char.a.aCol, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(P.char.u.uMVP, false, mvp);
  gl.uniformMatrix4fv(P.char.u.uModel, false, model);
  gl.uniform3fv(P.char.u.uLightDir, o.light || [0.35, 0.9, 0.45]);
  gl.uniform3f(P.char.u.uFog, o.fog[0], o.fog[1], o.fog[2]);
  gl.uniform1f(P.char.u.uFogD, o.fogD === undefined ? 0.03 : o.fogD);
  gl.uniform3f(P.char.u.uCam, o.cam[0], o.cam[1], o.cam[2]);
  gl.uniform1f(P.char.u.uLamp, o.lamp || 0);
  gl.uniform3fv(P.char.u.uRim, o.rim || [0, 0, 0]);

  gl.enable(gl.CULL_FACE);

  // outline
  gl.cullFace(gl.FRONT);
  gl.uniform1f(P.char.u.uInk, 1);
  gl.uniform1f(P.char.u.uGrow, o.ink === undefined ? 0.035 : o.ink);
  gl.uniform1f(P.char.u.uBright, 1);
  gl.uniform4f(P.char.u.uTint, 0, 0, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, buf.count);

  // fill
  gl.cullFace(gl.BACK);
  gl.uniform1f(P.char.u.uInk, 0);
  gl.uniform1f(P.char.u.uGrow, 0);
  gl.uniform1f(P.char.u.uBright, o.bright === undefined ? 1 : o.bright);
  const t = o.tint || [0, 0, 0, 0];
  gl.uniform4f(P.char.u.uTint, t[0], t[1], t[2], t[3]);
  gl.drawArrays(gl.TRIANGLES, 0, buf.count);

  gl.disable(gl.CULL_FACE);
  gl.disableVertexAttribArray(P.char.a.aNorm);
  gl.disableVertexAttribArray(P.char.a.aCol);
}
