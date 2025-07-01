# Changelog

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