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
    ("public/apple-touch-icon.png",  180, 0.80, 0.0,  WHITE),   # iOS masks it itself
]

for path, px, frac, rad, bg in jobs:
    if rad == "round":
        tile(px, frac, 0, bg, circle=True).save(path)          # RGBA: corners stay clear
    else:
        tile(px, frac, rad, bg).convert("RGB" if bg else "RGBA").save(path)
    print("wrote", path, px)


# ---------------------------------------------------------------------------
# THE APP ICONS: icon-192.png, icon-512.png and icon-maskable-512.png.
# Solid Dhundo blue with the logo in a white circle, and NOTHING transparent.
# Transparent corners came out black on the Android launch screen (and look
# black in a phone's image viewer); a blue square on the blue launch screen
# simply disappears, leaving the round white logo -- the same as the app's
# own loading screen, so the two screens join up into one.
# ---------------------------------------------------------------------------
from PIL import ImageDraw as _D

def blue_icon(px, circle_frac, mark_frac):
    im = Image.new("RGBA", (px, px), BLUE)
    S = 4
    big = Image.new("L", (px * S, px * S), 0)
    d = int(px * circle_frac * S); o = (px * S - d) // 2
    _D.Draw(big).ellipse([o, o, o + d - 1, o + d - 1], fill=255)
    im.paste(Image.new("RGBA", (px, px), WHITE), (0, 0), big.resize((px, px), Image.LANCZOS))
    m = int(px * mark_frac)
    im.alpha_composite(MARK.resize((m, m), Image.LANCZOS), ((px - m) // 2, (px - m) // 2))
    return im.convert("RGB")

# Written to the SAME names the manifest and the APK builder have always
# used, so nothing else has to change when the picture does.
for path, px, cf, mf in [("public/icon-192.png", 192, 0.72, 0.50),
                         ("public/icon-512.png", 512, 0.72, 0.50),
                         ("public/icon-maskable-512.png", 512, 0.70, 0.48)]:
    blue_icon(px, cf, mf).save(path)
    print("wrote", path, px)
