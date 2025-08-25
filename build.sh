#!/bin/bash
echo "Building Figma Google Sheets Chart Plugin..."

# Clean dist directory
rm -rf dist
mkdir -p dist

# Build TypeScript
npm run build

# Copy UI file
cp ui/ui.html dist/ui.html

echo "Build complete! Plugin files are in the dist/ directory."
echo "To load in Figma:"
echo "1. Open Figma Desktop app"
echo "2. Go to Plugins > Development > Import plugin from manifest"
echo "3. Select the manifest.json file from this directory"
