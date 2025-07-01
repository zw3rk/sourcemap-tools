# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-07-01

### Fixed
- Removed references to unreleased file formats from documentation
- Fixed desc file format parser to properly handle content sections between INPUT: and OUTPUT:
- Added soft wrap to generated code pane for better readability of long lines
- Removed VERSION requirement from desc format, making it more flexible

## [1.0.0] - 2025-06-30

### Added
- Initial release of Source Map Visualizer VSCode Extension
- **Map Visualizer**: Interactive visualization of source map files (.map)
  - Synchronized highlighting between source and generated code
  - Multiple connection styles (bezier, straight, step)
  - Smart anchor positioning to prevent lines passing through text
  - Persisted connections with visual markers
  - Toggle between custom visualizer and text editor
- **Desc Editor**: Visual editor for source map description files (.desc)
  - Drag-and-drop mapping creation
  - Visual connections between source and output segments
  - Automatic validation of mappings
  - Export to standard source map format with semantic type support
  - Browse buttons for file selection
- **File Association**: Automatic opening of .map and .desc files in custom editors
- **Title Bar Integration**: "Open as Text" toggle for switching between custom and text editors
- Support for multiple file types (.uwu, .uplc, and any custom extensions)

### Technical Features
- State-based architecture for reliable editor functionality
- Webview-based UI with TypeScript and modern web technologies
- Nix flake for reproducible development environment
- Self-documenting Makefile for common tasks

## [0.0.1] - 2025-06-01

### Added
- Initial development version
- Basic source map visualization
- Prototype desc editor functionality