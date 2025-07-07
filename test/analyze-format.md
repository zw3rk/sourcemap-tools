# Source Map Format Analysis

## Issue
The round-trip conversion fails because of different representations of line breaks:

### In .map format (Source Map V3):
- Semicolons (`;`) separate lines in the generated file
- Each segment between semicolons represents mappings for one generated line
- Empty segments (consecutive semicolons `;;`) represent empty lines

Example:
```
AAAA;AACA,SAASA;AACjB,EAAEC
```
- Line 1: `AAAA` (one mapping)
- Line 2: `AACA,SAASA` (two mappings)
- Line 3: `AACjB,EAAEC` (two mappings)

### In .desc format:
- All mappings are listed sequentially
- `[-]` markers explicitly indicate line breaks in the generated file
- genLine field tracks which generated line each mapping belongs to

Example:
```
[1,1,1,1]
[-]
[1,1,2,1]
[10,1,2,10,hello]
[-]
[1,1,3,1]
```

## Current Problem
Our converter assigns genLine based on the source map's line index, but doesn't insert `[-]` markers between lines. This causes all mappings to appear on line 1 in the .desc format.

## Solution
We need to insert `[-]` markers whenever we move to a new line in the source map (when we encounter a semicolon).