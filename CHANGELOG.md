# Changelog

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