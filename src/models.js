"use strict";
/* =====================================================================
   models.js - the pistol viewmodel.

   Built from primitives in view space and drawn with the toon/outline
   program, so it reads as a solid object rather than a flat drawing.
   (The characters themselves are rigged cut-outs of the original
   artwork - see rig.js and tools/rig.py.)
   ===================================================================== */

/* =========================== 7. THE PISTOL ========================== */
/* Viewmodel, built in view space: +X right, +Y up, barrel down -Z. */
function buildPistol() {
  const m = new Mesh(), b = new Builder(m);
  const SLIDE = hex("#41474f"), SLIDE_T = hex("#4e555e"), FRAME = hex("#2c3037");
  const GRIP = hex("#1e2125"), GRIP_L = hex("#2b2f35"), SKIN = hex("#d9a97f");
  const SKIN_D = hex("#bd8a63"), NAIL = hex("#eac9a8"), STEEL = hex("#666d76"), BLACK = hex("#0b0c0e");

  // ---- slide ----
  b.box(0, 0.030, -0.105, 0.030, 0.038, 0.150, SLIDE);
  b.box(0, 0.067, -0.105, 0.026, 0.005, 0.150, SLIDE_T);
  b.box(0, 0.030, -0.253, 0.028, 0.034, 0.006, SLIDE_T);
  for (let i = 0; i < 7; i++) {
    b.box(0.0305, 0.030, 0.000 + i * 0.017, 0.0035, 0.030, 0.0045, FRAME);
    b.box(-0.0305, 0.030, 0.000 + i * 0.017, 0.0035, 0.030, 0.0045, FRAME);
  }
  b.box(0, 0.048, -0.150, 0.031, 0.006, 0.055, SLIDE_T);            // ejection port lip
  b.box(0.012, 0.040, -0.150, 0.020, 0.014, 0.048, BLACK);
  // barrel + crown
  b.tube([0, 0.030, -0.250], [0, 0.030, -0.268], 0.020, 0.020, STEEL, { seg: 14 });
  b.tube([0, 0.030, -0.252], [0, 0.030, -0.232], 0.0105, 0.0105, BLACK, { seg: 12 });
  b.tube([0, -0.008, -0.250], [0, -0.008, -0.262], 0.010, 0.010, STEEL, { seg: 10 });  // guide rod
  // sights
  b.box(0, 0.077, -0.242, 0.007, 0.011, 0.011, BLACK);
  b.box(0, 0.079, -0.242, 0.003, 0.006, 0.006, hex("#d8d8d8"));
  b.box(0, 0.077, 0.030, 0.026, 0.011, 0.011, BLACK);
  b.box(0, 0.077, 0.030, 0.005, 0.013, 0.012, SLIDE);

  // ---- frame ----
  b.box(0, -0.010, -0.062, 0.026, 0.028, 0.104, FRAME);
  b.box(0, -0.035, -0.086, 0.024, 0.014, 0.062, FRAME);             // dust cover
  b.box(0, -0.028, 0.038, 0.021, 0.024, 0.016, FRAME);
  // trigger guard
  b.push().translate(0, -0.050, -0.002);
  b.box(0, -0.020, -0.030, 0.010, 0.011, 0.026, FRAME);
  b.box(0, -0.020, 0.034, 0.010, 0.011, 0.014, FRAME);
  b.push().translate(0, -0.026, 0.004).rotate(0, 0, 0);
  b.tube([-0.010, 0, 0], [0.010, 0, 0], 0.010, 0.010, FRAME, { seg: 10 });
  b.pop();
  b.pop();
  b.box(0, -0.042, 0.004, 0.008, 0.017, 0.011, hex("#15171b"));      // trigger
  b.box(0.026, -0.008, 0.026, 0.006, 0.010, 0.020, hex("#1b1e22"));  // slide release

  // ---- grip ----
  b.push().translate(0, -0.052, 0.052).rotate(0, 0.32, 0);
  b.box(0, -0.078, 0, 0.0265, 0.092, 0.033, GRIP);
  for (let i = 0; i < 6; i++) {
    b.box(0.0275, -0.024 - i * 0.026, 0, 0.0025, 0.009, 0.031, GRIP_L);
    b.box(-0.0275, -0.024 - i * 0.026, 0, 0.0025, 0.009, 0.031, GRIP_L);
  }
  b.box(0, -0.172, 0, 0.028, 0.011, 0.035, hex("#101215"));          // magwell
  b.box(0, -0.176, -0.030, 0.020, 0.008, 0.008, hex("#0a0b0d"));
  b.pop();

  // ---- shooting hand ----
  b.push().translate(0.004, -0.052, 0.054).rotate(0, 0.32, 0);
  b.ellipsoid(0, -0.078, 0.032, 0.046, 0.088, 0.041, SKIN, { su: 16, sv: 14 });
  b.ellipsoid(0, -0.156, 0.012, 0.049, 0.046, 0.050, SKIN, { su: 14, sv: 12 });
  for (let i = 0; i < 4; i++) {
    const y = -0.030 - i * 0.037, k = 1 - i * 0.06;
    b.capsule([-0.030, y, -0.026], [0.034, y - 0.004, -0.028], 0.0165 * k, SKIN, { r1: 0.0155 * k, seg: 9 });
    b.sphere(0.041, y - 0.007, -0.021, 0.0165 * k, SKIN_D, { su: 9, sv: 7 });
    b.ellipsoid(0.048, y - 0.009, -0.014, 0.009, 0.010, 0.007, NAIL, { su: 8, sv: 6 });
    b.stroke([[-0.028, y + 0.017, -0.030], [0.030, y + 0.014, -0.032]], 0.0035, SKIN_D, { round: false });
  }
  b.capsule([-0.020, -0.018, 0.048], [-0.032, -0.090, 0.022], 0.026, SKIN, { r1: 0.022, seg: 9 });
  b.capsule([-0.032, -0.090, 0.022], [-0.026, -0.142, -0.008], 0.022, SKIN, { r1: 0.018, seg: 9 });
  b.ellipsoid(-0.024, -0.150, -0.016, 0.014, 0.012, 0.010, NAIL, { su: 8, sv: 6 });
  b.ellipsoid(0, -0.008, 0.060, 0.040, 0.032, 0.032, SKIN, { su: 14, sv: 12 });
  b.pop();
  // forearm running off the bottom of the frame
  b.capsule([0.02, -0.185, 0.135], [0.11, -0.460, 0.360], 0.053, SKIN, { r1: 0.075, seg: 12 });

  return { mesh: m };
}


/* ============================ THE SNIPER ============================ */
/* Bolt-action, long barrel, big scope. Same view space as the pistol:
   +X right, +Y up, barrel down -Z. */
function buildSniper() {
  const m = new Mesh(), b = new Builder(m);
  const BODY = hex("#2f3439"), BODY_L = hex("#3b4147"), STOCK = hex("#4a3a2a");
  const STOCK_D = hex("#3a2d20"), STEEL = hex("#5c636b"), BLACK = hex("#0b0c0e");
  const SCOPE = hex("#1a1d21"), LENS = hex("#8fd8ff"), SKIN = hex("#d9a97f");
  const SKIN_D = hex("#bd8a63"), NAIL = hex("#eac9a8"), BOLT = hex("#6a7279");

  // ---- barrel ----
  b.tube([0, .026, -.10], [0, .026, -.72], .0165, .0135, STEEL, { seg: 14 });
  b.tube([0, .026, -.72], [0, .026, -.755], .020, .020, BLACK, { seg: 14 });
  b.tube([0, .026, -.735], [0, .026, -.70], .0085, .0085, BLACK, { seg: 12 });
  // muzzle brake slots
  for (let i = 0; i < 3; i++) b.box(0, .044, -.63 + i * .045, .012, .006, .012, BLACK);
  // barrel shroud / handguard
  b.box(0, .020, -.30, .030, .030, .175, BODY);
  for (let i = 0; i < 5; i++) b.box(0, .050, -.42 + i * .05, .022, .004, .016, BODY_L);

  // ---- receiver ----
  b.box(0, .016, -.055, .032, .040, .120, BODY);
  b.box(0, .056, -.055, .028, .008, .120, BODY_L);
  b.box(.034, .022, -.03, .006, .020, .05, BLACK);          // ejection port
  // bolt handle sticking out to the right
  b.tube([.030, .030, .028], [.075, .006, .045], .0085, .0085, BOLT, { seg: 10 });
  b.sphere(.079, .002, .048, .015, BOLT, { su: 10, sv: 8 });
  // magazine
  b.box(0, -.040, -.020, .022, .034, .040, BLACK);

  // ---- scope ----
  b.box(-.016, .080, -.10, .008, .020, .016, BODY_L);        // front ring
  b.box(.016, .080, -.10, .008, .020, .016, BODY_L);
  b.box(-.016, .080, .015, .008, .020, .016, BODY_L);        // rear ring
  b.box(.016, .080, .015, .008, .020, .016, BODY_L);
  b.tube([0, .103, -.215], [0, .103, .075], .0225, .0225, SCOPE, { seg: 16 });
  b.tube([0, .103, -.215], [0, .103, -.245], .030, .030, SCOPE, { seg: 16 });   // objective bell
  b.tube([0, .103, .075], [0, .103, .100], .027, .027, SCOPE, { seg: 16 });     // eyepiece
  b.coin([0, .103, -.247], [0, 0, -1], .026, .003, LENS, 18);
  b.coin([0, .103, .102], [0, 0, 1], .023, .003, hex("#22303a"), 18);
  b.tube([0, .103, .020], [0, .103, .040], .030, .030, BODY_L, { seg: 16 });    // turret band
  b.tube([0, .128, .030], [0, .140, .030], .012, .012, BODY_L, { seg: 10 });    // elevation turret
  b.tube([-.030, .103, .030], [-.042, .103, .030], .012, .012, BODY_L, { seg: 10 });

  // ---- stock ----
  b.box(0, .006, .085, .028, .034, .060, STOCK);
  b.push().translate(0, -.004, .150).rotate(0, .10, 0);
  b.box(0, 0, 0, .026, .040, .085, STOCK);
  b.box(0, .038, -.01, .024, .010, .070, STOCK_D);          // cheek rest
  b.pop();
  b.push().translate(0, -.030, .225).rotate(0, .16, 0);
  b.box(0, 0, 0, .028, .050, .045, STOCK);
  b.box(0, -.048, .004, .030, .012, .048, BLACK);           // recoil pad
  b.pop();
  // pistol grip
  b.push().translate(0, -.050, .080).rotate(0, .34, 0);
  b.box(0, -.058, 0, .024, .062, .030, STOCK_D);
  for (let i = 0; i < 4; i++) b.box(.025, -.026 - i * .028, 0, .002, .009, .028, STOCK);
  b.pop();
  b.box(0, -.048, .040, .020, .012, .016, BODY);            // trigger guard
  b.box(0, -.040, .044, .006, .014, .010, BLACK);           // trigger

  // ---- trigger hand ----
  b.push().translate(.004, -.050, .082).rotate(0, .34, 0);
  b.ellipsoid(0, -.058, .026, .042, .066, .038, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 3; i++) {
    const y = -.028 - i * .034;
    b.capsule([-.026, y, -.022], [.030, y - .004, -.024], .0155, SKIN, { r1: .0145, seg: 9 });
    b.sphere(.036, y - .006, -.018, .0155, SKIN_D, { su: 9, sv: 7 });
    b.ellipsoid(.043, y - .008, -.012, .008, .009, .006, NAIL, { su: 8, sv: 6 });
  }
  b.capsule([-.018, -.016, .042], [-.028, -.078, .018], .024, SKIN, { r1: .020, seg: 9 });
  b.pop();
  b.capsule([.02, -.175, .150], [.10, -.430, .350], .050, SKIN, { r1: .072, seg: 12 });

  // ---- support hand on the handguard ----
  b.push().translate(-.005, -.020, -.295);
  b.ellipsoid(0, -.028, 0, .040, .040, .052, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 4; i++) {
    const z = -.040 + i * .030;
    b.capsule([-.030, .010, z], [.030, .008, z], .0135, SKIN, { r1: .0130, seg: 8 });
    b.sphere(.036, .006, z, .0135, SKIN_D, { su: 8, sv: 6 });
  }
  b.capsule([-.026, -.006, -.052], [-.020, -.052, .010], .020, SKIN, { r1: .017, seg: 8 });
  b.pop();
  b.capsule([-.06, -.150, -.230], [-.20, -.430, -.120], .048, SKIN, { r1: .070, seg: 12 });

  return { mesh: m };
}

/* ========================== THE MACHINE GUN ========================= */
/* The six barrels, built about the origin so they can be spun on their own.
   They are drawn as a second pass over the gun, rolled by however far it has
   wound up -- rolling the whole viewmodel turned the hands upside down. */
function buildMinigunBarrels() {
  const m = new Mesh(), b = new Builder(m);
  const STEEL = hex("#8f979f"), STEEL_D = hex("#6a7178"), BLACK = hex("#0b0c0e");
  const BODY = hex("#33383e");
  const R = .030;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const bx = Math.cos(a) * R, by = Math.sin(a) * R;
    b.tube([bx, by, -.150], [bx, by, -.520], .0085, .0085, i % 2 ? STEEL : STEEL_D, { seg: 8 });
    b.coin([bx, by, -.522], [0, 0, -1], .0085, .003, BLACK, 8);
  }
  b.tube([0, 0, -.170], [0, 0, -.500], .008, .008, BLACK, { seg: 8 });      // spindle
  for (const z of [-.200, -.330, -.455])
    b.tube([0, 0, z], [0, 0, z + .022], R + .012, R + .012, BODY, { seg: 16 });
  return { mesh: m };
}

function buildMachineGun() {
  const m = new Mesh(), b = new Builder(m);
  const BODY = hex("#33383e"), BODY_L = hex("#41474e"), POLY = hex("#22262b");
  const STEEL = hex("#8f979f"), STEEL_D = hex("#6a7178"), BLACK = hex("#0b0c0e");
  const BRASS = hex("#a98a3f"), SKIN = hex("#d9a97f"), SKIN_D = hex("#bd8a63");

  b.tube([0, .020, -.150], [0, .020, -.100], .046, .050, BODY_L, { seg: 16 });  // barrel shroud

  // ---- housing behind the cluster ----
  b.box(0, .020, -.030, .052, .052, .080, BODY);
  b.box(0, .020, .046, .046, .046, .060, BODY_L);
  b.tube([.052, .012, -.020], [.052, .012, .050], .022, .022, POLY, { seg: 12 });  // motor
  b.coin([.052, .012, .052], [0, 0, 1], .022, .004, BLACK, 12);
  b.box(-.050, .030, .010, .010, .026, .050, POLY);            // control box
  b.box(-.050, .048, .010, .006, .004, .030, hex("#7fd0ff"));  // its little light

  // ---- ammo belt feeding in from the left ----
  b.box(-.062, -.020, .040, .028, .050, .070, POLY);           // feed chute
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const bx = -.052 - t * .020, by = -.004 - t * .052, bz = .020 + t * .030;
    b.box(bx, by, bz, .009, .007, .016, BRASS);
  }
  b.box(-.090, -.090, .070, .046, .050, .080, POLY);           // the box it comes out of

  // ---- handles ----
  b.push().translate(0, -.050, .080).rotate(0, .30, 0);
  b.box(0, -.052, 0, .022, .056, .028, POLY);                  // rear grip
  b.pop();
  b.box(0, -.030, .048, .016, .012, .016, BODY);
  b.box(0, -.024, .044, .006, .014, .010, BLACK);              // trigger
  b.box(0, .058, -.060, .014, .030, .120, POLY);               // carry handle
  b.box(0, .086, -.060, .034, .010, .120, POLY);

  // ---- both hands on it, because it weighs a ton ----
  b.push().translate(.004, -.050, .082).rotate(0, .30, 0);
  b.ellipsoid(0, -.054, .022, .040, .060, .036, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 3; i++) {
    const y = -.024 - i * .030;
    b.capsule([-.026, y, -.020], [.030, y - .004, -.022], .0150, SKIN, { r1: .0140, seg: 9 });
    b.sphere(.036, y - .006, -.016, .0150, SKIN_D, { su: 9, sv: 7 });
  }
  b.pop();
  b.capsule([.02, -.170, .150], [.10, -.420, .340], .050, SKIN, { r1: .070, seg: 12 });
  b.push().translate(-.004, -.036, -.070);                     // support hand, under the housing
  b.ellipsoid(0, -.026, 0, .038, .038, .046, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 4; i++) {
    const z = -.034 + i * .026;
    b.capsule([-.028, .012, z], [.028, .010, z], .0130, SKIN, { r1: .0125, seg: 8 });
    b.sphere(.034, .008, z, .0130, SKIN_D, { su: 8, sv: 6 });
  }
  b.pop();
  b.capsule([-.06, -.155, -.030], [-.19, -.420, .060], .047, SKIN, { r1: .068, seg: 12 });
  return { mesh: m };
}

/* ============================== THE RPG ============================= */
function buildRPG() {
  const m = new Mesh(), b = new Builder(m);
  const TUBE = hex("#4a5340"), TUBE_D = hex("#3a4232"), BLACK = hex("#0d0f11");
  const WAR = hex("#7a3626"), WAR_D = hex("#5e281c"), STEEL = hex("#5c636b");
  const WOOD = hex("#6b4f30"), SKIN = hex("#d9a97f"), SKIN_D = hex("#bd8a63");

  // launch tube
  b.tube([0, .030, .180], [0, .030, -.330], .038, .038, TUBE, { seg: 18 });
  b.tube([0, .030, .180], [0, .030, .260], .038, .056, TUBE_D, { seg: 18 });   // blast cone
  b.tube([0, .030, .258], [0, .030, .268], .056, .056, BLACK, { seg: 18 });
  b.tube([0, .030, -.330], [0, .030, -.352], .044, .044, TUBE_D, { seg: 18 });
  for (let i = 0; i < 4; i++)
    b.tube([0, .030, -.20 + i * .09], [0, .030, -.19 + i * .09], .042, .042, TUBE_D, { seg: 18 });

  // warhead poking out the front
  b.tube([0, .030, -.352], [0, .030, -.410], .046, .052, WAR, { seg: 16 });
  b.cone([0, .030, -.410], [0, .030, -.500], .052, WAR_D, { seg: 16 });
  b.tube([0, .030, -.352], [0, .030, -.362], .050, .050, hex("#c8b45a"), { seg: 16 });

  // optic on a bracket
  b.box(-.048, .062, -.030, .008, .026, .030, TUBE_D);
  b.push().translate(-.052, .098, -.030).rotate(0, 0, .06);
  b.tube([0, 0, -.055], [0, 0, .050], .017, .017, BLACK, { seg: 14 });
  b.coin([0, 0, -.057], [0, 0, -1], .016, .003, hex("#8fd8ff"), 14);
  b.pop();

  // grips
  b.push().translate(0, -.030, .010).rotate(0, .30, 0);
  b.box(0, -.052, 0, .022, .056, .026, WOOD);
  b.pop();
  b.box(0, -.024, -.020, .016, .014, .016, BLACK);
  b.push().translate(0, -.028, -.150).rotate(0, .18, 0);
  b.box(0, -.046, 0, .020, .050, .024, WOOD);
  b.pop();
  // shoulder rest
  b.box(0, -.006, .150, .030, .016, .044, TUBE_D);

  // hands
  b.push().translate(.004, -.032, .012).rotate(0, .30, 0);
  b.ellipsoid(0, -.050, .024, .038, .058, .034, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 3; i++) {
    const y = -.022 - i * .030;
    b.capsule([-.024, y, -.020], [.028, y - .004, -.022], .0145, SKIN, { r1: .0135, seg: 9 });
    b.sphere(.034, y - .006, -.016, .0145, SKIN_D, { su: 9, sv: 7 });
  }
  b.pop();
  b.capsule([.02, -.160, .090], [.10, -.410, .300], .050, SKIN, { r1: .070, seg: 12 });
  b.push().translate(-.004, -.030, -.148).rotate(0, .18, 0);
  b.ellipsoid(0, -.044, .020, .036, .050, .032, SKIN, { su: 16, sv: 14 });
  for (let i = 0; i < 3; i++) {
    const y = -.020 - i * .028;
    b.capsule([-.024, y, -.018], [.026, y - .004, -.020], .0135, SKIN, { r1: .0125, seg: 8 });
  }
  b.pop();
  b.capsule([-.05, -.150, -.120], [-.18, -.420, -.030], .047, SKIN, { r1: .068, seg: 12 });
  return { mesh: m };
}
