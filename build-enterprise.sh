#!/bin/bash

# Build the plugin for enterprise distribution
echo "🏗️  Building Google Sheets Chart Plugin for Enterprise..."

# Build the TypeScript code
echo "📦 Compiling TypeScript..."
npm run build

# Create distribution directory
echo "📁 Creating distribution package..."
mkdir -p enterprise-dist

# Copy necessary files
cp manifest.json enterprise-dist/
cp dist/code.js enterprise-dist/
cp dist/ui.html enterprise-dist/
cp README.md enterprise-dist/

# Create a zip file for easy distribution
echo "🗜️  Creating zip package..."
cd enterprise-dist
zip -r ../google-sheets-chart-plugin-enterprise-v1.1.0.zip .
cd ..

echo "✅ Enterprise package created: google-sheets-chart-plugin-enterprise-v1.1.0.zip"
echo "📋 Files included:"
echo "   - manifest.json (v1.1.0)"
echo "   - dist/code.js (compiled plugin code)"
echo "   - dist/ui.html (plugin UI)"
echo "   - README.md (documentation)"
echo ""
echo "🚀 Next steps:"
echo "   1. Upload the zip file to your Figma Enterprise plugin management"
echo "   2. Update the plugin version in your enterprise settings"
echo "   3. Deploy to your organization"
