# Visual .desc Editor

The Visual .desc Editor provides an interactive interface for creating and editing source map description files (.desc). This format serves as a human-readable intermediate representation that can be converted to standard source map formats.

## Features

### 1. Side-by-Side Visualization
- **Source Panel**: Shows the original source code
- **Generated Panel**: Shows the generated/compiled code
- **Visual Connections**: Bezier curves connect mapped segments between source and generated code

### 2. Interactive Mapping Display
- **Color-Coded Segments**: Each mapping is assigned a unique color from a 16-color palette
- **Hover Highlighting**: Hover over any segment to highlight its corresponding mapping
- **Click to Select**: Click on segments to select and focus on specific mappings
- **Mapping List**: Bottom panel shows all mappings with their positions and semantic types

### 3. Mapping Information
Each mapping displays:
- Source and generated positions (file:line:column)
- Semantic type (e.g., PGM, APP, LAM, INTEGER)
- Optional comments from the .desc file

## Current Implementation Status

✅ Completed:
- Basic .desc file parsing
- Visual editor UI with source/generated panels
- Color-coded segment visualization
- Interactive hover and selection
- Mapping list display
- Integration with VSCode custom editor API

🚧 In Progress:
- Interactive mapping creation
- Validation and error highlighting
- Export to standard source map format

## .desc File Format

The .desc format uses 1-based indexing and includes:
```
INPUT: source-file.ext
VERSION
1.0.0
-- Optional comments

OUTPUT: generated-file.ext
<generated code content>

# 1-based absolute indices, will need to be converted to 0-based VLQ encoded "mappings".
[gen-col,src-idx,src-line,src-col,TYPE] -- optional comment
[-] -- line break
```

## Usage

1. Open any .desc file in VSCode
2. The visual editor will automatically activate
3. Explore mappings by hovering and clicking on segments
4. View all mappings in the bottom panel

## Next Steps

- Implement "Add Mapping" functionality for visual mapping creation
- Add validation to ensure mappings are valid
- Implement export to .map format
- Add keyboard navigation between mappings
- Support for multiple source files