# Release Guide - Step by Step

This guide walks through the complete process of creating and publishing a release.

## Prerequisites
- You're on the `develop` branch
- All features for the release are committed
- Tests are passing locally

## Step-by-Step Release Process

### 1. Prepare the Release

```bash
# Ensure you're on develop and up to date
git checkout develop
git pull private develop

# Run the release verification scripts
git show develop:scripts/verify-release.sh | bash
git show develop:scripts/release-checklist.sh | bash
```

If any issues are found, fix them before proceeding.

### 2. Update Version and Changelog

```bash
# Update version in package.json (e.g., from 1.0.2 to 1.0.3)
# Edit package.json and change the version field

# Update CHANGELOG.md with the new version section
# Add release date and all changes since last release
```

### 3. Commit Version Updates

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.0.3 and update changelog"
git push private develop
```

### 4. Create the Release on Master

```bash
# Switch to master
git checkout master

# Squash merge all changes from develop
git merge --squash develop

# If you get "refusing to merge unrelated histories", use:
git merge --squash develop --allow-unrelated-histories

# Review the staged changes - ensure all critical files are included
git status

# Create the release commit with a clean message
git commit -m "$(cat <<'EOF'
feat: Source Map Visualizer v1.0.3

Brief description of major changes in this release.

## Features
- New feature 1
- New feature 2

## Fixed
- Bug fix 1
- Bug fix 2

## Changed
- Change 1
- Change 2
EOF
)"
```

### 5. Tag Both Branches

```bash
# Tag master with the release version
MASTER_SHA=$(git rev-parse HEAD)
git tag -a "v1.0.3" -m "Source Map Visualizer v1.0.3"

# Switch back to develop and tag it
git checkout develop
git tag -a "v1.0.3-dev" -m "Release v1.0.3 (master: $MASTER_SHA)"
```

### 6. Push to Repositories

```bash
# Push master to public repository (WITHOUT -dev tags!)
git push public master
git push public v1.0.3  # Only push the specific release tag

# Push develop to private repository (with -dev tags)
git push private develop --tags
```

### 7. Verify the Release

```bash
# Check that CI passes on the public repository
nix run nixpkgs#gh -- run list --repo zw3rk/sourcemap-tools --limit 1

# Verify the tag was pushed correctly
git ls-remote --tags public | grep v1.0.3
```

### 8. Publish to VSCode Marketplace

**Option A: Automatic (Recommended)**
The marketplace publishing happens automatically when you push the release tag to the public repository. The GitHub Action will:
- Package the extension
- Publish to VSCode Marketplace
- Create a GitHub release with the .vsix file

Just verify after a few minutes at:
https://marketplace.visualstudio.com/items?itemName=zw3rk.source-map-visualizer

**Option B: Manual**
```bash
# Package the extension
npm run package

# Publish to marketplace (requires PAT)
npx vsce publish -p $VSCE_PAT
```

See [MARKETPLACE_PUBLISHING.md](./MARKETPLACE_PUBLISHING.md) for detailed marketplace setup.

### 9. Create GitHub Release (Optional)

```bash
# Create a GitHub release with the .vsix file
nix run nixpkgs#gh -- release create v1.0.3 \
  --repo zw3rk/sourcemap-tools \
  --title "Source Map Visualizer v1.0.3" \
  --notes "See CHANGELOG.md for details" \
  source-map-visualizer-1.0.3.vsix
```

## Common Issues and Solutions

### Issue: Merge Conflicts During Squash
If you encounter conflicts during `git merge --squash develop`:

```bash
# Reset any failed merge
git merge --abort  # or git reset --hard HEAD

# Copy specific files from develop
git checkout develop -- src/ package.json .eslintrc.json .gitignore
git checkout develop -- tsconfig.json webpack.config.js .github/ Makefile
git checkout develop -- CHANGELOG.md out/test/

# Stage and commit
git add -A
git commit -m "feat: Source Map Visualizer v1.0.3"
```

### Issue: CI Fails on Public Repository
Run verification from master before pushing:

```bash
# While on master, before pushing
git show develop:scripts/verify-release.sh | bash
npm run lint  # Ensure linting passes
```

### Issue: Accidentally Pushed -dev Tags to Public
Remove them immediately:

```bash
git push public --delete v1.0.3-dev
```

## Quick Reference Checklist

- [ ] On develop branch and up to date
- [ ] Run verification scripts
- [ ] Update package.json version
- [ ] Update CHANGELOG.md
- [ ] Commit version changes
- [ ] Switch to master
- [ ] Squash merge from develop
- [ ] Create clean release commit
- [ ] Tag master (v1.0.3)
- [ ] Tag develop (v1.0.3-dev)
- [ ] Push master to public (no -dev tags!)
- [ ] Push develop to private (with tags)
- [ ] Verify CI passes
- [ ] Package extension (npm run package)
- [ ] Publish to VSCode Marketplace
- [ ] Verify marketplace listing
- [ ] Create GitHub release with .vsix file (optional)

## Important Reminders

1. **NEVER push -dev tags to the public repository**
2. **Always run verification scripts before releasing**
3. **Ensure all source files are included in the squash merge**
4. **Keep commit messages clean and descriptive**
5. **Tag both branches to maintain release history**