"""Validation for the short, untimed activities in the explorable worlds."""

SHELLS = ('shell-rose', 'shell-gold', 'shell-blue')
PIECES = ('head', 'ribs', 'tail')
COMMANDS = ('power', 'steps', 'dance')
SIDES = ('left', 'right')
SOIL = (0, 1, 2)
PRESSURE = range(1, 6)
TARGET = (3, 4)

KINDS = {
    'praia': {'chest-song': 'melody'},
    'dinossauros': {'fossil-head': 'dig', 'fossil-ribs': 'dig', 'fossil-tail': 'dig', 'skeleton': 'skeleton'},
    'inventores': {'pressure': 'valve', 'coil': 'coil', 'commands': 'commands'},
}
ORDERS = {'melody': SHELLS, 'commands': COMMANDS}
AUTOMATIC = {'dig': SOIL, 'skeleton': PIECES}
CHOICES = ORDERS | AUTOMATIC | {'coil': SIDES}


def fresh(kind, revision=0):
    values = 1 if kind == 'valve' else []
    return {'revision': revision, 'value': values, 'hint': 0, 'done': False}


def valid_selection(value, options):
    if not any(type(value) is type(item) and value == item for item in options):
        raise ValueError('Escolha uma das opções do desafio.')


def step(kind, current, choice):
    if kind == 'valve':
        valid_selection(choice, (-1, 1))
        return min(max(PRESSURE), max(min(PRESSURE), current + choice)), 'updated'
    if kind == 'skeleton':
        if not isinstance(choice, list) or len(choice) != 2:
            raise ValueError('Escolha uma peça e um espaço no painel.')
        piece, slot = choice
        valid_selection(piece, PIECES)
        valid_selection(slot, PIECES)
        if piece != slot:
            return current, 'incorrect'
        choice = piece
    else:
        valid_selection(choice, CHOICES[kind])
    if choice in current:
        return ([item for item in current if item != choice] if kind == 'coil' else current), 'updated'
    return [*current, choice], 'updated'


def correct(kind, value):
    if kind in ORDERS:
        return tuple(value) == ORDERS[kind]
    if kind in AUTOMATIC:
        return len(value) == len(AUTOMATIC[kind])
    return value in TARGET if kind == 'valve' else len(value) == len(SIDES)


def advance(kind, state, action, choice):
    """Reduce a validated input to the next round state. The client never sets done."""
    if action == 'hint':
        return dict(state, hint=min(3, state['hint'] + 1)), 'hint'
    if action == 'reset':
        return fresh(kind, state['revision']), 'updated'
    if action == 'undo' and kind in ORDERS:
        return dict(state, value=state['value'][:-1]), 'updated'
    if action == 'check' and kind not in AUTOMATIC:
        done = correct(kind, state['value'])
        return dict(state, done=done), 'solved' if done else 'incorrect'
    if action == 'step':
        value, status = step(kind, state['value'], choice)
        done = kind in AUTOMATIC and correct(kind, value)
        return dict(state, value=value, done=done), 'solved' if done else status
    raise ValueError('Essa ação não pertence ao desafio.')
