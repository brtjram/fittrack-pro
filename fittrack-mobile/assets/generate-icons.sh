#!/bin/bash
# Generate app icon and splash screen PNGs from SVGs
# Requires: npx sharp-cli or ImageMagick (convert)
#
# Usage: cd fittrack-mobile/assets && bash generate-icons.sh
#
# If you have ImageMagick installed:
#   convert -background none -resize 1024x1024 ../../public/logo.svg icon.png
#   convert -background "#6366f1" -resize 1284x2778 -gravity center splash.png
#
# Or use any SVG-to-PNG tool to create:
#   icon.png      - 1024x1024 (App Store icon, no transparency, no alpha)
#   splash.png    - 1284x2778 (iPhone splash, indigo #6366f1 background)
#   adaptive-icon.png - 1024x1024 (Android adaptive icon, optional)
#
# For now, Expo will use the SVG logo from app.json "icon" field
# and fall back gracefully during development.

echo "To generate icons, use one of these methods:"
echo ""
echo "1. Online: Upload public/logo.svg to https://easyappicon.com"
echo "2. Figma: Export the logo at 1024x1024 as PNG"
echo "3. CLI:   npx @nicepkg/svg2png ../../public/logo.svg -o icon.png -w 1024 -h 1024"
echo ""
echo "Required files:"
echo "  icon.png       - 1024x1024 (no alpha channel)"
echo "  splash.png     - 1284x2778 (centered logo on #6366f1 background)"
