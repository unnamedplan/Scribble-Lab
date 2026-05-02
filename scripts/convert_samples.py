from pathlib import Path
from textwrap import dedent

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Pillow is required. Install it with: python3 -m pip install --user pillow"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "samples" / "source"
OUTPUT_DIR = ROOT / "public" / "samples" / "generated"
GALLERY_FILE = ROOT / "src" / "lib" / "gallery.ts"
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def convert_to_webp(source: Path, output: Path) -> None:
    with Image.open(source) as image:
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA")
        image.save(output, "WEBP", quality=86, method=6)


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sources = sorted(
        path
        for path in SOURCE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not sources:
        raise SystemExit(
            f"No images found in {SOURCE_DIR}. Add PNG/JPG/WebP files there first."
        )

    generated_paths: list[str] = []
    for index, source in enumerate(sources, start=1):
        output = OUTPUT_DIR / f"sample-{index:02d}.webp"
        convert_to_webp(source, output)
        generated_paths.append(f"/samples/generated/{output.name}")
        print(f"Converted {source.name} -> {output.relative_to(ROOT)}")

    default_image = generated_paths[0]
    samples = "\n".join(
        f'  {{ src: "{path}", afterSrc: "{path}", alt: "Sample {index:02d}" }},'
        for index, path in enumerate(generated_paths, start=1)
    )

    gallery_content = dedent(
        f"""\
        export const DEFAULT_BEFORE_IMAGE = "{default_image}";
        export const DEFAULT_AFTER_IMAGE = "{default_image}";

        export const SAMPLE_IMAGES = [
        {samples}
        ];
        """
    )
    GALLERY_FILE.write_text(gallery_content, encoding="utf-8")
    print(f"Updated {GALLERY_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
