# Debugging Line Number Issue

I've added debug logging to help identify the line number issue. To test:

1. Open the test file: `test_line_numbers.desc`
2. Open the browser Developer Console (Cmd+Option+I)
3. Try creating mappings by:
   - Cmd+Click on characters in different lines of the Generated pane
   - Watch the console logs - they will show the actual line numbers being captured
4. The logs will show:
   - `datasetLine`: The actual data-line attribute value
   - `parsedLine`: The parsed integer value
   - `parentLineNumber`: The line number shown in the UI
   - `charContent`: The character you clicked

This will help us identify if:
- The data-line attribute is being set incorrectly
- The parsing is failing
- There's a mismatch between UI and data attributes

Please share the console output when clicking on different lines!