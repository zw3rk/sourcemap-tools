import * as vscode from 'vscode';

export async function visualizeSourcemapCommand(_context: vscode.ExtensionContext): Promise<void> {
    // Check if active editor has a .map file
    const activeEditor = vscode.window.activeTextEditor;
    
    if (!activeEditor) {
        void vscode.window.showErrorMessage('No active editor found. Please open a .map file.');
        return;
    }

    const document = activeEditor.document;
    const fileName = document.fileName;

    if (!fileName.endsWith('.map')) {
        void vscode.window.showErrorMessage('Please open a .map file to visualize.');
        return;
    }

    try {
        // Close the current editor and reopen with the custom editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        await vscode.commands.executeCommand('vscode.openWith', document.uri, 'src-map-viz.mapEditor');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(`Failed to visualize sourcemap: ${errorMessage}`);
    }
}