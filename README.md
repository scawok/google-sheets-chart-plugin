# Google Sheets Chart Plugin for Figma

A powerful Figma plugin that allows you to import and automatically update Google Sheets charts directly into your Figma designs.

## ✨ Features

- **Easy Import**: Insert Google Sheets charts with a simple URL
- **Auto Updates**: Update individual charts or all charts across all pages
- **Smart Linking**: Charts are automatically linked to their Google Sheets source
- **Cross-Page Updates**: Update charts across your entire Figma file
- **Chart History**: Keep track of all your imported charts
- **CORS Handling**: Built-in proxy support for seamless Google Sheets integration

## 🚀 Installation

### For Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/scawok/google-sheets-chart-plugin.git
   cd google-sheets-chart-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   # or
   ./build.sh
   ```

4. **Load in Figma:**
   - Open Figma
   - Go to **Plugins** > **Development** > **Import plugin from manifest**
   - Select the `manifest.json` file from this project

## 📖 How to Use

### Getting a Google Sheets Chart URL

1. Open your Google Sheets document
2. Select the chart you want to import
3. Click the three dots menu (⋯) on the chart
4. Select **"Publish chart"**
5. Choose **"Image"** format and click **"Publish"**
6. Copy the URL (it should contain `/pubchart`)

### Inserting a Chart

1. Open the plugin in Figma
2. Paste your Google Sheets chart URL
3. (Optional) Give your chart a name
4. Click **"Insert Chart"**

### Updating Charts

- **Update Selected**: Select a chart in Figma, then click this button
- **Update All**: Updates all charts in your current Figma file at once

## 🛠️ Development

### Project Structure

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

### Building

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Or use the build script
./build.sh
```

### Key Technologies

- **TypeScript** for type-safe development
- **Figma Plugin API** for integration
- **HTML/CSS/JavaScript** for the UI
- **Proxy Service** (images.weserv.nl) for CORS handling

## 🔧 Configuration

The plugin uses several configuration files:

- `manifest.json`: Plugin metadata and permissions
- `tsconfig.json`: TypeScript compilation settings
- `package.json`: Dependencies and scripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: The plugin automatically handles CORS issues using a proxy service
2. **Chart Not Found**: Make sure your Google Sheets chart is published publicly
3. **Update Fails**: Ensure the chart URL contains `/pubchart` and is accessible

### Getting Help

- Check the **Help** tab in the plugin for detailed instructions
- Review the error messages in the plugin interface
- Open an issue on GitHub for bugs or feature requests

## 📊 Features in Detail

### Chart Management
- Unique chart IDs for reliable updates
- Automatic timestamp tracking
- Chart history with easy access to previous charts

### Update System
- Individual chart updates
- Batch updates across all pages
- Error handling and progress tracking
- Automatic fallback mechanisms

### UI/UX
- Modern, dark-themed interface
- Tabbed navigation for different functions
- Real-time error feedback
- Responsive design

---

**Made with ❤️ for the Figma community**
