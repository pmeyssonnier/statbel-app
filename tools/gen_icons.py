#!/usr/bin/env python3
"""Génère le set d'icônes Statbel (presse-papiers + checklist) sans dépendance
externe : dessin géométrique via Pillow, supersample x4 → rendu net.

Sortie : icon-192.png, icon-512.png, icon-192-mask.png, icon-512-mask.png,
apple-touch-icon.png, favicon-32.png, favicon.ico
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
SS = 4  # supersampling

# Palette (marque)
INDIGO_TOP = (42, 51, 143)     # #2a338f
INDIGO_BOT = (18, 24, 92)      # #12185c
WHITE      = (255, 255, 255)
TAB        = (91, 104, 128)    # ardoise
GREEN      = (46, 125, 50)     # #2e7d32 (statut « Fait »)
GREY       = (196, 202, 212)   # #c4cad4 (statut « À faire »)


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _bg(S):
    """Fond indigo, léger dégradé vertical pour la profondeur."""
    img = Image.new("RGB", (S, S), INDIGO_BOT)
    top = Image.new("RGB", (S, 1), 0)
    px = top.load()
    for y in range(S):
        pass
    grad = Image.new("RGB", (1, S))
    gpx = grad.load()
    for y in range(S):
        gpx[0, y] = _lerp(INDIGO_TOP, INDIGO_BOT, y / (S - 1))
    return grad.resize((S, S))


def _round(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def render(S, scale=1.0, favicon=False):
    """Dessine l'icône dans un carré S. `scale` réduit le presse-papiers autour
    du centre (pour la variante maskable). `favicon` = version simplifiée (un
    seul grand ✓) lisible en très petit."""
    W = S * SS
    base = _bg(W).convert("RGBA")
    draw = ImageDraw.Draw(base)
    cx = cy = W / 2

    def sx(u):  # applique le scale autour du centre, coord X en unités 0..1
        return cx + (u - 0.5) * W * scale

    def sy(v):
        return cy + (v - 0.5) * W * scale

    def sw(d):  # échelle une dimension
        return d * W * scale

    # — Ombre douce sous le presse-papiers
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle([sx(0.205), sy(0.205), sx(0.795), sy(0.86)],
                            radius=sw(0.055), fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sw(0.02)))
    base.alpha_composite(shadow, (0, int(sw(0.012))))

    # — Pince (clip) en haut
    _round(draw, [sx(0.405), sy(0.12), sx(0.595), sy(0.215)], sw(0.028), TAB)

    # — Corps du presse-papiers (blanc)
    _round(draw, [sx(0.20), sy(0.185), sx(0.80), sy(0.855)], sw(0.055), WHITE)

    if favicon:
        # Un grand ✓ vert centré, lisible à 16-32 px
        pts = [(sx(0.34), sy(0.55)), (sx(0.455), sy(0.66)), (sx(0.68), sy(0.40))]
        draw.line(pts, fill=GREEN, width=int(sw(0.075)), joint="curve")
        for p in (pts[0], pts[2]):
            rr = sw(0.037)
            draw.ellipse([p[0]-rr, p[1]-rr, p[0]+rr, p[1]+rr], fill=GREEN)
        return base.resize((S, S), Image.LANCZOS).convert("RGB")

    # — Trois lignes de checklist ; la 1re « faite » (✓ + barre verte)
    rows = [
        (0.375, GREEN, True),
        (0.535, GREY,  False),
        (0.695, GREY,  False),
    ]
    bx0, bx1 = 0.44, 0.715           # barre : début / fin
    mk_cx = 0.335                    # centre du marqueur (check / puce)
    for (yc, col, done) in rows:
        # barre arrondie
        h = 0.05
        _round(draw, [sx(bx0), sy(yc - h/2), sx(bx1), sy(yc + h/2)], sw(h/2), col)
        if done:
            # coche verte
            pts = [(sx(mk_cx - 0.055), sy(yc)),
                   (sx(mk_cx - 0.012), sy(yc + 0.042)),
                   (sx(mk_cx + 0.062), sy(yc - 0.045))]
            draw.line(pts, fill=GREEN, width=int(sw(0.03)), joint="curve")
            for p in (pts[0], pts[2]):
                rr = sw(0.015)
                draw.ellipse([p[0]-rr, p[1]-rr, p[0]+rr, p[1]+rr], fill=GREEN)
        else:
            # puce creuse grise
            rr = sw(0.042)
            draw.ellipse([sx(mk_cx)-rr, sy(yc)-rr, sx(mk_cx)+rr, sy(yc)+rr],
                         outline=GREY, width=int(sw(0.016)))

    return base.resize((S, S), Image.LANCZOS).convert("RGB")


def save(img, name):
    img.save(os.path.join(OUT, name))
    print("écrit", name, img.size)


os.makedirs(OUT, exist_ok=True)
save(render(512), "icon-512.png")
save(render(192), "icon-192.png")
save(render(512, scale=0.78), "icon-512-mask.png")
save(render(192, scale=0.78), "icon-192-mask.png")
save(render(180), "apple-touch-icon.png")
save(render(32, favicon=True), "favicon-32.png")
# favicon.ico multi-tailles
ico = render(64, favicon=True)
ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("écrit favicon.ico")
