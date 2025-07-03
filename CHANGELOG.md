# Changelog

## [1.2.2] - 2025-01-03

### Fixed
- Fixed build error where deleted DescSerializer.ts file was included in release
- Same fixes as 1.2.1 but with corrected build artifacts

## [1.2.1] - 2025-01-03

### Fixed
- Fixed .desc file serialization for mappings without source information
  - Mappings with undefined source positions now correctly output as `[17]` instead of `[17,1,undefined,undefined,UNKNOWN]`
  - Updated serialization logic to properly detect no-source mappings
- Fixed .desc file content handling to treat embedded content as informational cache
  - Output content is now refreshed from disk files on save
  - When OUTPUT field changes, fresh content is loaded from the referenced file
  - When loading a .desc file, current content is loaded from the referenced files
  - Ensures .desc files always reflect the current state of the actual source/output files

### Added
- Automated release process with `make release VERSION=x.x.x` command
- Comprehensive release automation script that handles verification, squashing, tagging
- Claude project commands for common development workflows

### Changed
- Improved release workflow documentation in CLAUDE.md
- Enhanced release verification scripts to prevent development files from reaching master

## [1.2.0] - 2025-01-03

### Added
- Visual save feedback for .desc editor with checkmark indicator
- Support for multiple input files in .desc editor
  - INPUT field now accepts comma-separated values
  - File browser can append to existing inputs
  - Clear placeholder text explaining multiple file support

### Fixed
- Fixed INPUT field in .desc editor always resetting/clearing
  - Frontend now properly uses `inputs` array from backend
  - All references updated from `header.input` to `header.inputs[0]`
- Fixed save functionality in .desc editor
  - Save status now shows visual confirmation
  - Document save events properly trigger UI updates
- Fixed TypeScript errors with implicit any types in updateInput handler

### Changed
- Improved user experience with better tooltips and placeholders
- Enhanced .desc editor stability and responsiveness

## [1.1.0] - 2025-01-03

### Added
- New VSCode command to convert .map files to .desc format
  - Accessible via Command Palette: "Source Map: Convert to Description File (.desc)"
  - Available in context menu when right-clicking .map files
  - Supports multiple source files with separate INPUT: lines
  - Preserves semantic types and relative paths

### Changed
- **BREAKING**: DescHeader interface now uses `inputs: string[]` instead of `input: string`
  - All code using `header.input` must be updated to use `header.inputs`
  - DescParser now collects all INPUT: lines into the array

### Fixed
- Round-trip conversion (.map → .desc → .map) now preserves data accurately
  - Line breaks are properly handled with [-] markers
  - No artificial semantic types (GENERATED/UNKNOWN) are added
  - Relative paths are preserved without conversion to absolute
  - Multiple source files are properly supported

## [1.0.9] - 2025-01-02

### Fixed
- Fixed path resolution to correctly handle self-referential paths without creating duplicate directory segments
- Source maps with paths like "examples/uwu/file.js" now correctly resolve when map file is in matching directory structure

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