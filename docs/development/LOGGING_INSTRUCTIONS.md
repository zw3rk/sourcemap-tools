# Source Map Visualizer - Logging Instructions

## How to View Extension Logs

The extension now has its own logging output channel. To view logs:

1. **Open the Output Panel**:
   - View → Output (or Cmd+Shift+U)
   - In the dropdown, select "Source Map Visualizer"

2. **Using Command Palette**:
   - Press Cmd+Shift+P
   - Type "Source Map: Show Extension Logs"
   - Press Enter

3. **What You'll See**:
   - Mapping creation logs with line/column numbers
   - Line break insertion logs
   - Debug information from the webview
   - Any errors or warnings

## Key Log Messages

- `Adding mapping` - Shows the mapping being added with all details
- `Current line: X, Target line: Y` - Shows line tracking during insertion
- `Adding X line breaks before mapping` - Shows when line breaks are inserted
- `Creating mapping: gen X:Y -> src A:B` - Shows mapping creation from webview

## Testing the Fixes

1. Open `test_line_numbers.desc`
2. The output panel will automatically show
3. Try creating mappings on different lines
4. Watch the logs to see:
   - The correct line numbers being captured
   - Line breaks being added as needed
   - The final mapping structure

The logs will help verify that the line number issue has been fixed!