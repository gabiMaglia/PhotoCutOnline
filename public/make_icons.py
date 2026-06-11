#!/usr/bin/env python3
"""make_icons.py — generador de iconos de app en todas las medidas.

Compañero CLI de PhotoCut Studio. A partir de un PNG (idealmente cuadrado y
con transparencia) genera la estructura estándar de iconos para:

  ios/AppIcon.appiconset/   Contents.json universal (Xcode 14+) + legacy px
  android/mipmap-*/         legacy + round + adaptive foreground + Play Store
  macos/AppIcon.iconset/    16–1024 px (y .icns automático en macOS)
  windows/app.ico           ICO multi-resolución 16–256 px
  web/                      favicons, apple-touch, PWA, maskable, manifest

Uso:
    pip install pillow
    python make_icons.py logo.png
    python make_icons.py logo.png -o iconos --padding 0.1 --bg "#101010"
    python make_icons.py logo.png --name "Mi App" --platforms ios android

Solo requiere Pillow. El .icns se crea con `iconutil` si estás en macOS.
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow. Instálalo con:  pip install pillow")

IOS_LEGACY = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]
ANDROID_LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ANDROID_ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
MACOS_SET = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
WEB_PNGS = [
    ("favicon-16.png", 16),
    ("favicon-32.png", 32),
    ("favicon-48.png", 48),
    ("apple-touch-icon-180.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
]
ALL_PLATFORMS = ["ios", "android", "macos", "windows", "web"]


def parse_color(value: str | None):
    """'#rgb', '#rrggbb' o '#rrggbbaa' → tupla RGBA, o None."""
    if not value:
        return None
    v = value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    if len(v) == 6:
        v += "ff"
    if len(v) != 8:
        raise argparse.ArgumentTypeError(f"color inválido: {value!r}")
    return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4, 6))


def render(source: Image.Image, size: int, padding: float, bg, round_mask: bool = False):
    """Centra el arte en un lienzo cuadrado con margen y fondo opcionales."""
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    avail = max(1, round(size * (1 - padding * 2)))
    art = source.copy()
    art.thumbnail((avail, avail), Image.LANCZOS)
    pos = ((size - art.width) // 2, (size - art.height) // 2)
    canvas.alpha_composite(art, pos)
    if round_mask:
        mask = Image.new("L", (size * 4, size * 4), 0)
        from PIL import ImageDraw

        ImageDraw.Draw(mask).ellipse((0, 0, size * 4, size * 4), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        return out
    return canvas


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  {path}")


def gen_ios(src, out, padding, bg):
    base = out / "ios" / "AppIcon.appiconset"
    save(render(src, 1024, padding, bg), base / "icon-1024.png")
    contents = {
        "images": [
            {
                "filename": "icon-1024.png",
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
            }
        ],
        "info": {"author": "photocut-studio", "version": 1},
    }
    (base / "Contents.json").write_text(json.dumps(contents, indent=2))
    print(f"  {base / 'Contents.json'}")
    for s in IOS_LEGACY:
        save(render(src, s, padding, bg), out / "ios" / "legacy" / f"icon-{s}.png")


def gen_android(src, out, padding, bg):
    for dpi, s in ANDROID_LEGACY.items():
        d = out / "android" / f"mipmap-{dpi}"
        save(render(src, s, padding, bg), d / "ic_launcher.png")
        save(render(src, s, padding, bg, round_mask=True), d / "ic_launcher_round.png")
    for dpi, s in ANDROID_ADAPTIVE.items():
        # adaptive foreground: zona segura central de 66/108 dp
        fg_pad = 0.2 + padding * 0.5
        save(
            render(src, s, fg_pad, None),
            out / "android" / f"mipmap-{dpi}" / "ic_launcher_foreground.png",
        )
    save(render(src, 512, padding, bg), out / "android" / "play_store_512.png")


def gen_macos(src, out, padding, bg):
    iconset = out / "macos" / "AppIcon.iconset"
    for name, s in MACOS_SET:
        save(render(src, s, padding, bg), iconset / name)
    if platform.system() == "Darwin" and shutil.which("iconutil"):
        icns = out / "macos" / "AppIcon.icns"
        try:
            subprocess.run(
                ["iconutil", "-c", "icns", str(iconset), "-o", str(icns)],
                check=True,
                capture_output=True,
            )
            print(f"  {icns}  (vía iconutil)")
        except subprocess.CalledProcessError as e:
            print(f"  aviso: iconutil falló ({e.stderr.decode().strip()})")
    else:
        print("  nota: ejecuta `iconutil -c icns macos/AppIcon.iconset` en macOS para el .icns")


def gen_windows(src, out, padding, bg):
    path = out / "windows" / "app.ico"
    path.parent.mkdir(parents=True, exist_ok=True)
    base = render(src, 256, padding, bg)
    base.save(path, format="ICO", sizes=[(s, s) for s in ICO_SIZES])
    print(f"  {path}")


def gen_web(src, out, padding, bg, name):
    web = out / "web"
    for fname, s in WEB_PNGS:
        save(render(src, s, padding, bg), web / fname)
    # maskable: zona segura del 20% y fondo obligatorio
    mask_bg = bg or (17, 19, 23, 255)
    save(render(src, 512, max(0.2, padding), mask_bg), web / "maskable-512.png")
    fav = render(src, 48, padding, bg)
    web.mkdir(parents=True, exist_ok=True)
    fav.save(web / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {web / 'favicon.ico'}")
    manifest = {
        "name": name,
        "short_name": name,
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {
                "src": "maskable-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
        "display": "standalone",
    }
    (web / "site.webmanifest").write_text(json.dumps(manifest, indent=2))
    print(f"  {web / 'site.webmanifest'}")


def main():
    ap = argparse.ArgumentParser(
        description="Genera iconos de app en todas las medidas a partir de un PNG.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("input", type=Path, help="PNG fuente (idealmente cuadrado, con alfa)")
    ap.add_argument("-o", "--out", type=Path, default=Path("app-icons"), help="carpeta de salida")
    ap.add_argument("--padding", type=float, default=0.08, help="margen relativo 0–0.3")
    ap.add_argument("--bg", type=parse_color, default=None, help='fondo, ej. "#101010" (por defecto transparente)')
    ap.add_argument("--name", default="Mi App", help="nombre para el manifest PWA")
    ap.add_argument(
        "--platforms",
        nargs="+",
        choices=ALL_PLATFORMS,
        default=ALL_PLATFORMS,
        help="plataformas a generar",
    )
    args = ap.parse_args()

    if not args.input.exists():
        sys.exit(f"No existe: {args.input}")
    if not 0 <= args.padding <= 0.3:
        sys.exit("--padding debe estar entre 0 y 0.3")

    src = Image.open(args.input).convert("RGBA")
    if src.width < 1024 or src.height < 1024:
        print(f"aviso: la fuente es {src.width}×{src.height}px; se recomienda ≥1024px")

    gens = {
        "ios": lambda: gen_ios(src, args.out, args.padding, args.bg),
        "android": lambda: gen_android(src, args.out, args.padding, args.bg),
        "macos": lambda: gen_macos(src, args.out, args.padding, args.bg),
        "windows": lambda: gen_windows(src, args.out, args.padding, args.bg),
        "web": lambda: gen_web(src, args.out, args.padding, args.bg, args.name),
    }
    for p in args.platforms:
        print(f"\n[{p}]")
        gens[p]()

    print(f"\nListo → {args.out.resolve()}")


if __name__ == "__main__":
    main()
