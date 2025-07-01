import * as vscode from 'vscode';

export function editDescriptionCommand(_context: vscode.ExtensionContext): void {
    // TODO: Implement visual .desc editor in Phase 2
    void vscode.window.showInformationMessage(
        'Visual mapping editor will be available in the next release. Stay tuned!'
    );
}