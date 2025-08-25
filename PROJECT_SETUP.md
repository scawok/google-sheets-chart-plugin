# Google Sheets Chart Plugin - Project Setup Guide

## Project Location
```
/Users/niclaskovacs/figma-plugins/google-sheets-chart-plugin/
```

## How to Reopen This Project

### Option 1: Direct Access
Simply navigate to the project folder and open it in your preferred code editor:
```bash
cd /Users/niclaskovacs/figma-plugins/google-sheets-chart-plugin/
code .  # For VS Code
# or
open .  # For Finder
```

### Option 2: From Archive
If you have the compressed archive:
```bash
cd /Users/niclaskovacs/figma-plugins/
tar -xzf google-sheets-chart-plugin-project.tar.gz
cd google-sheets-chart-plugin/
```

### Option 3: From Git Repository
If you've pushed to a remote repository:
```bash
git clone https://github.com/scawok/google-sheets-chart-plugin.git
cd google-sheets-chart-plugin/
npm install
```

### Option 4: From GitHub (Recommended)
Your project is now available on GitHub:
- **Repository URL**: https://github.com/scawok/google-sheets-chart-plugin
- **Clone Command**: `git clone https://github.com/scawok/google-sheets-chart-plugin.git`

## Development Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build the Plugin:**
   ```bash
   npm run build
   # or
   ./build.sh
   ```

3. **Load in Figma:**
   - Open Figma
   - Go to Plugins > Development > Import plugin from manifest
   - Select the `manifest.json` file from this project

## Project Structure
```
google-sheets-chart-plugin/
├── src/
│   └── code.ts          # Main plugin logic
├── ui/
│   └── ui.html          # Plugin UI
├── manifest.json        # Plugin configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── build.sh            # Build script
└── README.md           # Documentation
```

## Key Features
- Insert Google Sheets charts into Figma
- Update charts automatically
- Update all charts across all pages
- Chart history management
- CORS handling for Google Sheets

## Notes
- The plugin uses a proxy service (images.weserv.nl) to handle CORS issues
- Charts are stored with unique IDs for reliable updates
- Supports both individual and batch chart updates
