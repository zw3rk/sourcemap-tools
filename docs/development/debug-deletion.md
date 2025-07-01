# Debugging Deletion Issues

## How to Test

1. Open the `examples/uwu/nested_test.desc` file in VSCode
2. Open the VSCode Output panel (View → Output)
3. Select "Source Map Visualizer" from the dropdown in the Output panel
4. This will show all the logging output from the extension

## Testing Cmd+Click Deletion

1. Click on a mapping in the list to select it (it should be highlighted)
2. Hold Cmd and click on a character in either pane
3. Check the Output panel for these log messages:
   - `handleCharClick: line=X, col=Y, type=generated/source, metaKey=true, selectedMapping=...`
   - `Cmd+Click with selected mapping - toggling location`
   - `toggleLocationInMapping called: line=X, col=Y, type=..., selectedMapping=...`
   - Either `Removing generated location: X:Y` or `Adding generated location: X:Y`

## Testing Right-Click Context Menu

1. Right-click on a span item in the mapping list
2. Check the Output panel for:
   - `Span context menu: mappingId=..., segmentId=..., spanIndex=...`
3. Click "Delete This Span" from the context menu
4. Check for:
   - `Deleting span: mappingId=..., segmentId=..., spanIndex=...`
   - `DELETE_PAIR action: {mappingId: ..., segmentId: ..., pairIndex: ...}` (in browser console)

## Testing Delete Button

1. Hover over a span item to see the delete button (X)
2. Click the delete button
3. Check the Output panel for:
   - `Span delete button clicked`
   - `Span delete: mappingId=..., segmentId=..., spanIndex=...`

## Common Issues

1. **No logs appearing**: Make sure you have the correct output channel selected
2. **Cmd+Click not working**: 
   - Ensure a mapping is selected first
   - Check if the character already has a mapping
3. **Right-click not working**: 
   - Ensure you're clicking on the span item, not just the text
   - Check if the context menu appears at all

## Browser Console

For additional debugging, open the browser developer tools:
1. Help → Toggle Developer Tools
2. Go to the Console tab
3. Look for console.log messages from the reducer (DELETE_PAIR action logs)