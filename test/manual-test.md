# Manual Test Instructions for .map to .desc Conversion

## Testing the Round-trip Conversion

1. **Open VSCode with the extension**
   ```bash
   code --extensionDevelopmentPath=/Users/angerman/Projects/zw3rk/src-map-viz
   ```

2. **Test with single source file**
   - Open `test/fixtures/nested_test.uplc.map`
   - Right-click on the file or use Command Palette (Cmd+Shift+P)
   - Select "Convert to Description File (.desc)"
   - Save as `nested_test.converted.desc`
   - Compare with original `nested_test.desc`

3. **Test with multiple source files**
   - Open `test/multi-source.map`
   - Convert to .desc using the command
   - Verify that all three source files are listed as separate INPUT: lines
   - Open the generated .desc file
   - Use the "Export to Source Map" button to convert back to .map
   - Compare the regenerated .map with the original

## Expected Results

### For multi-source.map:
The generated .desc file should have:
```
INPUT: /Users/angerman/Projects/zw3rk/src-map-viz/test/src/utils.js
INPUT: /Users/angerman/Projects/zw3rk/src-map-viz/test/src/main.js  
INPUT: /Users/angerman/Projects/zw3rk/src-map-viz/test/src/config.js

OUTPUT: bundle.js
  // Generated content...
  
[mappings...]
```

### Verification Steps:
1. All source files should be preserved
2. Semantic types (names) should be preserved
3. Mapping positions should remain accurate
4. The round-trip (.map -> .desc -> .map) should produce identical mappings

## Command Access Methods

1. **Command Palette**: 
   - Cmd+Shift+P → "Source Map: Convert to Description File (.desc)"

2. **Context Menu**:
   - Right-click on any .map file in the explorer
   - Select "Convert to Description File (.desc)"

3. **Editor Title Menu**:
   - When a .map file is open, look for the export icon in the editor title bar