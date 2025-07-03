# Publishing to VSCode Marketplace

This guide covers publishing the extension to the Visual Studio Code Marketplace.

## Automated Publishing (Recommended)

The extension is automatically published to the marketplace when you push a release tag (e.g., `v1.0.3`) to the public repository. This is handled by the `.github/workflows/publish.yml` workflow.

### Setup for Automated Publishing
1. Add your PAT as a GitHub secret named `VSCE_PAT`:
   - Go to Settings → Secrets and variables → Actions
   - Add secret: Name = `VSCE_PAT`, Value = your marketplace PAT

2. Push a release tag to trigger publishing:
   ```bash
   git push public v1.0.3
   ```

The workflow will automatically:
- Build and test the extension
- Package it into a .vsix file
- Publish to VSCode Marketplace
- Create a GitHub release with the .vsix attached

## Manual Publishing

Follow the steps below if you need to publish manually or if the automated workflow fails.

## Prerequisites

### 1. Create a Publisher Account
1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Create a publisher ID (e.g., `zw3rk`)
4. Note: The publisher ID in package.json must match this

### 2. Generate Personal Access Token (PAT)
1. Go to https://dev.azure.com/your-organization/_usersSettings/tokens
2. Click "New Token"
3. Set the following:
   - Name: `vsce-publish` (or any descriptive name)
   - Organization: Select "All accessible organizations"
   - Expiration: Set as needed (recommend 1 year)
   - Scopes: Click "Show all scopes" and select:
     - **Marketplace**: ✅ Acquire ✅ Publish ✅ Manage
4. Click "Create" and **copy the token immediately** (you won't see it again)

### 3. Store the Token Securely
```bash
# Option 1: Set as environment variable (add to your .bashrc/.zshrc)
export VSCE_PAT="your-token-here"

# Option 2: Use vsce login (stores in system keychain)
npx vsce login zw3rk
# Enter your PAT when prompted
```

## Publishing Process

### 1. Ensure You Have a Clean Release
```bash
# You should have already:
# - Created a release on master branch
# - Tagged it (e.g., v1.0.3)
# - Pushed to public GitHub repository
# - CI is passing

# Switch to master branch with the release
git checkout master
git pull public master
```

### 2. Verify Package Details
```bash
# Check package.json has correct:
# - version (e.g., "1.0.3")
# - publisher (e.g., "zw3rk")
# - repository URL
# - icon path

# Preview what will be included
npx vsce ls
```

### 3. Package the Extension
```bash
# This creates a .vsix file
npm run package

# Or directly:
npx vsce package --no-dependencies

# This creates: source-map-visualizer-1.0.3.vsix
```

### 4. Test the Package Locally (Optional)
```bash
# Install in VS Code to test
code --install-extension source-map-visualizer-1.0.3.vsix

# Test the extension functionality
# Uninstall test version when done
code --uninstall-extension zw3rk.source-map-visualizer
```

### 5. Publish to Marketplace
```bash
# Publish using the PAT
npx vsce publish -p $VSCE_PAT

# Or if you used vsce login:
npx vsce publish

# Or publish a specific .vsix file:
npx vsce publish -p $VSCE_PAT -i source-map-visualizer-1.0.3.vsix
```

### 6. Verify Publication
1. Go to https://marketplace.visualstudio.com/items?itemName=zw3rk.source-map-visualizer
2. Check that the new version is shown
3. Note: It may take 5-10 minutes to appear

## Complete Release Workflow

Here's how marketplace publishing fits into the full release:

```bash
# 1. Create GitHub release (already done)
git checkout master
git tag -a "v1.0.3" -m "Source Map Visualizer v1.0.3"
git push public master
git push public v1.0.3

# 2. Package the extension
npm run package

# 3. Publish to marketplace
npx vsce publish -p $VSCE_PAT

# 4. Create GitHub release with .vsix artifact
nix run nixpkgs#gh -- release create v1.0.3 \
  --repo zw3rk/sourcemap-tools \
  --title "Source Map Visualizer v1.0.3" \
  --notes "See CHANGELOG.md for details" \
  source-map-visualizer-1.0.3.vsix
```

## Important Notes

### Version Management
- The version in package.json is the source of truth
- Don't use `vsce publish minor` or `vsce publish patch` - we manage versions manually
- Always publish from a tagged release on master

### What Gets Published
- Everything not in .vscodeignore
- The .vscodeignore file excludes:
  - Source files (only compiled output is needed)
  - Development files
  - Tests
  - Git/GitHub files

### Security
- **Never commit your PAT to git**
- Rotate your PAT periodically
- Use environment variables or vsce login
- Keep your publisher account secure with 2FA

### Troubleshooting

**Error: "Invalid publisher name"**
- Ensure package.json publisher matches your marketplace account

**Error: "Cannot find ffmpeg"**
- Icon/image processing issue
- Ensure your icon.png is a valid PNG file

**Error: "Missing repository field"**
- Add repository field to package.json

**Error: "PersonalAccessTokenInvalid"**
- Token expired or incorrect
- Regenerate token with correct permissions

## Pre-publish Checklist

- [ ] On master branch with latest release
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] CI passing on public repository
- [ ] README.md is up to date
- [ ] Icon.png exists (128x128 or 256x256)
- [ ] .vscodeignore excludes unnecessary files
- [ ] PAT is valid and has correct permissions
- [ ] Test package locally (optional)

## Post-publish Steps

1. **Verify on Marketplace**
   - Check https://marketplace.visualstudio.com/items?itemName=zw3rk.source-map-visualizer
   - Ensure version number is correct
   - Test installation from marketplace

2. **Update GitHub Release**
   - Add .vsix file to GitHub release
   - Add marketplace link to release notes

3. **Announce** (optional)
   - Twitter/social media
   - Relevant forums or communities
   - Project website/blog