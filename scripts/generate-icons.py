#!/usr/bin/env python3
"""Regenerate PWA icons from public/icons/source.png"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/icons/source.png"
OUT = ROOT / "public/icons"
APPLE = ROOT / "public/apple-touch-icon.png"
APP_ICON = ROOT / "src/app/icon.png"
# Match viewport themeColor in layout.tsx — avoids a dark ring on home-screen icons.
BG = (240, 244, 239)  # #F0F4EF
ALPHA_CUTOFF = 64


def clean_alpha_matte(img: Image.Image) -> Image.Image:
    """Remove remove-bg fringe; keep a crisp edge for resize."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_CUTOFF:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r >= 248 and g >= 248 and b >= 248:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a >= 250:
                continue
            # Semi-transparent removal halos → fully transparent
            px[x, y] = (0, 0, 0, 0)

    return img


def strip_edge_halo(img: Image.Image) -> Image.Image:
    """Remove muddy resize halos touching the background."""
    px = img.load()
    w, h = img.size
    br, bgg, bb = BG

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b = px[x, y]
            if (r, g, b) == BG:
                continue
            touches_bg = (
                px[x + 1, y] == BG
                or px[x - 1, y] == BG
                or px[x, y + 1] == BG
                or px[x, y - 1] == BG
            )
            if not touches_bg:
                continue
            delta = (br - r) + (bgg - g) + (bb - b)
            if delta < 18:
                continue
            # Keep dark illustration strokes (basket outlines, etc.)
            if g > 80 and r < 70 and b < 70:
                continue
            px[x, y] = BG

    return img


def load_source() -> Image.Image:
    return clean_alpha_matte(Image.open(SRC))


def render_icon(size: int, src: Image.Image, fill: float) -> Image.Image:
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * fill)
    scaled = src.resize((inner, inner), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - inner) // 2, (size - inner) // 2)
    layer.paste(scaled, offset, scaled)
    canvas.paste(layer, mask=layer.split()[3])
    return strip_edge_halo(canvas)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source image: {SRC}")

    src = load_source()

    for name, px in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)]:
        path = OUT / f"{name}.png"
        render_icon(px, src, 0.94).save(path, "PNG", optimize=True)
        print("Wrote", path)

    render_icon(512, src, 0.82).save(OUT / "icon-maskable-512.png", "PNG", optimize=True)
    render_icon(180, src, 0.94).save(APPLE, "PNG", optimize=True)
    render_icon(32, src, 0.94).save(APP_ICON, "PNG", optimize=True)
    print("Done.")


if __name__ == "__main__":
    main()
