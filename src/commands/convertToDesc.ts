import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MapToDescConverter } from '../converter/MapToDescConverter';
import { DescParser } from '../editor/DescParser';
import { SourceMapV3 } from '../common/DescEditorMessages';
import { Logger } from '../common/logger';

export async function convertToDescCommand(uri?: vscode.Uri): Promise<void> {
    const logger = Logger.getInstance();
    
    try {
        // Get the URI - either from parameter, active text editor, or active custom editor
        let fileUri = uri;
        if (!fileUri) {
            // First try active text editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                fileUri = activeEditor.document.uri;
            } else {
                // Try to find active custom editor
                const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
                if (activeTab && activeTab.input && typeof activeTab.input === 'object' && 'uri' in activeTab.input) {
                    fileUri = (activeTab.input as any).uri;
                }
            }
        }
        
        if (!fileUri) {
            vscode.window.showErrorMessage('No source map file selected');
            return;
        }
        
        // Check if it's a .map file
        if (!fileUri.fsPath.endsWith('.map')) {
            vscode.window.showErrorMessage('Please select a .map file to convert');
            return;
        }
        
        // Read and parse the source map file
        const sourcemapContent = await fs.promises.readFile(fileUri.fsPath, 'utf-8');
        const sourceMap: SourceMapV3 = JSON.parse(sourcemapContent);
        
        // Convert to .desc format
        const descFile = MapToDescConverter.convert(sourceMap, fileUri.fsPath);
        
        // Ask user where to save
        const defaultPath = fileUri.fsPath.replace(/\.map$/, '.desc');
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultPath),
            filters: {
                'Description Files': ['desc'],
                'All Files': ['*']
            }
        });
        
        if (saveUri) {
            const descContent = await DescParser.serializeToFile(descFile, saveUri.fsPath);
            await fs.promises.writeFile(saveUri.fsPath, descContent);
            vscode.window.showInformationMessage(`Description file created at ${path.basename(saveUri.fsPath)}`);
            
            // Optionally open the created file
            const openFile = await vscode.window.showInformationMessage(
                'Would you like to open the created description file?',
                'Yes',
                'No'
            );
            
            if (openFile === 'Yes') {
                await vscode.commands.executeCommand('vscode.open', saveUri);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to convert to description file: ${errorMessage}`);
        logger.log('Error converting to desc file', error);
    }
}