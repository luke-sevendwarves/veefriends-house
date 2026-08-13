# VEEFRIENDS: THE HOUSE

An endless first-person shooter set in a very large, very quiet house. You have a
pistol and a scoped rifle. Everything trying to kill you is alliterative, and Gary
Vaynerchuk lets himself in on a timer.

**To play:** double-click `play.command`. It runs `tools/serve.py`, a
loopback-only dev server that sends `no-store` on everything - plain
`http.server` will happily hand the browser a stale copy of the JS or the video
and make edits look like they did nothing.

| | |
| --- | --- |
| WASD | move |
| mouse | look |
| click | shoot |
| 1 / 2 / Q / wheel | switch weapon |
| E or right-click | scope (rifle only) |
| R | reload |
| Shift | sprint |
| Esc | pause |

There are no levels and no exit. One floor, everything spawning at once, and a
clock. The rate, the cap and enemy health all climb with how long you last.

## How the characters work

The five VeeFriends and Gary are the **actual reference artwork**, not redrawn.
Each image was:

1. **Background-removed** with macOS Vision subject lifting (`tools/cutout.swift`) -
   the same engine behind Preview's "Remove Background".
2. **Cleaned** (`tools/build_assets.py`) - stray components dropped, the soft alpha
   fringe hardened, edge colours bled outward so linear filtering never samples black.
   The Gentle Giant reference had him standing on a trading card, which gets scrubbed
   by colour inside a normalised region.
3. **Cut into body parts** (`tools/rig.py`) - each part gets a seed point and every
   opaque pixel is assigned to the nearest seed by *geodesic* distance (BFS through
   the silhouette, not straight-line), so limbs come away cleanly with one seed each.
   Run it and it also writes a colour-coded part map to the scratchpad for checking.

At runtime `src/rig.js` hangs those parts off each other in a small hierarchy and
poses them every frame - legs swing, antennae wave, claws hammer down on an attack,
the giant's tree swings with his arm. Parts are drawn as camera-facing quads with a
per-part depth offset so limbs layer correctly.

Regenerate assets after editing a tool:

```
swift tools/cutout.swift assets/raw/<name>.png assets/cut/<name>.png
python3 tools/build_assets.py     # -> assets.js
python3 tools/rig.py              # -> parts.js  (+ part map for verification)
```

## Layout

| file | what |
| --- | --- |
| `index.html` | DOM shell, HUD, menus |
| `src/gfx.js` | mat4, mesh builder, the two shader programs (textured world / toon-outlined) |
| `src/models.js` | the pistol viewmodel, built from primitives in view space |
| `src/rig.js` | cut-out character rigs and their animation |
| `src/game.js` | map generation, lighting, AI, combat, loop |
| `assets.js` | whole-character cutouts as data URIs (menu roster) |
| `parts.js` | rigged body parts as data URIs |
| `viewer.html`, `compare.html` | dev pages kept for eyeballing art against the references |

Everything is inlined as data URIs so WebGL can texture from it without tripping
cross-origin rules.

## Screens, spawning and audio

Wall panels throughout the house play `assets/video/screen.mp4` as a live WebGL
texture (muted - it is picture only). The bezel sits closer to the wall than the
picture; if they share a plane the two quads z-fight and the panel flickers.
Panels are culled by distance and by facing.

The clip is cut to 28.9s so the loop drops the tail. `screen.full.mp4` /
`screen.full.m4a` are the untouched originals - to re-cut, change `-t` and
re-run:

```
cd assets/video
ffmpeg -y -i screen.full.mp4 -t 28.9 -c:v libx264 -crf 27 -pix_fmt yuv420p -an -movflags +faststart screen.mp4
ffmpeg -y -i screen.full.m4a -t 28.9 -c:a aac -b:a 128k screen.m4a
```

Keep the `GLOWUP` window inside whatever length you cut to.

Enemies spawn **continuously** from spots you cannot currently see. A Gentle
Giant is always lumbering around somewhere, and Gary arrives on a timer - kill
him and the next one is already on his way.

The clip's audio is decoded once and used two ways:

* a short bite fires whenever an Intuitive Iguana throws a glowing orb
* on boss floors the full clip loops, swelling louder as Gary closes on you

The bite's window is the `GLOWUP` constant at the top of the voice section in
`src/game.js` - `[start, end]` in seconds.

## The house

Rooms come from a BSP split; adjacent rooms share exactly one wall cell, which is
what a doorway punches through. A union-find pass guarantees every room is reachable
and adds a few extra doors for loops. Doorways get a lintel above head height, and
the Gentle Giant is too wide to fit through one - he has to catch you in the open.

Lighting is baked per-vertex from the ceiling fixtures at build time. Roughly a
third of rooms are deliberately left dark.

**Not built yet:** stairs and a split-level layout. That needs a per-cell height
field with the player, enemies and hit detection all working in Y, rather than
everything sitting on one flat plane.

## Note

Affectionate parody. Not affiliated with VeeFriends or Gary Vaynerchuk.
