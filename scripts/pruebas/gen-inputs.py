"""Genera las imágenes SINTÉTICAS de entrada de las pruebas "Lo probamos" (GROW-31).

Son dibujadas con Pillow (no son fotos reales) y se guardan en
public/media/guias/pruebas/ para que cualquier lector pueda repetir la prueba.
Determinista: misma semilla, mismos bytes de salida con la misma versión de Pillow.

    python3 scripts/pruebas/gen-inputs.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "media", "guias", "pruebas")
os.makedirs(OUT, exist_ok=True)
random.seed(31)


def font(size, bold=False):
    for p in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def producto():
    """Una taza azul sobre un fondo gris con degradado y sombra suave."""
    W = H = 1200
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            v = int(196 - 38 * (y / H) - 10 * (x / W))
            px[x, y] = (v, v, v + 4)
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse((250, 880, 950, 1010), fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    img.paste((70, 70, 78), mask=sh)
    d = ImageDraw.Draw(img)
    d.ellipse((860, 430, 1040, 720), outline=(34, 94, 168), width=46)  # asa
    d.rounded_rectangle((260, 330, 940, 940), radius=90, fill=(34, 94, 168))
    d.ellipse((260, 290, 940, 400), fill=(24, 70, 130))
    d.ellipse((290, 305, 910, 385), fill=(236, 226, 206))  # café
    d.rounded_rectangle((330, 520, 520, 820), radius=40, fill=(60, 128, 206))  # brillo
    img.save(os.path.join(OUT, "producto-sintetico.jpg"), quality=82, optimize=True)


def gps():
    """JPEG con EXIF (cámara, fecha, software) y GPS en un monumento público."""
    W, H = 1600, 1200
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line((0, y, W, y), fill=(int(120 + 100 * t), int(170 + 50 * t), int(235 - 60 * t)))
    d.polygon([(0, 900), (400, 560), (760, 820), (1100, 500), (1600, 880), (1600, 1200), (0, 1200)], fill=(70, 110, 80))
    d.ellipse((1180, 120, 1360, 300), fill=(255, 236, 160))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    exif = Image.Exif()
    exif[0x010F] = "PhotoCut Pruebas"          # Make
    exif[0x0110] = "Camara Sintetica 1"        # Model
    exif[0x0131] = "gen-inputs.py"             # Software
    exif[0x0132] = "2026:10:06 12:00:00"       # DateTime
    ifd = exif.get_ifd(0x8769)
    ifd[0x9003] = "2026:10:06 12:00:00"        # DateTimeOriginal
    gps_ifd = exif.get_ifd(0x8825)
    gps_ifd[1] = "S"
    gps_ifd[2] = (34.0, 36.0, 13.32)           # 34°36'13.32" S  (Obelisco, Buenos Aires)
    gps_ifd[3] = "W"
    gps_ifd[4] = (58.0, 22.0, 53.76)           # 58°22'53.76" W
    img.save(os.path.join(OUT, "gps-sintetica.jpg"), quality=78, exif=exif, optimize=True)


def paisaje():
    """Foto "de celular" de 4000×3000 (suave, para que pese poco)."""
    W, H = 4000, 3000
    img = Image.new("RGB", (W // 4, H // 4))
    d = ImageDraw.Draw(img)
    for y in range(H // 4):
        t = y / (H // 4)
        d.line((0, y, W // 4, y), fill=(int(90 + 120 * t), int(150 + 70 * t), int(230 - 40 * t)))
    d.polygon([(0, 560), (200, 330), (380, 480), (560, 300), (800, 520), (1000, 420), (1000, 750), (0, 750)], fill=(60, 100, 70))
    d.ellipse((780, 80, 900, 200), fill=(255, 240, 170))
    img = img.resize((W, H), Image.LANCZOS)
    img.save(os.path.join(OUT, "paisaje-sintetico.jpg"), quality=70, optimize=True)


def captura_ui():
    """Captura de una app en modo claro: barra, tarjetas, botón de acento, texto."""
    W, H = 1280, 720
    img = Image.new("RGB", (W, H), (245, 247, 250))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 64), fill=(255, 255, 255))
    d.line((0, 64, W, 64), fill=(222, 226, 232), width=2)
    d.text((32, 18), "Panel de pruebas", fill=(17, 24, 39), font=font(28, True))
    d.rounded_rectangle((1080, 14, 1240, 50), radius=8, fill=(37, 99, 235))
    d.text((1112, 20), "Nuevo", fill=(255, 255, 255), font=font(22, True))
    for i, (tt, sub) in enumerate([("Ventas", "1.248 pedidos"), ("Usuarios", "3.902 activos"), ("Errores", "7 sin resolver")]):
        x = 32 + i * 400
        d.rounded_rectangle((x, 110, x + 368, 330), radius=14, fill=(255, 255, 255), outline=(222, 226, 232), width=2)
        d.text((x + 24, 134), tt, fill=(75, 85, 99), font=font(24))
        d.text((x + 24, 188), sub, fill=(17, 24, 39), font=font(34, True))
        d.rounded_rectangle((x + 24, 266, x + 168, 300), radius=8, fill=(220, 38, 38) if i == 2 else (22, 163, 74))
    d.rounded_rectangle((32, 370, W - 32, 680), radius=14, fill=(255, 255, 255), outline=(222, 226, 232), width=2)
    d.text((56, 392), "Actividad reciente", fill=(17, 24, 39), font=font(26, True))
    for i in range(4):
        y = 450 + i * 56
        d.text((56, y), f"Evento {i + 1} registrado correctamente", fill=(55, 65, 81), font=font(22))
        d.line((56, y + 40, W - 56, y + 40), fill=(235, 238, 242), width=1)
    img.save(os.path.join(OUT, "captura-ui-clara.png"), optimize=True)


if __name__ == "__main__":
    producto()
    gps()
    paisaje()
    captura_ui()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB", Image.open(os.path.join(OUT, f)).size)
