#!/usr/bin/env python3
"""Clean the Vision cutouts into game-ready sprites and emit assets.js.

Steps per sprite:
  1. keep only significant connected components (drops stray card fragments)
  2. harden the alpha edge (removes the soft background halo Vision leaves)
  3. bleed edge colours outward so linear filtering never samples black
  4. trim to bbox, pad, resize to a sane sprite size
Finally everything is base64'd into assets.js as data URIs so the game runs
from file:// without tripping WebGL's cross-origin texture rules.
"""
import base64
import io
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, "assets", "cut")
FINAL = os.path.join(ROOT, "assets", "final")
OUT_JS = os.path.join(ROOT, "assets.js")

# The Gentle Giant reference has him standing on a VeeFriends trading card. Vision
# lifts the card along with him (it touches his boot), so it gets scrubbed by colour
# inside a normalised region - the card is yellow/white/board-orange, none of which
# his green pants, brown boot or tan skin come close to.
SCRUB = {
    # main card body, then a lower band for the card's edge strands. The lower band
    # skips the near-white rule because his sock is white and sits in that band.
    "giant": [dict(fx=0.545, fy=0.728),
              dict(fx=0.330, fy=0.860, paper_rule=False),
              # last strands sit right of his back boot; nothing of his is in here
              dict(fx=0.500, fy=0.879, everything=True)],
}


def scrub_card(arr, fx, fy, paper_rule=True, everything=False):
    h, w, _ = arr.shape
    rgb = arr[..., :3].astype(int)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lo = rgb.min(axis=2)
    hi = rgb.max(axis=2)

    xs = np.arange(w)[None, :] > w * fx
    ys = np.arange(h)[:, None] > h * fy
    region = xs & ys

    yellow = (R > 230) & (G > 200) & (B < 230)
    board = (R > 150) & (R < 220) & (G > 70) & (G < 135) & (B < 75)
    if everything:
        match = np.ones(R.shape, bool)
    else:
        match = yellow | board
        if paper_rule:
            match = match | (lo > 185)
    card = region & match & (arr[..., 3] > 0)

    # swallow the card's black outline where it borders what we just removed
    dark = region & (hi < 95)
    for _ in range(2):
        grown = card.copy()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            grown |= np.roll(np.roll(card, dy, 0), dx, 1)
        card |= grown & dark
    arr[..., 3] = np.where(card, 0, arr[..., 3])
    return arr, int(card.sum())


# name -> (max sprite dimension, keep-component threshold as fraction of largest)
SPRITES = {
    "iguana":       (384, 0.30),
    "giant":        (448, 0.60),
    "hermit":       (384, 0.30),
    "termite":      (320, 0.30),
    "creativecrab": (384, 0.30),
    "garyvee":      (448, 0.50),
}


def components(mask):
    """Label 8-connected components of a boolean mask. Returns (labels, areas)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    areas = [0]
    cur = 0
    nbr = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or labels[sy, sx]:
                continue
            cur += 1
            n = 0
            q = deque([(sy, sx)])
            labels[sy, sx] = cur
            while q:
                y, x = q.popleft()
                n += 1
                for dy, dx in nbr:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = cur
                        q.append((ny, nx))
            areas.append(n)
    return labels, areas


def bleed(rgb, mask, passes=10):
    """Push opaque colour outward into transparent pixels to kill edge halos."""
    rgb = rgb.astype(np.float32).copy()
    m = mask.copy()
    shifts = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
    for _ in range(passes):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(m.shape, np.float32)
        for dy, dx in shifts:
            s = np.roll(np.roll(rgb, dy, 0), dx, 1)
            sm = np.roll(np.roll(m, dy, 0), dx, 1).astype(np.float32)
            acc += s * sm[..., None]
            cnt += sm
        fill = (~m) & (cnt > 0)
        if not fill.any():
            break
        rgb[fill] = acc[fill] / cnt[fill][..., None]
        m = m | fill
    return rgb


def process(name, max_dim, keep_frac):
    im = Image.open(os.path.join(CUT, name + ".png")).convert("RGBA")
    arr = np.array(im)

    for rule in SCRUB.get(name, []):
        arr, n = scrub_card(arr, **rule)
        print(f"    scrubbed {n} card px")

    rgb = arr[..., :3].astype(np.float32)
    a = arr[..., 3].astype(np.float32)

    # 1. drop detached junk (card corners, starburst shards)
    solid = a > 110
    labels, areas = components(solid)
    if len(areas) > 1:
        biggest = max(areas[1:])
        keep = {i for i, n in enumerate(areas) if i > 0 and n >= biggest * keep_frac}
        dropped = [n for i, n in enumerate(areas) if i > 0 and i not in keep]
        keepmask = np.isin(labels, list(keep))
        # grow the kept mask slightly so we don't clip the antialiased rim
        grown = keepmask.copy()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            grown |= np.roll(np.roll(keepmask, dy, 0), dx, 1)
        for _ in range(2):
            g2 = grown.copy()
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                g2 |= np.roll(np.roll(grown, dy, 0), dx, 1)
            grown = g2
        a = np.where(grown, a, 0.0)
        if dropped:
            print(f"    dropped {len(dropped)} stray component(s): {sorted(dropped, reverse=True)[:6]} px")

    # 2. harden the edge: remap alpha so faint background fringe goes fully clear
    a = np.clip((a - 34.0) * (255.0 / (255.0 - 60.0)), 0, 255)

    # 3. bleed colours outward
    rgb = bleed(rgb, a > 8)

    out = np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")

    # 4. trim + pad + resize
    bbox = im.split()[3].point(lambda v: 255 if v > 6 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    pad = 8
    padded = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    padded.paste(im, (pad, pad))
    im = padded
    if max(im.size) > max_dim:
        s = max_dim / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

    os.makedirs(FINAL, exist_ok=True)
    im.save(os.path.join(FINAL, name + ".png"), optimize=True)
    return im


def main():
    data = {}
    meta = {}
    for name, (max_dim, keep_frac) in SPRITES.items():
        print(f"  {name}")
        im = process(name, max_dim, keep_frac)
        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        raw = buf.getvalue()
        data[name] = "data:image/png;base64," + base64.b64encode(raw).decode()
        meta[name] = [im.width, im.height]
        print(f"    -> {im.width}x{im.height}  {len(raw)/1024:.0f} KB")

    with open(OUT_JS, "w") as f:
        f.write("// Generated by tools/build_assets.py - do not edit by hand.\n")
        f.write("// VeeFriends character art, background-removed via macOS Vision, inlined\n")
        f.write("// as data URIs so WebGL can texture from them over file://.\n")
        f.write("const ART = " + json.dumps(data) + ";\n")
        f.write("const ART_SIZE = " + json.dumps(meta) + ";\n")
    total = os.path.getsize(OUT_JS)
    print(f"\nassets.js written: {total/1024:.0f} KB")


if __name__ == "__main__":
    main()
