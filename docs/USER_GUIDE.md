# Source Map Visualizer - User Guide

## Overview

The Source Map Visualizer is a VSCode extension that provides interactive visualization and editing tools for source maps. It supports both standard `.map` files and `.desc` files (human-readable source map descriptions).

## Installation

1. Install from the VSCode Marketplace by searching for "Source Map Visualizer"
2. Or download the `.vsix` file and install manually using:
   ```
   code --install-extension sourcemap-visualizer-1.0.0.vsix
   ```

## Features

### 1. Source Map Viewer (.map files)

The viewer provides an interactive visualization of source map files with:

- **Side-by-side display**: Source code on the left, generated code on the right
- **Visual connections**: Colored lines showing mappings between source and generated code
- **Interactive highlighting**: Click any segment to highlight its mapping
- **Synchronized scrolling**: Both panels scroll together
- **Multiple connection styles**: Bezier curves, straight lines, or step connections
- **Smart anchoring**: Lines attach above or below text to avoid overlap

#### Usage:
1. Open any `.map` file in VSCode
2. The visualizer opens automatically
3. Click on segments to see their mappings
4. Use "Open as Text" in the title bar to view raw JSON

### 2. Desc Editor (.desc files)

The visual editor for `.desc` files allows you to create and edit source map descriptions:

- **Visual mapping creation**: Draw connections between source and generated code
- **Character-level precision**: Map individual characters or ranges
- **Color-coded mappings**: Each mapping gets a unique color
- **Semantic type support**: Assign types like PGM, APP, LAM, INTEGER to mappings
- **Export functionality**: Convert to standard source map format

#### Creating Mappings:
1. Click "Add Mapping" or use arrow keys to create a new mapping
2. **Cmd+Click** (Mac) or **Ctrl+Click** (Windows/Linux) on characters in the generated panel
3. Selected characters highlight with a blue outline
4. Click corresponding characters in the source panel
5. The mapping is created automatically

#### Editing Mappings:
1. Select a mapping from the list or use arrow keys
2. **Cmd+Click** to add/remove characters from the selection
3. Changes apply immediately

#### File Selection:
- Use browse buttons next to INPUT/OUTPUT fields
- Accepts any file extension
- Paths are relative to the `.desc` file location

### 3. File Format Support

The extension supports various file types:
- **Source maps**: `.map` files (standard v3 format)
- **Descriptions**: `.desc` files (human-readable format)
- **Source files**: `.js`, `.ts`, `.uwu`, `.uplc`, and any custom extensions

### 4. Toggle Between Views

Both viewers include an "Open as Text" button in the title bar:
- Click to switch to text editor view
- Click again to return to visual editor
- Preserves your position and selection

## .desc File Format

The `.desc` format is a human-readable source map description:

```
INPUT: source-file.ext
<contents of source-file.ext>

OUTPUT: generated-file.ext
<contents of generated-file.ext>

# Mappings use 1-based indices
[gen-col,src-idx,src-line,src-col,TYPE] -- optional comment
[-] -- line break marker
```

Note: The file contents shown after INPUT and OUTPUT lines are included for readability. When saving, these contents are always read fresh from disk to ensure they reflect the current state of the actual files.

Example:
```
INPUT: example.uwu

OUTPUT: example.uplc
; 1-based absolute indices

[2,1,1,1,PGM]
[10,1,1,5,DATA]
[-]
```

## Keyboard Shortcuts

- **Arrow Up/Down**: Navigate through mappings
- **Cmd/Ctrl+Click**: Toggle character selection
- **Escape**: Cancel current operation

## Tips

1. **Performance**: For large files, the viewer uses virtualization to maintain performance
2. **Path Resolution**: All paths in `.desc` files are resolved relative to the file location
3. **Validation**: The editor validates mappings in real-time and shows errors
4. **Export**: Use the export feature to convert `.desc` files to standard `.map` format

## Troubleshooting

**Q: Files don't open in the custom editor**
A: Check that the file association is set up correctly in VSCode settings

**Q: Connections don't appear**
A: Ensure the source map has valid mappings and referenced files exist

**Q: Performance issues with large files**
A: The extension automatically virtualizes large files. If issues persist, try opening as text

## Support

- Report issues: https://github.com/zw3rk/sourcemap-tools/issues
- Documentation: https://github.com/zw3rk/sourcemap-tools