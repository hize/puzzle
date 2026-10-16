#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate src/data/levels.js: 地图结构 + 参考解法可解性。

用法:  python3 scripts/verify_levels.py
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "src", "data", "levels.js")

DIRS = {"u": (0, -1), "r": (1, 0), "d": (0, 1), "l": (-1, 0)}


def check(level):
    rows = level["map"]
    height = len(rows)
    width = max(len(r) for r in rows)

    walls = set()
    goals = set()
    boxes = set()
    player = None

    for y, row in enumerate(rows):
        for x in range(width):
            ch = row[x] if x < len(row) else "#"
            i = y * width + x
            if ch == "#":
                walls.add(i)
            elif ch == ".":
                goals.add(i)
            elif ch == "$":
                boxes.add(i)
            elif ch == "*":
                boxes.add(i)
                goals.add(i)
            elif ch == "@":
                player = i
            elif ch == "+":
                player = i
                goals.add(i)
            elif ch != " ":
                return "非法字符 %r" % ch

    if player is None:
        return "缺少玩家"
    if not boxes:
        return "没有箱子"
    if len(boxes) != len(goals):
        return "箱子 %d 个 / 目标 %d 个 不匹配" % (len(boxes), len(goals))
    if len(boxes) != level["boxes"]:
        return "元数据 boxes=%d 与实际 %d 不符" % (level["boxes"], len(boxes))

    solution = level.get("solution") or ""
    if not solution:
        return None  # 没有参考解法时只做结构校验

    cur_boxes = set(boxes)
    pos = player
    for step, ch in enumerate(solution):
        d = DIRS.get(ch.lower())
        if d is None:
            return "解法第 %d 步含非法方向 %r" % (step, ch)
        dx, dy = d
        x, y = pos % width, pos // width
        nx, ny = x + dx, y + dy
        if not (0 <= nx < width and 0 <= ny < height):
            return "解法第 %d 步越界" % step
        nj = ny * width + nx
        if nj in walls:
            return "解法第 %d 步撞墙" % step
        if nj in cur_boxes:
            bj = (ny + dy) * width + (nx + dx)
            if bj in walls or bj in cur_boxes:
                return "解法第 %d 步箱子推不动" % step
            cur_boxes.discard(nj)
            cur_boxes.add(bj)
        pos = nj

    if cur_boxes != goals:
        return "解法走完后仍有箱子不在目标上"
    return None


def main():
    if not os.path.exists(PATH):
        print("找不到", PATH)
        return 1

    with open(PATH, "r", encoding="utf-8") as fh:
        raw = fh.read()
    pack = json.loads(raw[raw.index("{"):raw.rindex(";")])

    total = 0
    problems = 0
    for tier, levels in pack.items():
        print("[%s] %d 关" % (tier, len(levels)))
        for level in levels:
            total += 1
            err = check(level)
            if err:
                problems += 1
                print("  %s 有问题: %s" % (level.get("id", "?"), err))

    print("-" * 40)
    print("共校验 %d 关，问题 %d 个" % (total, problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
