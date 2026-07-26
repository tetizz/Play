#!/usr/bin/env python3
"""Render a neutral proof sheet for the IWantCheckmate portrait roster."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DEFAULT_ASSET_DIRECTORY = (
    Path(__file__).resolve().parents[1] / "public" / "assets" / "iwantcheckmate"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render every IWantCheckmate PNG at a consistent visible size."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_ASSET_DIRECTORY,
        help="Directory containing profile PNGs.",
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--cell-size", type=int, default=300)
    return parser.parse_args()


def readable_name(path: Path) -> str:
    return path.stem.removesuffix("-profile").replace("-", " ").title()


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = (
        Path("C:/Windows/Fonts/segoeuib.ttf")
        if bold
        else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf")
        if bold
        else Path("C:/Windows/Fonts/arial.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def portrait_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(lambda value: 255 if value >= 24 else 0).getbbox()


def render_cell(
    path: Path,
    cell_size: int,
    label_height: int,
    font: ImageFont.ImageFont,
) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    cell = Image.new("RGB", (cell_size, cell_size + label_height), "#111416")
    draw = ImageDraw.Draw(cell)

    preview_height = cell_size
    split = cell_size // 2
    draw.rectangle((0, 0, split, preview_height), fill="#15191c")
    draw.rectangle((split, 0, cell_size, preview_height), fill="#e8e5df")
    draw.line((split, 0, split, preview_height), fill="#747474", width=1)

    target = round(cell_size * 0.82)
    image.thumbnail((target, target), Image.Resampling.LANCZOS)
    position = (
        (cell_size - image.width) // 2,
        (preview_height - image.height) // 2,
    )
    cell.paste(image, position, image)

    draw.rectangle(
        (0, preview_height, cell_size, preview_height + label_height),
        fill="#0a0c0e",
    )
    label = readable_name(path)
    label_box = draw.textbbox((0, 0), label, font=font)
    label_width = label_box[2] - label_box[0]
    draw.text(
        ((cell_size - label_width) // 2, preview_height + 13),
        label,
        fill="#f4f1ea",
        font=font,
    )

    bounds = portrait_bounds(Image.open(path).convert("RGBA"))
    dimensions = f"{path.stat().st_size // 1024} KB"
    if bounds:
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        dimensions = f"{image.width} px preview | subject {width}x{height}"
    info_font = load_font(12)
    info_box = draw.textbbox((0, 0), dimensions, font=info_font)
    info_width = info_box[2] - info_box[0]
    draw.text(
        ((cell_size - info_width) // 2, preview_height + 43),
        dimensions,
        fill="#a9a59d",
        font=info_font,
    )
    return cell


def main() -> None:
    args = parse_args()
    paths = sorted(
        (
            path
            for path in args.input.glob("*-profile.png")
            if "-check" not in path.stem
        ),
        key=lambda path: path.name.casefold(),
    )
    if not paths:
        raise SystemExit(f"No profile PNGs found in {args.input}")

    columns = max(1, args.columns)
    rows = (len(paths) + columns - 1) // columns
    cell_size = max(180, args.cell_size)
    label_height = 72
    gutter = 12
    title_height = 78
    width = (columns * cell_size) + ((columns + 1) * gutter)
    height = title_height + (rows * (cell_size + label_height)) + ((rows + 1) * gutter)
    sheet = Image.new("RGB", (width, height), "#080a0c")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(28, bold=True)
    label_font = load_font(18, bold=True)
    draw.text(
        (gutter, 20),
        "IWantCheckmate portrait proof",
        fill="#f4f1ea",
        font=title_font,
    )
    draw.text(
        (width - 360, 28),
        "dark background | light background",
        fill="#aaa69d",
        font=load_font(14),
    )

    for index, path in enumerate(paths):
        row, column = divmod(index, columns)
        x = gutter + (column * (cell_size + gutter))
        y = title_height + gutter + (row * (cell_size + label_height + gutter))
        cell = render_cell(path, cell_size, label_height, label_font)
        sheet.paste(cell, (x, y))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)
    print(f"Rendered {len(paths)} portraits to {args.output}")


if __name__ == "__main__":
    main()
