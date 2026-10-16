#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sokoban toolkit: reverse-generation, A* solving and difficulty analysis.

Everything works on a flat integer board where ``i = y * width + x``.

Tile semantics match the classic Sokoban text format:
    '#' wall, ' ' floor, '.' goal, '$' box, '*' box on goal,
    '@' player, '+' player on goal.
"""

import heapq
import random
import time

# up, right, down, left  (matches "urdl" solution notation)
DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))
DIR_CHARS = "urdl"


# --------------------------------------------------------------------------- #
# Board
# --------------------------------------------------------------------------- #
class Board:
    """Static geometry of a level (walls + precomputed adjacency)."""

    __slots__ = ("width", "height", "walls", "nbrs", "floors", "_dead_cache")

    def __init__(self, width, height, walls):
        self.width = width
        self.height = height
        self.walls = frozenset(walls)
        nbrs = {}
        for y in range(height):
            base = y * width
            for x in range(width):
                i = base + x
                if i in self.walls:
                    continue
                lst = []
                for dx, dy in DIRS:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        j = ny * width + nx
                        if j not in self.walls:
                            lst.append(j)
                nbrs[i] = tuple(lst)
        self.nbrs = nbrs
        self.floors = tuple(nbrs.keys())
        self._dead_cache = {}

    def dead_squares(self, goals):
        """Squares where a box can never reach a goal (corner rule)."""
        goals = frozenset(goals)
        cached = self._dead_cache.get(goals)
        if cached is not None:
            return cached
        w, h = self.width, self.height
        dead = set()
        for i in self.floors:
            if i in goals:
                continue
            x, y = i % w, i // w
            up = y == 0 or (i - w) in self.walls
            down = y == h - 1 or (i + w) in self.walls
            left = x == 0 or (i - 1) in self.walls
            right = x == w - 1 or (i + 1) in self.walls
            if (up or down) and (left or right):
                dead.add(i)
        result = frozenset(dead)
        self._dead_cache[goals] = result
        return result


def reachable(start, boxes, nbrs):
    """Set of squares the player can walk to without moving a box."""
    seen = {start}
    stack = [start]
    while stack:
        cur = stack.pop()
        for nxt in nbrs[cur]:
            if nxt not in seen and nxt not in boxes:
                seen.add(nxt)
                stack.append(nxt)
    return seen


# --------------------------------------------------------------------------- #
# Solver (A* over push count)
# --------------------------------------------------------------------------- #
def solve(board, goals, boxes, player, max_nodes=250000, max_seconds=8.0):
    """Search for the solution with the fewest *pushes*.

    Returns ``{"pushes": int, "nodes": int, "exhausted": bool}`` or ``None``
    when the search hit a limit without proving anything.
    """
    goals = frozenset(goals)
    boxes = frozenset(boxes)
    if boxes == goals:
        return {"pushes": 0, "nodes": 0, "exhausted": False}

    w, h = board.width, board.height
    nbrs = board.nbrs
    if player not in nbrs:
        return None
    dead = board.dead_squares(goals)

    # heuristic: sum of manhattan distance from each box to its nearest goal
    htab = {}
    goals_list = list(goals)
    for i in board.floors:
        xi, yi = i % w, i // w
        best = 1 << 30
        for g in goals_list:
            d = abs(xi - (g % w)) + abs(yi - (g // w))
            if d < best:
                best = d
        htab[i] = best

    def heur(bs):
        total = 0
        for b in bs:
            total += htab[b]
        return total

    start = (min(reachable(player, boxes, nbrs)), boxes)
    gscore = {start: 0}
    counter = 0
    heap = [(heur(boxes), 0, counter, start[0], boxes)]
    nodes = 0
    t0 = time.time()

    while heap:
        _f, g, _c, p, bs = heapq.heappop(heap)
        if g != gscore.get((p, bs)):
            continue
        nodes += 1
        if nodes > max_nodes or (time.time() - t0) > max_seconds:
            return None

        reach = reachable(p, bs, nbrs)
        for b in bs:
            bx, by = b % w, b // w
            for dx, dy in DIRS:
                px, py = bx - dx, by - dy
                if not (0 <= px < w and 0 <= py < h):
                    continue
                if (py * w + px) not in reach:
                    continue
                qx, qy = bx + dx, by + dy
                if not (0 <= qx < w and 0 <= qy < h):
                    continue
                qj = qy * w + qx
                if qj in board.walls or qj in bs or qj in dead:
                    continue
                nbs = (bs - {b}) | {qj}
                ng = g + 1
                if nbs == goals:
                    return {"pushes": ng, "nodes": nodes, "exhausted": False}
                nstate = (min(reachable(b, nbs, nbrs)), nbs)
                if ng < gscore.get(nstate, 1 << 30):
                    gscore[nstate] = ng
                    counter += 1
                    heapq.heappush(heap, (ng + heur(nbs), ng, counter, nstate[0], nbs))

    return {"pushes": -1, "nodes": nodes, "exhausted": True}


# --------------------------------------------------------------------------- #
# Tiny BFS solver over *player moves* (used to replay a push sequence)
# --------------------------------------------------------------------------- #
def walk_path(board, boxes, src, dst):
    """Shortest player path from ``src`` to ``dst`` avoiding ``boxes``."""
    if src == dst:
        return []
    prev = {src: None}
    queue = [src]
    head = 0
    while head < len(queue):
        cur = queue[head]
        head += 1
        for d, nxt in enumerate(board.nbrs[cur]):
            if nxt in prev or nxt in boxes:
                continue
            prev[nxt] = cur
            if nxt == dst:
                path = [nxt]
                node = prev[nxt]
                while node is not None:
                    path.append(node)
                    node = prev[node]
                path.reverse()
                return path
            queue.append(nxt)
    return None


# --------------------------------------------------------------------------- #
# Random room generation
# --------------------------------------------------------------------------- #
def make_room(rng, width, height, wall_ratio):
    """Random room with a solid border, pruned to its largest open region."""
    walls = set()
    for y in range(height):
        for x in range(width):
            if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                walls.add(y * width + x)

    interior = [(x, y) for y in range(1, height - 1) for x in range(1, width - 1)]
    rng.shuffle(interior)
    n_walls = int(len(interior) * wall_ratio)
    for k in range(n_walls):
        x, y = interior[k]
        walls.add(y * width + x)

    return _prune_to_largest(walls, width, height)


def _prune_to_largest(walls, width, height):
    """Wall off every open region except the biggest one."""
    seen = set()
    best = []
    for start in range(width * height):
        if start in walls or start in seen:
            continue
        comp = [start]
        seen.add(start)
        head = 0
        while head < len(comp):
            cur = comp[head]
            head += 1
            x, y = cur % width, cur // width
            for dx, dy in DIRS:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    j = ny * width + nx
                    if j not in walls and j not in seen:
                        seen.add(j)
                        comp.append(j)
        if len(comp) > len(best):
            best = comp
    keep = set(best)
    return {i for i in range(width * height) if (i in walls) or (i not in keep)}


# --------------------------------------------------------------------------- #
# Reverse generation (pull boxes backwards from the solved state)
# --------------------------------------------------------------------------- #
# --------------------------------------------------------------------------- #
# Rendering / cropping helpers
# --------------------------------------------------------------------------- #
def to_text(width, height, walls, goals, boxes, player):
    rows = []
    for y in range(height):
        row = []
        for x in range(width):
            i = y * width + x
            if i in walls:
                row.append("#")
            elif i == player:
                row.append("+" if i in goals else "@")
            elif i in boxes:
                row.append("*" if i in goals else "$")
            elif i in goals:
                row.append(".")
            else:
                row.append(" ")
        rows.append("".join(row))
    return rows


def crop(width, height, walls, goals, boxes, player):
    """Trim fully-wall rows/columns from the outside."""
    cells = [(i % width, i // width)
             for i in range(width * height) if i not in walls]
    if not cells:
        return None
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, x1 = max(0, min(xs) - 1), min(width - 1, max(xs) + 1)
    y0, y1 = max(0, min(ys) - 1), min(height - 1, max(ys) + 1)
    nw, nh = x1 - x0 + 1, y1 - y0 + 1

    def remap(values):
        # 注意：区域之外的墙格必须丢弃，否则坐标会串行到错误的格子上
        out = set()
        for i in values:
            x = i % width - x0
            y = i // width - y0
            if 0 <= x < nw and 0 <= y < nh:
                out.add(y * nw + x)
        return out

    px = player % width - x0
    py = player // width - y0
    if not (0 <= px < nw and 0 <= py < nh):
        return None

    return (nw, nh, remap(walls), remap(goals), remap(boxes), py * nw + px)


def solution_to_moves(board, goals, boxes, player, pushes):
    """Expand a push sequence into single player moves, e.g. 'uUrdD'."""
    boxes = set(boxes)
    goals = set(goals)
    out = []
    cur = player
    for (b, d) in pushes:
        dx, dy = DIRS[d]
        stand = (b % board.width - dx) + (b // board.width - dy) * board.width
        path = walk_path(board, boxes, cur, stand)
        if path is None:
            return None
        for node in path[1:]:
            out.append(_step_char(cur, node, board.width))
            cur = node
        cur = stand
        boxes.discard(b)
        boxes.add(b + dy * board.width + dx)
        out.append(DIR_CHARS[d].upper())   # 推动用大写标记
        cur = b
    return "".join(out)


def _step_char(src, dst, width):
    sx, sy = src % width, src // width
    dx, dy = dst % width - sx, dst // width - sy
    return DIR_CHARS[DIRS.index((dx, dy))]


def pick_goals(rng, floors, width, height, count, bias):
    """Choose goal squares, optionally biased towards walls and corners.

    Targets hugging the border make the boxes travel further, which produces
    longer (and much more interesting) solutions.
    """
    if count >= len(floors):
        return list(floors)
    if bias <= 0.0:
        return rng.sample(floors, count)

    cx = (width - 1) * 0.5
    cy = (height - 1) * 0.5
    span = max(1.0, cx + cy)

    scored = []
    for f in floors:
        x = f % width
        y = f // width
        scored.append(((abs(x - cx) + abs(y - cy)) / span, f))
    scored.sort(key=lambda t: -t[0])

    keep = max(count, int(len(floors) * (1.0 - 0.72 * bias)))
    pool = [f for _d, f in scored[:keep]]
    return rng.sample(pool, count)


def generate_level(rng, width, height, num_boxes, num_pulls, wall_ratio,
                   attempts=60, goal_bias=0.0):
    """Build a level by pulling boxes backwards from the solved state.

    Every backward step is the exact inverse of a legal push, so the resulting
    position is guaranteed to be solvable and the recorded pull list is one of
    its solutions.

    Returns ``(board, goals, boxes, player, moves)`` or ``None``.
    """
    min_pulls = max(3, int(num_pulls * 0.30))

    for _ in range(attempts):
        walls = make_room(rng, width, height, wall_ratio)
        board = Board(width, height, walls)
        floors = list(board.floors)
        if len(floors) < num_boxes * 5 + 6:
            continue

        # 反向过程的起点 = 目标位置
        goals = pick_goals(rng, floors, width, height, num_boxes, goal_bias)
        box_pos = list(goals)                   # box id -> square
        visited = [{p} for p in goals]          # 每个箱子走过的格子
        occupied = set(goals)
        free = [f for f in floors if f not in occupied]
        if not free:
            continue
        player = rng.choice(free)
        nbrs = board.nbrs
        floor_set = set(floors)
        last_from = {}                          # box id -> 上一步来源
        pulls = []                              # (id, before, after)

        for _step in range(num_pulls):
            reach = reachable(player, occupied, nbrs)
            away = []     # 让箱子离目标更远
            side = []     # 距离不变（横向挪动）
            for bid in range(num_boxes):
                b = box_pos[bid]
                bx, by = b % width, b // width
                g = goals[bid]
                gx, gy = g % width, g // width
                d_now = abs(bx - gx) + abs(by - gy)
                for dx, dy in DIRS:
                    # 玩家站在箱子将要落到的格子上……
                    sx, sy = bx + dx, by + dy
                    # ……再往前迈一步，把箱子一起拽过来
                    tx, ty = bx + 2 * dx, by + 2 * dy
                    if not (0 <= sx < width and 0 <= sy < height):
                        continue
                    if not (0 <= tx < width and 0 <= ty < height):
                        continue
                    sj = sy * width + sx
                    tj = ty * width + tx
                    if sj not in reach:
                        continue
                    if sj not in floor_set or sj in occupied:
                        continue
                    if tj not in floor_set or tj in occupied:
                        continue
                    if last_from.get(bid) == sj:
                        continue
                    item = (bid, sj, tj)
                    d_new = abs(sx - gx) + abs(sy - gy)
                    if d_new > d_now:
                        away.append(item)
                    elif d_new == d_now and sj not in visited[bid]:
                        side.append(item)

            # 优先把箱子一路推离目标，实在不行才横向挪一格
            options = away if away else side
            if not options:
                break  # 房间已被拉满，保留现有结果

            bid, sj, tj = rng.choice(options)
            before = box_pos[bid]
            occupied.discard(before)
            occupied.add(sj)
            visited[bid].add(sj)
            last_from[bid] = before
            box_pos[bid] = sj
            player = tj
            pulls.append((bid, before, sj))

        if len(pulls) < min_pulls or set(box_pos) == set(goals):
            continue

        # 反向的每一步拉 = 正向的一次推，时间顺序需要倒过来
        push_seq = []
        for _bid, before, after in reversed(pulls):
            dx = before % width - after % width
            dy = before // width - after // width
            push_seq.append((after, DIRS.index((dx, dy))))

        moves = solution_to_moves(board, set(goals), set(box_pos), player,
                                  push_seq)
        if moves is None:
            continue
        return board, set(goals), set(box_pos), player, moves

    return None
