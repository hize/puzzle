#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the full level pack (20 beginner / 50 intermediate / 100 advanced).

Levels are produced by reverse-generation (pull boxes backwards from the solved
state, which guarantees solvability) and then graded with an A* solver that
minimises the number of pushes.

Usage:
    python3 scripts/build_levels.py                  # 全部难度
    python3 scripts/build_levels.py --tier beginner  # 只生成某一档
    python3 scripts/build_levels.py --jobs 8         # 指定并行进程数
"""

import argparse
import collections
import json
import os
import random
import sys
import time
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sokoban import Board, crop, generate_level, solve, to_text  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TIERS = collections.OrderedDict([
    ("beginner", {
        "count": 20,
        "boxes": (1, 2),
        "pulls": (10, 40),
        "size": (6, 9),
        "wall": (0.10, 0.22),
        "bias": (0.00, 0.35),
        "push_range": (3, 14),
        "solve_seconds": 3.0,
        "solve_nodes": 150000,
        "label": "初级",
    }),
    ("intermediate", {
        "count": 50,
        "boxes": (2, 4),
        "pulls": (24, 90),
        "size": (8, 11),
        "wall": (0.16, 0.30),
        "bias": (0.30, 0.65),
        "push_range": (10, 18),
        "solve_seconds": 5.0,
        "solve_nodes": 300000,
        "label": "中级",
    }),
    ("advanced", {
        "count": 100,
        "boxes": (4, 7),
        "pulls": (50, 170),
        "size": (10, 13),
        "wall": (0.18, 0.32),
        "bias": (0.60, 0.90),
        "push_range": (19, 10 ** 9),
        "solve_seconds": 6.0,
        "solve_nodes": 400000,
        "allow_estimate": True,
        "estimate_ratio": 0.45,
        "label": "高级",
    }),
])


# --------------------------------------------------------------------------- #
# worker (runs inside a subprocess)
# --------------------------------------------------------------------------- #
def make_candidate(seed, name):
    cfg = TIERS[name]
    rng = random.Random(seed)

    width = rng.randint(*cfg["size"])
    height = rng.randint(*cfg["size"])
    n_boxes = rng.randint(*cfg["boxes"])
    n_pulls = rng.randint(*cfg["pulls"])
    wall_ratio = rng.uniform(*cfg["wall"])
    goal_bias = rng.uniform(*cfg["bias"])

    result = generate_level(rng, width, height, n_boxes, n_pulls, wall_ratio,
                            goal_bias=goal_bias)
    if result is None:
        return None

    board, goals, boxes, player, moves = result
    cropped = crop(width, height, board.walls, goals, boxes, player)
    if cropped is None:
        return None
    cw, ch, cwalls, cgoals, cboxes, cplayer = cropped
    if cw < 4 or ch < 4:
        return None

    estimated = sum(1 for c in moves if c.isupper())
    cboard = Board(cw, ch, cwalls)
    sol = solve(cboard, cgoals, cboxes, cplayer,
                max_nodes=cfg["solve_nodes"],
                max_seconds=cfg["solve_seconds"])

    if sol is None:
        if not cfg.get("allow_estimate"):
            return None
        pushes = max(1, int(round(estimated * cfg.get("estimate_ratio", 0.6))))
        exact = False
    else:
        pushes = sol["pushes"]
        exact = True

    if pushes <= 0:
        return None

    lo, hi = cfg["push_range"]
    if not (lo <= pushes <= hi):
        return None

    rows = to_text(cw, ch, cwalls, cgoals, cboxes, cplayer)
    return {
        "width": cw,
        "height": ch,
        "map": rows,
        "boxes": len(cboxes),
        "pushes": pushes,
        "exact": exact,
        "moves": len(moves) if moves else 0,
        "solution": moves or "",
        "score": pushes * 2 + 6 * len(cboxes),
    }


# --------------------------------------------------------------------------- #
# tier builder
# --------------------------------------------------------------------------- #
def build_tier(name, cfg, seed_base, jobs, verbose=True):
    need = cfg["count"]
    pool_target = int(need * 1.25)          # 多收一点用于排序去重
    max_submit = need * 400
    levels = []
    stats = collections.Counter()
    submitted = 0
    seed = seed_base
    deadline = time.time() + cfg.get("max_seconds", 900)
    t0 = time.time()

    with ProcessPoolExecutor(max_workers=jobs) as pool:
        futures = set()
        while len(levels) < pool_target and submitted < max_submit:
            if time.time() > deadline:
                stats["timeout"] += 1
                break
            while len(futures) < jobs * 3 and submitted < max_submit:
                futures.add(pool.submit(make_candidate, seed, name))
                seed += 1
                submitted += 1

            done, futures = wait(futures, return_when=FIRST_COMPLETED)
            for fut in done:
                try:
                    item = fut.result()
                except Exception:
                    stats["error"] += 1
                    continue
                if item is None:
                    stats["reject"] += 1
                else:
                    levels.append(item)

            if verbose:
                sys.stdout.write(
                    "\r  %s: %d/%d 尝试 %d  %s"
                    % (name, len(levels), pool_target, submitted, dict(stats))
                )
                sys.stdout.flush()

    if verbose:
        sys.stdout.write("\n")

    elapsed = time.time() - t0
    return levels, stats, submitted, elapsed


# --------------------------------------------------------------------------- #
# finalize
# --------------------------------------------------------------------------- #
def finalize(name, cfg, levels):
    levels.sort(key=lambda lv: (lv["score"], lv["pushes"], lv["boxes"]))

    seen = set()
    unique = []
    for lv in levels:
        key = "\n".join(lv["map"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(lv)

    prefix = {"beginner": "B", "intermediate": "I", "advanced": "A"}[name]
    out = []
    for idx, lv in enumerate(unique[:cfg["count"]], start=1):
        lv = dict(lv)
        lv.pop("score", None)
        lv["id"] = "%s%03d" % (prefix, idx)
        lv["index"] = idx
        lv["name"] = "%s 第 %d 关" % (cfg["label"], idx)
        out.append(lv)
    return out


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", action="append", choices=list(TIERS.keys()))
    ap.add_argument("--seed", type=int, default=20261012)
    ap.add_argument("--jobs", type=int, default=0,
                    help="并行进程数，0 表示自动")
    ap.add_argument("--out", default=os.path.join(ROOT, "src", "data", "levels.js"))
    args = ap.parse_args()

    jobs = args.jobs or max(2, min(8, (os.cpu_count() or 4)))
    wanted = args.tier or list(TIERS.keys())
    print("并行进程数: %d" % jobs)

    pack = collections.OrderedDict()
    seed = args.seed
    for name in wanted:
        cfg = TIERS[name]
        print("[%s] 目标 %d 关 ..." % (name, cfg["count"]))
        levels, stats, submitted, elapsed = build_tier(name, cfg, seed, jobs)
        levels = finalize(name, cfg, levels)
        pack[name] = levels
        seed += 5_000_000
        print("[%s] 得到 %d 关 | 尝试 %d 次 | %.1fs | %s"
              % (name, len(levels), submitted, elapsed, dict(stats)))
        if len(levels) < cfg["count"]:
            print("[%s] 警告：数量不足 %d" % (name, cfg["count"]))

    # 与已有文件合并，方便分档生成
    existing = {}
    if os.path.exists(args.out):
        try:
            with open(args.out, "r", encoding="utf-8") as fh:
                raw = fh.read()
            existing = json.loads(raw[raw.index("{"):raw.rindex(";")])
        except Exception:
            existing = {}

    for name in wanted:
        existing[name] = pack[name]
    for name, cfg in TIERS.items():
        if name in existing:
            existing[name] = existing[name][:cfg["count"]]

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    payload = json.dumps(existing, ensure_ascii=False, separators=(",", ":"))
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("/* 由 scripts/build_levels.py 生成，请勿手工修改 */\n")
        fh.write("window.SOKOBAN_LEVELS = ")
        fh.write(payload)
        fh.write(";\n")

    print("已写出 %s (%.1f KB)" % (args.out, len(payload) / 1024.0))
    for name in TIERS:
        if name in existing:
            print("  %-13s %d 关" % (name, len(existing[name])))


if __name__ == "__main__":
    main()
