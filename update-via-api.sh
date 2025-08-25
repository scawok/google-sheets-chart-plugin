#!/bin/bash

# Update Figma Enterprise Plugin via API
echo "🚀 Updating Figma Enterprise Plugin via API..."

# Configuration
PLUGIN_ID="1541032430174166025"
ACCESS_TOKEN="YOUR_ACCESS_TOKEN_HERE"  # Replace with your actual token
ZIP_FILE="google-sheets-chart-plugin-enterprise-v1.1.0.zip"

# Check if zip file exists
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Error: $ZIP_FILE not found!"
    echo "Run './build-enterprise.sh' first to create the package."
    exit 1
fi

# Check if access token is set
if [ "$ACCESS_TOKEN" = "YOUR_ACCESS_TOKEN_HERE" ]; then
    echo "❌ Error: Please set your Figma access token in this script"
    echo "1. Get your access token from Figma settings"
    echo "2. Replace 'YOUR_ACCESS_TOKEN_HERE' in this script"
    exit 1
fi

echo "📤 Uploading plugin update..."
echo "Plugin ID: $PLUGIN_ID"
echo "File: $ZIP_FILE"

# Upload the plugin
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@$ZIP_FILE" \
  "https://api.figma.com/v1/plugins/$PLUGIN_ID/versions" \
  -w "\nHTTP Status: %{http_code}\n" \
  -o response.json

echo "✅ Upload complete! Check response.json for details."

# Display response
if [ -f "response.json" ]; then
    echo "📋 Response:"
    cat response.json
fi
