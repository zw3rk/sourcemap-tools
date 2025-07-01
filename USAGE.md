# Usage Commands

## Running CI Locally

### Run the full CI pipeline locally (exactly as CI does)
```bash
make ci
```

This runs the complete CI pipeline in the same order as GitHub Actions:
1. `make init` - Install dependencies (uses npm ci in CI environment)
2. `make lint` - Run ESLint
3. `make test` - Run tests
4. `make build` - Compile TypeScript
5. `make package` - Create VSIX package

### Individual CI steps
```bash
make check    # Run lint + test only
make build    # Compile TypeScript only
make package  # Build and package (includes build step)
```

## GitHub CLI (gh) Commands for CI

### List CI runs
```bash
nix run nixpkgs#gh -- run list --repo zw3rk/sourcemap-tools-private
```

### View specific CI run details
```bash
nix run nixpkgs#gh -- run view <RUN_ID> --repo zw3rk/sourcemap-tools-private
```

### View failed logs from CI run
```bash
nix run nixpkgs#gh -- run view <RUN_ID> --log-failed --repo zw3rk/sourcemap-tools-private
```

## Common Development Commands

### Run linter
```bash
npm run lint
```

### Run tests
```bash
npm test
```

### Build extension
```bash
npm run compile
```

### Package extension
```bash
npm run package
```

### Run development mode
```bash
npm run watch
```

## Release Commands

### Create release on master branch
```bash
# Switch to master
git checkout master

# Squash merge from develop
git merge --squash develop

# Create release commit
git commit -m "feat: Release description"

# Tag the release
git tag -a v1.0.0 -m "Source Map Visualizer v1.0.0"

# Push to public repo (NO -dev tags!)
git push public master
git push public v1.0.0
```

### Tag develop branch
```bash
# Switch to develop
git checkout develop

# Tag with -dev suffix
MASTER_SHA=$(git rev-parse master)
git tag -a v1.0.0-dev -m "Release v1.0.0 (master: $MASTER_SHA)"

# Push to private repo
git push private develop --tags
```