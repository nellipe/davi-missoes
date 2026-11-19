"""Shared world-space collision data for the Forest 3D and 2D views."""

import json
import math
from collections import defaultdict
from pathlib import Path

ASSETS = Path(__file__).resolve().parent / 'assets' / 'forest'
MAP = json.loads((ASSETS / 'forest-layout.json').read_text())
COLLISION = json.loads((ASSETS / 'obstacles.json').read_text(encoding='utf-8'))
MARGIN, CELL = COLLISION['margin'], COLLISION['cell']
XMIN, XMAX, ZMIN, ZMAX = MAP['bounds']
BUCKETS = defaultdict(list)

for name, polygon, *owner in COLLISION['solids']:
    xs, zs = zip(*polygon)
    for i in range(math.floor((min(xs)-MARGIN)/2), math.floor((max(xs)+MARGIN)/2)+1):
        for j in range(math.floor((min(zs)-MARGIN)/2), math.floor((max(zs)+MARGIN)/2)+1):
            BUCKETS[i, j].append((polygon, owner[0] if owner else None))


def overlaps(x, z, polygon):
    inside = False
    a, b = polygon[-1]
    for c, d in polygon:
        dx, dz = c-a, d-b
        length = dx*dx + dz*dz
        t = max(0, min(1, ((x-a)*dx + (z-b)*dz)/length)) if length else 0
        if (x-a-t*dx)**2 + (z-b-t*dz)**2 < MARGIN*MARGIN:
            return True
        if (b > z) != (d > z) and x < (c-a)*(z-b)/(d-b)+a:
            inside = not inside
        a, b = c, d
    return inside


def walkable(x, z, inventory):
    if type(x) not in (int, float) or type(z) not in (int, float):
        return False
    if not (XMIN+MARGIN <= x < XMAX-MARGIN and ZMIN+MARGIN <= z < ZMAX-MARGIN):
        return False
    ground = COLLISION['rows'][math.floor((z-ZMIN)/CELL)][math.floor((x-XMIN)/CELL)]
    bridge = 'bridge' in inventory
    if ground != '1' and not (bridge and ground in ('2', '3')):
        return False
    return not any(
        (not owner or owner in inventory) and overlaps(x, z, polygon)
        for polygon, owner in BUCKETS.get((math.floor(x/2), math.floor(z/2)), ())
    )


def safe_position(candidate, valid, fallback):
    """Repair the displayed checkpoint near its former location without changing the save."""
    if not isinstance(candidate, dict):
        return fallback
    x, z = candidate.get('x'), candidate.get('z')
    if (type(x) not in (int, float) or type(z) not in (int, float)
            or not (XMIN-4 <= x <= XMAX+4 and ZMIN-4 <= z <= ZMAX+4)):
        return fallback
    if valid(x, z):
        return {'x': x, 'z': z}
    for step in range(1, 15):
        radius = step*.24
        for i in range(24):
            angle = i*math.tau/24
            a, b = x+radius*math.cos(angle), z+radius*math.sin(angle)
            if valid(a, b):
                return {'x': a, 'z': b}
    return fallback
