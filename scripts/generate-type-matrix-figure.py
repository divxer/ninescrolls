#!/usr/bin/env python3
"""Render the editorial wafer probe station type comparison matrix figure.

Content comes exclusively from src/data/probeStations/typeMatrixContent.json —
the JSON is the single copy source for type names, dimension labels, and all
matrix cells. Only the title, subtitle, and footer strings belong to this file.
"""

import json
import unicodedata
from pathlib import Path
from tempfile import TemporaryDirectory

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "src/templates/equipmentGuide/fonts"
OUT = ROOT / "public/assets/images/insights/probe-station-type-matrix.v1-candidate.png"
CONTENT = json.loads((ROOT / "src/data/probeStations/typeMatrixContent.json").read_text())

W, H = 1600, 900
NAVY, ACCENT, INK = "#1e3a5f", "#3b82f6", "#17324d"
MUTED, FIELD, WHITE, RULE = "#5c7085", "#f7fafc", "#ffffff", "#d6e2ec"
ALT_ROW, SUBTITLE_INK = "#eef3f8", "#d8e7f5"
HEADER_BOTTOM = round(H * 0.18)  # 162 — navy header band is 18% of the height

TITLE = "Wafer Probe Station Types"
SUBTITLE = "Six measurement environments compared for evaluation"
FOOTER = "Illustrative comparison. Configuration determines actual capability."

TYPES = [str(t) for t in CONTENT["types"]]
DIMENSIONS = [str(d) for d in CONTENT["dimensions"]]
CELLS = [[str(cell) for cell in row] for row in CONTENT["cells"]]

# 7-column grid: dimension-label column + six type columns.
GRID_LEFT, GRID_RIGHT = 32, 1568
LABEL_COL_W = 180
TYPE_COL_W = (GRID_RIGHT - GRID_LEFT - LABEL_COL_W) // 6  # 226
X_EDGES = [GRID_LEFT, GRID_LEFT + LABEL_COL_W] + [
    GRID_LEFT + LABEL_COL_W + (i + 1) * TYPE_COL_W for i in range(6)
]
TYPE_HEADER_TOP, TYPE_HEADER_BOTTOM = 182, 238
ROW_HEIGHT = 145
GRID_BOTTOM = TYPE_HEADER_BOTTOM + len(DIMENSIONS) * ROW_HEIGHT  # 818
CELL_PAD_X, CELL_PAD_Y = 13, 9


def convert_font(source: Path, target: Path) -> Path:
    converted = TTFont(source)
    converted.flavor = None
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


def fit_cell(
    draw: ImageDraw.ImageDraw,
    label: str,
    text: str,
    font_path: Path,
    max_size: int,
    min_size: int,
    box_width: int,
    box_height: int,
    max_lines: int,
    spacing_ratio: float = 1.25,
) -> tuple[ImageFont.FreeTypeFont, list[str], int, int]:
    """fit_text that fails loud with the cell's identity — never clips silently."""
    try:
        font, lines, spacing = fit_text(
            draw, text, font_path, max_size, min_size, box_width, box_height, max_lines, spacing_ratio
        )
    except ValueError as error:
        raise RuntimeError(f"cell {label} does not fit: {error}") from error
    return font, lines, spacing, font.size


def assert_glyph_coverage(font_files: dict[str, Path], usage: dict[str, list[str]]) -> None:
    """Every rendered codepoint must exist in the cmap of the font that draws it."""
    missing: list[str] = []
    for font_key, strings in usage.items():
        cmap = TTFont(font_files[font_key]).getBestCmap() or {}
        seen: set[int] = set()
        for text in strings:
            for char in text:
                codepoint = ord(char)
                if codepoint in seen:
                    continue
                seen.add(codepoint)
                if char.isspace() or unicodedata.category(char).startswith("C"):
                    continue
                if codepoint not in cmap:
                    missing.append(
                        f"U+{codepoint:04X} ({char!r}) missing from {font_files[font_key].name}"
                    )
    if missing:
        raise RuntimeError("glyph coverage failure:\n" + "\n".join(sorted(set(missing))))


def main() -> None:
    with TemporaryDirectory(prefix="type-matrix-fonts-") as temp_dir:
        temp = Path(temp_dir)
        font_files = {
            "heading": convert_font(FONT_DIR / "SpaceGrotesk-Variable.woff2", temp / "SpaceGrotesk.ttf"),
            "regular": convert_font(FONT_DIR / "Inter-Regular.woff2", temp / "Inter-Regular.ttf"),
            "medium": convert_font(FONT_DIR / "Inter-Medium.woff2", temp / "Inter-Medium.ttf"),
            "semibold": convert_font(FONT_DIR / "Inter-SemiBold.woff2", temp / "Inter-SemiBold.ttf"),
        }

        row_labels = [d.upper() for d in DIMENSIONS]
        assert_glyph_coverage(
            font_files,
            {
                "heading": [TITLE],
                "regular": [SUBTITLE, FOOTER] + [cell for row in CELLS for cell in row],
                "semibold": TYPES + row_labels,
            },
        )
        print("glyph coverage: OK (all rendered codepoints present)")

        image = Image.new("RGB", (W, H), FIELD)
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, W, HEADER_BOTTOM), fill=NAVY)

        title_font = load_font(font_files["heading"], 46, 600)
        subtitle_font = load_font(font_files["regular"], 22)
        draw.text((72, 32), TITLE, font=title_font, fill=WHITE)
        draw.text((74, 103), SUBTITLE, font=subtitle_font, fill=SUBTITLE_INK)

        # --- Type header row: fit each name, then render all at the shared minimum.
        header_box_w = TYPE_COL_W - 2 * CELL_PAD_X
        header_box_h = TYPE_HEADER_BOTTOM - TYPE_HEADER_TOP - 2 * CELL_PAD_Y
        header_size = min(
            fit_cell(draw, f"type-header[{name}]", name, font_files["semibold"], 21, 14,
                     header_box_w, header_box_h, 2, 1.15)[3]
            for name in TYPES
        )
        draw.rectangle((GRID_LEFT, TYPE_HEADER_TOP, GRID_RIGHT, TYPE_HEADER_BOTTOM), fill=WHITE)
        for col, name in enumerate(TYPES):
            left, right = X_EDGES[col + 1], X_EDGES[col + 2]
            font, lines, spacing, _ = fit_cell(
                draw, f"type-header[{name}]", name, font_files["semibold"], header_size, header_size,
                header_box_w, header_box_h, 2, 1.15,
            )
            draw_centered_lines(
                draw,
                (left + CELL_PAD_X, TYPE_HEADER_TOP + CELL_PAD_Y, right - CELL_PAD_X, TYPE_HEADER_BOTTOM - CELL_PAD_Y),
                lines, font, ACCENT, spacing,
            )
        draw.line((GRID_LEFT, TYPE_HEADER_BOTTOM, GRID_RIGHT, TYPE_HEADER_BOTTOM), fill=ACCENT, width=3)
        print(f"type header row: {header_size}px semibold")

        # --- Row labels: shared minimum size across the four dimensions.
        label_box_w = LABEL_COL_W - 2 * CELL_PAD_X
        label_box_h = ROW_HEIGHT - 2 * CELL_PAD_Y
        label_size = min(
            fit_cell(draw, f"row-label[{label}]", label, font_files["semibold"], 14, 11,
                     label_box_w, label_box_h, 4, 1.3)[3]
            for label in row_labels
        )
        print(f"row labels: {label_size}px semibold (uppercase)")

        # --- Content rows: per-row uniform cell size (min across the row's six cells).
        cell_box_w = TYPE_COL_W - 2 * CELL_PAD_X
        cell_box_h = ROW_HEIGHT - 2 * CELL_PAD_Y
        y = TYPE_HEADER_BOTTOM
        for row_index, row_label in enumerate(row_labels):
            if row_index % 2 == 1:
                draw.rectangle((GRID_LEFT, y, GRID_RIGHT, y + ROW_HEIGHT), fill=ALT_ROW)
            if row_index > 0:
                draw.line((GRID_LEFT, y, GRID_RIGHT, y), fill=RULE, width=2)

            font, lines, spacing, _ = fit_cell(
                draw, f"row-label[{row_label}]", row_label, font_files["semibold"], label_size, label_size,
                label_box_w, label_box_h, 4, 1.3,
            )
            draw_centered_lines(
                draw,
                (GRID_LEFT + CELL_PAD_X, y + CELL_PAD_Y, X_EDGES[1] - CELL_PAD_X, y + ROW_HEIGHT - CELL_PAD_Y),
                lines, font, MUTED, spacing,
            )

            row_size = min(
                fit_cell(draw, f"cell[{DIMENSIONS[row_index]} × {TYPES[col]}]", CELLS[row_index][col],
                         font_files["regular"], 17, 13, cell_box_w, cell_box_h, 6)[3]
                for col in range(6)
            )
            for col in range(6):
                left, right = X_EDGES[col + 1], X_EDGES[col + 2]
                font, lines, spacing, _ = fit_cell(
                    draw, f"cell[{DIMENSIONS[row_index]} × {TYPES[col]}]", CELLS[row_index][col],
                    font_files["regular"], row_size, row_size, cell_box_w, cell_box_h, 6,
                )
                draw_centered_lines(
                    draw,
                    (left + CELL_PAD_X, y + CELL_PAD_Y, right - CELL_PAD_X, y + ROW_HEIGHT - CELL_PAD_Y),
                    lines, font, INK, spacing,
                )
            print(f"row {row_index + 1} ({DIMENSIONS[row_index]}): {row_size}px regular")
            y += ROW_HEIGHT
        draw.line((GRID_LEFT, GRID_BOTTOM, GRID_RIGHT, GRID_BOTTOM), fill=RULE, width=2)

        footer_font = load_font(font_files["regular"], 15)
        assert GRID_BOTTOM + 30 < 858, "footer collides with the matrix"
        draw.text((GRID_LEFT, 858), FOOTER, font=footer_font, fill=MUTED)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        image.save(OUT, format="PNG", optimize=True, icc_profile=None)

    with Image.open(OUT) as check:
        assert check.size == (1600, 900)
        assert check.mode == "RGB"
    print(OUT)


if __name__ == "__main__":
    main()
