"""Draws the LifeOS app icons (F23): the Today triple ring (routine, water, protein).
Run: python3 scripts/make-icons.py  (needs Pillow). Colours are the theme's dark accents."""
from PIL import Image, ImageDraw

BG = (10, 15, 28)          # canvas #0A0F1C
RINGS = [((59, 130, 246), 0.80), ((56, 189, 248), 0.62), ((167, 139, 250), 0.48)]  # primary, water, protein
TRACK = (30, 41, 59)       # #1E293B


def rings(size, scale, track=True, mono=None):
    """Transparent image with three arcs centred, outer diameter = scale × size."""
    ss = 4  # supersample
    S = size * ss
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    outer = S * scale / 2
    w = outer * 0.17
    gap = w * 0.35
    for i, (color, frac) in enumerate(RINGS):
        r = outer - i * (w + gap) - w / 2
        box = [S / 2 - r - w / 2, S / 2 - r - w / 2, S / 2 + r + w / 2, S / 2 + r + w / 2]
        if track:
            d.arc(box, 0, 360, fill=TRACK + (255,), width=int(w))
        c = mono or color
        d.arc(box, -90, -90 + 360 * frac, fill=c + (255,), width=int(w))
        # round caps
        import math
        for a in (-90, -90 + 360 * frac):
            x = S / 2 + r * math.cos(math.radians(a))
            y = S / 2 + r * math.sin(math.radians(a))
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=c + (255,))
    return im.resize((size, size), Image.LANCZOS)


icon = Image.new('RGBA', (1024, 1024), BG + (255,))
icon.alpha_composite(rings(1024, 0.72))
icon.convert('RGB').save('assets/icon.png')

rings(1024, 0.9).save('assets/splash-icon.png')
rings(512, 0.6).save('assets/android-icon-foreground.png')
Image.new('RGBA', (512, 512), BG + (255,)).save('assets/android-icon-background.png')
rings(432, 0.66, track=False, mono=(255, 255, 255)).save('assets/android-icon-monochrome.png')
fav = Image.new('RGBA', (48, 48), BG + (255,))
fav.alpha_composite(rings(48, 0.84, track=False))
fav.save('assets/favicon.png')
print('icons written')
