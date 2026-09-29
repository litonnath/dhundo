# ---------------------------------------------------------------------------
# make_icons.py -- Dhundo app icons, built from the real logo.
#
# public/logo-mark.png is the source of truth: the magnifier, the three
# workers and the orange rays, on transparency. Everything here is that file
# composited onto a tile, so the home-screen icon and the header can never
# drift apart.
#
# The maskable variant is not the same picture scaled. Android crops a
# maskable icon to whatever shape the launcher uses and only guarantees the
# middle 80%, so the mark is drawn smaller inside a full-bleed tile.
# ---------------------------------------------------------------------------
from PIL import Image

BLUE = (5, 66, 145, 255)
MARK = Image.open("public/logo-mark.png").convert("RGBA")

def tile(px, frac, radius_frac, bg, circle=False):
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    if bg:
        plate = Image.new("RGBA", (px, px), bg)
        if radius_frac or circle:
            from PIL import ImageDraw
            mask = Image.new("L", (px * 4, px * 4), 0)
            if circle:
                ImageDraw.Draw(mask).ellipse([0, 0, px * 4 - 1, px * 4 - 1], fill=255)
            else:
                ImageDraw.Draw(mask).rounded_rectangle(
                    [0, 0, px * 4 - 1, px * 4 - 1], radius=int(px * 4 * radius_frac), fill=255)
            plate.putalpha(mask.resize((px, px), Image.LANCZOS))
        canvas.alpha_composite(plate)
    inner = int(px * frac)
    m = MARK.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(m, ((px - inner) // 2, (px - inner) // 2))
    return canvas

WHITE = (255, 255, 255, 255)
jobs = [
    # The mark is blue on transparency, so the tile is WHITE, not blue --
    # blue-on-blue would erase it.
    # A white CIRCLE on transparency, saved as RGBA. The old rounded
    # square was drawn on transparency and then saved as RGB, which turned
    # the corners BLACK -- and Android shows this icon on the launch screen.
    # "round" marks the ones that keep their transparency.
    ("public/icon-192.png",          192, 0.66, "round", WHITE),
    ("public/icon-512.png",          512, 0.66, "round", WHITE),
    ("public/apple-touch-icon.png",  180, 0.80, 0.0,  WHITE),   # iOS masks it itself
    ("public/icon-maskable-512.png", 512, 0.60, 0.0,  WHITE),
]

for path, px, frac, rad, bg in jobs:
    if rad == "round":
        tile(px, frac, 0, bg, circle=True).save(path)          # RGBA: corners stay clear
    else:
        tile(px, frac, rad, bg).convert("RGB" if bg else "RGBA").save(path)
    print("wrote", path, px)
