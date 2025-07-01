# Source Map Visualizer

[![Version](https://img.shields.io/visual-studio-marketplace/v/zw3rk.sourcemap-visualizer)](https://marketplace.visualstudio.com/items?itemName=zw3rk.sourcemap-visualizer)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/zw3rk.sourcemap-visualizer)](https://marketplace.visualstudio.com/items?itemName=zw3rk.sourcemap-visualizer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Advanced source map visualization and visual mapping editor for Visual Studio Code.

![Source Map Visualizer Demo](resources/demo.gif)

## Features

### 🔍 Source Map Viewer
- **Interactive Visualization**: View `.map` files with synchronized source and generated code
- **Smart Connections**: Visual bezier curves show mappings between code segments
- **Click & Highlight**: Click any segment to trace its mapping
- **Multiple Styles**: Choose between bezier, straight, or step connection lines
- **Auto-reload**: Automatically updates when source files change

### ✏️ Visual Desc Editor
- **Drag & Drop Mapping**: Create source maps visually by connecting code segments
- **Character Precision**: Map individual characters or ranges with Cmd/Ctrl+Click
- **Semantic Types**: Assign types (PGM, APP, LAM, INTEGER) to mappings
- **Live Validation**: Real-time validation ensures correct mappings
- **Export to .map**: Convert human-readable `.desc` files to standard source maps

### 🎯 Additional Features
- **File Type Agnostic**: Works with any file type (.js, .ts, .uwu, .cabol, .uplc, etc.)
- **Toggle Views**: Easy switching between visual and text editor modes
- **Browse Integration**: File browser buttons for easy file selection
- **Performance Optimized**: Handles large files with virtualization

## Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Cmd/Ctrl + Shift + X)
3. Search for "Source Map Visualizer"
4. Click Install

### From VSIX Package
```bash
code --install-extension sourcemap-visualizer-1.0.0.vsix
```

## Usage

### Viewing Source Maps
1. Open any `.map` file - the visualizer opens automatically
2. Click segments to highlight mappings
3. Use "Open as Text" in title bar to switch to JSON view

### Creating Visual Mappings
1. Open a `.desc` file - the editor opens automatically
2. Click "Add Mapping" to start
3. Cmd/Ctrl+Click characters in the generated panel
4. Click corresponding characters in the source panel
5. Export to standard `.map` format when done

See the [User Guide](docs/USER_GUIDE.md) for detailed instructions.

## Requirements

- VSCode 1.74.0 or higher
- Node.js 16.x or higher (for development)

## Development

### Prerequisites
- Node.js 16+
- VSCode
- (Optional) Nix for reproducible environment

### Setup
```bash
git clone https://github.com/zw3rk/sourcemap-tools
cd sourcemap-tools
make init     # Install dependencies
make dev      # Start development mode
```

### Available Commands
```bash
make help     # Show all available commands
make build    # Build the extension
make test     # Run tests
make lint     # Run linter
make package  # Create .vsix package
make publish  # Publish to marketplace
```

### Project Structure
```
├── src/              # Extension source code
│   ├── extension.ts  # Main entry point
│   ├── viewer/       # Source map viewer
│   └── editor/       # Desc editor
├── webview/          # Frontend code
│   ├── viewer/       # Viewer UI
│   └── editor/       # Editor UI
├── docs/             # Documentation
├── test/             # Test files
└── resources/        # Icons and assets
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines
- TypeScript strict mode must be enabled
- All code must pass linting (`make lint`)
- Tests must pass (`make test`)
- Follow existing code style

## Support

- 📖 [User Guide](docs/USER_GUIDE.md)
- 🐛 [Report Issues](https://github.com/zw3rk/sourcemap-tools/issues)
- 💬 [Discussions](https://github.com/zw3rk/sourcemap-tools/discussions)

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

Made with ❤️ by [zw3rk pte. ltd.](https://zw3rk.com)