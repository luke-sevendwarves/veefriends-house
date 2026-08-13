#!/usr/bin/env python3
"""Cut each character cutout into rigged body parts.

Hand-tracing polygons around thin limbs is miserable, so instead each part
gets a seed point and every opaque pixel is assigned to the nearest seed by
*geodesic* distance (BFS through the silhouette, not straight-line). Distance
measured inside the shape naturally follows an arm or an antenna out to its
tip, so limbs come away cleanly with only one seed each.

Outputs parts.js: per part a cropped PNG data URI, its offset in the original
image, its pivot, its parent, and its draw order.
"""
import base64
import io
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "final")
OUT = os.path.join(ROOT, "assets", "parts")
OUT_JS = os.path.join(ROOT, "parts.js")

# name: (seed x, seed y, pivot x, pivot y, parent, z-order)
# Coordinates are in the source PNG's pixel space, read off a 20px grid.
# z: negative draws behind the body, positive in front.
RIGS = {
    "termite": {
        "parts": {
            "body":  ([(108, 250), (108, 290)], (108, 205), None,   0),
            "head":  ([(108, 130)],             (108, 205), "body", 1),
            "antL":  ([(52, 18)],               (88, 104),  "head", -1),
            "antR":  ([(162, 15)],              (128, 104), "head", -1),
            "legL":  ([(28, 262)],              (76, 212),  "body", 2),
            "legR":  ([(188, 262)],             (140, 212), "body", 2),
        },
    },
    "hermit": {
        "parts": {
            # the lower claw sits between the legs; geodesically it is part of
            # that cluster, so it rides along with them rather than fighting.
            "body":   ([(190, 225), (215, 190)], (190, 300), None,   0),
            "shell":  ([(170, 80)],              (180, 190), "body", -1),
            "clawUp": ([(300, 80)],              (250, 190), "body", 2),
            "legs":   ([(95, 320), (215, 320)],  (170, 290), "body", -2),
        },
    },
    "creativecrab": {
        "parts": {
            "body":  ([(250, 150), (215, 205), (280, 90)], (250, 250), None,   0),
            "clawR": ([(352, 55)],                          (310, 140), "body", 2),
            "clawL": ([(48, 132), (95, 95)],                (195, 165), "body", 2),
            "legsL": ([(180, 305)],                         (215, 235), "body", -1),
            "legsR": ([(325, 300)],                         (285, 240), "body", -1),
        },
    },
    "iguana": {
        "parts": {
            "body": ([(140, 165), (140, 195)], (140, 215), None,   0),
            "head": ([(150, 72), (140, 105)],  (145, 125), "body", 1),
            "armL": ([(28, 100)],              (108, 118), "body", 2),
            "armR": ([(210, 106)],             (176, 118), "body", 2),
            "tail": ([(38, 205)],              (112, 195), "body", -1),
            "legL": ([(122, 248)],             (130, 200), "body", 1),
            "legR": ([(185, 240)],             (163, 198), "body", 1),
        },
    },
    "giant": {
        "parts": {
            "body":   ([(215, 265), (200, 300)],             (215, 330), None,   0),
            "head":   ([(200, 105), (160, 140), (170, 182)], (205, 212), "body", 1),
            "armUp":  ([(52, 118), (95, 178), (135, 205)],   (170, 215), "body", 2),
            "tree":   ([(80, 48)],                           (95, 92),   "armUp", 3),
            "armOut": ([(330, 275)],                         (272, 250), "body", 2),
            "legF":   ([(125, 345)],                         (185, 302), "body", 1),
            "legB":   ([(190, 400), (228, 335)],             (228, 302), "body", -1),
        },
    },
    "garyvee": {
        "parts": {
            "body": ([(190, 310)], (190, 388), None,   0),
            "head": ([(190, 120)], (190, 252), "body", 1),
        },
    },
}


def watershed(alpha, seeds):
    """Label every opaque pixel with the geodesically nearest seed."""
    h, w = alpha.shape
    solid = alpha > 90
    lab = np.full((h, w), -1, np.int16)
    q = deque()
    for i, (sx, sy) in enumerate(seeds):
        # nudge the seed to the nearest solid pixel if it landed in a hole
        if not solid[sy, sx]:
            best, bd = None, 1e9
            ys, xs = np.where(solid)
            d = (xs - sx) ** 2 + (ys - sy) ** 2
            k = int(np.argmin(d))
            sx, sy = int(xs[k]), int(ys[k])
        lab[sy, sx] = i
        q.append((sy, sx))
    while q:
        y, x = q.popleft()
        v = lab[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and lab[ny, nx] < 0:
                lab[ny, nx] = v
                q.append((ny, nx))
    return lab, solid


def main():
    os.makedirs(OUT, exist_ok=True)
    out = {}
    for name, rig in RIGS.items():
        im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
        arr = np.array(im)
        alpha = arr[..., 3]
        pnames = list(rig["parts"].keys())
        seeds, owner = [], []
        for i, p in enumerate(pnames):
            for sx, sy in rig["parts"][p][0]:
                seeds.append((sx, sy)); owner.append(i)
        raw_lab, solid = watershed(alpha, seeds)
        lab = np.full(raw_lab.shape, -1, np.int16)
        for k, o in enumerate(owner):
            lab[raw_lab == k] = o

        print(f"  {name} {im.size}")
        parts = {}
        for i, p in enumerate(pnames):
            _seeds, (px, py), parent, z = rig["parts"][p]
            mask = lab == i
            n = int(mask.sum())
            if n < 40:
                print(f"    !! {p} claimed only {n}px - check its seed")
                continue
            sub = arr.copy()
            # a couple of pixels of overlap hides hairline seams between parts
            grown = mask.copy()
            for _ in range(2):
                g = grown.copy()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    g |= np.roll(np.roll(grown, dy, 0), dx, 1)
                grown = g & solid
            sub[..., 3] = np.where(grown, alpha, 0)
            pim = Image.fromarray(sub)
            bbox = pim.split()[3].point(lambda v: 255 if v > 6 else 0).getbbox()
            if not bbox:
                continue
            crop = pim.crop(bbox)
            crop.save(os.path.join(OUT, f"{name}_{p}.png"), optimize=True)
            buf = io.BytesIO()
            crop.save(buf, "PNG", optimize=True)
            raw = buf.getvalue()
            parts[p] = {
                "img": "data:image/png;base64," + base64.b64encode(raw).decode(),
                "x": bbox[0], "y": bbox[1], "w": crop.width, "h": crop.height,
                "px": px, "py": py, "parent": parent, "z": z,
            }
            print(f"    {p:8s} {n:6d}px  {crop.width}x{crop.height} @{bbox[0]},{bbox[1]}  {len(raw)/1024:.0f}KB")
        out[name] = {"w": im.width, "h": im.height, "parts": parts}

    with open(OUT_JS, "w") as f:
        f.write("// Generated by tools/rig.py - do not edit by hand.\n")
        f.write("// Each VeeFriends cutout, split into rigged body parts.\n")
        f.write("const PARTS = " + json.dumps(out) + ";\n")
    print(f"\nparts.js written: {os.path.getsize(OUT_JS)/1024:.0f} KB")

    # verification sheet: every part tinted a different colour
    COLS = [(230, 60, 60), (60, 170, 230), (250, 200, 40), (120, 220, 90),
            (220, 110, 220), (250, 150, 40), (90, 110, 240), (40, 210, 190)]
    sheets = []
    for name, rig in RIGS.items():
        im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
        arr = np.array(im)
        pnames = list(rig["parts"].keys())
        seeds, owner = [], []
        for i, p in enumerate(pnames):
            for sx, sy in rig["parts"][p][0]:
                seeds.append((sx, sy)); owner.append(i)
        raw_lab, solid = watershed(arr[..., 3], seeds)
        lab = np.full(raw_lab.shape, -1, np.int16)
        for k, o in enumerate(owner):
            lab[raw_lab == k] = o
        vis = np.full(arr.shape, 255, np.uint8)
        for i in range(len(pnames)):
            m = lab == i
            c = COLS[i % len(COLS)]
            base = arr[..., :3].astype(float)
            tint = np.array(c, float)
            vis[..., :3][m] = (base[m] * 0.45 + tint * 0.55).astype(np.uint8)
        vis[..., 3] = 255
        vimg = Image.fromarray(vis)
        vd = ImageDraw.Draw(vimg)
        for i, p in enumerate(pnames):
            for sx, sy in rig["parts"][p][0]:
                vd.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=(0, 0, 0), outline=(255, 255, 255))
                vd.text((sx + 7, sy - 6), p, fill=(0, 0, 0))
        sheets.append((name, vimg))
    cw = max(s.width for _, s in sheets) + 8
    ch = max(s.height for _, s in sheets) + 8
    cols = 3
    sheet = Image.new("RGB", (cw * cols, ch * ((len(sheets) + cols - 1) // cols)), (240, 240, 244))
    for i, (n, s) in enumerate(sheets):
        sheet.paste(s.convert("RGB"), ((i % cols) * cw + 4, (i // cols) * ch + 4))
    sheet.save("/private/tmp/claude-501/-Users-lfact/f30bfbc3-89e7-40bf-a019-f9784919cc08/scratchpad/partmap.png")
    print("part map written")


if __name__ == "__main__":
    main()
