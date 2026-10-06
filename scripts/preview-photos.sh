#!/bin/sh
# Phase 1.5 design preview only (macOS: uses sips).
# Copies docs/photos/ into public/preview/ (gitignored), resized to max 2400px.
# Converts everything to JPEG so HEIC files (restaurant.jpg) work in browsers.
# Production images come from Cloudinary; nothing here ships.
set -eu
src="docs/photos"
out="public/preview"
mkdir -p "$out"
for f in "$src"/*.png "$src"/*.jpg; do
  name=$(basename "$f")
  base="${name%.*}"
  case "$name" in
    brochure-front-page-vertical.png) continue ;; # brochure reference, not a website photo
    location-QR-code.png|Bagaicha-MAP.png) sips -Z 1600 "$f" --out "$out/$name" >/dev/null ;;
    *) sips -s format jpeg -s formatOptions 85 -Z 2400 "$f" --out "$out/$base.jpg" >/dev/null ;;
  esac
done
echo "Preview photos written to $out/"
