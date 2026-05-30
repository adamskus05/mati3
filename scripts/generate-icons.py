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
BG = (156, 179, 150)  # sage #9CB396
ALPHA_CUTOFF = 32


def clean_alpha_matte(img: Image.Image) -> Image.Image:
    """Drop remove-bg halos and unblend dark mattes before compositing."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_CUTOFF:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a >= 250:
                continue
            # Near-white removal specks → transparent
            if r >= 248 and g >= 248 and b >= 248:
                px[x, y] = (0, 0, 0, 0)
                continue

            af = a / 255.0
            # Unblend from black matte (common remove-bg artifact → dark outline)
            ur = min(255, max(0, round(r / af)))
            ug = min(255, max(0, round(g / af)))
            ub = min(255, max(0, round(b / af)))
            px[x, y] = (ur, ug, ub, a)

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
    return canvas


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
