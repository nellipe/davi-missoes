"""Shared world-space collision data for the Forest 3D and 2D views."""

import json
import math
from collections import defaultdict
from pathlib import Path

ASSETS = Path(__file__).resolve().parent / 'assets' / 'forest'
MAP = json.loads((ASSETS / 'forest-layout.json').read_text())
COLLISION = json.loads((ASSETS / 'obstacles.json').read_text(encoding='utf-8'))
def overlaps(x, z, polygon, margin=0):
    inside = False
    a, b = polygon[-1]
    for c, d in polygon:
        dx, dz = c-a, d-b
        length = dx*dx + dz*dz
        t = max(0, min(1, ((x-a)*dx + (z-b)*dz)/length)) if length else 0
        if (x-a-t*dx)**2 + (z-b-t*dz)**2 < margin*margin:
            return True
        if (b > z) != (d > z) and x < (c-a)*(z-b)/(d-b)+a:
            inside = not inside
        a, b = c, d
    return inside


def create_navigation(bounds, collision):
    xmin, xmax, zmin, zmax = bounds
    margin, cell = collision['margin'], collision['cell']
    rows = collision['rows']
    buckets = defaultdict(list)
    for _, polygon, *owner in collision['solids']:
        xs, zs = zip(*polygon)
        for i in range(math.floor((min(xs)-margin)/2), math.floor((max(xs)+margin)/2)+1):
            for j in range(math.floor((min(zs)-margin)/2), math.floor((max(zs)+margin)/2)+1):
                buckets[i, j].append((polygon, owner[0] if owner else None))

    def valid(x, z, inventory=()):
        if type(x) not in (int, float) or type(z) not in (int, float):
            return False
        if not (xmin+margin <= x < xmax-margin and zmin+margin <= z < zmax-margin):
            return False
        ground = rows[math.floor((z-zmin)/cell)][math.floor((x-xmin)/cell)]
        if ground != '1' and not ('bridge' in inventory and ground in ('2', '3')):
            return False
        return not any(
            (not owner or owner in inventory) and overlaps(x, z, polygon, margin)
            for polygon, owner in buckets.get((math.floor(x/2), math.floor(z/2)), ())
        )

    return valid


walkable = create_navigation(MAP['bounds'], COLLISION)


def safe_position(candidate, valid, fallback, bounds=MAP['bounds']):
    """Repair the displayed checkpoint near its former location without changing the save."""
    if not isinstance(candidate, dict):
        return fallback
    x, z = candidate.get('x'), candidate.get('z')
    xmin, xmax, zmin, zmax = bounds
    if (type(x) not in (int, float) or type(z) not in (int, float)
            or not (xmin-4 <= x <= xmax+4 and zmin-4 <= z <= zmax+4)):
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
