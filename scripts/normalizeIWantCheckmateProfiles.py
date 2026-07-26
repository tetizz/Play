from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


DEFAULT_SUBJECT_FRACTION = 0.82


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Center IWantCheckmate profile art on consistent square canvases."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument(
        "--subject-fraction", type=float, default=DEFAULT_SUBJECT_FRACTION
    )
    parser.add_argument(
        "--chroma-green",
        action="store_true",
        help="Remove a flat green-screen background before centering.",
    )
    parser.add_argument(
        "--light-checkerboard",
        action="store_true",
        help="Remove a baked white/light-gray transparency checkerboard.",
    )
    return parser.parse_args()


def remove_chroma_green(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32).copy()
    rgb = rgba[:, :, :3]
    green = rgb[:, :, 1]
    other = np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    dominance = green - other

    # Green-screen sources vary slightly across the canvas, so key by color
    # distance instead of relying on an exact flood-filled background value.
    color_key = np.clip((dominance - 12.0) / 42.0, 0.0, 1.0)
    brightness_key = np.clip((green - 62.0) / 96.0, 0.0, 1.0)
    key_strength = color_key * brightness_key
    rgba[:, :, 3] *= 1.0 - key_strength

    spill_strength = (
        np.clip((dominance - 1.0) / 24.0, 0.0, 1.0)
        * np.clip((green - 38.0) / 80.0, 0.0, 1.0)
    )
    spill = spill_strength > 0.0
    neutral_green = other * 1.02
    rgb[:, :, 1][spill] = neutral_green[spill]
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def remove_light_checkerboard(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32).copy()
    rgb = rgba[:, :, :3]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    chroma = maximum - minimum
    brightness = rgb.mean(axis=2)

    background_candidate = (brightness > 205.0) & (chroma < 24.0)
    flood_mask = Image.fromarray(
        background_candidate.astype(np.uint8) * 255,
        "L",
    )
    for seed in (
        (0, 0),
        (flood_mask.width - 1, 0),
        (0, flood_mask.height - 1),
        (flood_mask.width - 1, flood_mask.height - 1),
    ):
        if flood_mask.getpixel(seed) == 255:
            ImageDraw.floodfill(flood_mask, seed, 128, thresh=0)
    connected_background = np.asarray(flood_mask) == 128

    color_opacity = np.clip((chroma - 2.0) / 34.0, 0.0, 1.0)
    dark_opacity = np.clip((228.0 - brightness) / 62.0, 0.0, 1.0)
    foreground_opacity = np.maximum(color_opacity, dark_opacity)
    foreground_opacity[connected_background] = 0.0
    rgba[:, :, 3] = foreground_opacity * 255.0
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def normalized_portrait(
    image: Image.Image, size: int, subject_fraction: float
) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise ValueError("Portrait has no visible pixels")

    subject = rgba.crop(bbox)
    target = max(1, round(size * subject_fraction))
    scale = min(target / subject.width, target / subject.height)
    dimensions = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(dimensions, Image.Resampling.LANCZOS)
    if scale > 1:
        subject = subject.filter(ImageFilter.UnsharpMask(radius=1.1, percent=82, threshold=3))

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    position = ((size - subject.width) // 2, (size - subject.height) // 2)
    canvas.alpha_composite(subject, position)
    return canvas


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    sources = (
        sorted(args.input.glob("*.png"))
        if args.input.is_dir()
        else [args.input]
    )
    if not sources:
        raise SystemExit(f"No PNG files found in {args.input}")

    for source in sources:
        image = Image.open(source)
        if args.chroma_green:
            image = remove_chroma_green(image)
        if args.light_checkerboard:
            image = remove_light_checkerboard(image)
        portrait = normalized_portrait(image, args.size, args.subject_fraction)
        destination = args.output / source.name
        portrait.save(destination, optimize=True)
        print(f"{source.name}: {image.size} -> {portrait.size}")


if __name__ == "__main__":
    main()
