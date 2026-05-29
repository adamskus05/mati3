#!/usr/bin/env node
/**
 * Regenerate PWA icons from assets/source-icon.png
 * Run: node scripts/generate-icons.mjs
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src =
  process.argv[2] ||
  join(root, "public/icons/source.png");

if (!existsSync(src)) {
  console.error("Source image missing. Place icon at public/icons/source.png");
  process.exit(1);
}

const py = `
from PIL import Image
SRC = ${JSON.stringify(src)}
OUT = ${JSON.stringify(join(root, "public/icons"))}
APPLE = ${JSON.stringify(join(root, "public/apple-touch-icon.png"))}
APP_ICON = ${JSON.stringify(join(root, "src/app/icon.png"))}
BG = (156, 179, 150)

src_img = Image.open(SRC).convert("RGB")

def remove_white_fringe(img, bg, threshold=245):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold and abs(r - g) < 8 and abs(g - b) < 8:
                px[x, y] = bg
    return img

def make_full_bleed_icon(size, scale=1.22):
    src = remove_white_fringe(src_img.copy(), BG)
    new_size = int(max(src.size) * scale)
    scaled = src.resize((new_size, new_size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (new_size, new_size), BG)
    canvas.paste(scaled, (0, 0))
    canvas = remove_white_fringe(canvas, BG)
    left = (new_size - size) // 2
    top = (new_size - size) // 2
    return canvas.crop((left, top, left + size, top + size))

def make_maskable_icon(size=512):
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * 0.9)
    src = remove_white_fringe(src_img.copy(), BG)
    scaled = src.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(scaled, offset)
    return canvas

for name, px in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)]:
    make_full_bleed_icon(px).save(f"{OUT}/{name}.png", "PNG", optimize=True)
make_maskable_icon(512).save(f"{OUT}/icon-maskable-512.png", "PNG", optimize=True)
make_full_bleed_icon(180).save(APPLE, "PNG", optimize=True)
make_full_bleed_icon(32, scale=1.22).save(APP_ICON, "PNG", optimize=True)
print("Icons generated.")
`;

execSync(`python3 -c ${JSON.stringify(py)}`, { stdio: "inherit", cwd: root });
