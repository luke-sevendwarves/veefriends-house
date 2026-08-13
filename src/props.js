"use strict";
/* =====================================================================
   props.js - the furniture. Same Builder/Mesh toolkit as the guns, drawn
   with the toon+outline program so it sits in the same visual language
   as everything else.

   Each builder returns { mesh, r } where `r` is a collision radius
   (0 means you can walk through it - rugs, chandeliers).
   ===================================================================== */

const WOOD_D = "#4e4639", WOOD = "#6f6556", WOOD_L = "#8b8172";
const CLOTH_R = "#6d4a44", CLOTH_G = "#4a5249", GOLD = "#9c8c62";
const STONE = "#8b857a", STONE_D = "#5e594f", METAL = "#6a6f74";

/* ------------------------------ seating ----------------------------- */
function buildChair() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD), wd = hex(WOOD_D), c = hex(CLOTH_R);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    b.box(sx * .21, .23, sz * .19, .026, .23, .026, wd);
  b.box(0, .48, 0, .24, .035, .22, w);                 // seat frame
  b.box(0, .51, 0, .21, .025, .19, c);                 // cushion
  b.box(0, .86, -.20, .23, .35, .028, w);              // back
  b.box(0, .86, -.185, .19, .30, .018, c);
  b.box(0, 1.06, -.20, .235, .04, .036, wd);           // top rail
  return { mesh: m, r: .34, h: 1.1 };
}

function buildSofa() {
  const m = new Mesh(), b = new Builder(m);
  const c = hex(CLOTH_G), cd = hex("#24382a"), w = hex(WOOD_D);
  b.box(0, .30, 0, 1.02, .17, .42, c);                 // base
  b.box(0, .50, -.30, 1.02, .34, .13, c);              // back
  for (const s of [-1, 1]) b.box(s * .92, .46, 0, .11, .26, .42, cd);   // arms
  for (const s of [-1, 1]) b.box(s * .46, .50, .02, .24, .09, .34, cd); // cushions
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    b.box(sx * .88, .09, sz * .32, .05, .09, .05, w);
  return { mesh: m, r: .95, h: 0.84 };
}

/* ------------------------------ tables ------------------------------ */
function buildTable() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD), wd = hex(WOOD_D), wl = hex(WOOD_L);
  b.box(0, .74, 0, 1.35, .05, .58, wl);                // top
  b.box(0, .68, 0, 1.30, .05, .54, w);                 // apron
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.box(sx * 1.18, .34, sz * .44, .06, .34, .06, wd);
    b.sphere(sx * 1.18, .70, sz * .44, .085, wd, { su: 10, sv: 8 });
  }
  // a candelabra, because it is that kind of house
  b.box(0, .80, 0, .10, .03, .10, hex(GOLD));
  b.tube([0, .80, 0], [0, 1.06, 0], .022, .022, hex(GOLD), { seg: 8 });
  for (const s of [-1, 0, 1]) {
    b.tube([0, 1.02, 0], [s * .13, 1.14, 0], .016, .016, hex(GOLD), { seg: 7 });
    b.tube([s * .13, 1.14, 0], [s * .13, 1.26, 0], .026, .024, hex("#efe6cd"), { seg: 8 });
    b.cone([s * .13, 1.27, 0], [s * .13, 1.34, 0], .022, hex("#ffd76b"), { seg: 7 });
  }
  return { mesh: m, r: 1.30, h: 0.79 };
}

function buildSideboard() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD), wd = hex(WOOD_D), g = hex(GOLD);
  b.box(0, .52, 0, .82, .48, .26, w);
  b.box(0, 1.02, 0, .86, .04, .30, hex(WOOD_L));
  for (const s of [-1, 1]) {
    b.box(s * .40, .52, .27, .38, .40, .02, wd);
    b.sphere(s * .40, .52, .30, .04, g, { su: 8, sv: 6 });
  }
  for (const [sx] of [[-1], [1]]) b.box(sx * .72, .06, 0, .07, .07, .24, wd);
  return { mesh: m, r: .78, h: 1.06 };
}

/* ----------------------------- storage ------------------------------ */
function buildBookshelf() {
  const m = new Mesh(), b = new Builder(m);
  const wd = hex(WOOD_D), w = hex(WOOD);
  b.box(0, 1.05, -.16, .70, 1.05, .04, wd);            // back
  for (const s of [-1, 1]) b.box(s * .67, 1.05, 0, .04, 1.05, .18, wd);
  const bookCols = ["#7d2b2b", "#2f4a37", "#3a4a6b", "#7a5a22", "#5a3a5a", "#8a6a3a"];
  for (let sh = 0; sh < 4; sh++) {
    const y = .38 + sh * .52;
    b.box(0, y, 0, .68, .028, .18, w);
    let x = -.60;
    while (x < .58) {
      const bw = rand(.035, .065), bh = rand(.24, .40);
      b.box(x + bw, y + .03 + bh / 2, 0, bw, bh / 2, .13, hex(pick(bookCols)));
      x += bw * 2 + .012;
    }
  }
  b.box(0, 2.13, 0, .74, .05, .22, w);
  return { mesh: m, r: .70, h: 2.18 };
}

function buildCrate() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex("#6a5230"), wd = hex("#4a3820");
  const s = rand(.34, .46);
  b.box(0, s, 0, s, s, s, w);
  for (const e of [-1, 1]) {
    b.box(0, s, e * s, s * 1.02, s * .1, .02, wd);
    b.box(0, s * .35, e * s, s * 1.02, s * .1, .02, wd);
    b.box(e * s, s, 0, .02, s * .1, s * 1.02, wd);
  }
  return { mesh: m, r: s * 1.15, h: 0.92 };
}

function buildBarrel() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex("#5e4526"), band = hex("#3d3a34");
  b.tube([0, .02, 0], [0, .86, 0], .30, .30, w, { seg: 14 });
  b.ellipsoid(0, .44, 0, .36, .30, .36, w, { su: 16, sv: 10 });
  for (const y of [.16, .44, .72]) b.tube([0, y, 0], [0, y + .05, 0], .345, .345, band, { seg: 14 });
  b.coin([0, .87, 0], [0, 1, 0], .30, .015, hex("#4a3620"), 14);
  return { mesh: m, r: .42, h: 0.9 };
}

/* ----------------------------- fixtures ----------------------------- */
function buildClock() {
  const m = new Mesh(), b = new Builder(m);
  const wd = hex(WOOD_D), w = hex(WOOD), g = hex(GOLD);
  b.box(0, .12, 0, .28, .12, .20, wd);
  b.box(0, .95, 0, .22, .80, .16, w);
  b.box(0, .95, .17, .13, .62, .02, hex("#2a2620"));    // glass
  b.tube([0, .78, .16], [0, 1.12, .16], .012, .012, g, { seg: 7 });
  b.ellipsoid(0, .74, .16, .07, .07, .02, g, { su: 12, sv: 8 });   // pendulum bob
  b.box(0, 1.62, 0, .26, .34, .18, w);                  // hood
  b.coin([0, 1.62, .19], [0, 0, 1], .155, .02, hex("#efe6cd"), 18);
  b.coin([0, 1.62, .21], [0, 0, 1], .165, .012, g, 18);
  b.box(0, 1.62, .215, .012, .10, .01, hex("#221c14"));
  b.box(.05, 1.66, .215, .06, .010, .01, hex("#221c14"));
  b.box(0, 1.84, 0, .30, .06, .22, wd);
  b.cone([0, 1.87, 0], [0, 2.06, 0], .10, g, { seg: 8 });
  return { mesh: m, r: .34, h: 2.06 };
}

function buildFireplace() {
  const m = new Mesh(), b = new Builder(m);
  const st = hex(STONE), sd = hex(STONE_D);
  b.box(0, .90, -.10, 1.00, .90, .30, st);
  b.box(0, .55, .06, .40, .55, .22, hex("#1a1512"));    // the opening
  b.box(0, 1.92, -.08, 1.14, .12, .38, hex("#7a7369"));  // mantel
  for (const s of [-1, 1]) b.box(s * .74, .90, .02, .16, .90, .22, sd);
  // embers
  for (let i = 0; i < 7; i++)
    b.sphere(rand(-.28, .28), rand(.06, .18), rand(-.02, .12), rand(.03, .06),
      hex(pick(["#ff7b2e", "#c8391a", "#ffb64a", "#5a2a18"])), { su: 7, sv: 6 });
  return { mesh: m, r: 1.05, h: 2.04 };
}

function buildChandelier() {
  const m = new Mesh(), b = new Builder(m);
  const g = hex(GOLD), gl = hex("#f4e9c8");
  b.tube([0, 0, 0], [0, -.55, 0], .022, .022, g, { seg: 8 });
  b.ellipsoid(0, -.62, 0, .13, .10, .13, g, { su: 12, sv: 9 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, R = .46;
    const ax = Math.cos(a) * R, az = Math.sin(a) * R;
    b.tube([0, -.62, 0], [ax, -.74, az], .018, .016, g, { seg: 7 });
    b.tube([ax, -.74, az], [ax, -.60, az], .022, .022, g, { seg: 7 });
    b.tube([ax, -.60, az], [ax, -.48, az], .030, .028, gl, { seg: 8 });
    b.cone([ax, -.47, az], [ax, -.38, az], .026, hex("#ffd76b"), { seg: 7 });
    // drops
    b.cone([ax * .74, -.76, az * .74], [ax * .74, -.94, az * .74], .026, hex("#e8f0f4"), { seg: 6 });
  }
  b.cone([0, -.66, 0], [0, -.94, 0], .075, hex("#e8f0f4"), { seg: 10 });
  return { mesh: m, r: 0, h: 0 };
}

function buildPlant() {
  const m = new Mesh(), b = new Builder(m);
  const pot = hex("#8a5a3a"), soil = hex("#2e2318");
  b.tube([0, .02, 0], [0, .40, 0], .22, .28, pot, { seg: 12 });
  b.tube([0, .40, 0], [0, .46, 0], .30, .30, hex("#6f4630"), { seg: 12 });
  b.coin([0, .44, 0], [0, 1, 0], .26, .01, soil, 12);
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), lean = rand(.25, .62), h = rand(.55, 1.15);
    const tipx = Math.cos(a) * lean, tipz = Math.sin(a) * lean;
    b.tube([0, .44, 0], [tipx * .5, .44 + h * .6, tipz * .5], .022, .015,
      hex("#3f6b32"), { seg: 6 });
    b.ellipsoid(tipx, .44 + h, tipz, .20, .05, .09,
      hex(pick(["#4f8a3c", "#3f6b32", "#5d9a44"])), { su: 10, sv: 7 });
  }
  return { mesh: m, r: .34, h: 0.5 };
}

function buildBust() {
  const m = new Mesh(), b = new Builder(m);
  const st = hex("#cfc9bb"), pl = hex(STONE_D);
  b.box(0, .48, 0, .22, .48, .22, pl);
  b.box(0, .98, 0, .26, .04, .26, hex(STONE));
  b.ellipsoid(0, 1.22, 0, .26, .22, .20, st, { su: 16, sv: 12 });   // shoulders
  b.tube([0, 1.30, 0], [0, 1.42, 0], .09, .10, st, { seg: 10 });
  b.ellipsoid(0, 1.56, .01, .17, .21, .18, st, { su: 18, sv: 14 });
  b.ellipsoid(0, 1.52, .17, .05, .07, .06, st, { su: 10, sv: 8 });  // nose
  b.ellipsoid(0, 1.70, -.02, .18, .12, .18, hex("#c2bbab"), { su: 16, sv: 10 });
  return { mesh: m, r: .30, h: 1.8 };
}

function buildBench() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex("#b9b0a0"), wd = hex("#8d8578");
  b.box(0, .44, 0, .84, .05, .24, w);
  for (const s of [-1, 1]) b.box(s * .68, .21, 0, .07, .21, .20, wd);
  b.box(0, .30, 0, .70, .04, .06, wd);
  return { mesh: m, r: .82, h: 0.49 };
}

/* A rug is a flat card - no collision, purely to break up the floor. */
function buildRug() {
  const m = new Mesh(), b = new Builder(m);
  const base = pick(["#6d2a2a", "#2f4257", "#5a4a2a", "#43304a"]);
  b.box(0, .012, 0, 1.5, .012, 1.0, hex(base));
  b.box(0, .020, 0, 1.34, .010, .86, hex("#d8c9a6"));
  b.box(0, .026, 0, 1.20, .008, .74, hex(base));
  b.box(0, .032, 0, .50, .006, .32, hex("#d8c9a6"));
  return { mesh: m, r: 0, h: 0 };
}

const PROP_BUILDERS = {
  chair: buildChair, sofa: buildSofa, table: buildTable, sideboard: buildSideboard,
  bookshelf: buildBookshelf, crate: buildCrate, barrel: buildBarrel, clock: buildClock,
  fireplace: buildFireplace, chandelier: buildChandelier, plant: buildPlant,
  bust: buildBust, bench: buildBench, rug: buildRug,
};

/* What each wing is furnished with. `wall` props get pushed back against a
   wall and turned to face into the room. */
const ZONE_PROPS = [
  { floor: ["sofa", "chair", "rug", "table", "plant"], wall: ["fireplace", "sideboard", "clock", "bookshelf"], ceiling: "chandelier", density: 1.0 },
  { floor: ["bed", "chair", "rug", "dustsheet"],       wall: ["wardrobe", "sideboard", "clock"],               ceiling: "chandelier", density: 1.0 },
  { floor: ["crate", "barrel", "crate"],               wall: ["shelfunit", "shelfunit", "sideboard"],          ceiling: null,        density: 1.0 },
  { floor: ["crate", "dustsheet", "chair"],            wall: ["shelfunit", "wardrobe"],                        ceiling: null,        density: .9 },
  { floor: ["bench", "plant", "bench"],                wall: ["sideboard", "wardrobe", "sink"],                ceiling: null,        density: .7 },
];

/* ------------------------- more of the house ------------------------ */
function buildBed() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD_D), sheet = hex("#b9b2a2"), pil = hex("#d8d2c2");
  b.box(0, .22, 0, .70, .22, 1.02, w);
  b.box(0, .46, 0, .66, .10, .98, sheet);
  b.box(0, .56, -.72, .66, .08, .20, pil);
  b.box(0, .74, -1.02, .72, .52, .06, w);              // headboard
  b.box(0, .40, 1.02, .70, .18, .06, w);
  b.box(0, .49, .30, .68, .04, .60, hex("#8a5a5a"));   // blanket
  return { mesh: m, r: .95, h: 0.58 };
}
function buildPiano() {
  const m = new Mesh(), b = new Builder(m);
  const bk = hex("#141210"), wt = hex("#ece6d6"), g = hex(GOLD);
  b.box(0, .58, 0, .78, .18, .48, bk);
  b.box(0, .70, .30, .80, .06, .20, wt);               // keys
  for (let i = -7; i <= 7; i++) b.box(i * .052, .74, .27, .006, .012, .13, bk);
  b.box(0, .80, -.16, .76, .18, .32, bk);
  b.push().translate(0, .96, -.16).rotate(0, -.5, 0);
  b.box(0, 0, 0, .74, .02, .34, bk);                   // raised lid
  b.pop();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    b.box(sx * .68, .24, sz * .38, .05, .24, .05, bk);
  b.box(0, .30, .34, .30, .04, .16, g);                // pedals
  return { mesh: m, r: .82, h: 1.0 };
}
function buildDesk() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD), wd = hex(WOOD_D);
  b.box(0, .74, 0, .74, .04, .38, hex(WOOD_L));
  b.box(-.42, .42, 0, .26, .34, .34, w);
  for (let i = 0; i < 3; i++) b.box(-.42, .28 + i * .18, .35, .22, .06, .02, wd);
  b.box(.62, .38, 0, .05, .38, .34, wd);
  b.box(.20, .80, -.10, .16, .02, .12, hex("#d8d2c2"));  // papers
  b.box(.30, .84, .02, .07, .07, .07, hex("#2b3a4a"));
  return { mesh: m, r: .72, h: 0.79 };
}
function buildWardrobe() {
  const m = new Mesh(), b = new Builder(m);
  const w = hex(WOOD), wd = hex(WOOD_D), g = hex(GOLD);
  b.box(0, 1.02, 0, .55, 1.02, .28, w);
  for (const s of [-1, 1]) {
    b.box(s * .27, 1.02, .29, .26, .92, .02, wd);
    b.sphere(s * .10, 1.02, .32, .035, g, { su: 8, sv: 6 });
  }
  b.box(0, 2.08, 0, .60, .06, .32, wd);
  return { mesh: m, r: .58, h: 2.14 };
}
function buildSink() {
  const m = new Mesh(), b = new Builder(m);
  const por = hex("#e6e4dc"), mt = hex(METAL);
  b.box(0, .40, 0, .34, .40, .22, por);
  b.box(0, .84, 0, .40, .06, .28, por);
  b.box(0, .80, 0, .26, .06, .18, hex("#c9c6bc"));
  b.tube([0, .86, -.08], [0, 1.02, -.08], .022, .022, mt, { seg: 8 });
  b.tube([0, 1.02, -.08], [0, 1.02, .02], .020, .018, mt, { seg: 8 });
  b.box(0, 1.42, -.13, .26, .32, .04, hex("#b8c4c6"));  // mirror
  return { mesh: m, r: .40, h: 0.9 };
}
function buildDustSheet() {
  const m = new Mesh(), b = new Builder(m);
  const c = hex("#cdc7b6"), cd = hex("#b3ac9c");
  b.ellipsoid(0, .40, 0, .62, .40, .48, c, { su: 18, sv: 12 });
  b.ellipsoid(-.22, .62, -.12, .28, .24, .24, cd, { su: 14, sv: 10 });
  b.box(0, .04, 0, .66, .04, .52, cd);
  return { mesh: m, r: .62, h: 0.82 };
}
function buildShelfUnit() {
  const m = new Mesh(), b = new Builder(m);
  const mt = hex("#4e5257"), md = hex("#3a3e42");
  for (const s of [-1, 1]) b.box(s * .48, .90, 0, .04, .90, .22, md);
  for (let i = 0; i < 4; i++) b.box(0, .22 + i * .52, 0, .48, .022, .22, mt);
  for (let i = 0; i < 7; i++)
    b.box(rand(-.36, .36), .28 + randi(4) * .52, rand(-.1, .1), rand(.06, .12), .09, rand(.05, .09),
      hex(pick(["#6a5230", "#4a5240", "#5a4030", "#3f4a52"])));
  return { mesh: m, r: .52, h: 1.82 };
}
Object.assign(PROP_BUILDERS, {
  bed: buildBed, piano: buildPiano, desk: buildDesk, wardrobe: buildWardrobe,
  sink: buildSink, dustsheet: buildDustSheet, shelfunit: buildShelfUnit,
});

/* Named room types, so a house reads as bedrooms and studies rather than
   an endless run of identical lounges. Each is [floor props, wall props]. */
/* A mansion is a set of named rooms, not a grid of furnished boxes. `dark`
   pulls the lighting down for the rooms that ought to be unpleasant, `lamp`
   pushes it up for the ones that are still lived in. zones are storeys:
   0 ground, 1 bedroom floor, 2 attic, 3 spare, 4 poolside. */
const ROOM_TYPES = [
  // ---- ground floor ----
  { name: "THE GRAND HALL",  zones: [0], big: true,  lamp: 1.25, floor: ["rug", "bust", "plant"],        wall: ["clock", "sideboard", "bust"] },
  { name: "THE BALLROOM",    zones: [0], big: true,  lamp: 1.15, floor: ["chair", "chair", "rug"],       wall: ["sideboard", "clock"] },
  { name: "THE DRAWING ROOM",zones: [0],             lamp: 1.0,  floor: ["sofa", "chair", "rug", "plant"],wall: ["fireplace", "sideboard", "clock"] },
  { name: "THE DINING ROOM", zones: [0],             lamp: 1.0,  floor: ["table", "chair", "chair"],     wall: ["sideboard", "fireplace"] },
  { name: "THE KITCHEN",     zones: [0],             lamp: .95,  floor: ["table", "crate"],              wall: ["sink", "shelfunit", "sideboard"] },
  { name: "THE SCULLERY",    zones: [0], dark: .55,  floor: ["crate", "barrel"],                          wall: ["sink", "shelfunit"] },
  { name: "THE LIBRARY",     zones: [0, 1],          lamp: .85,  floor: ["chair", "rug", "bust"],        wall: ["bookshelf", "bookshelf", "bookshelf"] },
  { name: "THE STUDY",       zones: [0, 1],          lamp: .9,   floor: ["desk", "chair", "rug"],        wall: ["bookshelf", "bookshelf"] },
  { name: "THE MUSIC ROOM",  zones: [0, 1],          lamp: .85,  floor: ["piano", "chair", "rug"],       wall: ["sideboard", "bookshelf"] },
  { name: "THE BILLIARD ROOM", zones: [0],           lamp: .9,   floor: ["table", "chair", "rug"],       wall: ["sideboard", "clock"] },
  { name: "THE SMOKING ROOM",zones: [0], dark: .75,  floor: ["sofa", "chair", "rug"],                     wall: ["fireplace", "bust"] },
  { name: "THE TROPHY ROOM", zones: [0], dark: .8,   floor: ["bust", "bust", "rug"],                      wall: ["bust", "sideboard"] },
  { name: "THE CONSERVATORY",zones: [0],             lamp: 1.1,  floor: ["plant", "plant", "bench"],     wall: ["plant", "sideboard"] },
  { name: "THE GALLERY",     zones: [0, 1],          lamp: .8,   floor: ["bust", "bench", "rug"],        wall: ["bust", "clock"] },
  { name: "THE CHAPEL",      zones: [0, 1], dark: .5, floor: ["bench", "bench", "bust"],                  wall: ["clock", "bust"] },
  // ---- bedroom floor ----
  { name: "THE MASTER BEDROOM", zones: [1],          lamp: 1.0,  floor: ["bed", "rug", "chair"],         wall: ["wardrobe", "sideboard", "clock"] },
  { name: "A GUEST BEDROOM", zones: [1],             lamp: .85,  floor: ["bed", "rug"],                  wall: ["wardrobe", "sideboard"] },
  { name: "THE NURSERY",     zones: [1], dark: .7,   floor: ["bed", "chair", "rug"],                      wall: ["wardrobe", "shelfunit"] },
  { name: "THE BATHROOM",    zones: [0, 1],          lamp: .9,   floor: ["bench"],                       wall: ["sink", "sink", "wardrobe"] },
  { name: "THE LINEN ROOM",  zones: [1], dark: .8,   floor: ["dustsheet", "crate"],                        wall: ["shelfunit", "wardrobe"] },
  { name: "THE SEWING ROOM", zones: [1],             lamp: .8,   floor: ["desk", "chair"],               wall: ["shelfunit", "sideboard"] },
  { name: "THE SICK ROOM",   zones: [1], dark: .55,  floor: ["bed", "chair"],                             wall: ["sink", "sideboard"] },
  { name: "THE DRESSING ROOM", zones: [1],           lamp: .85,  floor: ["chair", "rug"],                wall: ["wardrobe", "wardrobe", "sink"] },
  // ---- attic and spare ----
  { name: "THE ATTIC",       zones: [2, 3], dark: .6, floor: ["dustsheet", "crate", "chair"],             wall: ["wardrobe", "shelfunit"] },
  { name: "THE OLD NURSERY", zones: [2], dark: .5,   floor: ["bed", "dustsheet", "chair"],                 wall: ["wardrobe", "shelfunit"] },
  { name: "SERVANTS' QUARTERS", zones: [2], dark: .7, floor: ["bed", "bed", "chair"],                      wall: ["wardrobe", "shelfunit"] },
  { name: "THE LUMBER ROOM", zones: [2, 3], dark: .55, floor: ["crate", "crate", "dustsheet"],             wall: ["shelfunit", "shelfunit"] },
  { name: "THE WATER TANK",  zones: [2], dark: .5,   floor: ["barrel", "barrel"],                          wall: ["shelfunit"] },
  { name: "THE DARKROOM",    zones: [2], dark: .35,  floor: ["desk", "crate"],                             wall: ["shelfunit", "sink"] },
  { name: "THE TAXIDERMY ROOM", zones: [2], dark: .45, floor: ["bust", "crate", "bench"],                  wall: ["shelfunit", "bust"] },
  { name: "A LOCKED ROOM",   zones: [2, 3], dark: .3, floor: ["dustsheet", "chair"],                       wall: ["wardrobe"] },
  { name: "THE STOREROOM",   zones: [2, 3], dark: .7, floor: ["crate", "crate", "barrel"],                 wall: ["shelfunit", "shelfunit"] },
  { name: "THE WINE CELLAR", zones: [2], dark: .5,   floor: ["barrel", "barrel", "crate"],                 wall: ["shelfunit", "sideboard"] },
  // ---- around the pool ----
  { name: "POOLSIDE",        zones: [4],             lamp: .9,   floor: ["bench", "plant"],              wall: ["sideboard", "wardrobe"] },
  { name: "THE CHANGING ROOM", zones: [4], dark: .7, floor: ["bench", "bench"],                            wall: ["wardrobe", "sink"] },
];
