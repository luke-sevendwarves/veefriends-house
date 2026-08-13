#!/usr/bin/env node
/* Crude arity check for the floor-aware world API.
   After adding a storey argument to these, any call site left on the old
   signature silently passes the wrong thing. This catches them without
   needing a browser. */
const fs = require("fs");

const want = {
  blocked: 4, slide: 5, groundAt: 3, hasLOS: 5, rayWall: 6,
  lightAt: 4, solid: 3, standHeight: 4, propTop: 4, propBlocked: 4,
};

const lines = fs.readFileSync(process.argv[2] || "src/game.js", "utf8").split("\n");
const bad = [];

lines.forEach((line, i) => {
  if (/^\s*(function\s|const\s+\w+\s*=\s*\()/.test(line)) return;   // definitions
  for (const fn of Object.keys(want)) {
    const re = new RegExp("\\b" + fn + "\\s*\\(", "g");
    let m;
    while ((m = re.exec(line))) {
      let depth = 0, args = 1, closed = false;
      let j = m.index + m[0].length;
      if (line[j] === ")") { args = 0; closed = true; }
      for (; j < line.length && !closed; j++) {
        const c = line[j];
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") {
          if (depth === 0) { closed = true; break; }
          depth--;
        } else if (c === "," && depth === 0) args++;
      }
      if (!closed) continue;                       // call wraps lines; skip
      if (args < want[fn]) {
        bad.push(`  line ${i + 1}: ${fn}() got ${args}, needs ${want[fn]}\n      ${line.trim().slice(0, 96)}`);
      }
    }
  }
});

if (!bad.length) console.log("arity check: no under-supplied calls");
else { console.log("arity check FAILED:"); bad.forEach(b => console.log(b)); process.exitCode = 1; }
