#!/usr/bin/env python3
"""Build web logo assets from the generated logo with its white matte removed."""
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
original = Image.open(ROOT / 'output/imagegen/open-pose-costume-logo-original.png').convert('RGB')
pixels = np.asarray(original).astype(float)
# Remove the near-white matte while preserving opaque blue interiors.
distance = 255 - pixels.min(axis=2)
alpha = np.clip((distance - 15) / 30, 0, 1)
rgba = np.dstack((pixels, np.round(alpha * 255))).astype('uint8')
source = Image.fromarray(rgba)
source.save(ROOT / 'output/imagegen/logo-transparent-full.png')
box = source.getchannel('A').point(lambda value: 255 if value > 32 else 0).getbbox()
if not box:
    raise ValueError('The generated logo has no visible mark')
mark = source.crop(box)
side = max(mark.size)
padding = round(side * 0.09)
square = Image.new('RGBA', (side + padding * 2, side + padding * 2))
square.alpha_composite(mark, ((square.width - mark.width) // 2, (square.height - mark.height) // 2))
brand = ROOT / 'public/brand'
brand.mkdir(parents=True, exist_ok=True)
square.resize((512, 512), Image.Resampling.LANCZOS).save(brand / 'logo-mark.png', optimize=True)
square.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / 'public/favicon.png', optimize=True)
square.save(ROOT / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
touch = Image.new('RGBA', (180, 180), 'white')
touch.alpha_composite(square.resize((160, 160), Image.Resampling.LANCZOS), (10, 10))
touch.convert('RGB').save(ROOT / 'public/apple-touch-icon.png', optimize=True)
preview = Image.new('RGBA', (512, 512), '#f4f6f8')
preview.alpha_composite(square.resize((400, 400), Image.Resampling.LANCZOS), (56, 56))
preview.convert('RGB').save(ROOT / 'output/imagegen/logo-preview.png')
print('Built: logo-mark.png, favicon.png, favicon.ico, apple-touch-icon.png')
