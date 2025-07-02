# Changelog

## [1.0.8] - 2025-01-02

### Added
- Improved path resolution with suffix matching for self-referential source maps
- Better handling when source map paths share parent directories with map file location

### Fixed
- Source maps with paths like "examples/uwu/file.js" now correctly resolve when the map file is in "examples/uwu/"
- Both generated file and source file resolution now handle shared directory structures

## [1.0.7] - 2025-01-02

### Added
- GitHub Sponsors funding configuration

### Internal
- Added master subset verification to release checklist
- Cleaned up release process to ensure master is always a true subset of develop

## [1.0.6] - 2025-01-02

### Fixed
- Fixed TypeScript linting errors in BaseWebviewProvider
- Improved type safety by removing `any` types
- Fixed Uri template literal expressions
- Fixed nullable string conditionals

## [1.0.5] - 2025-01-02

### Fixed
- Fixed critical regression where bezier lines were not displaying for mappings (only first line of generated file was shown)
- Fixed desc editor to load content from actual INPUT/OUTPUT files instead of using embedded content
- Fixed linting error with unnecessary await in MapEditorProvider

### Changed
- Improved code quality and organization:
  - Extracted common webview provider logic into BaseWebviewProvider class
  - Consolidated FileLoader and PathResolver into unified FileService
  - Created TypedMessages for type-safe webview communication
  - Improved TypeScript type safety throughout the codebase
  - Created centralized ErrorHandler for consistent error handling
  - Implemented efficient WorkspaceFileWatcher using singleton pattern
  - Extracted magic strings into constants file for better maintainability

### Internal
- Eliminated ~200 lines of duplicate code through base class extraction
- Improved performance with optimized file watching
- Enhanced error handling consistency across the extension

## [1.0.4] - 2025-01-01

### Fixed
- Corrected repository URL in package.json (removed duplicate entry)
- Fixed marketplace URLs in README badges to use correct extension ID
- Removed reference to non-existent demo.gif

### Added
- Sponsor button configuration for VSCode Marketplace

## [1.0.3] - 2025-01-01

### Added
- Automated VSCode marketplace publishing via GitHub Actions
- Release verification scripts to prevent missing files
- Comprehensive release documentation and guides
- Setup helper script for marketplace configuration

### Changed
- Improved release workflow with automated checks
- Enhanced documentation structure for development processes

### Internal
- Added development-only scripts for release verification
- Improved separation between development and production branches

## [1.0.2] - 2025-01-01

### Fixed
- Fixed CI/CD pipeline to use correct branch names (master instead of main)
- Fixed ESLint type safety errors in DescEditorProvider and DescParser
- Fixed missing package script for VSCE packaging
- Added temporary test stub to make CI pass
- Aligned local development workflow with CI pipeline using make targets

### Changed
- Adjusted ESLint rules to make strict type checks warnings instead of errors
- Standardized CI to use make targets for consistency
- Updated .gitignore to include test stub file

### Internal
- Fixed git workflow to never push -dev tags to public repository
- Updated development documentation with proper release workflow

## [1.0.1] - 2024-12-31

### Fixed
- Removed all references to .cabol file format from documentation
- Fixed desc file format specification to correctly skip content between INPUT: and OUTPUT: sections
- Added soft wrap for generated source pane to handle long lines

## [1.0.0] - 2024-12-31

### Features
- Interactive source map visualization for .map files
- Visual mapping editor for .desc files with drag-and-drop interface
- Real-time updates and hot reload
- Support for multiple file formats (.js, .ts, .uwu, .uplc)
- Modern, intuitive UI with split view
- Custom icon design (side-by-side documents with bezier curves)
- Comprehensive documentation and user guide
- Professional packaging and CI/CD setup