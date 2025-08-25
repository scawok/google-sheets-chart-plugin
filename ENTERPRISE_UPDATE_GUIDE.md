# Enterprise Plugin Update Guide

## 🏢 Updating Your Enterprise Plugin

This guide explains how to update your Google Sheets Chart Plugin after making local changes.

## 📋 Prerequisites

- **Figma Enterprise Account**: You need admin access to your Figma Enterprise organization
- **Plugin Management Access**: Ability to manage plugins in your enterprise settings
- **Local Development Setup**: Your plugin code with the latest changes

## 🔄 Update Process

### Step 1: Prepare Your Local Changes

1. **Make your code changes** in the local plugin directory
2. **Test locally** using Figma's development mode
3. **Build the plugin**:
   ```bash
   npm run build
   ```

### Step 2: Update Version Number

1. **Edit `manifest.json`** and increment the version:
   ```json
   {
     "version": "1.1.0"  // Increment this number
   }
   ```

2. **Update version in `package.json`** (if applicable):
   ```json
   {
     "version": "1.1.0"
   }
   ```

### Step 3: Create Enterprise Package

Run the enterprise build script:
```bash
./build-enterprise.sh
```

This creates:
- `google-sheets-chart-plugin-enterprise-v1.1.0.zip` - Ready for upload
- `enterprise-dist/` - Directory with all necessary files

### Step 4: Upload to Figma Enterprise

#### Option A: Figma Enterprise Plugin Management (Recommended)

1. **Log into Figma Enterprise**
2. **Go to Admin Settings** → **Plugins**
3. **Find your plugin** in the list
4. **Click "Update"** or "Upload new version"
5. **Upload the zip file**: `google-sheets-chart-plugin-enterprise-v1.1.0.zip`
6. **Review the changes** and confirm the update
7. **Deploy to your organization**

#### Option B: Figma Plugin API (Advanced)

If you have API access:
```bash
# Upload using Figma's API
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@google-sheets-chart-plugin-enterprise-v1.1.0.zip" \
  https://api.figma.com/v1/plugins/YOUR_PLUGIN_ID/versions
```

### Step 5: Deploy to Organization

1. **Select deployment scope**:
   - **All users**: Everyone in your organization
   - **Specific teams**: Choose which teams get the update
   - **Staged rollout**: Deploy to a subset first

2. **Set update timing**:
   - **Immediate**: Update takes effect right away
   - **Scheduled**: Set a specific time for the update

3. **Monitor deployment**:
   - Check deployment status in admin panel
   - Monitor for any issues or rollbacks needed

## 📦 What's Included in the Package

The enterprise package contains:
- `manifest.json` - Plugin configuration and metadata
- `code.js` - Compiled plugin logic (TypeScript → JavaScript)
- `ui.html` - Plugin user interface
- `README.md` - Documentation

## 🔍 Version Management

### Version Numbering Convention
- **Major.Minor.Patch** (e.g., 1.1.0)
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Version History
- **v1.0.0**: Initial release
- **v1.1.0**: Added cache-busting, improved error handling, URL testing

## 🚨 Important Notes

### Breaking Changes
- **Major version updates** may require user re-authentication
- **API changes** might affect existing chart data
- **Always test** in a development environment first

### Rollback Strategy
- **Keep previous versions** available for quick rollback
- **Monitor user feedback** after deployment
- **Have a rollback plan** ready for critical issues

### User Communication
- **Notify users** of upcoming updates
- **Document new features** and changes
- **Provide migration guides** if needed

## 🛠️ Troubleshooting

### Common Issues

1. **Upload Fails**:
   - Check file size limits
   - Verify manifest.json format
   - Ensure all required files are included

2. **Deployment Issues**:
   - Check enterprise permissions
   - Verify plugin ID matches
   - Review error logs in admin panel

3. **User Access Problems**:
   - Check team permissions
   - Verify plugin visibility settings
   - Review user group assignments

### Support Resources

- **Figma Enterprise Support**: Contact your Figma admin
- **Plugin Documentation**: Check the README.md
- **GitHub Repository**: https://github.com/scawok/google-sheets-chart-plugin

## 📈 Best Practices

1. **Test Thoroughly**: Always test in development before enterprise deployment
2. **Version Control**: Use Git to track changes and maintain history
3. **Documentation**: Keep documentation updated with each release
4. **User Feedback**: Collect and incorporate user feedback
5. **Regular Updates**: Maintain a regular update schedule
6. **Security**: Review code for security implications before deployment

## 🔗 Quick Commands

```bash
# Build for development
npm run build

# Build for enterprise
./build-enterprise.sh

# Check current version
grep '"version"' manifest.json

# View build output
ls -la enterprise-dist/
```

---

**Last Updated**: $(date)
**Current Version**: 1.1.0
**Next Version**: 1.1.1 (for patches) or 1.2.0 (for features)
