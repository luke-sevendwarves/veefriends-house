"use strict";
/* =====================================================================
   game.js - the house, the enemies, and the loop.
   ===================================================================== */

// Roughly one metre per unit. Cells are 2.3m, so a 3x4 room is about 7x9m
// and a doorway is a doorway rather than a loading bay. Ceilings stay high
// enough to jump under.
/* Grid constants come from world.js so the two can never disagree - they
   did once, and every collision lookup read the wrong cell. */
const CELL = W.CELL, WALLH = W.ROOMH, EYE = 1.72, DOORH = 2.45;
const GRAV = 24, JUMP_V = 7.4;
const MAPW = W.MAPW, MAPH = W.MAPH, MARGIN = W.MARGIN, PRAD = 0.34;

const WEAPONS = [
  {
    name: "PISTOL", model: "pistol",
    mag: 15, reserveMax: 240, dmg: 78, headMult: 3.0,
    rof: .115, reload: .85, spread: .7, range: 60, pierce: 0,
    kick: .022, shake: .18, ammoPer: 24,
    view: { x: .132, y: -.128, z: -.50, yaw: -.10, scale: .60, ink: .0040 },
  },
  {
    // A belt-fed thing that spins up and keeps going, not a little SMG.
    name: "MACHINE GUN", model: "mg",
    mag: 200, reserveMax: 1000, dmg: 44, headMult: 2.2,
    rof: .075, reload: 3.2, spread: 2.4, range: 60, pierce: 1,
    kick: .011, shake: .13, ammoPer: 120, auto: true, spin: true, heavy: .62,
    view: { x: .140, y: -.132, z: -.46, yaw: -.070, scale: .60, ink: .0034 },
  },
  {
    name: "SNIPER", model: "sniper",
    mag: 6, reserveMax: 80, dmg: 620, headMult: 2.5,
    rof: .95, reload: 1.6, spread: .10, range: 160, pierce: 3,
    kick: .085, shake: .55, ammoPer: 6, scope: true, fovZoom: .40, zoomSens: .34,
    view: { x: .150, y: -.138, z: -.46, yaw: -.045, scale: .50, ink: .0030 },
  },
  {
    name: "RPG", model: "rpg",
    mag: 2, reserveMax: 24, dmg: 0, headMult: 1,
    rof: .75, reload: 2.1, spread: .4, range: 90, pierce: 0,
    kick: .105, shake: .75, ammoPer: 3,
    rocket: { speed: 34, dmg: 950, radius: 5.2 },
    view: { x: .120, y: -.120, z: -.40, yaw: -.030, scale: .58, ink: .0032 },
  },
];
const WP = () => WEAPONS[P.w];

/* The house runs through several very different wings. Each has its own
   surfaces, its own air, and its own idea of how much light you deserve. */
// Steady warm bulbs, almost no haze. Dark corners, but you can always see.
const ZONES = [
  { name: "THE GROUND FLOOR", fog: [.055, .045, .034], fogD: .012, lightI: 1.35, dark: .12, amb: .52 },
  { name: "UPSTAIRS",         fog: [.050, .040, .030], fogD: .013, lightI: 1.30, dark: .16, amb: .48 },
  { name: "THE ATTIC",        fog: [.046, .037, .027], fogD: .015, lightI: 1.20, dark: .20, amb: .44 },
];
/* Step out of the back door and the air changes. */
const NIGHT = { name: "THE GROUNDS", fog: [.045, .055, .088], fogD: .0085, lightI: .5, dark: 1, amb: .62 };

/* Enemies are deliberately oversized - they should crowd a corridor. */
const KINDS = {
  // The Tenacious Termite is the big one now, and the Gentle Giant is the one
  // that comes at you in numbers.
  termite: {
    name: "TENACIOUS TERMITE", art: "termite",
    hp: 620, speed: 3.7, h: 3.30, rad: .78, dmg: 34, reach: 2.4, rate: 2.2,
    ranged: false, clout: 550, pitch: 240, pound: true, mini: true,
    death: ["termite: I'll be back. I'm relentless.", "termite: still tenacious, technically"],
  },
  hermit: {
    name: "HAPPY HERMIT CRAB", art: "hermit",
    hp: 165, speed: 3.5, h: 2.25, rad: .54, dmg: 20, reach: 1.9, rate: 1.3,
    ranged: false, clout: 140, pitch: 340, shells: true,
    death: ["hermit crab: still happy about it", "hermit crab: no notes, great vibe"],
  },
  iguana: {
    name: "INTUITIVE IGUANA", art: "iguana",
    hp: 105, speed: 4.0, h: 2.35, rad: .46, dmg: 14, reach: 0, rate: 1.5,
    ranged: "orb", clout: 160, pitch: 520, strafe: 1.0,
    death: ["iguana: I did not see that coming", "iguana: my intuition is in a slump"],
  },
  creativecrab: {
    name: "CREATIVE CRAB", art: "creativecrab",
    hp: 120, speed: 4.3, h: 1.95, rad: .52, dmg: 16, reach: 0, rate: 1.25,
    ranged: "paint", clout: 175, pitch: 460, strafe: 1.6,
    death: ["creative crab: that was my rough draft", "creative crab: the algorithm hated it too"],
  },
  giant: {
    // Still enormous -- that is the whole joke -- just no longer the heavy.
    // Big and common, so the house is full of them, but they go down.
    name: "GENTLE GIANT", art: "giant",
    hp: 105, speed: 4.6, h: 3.05, rad: .68, dmg: 18, reach: 2.0, rate: 1.4,
    ranged: false, clout: 150, pitch: 190,
    death: ["gentle giant: sorry sorry sorry sorry", "gentle giant: I was being SO careful"],
  },
  garyvee: {
    name: "GARY VAYNERCHUK", art: "garyvee",
    hp: 1100, speed: 4.8, h: 3.25, rad: .82, dmg: 22, reach: 2.4, rate: 1.9,
    ranged: "phone", clout: 3000, pitch: 130, boss: true,
    death: [],
  },
};

/* Shouted at you mid-fight. Straight from the clip, nothing invented. */
const GARY_LINES = [
  "MASSIVE GLOW UP!", "ALPHA!",
];
const GARY_PHASE = ["WARMING UP", "LOCKED IN", "FULL SEND"];
/* Thrown up when you string kills together. */
const STREAK_LINES = {
  3: ["ON A HEATER!", "COOKING!", "HE'S COOKING!"],
  5: ["MASSIVE GLOW UP!", "ABSOLUTE UNIT!", "CERTIFIED BANGER!"],
  8: ["GIGA ALPHA!", "SHEEEESH!", "UNREAL!"],
  12: ["FLOOR PRICE UP!", "GENERATIONAL RUN!", "MINT IT!"],
};
const HEAD_LINES = ["ALPHA!", "SNIPED!", "NO CAP!", "MASSIVE W!", "SHEEEESH!"];

/* ------------------------------ GL setup ---------------------------- */
const glc = document.getElementById("gl");
const gl = glc.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" });
if (!gl) alert("This game needs WebGL. Try Chrome or Safari.");
const PROG = makePrograms(gl);
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
const maxAniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

function mkTex(src, repeat) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (repeat) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAniso));
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return t;
}
const TEX = {};

/* ------------------------- the wall screens ------------------------- */
/* A looping video, uploaded to a texture every frame and shown on panels
   mounted around the level. Muted so it can autoplay. */
// bumped whenever the media files are re-cut, so browsers don't serve a stale copy
const MEDIA_V = "2";
let videoEl = null, videoTex = null, videoOK = false;
function initVideo() {
  videoEl = document.createElement("video");
  videoEl.src = "assets/video/screen.mp4?v=" + MEDIA_V;
  videoEl.loop = true; videoEl.muted = true; videoEl.defaultMuted = true;
  videoEl.playsInline = true; videoEl.setAttribute("playsinline", "");
  videoEl.preload = "auto";
  videoTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, videoTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 24, 30, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  videoEl.addEventListener("canplay", () => { videoOK = true; });
  const go = () => { const pr = videoEl.play(); if (pr && pr.catch) pr.catch(() => {}); };
  videoEl.addEventListener("loadeddata", go);
  go();
}
function updateVideoTex() {
  if (!videoEl) return;
  if (videoEl.paused && videoOK) { const pr = videoEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
  if (!videoOK || videoEl.readyState < 2) return;
  gl.bindTexture(gl.TEXTURE_2D, videoTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
}

/* -------------------- world-program draw helpers -------------------- */
const quadBuf = gl.createBuffer();
const quadData = new Float32Array(36);
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, quadData.byteLength, gl.DYNAMIC_DRAW);

const QD = {
  use(vp, cam, fog, fogD, lamp) {
    gl.useProgram(PROG.world.prog);
    gl.uniformMatrix4fv(PROG.world.u.uVP, false, vp);
    gl.uniform1i(PROG.world.u.uTex, 0);
    gl.uniform3f(PROG.world.u.uFog, fog[0], fog[1], fog[2]);
    gl.uniform1f(PROG.world.u.uFogD, fogD);
    gl.uniform3f(PROG.world.u.uCam, cam[0], cam[1], cam[2]);
    gl.uniform1f(PROG.world.u.uLamp, lamp);
    gl.uniform4f(PROG.world.u.uTint, 0, 0, 0, 0);
    gl.uniform1f(PROG.world.u.uAlpha, 1);
    gl.uniform1f(PROG.world.u.uCut, 0.5);
    gl.uniform1f(PROG.world.u.uBright, 1);
  },
  attribs() {
    const a = PROG.world.a;
    gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(a.aShade); gl.vertexAttribPointer(a.aShade, 1, gl.FLOAT, false, 24, 20);
  },
  quad(tex, x0, y0, z0, u0, v0, x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, o) {
    o = o || {};
    const d = quadData, sh = o.shade === undefined ? 1 : o.shade;
    const c = [x0, y0, z0, u0, v0, x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3];
    const ord = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) {
      const s = ord[i] * 5;
      d[i * 6] = c[s]; d[i * 6 + 1] = c[s + 1]; d[i * 6 + 2] = c[s + 2];
      d[i * 6 + 3] = c[s + 3]; d[i * 6 + 4] = c[s + 4]; d[i * 6 + 5] = sh;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    this.attribs();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const t = o.tint;
    gl.uniform4f(PROG.world.u.uTint, t ? t[0] : 0, t ? t[1] : 0, t ? t[2] : 0, t ? t[3] : 0);
    gl.uniform1f(PROG.world.u.uAlpha, o.alpha === undefined ? 1 : o.alpha);
    gl.uniform1f(PROG.world.u.uCut, o.cut === undefined ? 0.35 : o.cut);
    gl.uniform1f(PROG.world.u.uBright, o.bright === undefined ? 1 : o.bright);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  },
  /* an upright camera-facing card */
  billboard(tex, x, y, z, w, h, o) {
    o = o || {};
    const rx = Math.cos(o.yaw) * w / 2, rz = Math.sin(o.yaw) * w / 2;
    this.quad(tex,
      x - rx, y, z - rz, 0, 1,
      x + rx, y, z + rz, 1, 1,
      x + rx, y + h, z + rz, 1, 0,
      x - rx, y + h, z - rz, 0, 0, o);
  },
  /* a flat card lying on the floor - contact shadows */
  ground(tex, x, y, z, r, o) {
    this.quad(tex,
      x - r, y, z - r, 0, 0, x + r, y, z - r, 1, 0,
      x + r, y, z + r, 1, 1, x - r, y, z + r, 0, 1, o);
  },
};

/* ------------------------ procedural textures ----------------------- */
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return c; }
function wrapBlob(x, g, cx, cy, r, col, both) {
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!both && oy !== 0) continue;
    const gx = cx + ox * g, gy = cy + oy * g;
    const grd = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    grd.addColorStop(0, col.replace("A", "0.5")); grd.addColorStop(.55, col.replace("A", "0.2"));
    grd.addColorStop(1, col.replace("A", "0"));
    x.fillStyle = grd; x.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
}
function grain(x, S, amt) {
  const img = x.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - .5) * amt;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n * .95, 0, 255); d[i + 2] = clamp(d[i + 2] + n * .8, 0, 255);
  }
  x.putImageData(img, 0, 0);
}
/* ================== the surfaces of an old house =================== */
/* Grey, grimy, damp. Dirty plaster with vertical streaking, weathered
   grey boards, mossy stone below. Almost no colour saturation - the
   warmth comes from the bulbs, not the materials.                      */

function streaks(x, S, n, col, from) {
  x.globalAlpha = .30;
  for (let i = 0; i < n; i++) {
    const sx = rand(0, S), w = rand(1.5, 7), len = rand(30, 190);
    const g = x.createLinearGradient(0, from, 0, from + len);
    g.addColorStop(0, col.replace("A", ".55")); g.addColorStop(1, col.replace("A", "0"));
    x.fillStyle = g; x.fillRect(sx, from, w, len);
  }
  x.globalAlpha = 1;
}
function cracks(x, S, n, col) {
  x.strokeStyle = col; x.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    let cx = rand(0, S), cy = rand(0, S);
    x.beginPath(); x.moveTo(cx, cy);
    for (let k = 0; k < 6; k++) { cx += rand(-16, 16); cy += rand(4, 22); x.lineTo(cx, cy); }
    x.stroke();
  }
}
function grimeEdges(x, S) {
  const g = x.createLinearGradient(0, S - 70, 0, S);
  g.addColorStop(0, "rgba(38,36,32,0)"); g.addColorStop(1, "rgba(38,36,32,.55)");
  x.fillStyle = g; x.fillRect(0, S - 70, S, 70);
  const t = x.createLinearGradient(0, 0, 0, 46);
  t.addColorStop(0, "rgba(30,28,25,.45)"); t.addColorStop(1, "rgba(30,28,25,0)");
  x.fillStyle = t; x.fillRect(0, 0, S, 46);
}

/* ---- 0: ground floor - filthy plaster over grey boards ---- */
function genWallHouse() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#b3ada1"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(26, 78), "rgba(92,88,78,A)", true);
  for (let i = 0; i < 4; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(20, 54), "rgba(214,210,198,A)", true);
  streaks(x, S, 26, "rgba(74,70,60,A)", -10);
  streaks(x, S, 10, "rgba(58,56,48,A)", 120);
  cracks(x, S, 5, "rgba(70,66,58,.5)");
  grain(x, S, 18);
  grimeEdges(x, S);
  x.fillStyle = "#8a8477"; x.fillRect(0, S - 24, S, 24);          // skirting
  x.fillStyle = "rgba(230,226,214,.16)"; x.fillRect(0, S - 24, S, 2);
  x.fillStyle = "rgba(24,22,18,.6)"; x.fillRect(0, S - 5, S, 5);
  return c;
}
function genFloorHouse() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#7e766a"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    x.fillStyle = ["#877f72", "#786f63", "#918879", "#6f675c"][(i * 3) & 3];
    x.fillRect(0, y, S, 31);
    x.globalAlpha = .16;
    for (let k = 0; k < 80; k++) {
      x.fillStyle = Math.random() < .5 ? "#4a453c" : "#a9a091";
      x.fillRect(rand(0, S), y + rand(2, 28), rand(16, 90), 1);
    }
    x.globalAlpha = 1;
    x.fillStyle = "rgba(28,26,22,.7)"; x.fillRect(0, y + 30, S, 2);     // plank gap
    x.fillStyle = "rgba(28,26,22,.5)"; x.fillRect((i * 83) % S, y, 2, 31);
  }
  for (let i = 0; i < 8; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(24, 66), "rgba(40,38,32,A)", true);
  grain(x, S, 16);
  return c;
}
function genCeilHouse() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#bdb7ab"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(30, 82), "rgba(86,80,66,A)", true);
  cracks(x, S, 4, "rgba(80,76,66,.45)");
  grain(x, S, 14);
  return c;
}

/* ---- 1: upstairs - what is left of the wallpaper ---- */
function genWallDamp() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#a9a294"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 26) {
    x.fillStyle = "rgba(124,118,104,.30)"; x.fillRect(i, 0, 11, S);
    x.fillStyle = "rgba(198,192,178,.18)"; x.fillRect(i + 12, 0, 3, S);
  }
  // torn-away patches down to bare plaster
  for (let i = 0; i < 5; i++) {
    const px = rand(0, S), py = rand(0, S), r = rand(14, 40);
    x.fillStyle = "#9c948a";
    x.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = k / 12 * TAU, rr = r * rand(.55, 1.2);
      const vx = px + Math.cos(a) * rr, vy = py + Math.sin(a) * rr;
      k ? x.lineTo(vx, vy) : x.moveTo(vx, vy);
    }
    x.closePath(); x.fill();
    x.strokeStyle = "rgba(60,56,48,.45)"; x.lineWidth = 1.4; x.stroke();
  }
  for (let i = 0; i < 7; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(22, 66), "rgba(88,82,68,A)", true);
  streaks(x, S, 20, "rgba(70,66,56,A)", -10);
  grain(x, S, 18);
  grimeEdges(x, S);
  x.fillStyle = "#87806f"; x.fillRect(0, S - 22, S, 22);
  x.fillStyle = "rgba(22,20,16,.6)"; x.fillRect(0, S - 5, S, 5);
  return c;
}
function genFloorDamp() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#8b8274"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) {
    const y = i * 43;
    x.fillStyle = ["#948a7b", "#847b6d", "#9d9384", "#7c7365"][(i * 5) & 3];
    x.fillRect(0, y, S, 42);
    x.globalAlpha = .15;
    for (let k = 0; k < 70; k++) {
      x.fillStyle = Math.random() < .5 ? "#524c42" : "#b4ab9b";
      x.fillRect(rand(0, S), y + rand(2, 38), rand(18, 96), 1);
    }
    x.globalAlpha = 1;
    x.fillStyle = "rgba(30,28,24,.68)"; x.fillRect(0, y + 41, S, 2);
  }
  for (let i = 0; i < 6; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(20, 58), "rgba(44,40,34,A)", true);
  grain(x, S, 15);
  return c;
}
function genCeilDamp() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#c2bcb0"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(26, 76), "rgba(90,84,70,A)", true);
  grain(x, S, 13);
  return c;
}

/* ---- 2: the basement - mossy stone and concrete ---- */
function genWallServer() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#4c4842"; x.fillRect(0, 0, S, S);
  const BH = 30;
  let row = 0;
  for (let y = 0; y < S; y += BH, row++) {
    const off = (row % 2) ? 30 : 0;
    for (let bx = -60; bx < S; bx += 60) {
      x.fillStyle = ["#8b857a", "#7d776c", "#948e82", "#726c62"][(bx / 60 + row) & 3];
      x.fillRect(bx + off + 3, y + 3, 54, BH - 6);
      x.globalAlpha = .20; x.fillStyle = "#3a362f";
      for (let k = 0; k < 5; k++) x.fillRect(bx + off + rand(5, 50), y + rand(5, BH - 8), rand(3, 11), 2);
      x.globalAlpha = 1;
    }
  }
  // moss creeping up from the floor
  for (let i = 0; i < 8; i++) wrapBlob(x, S, rand(0, S), rand(170, 268), rand(22, 60), "rgba(72,88,52,A)", false);
  streaks(x, S, 14, "rgba(48,46,40,A)", -10);
  grain(x, S, 18);
  grimeEdges(x, S);
  return c;
}
function genFloorServer() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#6b675f"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 10; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(26, 76), "rgba(40,38,33,A)", true);
  for (let i = 0; i < 4; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(18, 46), "rgba(146,142,132,A)", true);
  for (let i = 0; i < 3; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(20, 48), "rgba(74,88,54,A)", true);
  cracks(x, S, 6, "rgba(40,38,33,.5)");
  grain(x, S, 17);
  return c;
}
function genCeilServer() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#4a463f"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 64) {
    x.fillStyle = "#6d675c"; x.fillRect(i, 0, 30, S);
    x.fillStyle = "rgba(26,24,20,.6)"; x.fillRect(i + 28, 0, 4, S);
    x.globalAlpha = .2;
    for (let k = 0; k < 34; k++) { x.fillStyle = "#33302a"; x.fillRect(i + rand(2, 26), rand(0, S), rand(1, 2), rand(12, 44)); }
    x.globalAlpha = 1;
  }
  grain(x, S, 13);
  return c;
}

/* ---- 3: the attic - grey bare boards ---- */
function genWallPool() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#8d8578"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 34) {
    x.fillStyle = ["#968d7f", "#877e71", "#9e9587", "#7f7669"][(i / 34) & 3];
    x.fillRect(i, 0, 32, S);
    x.globalAlpha = .17;
    for (let k = 0; k < 46; k++) {
      x.fillStyle = Math.random() < .5 ? "#514b42" : "#b6ad9d";
      x.fillRect(i + rand(2, 28), rand(0, S), 1, rand(24, 100));
    }
    x.globalAlpha = 1;
    x.fillStyle = "rgba(26,24,20,.62)"; x.fillRect(i + 32, 0, 2, S);
    if (Math.random() < .6) {
      x.globalAlpha = .32; x.fillStyle = "#3a352d";
      x.beginPath(); x.ellipse(i + 16, rand(20, S - 20), 2.6, 4.2, 0, 0, TAU); x.fill();
      x.globalAlpha = 1;
    }
  }
  grain(x, S, 17);
  grimeEdges(x, S);
  return c;
}
function genFloorPool() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#857d70"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) {
    const y = i * 37;
    x.fillStyle = ["#8e8578", "#7f766a", "#978e80", "#776f63"][(i * 3) & 3];
    x.fillRect(0, y, S, 36);
    x.globalAlpha = .16;
    for (let k = 0; k < 60; k++) {
      x.fillStyle = Math.random() < .5 ? "#4e483f" : "#afa696";
      x.fillRect(rand(0, S), y + rand(2, 32), rand(16, 88), 1);
    }
    x.globalAlpha = 1;
    x.fillStyle = "rgba(26,24,20,.68)"; x.fillRect(0, y + 35, S, 2);
  }
  for (let i = 0; i < 7; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(18, 50), "rgba(42,38,32,A)", true);
  grain(x, S, 16);
  return c;
}
function genCeilPool() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#5c554b"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 42) {
    x.fillStyle = "#7a7266"; x.fillRect(i, 0, 22, S);
    x.fillStyle = "rgba(24,22,18,.55)"; x.fillRect(i + 21, 0, 3, S);
  }
  grain(x, S, 14);
  return c;
}

function genPanelZ() {
  const S = 128, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#3a2e20"; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, 46);
  g.addColorStop(0, "#fff6d8"); g.addColorStop(.28, "#ffe6a4");
  g.addColorStop(.62, "rgba(190,140,60,.5)"); g.addColorStop(1, "rgba(90,60,24,0)");
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, 48, 0, TAU); x.fill();
  x.strokeStyle = "rgba(30,22,14,.7)"; x.lineWidth = 4;
  x.beginPath(); x.arc(S / 2, S / 2, 20, 0, TAU); x.stroke();
  return c;
}

/* ---- 4: the pool room - white tile, aqua trim, far too quiet ---- */
function genWallTile() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#93a5a3"; x.fillRect(0, 0, S, S);
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
    const X = tx * 32, Y = ty * 32;
    x.fillStyle = ["#a0b2b0", "#94a6a4", "#9aacaa", "#8b9d9b"][(tx * 3 + ty) & 3];
    x.fillRect(X + 1.5, Y + 1.5, 29, 29);
    x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(X + 1.5, Y + 1.5, 29, 3);
  }
  x.strokeStyle = "rgba(72,92,92,.55)"; x.lineWidth = 2.2;
  for (let i = 0; i <= S; i += 32) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
  x.fillStyle = "#24707a"; x.fillRect(0, 176, S, 20);           // aqua band
  x.fillStyle = "rgba(255,255,255,.20)"; x.fillRect(0, 176, S, 3);
  for (let i = 0; i < 6; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(18, 52), "rgba(64,80,78,A)", true);
  grain(x, S, 10);
  return c;
}
function genFloorTile() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#879997"; x.fillRect(0, 0, S, S);
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    x.fillStyle = ["#93a5a3", "#869896", "#8d9f9d", "#7e908e"][(tx * 3 + ty) & 3];
    x.fillRect(tx * 64 + 2, ty * 64 + 2, 60, 60);
  }
  x.strokeStyle = "rgba(60,78,78,.6)"; x.lineWidth = 3;
  for (let i = 0; i <= S; i += 64) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
  x.globalAlpha = .10;
  for (let i = 0; i < 8; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(26, 64), "rgba(40,54,52,A)", true);
  x.globalAlpha = 1;
  grain(x, S, 9);
  return c;
}
function genCeilTile() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#9dafad"; x.fillRect(0, 0, S, S);
  x.strokeStyle = "rgba(66,86,86,.45)"; x.lineWidth = 2;
  for (let i = 0; i <= S; i += 32) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
  grain(x, S, 5);
  return c;
}
function genWater() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#1e7f8e"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(26, 80), "rgba(120,220,225,A)", true);
  x.globalAlpha = .30;
  x.strokeStyle = "#bff2f6"; x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    x.beginPath();
    let px = rand(0, S), py = rand(0, S);
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += rand(-30, 30); py += rand(-14, 14); x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1;
  return c;
}

/* ------------------------- room surfaces ---------------------------- */
/* One wallpaper and one floorboard for the whole house is what made every
   room look like the last one. Each room type picks a skin instead. */
function genWallDamask() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#5c3634"; x.fillRect(0, 0, S, S);
  for (let gy = 0; gy < S; gy += 32) for (let gx = 0; gx < S; gx += 32) {
    const ox = (gy / 32) % 2 ? 16 : 0;
    x.fillStyle = "rgba(178,142,96,.30)";
    x.beginPath();
    x.ellipse(gx + ox, gy + 16, 9, 13, 0, 0, 7); x.fill();
    x.fillStyle = "rgba(120,74,66,.5)";
    x.beginPath(); x.ellipse(gx + ox, gy + 16, 4, 7, 0, 0, 7); x.fill();
  }
  streaks(x, S, 16, "rgba(30,16,14,A)", -8);
  cracks(x, S, 3, "rgba(24,12,10,.45)");
  grain(x, S, 14); grimeEdges(x, S);
  x.fillStyle = "#3d2422"; x.fillRect(0, S - 26, S, 26);
  x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, S - 5, S, 5);
  return c;
}
function genWallPanel() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#4b382a"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {                       // raised panels
    const px = i * 64 + 7;
    x.fillStyle = "#5a4433"; x.fillRect(px, 30, 50, S - 90);
    x.fillStyle = "rgba(255,230,190,.10)"; x.fillRect(px, 30, 50, 2);
    x.fillStyle = "rgba(0,0,0,.40)"; x.fillRect(px, S - 62, 50, 2);
  }
  for (let i = 0; i < 200; i++) {                     // grain
    x.fillStyle = `rgba(20,12,8,${.04 + Math.random() * .08})`;
    x.fillRect(rand(0, S), rand(0, S), rand(10, 60), 1);
  }
  x.fillStyle = "#3a2b20"; x.fillRect(0, 0, S, 22);   // rail
  x.fillStyle = "#2c2018"; x.fillRect(0, S - 34, S, 34);
  grimeEdges(x, S);
  return c;
}
function genWallStripe() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#9c9781"; x.fillRect(0, 0, S, S);
  for (let sx = 0; sx < S; sx += 22) {
    x.fillStyle = "rgba(126,120,96,.55)"; x.fillRect(sx, 0, 9, S);
    x.fillStyle = "rgba(214,208,182,.20)"; x.fillRect(sx + 11, 0, 3, S);
  }
  streaks(x, S, 22, "rgba(66,62,48,A)", -14);
  cracks(x, S, 4, "rgba(58,54,44,.45)");
  grain(x, S, 16); grimeEdges(x, S);
  x.fillStyle = "#6f6a56"; x.fillRect(0, S - 24, S, 24);
  x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, S - 5, S, 5);
  return c;
}
function genWallTile() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#6f7570"; x.fillRect(0, 0, S, S);
  for (let gy = 0; gy < S; gy += 26) for (let gx = 0; gx < S; gx += 34) {
    const g = 176 + Math.random() * 34 | 0;
    x.fillStyle = `rgb(${g},${g + 4},${g - 2})`;
    x.fillRect(gx + 1, gy + 1, 32, 24);
    x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(gx + 1, gy + 1, 32, 2);
  }
  for (let i = 0; i < 30; i++) {                       // stains in the grout
    x.fillStyle = `rgba(60,72,58,${.10 + Math.random() * .22})`;
    x.fillRect(rand(0, S), rand(0, S), rand(6, 30), rand(6, 26));
  }
  grain(x, S, 10); grimeEdges(x, S);
  return c;
}
function genWallBare() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#8d8474"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 14; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(30, 90), "rgba(74,66,54,A)", true);
  for (let i = 0; i < 7; i++) {                        // lath showing through
    const y = rand(0, S);
    x.fillStyle = "rgba(58,44,30,.5)"; x.fillRect(0, y, S, 5);
  }
  streaks(x, S, 34, "rgba(48,42,32,A)", -6);
  cracks(x, S, 9, "rgba(44,38,30,.6)");
  grain(x, S, 24); grimeEdges(x, S);
  return c;
}
function genFloorParquet() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#6b5236"; x.fillRect(0, 0, S, S);
  for (let gy = 0; gy < S; gy += 32) for (let gx = 0; gx < S; gx += 32) {
    const horiz = ((gx + gy) / 32) % 2 === 0;
    for (let k = 0; k < 4; k++) {
      const t = ["#7a5c3c", "#6a4f34", "#83643f", "#5f472f"][(k + gx / 32) & 3];
      x.fillStyle = t;
      if (horiz) x.fillRect(gx + 1, gy + k * 8 + 1, 30, 6);
      else x.fillRect(gx + k * 8 + 1, gy + 1, 6, 30);
    }
  }
  for (let i = 0; i < 8; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(20, 60), "rgba(32,22,14,A)", true);
  grain(x, S, 14);
  return c;
}
function genFloorTileF() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#3a3d3a"; x.fillRect(0, 0, S, S);
  for (let gy = 0; gy < S; gy += 32) for (let gx = 0; gx < S; gx += 32) {
    const dark = ((gx + gy) / 32) % 2 === 0;
    const g = dark ? 54 + Math.random() * 14 : 150 + Math.random() * 30;
    x.fillStyle = `rgb(${g},${g + 2},${g - 3})`;
    x.fillRect(gx + 1, gy + 1, 30, 30);
  }
  for (let i = 0; i < 10; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(16, 46), "rgba(30,34,28,A)", true);
  grain(x, S, 10);
  return c;
}
function genFloorCarpet() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#4a2a2c"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {                     // pile
    x.fillStyle = `rgba(${90 + Math.random() * 50 | 0},${44 + Math.random() * 26 | 0},${46 + Math.random() * 26 | 0},.5)`;
    x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  for (let gy = 16; gy < S; gy += 64) for (let gx = 16; gx < S; gx += 64) {
    x.strokeStyle = "rgba(160,130,90,.18)"; x.lineWidth = 3;
    x.beginPath(); x.arc(gx, gy, 13, 0, 7); x.stroke();
  }
  for (let i = 0; i < 9; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(22, 62), "rgba(20,10,10,A)", true);
  return c;
}
function genFloorDusty() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#6d6555"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    x.fillStyle = ["#756d5c", "#665e4f", "#7d7463", "#5e5749"][(i * 3) & 3];
    x.fillRect(0, y, S, 31);
    x.fillStyle = "rgba(24,22,18,.6)"; x.fillRect(0, y + 30, S, 2);
  }
  for (let i = 0; i < 24; i++) wrapBlob(x, S, rand(0, S), rand(0, S), rand(30, 84), "rgba(150,144,128,A)", true);
  grain(x, S, 26);
  return c;
}

const WALL_SKINS = [genWallHouse, genWallDamask, genWallPanel, genWallStripe, genWallTile, genWallBare];
const FLOOR_SKINS = [genFloorHouse, genFloorParquet, genFloorTileF, genFloorCarpet, genFloorDusty];

/* Which surfaces each named room wears. [wall, floor] */
const ROOM_SKIN = {
  "THE GRAND HALL": [2, 2], "THE BALLROOM": [1, 1], "THE DRAWING ROOM": [1, 3],
  "THE DINING ROOM": [1, 1], "THE KITCHEN": [4, 2], "THE SCULLERY": [4, 2],
  "THE LIBRARY": [2, 3], "THE STUDY": [2, 0], "THE MUSIC ROOM": [1, 1],
  "THE BILLIARD ROOM": [2, 3], "THE SMOKING ROOM": [2, 3], "THE TROPHY ROOM": [2, 0],
  "THE CONSERVATORY": [4, 2], "THE GALLERY": [3, 1], "THE CHAPEL": [5, 2],
  "THE MASTER BEDROOM": [1, 3], "A GUEST BEDROOM": [3, 3], "THE NURSERY": [3, 3],
  "THE BATHROOM": [4, 2], "THE LINEN ROOM": [3, 0], "THE SEWING ROOM": [3, 0],
  "THE SICK ROOM": [4, 2], "THE DRESSING ROOM": [3, 3],
  "THE ATTIC": [5, 4], "THE OLD NURSERY": [5, 4], "SERVANTS' QUARTERS": [5, 4],
  "THE LUMBER ROOM": [5, 4], "THE WATER TANK": [5, 2], "THE DARKROOM": [5, 4],
  "THE TAXIDERMY ROOM": [5, 0], "A LOCKED ROOM": [5, 4], "THE STOREROOM": [5, 4],
  "THE WINE CELLAR": [5, 2], "POOLSIDE": [4, 2], "THE CHANGING ROOM": [4, 2],
};
const skinOf = (f, x, y) => {
  const ri = W.roomOf[f] ? W.roomOf[f][idx(x, y)] : -1;
  const r = ri >= 0 ? W.rooms[f][ri] : null;
  const s = r && r.typeName ? ROOM_SKIN[r.typeName] : null;
  return s || (f >= 2 ? [5, 4] : [0, 0]);        // corridors: plain, dusty up top
};

const ZONE_TEX = [
  { wall: genWallHouse, floor: genFloorHouse, ceil: genCeilHouse },
  { wall: genWallDamp,  floor: genFloorDamp,  ceil: genCeilDamp },
  { wall: genWallPool,  floor: genFloorPool,  ceil: genCeilPool },
];

function genBlob(col, soft) {
  const S = 64, c = cv(S), x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, col); g.addColorStop(soft ? .45 : .7, col.replace("1)", ".55)"));
  g.addColorStop(1, col.replace("1)", "0)"));
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}
function genOrb(a, b) {
  const S = 64, c = cv(S), x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "#fff"); g.addColorStop(.34, a); g.addColorStop(.74, b); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}
function genPhone() {
  const S = 64, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#14161c"; x.fillRect(18, 5, 28, 54);
  x.strokeStyle = "#000"; x.lineWidth = 3; x.strokeRect(18, 5, 28, 54);
  x.fillStyle = "#4ad0ff"; x.fillRect(21, 11, 22, 40);
  x.fillStyle = "#0a2a3a"; x.font = "bold 10px monospace"; x.textAlign = "center"; x.fillText("DM", 32, 34);
  return c;
}
function genCrate(label, base, top, glyph) {
  const S = 128, c = cv(S), x = c.getContext("2d");
  x.fillStyle = base; x.fillRect(16, 30, 96, 70);
  x.fillStyle = top; x.fillRect(16, 30, 96, 13);
  x.strokeStyle = "#17110a"; x.lineWidth = 5; x.strokeRect(16, 30, 96, 70);
  x.fillStyle = "#17110a"; x.textAlign = "center";
  const words = label.split(" ");
  if (words.length > 1) {                       // two short lines beat one squeezed one
    x.font = "bold 13px monospace";
    x.fillText(words[0], 64, 53);
    x.fillText(words.slice(1).join(" "), 64, 66);
    x.font = "bold 26px monospace"; x.fillText(glyph, 64, 93);
  } else {
    x.font = "bold 15px monospace"; x.fillText(label, 64, 58);
    x.font = "bold 30px monospace"; x.fillText(glyph, 64, 90);
  }
  return c;
}
function genBeam() {
  const c = cv(64, 256), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "rgba(255,60,60,0)"); g.addColorStop(.42, "rgba(255,90,90,.75)");
  g.addColorStop(.5, "rgba(255,190,190,.95)"); g.addColorStop(.58, "rgba(255,90,90,.75)");
  g.addColorStop(1, "rgba(255,60,60,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const v = x.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(0,0,0,1)"); v.addColorStop(.4, "rgba(0,0,0,0)");
  x.globalCompositeOperation = "destination-out";
  x.fillStyle = v; x.fillRect(0, 0, 64, 256);
  return c;
}
/* Coursed ashlar, weathered and streaked. The outside of the house wants to
   look cut and laid, not papered. */
function genFacade() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#6b6459"; x.fillRect(0, 0, S, S);
  const CH = 32;
  for (let row = 0, y = 0; y < S; y += CH, row++) {
    const off = (row % 2) * CH;
    for (let bx = -CH; bx < S; bx += CH * 2) {
      const g = 92 + Math.random() * 34 | 0;
      x.fillStyle = `rgb(${g},${g - 5},${g - 14})`;
      x.fillRect(bx + off + 1, y + 1, CH * 2 - 2, CH - 2);
      x.fillStyle = "rgba(0,0,0,.16)";                    // shadow under each course
      x.fillRect(bx + off + 1, y + CH - 3, CH * 2 - 2, 2);
    }
  }
  for (let i = 0; i < 90; i++) {                          // damp streaks
    const sx = Math.random() * S, w = 2 + Math.random() * 9;
    x.fillStyle = `rgba(30,32,28,${.05 + Math.random() * .14})`;
    x.fillRect(sx, Math.random() * S * .5, w, S);
  }
  for (let i = 0; i < 300; i++) {                         // grain
    x.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},255,.03)`;
    x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  return c;
}

/* A bare tree, drawn as two crossed panels. Nothing is in leaf out there. */
function genTree() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.clearRect(0, 0, S, S);
  x.strokeStyle = "#221b16"; x.lineCap = "round";
  const limb = (px, py, ang, len, w, d) => {
    if (d > 5 || len < 5) return;
    const qx = px + Math.cos(ang) * len, qy = py + Math.sin(ang) * len;
    x.lineWidth = w;
    x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke();
    limb(qx, qy, ang - .26 - Math.random() * .36, len * .74, w * .64, d + 1);
    limb(qx, qy, ang + .26 + Math.random() * .36, len * .74, w * .64, d + 1);
    if (Math.random() < .3) limb(qx, qy, ang + (Math.random() - .5) * .3, len * .58, w * .5, d + 1);
  };
  limb(S / 2, S - 2, -Math.PI / 2, 60, 16, 0);
  x.globalAlpha = .55;
  for (let i = 0; i < 70; i++) {
    x.lineWidth = 1;
    const bx = S / 2 + (Math.random() - .5) * 150, by = 26 + Math.random() * 130;
    x.beginPath(); x.moveTo(bx, by);
    x.lineTo(bx + (Math.random() - .5) * 24, by - Math.random() * 20); x.stroke();
  }
  return c;
}

/* Wet grass and flagstones, seen by moonlight. */
function genGround() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#1a2118"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {                       // grass
    const gx = Math.random() * S, gy = Math.random() * S;
    const l = 3 + Math.random() * 7;
    x.strokeStyle = `rgba(${40 + Math.random() * 40 | 0},${62 + Math.random() * 48 | 0},${38 + Math.random() * 30 | 0},.5)`;
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (Math.random() - .5) * 3, gy - l); x.stroke();
  }
  for (let i = 0; i < 26; i++) {                         // trodden patches
    const gx = Math.random() * S, gy = Math.random() * S, r = 8 + Math.random() * 26;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, "rgba(30,32,26,.55)"); g.addColorStop(1, "rgba(30,32,26,0)");
    x.fillStyle = g; x.beginPath(); x.arc(gx, gy, r, 0, 7); x.fill();
  }
  return c;
}

/* A chevron for the trail on the floor. Points toward v = 0. */
function genTrail() {
  const S = 128, c = cv(S), x = c.getContext("2d");
  x.clearRect(0, 0, S, S);
  x.lineJoin = "round"; x.lineCap = "round";
  x.strokeStyle = "rgba(255,90,90,.30)"; x.lineWidth = 30;
  x.beginPath(); x.moveTo(16, 92); x.lineTo(64, 34); x.lineTo(112, 92); x.stroke();
  x.strokeStyle = "rgba(255,130,130,.95)"; x.lineWidth = 15;
  x.beginPath(); x.moveTo(20, 88); x.lineTo(64, 40); x.lineTo(108, 88); x.stroke();
  x.strokeStyle = "rgba(255,225,225,.95)"; x.lineWidth = 5;
  x.beginPath(); x.moveTo(24, 84); x.lineTo(64, 45); x.lineTo(104, 84); x.stroke();
  return c;
}
function genButton(live) {
  const S = 128, c = cv(S), x = c.getContext("2d");
  x.fillStyle = live ? "#1d2a20" : "#22201c"; x.fillRect(14, 10, 100, 108);
  x.strokeStyle = "#0a0c0a"; x.lineWidth = 6; x.strokeRect(14, 10, 100, 108);
  x.fillStyle = live ? "#39d16a" : "#4a4640";
  x.beginPath(); x.arc(64, 56, 30, 0, TAU); x.fill();
  x.strokeStyle = "#0a0c0a"; x.lineWidth = 5; x.stroke();
  x.fillStyle = live ? "#08160c" : "#2a2724";
  x.beginPath(); x.moveTo(52, 48); x.lineTo(60, 48); x.lineTo(70, 40);
  x.lineTo(70, 72); x.lineTo(60, 64); x.lineTo(52, 64); x.closePath(); x.fill();
  x.strokeStyle = live ? "#08160c" : "#2a2724"; x.lineWidth = 5;
  x.beginPath(); x.moveTo(76, 44); x.lineTo(92, 68); x.stroke();
  x.fillStyle = live ? "#bff5cf" : "#6d675e";
  x.font = "bold 15px monospace"; x.textAlign = "center";
  x.fillText(live ? "MUTE" : "DONE", 64, 104);
  return c;
}
function genRocket() {
  const c = cv(64, 32), x = c.getContext("2d");
  x.fillStyle = "#7a3626"; x.fillRect(16, 10, 30, 12);
  x.beginPath(); x.moveTo(8, 16); x.lineTo(18, 8); x.lineTo(18, 24); x.closePath();
  x.fillStyle = "#5e281c"; x.fill();
  x.fillStyle = "#c8b45a"; x.fillRect(42, 10, 5, 12);
  x.fillStyle = "#3a4232"; x.fillRect(46, 8, 8, 16);
  const g = x.createRadialGradient(58, 16, 1, 58, 16, 10);
  g.addColorStop(0, "#fff6c8"); g.addColorStop(.5, "rgba(255,150,40,.8)"); g.addColorStop(1, "rgba(255,90,0,0)");
  x.fillStyle = g; x.fillRect(48, 4, 16, 24);
  return c;
}
function genBezel() {
  const c = cv(64, 128), x = c.getContext("2d");
  x.fillStyle = "#0b0d11"; x.fillRect(0, 0, 64, 128);
  x.strokeStyle = "#2a3038"; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 61, 125);
  x.fillStyle = "#39d6ff"; x.fillRect(27, 121, 10, 2);
  return c;
}
function genExit() {
  const S = 256, c = cv(S), x = c.getContext("2d");
  x.fillStyle = "#1d1a0f"; x.fillRect(26, 20, 204, 236);
  x.fillStyle = "#070603"; x.fillRect(42, 38, 172, 218);
  x.strokeStyle = "#080703"; x.lineWidth = 8; x.strokeRect(26, 20, 204, 236);
  x.fillStyle = "#0c3d13"; x.fillRect(54, 48, 148, 48);
  x.strokeStyle = "#051a07"; x.lineWidth = 4; x.strokeRect(54, 48, 148, 48);
  x.fillStyle = "#8dff9a"; x.font = "bold 36px monospace"; x.textAlign = "center"; x.fillText("EXIT", 128, 84);
  x.fillStyle = "rgba(140,255,150,.18)";
  x.beginPath(); x.moveTo(54, 96); x.lineTo(202, 96); x.lineTo(236, 256); x.lineTo(20, 256); x.fill();
  return c;
}

/* ------------------------------- audio ------------------------------ */
const Snd = {
  ctx: null, master: null, started: false, beatT: 0,
  init() {
    if (this.started) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    this.master = this.ctx.createGain(); this.master.gain.value = .85;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this.hum();
    this.loadSteps();
  },
  noiseBuf(secs) {
    const c = this.ctx, len = Math.ceil(c.sampleRate * secs);
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  hum() {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = .022; g.connect(this.master);
    // No tonal drone. A pair of sines at 60 and 120Hz ran for the whole
    // session and read as a hum over everything else. Just quiet room air now.
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(2); s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 1.4;
    const ng = c.createGain(); ng.gain.value = .030;
    s.connect(bp); bp.connect(ng); ng.connect(g); s.start();

  },
  setDread() {},                       // the drone is gone; the heartbeat carries it
  tone(dur, f, type, vol, sweep) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type || "square"; o.frequency.value = f;
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, f, vol, type) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const len = Math.ceil(c.sampleRate * dur);
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const s = c.createBufferSource(); s.buffer = b;
    const fl = c.createBiquadFilter(); fl.type = type || "lowpass"; fl.frequency.value = f;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t);
  },
  /* A gunshot is a transient, a body and a room. One noise burst had all
     three smeared together, which is why they sounded like static. */
  gun(kind) {
    if (!this.started) return;
    const c = this.ctx;
    const later = (ms, fn) => setTimeout(fn, ms);
    if (kind === "rpg") {
      this.noise(.09, 2600, .40, "highpass");        // launch crack
      this.noise(.75, 420, .70);                     // the shove of gas
      this.tone(.60, 66, "sawtooth", .40, 28);
      later(90, () => this.noise(.55, 240, .34));    // room
      return;
    }
    if (kind === "sniper") {
      this.noise(.035, 5200, .85, "highpass");       // supersonic crack
      this.noise(.30, 1100, .60);
      this.tone(.34, 96, "sawtooth", .40, 30);
      later(70, () => this.noise(.42, 700, .28));    // slapback off the walls
      later(190, () => this.noise(.55, 380, .16));
      return;
    }
    if (kind === "mg") {
      const j = rand(.94, 1.07);                     // never twice the same
      this.noise(.020, 3600 * j, .34, "highpass");   // action
      this.noise(.13, 1100 * j, .50);                // heavier powder than an SMG
      this.noise(.16, 150 * j, .34);                 // the weight behind it
      later(50, () => this.noise(.22, 620, .16));    // roll off the walls
      return;
    }
    this.noise(.025, 4600, .52, "highpass");         // pistol: firing pin
    this.noise(.16, 1400, .52);                      // powder
    this.tone(.13, 150, "sawtooth", .34, 38);        // body
    later(55, () => this.noise(.26, 620, .20));      // the room answering
  },
  shot() { this.gun("pistol"); },
  dry() { this.noise(.03, 5200, .12, "highpass"); },
  reload() {
    this.noise(.035, 1500, .13);                    // magazine out
    setTimeout(() => this.noise(.045, 800, .13), 330);   // fresh one in
    setTimeout(() => this.noise(.035, 2600, .14, "highpass"), 760);   // slide
  },
  hit() { this.noise(.045, 3200, .14, "highpass"); },
  head() { this.noise(.05, 6000, .20, "highpass"); setTimeout(() => this.noise(.07, 2200, .10, "highpass"), 25); },
  kill() { this.noise(.16, 520, .22); setTimeout(() => this.noise(.22, 190, .16), 40); },
  hurt() { this.noise(.32, 420, .45); this.noise(.26, 130, .30); },
  pickup() { this.noise(.05, 4200, .13, "highpass"); setTimeout(() => this.noise(.08, 2000, .09, "highpass"), 55); },
  boss() { this.tone(.95, 88, "sawtooth", .32, 40); this.noise(.85, 300, .3); },
  /* Real recorded footsteps, five takes per surface, loaded once. Synthesised
     ones never stopped sounding like a synthesiser. */
  steps: { wood: [], stone: [], grass: [] },
  loadSteps() {
    for (const surf of ["wood", "stone", "grass"]) {
      for (let i = 0; i < 5; i++) {
        fetch(`sfx/step_${surf}_${i}.wav`)
          .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
          .then(b => this.ctx.decodeAudioData(b))
          .then(buf => this.steps[surf].push(buf))
          .catch(() => {});
      }
    }
  },
  step(surface, run) {
    if (!this.started) return;
    const bank = this.steps[surface] || this.steps.wood;
    if (!bank.length) return;                        // still loading
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = bank[Math.floor(Math.random() * bank.length)];
    src.playbackRate.value = rand(.92, 1.09);        // never twice the same
    const g = c.createGain();
    g.gain.value = (run ? .52 : .34) * rand(.85, 1.12);
    src.connect(g); g.connect(this.master);
    src.start();
  },
  /* The house settling around you. No timber groan -- it read as a creak
     under every footstep and there was no telling the two apart. */
  creak() {
    if (!this.started) return;
    this.noise(rand(.25, .5), rand(90, 150), .05);   // a settle, low and dull
  },
  thud() {
    if (!this.started) return;
    this.noise(.22, 190, .13);
    this.noise(.34, 70, .15);
  },
  gust() { if (this.started) this.noise(rand(1.4, 2.6), rand(280, 620), .075); },

};

/* ---------------------------- the voice ----------------------------- */
/* The clip's own audio, decoded once. It rides the wall screens, swelling as
   a character closes on you and cutting to nothing while a mute is running. */

/* Per-character voice lines, [start, end] in the clip. Played the first time
   you lay eyes on one. Left null until the timestamps are confirmed. */
const NAME_CLIP = {
  iguana: null, hermit: null, termite: null,
  creativecrab: null, giant: null, garyvee: null,
};
let nameClipT = 0;

const Voice = {
  buf: null, loading: false,
  async load() {
    if (this.buf || this.loading || !Snd.started) return;
    this.loading = true;
    try {
      const res = await fetch("assets/video/screen.m4a?v=" + MEDIA_V);
      this.buf = await Snd.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { console.warn("voice audio unavailable", e); }
    this.loading = false;
  },
  bite(from, to, vol) {
    if (!this.buf || !Snd.started) return;
    // a mute silences everything from the clip, one-shots included
    if (G.quietT > 0) return;
    const src = Snd.ctx.createBufferSource();
    src.buffer = this.buf;
    const g = Snd.ctx.createGain(); g.gain.value = vol === undefined ? .75 : vol;
    src.connect(g); g.connect(Snd.master);
    const len = Math.max(.08, to - from);
    src.start(0, clamp(from, 0, this.buf.duration - .05), len);
  },
};

/* The wall screens carry the sound. Routing the video element itself
   through the mixer means what you hear is exactly what is on the walls -
   a separate copy of the audio could never stay in sync. It fades up when
   something is near you and sits silent when the house is empty. */
let videoSrcNode = null, videoGain = null;

function attachVideoAudio() {
  if (!Snd.started || !videoEl || videoSrcNode) return;
  try {
    videoEl.muted = false;
    videoEl.volume = 1;
    videoSrcNode = Snd.ctx.createMediaElementSource(videoEl);
    videoGain = Snd.ctx.createGain();
    videoGain.gain.value = 0;
    videoSrcNode.connect(videoGain);
    videoGain.connect(Snd.master);
  } catch (e) { console.warn("video audio unavailable", e); }
}

const EARSHOT = 22;
function tickVideoAudio(dt) {
  attachVideoAudio();
  // Chrome starts the context suspended; without this nothing is ever audible
  if (Snd.ctx && Snd.ctx.state !== "running") Snd.ctx.resume().catch(() => {});
  if (!videoGain) return;
  let best = 0;
  if (G.state === "play" && G.quietT <= 0) {
    for (const e of enemies) {
      if (e.dead) continue;
      // e.dist is flat ground distance -- it does not know about storeys, so
      // something stood on the floor directly above read as one metre away and
      // held the clip wide open with nothing in the room. Separate the storeys.
      const dy = (e.f - P.f) * W.STOREY;
      const d3 = Math.hypot(e.dist, dy);
      if (d3 > EARSHOT) continue;
      // Falls all the way to zero at the edge of earshot - no floor value,
      // or anything in the same room keeps it half up forever.
      const k = clamp(1 - (d3 - 1.5) / EARSHOT, 0, 1);
      const v = e.los ? k * k                                  // seen: full
        : e.f === P.f ? (e.dist < 10 ? .30 * k * k : 0)        // same floor, through a wall
        : (d3 < 7 ? .10 * k * k : 0);                          // a storey away: barely
      if (v > best) best = v;
    }
  }
  if (best < .02) best = 0;                    // silence, not a whisper
  // snap up quickly when something appears, ease back down slowly
  const rate = best > videoGain.gain.value ? .0004 : .16;
  videoGain.gain.value = lerp(videoGain.gain.value, best, 1 - Math.pow(rate, dt));
}

/* --------------------------- map generation ------------------------- */


/* ============================ the world =============================
   All world state now lives in world.js as real stacked storeys. These
   are the floor-aware wrappers the rest of the game talks to.
   ==================================================================== */
const STOREY = W.STOREY;
const STEP_UP = W.STEP_UP;
const idx = (x, y) => y * MAPW + x;
const centerOf = (cx, cy) => W.centerOf(cx, cy);
const cellAt = (wx, wz) => W.cellAt(wx, wz);
const solid = (f, x, y) => W.solid(f, x, y);
const isDoor = (f, x, y) => W.isDoor(f, x, y);
const groundAt = (x, z, f) => W.groundY(x, z, f);
const floorOfY = y => W.floorOfY(y);

let props = [], propBins = null, screens = [], lights = [], buttons = [];
let lightBins = null, lbW = 0, lbH = 0;
let pools = [], shafts = [];

function roomsOn(f) { return W.rooms[f] || []; }
function roomAt(wx, wz, f) {
  const [cx, cy] = cellAt(wx, wz);
  for (const r of roomsOn(f)) if (cx >= r.x0 && cx < r.x1 && cy >= r.y0 && cy < r.y1) return r;
  return null;
}

/* ---------------------------- furniture ----------------------------- */
const propBufs = {};
function loadProps() {
  for (const k of Object.keys(PROP_BUILDERS)) {
    const b = PROP_BUILDERS[k]();
    propBufs[k] = { buf: b.mesh.toBuffers(gl), r: b.r, h: b.h || 0 };
  }
}
function eachPropNear(x, z, f, fn) {
  if (!propBins) return;
  const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
    const bin = propBins[f] && propBins[f][idx(nx, ny)];
    if (bin) for (const p of bin) fn(p);
  }
}
function propBlocked(x, z, f, r, feetY) {
  let hit = false;
  eachPropNear(x, z, f, p => {
    if (hit || p.r <= 0 || !p.h) return;
    if (feetY !== undefined && feetY >= p.y + p.h - STEP_UP) return;
    const want = p.r + r;
    if ((x - p.x) ** 2 + (z - p.z) ** 2 < want * want) hit = true;
  });
  return hit;
}
function propTop(x, z, f, feetY) {
  let best = -1e9;
  eachPropNear(x, z, f, p => {
    if (p.r <= 0 || !p.h) return;
    const top = p.y + p.h;
    if (top > feetY + STEP_UP) return;
    // Must match propBlocked's radius. It used p.r alone, leaving a ring
    // around every prop where you were neither stopped nor supported --
    // step onto a table edge and you dropped straight through it.
    const want = p.r + PRAD;
    if ((x - p.x) ** 2 + (z - p.z) ** 2 < want * want && top > best) best = top;
  });
  return best;
}
function standHeight(x, z, f, feetY) {
  const g = groundAt(x, z, f);
  const t = propTop(x, z, f, Math.max(feetY, g));
  return t > g ? t : g;
}

/* ---------------------------- collision ----------------------------- */
function blocked(x, z, f, r, feetY, ignoreProps) {
  for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
    const cx = Math.floor((x + ox) / CELL), cy = Math.floor((z + oz) / CELL);
    if (solid(f, cx, cy)) return true;
  }
  if (ignoreProps) return false;
  return propBlocked(x, z, f, r, feetY);
}
function slide(e, dx, dz, f, r, feetY, ignoreProps) {
  if (!blocked(e.x + dx, e.z, f, r, feetY, ignoreProps)) e.x += dx;
  if (!blocked(e.x, e.z + dz, f, r, feetY, ignoreProps)) e.z += dz;
}
function rayWall(f, ox, oz, dx, dz, max) {
  let x = Math.floor(ox / CELL), y = Math.floor(oz / CELL);
  const sx = dx > 0 ? 1 : -1, sy = dz > 0 ? 1 : -1;
  const dtx = Math.abs(CELL / (dx || 1e-9)), dty = Math.abs(CELL / (dz || 1e-9));
  let tx = (dx > 0 ? (x + 1) * CELL - ox : ox - x * CELL) / Math.abs(dx || 1e-9);
  let ty = (dz > 0 ? (y + 1) * CELL - oz : oz - y * CELL) / Math.abs(dz || 1e-9);
  let t = 0;
  for (let i = 0; i < 260; i++) {
    if (tx < ty) { t = tx; tx += dtx; x += sx; } else { t = ty; ty += dty; y += sy; }
    if (t > max) return max;
    if (solid(f, x, y)) return t;
  }
  return max;
}
function hasLOS(f, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < .001) return true;
  return rayWall(f, ax, az, dx / d, dz / d, d) >= d - .02;
}

/* ------------------- pathing, across storeys --------------------------
   One BFS from the player over every cell on every floor, stepping
   through shafts as well as doorways. That is what lets them hunt you
   upstairs instead of milling about below you.                         */
let flow = [];
function refreshFlow() {
  const F = W.FLOORS;
  flow = [];
  for (let f = 0; f < F; f++) flow.push(new Int32Array(MAPW * MAPH).fill(-1));
  // A flight was linked across storeys at EVERY one of its cells, so the
  // search thought you could change floor anywhere along it for one step --
  // it under-costs the stairs badly and picks routes that hop up mid-flight.
  // You actually arrive on the storey above at the head of the flight, so
  // that is the only cell that links.
  const link = flowLink = new Map();
  for (const s of W.shafts) {
    const top = s.cells[s.cells.length - 1];
    link.set(s.f + ":" + idx(top.x, top.y), s.to);
    link.set(s.to + ":" + idx(top.x, top.y), s.f);
  }
  const [px, py] = cellAt(P.x, P.z);
  if (solid(P.f, px, py)) return;
  const q = [[P.f, px, py]];
  flow[P.f][idx(px, py)] = 0;
  let head = 0;
  while (head < q.length) {
    const [f, x, y] = q[head++], d = flow[f][idx(x, y)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
      if (solid(f, nx, ny) || flow[f][idx(nx, ny)] >= 0) continue;
      flow[f][idx(nx, ny)] = d + 1; q.push([f, nx, ny]);
    }
    const other = link.get(f + ":" + idx(x, y));
    if (other !== undefined && flow[other][idx(x, y)] < 0) {
      flow[other][idx(x, y)] = d + 1; q.push([other, x, y]);
    }
  }
}
/* The flow field holds the step distance from the player to every cell in
   the building. Walking DOWN it from a target reconstructs the route the
   player has to take, corners, stairs and all -- which is what the waypoint
   should follow. A straight bearing just points into walls. */
function routePath(tf, tx, ty) {
  if (!flow[tf] || solid(tf, tx, ty)) return null;
  let d = flow[tf][idx(tx, ty)];
  if (d < 0) return null;
  let f = tf, x = tx, y = ty;
  const back = [[f, x, y]];
  let guard = 0;
  while (d > 0 && guard++ < 5000) {
    let nf = -1, nx = 0, ny = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = x + dx, ay = y + dy;
      if (ax < 0 || ay < 0 || ax >= MAPW || ay >= MAPH) continue;
      if (solid(f, ax, ay)) continue;
      if (flow[f][idx(ax, ay)] === d - 1) { nf = f; nx = ax; ny = ay; break; }
    }
    if (nf < 0) {
      const other = flowLink.get(f + ":" + idx(x, y));
      if (other !== undefined && flow[other][idx(x, y)] === d - 1) { nf = other; nx = x; ny = y; }
    }
    if (nf < 0) break;
    f = nf; x = nx; y = ny; d--;
    back.push([f, x, y]);
  }
  back.reverse();                      // now it reads player -> target
  return back;
}

/* The cell path is shortest in GRID steps, which staircases along the axes
   instead of cutting the corner -- so it is not the shortest way to walk it.
   Pull the string tight: keep only the turns you actually need, by dropping
   any waypoint you can already see past. */
function smoothRoute(path) {
  const pts = [];
  for (const [f, x, y] of path) {
    const [wx, wz] = centerOf(x, y);
    pts.push({ f, x: wx, z: wz });
  }
  // hasLOS is a hairline ray, so it will happily cut a corner you cannot
  // actually fit through -- the trail clipped door jambs and shoved you off
  // the line it had just drawn. Walk the candidate with your real width.
  const walkable = (f, ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(d / .34));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (blocked(x, z, f, PRAD + .06, groundAt(x, z, f), true)) return false;
    }
    return true;
  };
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    for (let k = i + 2; k < pts.length; k++) {
      if (pts[k].f !== pts[i].f) break;                 // never smooth across a storey
      if (!walkable(pts[i].f, pts[i].x, pts[i].z, pts[k].x, pts[k].z)) break;
      j = k;
    }
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/* How far you actually have to walk it, climbs included -- the straight line
   through three floors of house is not a distance that means anything. */
function routeMetres(path) {
  let m = 0;
  for (let i = 1; i < path.length; i++) {
    const [f0, x0, y0] = path[i - 1], [f1, x1, y1] = path[i];
    const [ax, az] = centerOf(x0, y0), [bx, bz] = centerOf(x1, y1);
    const ay = groundAt(ax, az, f0), by = groundAt(bx, bz, f1);
    m += Math.hypot(bx - ax, bz - az, by - ay);
  }
  return m;
}

/* Aim at the furthest point of the route still in plain sight, so the arrow
   leads you round the corner instead of jittering cell to cell. */
function routeAim(lb) {
  const [tx, ty] = cellAt(lb.x, lb.z);
  const path = routePath(lb.f, tx, ty);
  if (!path || path.length < 2) return null;
  let step = path[1], climb = 0;
  for (let i = 1; i < Math.min(path.length, 22); i++) {
    const [f, x, y] = path[i];
    if (f !== P.f) { climb = f > P.f ? 1 : -1; break; }
    const [wx2, wz2] = centerOf(x, y);
    if (!hasLOS(P.f, P.x, P.z, wx2, wz2)) break;
    step = path[i];
  }
  const [wx, wz] = centerOf(step[1], step[2]);
  return { x: wx, z: wz, y: groundAt(wx, wz, step[0]) + 1.05, f: step[0], climb,
    metres: routeMetres(path) };
}

function flowStep(e) {
  const [cx, cy] = cellAt(e.x, e.z);
  const f = e.f;
  // A staircase exists on both storeys, and an enemy's floor comes from its
  // height, so halfway up it was reading the wrong field: on the upper storey
  // the flight's distances INCREASE going down, so anything that got to the
  // top could never work out how to come back. On stairs, take the best of
  // both storeys and the gradient runs continuously through the transition.
  const onStair = W.shaftAt[f] && W.shaftAt[f][idx(cx, cy)];
  const other = onStair
    ? (f > 0 && W.shaftAt[f - 1] && W.shaftAt[f - 1][idx(cx, cy)] ? f - 1
      : f < W.FLOORS - 1 ? f + 1 : -1)
    : -1;
  let best = null, bv = 1e9;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = cx + dx, ny = cy + dy;
    let v = 1e9;
    if (!solid(f, nx, ny) && flow[f] && flow[f][idx(nx, ny)] >= 0) v = flow[f][idx(nx, ny)];
    if (other >= 0 && !solid(other, nx, ny) && flow[other] && flow[other][idx(nx, ny)] >= 0)
      v = Math.min(v, flow[other][idx(nx, ny)]);
    if (v < bv) { bv = v; best = [nx, ny]; }
  }
  if (!best) return [P.x - e.x, P.z - e.z];
  const [tx, tz] = centerOf(best[0], best[1]);
  return [tx - e.x, tz - e.z];
}

/* A spot on any floor you cannot currently see. */
function spawnSpot(minDist, allowOutside) {
  for (let tries = 0; tries < 90; tries++) {
    const f = randi(W.FLOORS);
    const x = 1 + randi(MAPW - 2), y = 1 + randi(MAPH - 2);
    if (W.grid[f][idx(x, y)] !== 0) continue;
    // the grounds stay empty; crates strewn over the lawn spoil the place
    if (!allowOutside && W.isOutside(f, x, y)) continue;
    const [wx, wz] = centerOf(x, y);
    if (blocked(wx, wz, f, .5)) continue;
    const d = Math.hypot(wx - P.x, wz - P.z);
    if (f === P.f) {
      if (d < minDist) continue;
      if (d < 30 && hasLOS(f, wx, wz, P.x, P.z)) continue;
    }
    return [wx, wz, f];
  }
  return null;
}

/* ---------------------------- lighting ------------------------------ */
const LBUCKET = 18;
function indexLights() {
  lbW = Math.ceil(MAPW * CELL / LBUCKET) + 1;
  lbH = Math.ceil(MAPH * CELL / LBUCKET) + 1;
  lightBins = [];
  for (let f = 0; f < W.FLOORS; f++)
    lightBins.push(Array.from({ length: lbW * lbH }, () => []));
  for (const L of lights) {
    const bx = Math.floor(L.x / LBUCKET), by = Math.floor(L.z / LBUCKET);
    const rad = Math.ceil(L.r / LBUCKET);
    for (let j = by - rad; j <= by + rad; j++) for (let i = bx - rad; i <= bx + rad; i++)
      if (i >= 0 && j >= 0 && i < lbW && j < lbH) lightBins[L.f][j * lbW + i].push(L);
  }
}
function lightAt(x, y, z, f) {
  let s = ZONES[Math.min(f, ZONES.length - 1)].amb;
  // The garden has no lamps in it, just a bit of moon, so the house reads as
  // the lit thing and the night presses in around it.
  if (W.isOutside(f, Math.floor(x / CELL), Math.floor(z / CELL)))
    s = .62 + Math.min(.34, y * .015);          // moon falls from above
  const bins = lightBins && lightBins[f];
  if (bins) {
    const bx = Math.floor(x / LBUCKET), by = Math.floor(z / LBUCKET);
    if (bx >= 0 && by >= 0 && bx < lbW && by < lbH) {
      for (const L of bins[by * lbW + bx]) {
        const dx = x - L.x, dz = z - L.z, dy = y - L.y;
        const d2 = dx * dx + dz * dz + dy * dy;
        if (d2 > L.r * L.r) continue;
        const k = 1 - Math.sqrt(d2) / L.r;
        s += L.i * k * k;
      }
    }
  }
  return Math.min(s, 1.55);
}

/* ----------------------------- entities ----------------------------- */
function spawnEnemy(kind, x, z, f) {
  const k = KINDS[kind];
  f = f === undefined ? P.f : f;
  const e = {
    kind, k, x, z, f, hp: k.hp, max: k.hp, h: k.h, rad2: k.rad * k.rad,
    y: groundAt(x, z, f),
    cd: rand(0, k.rate), atk: 0, atkAnim: 0, hurt: 0, dead: false, deadT: 0,
    walk: rand(0, 9), seed: rand(0, 99), shell: 0, shellCd: rand(2, 5),
    strafeDir: Math.random() < .5 ? 1 : -1, strafeT: 0, spawnT: .5,
    los: false, dist: 99, mirror: false, growlT: rand(1, 6), lit: 1,
  };
  enemies.push(e);
  return e;
}

/* A no-characters walkthrough, for looking at the house itself:
   http://127.0.0.1:8731/index.html?empty=1
   Nothing spawns, nothing hurts you, and the HUD reports which storey you
   are on and your exact height so a screenshot pins down where a problem is. */
const PEACEFUL = new URLSearchParams(location.search).has("empty");

/* ------------------------------ state ------------------------------- */
const G = {
  state: "menu", level: 1, clout: 0, kills: 0, shots: 0, hits: 0,
  runKills: 0, lvlKills: 0, combo: 0, comboT: 0, exitOpen: false, boss: null,
  time: 0, spawnT: 0, garyT: 0, giantT: 0, garyCount: 0, dropT: 0,
  buttonIdx: 0, quietT: 0,        // which button is live, and the hush timer
};
/* Difficulty is just how long you have lasted. */
const tier = () => 1 + G.time / 70;

let mgSpin = 0, mgSpinV = 0;      // barrel angle and how fast it is turning
const P = {
  x: 0, y: 0, z: 0, f: 0, vy: 0, onGround: true,
  yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 140, maxhp: 140,
  w: 0, mag: [15, 40, 6, 2], reserve: [108, 234, 36, 11], swapT: 0, ads: 0, adsT: 0,
  reloadT: 0, fireT: 0, bob: 0, recoil: 0,
  flash: 0, hurtT: 0, shake: 0, paint: 0, steps: 0,
  swayX: 0, swayY: 0, lastYaw: 0, lastPitch: 0,
};
let sens = 1.10;
const enemies = [], bullets = [], parts = [], pickups = [], pops = [], rockets = [];
let hitMark = 0, headMark = 0, now = 0;
let flowT = 0, flowLink = new Map();

/* One endless floor. Every species is in the mix from the start; the rate,
   the cap and their health all climb with how long you have survived. */
const POOL = ["giant", "giant", "giant", "hermit", "iguana", "creativecrab"];
const MAX_ALIVE = 32;                 // never more of them in the house than this

function spawnDirector(dt) {
  if (G.state !== "play") return;
  G.time += dt;
  if (PEACEFUL) return;
  const T = tier();
  const alive = enemies.reduce((a, e) => a + (e.dead ? 0 : 1), 0);
  // A hard ceiling. It used to climb to 80, which is not a run you can finish,
  // it is a run that finishes you.
  const cap = Math.min(MAX_ALIVE, 20 + Math.floor(T * 4));

  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    G.spawnT = Math.max(.30, 1.0 / T) * rand(.7, 1.2);
    if (alive < cap) {
      const n = Math.min(cap - alive, 2 + randi(alive < cap * .5 ? 4 : 2));
      for (let i = 0; i < n; i++) {
        const spot = spawnSpot(11, true);
        if (!spot) break;
        const e = spawnEnemy(pick(POOL), spot[0], spot[1], spot[2]);
        e.spawnT = .45;
        e.hp = e.max = Math.round(e.max * (1 + (T - 1) * .3));
      }
    }
  }

  // a Gentle Giant lumbering around at all times, more of them later
  G.giantT -= dt;
  if (G.giantT <= 0) {
    G.giantT = 6;
    const giants = enemies.reduce((a, e) => a + (!e.dead && e.kind === "termite" ? 1 : 0), 0);
    if (giants < Math.min(8, 3 + Math.floor(T * 1.3))) {
      // `rooms` was a single-floor global that no longer exists, so this threw
      // every six seconds: it killed the frame and the big one never spawned
      // except at the very start of a run.
      const big = [];
      for (let bf = 0; bf < W.FLOORS; bf++)
        for (const rm of roomsOn(bf))
          if (!rm.isShaft && (rm.x1 - rm.x0) >= 4 && (rm.y1 - rm.y0) >= 4 && !solid(bf, rm.cx, rm.cy))
            big.push({ rm, f: bf });
      const choice = big.length ? pick(big) : null;
      const spot = choice
        ? [...centerOf(choice.rm.cx, choice.rm.cy), choice.f]
        : spawnSpot(20, true);
      if (spot && Math.hypot(spot[0] - P.x, spot[1] - P.z) > 10) {
        const gg = spawnEnemy("termite", spot[0], spot[1], spot[2]);
        gg.hp = gg.max = Math.round(KINDS.termite.hp * (1 + (T - 1) * .45));
        feed("ABSOLUTE UNIT INCOMING", "#ffd447");
      }
    }
  }

  // keep restocking supplies so a long run does not run dry
  G.dropT = (G.dropT || 0) - dt;
  if (G.dropT <= 0) {
    G.dropT = 16;
    const live = pickups.length;
    if (live < 14) for (let i = 0; i < 2; i++) {
      const spot = spawnSpot(10);
      if (!spot) break;
      pickups.push({ kind: Math.random() < .80 ? "ammo" : "health",
        x: spot[0], y: groundAt(spot[0], spot[1], spot[2]), z: spot[1], f: spot[2], t: rand(0, 6) });
    }
  }

  // and Gary, on a timer, one at a time
  G.garyT -= dt;
  if (G.garyT <= 0 && !G.boss) {
    G.garyT = 999;
    const spot = spawnSpot(20, true);
    if (spot) {
      const g = spawnEnemy("garyvee", spot[0], spot[1], spot[2]);
      g.hp = g.max = Math.round(KINDS.garyvee.hp * (1 + G.garyCount * .30));
      g.phase = 0; g.summonT = 5; g.dashT = 2;
      G.boss = g; G.garyCount++;
      $("bossbar").style.display = "block";
      $("bossname").textContent = "GARY VAYNERCHUK  //  OWNER OF THE HOUSE";
      shout("HE'S HERE!");
      feed("Gary let himself in. Gary is very passionate about you.", "#ff6b6b");
      Snd.boss();
    }
  }
}


/* ------------------- geometry, one pass per storey ------------------- */
let worldVBO, ranges = [];

function emitStairs(push, L, f, x0, z0, h00, h10, h11, h01, UF) {
  const N = 6;
  const alongX = Math.abs((h10 + h11) - (h00 + h01)) >= Math.abs((h01 + h11) - (h00 + h10));
  const A = [], B = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N;
    if (alongX) { A.push(lerp(h00, h10, t)); B.push(lerp(h01, h11, t)); }
    else { A.push(lerp(h00, h01, t)); B.push(lerp(h10, h11, t)); }
  }
  for (let j = 0; j < N; j++) {
    const t0 = j / N, t1 = (j + 1) / N;
    const ha = A[j], hb = B[j], na = A[j + 1], nb = B[j + 1];
    if (alongX) {
      const xa = x0 + t0 * CELL, xb = x0 + t1 * CELL, z1 = z0 + CELL;
      push([xa, ha, z0, xb, ha, z0, xb, hb, z1, xa, hb, z1],
        [xa / UF, z0 / UF, xb / UF, z0 / UF, xb / UF, z1 / UF, xa / UF, z1 / UF],
        [L(xa, ha + .1, z0, f) * .78, L(xb, ha + .1, z0, f) * .78,
         L(xb, hb + .1, z1, f) * .78, L(xa, hb + .1, z1, f) * .78]);
      if (Math.abs(na - ha) > .02)
        push([xb, ha, z0, xb, na, z0, xb, nb, z1, xb, hb, z1],
          [z0 / UF, ha / UF, z0 / UF, na / UF, z1 / UF, nb / UF, z1 / UF, hb / UF],
          [L(xb, ha, z0, f) * .66, L(xb, na, z0, f) * .66,
           L(xb, nb, z1, f) * .66, L(xb, hb, z1, f) * .66]);
    } else {
      const za = z0 + t0 * CELL, zb = z0 + t1 * CELL, x1 = x0 + CELL;
      push([x0, ha, za, x0, ha, zb, x1, hb, zb, x1, hb, za],
        [x0 / UF, za / UF, x0 / UF, zb / UF, x1 / UF, zb / UF, x1 / UF, za / UF],
        [L(x0, ha + .1, za, f) * .78, L(x0, ha + .1, zb, f) * .78,
         L(x1, hb + .1, zb, f) * .78, L(x1, hb + .1, za, f) * .78]);
      if (Math.abs(na - ha) > .02)
        push([x0, ha, zb, x0, na, zb, x1, nb, zb, x1, hb, zb],
          [x0 / UF, ha / UF, x0 / UF, na / UF, x1 / UF, nb / UF, x1 / UF, hb / UF],
          [L(x0, ha, zb, f) * .66, L(x0, na, zb, f) * .66,
           L(x1, nb, zb, f) * .66, L(x1, hb, zb, f) * .66]);
    }
  }
}

function buildWorld() {
  // Batched by surface rather than by storey, so each room can wear its own
  // wallpaper and floor. One bucket per texture, concatenated at the end.
  const buckets = new Map();
  let cur = null;
  const into = (t, i) => {
    const k = t + ":" + (i | 0);
    let b = buckets.get(k);
    if (!b) { b = { tex: { t, i: i | 0 }, arr: [] }; buckets.set(k, b); }
    cur = b.arr;
  };
  into("floor", 0);
  const push = (p, uv, sh) => {
    for (let i = 0; i < 6; i++) {
      const k = [0, 1, 2, 0, 2, 3][i];
      cur.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], uv[k * 2], uv[k * 2 + 1], sh[k]);
    }
  };
  const L = (x, y, z, f) => lightAt(x, y, z, f);
  const UF = 2.6, UT = CELL / 1.8;
  ranges = [];

  // a shaft punches through the ceiling below it, so you can see up
  const shaftCell = [], shaftUpper = [];
  for (let f = 0; f < W.FLOORS; f++) {
    shaftCell.push(new Uint8Array(MAPW * MAPH));
    shaftUpper.push(new Uint8Array(MAPW * MAPH));
  }
  for (const sh of W.shafts) for (const c of sh.cells) {
    shaftCell[sh.f][idx(c.x, c.y)] = 1;     // the flight punches through here
    shaftUpper[sh.to][idx(c.x, c.y)] = 1;   // the storey above only sees a hole
  }

  for (let f = 0; f < W.FLOORS; f++) {
    // ---- floor ----
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      if (solid(f, x, y)) continue;
      if (W.isOutside(f, x, y)) continue;          // the garden is a pass of its own
      if (shaftUpper[f][idx(x, y)]) continue;      // the flight is drawn by the storey below
      into("floor", W.shaftAt[f][idx(x, y)] ? 2 : skinOf(f, x, y)[1]);
      const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      const h00 = W.corner(f, x, y, 0), h10 = W.corner(f, x, y, 1);
      const h11 = W.corner(f, x, y, 2), h01 = W.corner(f, x, y, 3);
      const spread = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
      if (spread < .30) {
        push([x0, h00, z0, x1, h10, z0, x1, h11, z1, x0, h01, z1],
          [x0 / UF, z0 / UF, x1 / UF, z0 / UF, x1 / UF, z1 / UF, x0 / UF, z1 / UF],
          [L(x0, h00 + .1, z0, f) * .78, L(x1, h10 + .1, z0, f) * .78,
           L(x1, h11 + .1, z1, f) * .78, L(x0, h01 + .1, z1, f) * .78]);
      } else emitStairs(push, L, f, x0, z0, h00, h10, h11, h01, UF);
    }
    // ---- ceiling ----
    into("ceil", Math.min(f, 2));
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      if (solid(f, x, y) || lightGrid[f][idx(x, y)] || shaftCell[f][idx(x, y)]) continue;
      if (W.isOutside(f, x, y)) continue;          // open sky over the garden
      const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      const b = W.baseY(f) + WALLH;
      push([x0, b, z1, x1, b, z1, x1, b, z0, x0, b, z0],
        [x0 / CELL, z1 / CELL, x1 / CELL, z1 / CELL, x1 / CELL, z0 / CELL, x0 / CELL, z0 / CELL],
        [L(x0, b - .3, z1, f), L(x1, b - .3, z1, f), L(x1, b - .3, z0, f), L(x0, b - .3, z0, f)]);
      // Where the ceiling is cut open for a stairwell the cut edge had no face,
      // so from below the ceiling read as a slab of floating paper. Close it
      // with a reveal running up to the floor of the storey above.
      const top = W.baseY(f) + W.STOREY;
      const reveal = (ax, az, bx, bz, k) =>
        push([ax, b, az, bx, b, bz, bx, top, bz, ax, top, az],
          [0, 1, CELL / 1.8, 1, CELL / 1.8, 0, 0, 0],
          [L(ax, b, az, f) * k, L(bx, b, bz, f) * k,
           L(bx, top, bz, f) * k, L(ax, top, az, f) * k]);
      if (shaftCell[f][idx(x, y - 1)]) reveal(x1, z0, x0, z0, .92);
      if (shaftCell[f][idx(x, y + 1)]) reveal(x0, z1, x1, z1, .86);
      if (shaftCell[f][idx(x - 1, y)]) reveal(x0, z0, x0, z1, .80);
      if (shaftCell[f][idx(x + 1, y)]) reveal(x1, z1, x1, z0, .76);
    }
    // ---- light fittings ----
    into("panel", 0);
    for (const Lt of lights) {
      if (Lt.f !== f) continue;
      const x0 = Lt.cx * CELL, x1 = x0 + CELL, z0 = Lt.cy * CELL, z1 = z0 + CELL;
      const b = W.baseY(f) + WALLH - .02;
      push([x0, b, z1, x1, b, z1, x1, b, z0, x0, b, z0],
        [0, 1, 1, 1, 1, 0, 0, 0], [1.9, 1.9, 1.9, 1.9]);
    }


    // ---- walls ----

    const face = (ax, az, bx, bz, hA, hB, lo, k, vBot) => {
      const top = W.baseY(f) + W.STOREY;      // through the slab, not just to it
      push([ax, hA + lo, az, bx, hB + lo, bz, bx, top, bz, ax, top, az],
        [0, vBot, UT, vBot, UT, 0, 0, 0],
        [L(ax, hA + lo, az, f) * k, L(bx, hB + lo, bz, f) * k,
         L(bx, top - .4, bz, f) * k, L(ax, top - .4, az, f) * k]);
    };
    // Above the ground floor everything beyond the house is void, so a face
    // is emitted toward it as well -- that is what gives the building an
    // outside you can look at from the garden.
    const H = W.HOUSE;
    const inHouse = (x, y) => x >= H.x0 && x < H.x1 && y >= H.y0 && y < H.y1;
    const isVoid = (x, y) => f > 0 && !inHouse(x, y);
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      const g = W.grid[f][idx(x, y)];
      if (g === 0) continue;
      if (isVoid(x, y)) continue;                  // nothing to draw out in the air
      const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      const door = g === 2, lo = door ? DOORH : 0;
      const vBot = door ? (1 - DOORH / W.STOREY) : 1;
      const win = W.isWindow(f, x, y);
      const open = (nx, ny) => !solid(f, nx, ny) && !W.isOutside(f, nx, ny);
      const h00 = W.corner(f, x, y, 0), h10 = W.corner(f, x, y, 1);
      const h11 = W.corner(f, x, y, 2), h01 = W.corner(f, x, y, 3);
      // A window is a solid cell the renderer leaves a gap in, so you really
      // do see the night through it rather than a picture of it.
      const SILL = 1.05, HEAD = 3.15;
      const band = (ax, az, bx, bz, ya, yb, k) =>
        push([ax, ya, az, bx, ya, bz, bx, yb, bz, ax, yb, az],
          [0, 1, UT, 1, UT, 0, 0, 0],
          [L(ax, ya, az, f) * k, L(bx, ya, bz, f) * k,
           L(bx, yb, bz, f) * k, L(ax, yb, az, f) * k]);
      const wall = (ax, az, bx, bz, hA, hB, k) => {
        if (!win) { face(ax, az, bx, bz, hA, hB, lo, k, vBot); return; }
        const base = W.baseY(f), top = base + W.STOREY;
        band(ax, az, bx, bz, base, base + SILL, k);
        band(ax, az, bx, bz, base + HEAD, top, k);
      };
      const faceSkin = (nx, ny) => into("wall", skinOf(f, nx, ny)[0]);
      if (open(x, y - 1)) { faceSkin(x, y - 1); wall(x0, z0, x1, z0, h00, h10, 1.0); }
      if (open(x, y + 1)) { faceSkin(x, y + 1); wall(x1, z1, x0, z1, h11, h01, .93); }
      if (open(x - 1, y)) { faceSkin(x - 1, y); wall(x0, z1, x0, z0, h01, h00, .85); }
      if (open(x + 1, y)) { faceSkin(x + 1, y); wall(x1, z0, x1, z1, h10, h11, .80); }
      if (door) {
        into("wall", skinOf(f, x, y)[0]);
        const s0 = L(x0 + CELL / 2, h00 + DOORH, z0 + CELL / 2, f) * .6;
        push([x0, h00 + DOORH, z0, x1, h10 + DOORH, z0, x1, h11 + DOORH, z1, x0, h01 + DOORH, z1],
          [0, 0, UT, 0, UT, 1, 0, 1], [s0, s0, s0, s0]);
      }
    }
  }

  // ---- the outside of the house ----
  // Drawn separately from the interior walls so it can be stone rather than
  // wallpaper, and so it can carry the things that make a building read as a
  // building: a plinth, a band at each floor, window surrounds, a cornice
  // and a roof with an overhang.
  {
    into("facade", 0);
    const H = W.HOUSE;
    const UF2 = 3.0;
    const px0 = H.x0 * CELL, px1 = H.x1 * CELL, pz0 = H.y0 * CELL, pz1 = H.y1 * CELL;
    const TOP = W.FLOORS * W.STOREY;

    // one quad of facade, given the two ends of a horizontal run
    const slab = (ax, az, bx, bz, ya, yb, sh, u0, u1) =>
      push([ax, ya, az, bx, ya, bz, bx, yb, bz, ax, yb, az],
        [u0, yb / UF2, u1, yb / UF2, u1, ya / UF2, u0, ya / UF2],
        [sh, sh, sh, sh]);

    // The four faces, each walked cell by cell so windows can be left open.
    const faces = [
      { fx: 0, fz: -1, shade: .96, a: [px0, pz0], b: [px1, pz0], along: "x", edgeY: H.y0 },
      { fx: 0, fz: 1, shade: .74, a: [px1, pz1], b: [px0, pz1], along: "x", edgeY: H.y1 - 1 },
      { fx: -1, fz: 0, shade: .86, a: [px0, pz1], b: [px0, pz0], along: "z", edgeX: H.x0 },
      { fx: 1, fz: 0, shade: .70, a: [px1, pz0], b: [px1, pz1], along: "z", edgeX: H.x1 - 1 },
    ];
    const SILL = 1.05, HEAD = 3.15;
    for (const F of faces) {
      const n = F.along === "x" ? H.x1 - H.x0 : H.y1 - H.y0;
      for (let i = 0; i < n; i++) {
        const gx = F.along === "x" ? H.x0 + i : F.edgeX;
        const gy = F.along === "x" ? F.edgeY : H.y0 + i;
        // world span of this cell along the face, following the face direction
        const t0 = F.along === "x" ? [F.a[0] + (F.a[0] < F.b[0] ? i : -i) * CELL, F.a[1]]
                                   : [F.a[0], F.a[1] + (F.a[1] < F.b[1] ? i : -i) * CELL];
        const step = F.along === "x" ? [(F.a[0] < F.b[0] ? 1 : -1) * CELL, 0]
                                     : [0, (F.a[1] < F.b[1] ? 1 : -1) * CELL];
        const t1 = [t0[0] + step[0], t0[1] + step[1]];
        for (let fl = 0; fl < W.FLOORS; fl++) {
          const base = W.baseY(fl), top = base + W.STOREY;
          const g = W.grid[fl][idx(gx, gy)];
          const isWin = W.isWindow(fl, gx, gy);
          const isDoorCell = g === 2 && fl === 0;
          const u0 = i * (CELL / UF2), u1 = u0 + CELL / UF2;
          if (isWin) {
            // The opening is the full depth of the wall, so it needs jambs, a
            // sill and a lintel or it reads as a hole hacked in the stone.
            const inx = -F.fx * CELL, inz = -F.fz * CELL;          // into the house
            const ix0 = t0[0] + (t1[0] - t0[0]) * .17, iz0 = t0[1] + (t1[1] - t0[1]) * .17;
            const ix1 = t0[0] + (t1[0] - t0[0]) * .83, iz1 = t0[1] + (t1[1] - t0[1]) * .83;
            slab(t0[0], t0[1], ix0, iz0, base, top, F.shade, u0, u0 + .12);      // stone one side
            slab(ix1, iz1, t1[0], t1[1], base, top, F.shade, u1 - .12, u1);      // and the other
            slab(ix0, iz0, ix1, iz1, base, base + SILL, F.shade, u0, u1);        // below the sill
            slab(ix0, iz0, ix1, iz1, base + HEAD, top, F.shade, u0, u1);         // above the head
            const jamb = (jx, jz) =>
              slab(jx, jz, jx + inx, jz + inz, base + SILL, base + HEAD, F.shade * .62, 0, .9);
            jamb(ix0, iz0); jamb(ix1, iz1);                                       // reveals
            const o = .10, sx = F.fx * o, sz = F.fz * o;
            slab(t0[0] + sx, t0[1] + sz, t1[0] + sx, t1[1] + sz, base + SILL - .20, base + SILL, F.shade * 1.55, u0, u1);
            slab(t0[0] + sx, t0[1] + sz, t1[0] + sx, t1[1] + sz, base + HEAD, base + HEAD + .20, F.shade * 1.32, u0, u1);
            // mullion and transom, so it is a window and not a slot
            const oo = .05, ox2 = F.fx * oo, oz2 = F.fz * oo;
            const mx = (ix0 + ix1) / 2, mz = (iz0 + iz1) / 2;
            const dl = Math.hypot(ix1 - ix0, iz1 - iz0) || 1;
            const px2 = (ix1 - ix0) / dl * .06, pz2 = (iz1 - iz0) / dl * .06;
            slab(mx - px2 + ox2, mz - pz2 + oz2, mx + px2 + ox2, mz + pz2 + oz2,
              base + SILL, base + HEAD, F.shade * .40, 0, .12);
            const midY = base + (SILL + HEAD) / 2;
            slab(ix0 + ox2, iz0 + oz2, ix1 + ox2, iz1 + oz2, midY - .05, midY + .05, F.shade * .40, u0, u1);
          } else if (isDoorCell) {
            slab(t0[0], t0[1], t1[0], t1[1], base + DOORH, top, F.shade, u0, u1);
            // a stone doorcase: jambs either side and a lintel over
            const dO = .16, dx3 = F.fx * dO, dz3 = F.fz * dO;
            const jx0 = t0[0] + (t1[0] - t0[0]) * .06, jz0 = t0[1] + (t1[1] - t0[1]) * .06;
            const jx1 = t0[0] + (t1[0] - t0[0]) * .94, jz1 = t0[1] + (t1[1] - t0[1]) * .94;
            slab(t0[0] + dx3, t0[1] + dz3, jx0 + dx3, jz0 + dz3, base, base + DOORH + .3, F.shade * 1.5, 0, .12);
            slab(jx1 + dx3, jz1 + dz3, t1[0] + dx3, t1[1] + dz3, base, base + DOORH + .3, F.shade * 1.5, 0, .12);
            slab(t0[0] + dx3, t0[1] + dz3, t1[0] + dx3, t1[1] + dz3,
              base + DOORH + .3, base + DOORH + .62, F.shade * 1.7, u0, u1);
          } else {
            slab(t0[0], t0[1], t1[0], t1[1], base, top, F.shade, u0, u1);
          }
        }
        // plinth at the bottom and a band at every floor line, standing proud
        const o = .13, sx = F.fx * o, sz = F.fz * o;
        slab(t0[0] + sx, t0[1] + sz, t1[0] + sx, t1[1] + sz, 0, .55, F.shade * 1.18, 0, CELL / UF2);
        for (let fl = 1; fl < W.FLOORS; fl++)
          slab(t0[0] + sx, t0[1] + sz, t1[0] + sx, t1[1] + sz,
            W.baseY(fl) - .30, W.baseY(fl) + .16, F.shade * 1.10, 0, CELL / UF2);
        // cornice
        const o2 = .32, cx2 = F.fx * o2, cz2 = F.fz * o2;
        slab(t0[0] + cx2, t0[1] + cz2, t1[0] + cx2, t1[1] + cz2, TOP - .85, TOP, F.shade * 1.24, 0, CELL / UF2);
      }
    }

    // a hipped roof sitting on the cornice
    const ov = .45, RH = 5.4;
    const ax0 = px0 - ov, ax1 = px1 + ov, az0 = pz0 - ov, az1 = pz1 + ov;
    const mx = (ax0 + ax1) / 2, mz = (az0 + az1) / 2;
    const ridge = Math.min(ax1 - ax0, az1 - az0) * .22;
    const r0 = [mx - ridge, TOP + RH, mz], r1 = [mx + ridge, TOP + RH, mz];
    const eave = TOP + .1;
    const roofQ = (a, b, c, d, sh) =>
      push([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]],
        [0, 3.2, 3.2, 3.2, 3.2, 0, 0, 0], [sh, sh, sh, sh]);
    roofQ([ax0, eave, az0], [ax1, eave, az0], r1, r0, 1.15);          // front pitch
    roofQ([ax1, eave, az1], [ax0, eave, az1], r0, r1, .86);           // back pitch
    roofQ([ax0, eave, az1], [ax0, eave, az0], r0, r0, 1.00);          // west hip
    roofQ([ax1, eave, az0], [ax1, eave, az1], r1, r1, .92);           // east hip
  }

  // ---- the garden, and the roof over the house ----
  {
    into("ground", 0);
    const UG = 3.2;
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      if (!W.isOutside(0, x, y) || solid(0, x, y)) continue;
      const x0 = x * CELL, x1 = x0 + CELL, z0 = y * CELL, z1 = z0 + CELL;
      const h = W.baseY(0);
      push([x0, h, z0, x1, h, z0, x1, h, z1, x0, h, z1],
        [x0 / UG, z0 / UG, x1 / UG, z0 / UG, x1 / UG, z1 / UG, x0 / UG, z1 / UG],
        [L(x0, h + .1, z0, 0) * .85, L(x1, h + .1, z0, 0) * .85,
         L(x1, h + .1, z1, 0) * .85, L(x0, h + .1, z1, 0) * .85]);
    }

    // bare trees standing about on the lawn
    into("tree", 0);
    const H2 = W.HOUSE;
    let tseed = 20260813;
    const rr = () => ((tseed = (tseed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let y = MARGIN; y < MAPH - MARGIN; y++) for (let x = MARGIN; x < MAPW - MARGIN; x++) {
      if (!W.isOutside(0, x, y) || solid(0, x, y)) continue;
      const near = Math.min(Math.abs(x - H2.x0), Math.abs(x - (H2.x1 - 1)),
                            Math.abs(y - H2.y0), Math.abs(y - (H2.y1 - 1)));
      if (near < 2) continue;                       // not right up against the house
      if (rr() > .30) continue;
      const [tx, tz] = centerOf(x, y);
      const jx = tx + (rr() - .5) * 1.3, jz = tz + (rr() - .5) * 1.3;
      const hgt = 7 + rr() * 5, wid = 3.2 + rr() * 2;
      const g0 = W.baseY(0);
      const cross = (ax, az, bx, bz) =>
        push([ax, g0, az, bx, g0, bz, bx, g0 + hgt, bz, ax, g0 + hgt, az],
          [0, 1, 1, 1, 1, 0, 0, 0], [.9, .9, 1.15, 1.15]);
      cross(jx - wid / 2, jz, jx + wid / 2, jz);
      cross(jx, jz - wid / 2, jx, jz + wid / 2);
    }
  }

  const v = [];
  ranges = [];
  for (const b of buckets.values()) {
    if (!b.arr.length) continue;
    ranges.push({ tex: b.tex, start: v.length / 6, count: b.arr.length / 6 });
    for (let i = 0; i < b.arr.length; i++) v.push(b.arr[i]);
  }

  if (!worldVBO) worldVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
}

/* ------------------------- populating the house ---------------------- */
let lightGrid = [];

/* Dealt out rather than drawn at random, so a storey gets a set of distinct
   rooms instead of four sitting rooms and a kitchen. The biggest room on the
   ground floor is always the hall, which is what makes it read as a house.
   Has to run before the lamps, because a room's mood decides its lighting. */
function assignRoomTypes() {
  const area = r => (r.x1 - r.x0) * (r.y1 - r.y0);
  for (let f = 0; f < W.FLOORS; f++) {
    const zi = Math.min(f, ZONE_PROPS.length - 1);
    const pool = ROOM_TYPES.filter(t => t.zones.includes(zi) && !t.big);
    for (let i = pool.length - 1; i > 0; i--) { const j = randi(i + 1); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const grand = ROOM_TYPES.filter(t => t.zones.includes(zi) && t.big);
    const rs = roomsOn(f).filter(r => !r.isShaft).sort((a, b) => area(b) - area(a));
    let gi = 0, pi = 0;
    for (const r of rs) {
      if (gi < grand.length && area(r) >= 20) { r.roomType = grand[gi++]; continue; }
      r.roomType = pool.length ? pool[pi++ % pool.length] : null;
    }
  }
}

function placeLights() {
  lights = [];
  lightGrid = [];
  for (let f = 0; f < W.FLOORS; f++) lightGrid.push(new Uint8Array(MAPW * MAPH));
  for (let f = 0; f < W.FLOORS; f++) {
    const Z = ZONES[Math.min(f, ZONES.length - 1)];
    for (const r of roomsOn(f)) {
      if (Math.random() < Z.dark) continue;
      const mood = r.roomType || {};
      if (mood.dark && Math.random() < 1 - mood.dark) continue;   // some stay unlit
      const gain = mood.dark ? mood.dark : (mood.lamp || 1);
      for (let y = r.y0 + 1; y < r.y1; y += 4) for (let x = r.x0 + 1; x < r.x1; x += 4) {
        if (solid(f, x, y)) continue;
        if (W.shaftAt[f][idx(x, y)]) continue;   // a flight climbs through the ceiling
        const [wx, wz] = centerOf(x, y);
        lights.push({ f, x: wx, z: wz, cx: x, cy: y,
          y: W.baseY(f) + WALLH - .15, r: 11, i: Z.lightI * gain });
        lightGrid[f][idx(x, y)] = 1;
      }
    }
  }
  // Every flight gets a lamp at the foot and at the head. Unlit stairs in a
  // dim house are effectively invisible, which is most of why they were hard
  // to find at all.
  // Every door onto the grounds gets a light over it. Finding the way in
  // across a dark lawn was guesswork otherwise.
  {
    const H = W.HOUSE;
    for (let y = H.y0; y < H.y1; y++) for (let x = H.x0; x < H.x1; x++) {
      if (W.grid[0][idx(x, y)] !== 2) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ox = x + dx, oy = y + dy;
        if (!W.isOutside(0, ox, oy) || solid(0, ox, oy)) continue;
        const [wx, wz] = centerOf(ox, oy);
        lights.push({ f: 0, x: wx, z: wz, cx: ox, cy: oy, y: 3.4, r: 12, i: 1.5 });
      }
    }
  }

  for (const sh of W.shafts) {
    const n = sh.cells.length;
    const ends = [
      [sh.f, sh.cells[0], [sh.cells[0].x - sh.cells[1].x, sh.cells[0].y - sh.cells[1].y]],
      [sh.to, sh.cells[n - 1], [sh.cells[n - 1].x - sh.cells[n - 2].x, sh.cells[n - 1].y - sh.cells[n - 2].y]],
    ];
    for (const [f, c, dir] of ends) {
      // one cell back from the flight, so the fitting hangs over the landing
      // rather than through the middle of the staircase
      const lx = c.x + dir[0], ly = c.y + dir[1];
      if (lx < 0 || ly < 0 || lx >= MAPW || ly >= MAPH) continue;
      if (solid(f, lx, ly) || W.shaftAt[f][idx(lx, ly)]) continue;
      if (lightGrid[f][idx(lx, ly)]) continue;
      const [wx, wz] = centerOf(lx, ly);
      lights.push({ f, x: wx, z: wz, cx: lx, cy: ly,
        y: W.baseY(f) + WALLH - .15, r: 13, i: 1.15 });
      lightGrid[f][idx(lx, ly)] = 1;
    }
  }
  indexLights();
}

function placeProps() {
  props = [];
  propBins = [];
  for (let f = 0; f < W.FLOORS; f++) propBins.push(Array.from({ length: MAPW * MAPH }, () => null));
  const nearDoor = (f, x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (isDoor(f, x + dx, y + dy)) return true;
    return false;
  };
  const inPool = (x, z) => pools.some(pl => x > pl.x0 - .6 && x < pl.x1 + .6 && z > pl.z0 - .6 && z < pl.z1 + .6);
  // nobody keeps a sideboard halfway up the stairs
  const onStairs = (f, x, z) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    return cx >= 0 && cy >= 0 && cx < MAPW && cy < MAPH && !!W.shaftAt[f][idx(cx, cy)];
  };
  const add = (kind, x, z, f, yaw) => {
    if (onStairs(f, x, z)) return null;
    const pb = propBufs[kind];
    const p = { kind, x, z, f, y: groundAt(x, z, f), yaw, r: pb ? pb.r : 0, h: pb ? pb.h : 0 };
    props.push(p);
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    if (cx >= 0 && cy >= 0 && cx < MAPW && cy < MAPH) {
      const i = idx(cx, cy);
      (propBins[f][i] || (propBins[f][i] = [])).push(p);
    }
    return p;
  };

  for (let f = 0; f < W.FLOORS; f++) {
    for (const r of roomsOn(f)) {
      if (r.isShaft) continue;
      const zi = Math.min(f, ZONE_PROPS.length - 1);
      const base = ZONE_PROPS[zi];
      const type = r.roomType || null;
      r.typeName = type ? type.name : null;
      const Z = type ? { floor: type.floor, wall: type.wall, ceiling: base.ceiling, density: base.density } : base;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      if (w < 2 || h < 2) continue;

      const inner = [], edges = [];
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
        if (solid(f, x, y) || isDoor(f, x, y) || nearDoor(f, x, y)) continue;
        const [wx, wz] = centerOf(x, y);
        if (f === W.spawn.f && Math.hypot(wx - P.x, wz - P.z) < 3.2) continue;
        if (inPool(wx, wz)) continue;
        let dir = null;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (solid(f, x + dx, y + dy)) dir = [dx, dy];
        if (dir) edges.push([x, y, dir]); else inner.push([x, y]);
      }
      if (Z.ceiling && w >= 3 && h >= 3 && !solid(f, r.cx, r.cy)) {
        const [cx, cz] = centerOf(r.cx, r.cy);
        const p = add(Z.ceiling, cx, cz, f, 0);
        if (p) { p.y = W.baseY(f) + WALLH; p.r = 0; p.h = 0; }
      }
      const budget = Math.max(2, Math.round(w * h * .24 * Z.density));
      for (let i = 0; i < Math.ceil(budget * .55) && edges.length; i++) {
        const [x, y, [dx, dy]] = edges.splice(randi(edges.length), 1)[0];
        const [wx, wz] = centerOf(x, y);
        add(pick(Z.wall), wx - dx * CELL * .20, wz - dy * CELL * .20, f, Math.atan2(-dx, -dy));
      }
      for (let i = 0; i < Math.floor(budget * .45) && inner.length; i++) {
        const [x, y] = inner.splice(randi(inner.length), 1)[0];
        const [wx, wz] = centerOf(x, y);
        add(pick(Z.floor), wx + rand(-.25, .25), wz + rand(-.25, .25), f, rand(0, TAU));
      }
    }
  }
}

function placeScreens() {
  screens = [];
  const roomScreens = {};          // at least one per room, then thin them out
  const SH = WALLH - .34, SW = SH * (720 / 1280);   // floor to ceiling
  for (let f = 0; f < W.FLOORS; f++) {
    for (let y = 1; y < MAPH - 1; y++) for (let x = 1; x < MAPW - 1; x++) {
      if (W.grid[f][idx(x, y)] !== 1) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
        if (W.grid[f][idx(nx, ny)] !== 0) continue;
        if (W.shaftAt[f][idx(nx, ny)]) continue;   // stairs stay readable
        if (W.isOutside(f, nx, ny)) continue;      // and nobody hangs a screen in the garden
        // Screens on every single wall face buried the wallpaper, the
        // fireplaces and the bookshelves, and the house went back to looking
        // like corridors. Cover about half, so a room still reads as a room.
        const ri2 = W.roomOf[f][idx(nx, ny)];
        const seen2 = ri2 >= 0 ? (roomScreens[f + ":" + ri2] = (roomScreens[f + ":" + ri2] || 0) + 1) : 99;
        if (seen2 > 1 && Math.random() > .46) continue;
        const [wx, wz] = centerOf(x, y);
        const off = CELL / 2 + .10, boff = CELL / 2 + .045;
        screens.push({
          f, x: wx + dx * off, z: wz + dy * off,
          bx: wx + dx * boff, bz: wz + dy * boff,
          nx: dx, nz: dy, w: SW, h: SH,
          y0: (() => { const [ox, oz] = centerOf(nx, ny); return groundAt(ox, oz, f) + .17; })(),
        });
      }
    }
  }
}

/* One button per storey. Reach it, press it, and the house goes quiet. */
const MUTES = 5;
function placeButtons() {
  buttons = [];
  // Each mute is placed as far from the previous one as the house allows, with
  // a heavy bonus for changing storey. Picking at random put two of them a few
  // rooms apart, which made the run short and dull.
  const cands = [];
  for (let f = 0; f < W.FLOORS; f++)
    for (const r of roomsOn(f))
      // Pruning fills in rooms it cannot reach but leaves the room record
      // behind, so a mute could be placed inside solid rock.
      if (!r.isShaft && (r.x1 - r.x0) >= 3 && (r.y1 - r.y0) >= 3 && !solid(f, r.cx, r.cy)) {
        const [wx, wz] = centerOf(r.cx, r.cy);
        cands.push({ f, x: wx, z: wz, room: r });
      }
  if (!cands.length) return;

  const cost = (a, b) =>
    Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.f - b.f) * 18;   // a storey is worth a walk

  // Aim for a comfortable hop rather than the far corner of the house every
  // time -- picking the maximum every step made each leg a trek.
  const WANT = 34;
  const [sx, sz] = centerOf(W.spawn.x, W.spawn.y);
  let from = { f: W.spawn.f, x: sx, z: sz };
  const taken = new Set();
  for (let i = 0; i < MUTES; i++) {
    let best = null, bv = 1e9;
    for (const c of cands) {
      if (taken.has(c.room)) continue;
      // keep clear of the ones already placed, not just the last
      let v = cost(from, c);
      for (const b2 of buttons) v = Math.min(v, cost(b2, c));
      if (v < 16) continue;                        // never right on top of each other
      const d = Math.abs(v - WANT);
      if (d < bv) { bv = d; best = c; }
    }
    if (!best) break;
    taken.add(best.room);
    buttons.push({ f: best.f, x: best.x, z: best.z,
      y: groundAt(best.x, best.z, best.f) + 1.15,
      room: best.room, pressed: false, pulse: rand(0, TAU) });
    from = best;
  }
}

function startRun() {
  G.level = 1; G.lvlKills = 0; G.exitOpen = false; G.boss = null;
  G.time = 0; G.spawnT = .4; G.garyT = 12; G.giantT = 2; G.garyCount = 0; G.dropT = 6;
  enemies.length = 0; bullets.length = 0; parts.length = 0; pickups.length = 0; pops.length = 0; rockets.length = 0;
  W.generate();
  assignRoomTypes();
  placeLights();
  // last resort: if the spawn still overlaps something, find open floor
  const [sx, sz] = centerOf(W.spawn.x, W.spawn.y);
  P.f = W.spawn.f; P.x = sx; P.z = sz; P.vx = P.vz = 0;
  P.y = groundAt(sx, sz, P.f); P.vy = 0; P.onGround = true;
  P.yaw = rand(0, TAU); P.pitch = 0;
  P.reloadT = 0; P.paint = 0; P.swapT = 0; P.ads = 0; P.adsT = 0; P.w = 0;
  // reserveMax only sets what you start a run with now; there is no ceiling
  WEAPONS.forEach((w, i) => { P.mag[i] = w.mag; P.reserve[i] = Math.round(w.reserveMax * .32); });

  pools = W.pools; shafts = W.shafts;
  placeProps(); placeScreens(); placeButtons(); buildWorld();
  G.buttonIdx = 0; G.quietT = 0; G.splits = [];

  $("bossbar").style.display = "none";
  if (!PEACEFUL) {
    for (let i = 0; i < 16; i++) {
      const sp = spawnSpot(10, true);
      if (sp) spawnEnemy(pick(POOL), sp[0], sp[1], sp[2]);
    }
    const sp0 = spawnSpot(16, true);                // one giant from the off
    if (sp0) spawnEnemy("termite", sp0[0], sp0[1], sp0[2]);
  }
  for (let i = 0; i < 16; i++) {
    const sp = spawnSpot(4);
    if (sp) pickups.push({ kind: Math.random() < .78 ? "ammo" : "health",
      x: sp[0], y: groundAt(sp[0], sp[1], sp[2]), z: sp[1], f: sp[2], t: rand(0, 6) });
  }
  refreshFlow();
  updateHUD();
  feed("Weapons on 1-4. Hold E to scope. Follow the red trail.", "#ffd447");
}

/* ----------------------------- shooting ----------------------------- */
function camDir() {
  const cp = Math.cos(P.pitch);
  return [Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp];
}
function fire() {
  if (P.reloadT > 0 || P.fireT > 0 || P.swapT > 0) return;
  const w = WP();
  if (P.mag[P.w] <= 0) { Snd.dry(); if (P.reserve[P.w] > 0) startReload(); return; }
  P.mag[P.w]--; P.fireT = w.rof; P.recoil = 1; P.flash = .055; G.shots++;
  Snd.gun(w.rocket ? "rpg" : w.scope ? "sniper" : w.model === "mg" ? "mg" : "pistol");
  P.shake = Math.max(P.shake, w.shake);
  P.pitch = clamp(P.pitch + rand(w.kick * .55, w.kick), -1.45, 1.45);

  const [dx, dy, dz] = camDir();
  const aim = P.adsT > .5 ? .25 : 1;
  const sp = w.spread * .0032 * aim * (1 + Math.hypot(P.vx, P.vz) * .3);
  let rx = dx + rand(-sp, sp), ry = dy + rand(-sp, sp), rz = dz + rand(-sp, sp);
  const L = Math.hypot(rx, ry, rz); rx /= L; ry /= L; rz /= L;
  if (w.rocket) {
    rockets.push({
      x: P.x + rx * .6, y: P.y + EYE + ry * .6 - .12, z: P.z + rz * .6,
      vx: rx * w.rocket.speed, vy: ry * w.rocket.speed, vz: rz * w.rocket.speed,
      dmg: w.rocket.dmg, radius: w.rocket.radius, life: 4, smoke: 0, f: P.f,
    });
    if (P.mag[P.w] === 0 && P.reserve[P.w] > 0) startReload();
    updateHUD();
    return;
  }

  const hd = Math.max(Math.hypot(rx, rz), 1e-4);
  // rayWall works in the floor plane, so its result is a horizontal distance.
  // The matching distance ALONG the ray is that over the horizontal factor.
  const wallT = Math.min(rayWall(P.f, P.x, P.z, rx / hd, rz / hd, w.range * hd) / hd, w.range);

  // every enemy along the ray; the sniper punches through a few
  const along = [];
  for (const e of enemies) {
    if (e.dead) continue;
    const ox = P.x - e.x, oz = P.z - e.z;
    const pad = e.k.rad + (w.scope ? .22 : .12);
    const a = rx * rx + rz * rz, b = 2 * (ox * rx + oz * rz), c = ox * ox + oz * oz - pad * pad;
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    let t = (-b - sq) / (2 * a);
    if (t < 0) t = (-b + sq) / (2 * a);
    if (t < .2 || t >= wallT) continue;
    const yy = P.y + EYE + ry * t;
    if (yy < e.y - .12 || yy > e.y + e.h + .12) continue;
    along.push({ e, y: yy, t });
  }
  along.sort((a, b) => a.t - b.t);
  const struck = along.slice(0, 1 + w.pierce);

  for (const hit of struck) {
    const e = hit.e;
    const rel = (hit.y - e.y) / e.h;
    const head = rel > (RIG_HEAD[e.k.art] || .72) && !(e.kind === "hermit" && e.shell > 0);
    let dmg = w.dmg * (head ? w.headMult : 1);
    G.hits++;
    if (e.kind === "hermit" && e.shell > 0) {
      dmg *= .1;
      spark(P.x + rx * hit.t, hit.y, P.z + rz * hit.t, "#ffe08a", 8);
      Snd.noise(.05, 2600, .14, "highpass");
      popup(e, "CLANG", "#ffd447", hit.y - e.y);
    } else {
      spark(P.x + rx * hit.t, hit.y, P.z + rz * hit.t, head ? "#ffffff" : "#ffb03a", head ? 18 : 10);
      head ? Snd.head() : Snd.hit();
      popup(e, "" + Math.round(dmg), head ? "#fff36b" : "#ffd0a0", hit.y - e.y);
      if (head) { headMark = .5; popup(e, pick(HEAD_LINES), "#fff36b", hit.y - e.y + .45); }
    }
    hitMark = .16; e.hurt = .14; e.hp -= dmg;
    if (e.hp <= 0) killEnemy(e);
  }
  if (!struck.length && wallT < w.range - .5)
    spark(P.x + rx * wallT, P.y + EYE + ry * wallT, P.z + rz * wallT, "#e8dca6", 7);
  if (P.mag[P.w] === 0 && P.reserve[P.w] > 0) startReload();
  updateHUD();
}

function explode(x, y, z, dmg, radius) {
  Snd.noise(.7, 420, .8);
  Snd.noise(.65, 95, .45);
  P.shake = Math.max(P.shake, .9);
  for (let i = 0; i < 70; i++) {
    const a = rand(0, TAU), sp = rand(2, 13);
    parts.push({
      x, y: y + rand(-.3, .6), z, vx: Math.cos(a) * sp, vy: rand(1, 8), vz: Math.sin(a) * sp,
      life: rand(.4, 1.1), max: 1.1, size: rand(.14, .42),
      col: pick(["#ffd447", "#ff8a3d", "#ff5f2e", "#ffffff", "#6b6257"]), grav: 7,
    });
  }
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.z - z, (e.y + e.h * .5) - y);
    if (d > radius) continue;
    const k = 1 - d / radius;
    e.hurt = .16;
    e.hp -= dmg * k * k;
    popup(e, "" + Math.round(dmg * k * k), "#ff9d3d", e.h * .6);
    if (e.hp <= 0) killEnemy(e);
  }
  // your own rocket will absolutely hurt you
  const pd = Math.hypot(P.x - x, P.z - z, (P.y + EYE * .5) - y);
  if (pd < radius) damagePlayer(dmg * .22 * (1 - pd / radius), "your own rocket");
}

function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.life -= dt;
    const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt, nz = r.z + r.vz * dt;
    r.smoke -= dt;
    if (r.smoke <= 0) {
      r.smoke = .012;
      parts.push({ x: r.x, y: r.y, z: r.z, vx: rand(-.4, .4), vy: rand(.1, .7), vz: rand(-.4, .4),
        life: rand(.35, .8), max: .8, size: rand(.14, .3), col: "#8e8880", grav: -.4 });
    }
    let hit = null;
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.hypot(nx - e.x, nz - e.z) < e.k.rad + .35 && ny > e.y - .3 && ny < e.y + e.h + .3) { hit = e; break; }
    }
    const g = groundAt(nx, nz, r.f);
    if (hit || r.life <= 0 || blocked(nx, nz, r.f, .12) || ny < g + .1 || ny > g + WALLH) {
      explode(nx, ny, nz, r.dmg, r.radius);
      rockets.splice(i, 1);
      continue;
    }
    r.x = nx; r.y = ny; r.z = nz;
  }
}

function switchWeapon(i) {
  if (i === P.w || i < 0 || i >= WEAPONS.length) return;
  P.w = i; P.swapT = .32; P.reloadT = 0; P.ads = 0;
  $("reloading").textContent = "";
  Snd.noise(.04, 1800, .10);
  updateHUD();
}
function startReload() {
  const w = WP();
  if (P.reloadT > 0 || P.swapT > 0 || P.mag[P.w] >= w.mag || P.reserve[P.w] <= 0) return;
  P.reloadT = w.reload; Snd.reload();
  $("reloading").textContent = "RELOADING";
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0;
  G.kills++; G.runKills++; G.lvlKills++; G.combo++; G.comboT = 3.2;
  const gain = Math.round(e.k.clout * (1 + Math.min(G.combo - 1, 9) * .12));
  G.clout += gain;
  Snd.kill(e.k.pitch);
  confetti(e);
  popup(e, "+" + gain, "#ffd447", e.h * .75);
  if (e.k.death && e.k.death.length) feed(pick(e.k.death), "#cfc08a");
  if (STREAK_LINES[G.combo]) shout(pick(STREAK_LINES[G.combo]));
  if (e.k.boss) {
    shout("MASSIVE W!");
    feed("Gary has been de-platformed.", "#ff6b6b");
    for (let i = 0; i < 80; i++) confettiAt(e.x, e.y + rand(.5, e.h), e.z, pick(["#ffd447", "#ff5f5f", "#7dff8a", "#4ad0ff", "#ffffff"]));
    G.boss = null; $("bossbar").style.display = "none";
    onGaryDown();
  }
  if (Math.random() < (e.k.mini || e.k.boss ? 1 : .40))
    pickups.push({ kind: Math.random() < .55 ? "ammo" : "health", x: e.x, y: e.y, z: e.z, f: e.f, t: 0 });
  if (e.k.boss) for (let i = 0; i < 5; i++)
  {
    const px2 = e.x + rand(-2.5, 2.5), pz2 = e.z + rand(-2.5, 2.5);
    pickups.push({ kind: i % 2 ? "ammo" : "health", x: px2, y: groundAt(px2, pz2, e.f), z: pz2, f: e.f, t: 0 });
  }
  updateHUD();
}
/* Killing Gary just buys you a breather before the next one. */
function onGaryDown() {
  G.garyT = Math.max(30, 55 - G.garyCount * 4);
  feed("Another one is already on his way.", "#ff9d3d");
}

/* ---------------------------- particles ----------------------------- */
function spark(x, y, z, col, n) {
  for (let i = 0; i < n; i++) parts.push({ x, y, z, vx: rand(-2.8, 2.8), vy: rand(-1, 3.6), vz: rand(-2.8, 2.8), life: rand(.22, .5), max: .5, size: rand(.06, .16), col, grav: 7 });
}
function confettiAt(x, y, z, col) {
  parts.push({ x, y, z, vx: rand(-3.6, 3.6), vy: rand(1.5, 6.4), vz: rand(-3.6, 3.6), life: rand(.7, 1.6), max: 1.6, size: rand(.09, .24), col, grav: 8.5 });
}
function confetti(e) {
  const cols = ["#ffd447", "#ff8a3d", "#7dff8a", "#4ad0ff", "#ff5f8a", "#ffffff"];
  for (let i = 0; i < 34; i++) confettiAt(e.x, e.y + rand(.3, e.h), e.z, pick(cols));
}
/* `y` is an offset above the entity's feet. */
function popup(e, txt, col, y) {
  pops.push({ x: e.x, y: e.y + (y === undefined ? e.h * .6 : y), z: e.z, txt, col, life: 1.05, vy: 1.2 });
}

/* ------------------------------ player ------------------------------ */
function updatePlayer(dt) {
  const spr = keys.has("shiftleft") || keys.has("shiftright");
  // The minigun weighs what it looks like it weighs.
  const heft = WP().heavy || 1;
  const speed = (spr ? 11.8 : 7.6) * heft;
  let ix = 0, iz = 0;
  if (keys.has("keyw") || keys.has("arrowup")) iz += 1;
  if (keys.has("keys") || keys.has("arrowdown")) iz -= 1;
  if (keys.has("keyd") || keys.has("arrowright")) ix += 1;
  if (keys.has("keya") || keys.has("arrowleft")) ix -= 1;
  let tx = 0, tz = 0;
  const l = Math.hypot(ix, iz);
  if (l > 0) {
    ix /= l; iz /= l;
    tx = (Math.sin(P.yaw) * iz + Math.cos(P.yaw) * ix) * speed;
    tz = (-Math.cos(P.yaw) * iz + Math.sin(P.yaw) * ix) * speed;
  }
  const k = 1 - Math.pow(0.0009, dt);
  P.vx = lerp(P.vx, tx, k); P.vz = lerp(P.vz, tz, k);
  // Never let the player end up sealed in. Try standing on it, then spiral
  // outwards, and as a last resort fall back to a room we know is clear.
  P.f = floorOfY(P.y);
  if (blocked(P.x, P.z, P.f, PRAD, P.y)) {
    const top = propTop(P.x, P.z, P.f, 1e9);
    if (top > -1e8 && top < P.y + 1.8) { P.y = top; P.onGround = true; }
    if (blocked(P.x, P.z, P.f, PRAD, P.y)) {
      let freed = false;
      for (let ring = 1; ring <= 40 && !freed; ring++) {
        for (let a = 0; a < 24; a++) {
          const th = a / 24 * TAU + ring * .27;
          const nx = P.x + Math.cos(th) * ring * .18, nz = P.z + Math.sin(th) * ring * .18;
          if (blocked(nx, nz, P.f, PRAD, P.y)) continue;
          P.x = nx; P.z = nz; P.y = standHeight(nx, nz, P.f, P.y);
          P.vy = 0; P.onGround = true; freed = true; break;
        }
      }
      if (!freed) for (const r of roomsOn(P.f)) {
        const [wx, wz] = centerOf(r.cx, r.cy);
        if (blocked(wx, wz, P.f, PRAD, groundAt(wx, wz, P.f))) continue;
        P.x = wx; P.z = wz; P.y = groundAt(wx, wz, P.f);
        P.vy = 0; P.onGround = true; break;
      }
    }
  }

  slide(P, P.vx * dt, P.vz * dt, P.f, PRAD, P.y);

  // vertical: stick to the floor, or arc through a jump
  const gy = standHeight(P.x, P.z, P.f, P.y);
  if (keys.has("space") && P.onGround) { P.vy = JUMP_V; P.onGround = false; Snd.noise(.10, 700, .06); }
  if (P.onGround) {
    P.y = gy; P.vy = 0;
  } else {
    P.vy -= GRAV * dt;
    P.y += P.vy * dt;
    const headroom = groundAt(P.x, P.z, P.f) + WALLH - .35;
    if (P.y + EYE > headroom) { P.y = headroom - EYE; P.vy = Math.min(P.vy, 0); }
    if (P.y <= gy) { P.y = gy; P.vy = 0; P.onGround = true; }
  }
  // walking off a ledge should drop you, not glue you to the floor
  if (P.onGround && P.y > gy + .06) { P.onGround = false; P.vy = 0; }

  // the barrels wind up while you fire and coast down after
  const wantSpin = (WP().spin && P.fireT > 0) ? 1 : 0;
  mgSpinV = lerp(mgSpinV, wantSpin, 1 - Math.pow(wantSpin ? .06 : .35, dt));
  mgSpin += mgSpinV * dt * 26;

  const sp = Math.hypot(P.vx, P.vz);
  P.bob += dt * sp * 1.6; P.steps += dt * sp;
  if (P.steps > 2.7) {
    P.steps = 0;
    const [scx, scy] = cellAt(P.x, P.z);
    const surf = W.isOutside(P.f, scx, scy) ? "grass"
      : (W.shaftAt[P.f] && W.shaftAt[P.f][idx(scx, scy)]) ? "stone" : "wood";
    Snd.step(surf, sp > 5.2);
  }

  // viewmodel sway lags the mouse
  P.swayX = lerp(P.swayX, clamp((P.yaw - P.lastYaw) * 6, -.9, .9), 1 - Math.pow(.002, dt));
  P.swayY = lerp(P.swayY, clamp((P.pitch - P.lastPitch) * 6, -.9, .9), 1 - Math.pow(.002, dt));
  P.lastYaw = P.yaw; P.lastPitch = P.pitch;

  if (P.swapT > 0) P.swapT -= dt;
  const canAds = WP().scope && P.reloadT <= 0 && P.swapT <= 0;
  P.adsT = lerp(P.adsT, canAds && P.ads ? 1 : 0, 1 - Math.pow(.0001, dt));
  if (P.fireT > 0) P.fireT -= dt;
  if (P.flash > 0) P.flash -= dt;
  P.recoil = Math.max(0, P.recoil - dt * 7);
  P.hurtT = Math.max(0, P.hurtT - dt);
  P.shake = Math.max(0, P.shake - dt * 1.5);
  P.paint = Math.max(0, P.paint - dt * .85);
  if (P.reloadT > 0) {
    P.reloadT -= dt;
    if (P.reloadT <= 0) {
      const w2 = WP();
      const take = Math.min(w2.mag - P.mag[P.w], P.reserve[P.w]);
      P.mag[P.w] += take; P.reserve[P.w] -= take;
      $("reloading").textContent = ""; updateHUD();
    }
  }
  if (mouseDown && G.state === "play") fire();

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) > 1.2) continue;
    if (p.kind === "ammo") {
      // No cap. Save your rounds and you can carry as many as you can find.
      WEAPONS.forEach((w2, i2) => { P.reserve[i2] += w2.ammoPer; });
      feed("+" + WEAPONS.map(w2 => w2.ammoPer).join(" / ") + " AMMO", "#ffd447");
    } else {
      if (P.hp >= P.maxhp) continue;
      P.hp = Math.min(P.maxhp, P.hp + 34); feed("+34 MASSIVE GLOW UP", "#7dff8a");
    }
    Snd.pickup(); pickups.splice(i, 1); updateHUD();
  }
  // reach the live button and it kills the noise for ten seconds
  const liveBtn = buttons[G.buttonIdx];
  if (liveBtn && !liveBtn.pressed && liveBtn.f === P.f &&
      Math.hypot(liveBtn.x - P.x, liveBtn.z - P.z) < 1.8) {
    liveBtn.pressed = true;
    (G.splits || (G.splits = [])).push(G.time);
    G.quietT = 10;
    G.buttonIdx++;
    G.clout += 500;
    Snd.tone(.12, 880, "sine", .18, 1400);
    setTimeout(() => Snd.tone(.18, 1320, "sine", .16, 900), 110);
    shout(pick(["MUTED!", "SILENCE!", "MASSIVE W!", "TAKE THE W!"]));
    if (G.buttonIdx < buttons.length) {
      const nx = buttons[G.buttonIdx];
      feed("10 SECONDS OF QUIET  //  NEXT ONE: " +
        ZONES[Math.min(nx.f, ZONES.length - 1)].name, "#7dff8a");
    } else { win(); return; }
    updateHUD();
  }
  if (G.quietT > 0) G.quietT -= dt;

  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; updateHUD(); } }
}
function damagePlayer(amount, why) {
  if (G.state !== "play" || PEACEFUL) return;
  P.hp -= amount; P.hurtT = .45;
  P.shake = Math.max(P.shake, Math.min(.7, amount / 34));
  G.combo = 0; Snd.hurt(); updateHUD();
  if (P.hp <= 0) { P.hp = 0; die(why); }
}

/* ------------------------------ enemies ----------------------------- */
function updateEnemies(dt) {
  G.ambT = (G.ambT || rand(4, 9)) - dt;
  if (G.ambT <= 0) {
    const [acx, acy] = cellAt(P.x, P.z);
    if (W.isOutside(P.f, acx, acy)) { Snd.gust(); G.ambT = rand(5, 11); }
    else if (Math.random() < .35) { Snd.creak(); G.ambT = rand(16, 30); }
    else { Snd.thud(); G.ambT = rand(18, 34); }
  }
  flowT -= dt;
  if (flowT <= 0) { refreshFlow(); flowT = .22; }
  let nearest = 999;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { e.deadT += dt; if (e.deadT > .7) enemies.splice(i, 1); continue; }
    const dx = P.x - e.x, dz = P.z - e.z, dist = Math.hypot(dx, dz);
    e.dist = dist;
    if (dist < nearest) nearest = dist;
    e.hurt = Math.max(0, e.hurt - dt);
    e.spawnT = Math.max(0, e.spawnT - dt);
    e.atkAnim = Math.max(0, e.atkAnim - dt * 2.2);
    e.f = floorOfY(e.y);
    e.y = standHeight(e.x, e.z, e.f, e.y);
    e.los = (e.f === P.f && dist < 40) ? hasLOS(e.f, e.x, e.z, P.x, P.z) : false;
    // announce a character the first time you actually see it
    if (e.los && !e.announced && dist < 26) {
      e.announced = true;
      const clip = NAME_CLIP[e.kind];
      if (clip && now - nameClipT > 1.1) {
        nameClipT = now;
        Voice.bite(clip[0], clip[1], clamp(1 - dist / 30, .4, 1));
      }
    }
    e.lit = lightAt(e.x, e.y + e.h * .55, e.z, e.f);

    e.growlT -= dt;
    if (e.growlT <= 0) e.growlT = rand(4, 11);

    if (e.k.boss) { updateBoss(e, dt, dist); continue; }

    if (e.k.shells) {
      if (e.shell > 0) e.shell -= dt;
      else { e.shellCd -= dt; if (e.shellCd <= 0 && dist < 13 && e.los) { e.shell = 1.5; e.shellCd = rand(4.5, 7); } }
    }

    let moving = e.shell <= 0 && e.atk <= 0;
    if (e.atk > 0) { e.atk -= dt; if (e.atk <= 0) landMelee(e); }

    if (moving && e.spawnT <= 0) {
      let vx, vz;
      if (e.los && dist < 20) { vx = dx; vz = dz; }
      else { const s = flowStep(e); vx = s[0]; vz = s[1]; }
      const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
      let sp = e.k.speed;
      if (e.k.ranged) {
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeT = rand(.8, 1.9); e.strafeDir *= -1; }
        if (e.los && dist < 10) { vx = -vx; vz = -vz; sp *= .85; }
        else if (e.los && dist < 17) sp *= .3;
        vx += -vz * e.strafeDir * e.k.strafe * .75; vz += vx * 0 + (vx * 0) + (e.strafeDir * e.k.strafe * .75) * 0;
        const pxp = -vz * e.strafeDir * e.k.strafe, pzp = vx * e.strafeDir * e.k.strafe;
        vx += pxp * .0; vz += pzp * .0;
        const L2 = Math.hypot(vx, vz) || 1; vx /= L2; vz /= L2;
      }
      const bx = e.x, bz = e.z;
      slide(e, vx * sp * dt, vz * sp * dt, e.f, e.k.rad * .8, undefined, true);
      for (const o of enemies) {
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oz = e.z - o.z, d2 = Math.hypot(ox, oz);
        const want = (e.k.rad + o.k.rad) * .78;
        if (d2 > .0001 && d2 < want) {
          const push = (want - d2) * 2.6 * dt;
          slide(e, (ox / d2) * push, (oz / d2) * push, e.f, e.k.rad * .8, undefined, true);
        }
      }
      e.walk += Math.hypot(e.x - bx, e.z - bz) * (8 / Math.max(1, e.h * .5));
      // face the way it is going, as seen from the camera
      const camR = [Math.cos(P.yaw), Math.sin(P.yaw)];
      e.mirror = (e.x - bx) * camR[0] + (e.z - bz) * camR[1] < 0;
    }

    e.cd -= dt;
    if (e.cd <= 0 && e.spawnT <= 0 && e.shell <= 0) {
      if (e.k.ranged && e.los && dist > 3.5 && dist < 24) { fireProjectile(e); e.cd = e.k.rate * rand(.85, 1.2); e.atkAnim = 1; }
      else if (!e.k.ranged && dist < e.k.reach && e.los) {
        e.atk = e.k.pound ? .7 : .32; e.atkAnim = 1; e.cd = e.k.rate;
        if (e.k.pound) Snd.noise(.34, 120, .20);
      }
    }
  }

  // dread rises as something gets close
  const close = clamp(1 - (nearest - 3) / 16, 0, 1);
  Snd.setDread(close);

}

function landMelee(e) {
  const d = Math.hypot(P.x - e.x, P.z - e.z);
  if (e.k.pound) {
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU;
      parts.push({ x: e.x + Math.cos(a) * .6, y: e.y + .15, z: e.z + Math.sin(a) * .6, vx: Math.cos(a) * 8, vy: rand(.4, 2.2), vz: Math.sin(a) * 8, life: .65, max: .65, size: .26, col: "#cbbd85", grav: 4 });
    }
    Snd.noise(.55, 220, .55);
    P.shake = Math.max(P.shake, .65);
    if (d < 4.2 && e.f === P.f && hasLOS(e.f, e.x, e.z, P.x, P.z)) damagePlayer(e.k.dmg * (1 - d / 5.2), e.k.name);
  } else if (d < e.k.reach * 1.3) damagePlayer(e.k.dmg, e.k.name);
}

function fireProjectile(e, ang, spdMul) {
  const dx = P.x - e.x, dz = P.z - e.z;
  const base = Math.atan2(dz, dx) + (ang || 0) + rand(-.05, .05);
  const sp = (e.k.ranged === "phone" ? 14 : e.k.ranged === "orb" ? 11 : 12) * (spdMul || 1);
  const ey = e.y + e.h * .62;
  const dy = (P.y + EYE - ey) / Math.max(3, Math.hypot(dx, dz));
  bullets.push({ x: e.x, y: ey, z: e.z, vx: Math.cos(base) * sp, vy: dy * sp * .8, vz: Math.sin(base) * sp, kind: e.k.ranged, dmg: e.k.dmg, life: 4, f: e.f });
}

function updateBoss(e, dt, dist) {
  const hpf = e.hp / e.max;
  const phase = hpf > .66 ? 0 : hpf > .33 ? 1 : 2;
  if (phase !== e.phase) {
    e.phase = phase; shout(GARY_PHASE[phase]); Snd.boss();
    P.shake = Math.max(P.shake, .55);
    feed("GARY IS " + GARY_PHASE[phase], "#ff6b6b");
  }
  e.dashT -= dt;
  let sp = e.k.speed + phase * .55;
  if (e.dashT <= 0 && dist > 4) { e.dashing = .85; e.dashT = rand(2.6, 4.4) - phase * .6; Snd.noise(.30, 900, .22, "highpass"); }
  if (e.dashing > 0) { e.dashing -= dt; sp = 10.5; }

  let vx, vz;
  if (e.los && dist < 24) { vx = P.x - e.x; vz = P.z - e.z; } else { const s = flowStep(e); vx = s[0]; vz = s[1]; }
  const L = Math.hypot(vx, vz) || 1;
  const bx = e.x, bz = e.z;
  if (dist > 2.4) slide(e, (vx / L) * sp * dt, (vz / L) * sp * dt, e.f, e.k.rad * .8, undefined, true);
  e.walk += Math.hypot(e.x - bx, e.z - bz) * 4;
  e.f = floorOfY(e.y); e.y = standHeight(e.x, e.z, e.f, e.y);
  const camR = [Math.cos(P.yaw), Math.sin(P.yaw)];
  e.mirror = (e.x - bx) * camR[0] + (e.z - bz) * camR[1] < 0;

  e.cd -= dt;
  if (e.cd <= 0 && e.los && dist < 28) {
    e.atkAnim = 1;
    if (phase === 0) { for (let i = 0; i < 3; i++) setTimeout(() => { if (G.boss === e && !e.dead && G.state === "play") fireProjectile(e, rand(-.08, .08)); }, i * 130); e.cd = 2.0; }
    else if (phase === 1) { for (let i = -1; i <= 1; i++) fireProjectile(e, i * .16); e.cd = 1.6; }
    else { for (let i = -3; i <= 3; i++) fireProjectile(e, i * .14, 1.15); e.cd = 1.4; }
    if (Math.random() < .55) { shout(pick(GARY_LINES)); Snd.noise(.20, 700, .12); }
  }
  if (phase >= 1) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = 10 - phase * 2;
      for (let i = 0; i < 2 + phase * 2; i++) {
        const a = rand(0, TAU), r = rand(2.5, 5);
        const nx = e.x + Math.cos(a) * r, nz = e.z + Math.sin(a) * r;
        if (!blocked(nx, nz, e.f, .5)) { spawnEnemy("giant", nx, nz, e.f); confettiAt(nx, groundAt(nx, nz, e.f) + 1, nz, "#ffd447"); }
      }
      shout("HE'S DELEGATING!");
      feed("To Gentle Giants. He is delegating to Gentle Giants.", "#ff9d3d");
    }
  }
  e.cd2 = (e.cd2 || 0) - dt;
  if (dist < 2.6 && e.cd2 <= 0) {
    e.cd2 = 1.9; e.atkAnim = 1;
    damagePlayer(e.k.dmg, e.k.name);
    P.shake = Math.max(P.shake, .55);
    shout(pick(GARY_LINES)); Snd.noise(.4, 500, .4);
  }
  $("bossfill").style.width = (hpf * 100) + "%";
  $("bossphase").textContent = GARY_PHASE[phase] + "   //   " + Math.max(0, Math.ceil(e.hp)) + " HP";
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy -= 2.2 * dt;
    const bg = groundAt(b.x, b.z, b.f === undefined ? P.f : b.f);
    let gone = b.life <= 0 || b.y < bg + .05 || b.y > bg + WALLH;
    if (!gone && blocked(b.x, b.z, b.f === undefined ? P.f : b.f, .1)) { gone = true; spark(b.x, b.y, b.z, "#e8dca6", 5); }
    if (!gone && Math.hypot(b.x - P.x, b.z - P.z) < .65 && Math.abs(b.y - (P.y + EYE)) < 1.6) {
      damagePlayer(b.dmg, b.kind);
      if (b.kind === "paint") { P.paint = Math.min(.75, P.paint + .45); feed("PAINTED! Creative Crab got you.", "#ff8ad4"); }
      gone = true;
      spark(b.x, b.y, b.z, b.kind === "paint" ? "#ff5fd0" : b.kind === "orb" ? "#7dff8a" : "#4ad0ff", 12);
    }
    if (gone) bullets.splice(i, 1);
  }
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= p.grav * dt;
    const pg = groundAt(p.x, p.z, floorOfY(p.y)) + .03;
    if (p.y < pg) { p.y = pg; p.vy *= -.35; p.vx *= .6; p.vz *= .6; }
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.life -= dt; p.y += p.vy * dt; p.vy *= .94;
    if (p.life <= 0) pops.splice(i, 1);
  }
}

/* ----------------------------- rendering ---------------------------- */
const mProj = new Float32Array(16), mView = new Float32Array(16), mVP = new Float32Array(16);
const mModel = new Float32Array(16), mMVP = new Float32Array(16);
let vw = 0, vh = 0, flicker = 1, flickerT = 0;
let fogCur = [.075, .073, .068], fogDCur = .038, zoneNow = null;
const gunBufs = {};

/* Renders each weapon's mesh to an offscreen buffer once, so the inventory
   bar can show a real picture of the gun rather than a text label. */
function renderGunIcons() {
  const IW = 300, IH = 170;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, IW, IH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, IW, IH);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);

  const px = new Uint8Array(IW * IH * 4);
  const c2 = cv(IW, IH), x2 = c2.getContext("2d");
  const proj = new Float32Array(16), view = new Float32Array(16);
  const vp = new Float32Array(16), mdl = new Float32Array(16), mvp = new Float32Array(16);
  const out = {};

  for (const w of WEAPONS) {
    const buf = gunBufs[w.model];
    if (!buf) continue;
    gl.viewport(0, 0, IW, IH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // side-on three-quarter view, framed on the weapon itself
    M4.persp(proj, .75, IW / IH, .01, 6);
    M4.lookAt(view, .30, .34, 1.05, 0, -.02, -.02);
    M4.mul(proj, view, vp);
    M4.compose(mdl, 0, 0, 0, -0.62, .12, 0, 1.5, 1.5, 1.5);
    M4.mul(vp, mdl, mvp);
    drawChar(gl, PROG, buf, mvp, mdl, {
      fog: [0, 0, 0], fogD: .0001, cam: [.30, .34, 1.05], lamp: .25,
      bright: 1.5, ink: .006, light: [.4, .85, .55], rim: [.10, .10, .12],
    });
    gl.readPixels(0, 0, IW, IH, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const img = x2.createImageData(IW, IH);
    for (let y = 0; y < IH; y++) {                    // GL reads bottom-up
      const src = (IH - 1 - y) * IW * 4, dst = y * IW * 4;
      img.data.set(px.subarray(src, src + IW * 4), dst);
    }
    x2.putImageData(img, 0, 0);
    out[w.model] = c2.toDataURL();
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); gl.deleteTexture(tex);
  gl.viewport(0, 0, vw, vh);
  return out;
}
let GUN_ICONS = {};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  vw = Math.round(innerWidth * dpr); vh = Math.round(innerHeight * dpr);
  glc.width = vw; glc.height = vh;
  const h = document.getElementById("hud");
  h.width = vw; h.height = vh;
  gl.viewport(0, 0, vw, vh);
}
addEventListener("resize", resize);

function project(x, y, z) {
  const cx = mVP[0] * x + mVP[4] * y + mVP[8] * z + mVP[12];
  const cy = mVP[1] * x + mVP[5] * y + mVP[9] * z + mVP[13];
  const cw = mVP[3] * x + mVP[7] * y + mVP[11] * z + mVP[15];
  if (cw <= .01) return null;
  return { x: (cx / cw * .5 + .5) * vw, y: (1 - (cy / cw * .5 + .5)) * vh };
}

function render(dt) {
  flicker = 1;                       // steady bulbs - no strobing
  const bossHere = G.boss && !G.boss.dead;
  const outNow = W.isOutside(P.f, Math.floor(P.x / CELL), Math.floor(P.z / CELL));
  const pz = outNow ? NIGHT : ZONES[Math.min(P.f, ZONES.length - 1)];
  // ease the air toward whichever wing you are standing in
  const k = 1 - Math.pow(.06, dt);
  for (let i = 0; i < 3; i++) fogCur[i] = lerp(fogCur[i], bossHere ? [.14, .05, .045][i] : pz.fog[i], k);
  fogDCur = lerp(fogDCur, bossHere ? .042 : pz.fogD, k);
  const fog = fogCur, fogD = fogDCur;
  if (pz !== zoneNow) {
    zoneNow = pz;
    if (G.state === "play") shout(pz.name);
  }

  const sh = P.shake;
  const sx = rand(-1, 1) * sh * .1, sy = rand(-1, 1) * sh * .1;
  const bobY = Math.sin(P.bob * 2) * .05;
  const ex = P.x, ey = P.y + EYE + bobY + sy, ez = P.z;
  const [dx, dy, dz] = camDir();

  const fov = lerp(1.30, WP().fovZoom || 1.30, P.adsT);
  M4.persp(mProj, fov, vw / vh, .05, 220);
  M4.lookAt(mView, ex, ey, ez, ex + dx + sx, ey + dy + sy * .5, ez + dz);
  M4.mul(mProj, mView, mVP);

  gl.viewport(0, 0, vw, vh);
  gl.clearColor(fog[0], fog[1], fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.depthMask(true);

  const lamp = .55 + (P.flash > 0 ? 1.7 : 0);
  QD.use(mVP, [ex, ey, ez], fog, fogD, lamp);
  const gb = flicker;

  gl.bindBuffer(gl.ARRAY_BUFFER, worldVBO);
  QD.attribs();
  gl.uniform1f(PROG.world.u.uBright, gb);
  for (const R of ranges) {
    const t = R.tex;
    const tex = t.t === "floor" ? TEX.floors[t.i]
      : t.t === "wall" ? TEX.walls[t.i]
      : t.t === "ceil" ? TEX.ceil[t.i]
      : t.t === "panel" ? TEX.panel
      : t.t === "facade" ? TEX.facade
      : t.t === "tree" ? TEX.tree : TEX.ground;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, R.start, R.count);
  }

  // ---- the water ----
  if (pools.length) {
    gl.depthMask(false);
    const sc = now * .012;
    for (const pl of pools) {
      const mx = (pl.x0 + pl.x1) * .5, mz = (pl.z0 + pl.z1) * .5;
      if ((mx - ex) ** 2 + (mz - ez) ** 2 > 1600) continue;
      const u0 = pl.x0 / 3 + sc, u1 = pl.x1 / 3 + sc;
      const v0 = pl.z0 / 3 - sc, v1 = pl.z1 / 3 - sc;
      QD.quad(TEX.water,
        pl.x0, pl.y, pl.z0, u0, v0,
        pl.x1, pl.y, pl.z0, u1, v0,
        pl.x1, pl.y, pl.z1, u1, v1,
        pl.x0, pl.y, pl.z1, u0, v1,
        { cut: .01, alpha: .80, bright: .95 });
    }
    gl.depthMask(true);
  }

  // ---- a beam over the live button, so it reads from across the house ----
  {
    const lb = buttons[G.buttonIdx];
    if (lb && !lb.pressed) {
      const pulse = .55 + Math.sin(now * 3.4) * .45;
      QD.billboard(TEX.beam, lb.x, lb.y - 1.1, lb.z, 1.6, 8,
        { yaw: P.yaw, cut: .01, alpha: .22 + pulse * .28, bright: 1.9 });
    }
  }

  // ---- the volume button ----
  // Only the one you are actually hunting exists. The dead ones used to be
  // drawn too, so the house was full of mutes you could walk up to and not use.
  {
    const b = buttons[G.buttonIdx];
    if (b && !b.pressed && (b.x - ex) ** 2 + (b.z - ez) ** 2 <= 4200) {
      const pulse = .6 + Math.sin(now * 4 + b.pulse) * .4;
      QD.ground(TEX.shadow, b.x, b.y - 1.1, b.z, .7, { cut: .01, alpha: .4, tint: [0, 0, 0, 1] });
      QD.billboard(TEX.buttonOn, b.x, b.y - .5, b.z, 1.0, 1.0,
        { yaw: P.yaw, cut: .25, bright: 1.3 + pulse });
    }
  }

  // ---- video panels ----
  updateVideoTex();
  for (const sc of screens) {
    const vx = sc.x - ex, vz = sc.z - ez;
    const d2 = vx * vx + vz * vz;
    if (d2 > 1900) continue;                       // out of range
    if (vx * sc.nx + vz * sc.nz > 0) continue;     // facing away from us
    // A viewer facing this panel looks along -n, and the renderer's right is
    // rot90(forward), so their right is (nz, -nx). Building the quad off the
    // negative of that put u=0 on the viewer's right -- every screen mirrored.
    const rx = sc.nz * sc.w / 2, rz = -sc.nx * sc.w / 2;
    const y0 = sc.y0, y1 = sc.y0 + sc.h;
    QD.quad(TEX.bezel,
      sc.bx - rx * 1.12, y0 - .14, sc.bz - rz * 1.12, 0, 1,
      sc.bx + rx * 1.12, y0 - .14, sc.bz + rz * 1.12, 1, 1,
      sc.bx + rx * 1.12, y1 + .14, sc.bz + rz * 1.12, 1, 0,
      sc.bx - rx * 1.12, y1 + .14, sc.bz - rz * 1.12, 0, 0, { cut: .5, bright: .75 });
    QD.quad(videoTex,
      sc.x - rx, y0, sc.z - rz, 0, 1,
      sc.x + rx, y0, sc.z + rz, 1, 1,
      sc.x + rx, y1, sc.z + rz, 1, 0,
      sc.x - rx, y1, sc.z - rz, 0, 0, { cut: .01, bright: 1.25 });
  }

  // ---- the trail to the next mute ----
  // An arrow that points is not much help when the way there is round two
  // corners and up a flight, so paint the actual route on the floor. The
  // chevrons run over the treads as well, which is what makes the stairs
  // findable rather than merely indicated.
  const tb = buttons[G.buttonIdx];
  if (tb && !tb.pressed && G.state === "play") {
    const [tcx, tcy] = cellAt(tb.x, tb.z);
    const route = routePath(tb.f, tcx, tcy);
    if (route && route.length > 1) {
      const line = smoothRoute(route);
      const STEP = 1.55;                             // chevrons this far apart
      let walked = 0, drawn = 0;
      for (let i = 0; i < line.length - 1 && drawn < 26; i++) {
        const a0 = line[i], a1 = line[i + 1];
        // Not "same storey" -- "near enough to your feet to be worth drawing".
        // Breaking on the storey number blanked the trail the moment you set
        // foot on a staircase, because the rest of the route belongs upstairs.
        const segY = groundAt(a0.x, a0.z, a0.f);
        if (Math.abs(segY - P.y) > 7) break;
        let dx = a1.x - a0.x, dz = a1.z - a0.z;
        const seg = Math.hypot(dx, dz);
        if (seg < .01) continue;
        dx /= seg; dz /= seg;
        const rxx = -dz, rzz = dx;                   // across the direction of travel
        for (let t = walked; t < seg && drawn < 26; t += STEP, drawn++) {
          const ax = a0.x + dx * t, az = a0.z + dz * t;
          const near = Math.hypot(ax - ex, az - ez);
          if (near > 34) continue;
          const gy = groundAt(ax, az, a0.f) + .05;
          const puls = .55 + .45 * Math.sin(now * 4.2 - drawn * .7);
          const al = clamp(1 - near / 34, .12, 1) * puls;
          const hw = .62, hl = .72;
          QD.quad(TEX.trail,
            ax - rxx * hw - dx * hl, gy, az - rzz * hw - dz * hl, 0, 1,
            ax + rxx * hw - dx * hl, gy, az + rzz * hw - dz * hl, 1, 1,
            ax + rxx * hw + dx * hl, gy, az + rzz * hw + dz * hl, 1, 0,
            ax - rxx * hw + dx * hl, gy, az - rzz * hw + dz * hl, 0, 0,
            { cut: .02, bright: 1.5 * al });
        }
        walked = (walked - seg) % STEP;
        if (walked < 0) walked += STEP;
      }
    }
  }

  // ---- everything else, far to near ----
  const list = [];
  for (const e of enemies) list.push({ d: (e.x - ex) ** 2 + (e.z - ez) ** 2, e });
  for (const b of bullets) list.push({ d: (b.x - ex) ** 2 + (b.z - ez) ** 2, b });
  for (const r of rockets) list.push({ d: (r.x - ex) ** 2 + (r.z - ez) ** 2, r });
  for (const p of pickups) list.push({ d: (p.x - ex) ** 2 + (p.z - ez) ** 2, p });
  list.sort((a, b) => b.d - a.d);

  const opts = { yaw: P.yaw, fwd: [dx, dy, dz] };
  for (const it of list) {
    if (it.e) {
      const e = it.e;
      const bright = clamp(e.lit * 1.15, .40, 1.9) * gb;
      let alpha = 1, tint = null, squash = 1;
      if (e.dead) {
        const k = e.deadT / .7;
        alpha = 1 - k; squash = 1 - k * .55; tint = [1, 1, 1, k * .75];
      } else {
        if (e.hurt > 0) tint = [1, .55, .5, .8 * (e.hurt / .14)];
        if (e.spawnT > 0) alpha = 1 - e.spawnT / .5;
        if (e.shell > 0) squash = .8;
      }
      // contact shadow
      QD.ground(TEX.shadow, e.x, e.y + .02, e.z, e.k.rad * 1.5, { cut: .01, alpha: .55 * alpha, tint: [0, 0, 0, 1], bright: 1 });
      const lunge = poseRig(e.k.art, e, now, e.walk, e.atkAnim);
      const px = e.x + dx * lunge * .35, pz = e.z + dz * lunge * .35;
      gl.depthMask(false);
      drawRigged(gl, QD, e.k.art, e, px, e.y, pz, e.h * squash, {
        yaw: P.yaw, fwd: [dx, dy, dz], mirror: e.mirror, alpha, tint, bright, cut: .35,
      });
      gl.depthMask(true);
    } else if (it.b) {
      const b = it.b;
      const t = b.kind === "phone" ? TEX.phone : b.kind === "orb" ? TEX.orb : TEX.paint;
      const s = b.kind === "phone" ? .6 : .65;
      QD.billboard(t, b.x, b.y - s / 2, b.z, s, s, { yaw: P.yaw, cut: .06, bright: 1.7 });
    } else if (it.r) {
      const r = it.r;
      QD.billboard(TEX.rocket, r.x, r.y - .16, r.z, .46, .32, { yaw: P.yaw, cut: .1, bright: 2.0 });
    } else if (it.p) {
      const p = it.p, y = p.y + .4 + Math.sin(p.t * 2.2) * .14;
      QD.ground(TEX.shadow, p.x, p.y + .02, p.z, .45, { cut: .01, alpha: .4, tint: [0, 0, 0, 1] });
      QD.billboard(p.kind === "ammo" ? TEX.ammo : TEX.health, p.x, y, p.z, .78, .78,
        { yaw: P.yaw, cut: .3, bright: 1.5 });
    } else if (it.exit) {
      const [px, pz] = it.exit;
      QD.billboard(TEX.exit, px, .02, pz, 2.6, 3.4, { yaw: P.yaw, cut: .25, bright: 1.4 + Math.sin(now * 4) * .35 });
    }
  }

  // ---- furniture ----
  for (const p of props) {
    const d2 = (p.x - ex) ** 2 + (p.z - ez) ** 2;
    if (d2 > 2600) continue;
    const buf = propBufs[p.kind];
    if (!buf) continue;
    M4.compose(mModel, p.x, p.y, p.z, p.yaw, 0, 0, 1, 1, 1);
    M4.mul(mVP, mModel, mMVP);
    drawChar(gl, PROG, buf.buf, mMVP, mModel, {
      fog, fogD, cam: [ex, ey, ez], lamp,
      bright: clamp(lightAt(p.x, p.y + .8, p.z, p.f), .30, 1.9) * gb,
      ink: .012, light: [.35, .85, .5], rim: [.03, .03, .035],
    });
  }
  QD.use(mVP, [ex, ey, ez], fog, fogD, lamp);

  // ---- particles ----
  gl.depthMask(false);
  parts.sort((a, b) => ((b.x - ex) ** 2 + (b.z - ez) ** 2) - ((a.x - ex) ** 2 + (a.z - ez) ** 2));
  for (const p of parts) {
    const k = clamp(p.life / p.max, 0, 1), c = hex(p.col);
    QD.billboard(TEX.puff, p.x, p.y - p.size / 2, p.z, p.size, p.size,
      { yaw: P.yaw, alpha: k, cut: .01, tint: [c[0], c[1], c[2], 1], bright: 1.7 });
  }
  gl.depthMask(true);

  // ---- the pistol, drawn in view space on a cleared depth buffer ----
  if (gunBufs[WP().model] && G.state !== "menu" && P.adsT < .92) {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const kick = P.recoil;
    const bx = Math.sin(P.bob) * .010, by = -Math.abs(Math.sin(P.bob * 2)) * .009;
    const w = WP(), V = w.view;
    M4.persp(mProj, 1.05, vw / vh, .01, 10);
    let rz = 0, ry = V.yaw - P.swayX * .18, rx = P.swayY * .18 - kick * .34;
    let px = V.x - P.swayX * .04 + bx, py = V.y + P.swayY * .035 + by, pz = V.z + kick * .05;
    if (P.reloadT > 0) {
      const t = 1 - P.reloadT / w.reload, s = Math.sin(t * Math.PI);
      py -= s * .20; rx -= s * .9; rz += s * .5;
    }
    if (P.swapT > 0) py -= Math.sin(clamp(P.swapT / .32, 0, 1) * Math.PI) * .30;
    M4.compose(mModel, px, py, pz, ry, rx, rz, V.scale, V.scale, V.scale);
    M4.mul(mProj, mModel, mMVP);
    if (w.spin && gunBufs.mgbarrels) {
      // The barrels ride in the gun's own space: lift onto the bore axis, then
      // roll about it. Offsetting in view space put them somewhere else
      // entirely and rolling the whole viewmodel turned the hands over.
      const mB = new Float32Array(16), mvpB = new Float32Array(16), mLocal = new Float32Array(16);
      M4.compose(mLocal, 0, .020, 0, 0, 0, mgSpin, 1, 1, 1);
      M4.mul(mModel, mLocal, mB);
      M4.mul(mProj, mB, mvpB);
      drawChar(gl, PROG, gunBufs.mgbarrels, mvpB, mB, {
        fog, fogD: .0005, cam: [0, 0, 0], lamp: 0,
        bright: clamp(lightAt(P.x, P.y + EYE, P.z, P.f), .35, 1.5) * gb + (P.flash > 0 ? 1.2 : 0),
        ink: V.ink, light: [.3, .8, .55], rim: [.05, .05, .05],
      });
    }
    drawChar(gl, PROG, gunBufs[w.model], mMVP, mModel, {
      fog, fogD: .0005, cam: [0, 0, 0], lamp: 0,
      bright: clamp(lightAt(P.x, P.y + EYE, P.z, P.f), .35, 1.5) * gb + (P.flash > 0 ? 1.2 : 0),
      ink: V.ink, light: [.3, .8, .55], rim: [.05, .05, .05],
    });
  }
}

/* ------------------------------ 2D HUD ------------------------------ */
const hudc = document.getElementById("hud"), h2 = hudc.getContext("2d");
const mm = document.getElementById("minimap"), mmx = mm.getContext("2d");
const noiseTiles = [], grainPat = [];
for (let i = 0; i < 4; i++) {
  const c = cv(128), x = c.getContext("2d");
  const img = x.createImageData(128, 128), d = img.data;
  for (let j = 0; j < d.length; j += 4) { const v = 128 + (Math.random() - .5) * 95; d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 30; }
  x.putImageData(img, 0, 0); noiseTiles.push(c);
}

function drawOverlay(dt) {
  const Wd = vw, H = vh, S = Math.min(Wd / 1600, H / 900) * 1.15;
  h2.setTransform(1, 0, 0, 1, 0, 0);
  h2.clearRect(0, 0, Wd, H);

  if (G.state === "play" || G.state === "pause") {
    h2.textAlign = "center";
    h2.font = `bold ${Math.round(22 * S)}px "Courier New",monospace`;
    for (const p of pops) {
      const s = project(p.x, p.y, p.z);
      if (!s) continue;
      h2.globalAlpha = clamp(p.life, 0, 1);
      h2.fillStyle = "#000"; h2.fillText(p.txt, s.x + 2, s.y + 2);
      h2.fillStyle = p.col; h2.fillText(p.txt, s.x, s.y);
    }
    h2.globalAlpha = 1;

    // nameplate over every visible enemy
    h2.font = `bold ${Math.round(13 * S)}px "Courier New",monospace`;
    h2.textAlign = "center";
    for (const e of enemies) {
      if (e.dead || e.dist > 34) continue;
      if (!e.los && e.dist > 6) continue;
      const sp2 = project(e.x, e.y + e.h + .42, e.z);
      if (!sp2) continue;
      const a = clamp(1 - (e.dist - 24) / 12, .28, 1);
      const label = e.k.name;
      const tw = h2.measureText(label).width;
      h2.globalAlpha = a * .5;
      h2.fillStyle = "#000";
      h2.fillRect(sp2.x - tw / 2 - 6 * S, sp2.y - 12 * S, tw + 12 * S, 17 * S);
      h2.globalAlpha = a;
      h2.fillStyle = e.k.boss ? "#ff6b6b" : e.k.mini ? "#ffb03a" : "#f0e6c0";
      h2.fillText(label, sp2.x, sp2.y);
      h2.globalAlpha = 1;
    }

    // ---------- waypoint to the next volume button ----------
    const lb = buttons[G.buttonIdx];
    if (lb && !lb.pressed) {
      const df = lb.f - P.f;
      // Pointing through the ceiling at a button two storeys up tells you
      // nothing useful, so follow the route instead: the arrow tracks the
      // corridor you actually have to walk.
      const aim = routeAim(lb);
      const nav = aim || (df === 0 ? lb : nearestStair(df > 0 ? 1 : -1) || lb);
      // the route tells you about the stairs you are walking into right now;
      // failing that, fall back to where the mute sits relative to you
      const climb = aim && aim.climb !== 0 ? aim.climb : (df > 0 ? 1 : df < 0 ? -1 : 0);
      // the walk, not the crow's flight
      const d = aim ? aim.metres : Math.hypot(lb.x - P.x, lb.z - P.z);
      const sp = project(nav.x, nav.y + .4, nav.z);
      const onScreen = sp && sp.x > 50 * S && sp.x < Wd - 50 * S && sp.y > 50 * S && sp.y < H - 110 * S;
      const beat = .6 + Math.sin(now * 4) * .4;
      h2.save();
      h2.textAlign = "center";
      h2.font = `bold ${Math.round(13 * S)}px "Courier New",monospace`;
      if (onScreen) {
        h2.globalAlpha = .55 + beat * .45;
        h2.strokeStyle = "#ff4d4d"; h2.lineWidth = 3.2 * S;
        h2.beginPath();
        h2.moveTo(sp.x - 13 * S, sp.y - 34 * S);
        h2.lineTo(sp.x, sp.y - 20 * S);
        h2.lineTo(sp.x + 13 * S, sp.y - 34 * S);
        h2.stroke();
        h2.globalAlpha = 1; h2.fillStyle = "#ff8a8a";
        h2.fillText(Math.round(d) + "m", sp.x, sp.y - 42 * S);
      } else {
        // off screen: pin an arrow to the edge, pointing the way round
        const fx = nav.x - P.x, fz = nav.z - P.z;
        const rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
        const fwx = Math.sin(P.yaw), fwz = -Math.cos(P.yaw);
        const dx = fx * rx + fz * rz;
        const dy = -(fx * fwx + fz * fwz);
        const len = Math.hypot(dx, dy) || 1;
        const R = Math.min(Wd, H) * .32;
        const ax = Wd / 2 + (dx / len) * R, ay = H / 2 + (dy / len) * R;
        const ang = Math.atan2(dy, dx);
        h2.translate(ax, ay);
        h2.rotate(ang);
        h2.globalAlpha = .6 + beat * .4;
        h2.fillStyle = "#ff4d4d";
        h2.beginPath();
        h2.moveTo(21 * S, 0); h2.lineTo(-11 * S, -14 * S);
        h2.lineTo(-4 * S, 0); h2.lineTo(-11 * S, 14 * S);
        h2.closePath(); h2.fill();
        h2.rotate(-ang);
        h2.globalAlpha = 1; h2.fillStyle = "#ff8a8a";
        h2.fillText(Math.round(d) + "m", 0, 32 * S);
      }
      if (climb !== 0) {
        h2.setTransform(1, 0, 0, 1, 0, 0);
        h2.globalAlpha = .55 + beat * .45;
        h2.fillStyle = "#ff4d4d";
        h2.textAlign = "center";
        h2.font = `bold ${Math.round(18 * S)}px "Courier New",monospace`;
        h2.fillText(climb > 0 ? "UP THE STAIRS  \u25b2" : "DOWN THE STAIRS  \u25bc",
          Wd / 2, H * .16);
      }
      h2.restore();
      h2.globalAlpha = 1;
    }

    const spread = (6 + Math.hypot(P.vx, P.vz) * 1.4 + P.recoil * 24) * S;
    h2.globalAlpha = 1 - P.adsT;
    h2.strokeStyle = hitMark > 0 ? "#ff5f5f" : "rgba(255,255,255,.85)";
    h2.lineWidth = 2.2 * S; h2.beginPath();
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      h2.moveTo(Wd / 2 + ax * spread, H / 2 + ay * spread);
      h2.lineTo(Wd / 2 + ax * (spread + 9 * S), H / 2 + ay * (spread + 9 * S));
    }
    h2.stroke();
    h2.fillStyle = "rgba(255,255,255,.9)";
    h2.fillRect(Wd / 2 - 1.2 * S, H / 2 - 1.2 * S, 2.4 * S, 2.4 * S);
    h2.globalAlpha = 1;

    if (hitMark > 0) {
      const k = hitMark / .16;
      h2.strokeStyle = headMark > 0 ? "#fff36b" : "#fff";
      h2.lineWidth = 3 * S; h2.globalAlpha = k;
      const r0 = 10 * S, r1 = (20 + (1 - k) * 10) * S;
      h2.beginPath();
      for (const [ax, ay] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        h2.moveTo(Wd / 2 + ax * r0, H / 2 + ay * r0); h2.lineTo(Wd / 2 + ax * r1, H / 2 + ay * r1);
      }
      h2.stroke(); h2.globalAlpha = 1;
    }
    // scope overlay: everything outside the eyepiece goes black
    if (P.adsT > .02) {
      const k = P.adsT;
      h2.save();
      h2.globalAlpha = k;
      const R = Math.min(Wd, H) * .40;
      h2.fillStyle = "#000";
      h2.beginPath();
      h2.rect(0, 0, Wd, H);
      h2.arc(Wd / 2, H / 2, R, 0, TAU, true);
      h2.fill();
      const vg = h2.createRadialGradient(Wd / 2, H / 2, R * .55, Wd / 2, H / 2, R);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.85)");
      h2.fillStyle = vg; h2.beginPath(); h2.arc(Wd / 2, H / 2, R, 0, TAU); h2.fill();
      h2.strokeStyle = "rgba(0,0,0,.9)"; h2.lineWidth = 6 * S;
      h2.beginPath(); h2.arc(Wd / 2, H / 2, R, 0, TAU); h2.stroke();
      // reticle
      h2.strokeStyle = "rgba(20,20,20,.95)"; h2.lineWidth = 1.6 * S;
      h2.beginPath();
      h2.moveTo(Wd / 2 - R, H / 2); h2.lineTo(Wd / 2 - R * .10, H / 2);
      h2.moveTo(Wd / 2 + R * .10, H / 2); h2.lineTo(Wd / 2 + R, H / 2);
      h2.moveTo(Wd / 2, H / 2 - R); h2.lineTo(Wd / 2, H / 2 - R * .10);
      h2.moveTo(Wd / 2, H / 2 + R * .10); h2.lineTo(Wd / 2, H / 2 + R);
      h2.stroke();
      for (let i = 1; i <= 4; i++) {
        const y = H / 2 + R * .10 * i * 1.6;
        const wdt = R * (.05 - i * .006);
        h2.beginPath(); h2.moveTo(Wd / 2 - wdt, y); h2.lineTo(Wd / 2 + wdt, y); h2.stroke();
      }
      h2.fillStyle = "rgba(20,20,20,.95)";
      h2.beginPath(); h2.arc(Wd / 2, H / 2, 2.2 * S, 0, TAU); h2.fill();
      h2.restore();
    }

    if (P.paint > .01) {
      h2.save(); h2.globalAlpha = clamp(P.paint, 0, .55);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.7 + 1;
        const px = Wd / 2 + Math.cos(a) * Wd * .26 * (.4 + (i % 3) * .3);
        const py = H / 2 + Math.sin(a * 1.7) * H * .28 * (.4 + (i % 4) * .25);
        const r = (60 + (i * 37) % 110) * S;
        const g = h2.createRadialGradient(px, py, 0, px, py, r);
        const c = i % 2 ? "255,95,208" : "74,208,255";
        g.addColorStop(0, `rgba(${c},.95)`); g.addColorStop(.72, `rgba(${c},.7)`); g.addColorStop(1, `rgba(${c},0)`);
        h2.fillStyle = g; h2.beginPath(); h2.arc(px, py, r, 0, 7); h2.fill();
      }
      h2.restore();
    }
  }

  const vig = h2.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * .24, vw / 2, vh / 2, Math.max(vw, vh) * .72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(${P.hurtT > 0 ? "90,4,4" : "0,0,0"},${.7 + P.hurtT * .3})`);
  h2.fillStyle = vig; h2.fillRect(0, 0, vw, vh);
  if (P.hurtT > 0) { h2.fillStyle = `rgba(190,20,20,${P.hurtT * .3})`; h2.fillRect(0, 0, vw, vh); }
  if (G.state === "play" && P.hp < 35) { h2.fillStyle = `rgba(150,10,10,${.1 + Math.sin(now * 5) * .06})`; h2.fillRect(0, 0, vw, vh); }

  h2.globalAlpha = .6;
  const gi = (now * 18 | 0) % 4;
  if (!grainPat[gi]) grainPat[gi] = h2.createPattern(noiseTiles[gi], "repeat");
  h2.fillStyle = grainPat[gi]; h2.fillRect(0, 0, vw, vh);
  h2.globalAlpha = 1;

  hitMark = Math.max(0, hitMark - dt);
  headMark = Math.max(0, headMark - dt);
}

function drawMinimap() {
  const S = 264, R = 14;
  mmx.clearRect(0, 0, S, S);
  mmx.fillStyle = "rgba(8,8,5,.75)"; mmx.fillRect(0, 0, S, S);
  const [pcx, pcy] = cellAt(P.x, P.z), sc = S / (R * 2);
  mmx.save(); mmx.translate(S / 2, S / 2); mmx.rotate(-P.yaw);
  const ox = P.x / CELL - pcx - .5, oy = P.z / CELL - pcy - .5;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const gx = pcx + x, gy = pcy + y;
    if (gx < 0 || gy < 0 || gx >= MAPW || gy >= MAPH) continue;
    const g = W.grid[P.f][idx(gx, gy)];
    if (g === 0) continue;
    mmx.fillStyle = g === 2 ? "rgba(150,220,150,.5)" : "rgba(200,182,110,.5)";
    mmx.fillRect((x - ox) * sc, (y - oy) * sc, sc + .6, sc + .6);
  }
  // stairs on this storey, marked with which way they go
  for (const sh of W.shafts) {
    for (const dirn of [1, -1]) {
      const boards = dirn > 0 ? sh.f : sh.to;
      if (boards !== P.f) continue;
      const c = dirn > 0 ? sh.cells[0] : sh.cells[sh.cells.length - 1];
      const px = (c.x - pcx - ox) * sc, py = (c.y - pcy - oy) * sc;
      if (Math.abs(px) > S / 2 || Math.abs(py) > S / 2) continue;
      mmx.fillStyle = "rgba(120,190,255,.85)";
      mmx.fillRect(px, py, sc, sc);
      mmx.save(); mmx.translate(px + sc / 2, py + sc / 2); mmx.rotate(P.yaw);
      mmx.fillStyle = "#0a1420";
      mmx.beginPath();
      mmx.moveTo(0, -sc * .3 * dirn);
      mmx.lineTo(-sc * .26, sc * .22 * dirn);
      mmx.lineTo(sc * .26, sc * .22 * dirn);
      mmx.closePath(); mmx.fill();
      mmx.restore();
    }
  }

  // the live button, if it is on this storey
  const lb = buttons[G.buttonIdx];
  if (lb && !lb.pressed && lb.f === P.f) {
    const [bx, by] = cellAt(lb.x, lb.z);
    mmx.fillStyle = "#39d16a";
    mmx.fillRect((bx - pcx - ox) * sc, (by - pcy - oy) * sc, sc, sc);
  }
  for (const e of enemies) {
    if (e.dead) continue;
    const px = (e.x / CELL - pcx - .5 - ox) * sc, py = (e.z / CELL - pcy - .5 - oy) * sc;
    if (Math.abs(px) > S / 2 || Math.abs(py) > S / 2) continue;
    mmx.fillStyle = e.k.boss ? "#ff2d2d" : e.k.mini ? "#ff9d3d" : "#ff6b6b";
    mmx.beginPath(); mmx.arc(px, py, e.k.boss ? 6 : 4, 0, 7); mmx.fill();
  }
  for (const p of pickups) {
    const px = (p.x / CELL - pcx - .5 - ox) * sc, py = (p.z / CELL - pcy - .5 - oy) * sc;
    if (Math.abs(px) > S / 2 || Math.abs(py) > S / 2) continue;
    mmx.fillStyle = p.kind === "ammo" ? "#ffd447" : "#8ef08e";
    mmx.fillRect(px - 2.5, py - 2.5, 5, 5);
  }
  mmx.restore();
  mmx.fillStyle = "#fff"; mmx.beginPath();
  mmx.moveTo(S / 2, S / 2 - 8); mmx.lineTo(S / 2 - 6, S / 2 + 6); mmx.lineTo(S / 2 + 6, S / 2 + 6);
  mmx.closePath(); mmx.fill();
}

/* ------------------------------ HUD/DOM ----------------------------- */
const $ = id => document.getElementById(id);
function feed(txt, col) {
  const d = document.createElement("div");
  d.textContent = txt; if (col) d.style.color = col;
  $("feed").appendChild(d);
  setTimeout(() => d.remove(), 4700);
  while ($("feed").children.length > 6) $("feed").firstChild.remove();
}
function shout(txt) {
  const el = $("shout"); el.textContent = txt;
  el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
}
function updateHUD() {
  const m2 = Math.floor(G.time / 60), s2 = Math.floor(G.time % 60);
  $("lvl").textContent = m2 + ":" + (s2 < 10 ? "0" : "") + s2 +
    "." + Math.floor((G.time % 1) * 10);
  $("clout").textContent = G.clout.toLocaleString();
  $("combo").textContent = G.combo > 1 ? "x" + G.combo + " STREAK" : "";
  const pct = clamp(P.hp / P.maxhp, 0, 1);
  $("hpfill").style.width = (pct * 100) + "%";
  $("hpfill").classList.toggle("low", pct < .35);
  $("hpnum").textContent = Math.max(0, Math.ceil(P.hp));
  $("ammonum").textContent = P.mag[P.w];
  $("ammonum").classList.toggle("empty", P.mag[P.w] === 0);
  $("ammores").textContent = "/ " + P.reserve[P.w];
  const wl = $("weapons");
  if (wl) {
    const html = WEAPONS.map((ww, i) => {
      const cls = (i === P.w ? "slot on" : "slot") + (P.reserve[i] + P.mag[i] === 0 ? " empty" : "");
      const icon = GUN_ICONS[ww.model] ? `<img src="${GUN_ICONS[ww.model]}" alt="">` : "";
      return `<div class="${cls}"><span class="num">${i + 1}</span>${icon}` +
        `<span class="nm">${ww.name}</span><span class="am">${P.mag[i]}<em>/${P.reserve[i]}</em></span></div>`;
    }).join("");
    if (wl._html !== html) { wl._html = html; wl.innerHTML = html; }
  }
  const obj = $("objective");
  const nAlive = enemies.reduce((a, e) => a + (e.dead ? 0 : 1), 0);
  const rm = roomAt(P.x, P.z);
  const lb2 = buttons[G.buttonIdx];
  const quiet = G.quietT > 0 ? "QUIET " + G.quietT.toFixed(1) + "s  //  " : "";
  const objective = lb2 && !lb2.pressed
    ? "MUTE <b>" + (G.buttonIdx + 1) + "</b>/" + buttons.length + " ON " +
      ZONES[Math.min(lb2.f, ZONES.length - 1)].name.replace("THE ", "")
    : "ALL MUTED";
  const want = PEACEFUL
    ? "WALKTHROUGH  //  FLOOR <b>" + P.f + "</b>  //  HEIGHT " + P.y.toFixed(2) +
      "  //  " + (rm ? rm.type || "ROOM" : "HALL") + "  //  " + objective
    : quiet + objective + "  //  <b>" + nAlive + "</b> IN THE HOUSE";
  if (obj._want !== want) { obj._want = want; obj.innerHTML = want; obj.className = G.exitOpen ? "ready" : ""; }
}

/* The nearest staircase on this storey that goes the way you need. dir is
   +1 for up, -1 for down; a shaft is recorded on its lower floor. */
function nearestStair(dir) {
  let best = null, bd = 1e9;
  for (const sh of W.shafts) {
    const from = dir > 0 ? sh.f : sh.to;         // the storey you board it on
    if (from !== P.f) continue;
    for (const c of sh.cells) {
      const [wx, wz] = centerOf(c.x, c.y);
      const dd = (wx - P.x) * (wx - P.x) + (wz - P.z) * (wz - P.z);
      if (dd < bd) { bd = dd; best = { x: wx, z: wz, y: groundAt(wx, wz, P.f) + .9 }; }
    }
  }
  return best;
}

/* ---------------------------- flow control -------------------------- */
/* The board lives on the server in scores.json, so it survives a browser wipe
   and every browser on the machine sees the same one. If the server is not
   there (opened as a file, say) it falls back to this browser's own storage. */
let boardCache = null;
async function fetchBoard() {
  try {
    const r = await fetch("/api/scores", { cache: "no-store" });
    if (!r.ok) throw 0;
    boardCache = await r.json();
    return boardCache;
  } catch (e) { return loadRuns(); }
}
async function postScore(rec) {
  try {
    const r = await fetch("/api/scores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
    if (!r.ok) throw 0;
    boardCache = await r.json();
    return boardCache;
  } catch (e) { return saveRun(rec).table; }
}
function playerName() {
  return (localStorage.getItem("vfh_name") || "").toUpperCase();
}

/* Every finished run is kept, so there is something to beat. */
const fmtT = v => Math.floor(v / 60) + ":" + (Math.floor(v % 60) < 10 ? "0" : "") +
  Math.floor(v % 60) + "." + Math.floor((v % 1) * 10);
function loadRuns() {
  try { return JSON.parse(localStorage.getItem("vfh_runs") || "[]"); } catch (e) { return []; }
}
function saveRun(rec) {
  const all = loadRuns();
  all.push(rec);
  all.sort((a, b) => a.time - b.time);
  const keep = all.slice(0, 10);
  try { localStorage.setItem("vfh_runs", JSON.stringify(keep)); } catch (e) {}
  return { table: keep, rank: keep.indexOf(rec) };
}
function boardHTML(runs, hiTime) {
  if (!runs || !runs.length) return '<p class="tiny">No finished runs yet.</p>';
  return '<table class="board">' + runs.slice(0, 10).map((r, i) =>
    '<tr' + (hiTime != null && Math.abs(r.time - hiTime) < .005 ? ' class="me"' : '') +
    '><td>' + (i + 1) + '</td><td>' + (r.name || "ANON") + '</td><td>' + fmtT(r.time) +
    '</td><td>' + r.kills + ' killed</td><td>' + (r.when || "") + '</td></tr>').join("") + '</table>';
}

function win() {
  G.state = "won";
  document.exitPointerLock && document.exitPointerLock();
  const t = G.time;
  const best = parseFloat(localStorage.getItem("vfh_best") || "0");
  const isBest = !best || t < best;
  if (isBest) localStorage.setItem("vfh_best", String(t));
  const fmt = fmtT;
  const d = new Date();
  const rec = { time: t, kills: G.runKills, splits: (G.splits || []).slice(),
    name: playerName() || "ANON",
    when: d.getDate() + "/" + (d.getMonth() + 1) };
  saveRun(rec);                                  // local copy, always
  const sp = (G.splits || []).map((v, i) => {
    const prev = i ? G.splits[i - 1] : 0;
    return '<span>' + (i + 1) + '</span>' + fmt(v - prev);
  }).join("");
  $("dead").classList.remove("hide");
  $("deadtitle").innerHTML = "ALL FIVE MUTED<span>" + fmt(t) + "</span>";
  $("deadtitle").style.color = "#7dff8a";
  $("deadsub").innerHTML = (isBest
    ? "Fastest run yet. The house is finally quiet."
    : "Best so far is " + fmt(best) + ".") +
    '<div class="splits">' + sp + '</div>' +
    '<div class="namerow"><label>NAME</label>' +
    '<input id="runname" maxlength="14" placeholder="ANON" value="' + playerName() + '">' +
    '<button id="savescore">POST TO BOARD</button></div>' +
    '<div id="livboard">' + boardHTML(boardCache, null) + '</div>';
  const post = async () => {
    const nm = ($("runname").value || "ANON").toUpperCase().slice(0, 14);
    localStorage.setItem("vfh_name", nm);
    rec.name = nm;
    $("savescore").disabled = true; $("savescore").textContent = "POSTED";
    const rows = await postScore(rec);
    $("livboard").innerHTML = boardHTML(rows, rec.time);
  };
  $("savescore").onclick = post;
  $("runname").onkeydown = e => { if (e.key === "Enter") post(); };
  setTimeout(() => $("runname").focus(), 60);
  $("dlvl").textContent = fmt(t);
  $("dkills").textContent = G.runKills;
  $("dclout").textContent = G.clout.toLocaleString();
  $("retrybtn").textContent = "RUN IT AGAIN";
  Snd.tone(.5, 660, "sine", .22, 990);
  setTimeout(() => Snd.tone(.7, 990, "sine", .2, 1320), 220);
}

function die(why) {
  G.state = "dead";
  document.exitPointerLock && document.exitPointerLock();
  $("dead").classList.remove("hide");
  const m3 = Math.floor(G.time / 60), s3 = Math.floor(G.time % 60);
  $("deadtitle").innerHTML = "YOU GOT<span>VEE-D</span>";
  $("deadtitle").style.color = "#ff5b5b";
  $("retrybtn").textContent = "TRY AGAIN";
  $("deadsub").textContent = "Muted " + G.buttonIdx + " of " + buttons.length +
    " in " + m3 + "m " + s3 + "s. Killed by " + (why || "the house") + ". " +
    pick(["It was not personal. It was content.", "Somebody minted that moment.",
      "The house did not stop for you.", "You are now part of the collection."]);
  $("dlvl").textContent = Math.floor(G.time / 60) + ":" +
    (Math.floor(G.time % 60) < 10 ? "0" : "") + Math.floor(G.time % 60);
  $("dkills").textContent = G.runKills;
  $("dclout").textContent = G.clout.toLocaleString();
  Snd.tone(1.2, 160, "sawtooth", .3, 40);
}
function beginRun() {
  G.level = 1; G.clout = 0; G.runKills = 0; G.shots = 0; G.hits = 0; G.combo = 0;
  P.hp = P.maxhp; P.w = 0;
  startRun(); G.state = "play"; lockPointer();
}
function lockPointer() {
  try { const r = glc.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
}
function pauseGame() {
  if (G.state !== "play") return;
  G.state = "pause"; mouseDown = false;
  $("pause").classList.remove("hide");
  document.exitPointerLock && document.exitPointerLock();
}
function resumeGame() { $("pause").classList.add("hide"); G.state = "play"; lockPointer(); }

/* ------------------------------- input ------------------------------ */
const keys = new Set();
let mouseDown = false;
addEventListener("keydown", e => {
  const k = e.code.toLowerCase();
  keys.add(k);
  if (k === "keyr") startReload();
  if (k === "digit1") switchWeapon(0);
  if (k === "digit2") switchWeapon(1);
  if (k === "digit3") switchWeapon(2);
  if (k === "digit4") switchWeapon(3);
  if (k === "keyq") switchWeapon((P.w + 1) % WEAPONS.length);
  if (k === "keye") P.ads = 1;
  if (k === "escape" && G.state === "play") pauseGame();
  if (["space", "tab", "keyw", "keya", "keys", "keyd", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
});
addEventListener("keyup", e => {
  const k = e.code.toLowerCase();
  keys.delete(k);
  if (k === "keye") P.ads = 0;
});
addEventListener("blur", () => { keys.clear(); mouseDown = false; });
glc.addEventListener("mousedown", e => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) { P.ads = 1; e.preventDefault(); }
});
addEventListener("mouseup", e => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) P.ads = 0;
});
addEventListener("contextmenu", e => { if (G.state === "play") e.preventDefault(); });
addEventListener("wheel", e => { if (G.state === "play") switchWeapon((P.w + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length); }, { passive: true });
addEventListener("mousemove", e => {
  if (document.pointerLockElement !== glc) return;
  const zs = lerp(1, WP().zoomSens || 1, P.adsT);
  P.yaw += e.movementX * .0022 * sens * zs;
  P.pitch = clamp(P.pitch - e.movementY * .0022 * sens * zs, -1.45, 1.45);
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== glc && G.state === "play") pauseGame();
});
glc.addEventListener("click", () => { if (G.state === "play" && document.pointerLockElement !== glc) lockPointer(); });

/* ------------------------------- loop ------------------------------- */
let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - last) / 1000 || 0);
  last = t; now = t / 1000;
  if (G.state === "play") {
    updatePlayer(dt); updateEnemies(dt); updateBullets(dt); updateRockets(dt); updateParticles(dt); spawnDirector(dt);
    tickVideoAudio(dt);
    updateHUD(); drawMinimap();
  } else if (G.state === "pause") { updateParticles(dt * .15); tickVideoAudio(dt); }
  else if (G.state === "dead") tickVideoAudio(dt);

  if (G.state !== "menu") { render(G.state === "play" ? dt : .0001); drawOverlay(dt); }
  else {
    gl.clearColor(.035, .033, .022, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    h2.setTransform(1, 0, 0, 1, 0, 0); h2.clearRect(0, 0, vw, vh);
  }
}

/* -------------------------------- boot ------------------------------ */
function bindSens(slider, label) {
  slider.addEventListener("input", () => {
    sens = slider.value / 100;
    $("sens").value = $("sens2").value = slider.value;
    $("sensval").textContent = $("sensval2").textContent = sens.toFixed(2);
  });
}
function buildRoster() {
  const order = [
    ["iguana", "INTUITIVE IGUANA", "Sees it coming. Keeps its distance."],
    ["hermit", "HAPPY HERMIT CRAB", "Shells up. Bullets bounce off."],
    ["termite", "TENACIOUS TERMITE", "Fast. Endless. Rude."],
    ["creativecrab", "CREATIVE CRAB", "Throws paint in your eyes."],
    ["giant", "GENTLE GIANT", "Ground pound. Too big for doorways."],
    ["garyvee", "GARY VAYNERCHUK", "BOSS. Every other floor."],
  ];
  const r = $("roster");
  for (const [key, name, desc] of order) {
    const d = document.createElement("div");
    d.className = "card" + (key === "garyvee" ? " boss" : "");
    d.innerHTML = `<img src="${ART[key]}" alt="${name}"><div class="n">${name}</div><div class="d">${desc}</div>`;
    r.appendChild(d);
  }
}
async function boot() {
  // a mismatch here silently shears collision away from the geometry
  if (MAPW !== W.MAPW || MAPH !== W.MAPH || CELL !== W.CELL)
    throw new Error("world/game grid mismatch");

  resize();
  buildRoster();
  bindSens($("sens"), $("sensval")); bindSens($("sens2"), $("sensval2"));
  TEX.wall = ZONE_TEX.map(z => mkTex(z.wall(), true));
  TEX.floor = ZONE_TEX.map(z => mkTex(z.floor(), true));
  TEX.walls = WALL_SKINS.map(g => mkTex(g(), true));
  TEX.floors = FLOOR_SKINS.map(g => mkTex(g(), true));
  TEX.ceil = ZONE_TEX.map(z => mkTex(z.ceil(), true));
  TEX.panel = mkTex(genPanelZ(0), false);
  TEX.puff = mkTex(genBlob("rgba(255,255,255,1)", false), false);
  TEX.shadow = mkTex(genBlob("rgba(0,0,0,1)", true), false);
  TEX.orb = mkTex(genOrb("#8dff7a", "rgba(60,200,60,.5)"), false);
  TEX.paint = mkTex(genOrb("#ff6bd6", "rgba(120,60,255,.5)"), false);
  TEX.phone = mkTex(genPhone(), false);
  TEX.ammo = mkTex(genCrate("AMMO", "#e2b423", "#c2960f", "◉"), false);
  TEX.health = mkTex(genCrate("MASSIVE GLOW UP", "#f2f0e6", "#d6d3c4", "✚"), false);
  TEX.exit = mkTex(genExit(), false);
  TEX.bezel = mkTex(genBezel(), false);
  TEX.rocket = mkTex(genRocket(), false);
  TEX.water = mkTex(genWater(), true);
  TEX.buttonOn = mkTex(genButton(true), false);
  TEX.buttonOff = mkTex(genButton(false), false);
  TEX.beam = mkTex(genBeam(), false);
  TEX.trail = mkTex(genTrail(), false);
  TEX.ground = mkTex(genGround(), true);
  TEX.facade = mkTex(genFacade(), true);
  TEX.tree = mkTex(genTree(), false);
  initVideo();
  loadProps();
  gunBufs.pistol = buildPistol().mesh.toBuffers(gl);
  gunBufs.mg = buildMachineGun().mesh.toBuffers(gl);
  gunBufs.mgbarrels = buildMinigunBarrels().mesh.toBuffers(gl);
  gunBufs.sniper = buildSniper().mesh.toBuffers(gl);
  gunBufs.rpg = buildRPG().mesh.toBuffers(gl);
  GUN_ICONS = renderGunIcons();
  await loadRigs(gl, mkTex);

  $("startbtn").onclick = () => {
    Snd.init(); Voice.load();
    // this click is the user gesture that lets the wall video autoplay
    if (videoEl) { const pr = videoEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
    attachVideoAudio();
    $("menu").classList.add("hide"); beginRun();
  };
  $("resumebtn").onclick = resumeGame;
  $("quitbtn").onclick = () => { $("pause").classList.add("hide"); $("menu").classList.remove("hide"); G.state = "menu"; };
  $("retrybtn").onclick = () => { $("dead").classList.add("hide"); beginRun(); };
  fetchBoard().then(runs => {
    const host = $("board");
    if (host) host.innerHTML = runs && runs.length
      ? "<h3>FASTEST RUNS</h3>" + boardHTML(runs, null) : "";
  });
  $("startbtn").disabled = false;
  $("startbtn").textContent = "ENTER THE HOUSE";
  requestAnimationFrame(frame);
}
boot();
