from __future__ import annotations

import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from scripts.auditIWantCheckmateProfiles import (
    AuditConfig,
    audit_directory,
    main,
)


CANVAS = (128, 128)


def save_subject(
    path: Path,
    *,
    size: tuple[int, int] = CANVAS,
    bounds: tuple[int, int, int, int] = (28, 24, 100, 108),
    color: tuple[int, int, int, int] = (214, 164, 62, 255),
) -> None:
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(image).ellipse(bounds, fill=color)
    image.save(path)


class PortraitAuditTests(unittest.TestCase):
    def test_valid_transparent_portrait_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            save_subject(directory / "valid.png")

            report = audit_directory(directory)

            self.assertTrue(report.passed)
            self.assertEqual(report.expected_size, CANVAS)
            self.assertEqual(report.portraits[0].issues, [])

    def test_detects_opaque_green_and_checkerboard_backgrounds(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)

            green = Image.new("RGBA", CANVAS, (0, 245, 20, 255))
            ImageDraw.Draw(green).ellipse((28, 24, 100, 108), fill=(220, 170, 70, 255))
            green.save(directory / "green.png")

            checker = Image.new("RGBA", CANVAS, (246, 246, 246, 255))
            draw = ImageDraw.Draw(checker)
            cell = 16
            for y in range(0, CANVAS[1], cell):
                for x in range(0, CANVAS[0], cell):
                    shade = 232 if ((x // cell) + (y // cell)) % 2 else 248
                    draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(shade,) * 3 + (255,))
            draw.ellipse((36, 30, 92, 104), fill=(215, 165, 60, 255))
            checker.save(directory / "checker.png")

            report = audit_directory(directory)
            issues = {
                portrait.path.name: portrait.issues
                for portrait in report.portraits
            }

            self.assertTrue(
                any("baked green background" in issue for issue in issues["green.png"])
            )
            self.assertTrue(
                any(
                    "baked checkerboard background" in issue
                    for issue in issues["checker.png"]
                )
            )
            self.assertTrue(
                all(
                    any("fully opaque" in issue for issue in portrait_issues)
                    for portrait_issues in issues.values()
                )
            )

    def test_detects_clipping_tiny_subject_and_canvas_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            save_subject(directory / "reference.png")
            save_subject(
                directory / "clipped.png",
                bounds=(-18, 22, 80, 108),
            )
            save_subject(
                directory / "tiny.png",
                bounds=(54, 54, 74, 74),
            )
            save_subject(
                directory / "wrong-size.png",
                size=(96, 96),
                bounds=(20, 18, 76, 82),
            )

            report = audit_directory(directory)
            issues = {
                portrait.path.name: portrait.issues
                for portrait in report.portraits
            }

            self.assertTrue(
                any("subject clipped at left edge" in issue for issue in issues["clipped.png"])
            )
            self.assertTrue(
                any("subject bounds are too small" in issue for issue in issues["tiny.png"])
            )
            self.assertTrue(
                any("does not match 128x128" in issue for issue in issues["wrong-size.png"])
            )

    def test_detects_exact_and_near_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            save_subject(directory / "first.png")
            save_subject(directory / "exact.png")
            save_subject(directory / "near.png")
            with Image.open(directory / "near.png") as source:
                near = source.convert("RGBA")
            near.putpixel((64, 64), (205, 155, 55, 255))
            near.save(directory / "near.png")

            report = audit_directory(directory)
            issues = {
                portrait.path.name: portrait.issues
                for portrait in report.portraits
            }

            self.assertTrue(
                any("exact duplicate" in issue for issue in issues["first.png"])
            )
            self.assertTrue(
                any("near duplicate" in issue for issue in issues["near.png"])
            )

    def test_cli_returns_nonzero_and_prints_failure_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            Image.new("RGB", CANVAS, (255, 255, 255)).save(directory / "opaque.png")
            output = io.StringIO()

            with contextlib.redirect_stdout(output):
                exit_code = main(["--directory", str(directory)])

            self.assertEqual(exit_code, 1)
            self.assertIn("RESULT", output.getvalue())
            self.assertIn("FAIL", output.getvalue())
            self.assertIn("alpha channel", output.getvalue())


if __name__ == "__main__":
    unittest.main()
