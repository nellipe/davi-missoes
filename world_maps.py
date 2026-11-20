"""Shared layouts and independent checkpoints for the explorable 3D worlds."""
import json
import math
from pathlib import Path

import world
import world_challenges as challenges
from forest import read_json_setting
from forest_navigation import create_navigation, overlaps, safe_position

BOUNDS = [-17, 50, -14, 17]
CELL = .5
LAYOUTS = json.loads((Path(__file__).parent / 'assets/worlds/layouts.json').read_text(encoding='utf-8'))
WORLDS = {
    'forest': {'title': 'Floresta Encantada', 'icon': '❧'},
    **LAYOUTS,
}


def collision(layout):
    xmin, xmax, zmin, zmax = BOUNDS
    rows = []
    for j in range(round((zmax-zmin)/CELL)):
        z = zmin+(j+.5)*CELL
        rows.append(''.join(
            '0' if any(overlaps(xmin+(i+.5)*CELL, z, p) for p in layout['water']) else '1'
            for i in range(round((xmax-xmin)/CELL))
        ))

    footprints = [(model, x, z, angle, *footprint)
                  for model, x, z, angle, _, *footprint in layout['props'] if footprint]
    solids = []
    for model, x, z, angle, rx, rz, *shape in [*footprints, *layout.get('solids', ())]:
        yaw = math.radians(angle)
        s, c = math.sin(yaw), math.cos(yaw)
        # The GLB and collision footprint share the same yaw and world axes.
        if shape == ['box']:
            ring = [(-rx,-rz),(rx,-rz),(rx,rz),(-rx,rz)]
        else:
            ring = [(rx*math.cos(i*math.tau/12), rz*math.sin(i*math.tau/12)) for i in range(12)]
        solids.append([model, [[x+a*c+b*s, z-a*s+b*c] for a, b in ring]])
    return {'cell': CELL, 'margin': .29, 'rows': rows, 'solids': solids}


COLLISIONS = {key: collision(layout) for key, layout in LAYOUTS.items()}
NAVIGATION = {key: create_navigation(BOUNDS, data) for key, data in COLLISIONS.items()}


def save(c, key, value):
    c.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
              (key, json.dumps(value)))


def selection(c):
    selected = read_json_setting(c, 'selected_world')
    legacy = selected == 'island' or (selected is None and c.execute(
        "SELECT 1 FROM settings WHERE key='selected_world' AND value='island'"
    ).fetchone() is not None)
    return {
        'selected': selected if isinstance(selected, str) and selected in WORLDS else 'forest',
        'worlds': [{'id': key, 'title': value['title'], 'icon': value['icon']} for key, value in WORLDS.items()],
        **({'view': '2d'} if legacy else {}),
    }


def select(c, body):
    key = body.get('world')
    legacy = key == 'island'
    if legacy:
        key = 'forest'
    if not isinstance(key, str) or key not in WORLDS:
        raise ValueError('Escolha um dos mundos disponíveis.')
    save(c, 'selected_world', key)
    result = selection(c)
    if legacy:
        result['view'] = '2d'
    return result


def progress(c, key):
    entries = read_json_setting(c, f'world_activity_{key}')
    return entries if isinstance(entries, list) else []


def scene(c, key):
    layout = LAYOUTS[key]
    previous = read_json_setting(c, f'world_position_{key}')
    position = safe_position(previous, NAVIGATION[key], layout['spawn'], BOUNDS)
    return {'world': key, 'economy': world.scene(c), 'position': position, 'layout': layout,
            'map': {'bounds': BOUNDS}, 'collision': COLLISIONS[key], 'progress': progress(c, key),
            'challenges': challenges.KINDS[key]}


def move(c, key, body):
    x, z = body.get('x'), body.get('z')
    if not NAVIGATION[key](x, z):
        raise ValueError('Essa posição não tem chão seguro.')
    save(c, f'world_position_{key}', {'x': x, 'z': z})
    return {'ok': True}


def interact(c, key, body):
    place = next((p for p in LAYOUTS[key]['places'] if p['id'] == body.get('place') and 'collect' in p), None)
    previous = read_json_setting(c, f'world_position_{key}')
    position = safe_position(previous, NAVIGATION[key], LAYOUTS[key]['spawn'], BOUNDS)
    if place is None or math.hypot(position['x']-place['x'], position['z']-place['z']) >= 1.8:
        raise ValueError('Aproxime-se para explorar este lugar.')
    collected = progress(c, key)
    ident = place['id']
    if ident not in collected and any(required not in collected for required in place.get('requires', ())):
        raise ValueError('Visite as outras descobertas primeiro.')
    kind = challenges.KINDS[key].get(ident)
    result = {'progress': collected}
    if kind:
        result.update(play_challenge(c, key, ident, kind, body))
        if result['outcome'] != 'solved':
            return result
    elif body.get('action') is not None:
        raise ValueError('Essa ação não pertence a este lugar.')
    if ident not in collected:
        collected.append(ident)
        save(c, f'world_activity_{key}', collected)
    return result


def play_challenge(c, world_id, place, kind, body):
    key = f'world_challenge_{world_id}_{place}'
    state = read_json_setting(c, key)
    action = body.get('action')
    if not isinstance(action, str):
        raise ValueError('Abra e resolva o desafio para continuar.')
    if action == 'start':
        if state is None or state['done']:
            state = challenges.fresh(kind, state['revision'] + 1 if state else 0)
            save(c, key, state)
        return {'round': state, 'outcome': 'ready'}
    if state is None:
        raise ValueError('Abra o desafio para começar.')
    revision = body.get('revision')
    if type(revision) is not int or revision != state['revision'] or state['done']:
        return {'round': state, 'outcome': 'changed'}
    next_state, outcome = challenges.advance(kind, state, action, body.get('value'))
    if next_state != state:
        next_state['revision'] += 1
        save(c, key, next_state)
    return {'round': next_state, 'outcome': outcome}
