# Building the Source Map Visualizer Extension

## Prerequisites

This project uses Nix for a reproducible development environment.

1. Install Nix: https://nixos.org/download.html
2. Enable flakes (if not already enabled):
   ```bash
   echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
   ```

## Quick Start

1. Enter the development environment:
   ```bash
   nix develop
   # or with direnv:
   direnv allow
   ```

2. Install dependencies and build:
   ```bash
   make init
   make build
   ```

## Manual Build Steps

If you prefer to build manually:

```bash
# Enter nix shell
nix develop

# Install dependencies
npm install

# Build the extension
npm run compile

# Or watch for changes
npm run watch
```

## Troubleshooting

### Extension not loading
- Make sure `out/extension.js` exists after building
- Check the Output panel in VSCode for error messages

### Type errors
- Run `npm install` to ensure all type definitions are installed
- The project includes custom type definitions in `src/types/`

### Build errors
- Clear the output directory: `make clean`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Testing

1. Press F5 in VSCode to launch Extension Development Host
2. Open the test file: `examples/uwu/nested_test.uplc.map`
3. Right-click and select "Visualize Sourcemap"