#!/usr/bin/env python3
"""Audit IWantCheckmate portrait PNGs for common shipping defects."""

from __future__ import annotations

import argparse
import hashlib
import math
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image


DEFAULT_ASSET_DIRECTORY = (
    Path(__file__).resolve().parents[1] / "public" / "assets" / "iwantcheckmate"
)


@dataclass(frozen=True)
class AuditConfig:
    alpha_threshold: int = 32
    border_alpha_threshold: int = 96
    min_subject_width: float = 0.35
    min_subject_height: float = 0.35
    min_subject_bbox_area: float = 0.16
    green_edge_ratio: float = 0.12
    near_duplicate_hamming: int = 10
    near_duplicate_mae: float = 0.055


@dataclass
class PortraitAudit:
    path: Path
    size: tuple[int, int] = (0, 0)
    has_alpha_channel: bool = False
    has_transparent_pixels: bool = False
    subject_bbox: tuple[int, int, int, int] | None = None
    clipped_edges: tuple[str, ...] = ()
    green_edge_ratio: float = 0.0
    checkerboard_score: float = 0.0
    checkerboard_scale: int | None = None
    exact_digest: str = ""
    perceptual_bits: tuple[bool, ...] = ()
    normalized_rgba: tuple[int, ...] = ()
    duplicate_labels: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.issues


@dataclass(frozen=True)
class AuditReport:
    directory: Path
    expected_size: tuple[int, int] | None
    portraits: tuple[PortraitAudit, ...]

    @property
    def passed(self) -> bool:
        return bool(self.portraits) and all(item.passed for item in self.portraits)


def _has_alpha_channel(image: Image.Image) -> bool:
    return image.mode in {"RGBA", "LA"} or "transparency" in image.info


def _subject_bbox(alpha: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    mask = alpha.point(lambda value: 255 if value >= threshold else 0, mode="1")
    return mask.getbbox()


def _clipped_edges(
    alpha: Image.Image,
    threshold: int,
) -> tuple[str, ...]:
    width, height = alpha.size
    pixels = alpha.load()
    minimum_horizontal = max(3, math.ceil(width * 0.004))
    minimum_vertical = max(3, math.ceil(height * 0.004))

    edge_counts = {
        "top": sum(pixels[x, 0] >= threshold for x in range(width)),
        "right": sum(pixels[width - 1, y] >= threshold for y in range(height)),
        "bottom": sum(pixels[x, height - 1] >= threshold for x in range(width)),
        "left": sum(pixels[0, y] >= threshold for y in range(height)),
    }
    minimums = {
        "top": minimum_horizontal,
        "right": minimum_vertical,
        "bottom": minimum_horizontal,
        "left": minimum_vertical,
    }
    return tuple(
        edge for edge in ("top", "right", "bottom", "left")
        if edge_counts[edge] >= minimums[edge]
    )


def _green_edge_ratio(image: Image.Image) -> float:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    band = max(2, round(min(width, height) * 0.06))
    pixels = rgba.load()
    green = 0
    sampled = 0

    for y in range(height):
        for x in range(width):
            if band <= x < width - band and band <= y < height - band:
                continue
            red, channel_green, blue, alpha = pixels[x, y]
            sampled += 1
            if (
                alpha >= 128
                and channel_green >= 120
                and channel_green - red >= 35
                and channel_green - blue >= 25
                and channel_green >= red * 1.25
                and channel_green >= blue * 1.20
            ):
                green += 1

    return green / sampled if sampled else 0.0


def _neutral_light(pixel: tuple[int, int, int, int]) -> int | None:
    red, green, blue, alpha = pixel
    if alpha < 224 or max(red, green, blue) - min(red, green, blue) > 18:
        return None
    luminance = round((red * 0.2126) + (green * 0.7152) + (blue * 0.0722))
    return luminance if luminance >= 180 else None


def _checkerboard_signature(image: Image.Image) -> tuple[float, int | None]:
    """Return a periodic checkerboard confidence and its downsampled cell size."""

    sample = image.convert("RGBA")
    sample.thumbnail((192, 192), Image.Resampling.LANCZOS)
    width, height = sample.size
    pixels = sample.load()
    neutral_count = sum(
        _neutral_light(pixels[x, y]) is not None
        for y in range(height)
        for x in range(width)
    )
    if neutral_count < width * height * 0.22:
        return 0.0, None

    best_score = 0.0
    best_scale: int | None = None
    maximum_scale = max(3, min(32, min(width, height) // 3))

    for scale in range(2, maximum_scale + 1):
        offset_step = max(1, scale // 3)
        for offset_y in range(0, scale, offset_step):
            for offset_x in range(0, scale, offset_step):
                matches = 0
                valid = 0
                deltas: list[float] = []
                start_x = offset_x + scale // 2
                start_y = offset_y + scale // 2

                for y in range(start_y, height - scale, scale):
                    for x in range(start_x, width - scale, scale):
                        values = (
                            _neutral_light(pixels[x, y]),
                            _neutral_light(pixels[x + scale, y]),
                            _neutral_light(pixels[x, y + scale]),
                            _neutral_light(pixels[x + scale, y + scale]),
                        )
                        if any(value is None for value in values):
                            continue
                        first, second, third, fourth = values
                        valid += 1
                        diagonal_delta = max(abs(first - fourth), abs(second - third))
                        band_delta = abs(((first + fourth) / 2) - ((second + third) / 2))
                        if diagonal_delta <= 9 and 4 <= band_delta <= 55:
                            matches += 1
                            deltas.append(band_delta)

                if valid < 12 or matches < 10:
                    continue
                score = matches / valid
                if deltas:
                    mean_delta = sum(deltas) / len(deltas)
                    stable = sum(abs(delta - mean_delta) <= 7 for delta in deltas) / len(deltas)
                    score *= stable
                if score > best_score:
                    best_score = score
                    best_scale = scale

    if best_score < 0.72:
        return 0.0, None
    return best_score, best_scale


def _perceptual_signature(
    image: Image.Image,
) -> tuple[tuple[bool, ...], tuple[int, ...]]:
    rgba = image.convert("RGBA").resize((32, 32), Image.Resampling.LANCZOS)
    normalized: list[int] = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        normalized.extend(
            (
                round(red * alpha / 255),
                round(green * alpha / 255),
                round(blue * alpha / 255),
                alpha,
            )
        )

    matte = Image.new("RGBA", image.size, (127, 127, 127, 255))
    matte.alpha_composite(image.convert("RGBA"))
    gray = matte.convert("L").resize((17, 16), Image.Resampling.LANCZOS)
    gray_pixels = list(gray.get_flattened_data())
    bits = tuple(
        gray_pixels[(row * 17) + column]
        > gray_pixels[(row * 17) + column + 1]
        for row in range(16)
        for column in range(16)
    )
    return bits, tuple(normalized)


def _hamming_distance(first: Sequence[bool], second: Sequence[bool]) -> int:
    return sum(left != right for left, right in zip(first, second))


def _normalized_mae(first: Sequence[int], second: Sequence[int]) -> float:
    if len(first) != len(second) or not first:
        return 1.0
    return sum(abs(left - right) for left, right in zip(first, second)) / (
        len(first) * 255
    )


def inspect_portrait(path: Path, config: AuditConfig) -> PortraitAudit:
    result = PortraitAudit(path=path)
    try:
        with Image.open(path) as source:
            source.load()
            result.size = source.size
            result.has_alpha_channel = _has_alpha_channel(source)
            rgba = source.convert("RGBA")
    except (OSError, ValueError) as error:
        result.issues.append(f"cannot decode PNG: {error}")
        return result

    alpha = rgba.getchannel("A")
    alpha_minimum, alpha_maximum = alpha.getextrema()
    result.has_transparent_pixels = alpha_minimum < 255
    result.subject_bbox = _subject_bbox(alpha, config.alpha_threshold)
    result.clipped_edges = _clipped_edges(alpha, config.border_alpha_threshold)
    result.green_edge_ratio = _green_edge_ratio(rgba)
    (
        result.checkerboard_score,
        result.checkerboard_scale,
    ) = _checkerboard_signature(rgba)
    result.exact_digest = hashlib.sha256(
        f"{rgba.width}x{rgba.height}:".encode("ascii") + rgba.tobytes()
    ).hexdigest()
    result.perceptual_bits, result.normalized_rgba = _perceptual_signature(rgba)

    if not result.has_alpha_channel:
        result.issues.append("PNG has no alpha channel")
    elif not result.has_transparent_pixels:
        result.issues.append("alpha channel is fully opaque")

    if alpha_maximum < config.alpha_threshold or result.subject_bbox is None:
        result.issues.append("no visible portrait subject")
        return result

    if result.green_edge_ratio >= config.green_edge_ratio:
        result.issues.append(
            f"baked green background at edges ({result.green_edge_ratio:.1%})"
        )

    if result.checkerboard_score:
        result.issues.append(
            "baked checkerboard background "
            f"(confidence {result.checkerboard_score:.0%})"
        )

    if result.clipped_edges:
        result.issues.append(
            "subject clipped at " + ", ".join(result.clipped_edges) + " edge"
            + ("s" if len(result.clipped_edges) > 1 else "")
        )

    left, top, right, bottom = result.subject_bbox
    subject_width = (right - left) / rgba.width
    subject_height = (bottom - top) / rgba.height
    subject_bbox_area = subject_width * subject_height
    if (
        subject_width < config.min_subject_width
        or subject_height < config.min_subject_height
        or subject_bbox_area < config.min_subject_bbox_area
    ):
        result.issues.append(
            "subject bounds are too small "
            f"({subject_width:.0%} wide x {subject_height:.0%} high)"
        )

    return result


def _mark_duplicates(portraits: Sequence[PortraitAudit], config: AuditConfig) -> None:
    for index, first in enumerate(portraits):
        if not first.exact_digest or not first.perceptual_bits:
            continue
        for second in portraits[index + 1:]:
            if not second.exact_digest or not second.perceptual_bits:
                continue

            if first.exact_digest == second.exact_digest:
                label = "exact duplicate"
            else:
                hamming = _hamming_distance(
                    first.perceptual_bits,
                    second.perceptual_bits,
                )
                mae = _normalized_mae(
                    first.normalized_rgba,
                    second.normalized_rgba,
                )
                if not (
                    mae <= 0.018
                    or (
                        hamming <= config.near_duplicate_hamming
                        and mae <= config.near_duplicate_mae
                    )
                ):
                    continue
                label = f"near duplicate (dHash {hamming}, MAE {mae:.3f})"

            first.duplicate_labels.append(f"{second.path.name}: {label}")
            second.duplicate_labels.append(f"{first.path.name}: {label}")

    for portrait in portraits:
        for label in portrait.duplicate_labels:
            portrait.issues.append(label)


def audit_directory(
    directory: Path,
    config: AuditConfig | None = None,
) -> AuditReport:
    active_config = config or AuditConfig()
    paths = sorted(directory.glob("*.png"), key=lambda path: path.name.casefold())
    portraits = [inspect_portrait(path, active_config) for path in paths]

    valid_sizes = [item.size for item in portraits if item.size != (0, 0)]
    expected_size = None
    if valid_sizes:
        counts = Counter(valid_sizes)
        expected_size = sorted(
            counts,
            key=lambda size: (-counts[size], -(size[0] * size[1]), size),
        )[0]
        for item in portraits:
            if item.size != (0, 0) and item.size != expected_size:
                item.issues.append(
                    f"canvas {item.size[0]}x{item.size[1]} does not match "
                    f"{expected_size[0]}x{expected_size[1]}"
                )

    _mark_duplicates(portraits, active_config)
    return AuditReport(directory, expected_size, tuple(portraits))


def _shorten(value: str, width: int) -> str:
    if len(value) <= width:
        return value
    if width <= 3:
        return value[:width]
    return value[: width - 3] + "..."


def _cell(value: str, width: int) -> str:
    return f"{_shorten(value, width):<{width}}"


def print_report(report: AuditReport) -> None:
    headers = (
        ("FILE", 30),
        ("CANVAS", 11),
        ("ALPHA", 8),
        ("BACKGROUND", 13),
        ("SUBJECT", 15),
        ("DUPLICATE", 25),
        ("RESULT", 6),
    )
    separator = "-+-".join("-" * width for _, width in headers)
    print(f"Portrait directory: {report.directory}")
    if report.expected_size:
        print(
            "Expected canvas: "
            f"{report.expected_size[0]}x{report.expected_size[1]} "
            "(majority size)"
        )
    print()
    print(" | ".join(_cell(label, width) for label, width in headers))
    print(separator)

    for item in report.portraits:
        canvas = f"{item.size[0]}x{item.size[1]}" if item.size != (0, 0) else "decode error"
        if not item.has_alpha_channel:
            alpha = "missing"
        elif not item.has_transparent_pixels:
            alpha = "opaque"
        else:
            alpha = "pass"

        backgrounds: list[str] = []
        if item.green_edge_ratio:
            backgrounds.append(f"green {item.green_edge_ratio:.0%}")
        if item.checkerboard_score:
            backgrounds.append(f"checker {item.checkerboard_score:.0%}")
        background = ", ".join(backgrounds) or "pass"

        if item.subject_bbox is None:
            subject = "missing"
        elif item.clipped_edges:
            subject = "clip " + ",".join(item.clipped_edges)
        else:
            left, top, right, bottom = item.subject_bbox
            subject = (
                f"{(right - left) / item.size[0]:.0%}x"
                f"{(bottom - top) / item.size[1]:.0%}"
            )

        duplicate = "; ".join(item.duplicate_labels) or "pass"
        values = (
            item.path.name,
            canvas,
            alpha,
            background,
            subject,
            duplicate,
            "PASS" if item.passed else "FAIL",
        )
        print(
            " | ".join(
                _cell(value, width)
                for value, (_, width) in zip(values, headers)
            )
        )

    print()
    if not report.portraits:
        print("FAIL: no PNG portraits were found.")
        return

    failed = [item for item in report.portraits if not item.passed]
    if not failed:
        print(f"PASS: all {len(report.portraits)} portraits passed.")
        return

    print(f"FAIL: {len(failed)} of {len(report.portraits)} portraits have defects.")
    for item in failed:
        print(f"  {item.path.name}")
        for issue in item.issues:
            print(f"    - {issue}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Audit public/assets/iwantcheckmate PNG portraits for transparency, "
            "background, sizing, clipping, scale, and duplicate defects."
        )
    )
    parser.add_argument(
        "--directory",
        type=Path,
        default=DEFAULT_ASSET_DIRECTORY,
        help=f"portrait directory (default: {DEFAULT_ASSET_DIRECTORY})",
    )
    parser.add_argument("--min-subject-width", type=float, default=0.35)
    parser.add_argument("--min-subject-height", type=float, default=0.35)
    parser.add_argument("--min-subject-bbox-area", type=float, default=0.16)
    parser.add_argument("--green-edge-ratio", type=float, default=0.12)
    parser.add_argument("--near-duplicate-hamming", type=int, default=10)
    parser.add_argument("--near-duplicate-mae", type=float, default=0.055)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    directory = args.directory.resolve()
    if not directory.is_dir():
        print(f"FAIL: portrait directory does not exist: {directory}", file=sys.stderr)
        return 2

    config = AuditConfig(
        min_subject_width=args.min_subject_width,
        min_subject_height=args.min_subject_height,
        min_subject_bbox_area=args.min_subject_bbox_area,
        green_edge_ratio=args.green_edge_ratio,
        near_duplicate_hamming=args.near_duplicate_hamming,
        near_duplicate_mae=args.near_duplicate_mae,
    )
    report = audit_directory(directory, config)
    print_report(report)
    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
