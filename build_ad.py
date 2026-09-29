#!/usr/bin/env python3
# ===========================================================================
# build_ad.py -- the Dhundo ad film, rendered frame by frame.
#
#     python3 build_ad.py            # writes ad/dhundo-ad.mp4
#
# ---------------------------------------------------------------------------
# WHAT THIS IS AND IS NOT
# ---------------------------------------------------------------------------
# It builds the PICTURE: 1080x1920 vertical, the size a phone holds and the
# size WhatsApp Status and Instagram want. Every app screen in it is a real
# screenshot of Dhundo running in Bengali, not a mockup -- captured by
# adshots.mjs against the actual build.
#
# It does NOT build the VOICE. A convincing Bengali voice-over has to be a
# person at a microphone (or a paid TTS service); anything synthesised
# offline here would sound wrong in a way that makes the whole ad feel cheap.
# So the script is written out in ad/script-bn.txt with a timing for every
# line, and once the recording exists one ffmpeg command muxes it in -- the
# command is printed at the end of this run.
#
# The film is cut so it WORKS SILENT, because most people scrolling will see
# it before they hear it: every spoken line also appears as on-screen Bengali
# text, timed to it.
# ===========================================================================

import json
import math
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FPS = 30
OUT_DIR = "ad/frames"
FONT_DIR = "/tmp/fonts"

BRAND      = (10, 91, 184)
BRAND_DARK = (5, 66, 145)
BRAND_DEEP = (3, 44, 97)
ACCENT     = (248, 118, 23)
INK        = (15, 20, 25)
PAPER      = (246, 248, 250)
GREEN      = (18, 128, 74)
WHITE      = (255, 255, 255)


# ---------------------------------------------------------------------------
# MIXED SCRIPT TEXT
#
# Noto Sans Bengali contains Bengali and NOTHING ELSE -- no Latin, no digits,
# not even a question mark or a comma. The first cut of this film rendered
# "কাকে ফোন করবেন?" with a tofu box where the question mark should be, and
# the call to action showed an empty white pill because every character of
# "services.shortlistone.com" was missing.
#
# PIL does no font fallback of its own, so the string is split into runs by
# script and each run is drawn with a font that actually has its glyphs:
# Bengali (and its combining marks) in Noto, everything else in DejaVu. The
# runs are measured the same way, so centring still works.
# ---------------------------------------------------------------------------
LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"


def font(weight, size):
    return ImageFont.truetype(f"{FONT_DIR}/NotoSansBengali-{weight}.ttf", size)


def latin_for(f):
    """The DejaVu that matches a given Noto weight, at a hair under the same
    size -- DejaVu runs visually larger at the same nominal size."""
    bold = "-Bold" if f.size and "800" in f.path or "700" in f.path else ""
    return ImageFont.truetype(LATIN % bold, round(f.size * 0.92))


def is_bengali(ch):
    o = ord(ch)
    # Bengali block, plus the space (kept with whatever run it lands in so
    # word gaps do not change width between fonts), plus the DANDA.
    #
    # The danda -- the full stop of Bengali -- lives at U+0964, in the
    # DEVANAGARI block, not the Bengali one. A range test on 0980..09FF
    # therefore sent it to DejaVu, which has no glyph for it, and the film's
    # opening line ended in a tofu box. It is Noto's to draw.
    return 0x0980 <= o <= 0x09FF or 0x0964 <= o <= 0x0965 or ch == " "


def runs(text):
    out, cur, cur_b = [], "", None
    for ch in text:
        b = is_bengali(ch)
        if cur_b is None or b == cur_b:
            cur += ch
            cur_b = b
        else:
            out.append((cur, cur_b))
            cur, cur_b = ch, b
    if cur:
        out.append((cur, cur_b))
    return out


def measure(d, text, f):
    total = 0
    lf = latin_for(f)
    for run, beng in runs(text):
        total += d.textlength(run, font=f if beng else lf)
    return total


def draw_text(d, xy, text, f, fill):
    x, y = xy
    lf = latin_for(f)
    for run, beng in runs(text):
        use = f if beng else lf
        # Latin sits higher on its em box than Bengali; nudged down so a
        # mixed line does not look like two lines of type on one baseline.
        dy = 0 if beng else round(f.size * 0.06)
        d.text((x, y + dy), run, font=use, fill=fill)
        x += d.textlength(run, font=use)
    return x


# ---------------------------------------------------------------------------
# THE SCRIPT
#
# `say` is what the voice reads. `text` is what appears on screen -- shorter,
# because a caption competes with the picture and a line somebody has to read
# twice is a line they miss. `shot` names a screenshot from adshots.mjs.
# ---------------------------------------------------------------------------
SCENES = [
    dict(kind="hook", secs=6.0,
         say="কাল সকালে একজন মিস্ত্রি দরকার। আপনি কাকে ফোন করবেন?",
         text=["কাল সকালে মিস্ত্রি দরকার।", "কাকে ফোন করবেন?"]),

    dict(kind="problem", secs=8.0,
         say="কারও কাছে নম্বর চাওয়া। দালাল ধরা। কমিশন দেওয়া। তারপরও লোক আসে না।",
         text=["নম্বর খোঁজা", "দালাল ধরা", "কমিশন দেওয়া"],
         tail="…তারপরও লোক আসে না।"),

    dict(kind="logo", secs=5.0,
         say="তাই ঢুঁঢো। ত্রিপুরার নিজের খোঁজার অ্যাপ।",
         text=["ঢুঁঢো"], tail="ত্রিপুরার নিজের খোঁজার অ্যাপ"),

    dict(kind="step", secs=9.0, num="১", shot="ad/home.png",
         say="এক। কী দরকার, বেছে নিন। মিস্ত্রি, ড্রাইভার, রাঁধুনি, ইলেকট্রিশিয়ান।",
         text=["কী দরকার, বেছে নিন"],
         tail="মিস্ত্রি · ড্রাইভার · রাঁধুনি"),

    dict(kind="step", secs=11.0, num="২", shot="ad/results.png",
         say="দুই। আপনার কাছের লোকজন দেখুন। কত দূরে, দিনে কত নেন, কত বছরের অভিজ্ঞতা — সব একসঙ্গে।",
         text=["কাছের লোকজন দেখুন"],
         tail="কত দূরে · দিনে কত · কত বছরের কাজ"),

    dict(kind="claim", secs=8.0, num="৩",
         say="তিন। সরাসরি ফোন করুন। কোনো কমিশন নেই। কোনো দালাল নেই।",
         text=["সরাসরি ফোন করুন"],
         tail="কোনো কমিশন নেই · কোনো দালাল নেই"),

    dict(kind="step", secs=10.0, shot="ad/form.png",
         say="আর আপনি যদি নিজে কাজ করেন — বিনা পয়সায় নাম লেখান। আপনার এলাকার লোক আপনাকে খুঁজে পাবে।",
         text=["নিজে কাজ করেন?", "বিনা পয়সায় নাম লেখান"],
         tail="আপনার এলাকার লোক আপনাকে পাবে"),

    dict(kind="cta", secs=7.0,
         say="ঢুঁঢো। আজই ফোনে রাখুন।",
         text=["ঢুঁঢো"], tail="services.shortlistone.com"),
]


# ---------------------------------------------------------------------------
# drawing helpers
# ---------------------------------------------------------------------------
def ease(t):
    """Fast out, slow in. Linear motion reads as cheap."""
    return 1 - pow(1 - max(0.0, min(1.0, t)), 3)


def vgrad(top, bottom):
    """A vertical gradient, drawn once per scene and reused for its frames."""
    g = Image.new("RGB", (1, H))
    px = g.load()
    for y in range(H):
        k = y / (H - 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * k) for i in range(3))
    return g.resize((W, H))


def centred(d, y, text, f, fill, max_w=W - 160):
    """Draw centred, wrapping on spaces if it will not fit."""
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if measure(d, trial, f) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    lh = f.size * 1.42
    for i, ln in enumerate(lines):
        wd = measure(d, ln, f)
        draw_text(d, ((W - wd) / 2, y + i * lh), ln, f, fill)
    return y + len(lines) * lh


def phone(shot_path, target_h):
    """A screenshot in a rounded phone body, drawn once per scene."""
    src = Image.open(shot_path).convert("RGB")
    scale = target_h / src.height
    sw, sh = round(src.width * scale), target_h
    src = src.resize((sw, sh), Image.LANCZOS)

    pad, radius = 14, 46
    body = Image.new("RGBA", (sw + pad * 2, sh + pad * 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle([0, 0, body.width - 1, body.height - 1], radius + 6,
                         fill=(12, 18, 28, 255))

    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius, fill=255)
    body.paste(src, (pad, pad), mask)
    return body


# ---------------------------------------------------------------------------
# scene renderers -- each returns a PIL image for a given progress 0..1
# ---------------------------------------------------------------------------
def draw_hook(bg, sc, p):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    f1 = font("800", 82)
    rise = (1 - ease(min(1.0, p / 0.22))) * 60
    y = 690 - rise
    y = centred(d, y, sc["text"][0], f1, WHITE)
    if p > 0.34:
        a = ease(min(1.0, (p - 0.34) / 0.2))
        f2 = font("800", 104)
        col = tuple(round(WHITE[i] + (ACCENT[i] - WHITE[i]) * a) for i in range(3))
        centred(d, y + 44 - (1 - a) * 30, sc["text"][1], f2, col)
    return img


def draw_problem(bg, sc, p):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    f = font("700", 70)
    y = 560
    for i, line in enumerate(sc["text"]):
        at = 0.08 + i * 0.16
        if p < at:
            break
        a = ease(min(1.0, (p - at) / 0.14))
        x_off = (1 - a) * 70
        # Struck through as each one is named: these are the old ways, and
        # the film is about to replace them.
        col = tuple(round(255 * (0.45 + 0.55 * a)) for _ in range(3))
        wd = measure(d, line, f)
        draw_text(d, ((W - wd) / 2 - x_off, y), line, f, col)
        if p > at + 0.22:
            sa = ease(min(1.0, (p - at - 0.22) / 0.16))
            yy = y + f.size * 0.62
            d.line([(W - wd) / 2 - 10, yy, (W - wd) / 2 - 10 + (wd + 20) * sa, yy],
                   fill=ACCENT, width=7)
        y += 132
    if p > 0.72:
        a = ease((p - 0.72) / 0.28)
        centred(d, y + 40, sc["tail"], font("700", 58),
                tuple(round(c * a + 255 * (1 - a) * 0) for c in (255, 210, 170)))
    return img


def draw_logo(bg, sc, p, logo):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    s = 0.7 + 0.3 * ease(min(1.0, p / 0.3))
    side = round(300 * s)
    lg = logo.resize((side, side), Image.LANCZOS)
    img.paste(lg, ((W - side) // 2, 620 - side // 2), lg)
    y = centred(d, 800, sc["text"][0], font("800", 128), WHITE)
    if p > 0.35:
        a = ease(min(1.0, (p - 0.35) / 0.25))
        centred(d, y + 26, sc["tail"], font("700", 54),
                tuple(round(200 + 55 * a) for _ in range(3)))
    return img


def draw_step(bg, sc, p, ph):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    y = 150
    if sc.get("num"):
        a = ease(min(1.0, p / 0.18))
        r = 54
        cx = W // 2
        d.ellipse([cx - r, y - 6, cx + r, y + 2 * r - 6], fill=ACCENT)
        nf = font("800", 62)
        nw = measure(d, sc["num"], nf)
        draw_text(d, (cx - nw / 2, y + 14), sc["num"], nf,
                  tuple(round(255 * a) for _ in range(3)))
        y += 2 * r + 24

    for line in sc["text"]:
        y = centred(d, y, line, font("800", 68), WHITE)
    if sc.get("tail"):
        a = ease(min(1.0, max(0.0, (p - 0.2) / 0.25)))
        centred(d, y + 14, sc["tail"], font("700", 44),
                tuple(round(150 + 105 * a) for _ in range(3)))

    # The phone rises into place and then drifts, so the frame is never static.
    rise = (1 - ease(min(1.0, p / 0.35))) * 220
    drift = math.sin(p * math.pi) * 14
    img.paste(ph, ((W - ph.width) // 2, round(690 + rise - drift)), ph)
    return img


def draw_claim(bg, sc, p):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    y = 430
    a0 = ease(min(1.0, p / 0.18))
    r = 54
    cx = W // 2
    d.ellipse([cx - r, y, cx + r, y + 2 * r], fill=ACCENT)
    nf = font("800", 62)
    nw = measure(d, sc["num"], nf)
    draw_text(d, (cx - nw / 2, y + 20), sc["num"], nf,
              tuple(round(255 * a0) for _ in range(3)))
    y += 2 * r + 46

    y = centred(d, y, sc["text"][0], font("800", 86), WHITE)

    # The two denials, struck in green -- the thing the app actually promises.
    parts = sc["tail"].split(" · ")
    yy = y + 70
    for i, part in enumerate(parts):
        at = 0.3 + i * 0.22
        if p < at:
            break
        a = ease(min(1.0, (p - at) / 0.18))
        f = font("800", 62)
        wd = measure(d, part, f)
        box_w = wd + 68
        bx = (W - box_w) / 2
        d.rounded_rectangle([bx, yy - 16, bx + box_w * a, yy + f.size + 22], 22,
                            fill=(18, 128, 74))
        if a > 0.55:
            draw_text(d, ((W - wd) / 2, yy), part, f, WHITE)
        yy += f.size + 62
    return img


def draw_cta(bg, sc, p, logo):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    s = 0.85 + 0.15 * ease(min(1.0, p / 0.25))
    side = round(260 * s)
    lg = logo.resize((side, side), Image.LANCZOS)
    img.paste(lg, ((W - side) // 2, 560 - side // 2), lg)
    y = centred(d, 740, sc["text"][0], font("800", 132), WHITE)

    a = ease(min(1.0, max(0.0, (p - 0.25) / 0.3)))
    f = font("700", 50)
    url = sc["tail"]
    wd = measure(d, url, f)
    box_w, box_h = wd + 84, f.size + 54
    bx, by = (W - box_w) / 2, y + 60
    d.rounded_rectangle([bx, by, bx + box_w, by + box_h], 30, fill=WHITE)
    if a > 0.4:
        draw_text(d, ((W - wd) / 2, by + 26), url, f, BRAND_DARK)

    if p > 0.55:
        ca = ease((p - 0.55) / 0.45)
        centred(d, by + box_h + 46, "বিনা পয়সায় · কোনো কমিশন নেই",
                font("700", 42), tuple(round(190 + 65 * ca) for _ in range(3)))
    return img


# ---------------------------------------------------------------------------
def main():
    if not os.path.exists(f"{FONT_DIR}/NotoSansBengali-800.ttf"):
        print("Bengali font missing. See the note at the top of this file.")
        return 1
    for sc in SCENES:
        if sc.get("shot") and not os.path.exists(sc["shot"]):
            print(f"missing {sc['shot']} -- run `node adshots.mjs` first")
            return 1

    shutil.rmtree(OUT_DIR, ignore_errors=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    logo = Image.open("public/logo-mark.png").convert("RGBA")
    backgrounds = {
        "hook":    vgrad((8, 24, 48), (3, 44, 97)),
        "problem": vgrad((18, 22, 30), (10, 14, 22)),
        "logo":    vgrad(BRAND, BRAND_DEEP),
        "step":    vgrad(BRAND_DARK, BRAND_DEEP),
        "claim":   vgrad(BRAND_DEEP, (4, 30, 66)),
        "cta":     vgrad(BRAND, BRAND_DEEP),
    }

    n = 0
    timings = []
    t0 = 0.0
    for sc in SCENES:
        frames = round(sc["secs"] * FPS)
        bg = backgrounds[sc["kind"]]
        ph = phone(sc["shot"], 1120) if sc.get("shot") else None
        for i in range(frames):
            p = i / max(1, frames - 1)
            k = sc["kind"]
            if k == "hook":
                img = draw_hook(bg, sc, p)
            elif k == "problem":
                img = draw_problem(bg, sc, p)
            elif k == "logo":
                img = draw_logo(bg, sc, p, logo)
            elif k == "claim":
                img = draw_claim(bg, sc, p)
            elif k == "cta":
                img = draw_cta(bg, sc, p, logo)
            else:
                img = draw_step(bg, sc, p, ph)

            # A thin progress line: people stay for a film whose end they can see.
            done = (t0 + p * sc["secs"]) / sum(s["secs"] for s in SCENES)
            ImageDraw.Draw(img).rectangle([0, H - 9, W * done, H], fill=ACCENT)

            img.save(f"{OUT_DIR}/f{n:05d}.png")
            n += 1
        timings.append(dict(start=round(t0, 2), secs=sc["secs"], say=sc["say"]))
        t0 += sc["secs"]
        print(f"  rendered {sc['kind']:8s} {sc['secs']:4.1f}s  ({n} frames)", flush=True)

    # The script, with the timing each line has to fit into.
    with open("ad/script-bn.txt", "w", encoding="utf-8") as fh:
        fh.write("ঢুঁঢো — বিজ্ঞাপনের স্ক্রিপ্ট (বাংলা)\n")
        fh.write("=" * 52 + "\n\n")
        fh.write("Record each line to fit the seconds given. Leave a short\n"
                 "breath between lines; the picture holds on each scene.\n\n")
        for i, t in enumerate(timings, 1):
            fh.write(f"{i}.  [{t['start']:6.2f}s  →  {t['start']+t['secs']:6.2f}s"
                     f"   ({t['secs']:.1f}s)]\n")
            fh.write(f"    {t['say']}\n\n")
        fh.write(f"\nTotal: {t0:.1f} seconds\n")
    with open("ad/script-bn.json", "w", encoding="utf-8") as fh:
        json.dump(timings, fh, ensure_ascii=False, indent=2)

    print("\n  encoding…", flush=True)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-i", f"{OUT_DIR}/f%05d.png",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
        "-movflags", "+faststart",
        "ad/dhundo-ad.mp4",
    ], check=True)
    shutil.rmtree(OUT_DIR, ignore_errors=True)

    size = os.path.getsize("ad/dhundo-ad.mp4") / 1e6
    print(f"\n  ad/dhundo-ad.mp4   {t0:.1f}s   {size:.1f} MB   1080x1920")
    print("  ad/script-bn.txt   the Bengali voice-over, with timings")
    print("\n  When the voice is recorded (voice.m4a), add it with:")
    print("    ffmpeg -i ad/dhundo-ad.mp4 -i voice.m4a -c:v copy -c:a aac \\")
    print("           -shortest ad/dhundo-ad-voiced.mp4")
    return 0


if __name__ == "__main__":
    sys.exit(main())
