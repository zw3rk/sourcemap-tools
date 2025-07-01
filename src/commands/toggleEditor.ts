import * as vscode from 'vscode';
import { Logger } from '../common/logger';

export async function openInTextEditorCommand(resourceUri?: vscode.Uri): Promise<void> {
    const logger = Logger.getInstance();
    
    // Use provided URI (from menu args) or try to get from active text editor
    const uri = resourceUri || vscode.window.activeTextEditor?.document.uri;
    
    if (!uri) {
        logger.log('No URI available for opening in text editor');
        return;
    }
    
    logger.log('Opening in text editor', uri.toString());
    
    // Use the VSCode command to reopen in text editor
    await vscode.commands.executeCommand('workbench.action.reopenTextEditor', uri);
}

export async function openInCustomEditorCommand(): Promise<void> {
    const logger = Logger.getInstance();
    const activeEditor = vscode.window.activeTextEditor;
    
    if (!activeEditor) {
        logger.log('No active editor found');
        return;
    }
    
    const document = activeEditor.document;
    const fileName = document.fileName;
    logger.log('Opening in custom editor', fileName);
    
    // Determine which custom editor to use based on file extension
    let viewType: string;
    if (fileName.endsWith('.map')) {
        viewType = 'src-map-viz.mapEditor';
    } else if (fileName.endsWith('.desc')) {
        viewType = 'src-map-viz.descEditor';
    } else {
        void vscode.window.showErrorMessage('This file type does not have a custom editor');
        return;
    }
    
    // Close the current text editor
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    
    // Open with the custom editor
    await vscode.commands.executeCommand('vscode.openWith', document.uri, viewType);
}