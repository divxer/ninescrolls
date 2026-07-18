#!/usr/bin/env python3
"""Render the editorial cryogenic cooling architecture comparison figure."""

from pathlib import Path
from tempfile import TemporaryDirectory

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "src/templates/equipmentGuide/fonts"
OUT = ROOT / "public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png"

W, H = 1600, 900
NAVY, ACCENT, INK = "#1e3a5f", "#3b82f6", "#17324d"
MUTED, FIELD, WHITE, RULE = "#5c7085", "#f6f9fc", "#ffffff", "#d6e2ec"
PALE_ACCENT, ALT_ROW = "#e8f1ff", "#eef4f9"
HEADER_BOTTOM, THERMAL_BOTTOM, MATRIX_BOTTOM = 162, 472, 844
TITLE = "Three Cryogenic Cooling Architectures"
SUBTITLE = "Thermal paths and operating trade-offs for probe-station evaluation"
ROWS = [
    "CONSUMABLES / UTILITIES",
    "MECHANICAL VIBRATION SOURCE",
    "OPERATING PATTERN",
    "BUYER’S KEY QUESTION",
]
ARCHITECTURES = [
    {
        "title": "LN₂ flow / reservoir",
        "path": ["Dewar", "Flow or reservoir", "Sample stage"],
        "reference": "77.4 K normal boiling-point reference",
        "cells": [
            "Dewar and refills",
            "No mechanical cryocooler",
            "Moderate low-temperature work",
            "Local supply and refill cadence",
        ],
        "icons": ["dewar", "reservoir", "stage"],
    },
    {
        "title": "Closed-cycle cryocooler",
        "path": ["Compressor", "Cold head", "Thermal link", "Sample stage"],
        "reference": "No liquid-cryogen refill during operation",
        "cells": [
            "Electricity; cooling water or air",
            "Compressor / cold-head motion",
            "Long-running operation without cryogen refills",
            "Vibration at the sample under load",
        ],
        "icons": ["compressor", "cold_head", "thermal_link", "stage"],
    },
    {
        "title": "LHe flow / bath",
        "path": ["Dewar", "Flow or bath", "Sample stage"],
        "reference": "4.2 K normal boiling-point reference",
        "cells": [
            "Helium supply; recovery planning",
            "No mechanical cryocooler",
            "Lowest-temperature work in this comparison",
            "Recovery and supply contingency",
        ],
        "icons": ["dewar", "bath", "stage"],
    },
]
FOOTER = (
    "Illustrative comparison. Actual stage temperature depends on heat load, "
    "thermal links, and configuration."
)


def convert_font(source: Path, target: Path) -> Path:
    converted = TTFont(source)
    converted.flavor = None
    cmap = converted.getBestCmap() or {}
    for codepoint in (0x2082, 0x2019):
        if codepoint not in cmap:
            raise RuntimeError(f"{source.name} lacks required U+{codepoint:04X} glyph")
    converted.save(target)
    return target


def load_font(path: Path, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    loaded = ImageFont.truetype(str(path), size=size)
    if weight is not None:
        loaded.set_variation_by_axes([weight])
    return loaded


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= width:
            current = candidate
        else:
            if not current:
                raise ValueError(f"word does not fit text box: {word}")
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: Path,
    max_size: int,
    min_size: int,
    box_width: int,
    box_height: int,
    max_lines: int,
    spacing_ratio: float = 1.25,
) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    for size in range(max_size, min_size - 1, -1):
        candidate = load_font(font_path, size)
        lines = wrap_lines(draw, text, candidate, box_width)
        spacing = round(size * spacing_ratio)
        height = size + max(0, len(lines) - 1) * spacing
        if len(lines) <= max_lines and height <= box_height:
            return candidate, lines, spacing
    raise ValueError(f"text does not fit at minimum size {min_size}: {text}")


def draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int,
) -> None:
    left, top, right, bottom = box
    line_heights = [draw.textbbox((0, 0), line, font=font)[3] for line in lines]
    total = line_heights[0] + max(0, len(lines) - 1) * spacing
    y = top + (bottom - top - total) / 2
    for line in lines:
        width = draw.textbbox((0, 0), line, font=font)[2]
        draw.text(((left + right - width) / 2, y), line, font=font, fill=fill)
        y += spacing


def draw_icon(draw: ImageDraw.ImageDraw, kind: str, center: tuple[int, int]) -> None:
    cx, cy = center
    draw.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=PALE_ACCENT)
    x, y = cx - 28, cy - 28
    line = {"fill": INK, "width": 3}

    if kind == "dewar":
        draw.rounded_rectangle((x + 15, y + 8, x + 41, y + 53), radius=8, outline=INK, width=3)
        draw.rectangle((x + 22, y + 2, x + 34, y + 11), outline=INK, width=3)
        draw.line((x + 17, y + 23, x + 39, y + 23), **line)
        draw.line((x + 17, y + 40, x + 39, y + 40), **line)
    elif kind in {"reservoir", "bath"}:
        if kind == "reservoir":
            draw.rounded_rectangle((x + 8, y + 15, x + 48, y + 44), radius=8, outline=INK, width=3)
            draw.line((x + 1, y + 29, x + 8, y + 29), **line)
            draw.line((x + 48, y + 29, x + 55, y + 29), **line)
        else:
            draw.line((x + 8, y + 14, x + 13, y + 48, x + 43, y + 48, x + 48, y + 14), **line)
            draw.line((x + 14, y + 30, x + 42, y + 30), fill=ACCENT, width=3)
    elif kind == "compressor":
        draw.rounded_rectangle((x + 5, y + 10, x + 51, y + 47), radius=6, outline=INK, width=3)
        draw.ellipse((x + 19, y + 14, x + 43, y + 38), outline=INK, width=3)
        draw.ellipse((x + 28, y + 23, x + 34, y + 29), fill=INK)
        for dx, dy in ((0, -9), (9, 0), (0, 9), (-9, 0)):
            draw.line((x + 31, y + 26, x + 31 + dx, y + 26 + dy), **line)
    elif kind == "cold_head":
        draw.rounded_rectangle((x + 19, y + 5, x + 37, y + 20), radius=4, outline=INK, width=3)
        draw.rectangle((x + 14, y + 20, x + 42, y + 34), outline=INK, width=3)
        draw.rectangle((x + 20, y + 34, x + 36, y + 50), outline=INK, width=3)
    elif kind == "thermal_link":
        draw.line((x + 4, y + 15, x + 4, y + 43), **line)
        draw.line((x + 52, y + 15, x + 52, y + 43), **line)
        draw.arc((x + 4, y + 13, x + 52, y + 38), start=0, end=180, fill=INK, width=3)
        draw.arc((x + 4, y + 20, x + 52, y + 45), start=180, end=360, fill=INK, width=3)
    elif kind == "stage":
        draw.ellipse((x + 17, y + 13, x + 39, y + 35), outline=ACCENT, width=3)
        draw.polygon([(x + 7, y + 39), (x + 49, y + 39), (x + 44, y + 48), (x + 12, y + 48)], outline=INK)
        draw.line((x + 7, y + 39, x + 49, y + 39), **line)
        draw.line((x + 12, y + 48, x + 44, y + 48), **line)
    else:
        raise ValueError(f"unknown icon: {kind}")


def draw_arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int]) -> None:
    x1, y1 = start
    x2, y2 = end
    draw.line((x1, y1, x2 - 8, y2), fill=ACCENT, width=2)
    draw.polygon([(x2, y2), (x2 - 9, y2 - 5), (x2 - 9, y2 + 5)], fill=ACCENT)


def draw_path(
    draw: ImageDraw.ImageDraw,
    architecture: dict[str, object],
    bounds: tuple[int, int],
    heading_font: ImageFont.FreeTypeFont,
    label_font: ImageFont.FreeTypeFont,
    reference_font: ImageFont.FreeTypeFont,
) -> None:
    left, right = bounds
    title = str(architecture["title"])
    title_width = draw.textbbox((0, 0), title, font=heading_font)[2]
    draw.text(((left + right - title_width) / 2, 188), title, font=heading_font, fill=INK)

    path = list(architecture["path"])
    icons = list(architecture["icons"])
    inset = 54 if len(path) == 3 else 42
    step = (right - left - 2 * inset) / (len(path) - 1)
    centers = [(round(left + inset + i * step), 294) for i in range(len(path))]
    for index in range(len(centers) - 1):
        draw_arrow(draw, (centers[index][0] + 40, 294), (centers[index + 1][0] - 40, 294))
    for center, icon, label in zip(centers, icons, path):
        draw_icon(draw, str(icon), center)
        font, lines, spacing = fit_text(draw, str(label), FONT_FILES["regular"], 18, 17, 104, 48, 2)
        draw_centered_lines(draw, (center[0] - 56, 335, center[0] + 56, 382), lines, font, INK, spacing)

    reference = str(architecture["reference"])
    font, lines, spacing = fit_text(draw, reference, FONT_FILES["medium"], 17, 15, right - left - 30, 44, 2)
    draw_centered_lines(draw, (left + 10, 407, right - 10, 451), lines, font, ACCENT, spacing)


def draw_matrix(
    draw: ImageDraw.ImageDraw,
    label_font_path: Path,
    cell_font_path: Path,
) -> None:
    x_edges = [32, 230, 680, 1130, 1580]
    heights = [78, 78, 88, 82]
    y = 490
    for row_index, height in enumerate(heights):
        fill = WHITE if row_index % 2 == 0 else ALT_ROW
        draw.rectangle((32, y, 1580, y + height), fill=fill)
        draw.line((32, y, 1580, y), fill=RULE, width=2)

        label_font, label_lines, label_spacing = fit_text(
            draw, ROWS[row_index], label_font_path, 15, 13, 166, height - 18, 2, 1.2
        )
        draw_centered_lines(draw, (48, y + 5, 214, y + height - 5), label_lines, label_font, MUTED, label_spacing)

        for col_index, architecture in enumerate(ARCHITECTURES):
            text = architecture["cells"][row_index]
            left, right = x_edges[col_index + 1], x_edges[col_index + 2]
            cell_font, cell_lines, cell_spacing = fit_text(
                draw, text, cell_font_path, 20, 18, right - left - 46, height - 18, 3
            )
            draw_centered_lines(
                draw, (left + 20, y + 5, right - 20, y + height - 5),
                cell_lines, cell_font, INK, cell_spacing
            )
        y += height
    draw.line((32, y, 1580, y), fill=RULE, width=2)


def main() -> None:
    global FONT_FILES
    with TemporaryDirectory(prefix="cryo-figure-fonts-") as temp_dir:
        temp = Path(temp_dir)
        FONT_FILES = {
            "heading": convert_font(FONT_DIR / "SpaceGrotesk-Variable.woff2", temp / "SpaceGrotesk.ttf"),
            "regular": convert_font(FONT_DIR / "Inter-Regular.woff2", temp / "Inter-Regular.ttf"),
            "medium": convert_font(FONT_DIR / "Inter-Medium.woff2", temp / "Inter-Medium.ttf"),
            "semibold": convert_font(FONT_DIR / "Inter-SemiBold.woff2", temp / "Inter-SemiBold.ttf"),
        }

        image = Image.new("RGB", (W, H), FIELD)
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, W, HEADER_BOTTOM), fill=NAVY)

        title_font = load_font(FONT_FILES["heading"], 46, 600)
        subtitle_font = load_font(FONT_FILES["regular"], 22)
        draw.text((72, 32), TITLE, font=title_font, fill=WHITE)
        draw.text((74, 103), SUBTITLE, font=subtitle_font, fill="#d8e7f5")

        heading_font = load_font(FONT_FILES["semibold"], 25)
        label_font = load_font(FONT_FILES["regular"], 18)
        reference_font = load_font(FONT_FILES["medium"], 17)
        for architecture, bounds in zip(ARCHITECTURES, ((250, 690), (700, 1140), (1150, 1590))):
            draw_path(draw, architecture, bounds, heading_font, label_font, reference_font)

        draw_matrix(draw, FONT_FILES["semibold"], FONT_FILES["regular"])
        footer_font = load_font(FONT_FILES["regular"], 15)
        draw.text((72, 858), FOOTER, font=footer_font, fill=MUTED)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        image.save(OUT, format="PNG", optimize=True, icc_profile=None)

    with Image.open(OUT) as check:
        assert check.size == (1600, 900)
        assert check.mode == "RGB"
    print(OUT)


FONT_FILES: dict[str, Path] = {}

if __name__ == "__main__":
    main()
