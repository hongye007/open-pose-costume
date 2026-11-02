#!/usr/bin/env python3
"""Import reviewed AI depth references without changing source pose files.

Usage: python3 scripts/import-pose-depth.py /path/to/batch-output
The batch must contain generated/<variant-id>.png and matching provenance JSON.
Only complete five-view groups are imported. Running again is deterministic.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batch", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    manifest = root / "data/custom/pose.json"
    items = json.loads(manifest.read_text())
    imported = []
    pending = []
    for item in items:
        variants = item["variants"]
        if not all((args.batch / "generated" / f"{v['id']}.png").exists() for v in variants):
            pending.append(item["id"])
            continue
        for variant in variants:
            key = variant["id"]
            raw = args.batch / "generated" / f"{key}.png"
            metadata = json.loads(raw.with_suffix(".provenance.json").read_text())
            if metadata["provider"] != "Atomflow" or metadata["model"] != "gpt-image-2":
                raise ValueError(f"Unexpected generation provenance: {key}")
            if digest(raw) != metadata["sha256"]:
                raise ValueError(f"Generated image hash mismatch: {key}")
            source = root / "public" / variant["original"]
            with Image.open(source) as image:
                size = image.size
            with Image.open(raw) as image:
                # Normalize only dimensions and monochrome encoding; never crop the pose.
                if abs(image.width / image.height - size[0] / size[1]) > 0.02:
                    raise ValueError(f"Unexpected generated aspect ratio: {key}")
                depth = ImageOps.grayscale(image).resize(size, Image.Resampling.LANCZOS)
            paths = {
                "original": f"custom/pose/originals/{key}_depth.png",
                "image": f"custom/pose/images/{key}_depth.webp",
                "thumbnail": f"custom/pose/thumbnails/{key}_depth.webp",
            }
            depth.save(root / "public" / paths["original"], optimize=True)
            preview = depth.copy()
            preview.thumbnail((1024, 1536), Image.Resampling.LANCZOS)
            preview.save(root / "public" / paths["image"], quality=90, method=6)
            thumbnail = depth.copy()
            thumbnail.thumbnail((256, 384), Image.Resampling.LANCZOS)
            thumbnail.save(root / "public" / paths["thumbnail"], quality=83, method=6)
            variant["depth"] = {
                **paths,
                "provenance": {
                    "batch": "male-pose-depth-13x5-01",
                    "provider": "Atomflow",
                    "model": "gpt-image-2",
                    "aiInferred": True,
                    "calibrated": False,
                    "sourceSha256": digest(source),
                    "generatedSha256": metadata["sha256"],
                    "originalSha256": digest(root / "public" / paths["original"]),
                    "promptSha256": metadata["prompt_sha256"],
                    "width": size[0],
                    "height": size[1],
                },
            }
            imported.append(key)
    manifest.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"importedViews": len(imported), "pendingGroups": pending}, indent=2))


if __name__ == "__main__":
    main()
