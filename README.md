# Google Sheets Chart Importer - Figma Plugin

A Figma plugin that allows you to import Google Sheets charts as images and update them manually when needed.

## Features

- Import Google Sheets charts as images into Figma
- Manual update functionality (no automatic updates)
- Store chart history for easy re-importing
- Clean, modern UI
- Support for custom chart names

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the plugin:**
   ```bash
   npm run build
   ```

3. **Load in Figma:**
   - Open Figma Desktop app
   - Go to Plugins > Development > Import plugin from manifest
   - Select the `manifest.json` file from this directory

## How to Use

### Preparing Your Google Sheets Chart

1. Open your Google Sheets document
2. Select the chart you want to import
3. Right-click on the chart and select "Copy chart"
4. Or publish the chart to the web:
   - File > Share > Publish to web
   - Select the chart and publish
   - Copy the published URL

### Using the Plugin

1. **Insert a new chart:**
   - Open the plugin in Figma
   - Paste the Google Sheets chart URL
   - Optionally add a name for the chart
   - Click "Insert Chart"

2. **Update an existing chart:**
   - Select the chart frame in Figma
   - Open the plugin
   - Paste the same URL
   - Click "Update Selected"

3. **Manage chart history:**
   - View all previously imported charts in the "Recent Charts" section
   - Click "Update" to refresh a specific chart
   - Click "Remove" to delete from history

## Development

- **Watch mode:** `npm run watch` - Automatically rebuilds on file changes
- **Development mode:** `npm run dev` - Builds and starts the plugin in Figma

## File Structure

```
├── manifest.json          # Plugin configuration
├── src/
│   └── code.ts           # Main plugin logic
├── ui/
│   └── ui.html           # Plugin UI
├── dist/                 # Compiled files (generated)
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Notes

- The plugin requires network access to Google Sheets domains
- Charts are imported as images and won't update automatically
- Manual updates preserve the original chart positioning and sizing
- Chart history is stored locally in the plugin

## Troubleshooting

**Chart not loading:**
- Ensure the Google Sheets chart is published to the web
- Check that the URL is correct and accessible
- Verify the chart is not private or restricted

**Update not working:**
- Make sure you've selected the correct chart frame in Figma
- Ensure you're using the same URL as the original chart

## License

MIT License
