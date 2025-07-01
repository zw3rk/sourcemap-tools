# Testing the Tree-Structured Mapping Display

## Test Steps

1. Open the `examples/uwu/nested_test.desc` file in VSCode
2. The desc editor should open automatically
3. Verify the tree-structured mapping display:
   - Mappings should be shown as expandable groups
   - Each mapping group should show the file names (e.g., "nested_test.uplc → nested_test.uwu")
   - The span count should be displayed (e.g., "(5 spans)")
   - Clicking the expand/collapse button should show/hide individual spans

4. Test span display:
   - Each span should show as "└─ 2:80 → 10:9 -- (context here)"
   - The context should show 6 characters from each position
   - Each span should have an editable semantic type field
   - Hover over a span should show a delete button

5. Test semantic type editing:
   - Click on a semantic type field for a span
   - Change the value (e.g., from "UNKNOWN" to "IDENTIFIER")
   - The change should be saved and persist

6. Test span deletion:
   - Hover over a span and click the delete button
   - The span should be removed
   - If all spans in a mapping are deleted, the entire mapping should disappear

7. Test context menus:
   - Right-click on a mapping header for "Delete Entire Mapping" option
   - Right-click on a span for "Delete This Span" option

## Expected Behavior

The mappings should be displayed in a tree structure like:

```
[▼] [🔵] nested_test.uplc → nested_test.uwu (5 spans)
    └─ 2:1 → 1:1 -- ((progr → let x ) # PGM
    └─ 3:3 → 13:2 -- ([(lam  → x = 15) # LAM
    └─ 3:3 → 13:2 -- ([(lam  → x = 15) # X
    └─ 3:3 → 13:2 -- ([(lam  → x = 15) # LAM
    └─ 4:3 → 12:2 -- ([[(lam → y = 10) # Y
```

Where:
- [▼] is the expand/collapse button
- [🔵] is the visibility toggle with the mapping color
- Each span shows generated position → source position
- Context shows actual code characters
- Semantic type is editable per span