# .desc Editor Usage Guide

## Overview
The Visual .desc Editor allows you to create and edit source map descriptions visually. The editor shows Generated code on the left and Source code on the right, with visual connections between mapped characters.

## Key Features Implemented

### 1. Layout
- **Left Panel**: Generated file with soft-wrap enabled
- **Right Panel**: Source file 
- **Bottom Panel**: List of all mappings
- **SVG Connections**: Visual bezier curves connecting mapped characters

### 2. Editing Workflow

#### Creating New Mappings
1. Click "Add Mapping" button or press Arrow keys to navigate to empty slot
2. **Cmd+Click** (Mac) or **Ctrl+Click** (Windows/Linux) on characters in the Generated panel
3. Selected characters will be highlighted with a blue outline
4. Once you select characters in Generated, the editor automatically switches to Source selection mode
5. **Cmd+Click** on corresponding characters in the Source panel
6. A new mapping is created automatically when you select source characters

#### Editing Existing Mappings
1. Click on a mapping in the bottom list or use **Arrow Up/Down** to navigate
2. The mapping becomes selected and highlighted
3. **Cmd+Click** on any character to add/remove it from the mapping
4. Changes are applied immediately

#### Deleting Mappings
1. Select a mapping using the list or arrow keys
2. Click the "Delete Mapping" button (trash icon)

### 3. Visual Feedback
- **Color Coding**: Each mapping gets a unique color from a 16-color palette
- **Selection Outline**: Blue outline shows characters being edited
- **Hover Effects**: Characters highlight on hover
- **Status Bar**: Shows current editing mode and instructions

### 4. Keyboard Shortcuts
- **Arrow Up/Down**: Navigate through mappings list
- **Cmd+Click**: Toggle character selection
- **Cmd+M**: (Planned) Add selection to mapping from context menu

## Current Implementation Status

✅ **Completed**:
- Pane swapping (Generated left, Source right)
- Soft-wrap for Generated content
- Character-by-character selection with Cmd+Click
- Automatic workflow: Generated → Source selection
- Arrow key navigation through mappings
- Visual connections between mapped characters
- Color-coded mappings
- Edit status display

🚧 **In Progress**:
- Range selection with right-click menu
- Multi-character mapping support
- Proper mapping deletion in the document

❌ **Not Yet Implemented**:
- Validation and error highlighting
- Export to standard .map format
- Support for multiple source files
- Undo/Redo functionality

## Technical Notes

The editor works by:
1. Parsing the .desc file into a structured format
2. Rendering each character as a clickable span element
3. Tracking selections in state
4. Sending messages to the VSCode extension to update the document
5. Re-rendering on each change to maintain consistency

The character-based approach allows precise mapping control, which is essential for source map accuracy.