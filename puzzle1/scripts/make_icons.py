#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render the PWA PNG icons using nothing but the standard library.

Usage:  python3 scripts/make_icons.py
"""

import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "icons")


# --------------------------------------------------------------------------- #
# signed distance helpers
# --------------------------------------------------------------------------- #
def sdf_round_rect(px, py, cx, cy, hw, hh, r):
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    ax = dx if dx > 0 else 0.0
    ay = dy if dy > 0 else 0.0
    return math.hypot(ax, ay) + min(max(dx, dy), 0.0) - r


def sdf_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


def cover(d, softness=1.0):
    """Anti-aliased coverage from a signed distance."""
    return min(max(0.5 - d / softness, 0.0), 1.0)


def mix(c1, c2, t):
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


def over(dst, src, a):
    if a <= 0:
        return dst
    return (
        dst[0] + (src[0] - dst[0]) * a,
        dst[1] + (src[1] - dst[1]) * a,
        dst[2] + (src[2] - dst[2]) * a,
    )


# --------------------------------------------------------------------------- #
# scene
# --------------------------------------------------------------------------- #
def scene(x, y, S):
    """Return (r, g, b, a) in 0..1 for a point in the S x S icon canvas."""
    bg = sdf_round_rect(x, y, S * 0.5, S * 0.5, S * 0.5, S * 0.5, S * 0.226)
    bg_a = cover(bg)
    if bg_a <= 0.0:
        return (0.0, 0.0, 0.0, 0.0)

    # vertical gradient + soft top glow
    t = min(max(y / S, 0.0), 1.0)
    col = mix((0.129, 0.204, 0.353), (0.031, 0.055, 0.110), t)
    glow = max(0.0, 1.0 - math.hypot(x - S * 0.5, y - S * 0.10) / (S * 0.78))
    col = over(col, (0.190, 0.310, 0.540), glow * glow * 0.5)

    # ---- box -------------------------------------------------------------
    bcx, bcy = S * 0.40, S * 0.42
    bh = S * 0.158
    d = sdf_round_rect(x, y, bcx, bcy, bh, bh, S * 0.045)
    a = cover(d)
    if a > 0:
        bt = min(max((y - (bcy - bh)) / (2 * bh), 0.0), 1.0)
        face = mix((0.910, 0.698, 0.451), (0.553, 0.463, 0.224), bt)
        col = over(col, face, a)

        # plank cross
        pw = S * 0.017
        bar_v = sdf_round_rect(x, y, bcx, bcy, pw, bh * 0.98, pw * 0.8)
        bar_h = sdf_round_rect(x, y, bcx, bcy, bh * 0.98, pw, pw * 0.8)
        bar = min(bar_v, bar_h)
        ba = cover(bar) * a * 0.42
        col = over(col, (0.353, 0.216, 0.078), ba)

        edge = cover(abs(d) - S * 0.012) * a
        if edge > 0:
            rim = 1.0 if d <= 0 else 0.0
            col = over(col, (0.0, 0.0, 0.0) if rim else (1.0, 1.0, 1.0),
                       edge * 0.20)

    # ---- player ----------------------------------------------------------
    pcx, pcy, pr = S * 0.655, S * 0.660, S * 0.118
    dist = math.hypot(x - pcx, y - pcy)
    d = dist - pr
    a = cover(d)
    if a > 0:
        rt = min(max(dist / pr, 0.0), 1.0)
        # fake radial shading toward the upper-left
        lt = min(max(math.hypot(x - (pcx - pr * 0.4), y - (pcy - pr * 0.42)) / (pr * 1.7), 0.0), 1.0)
        body = mix((0.714, 0.839, 1.0), (0.141, 0.314, 0.659), lt * 0.95)
        col = over(col, body, a)

        ring = cover(abs(d) - S * 0.011) * a
        if ring > 0:
            col = over(col, (0.663, 0.808, 1.0), ring * 0.55)

        for ex in (-1, 1):
            eye_d = sdf_circle(x, y, pcx + ex * S * 0.036, pcy - S * 0.020,
                               S * 0.015)
            col = over(col, (0.051, 0.090, 0.188), cover(eye_d) * a)

    # ---- goal dot --------------------------------------------------------
    gcx, gcy, gr = S * 0.688, S * 0.293, S * 0.058
    gd = math.hypot(x - gcx, y - gcy)
    a = cover(gd - gr)
    if a > 0:
        gt = min(max(gd / gr, 0.0), 1.0)
        col = over(col, mix((1.0, 0.882, 0.478), (0.910, 0.675, 0.165), gt), a)
    halo = cover(gd - gr * 1.55) * 0.32
    col = over(col, (0.969, 0.788, 0.282), halo)

    return (col[0], col[1], col[2], bg_a)


# --------------------------------------------------------------------------- #
# PNG writer
# --------------------------------------------------------------------------- #
def write_png(path, size):
    rows = []
    for y in range(size):
        row = bytearray()
        yy = y + 0.5
        for x in range(size):
            r, g, b, a = scene(x + 0.5, yy, size)
            row.append(int(min(max(r, 0.0), 1.0) * 255 + 0.5))
            row.append(int(min(max(g, 0.0), 1.0) * 255 + 0.5))
            row.append(int(min(max(b, 0.0), 1.0) * 255 + 0.5))
            row.append(int(min(max(a, 0.0), 1.0) * 255 + 0.5))
        rows.append(bytes(row))

    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = ((180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png"))
    for size, name in targets:
        path = os.path.join(OUT_DIR, name)
        written = write_png(path, size)
        print("  %-16s %dx%d  %.1f KB" % (name, size, size, written / 1024.0))
    print("icons written to", OUT_DIR)


if __name__ == "__main__":
    sys.exit(main())
