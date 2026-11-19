"""Paint the repeating mineral-and-litter marks for the Bosque floor (Pillow)."""
import math
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFilter

SIZE = 384
rng = random.Random(475)
image = Image.new("RGB", (SIZE, SIZE))
image.putdata([
    (tone, tone, tone)
    for y in range(SIZE)
    for x in range(SIZE)
    for tone in [int(225 + 6*math.sin(math.tau*(3*x+2*y)/SIZE)
                     + 5*math.cos(math.tau*(5*x-8*y)/SIZE) + rng.uniform(-6, 6))]
])
draw = ImageDraw.Draw(image)


def stroke(x, y, outline, tone):
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            draw.polygon([(x+dx+u, y+dy+v) for u, v in outline], fill=(tone,)*3)


for _ in range(540):
    x, y = rng.randrange(SIZE), rng.randrange(SIZE)
    length, width = rng.uniform(.7, 4.7), rng.uniform(.5, 2.6)
    stroke(x, y, [(-length, 0), (-.32*length, -width), (length, -.37*width),
                  (.73*length, .71*width), (-.47*length, width)], rng.randrange(151, 217))
    stroke(x, y-.7, [(-.69*length, .4), (-.3*length, -width),
                     (length, -.37*width), (.35*length, -.12*width)], rng.randrange(216, 253))

for _ in range(110):
    x, y = rng.randrange(SIZE), rng.randrange(SIZE)
    turn, scale = rng.uniform(0, math.tau), rng.uniform(.31, 1.1)
    blade = [(-7, 0), (-2, -2.6), (4, -1.9), (8, .4), (3, 2), (-3, 1.3)]
    turn_shape = [(scale*(u*math.cos(turn)-v*math.sin(turn)),
                   scale*(u*math.sin(turn)+v*math.cos(turn))) for u, v in blade]
    stroke(x, y, turn_shape, rng.randrange(178, 215))

out = Path(__file__).resolve().parents[2] / "assets" / "forest" / "bosque-solo.png"
image.filter(ImageFilter.GaussianBlur(.30)).save(out, optimize=True)
