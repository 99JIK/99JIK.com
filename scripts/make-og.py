#!/usr/bin/env python
"""Generates public/og.png, the social-card image referenced by index.html.

One-off dev tool, not part of `npm run build`. Needs Pillow and the Windows system
fonts (Consolas for the terminal look, Malgun Gothic for Hangul). Re-run by hand
when the name, role or theme colors in src/data.js change.
"""
from PIL import Image, ImageDraw, ImageFont
import pathlib

W, H = 1200, 630

# Pulled from the `dark` theme in src/themes.js.
BG      = "#0c0c0d"
PANEL   = "#111114"
BORDER  = "#232327"
FG      = "#e6e6e3"
MUTED   = "#6b7280"
ACCENT  = "#7dd3fc"
GREEN   = "#6ee7a8"

F = "C:/Windows/Fonts/"
mono      = lambda s: ImageFont.truetype(F + "consola.ttf", s)
mono_bold = lambda s: ImageFont.truetype(F + "consolab.ttf", s)
kr        = lambda s: ImageFont.truetype(F + "malgun.ttf", s)
kr_bold   = lambda s: ImageFont.truetype(F + "malgunbd.ttf", s)

LOGO = [
    " █████╗  █████╗      ██╗██╗██╗  ██╗",
    "██╔══██╗██╔══██╗     ██║██║██║ ██╔╝",
    "╚██████║╚██████║     ██║██║█████╔╝ ",
    " ╚═══██║ ╚═══██║██   ██║██║██╔═██╗ ",
    " █████╔╝ █████╔╝╚█████╔╝██║██║  ██╗",
    " ╚════╝  ╚════╝  ╚════╝ ╚═╝╚═╝  ╚═╝",
]

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# window chrome: a framed terminal panel inset from the edges
M = 48
d.rectangle([M, M, W - M, H - M], fill=PANEL, outline=BORDER, width=1)
d.rectangle([M, M, W - M, M + 44], fill="#1a1a1c", outline=BORDER, width=1)
for i, c in enumerate(["#fb7185", "#fcd34d", "#6ee7a8"]):
    d.ellipse([M + 22 + i * 22, M + 16, M + 34 + i * 22, M + 28], fill=c)
d.text((M + 110, M + 13), "jeongin@99jik - ~ - zsh", font=mono(15), fill=MUTED)

x = M + 56
y = M + 76

# Supersampled: at final size Consolas leaves hairline seams between adjacent
# block glyphs, which reads as a grid over the wordmark. Draw 4x, downscale away.
SS = 4
f_logo = mono_bold(22 * SS)
cell_h = 26 * SS
lw = max(int(d.textlength(l, font=f_logo)) for l in LOGO)
layer = Image.new("RGBA", (lw + 4, cell_h * len(LOGO) + 8), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
for i, line in enumerate(LOGO):
    ld.text((0, i * cell_h), line, font=f_logo, fill=ACCENT)
layer = layer.resize((layer.width // SS, layer.height // SS), Image.LANCZOS)
img.paste(layer, (x, y), layer)
y += layer.height

y += 34
d.text((x, y), "$ whoami", font=mono(19), fill=GREEN)
y += 40

f_name = mono_bold(52)
d.text((x, y), "Jeongin Kim", font=f_name, fill=FG)
w = d.textlength("Jeongin Kim", font=f_name)
d.text((x + w + 22, y + 14), "김정인", font=kr_bold(34), fill=MUTED)
y += 74

d.text((x, y), "MS Candidate · Software Testing Lab", font=mono(22), fill=FG)
y += 32
d.text((x, y), "Kyungpook National University · Daegu, KR", font=mono(22), fill=MUTED)

# footer sits on its own baseline just above the panel edge
fy = H - M - 46
d.line([x, fy - 18, W - M - 56, fy - 18], fill=BORDER, width=1)
d.text((x, fy), "99jik.com", font=mono_bold(24), fill=ACCENT)
tail = "SIL · LLM/SLM-based testing"
tw = d.textlength(tail, font=mono(19))
d.text((W - M - 56 - tw, fy + 4), tail, font=mono(19), fill=MUTED)

out = pathlib.Path("public/og.png")
out.parent.mkdir(parents=True, exist_ok=True)
img.save(out, optimize=True)
print(f"wrote {out} ({out.stat().st_size} bytes)")
