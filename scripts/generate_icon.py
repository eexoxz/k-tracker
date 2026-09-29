from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

base = Image.new("RGBA", (256, 256), (22, 32, 42, 255))
draw = ImageDraw.Draw(base)

draw.rounded_rectangle((26, 26, 230, 230), radius=42, fill=(31, 64, 70, 255))
draw.rounded_rectangle((48, 48, 208, 208), radius=30, outline=(158, 216, 211, 255), width=8)

font = None
for font_path in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
    try:
        font = ImageFont.truetype(font_path, 132)
        break
    except OSError:
        pass

if font is None:
    font = ImageFont.load_default()

bounds = draw.textbbox((0, 0), "K", font=font)
text_width = bounds[2] - bounds[0]
text_height = bounds[3] - bounds[1]
draw.text(
    ((256 - text_width) / 2, (256 - text_height) / 2 - 10),
    "K",
    font=font,
    fill=(231, 196, 107, 255),
)

for size, filename in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")):
    base.resize((size, size), Image.Resampling.LANCZOS).save(ICON_DIR / filename)

base.save(
    ICON_DIR / "icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
