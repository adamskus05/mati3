#!/usr/bin/env python3
"""Regenerate PWA icons from public/icons/source.png"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/icons/source.png"
OUT = ROOT / "public/icons"
APPLE = ROOT / "public/apple-touch-icon.png"
APP_ICON = ROOT / "src/app/icon.png"
BG = (156, 179, 150)  # sage #9CB396


def flood_replace_corner_white(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    w, h = img.size
    px = img.load()

    def is_outline_white(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return r >= 248 and g >= 248 and b >= 248

    visited: set[tuple[int, int]] = set()
    for start in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if not is_outline_white(*start):
            continue
        q: deque[tuple[int, int]] = deque([start])
        while q:
            x, y = q.popleft()
            if (x, y) in visited or not (0 <= x < w and 0 <= y < h):
                continue
            if not is_outline_white(x, y):
                continue
            visited.add((x, y))
            px[x, y] = bg
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return img


def make_icon(size: int, src_img: Image.Image) -> Image.Image:
    cleaned = flood_replace_corner_white(src_img.copy(), BG)
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * 0.94)
    scaled = cleaned.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(scaled, offset)
    return canvas


def make_maskable_icon(size: int, src_img: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * 0.82)
    cleaned = flood_replace_corner_white(src_img.copy(), BG)
    scaled = cleaned.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(scaled, offset)
    return canvas


def load_source() -> Image.Image:
    img = Image.open(SRC)
    if img.mode == "RGBA":
        base = Image.new("RGB", img.size, BG)
        base.paste(img, mask=img.split()[3])
        return base
    return img.convert("RGB")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source image: {SRC}")

    src_img = load_source()

    for name, px in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)]:
        path = OUT / f"{name}.png"
        make_icon(px, src_img).save(path, "PNG", optimize=True)
        print("Wrote", path)

    make_maskable_icon(512, src_img).save(OUT / "icon-maskable-512.png", "PNG", optimize=True)
    make_icon(180, src_img).save(APPLE, "PNG", optimize=True)
    make_icon(32, src_img).save(APP_ICON, "PNG", optimize=True)
    print("Done.")


if __name__ == "__main__":
    main()
