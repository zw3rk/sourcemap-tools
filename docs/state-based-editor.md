# State-Based Editor Implementation

## Overview

The source map editor has been refactored to use a centralized state management approach, following the principle that **UI = f(state)**. This addresses all the issues reported by the test engineers.

## Fixed Issues

### 1. **Bold Text Bug** ✅
- **Problem**: All mapped characters appeared bold due to CSS applying `font-weight: 500`
- **Solution**: Removed font-weight from `.char.in-mapping` CSS class

### 2. **Delete Mapping Bug** ✅
- **Problem**: Deleting one mapping sometimes deleted two due to array index issues
- **Solution**: Implemented unique IDs for all mappings and segments

### 3. **N:M Mapping Support** ✅
- **Problem**: Only supported 1:1 mappings
- **Solution**: Implemented proper segment-based data model supporting N:M relationships

### 4. **No-Source Mappings** ✅
- **Problem**: No way to create mappings for generated code without source
- **Solution**: Cmd+Delete creates mappings with empty source array

### 5. **Selection/Deselection** ✅
- **Problem**: Couldn't select and deselect mappings for editing
- **Solution**: Click to select, click again to deselect; proper state tracking

### 6. **Segment Editing** ✅
- **Problem**: Couldn't edit mappings by adding/removing characters
- **Solution**: Cmd+Click toggles characters in/out of segments

### 7. **Visibility Toggle** ✅
- **Problem**: No show/hide toggle in color square
- **Solution**: Added eye icon that appears on hover in mapping color square

## Architecture Changes

### State Model
```typescript
interface AppState {
    mappings: Mapping[];          // All mappings with unique IDs
    selectedMappingId: string | null;
    isEditing: boolean;
    editingMode: 'none' | 'selecting-generated' | 'selecting-source';
    // ... other state
}
```

### Pure Render Function
- All UI updates go through `render(state: AppState)`
- No direct DOM manipulation
- State changes trigger complete re-render (optimized)

## How to Test

### 1. Enable New Implementation
Add to VS Code settings:
```json
{
    "src-map-viz.useStateBasedEditor": true
}
```

### 2. Test Features

#### Bold Text Fix
- Open any .desc file
- Verify mapped characters are NOT bold by default
- Only selected mappings should appear bold

#### Delete Bug Fix
- Create multiple mappings
- Delete any mapping
- Verify only that specific mapping is deleted

#### N:M Mappings
- Drag select multiple characters in generated file
- Drag select multiple characters in source file
- Creates proper N:M mapping

#### No-Source Mappings
- Select characters in generated file
- Press Cmd+Delete
- Creates mapping with no source

#### Visibility Toggle
- Hover over color square in mappings list
- Click eye icon to hide/show
- Hidden mappings appear with strikethrough

#### Segment Editing
- Select an existing mapping
- Cmd+Click characters to add/remove from mapping
- Mapping auto-deletes when all characters removed

### 3. Build & Run

```bash
# Install dependencies
npm install

# Build extension
npm run compile

# Test in VS Code
F5 to launch Extension Development Host
```

## Migration Notes

The new implementation is behind a feature flag. To switch back to the old implementation, set:
```json
{
    "src-map-viz.useStateBasedEditor": false
}
```

## Next Steps

1. Test with `nested_test` files
2. Add undo/redo support
3. Implement multi-segment UI
4. Add validation for complex mappings