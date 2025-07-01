import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DescParser, DescFile } from './DescParser';
import { encodeVLQArray } from '../common/vlq';
import { Logger } from '../common/logger';

interface WebviewMessage {
    type: string;
    message?: string;
    data?: unknown;
    mapping?: {
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    };
    index?: number;
    mappings?: unknown[];
    path?: string;
    action?: string;
    descriptor?: string;
    line?: number;
    value?: string;
}

export class DescEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DescEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            DescEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );
        return providerRegistration;
    }

    private static readonly viewType = 'src-map-viz.descEditor';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview')),
                vscode.Uri.file(path.join(this.context.extensionPath, 'resources')),
                vscode.Uri.file(path.dirname(document.uri.fsPath))
            ]
        };

        webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview);

        let descFile: DescFile | null = null;
        
        const updateWebview = async (): Promise<void> => {
            try {
                // Handle empty documents
                const text = document.getText().trim();
                if (!text) {
                    // Create a default structure for empty files
                    descFile = {
                        header: {
                            input: '',
                            comments: []
                        },
                        output: {
                            filename: '',
                            content: ''
                        },
                        mappings: []
                    };
                    
                    // Initialize the document with basic structure
                    const edit = new vscode.WorkspaceEdit();
                    const template = `INPUT: \n\nOUTPUT: \n\n# Mappings use 1-based indices\n[gen-col,src-idx,src-line,src-col,TYPE] -- optional comment\n[-] -- line break marker\n`;
                    edit.insert(document.uri, new vscode.Position(0, 0), template);
                    await vscode.workspace.applyEdit(edit);
                    return;
                }
                
                descFile = DescParser.parse(document.getText());
                
                // Load source file content if it exists
                let sourceContent = '';
                if (descFile.header.input) {
                    const sourcePath = path.resolve(path.dirname(document.uri.fsPath), descFile.header.input);
                    try {
                        sourceContent = await fs.promises.readFile(sourcePath, 'utf-8');
                    } catch (err) {
                        console.warn(`Could not load source file: ${sourcePath}`);
                    }
                }
                
                void webviewPanel.webview.postMessage({
                    type: 'update',
                    desc: descFile,
                    sourceContent,
                    documentUri: document.uri.toString()
                });
            } catch (error) {
                void webviewPanel.webview.postMessage({
                    type: 'error',
                    message: `Failed to parse .desc file: ${String(error)}`
                });
            }
        };

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            const logger = Logger.getInstance();
            
            switch (message.type) {
                case 'ready':
                    await updateWebview();
                    break;
                
                case 'log':
                    if (message.data !== undefined && message.data !== null) {
                        logger.log(message.message as string, message.data);
                    } else {
                        logger.log(message.message as string);
                    }
                    break;
                
                case 'addMapping':
                    if (descFile && message.mapping) {
                        // Insert new mapping at the appropriate position
                        const newMapping = message.mapping;
                        logger.log('Adding mapping', newMapping);
                        
                        const edit = new vscode.WorkspaceEdit();
                        
                        // Calculate source index - for now we only support single source file (srcIdx = 1)
                        // TODO: Support multiple source files
                        const srcIdx = 1;
                        
                        // Find the right position to insert
                        let insertLine = document.lineCount;
                        let mappingsSectionStart = -1;
                        
                        // First, find where the mappings section starts
                        for (let i = 0; i < document.lineCount; i++) {
                            const line = document.lineAt(i).text;
                            if (line.includes('1-based absolute indices')) {
                                mappingsSectionStart = i + 1;
                                insertLine = mappingsSectionStart;
                                break;
                            }
                        }
                        
                        if (mappingsSectionStart >= 0) {
                            // Track the current state
                            let currentGenLine = 1;
                            let lastMappingLine = mappingsSectionStart - 1;
                            let foundTargetPosition = false;
                            
                            // First pass: find where we should insert and what's the current max line
                            for (let j = mappingsSectionStart; j < document.lineCount; j++) {
                                const mappingLine = document.lineAt(j).text.trim();
                                
                                if (mappingLine === '[-]') {
                                    lastMappingLine = j;
                                    currentGenLine++;
                                    if (currentGenLine > newMapping.genLine && !foundTargetPosition) {
                                        // Found position - before this line break
                                        insertLine = j;
                                        foundTargetPosition = true;
                                    }
                                } else if (mappingLine.startsWith('[') && mappingLine !== '[-]') {
                                    lastMappingLine = j;
                                    // Parse existing mapping to check line and column
                                    const match = mappingLine.match(/\[(\d+),/);
                                    if (match && match[1] !== undefined) {
                                        const existingCol = parseInt(match[1]);
                                        if (currentGenLine === newMapping.genLine && existingCol > newMapping.genCol && !foundTargetPosition) {
                                            // Insert before this mapping (same line, but higher column)
                                            insertLine = j;
                                            foundTargetPosition = true;
                                        } else if (currentGenLine > newMapping.genLine && !foundTargetPosition) {
                                            // Insert before this mapping (higher line)
                                            insertLine = j;
                                            foundTargetPosition = true;
                                        }
                                    }
                                }
                            }
                            
                            // If we haven't found a position yet, we need to add at the end
                            if (!foundTargetPosition) {
                                insertLine = lastMappingLine + 1;
                            }
                            
                            // Now we need to add any missing line breaks
                            const lineBreaksToAdd: string[] = [];
                            
                            // Add line breaks for any missing lines between currentGenLine and target
                            logger.log(`Current line: ${currentGenLine}, Target line: ${newMapping.genLine}`);
                            while (currentGenLine < newMapping.genLine) {
                                lineBreaksToAdd.push('[-]\n');
                                currentGenLine++;
                            }
                            logger.log(`Adding ${lineBreaksToAdd.length} line breaks before mapping`);
                            
                            // Prepare the mapping text
                            const mappingText = newMapping.srcLine === 0 
                                ? `[${newMapping.genCol}]`
                                : `[${newMapping.genCol},${srcIdx},${newMapping.srcLine},${newMapping.srcCol},${newMapping.semanticType}]`;
                            
                            // Insert line breaks and the mapping
                            if (lineBreaksToAdd.length > 0) {
                                const allText = lineBreaksToAdd.join('') + mappingText + '\n';
                                edit.insert(document.uri, new vscode.Position(insertLine, 0), allText);
                            } else {
                                edit.insert(document.uri, new vscode.Position(insertLine, 0), mappingText + '\n');
                            }
                        } else {
                            // No mappings section found - this shouldn't happen with our template
                            const mappingText = newMapping.srcLine === 0 
                                ? `[${newMapping.genCol}]`
                                : `[${newMapping.genCol},${srcIdx},${newMapping.srcLine},${newMapping.srcCol},${newMapping.semanticType}]`;
                            edit.insert(document.uri, new vscode.Position(insertLine, 0), mappingText + '\n');
                        }
                        
                        await vscode.workspace.applyEdit(edit);
                    }
                    break;
                
                case 'deleteMapping': {
                    const mappingIndex = message.index as number;
                    logger.log(`Deleting mapping at index ${mappingIndex}`, {
                        totalMappings: descFile?.mappings.length,
                        mapping: descFile?.mappings[mappingIndex]
                    });
                    
                    if (descFile && mappingIndex >= 0 && mappingIndex < descFile.mappings.length) {
                        const targetMapping = descFile.mappings[mappingIndex];
                        
                        // Only delete if it's an actual mapping, not a line break
                        if (!targetMapping || targetMapping.type !== 'mapping') {
                            logger.log('Skipping deletion - not a mapping type', targetMapping);
                            break;
                        }
                        
                        // Find the line in the document that corresponds to this mapping
                        // We need to match the exact mapping based on its content
                        let lineToDelete = -1;
                        let mappingsSectionStart = -1;
                        
                        // First find where mappings start
                        for (let i = 0; i < document.lineCount; i++) {
                            if (document.lineAt(i).text.includes('1-based absolute indices')) {
                                mappingsSectionStart = i + 1;
                                break;
                            }
                        }
                        
                        if (mappingsSectionStart >= 0) {
                            // Now find the specific mapping line
                            let currentIdx = 0;
                            for (let i = mappingsSectionStart; i < document.lineCount; i++) {
                                const line = document.lineAt(i).text.trim();
                                if (line.startsWith('[')) {
                                    if (currentIdx === mappingIndex) {
                                        lineToDelete = i;
                                        logger.log(`Found mapping line to delete at line ${i}: ${line}`);
                                        break;
                                    }
                                    currentIdx++;
                                }
                            }
                        }
                        
                        if (lineToDelete >= 0) {
                            const edit = new vscode.WorkspaceEdit();
                            edit.delete(document.uri, new vscode.Range(lineToDelete, 0, lineToDelete + 1, 0));
                            const success = await vscode.workspace.applyEdit(edit);
                            logger.log(`Deletion ${success ? 'succeeded' : 'failed'}`);
                        } else {
                            logger.log('Could not find line to delete');
                        }
                    }
                    break;
                }
                
                case 'syncMappings': {
                    if (descFile && message.mappings && Array.isArray(message.mappings)) {
                        const mappings = message.mappings as Array<{
                            genLine: number;
                            genCol: number;
                            srcLine: number;
                            srcCol: number;
                            semanticType?: string;
                        }>;
                        logger.log('Syncing all mappings', { 
                            count: mappings.length,
                            firstMapping: mappings[0],
                            allMappings: mappings
                        });
                        
                        // Find where mappings section starts
                        let mappingsSectionStart = -1;
                        for (let i = 0; i < document.lineCount; i++) {
                            if (document.lineAt(i).text.includes('1-based absolute indices')) {
                                mappingsSectionStart = i + 1;
                                break;
                            }
                        }
                        
                        if (mappingsSectionStart >= 0) {
                            const edit = new vscode.WorkspaceEdit();
                            
                            // Delete all existing mappings
                            let endLine = mappingsSectionStart;
                            for (let i = mappingsSectionStart; i < document.lineCount; i++) {
                                const lineText = document.lineAt(i).text.trim();
                                if (lineText.startsWith('[') || lineText === '') {
                                    endLine = i + 1;
                                } else {
                                    break;
                                }
                            }
                            
                            if (endLine > mappingsSectionStart) {
                                edit.delete(document.uri, new vscode.Range(mappingsSectionStart, 0, endLine, 0));
                            }
                            
                            // Sort mappings by generated line and column
                            const sortedMappings = [...mappings].sort((a, b) => {
                                if (a.genLine !== b.genLine) {
return a.genLine - b.genLine;
}
                                return a.genCol - b.genCol;
                            });
                            
                            // Group mappings by generated line
                            const mappingsByLine = new Map<number, typeof sortedMappings>();
                            for (const mapping of sortedMappings) {
                                const lineMapppings = mappingsByLine.get(mapping.genLine) || [];
                                lineMapppings.push(mapping);
                                mappingsByLine.set(mapping.genLine, lineMapppings);
                            }
                            
                            // Add all new mappings with linebreak markers
                            const mappingLines: string[] = [];
                            
                            // Get all unique generated lines in order
                            const genLines = Array.from(mappingsByLine.keys()).sort((a, b) => a - b);
                            
                            // If we have no mappings at all, don't emit anything
                            if (genLines.length === 0) {
                                // No mappings to sync
                            } else {
                                // Find the maximum line number we need to process
                                const maxLine = Math.max(...genLines);
                                
                                // Process each line from 1 to maxLine
                                for (let lineNum = 1; lineNum <= maxLine; lineNum++) {
                                    // Get mappings for this line (if any)
                                    const lineMappings = mappingsByLine.get(lineNum) || [];
                                    
                                    // Add all mappings for this line
                                    for (const mapping of lineMappings) {
                                        const srcIdx = 1; // TODO: Support multiple source files
                                        const mappingText = mapping.srcLine === 0 
                                            ? `[${mapping.genCol}]`
                                            : `[${mapping.genCol},${srcIdx},${mapping.srcLine},${mapping.srcCol},${mapping.semanticType || 'UNKNOWN'}]`;
                                        mappingLines.push(mappingText);
                                    }
                                    
                                    // Add newline marker after each line (except the last)
                                    if (lineNum < maxLine) {
                                        mappingLines.push('[-]');
                                    }
                                }
                            }
                            
                            if (mappingLines.length > 0) {
                                edit.insert(document.uri, new vscode.Position(mappingsSectionStart, 0), 
                                    mappingLines.join('\n') + '\n');
                            }
                            
                            await vscode.workspace.applyEdit(edit);
                            logger.log('Sync completed');
                        }
                    }
                    break;
                }
                
                case 'updateMapping': {
                    const line = message.line as number;
                    const mapping = message.mapping;
                    if (!mapping) {
break;
}
                    const updateEdit = new vscode.WorkspaceEdit();
                    const mappingText = `[${mapping.genCol},1,${mapping.srcLine},${mapping.srcCol},${mapping.semanticType || ''}]`;
                    updateEdit.replace(
                        document.uri,
                        new vscode.Range(line, 0, line, document.lineAt(line).text.length),
                        mappingText
                    );
                    await vscode.workspace.applyEdit(updateEdit);
                    break;
                }
                
                case 'updateInput':
                    if (descFile) {
                        const inputEdit = new vscode.WorkspaceEdit();
                        // Find INPUT: line
                        for (let i = 0; i < document.lineCount; i++) {
                            const line = document.lineAt(i);
                            if (line.text.startsWith('INPUT:')) {
                                inputEdit.replace(
                                    document.uri,
                                    new vscode.Range(i, 0, i, line.text.length),
                                    `INPUT: ${message.value}`
                                );
                                break;
                            }
                        }
                        await vscode.workspace.applyEdit(inputEdit);
                    }
                    break;
                
                case 'updateOutput':
                    if (descFile) {
                        const outputEdit = new vscode.WorkspaceEdit();
                        let outputLineIndex = -1;
                        let contentStartIndex = -1;
                        
                        // Find OUTPUT: line
                        for (let i = 0; i < document.lineCount; i++) {
                            const line = document.lineAt(i);
                            if (line.text.startsWith('OUTPUT:')) {
                                outputLineIndex = i;
                                outputEdit.replace(
                                    document.uri,
                                    new vscode.Range(i, 0, i, line.text.length),
                                    `OUTPUT: ${message.value}`
                                );
                            } else if (outputLineIndex >= 0 && line.text.includes('1-based absolute indices')) {
                                contentStartIndex = i;
                                break;
                            }
                        }
                        
                        // If OUTPUT filename changed and file exists, load its content
                        if (message.value && outputLineIndex >= 0 && contentStartIndex >= 0) {
                            try {
                                const outputPath = path.resolve(path.dirname(document.uri.fsPath), message.value);
                                const outputContent = await fs.promises.readFile(outputPath, 'utf-8');
                                
                                // Replace content between OUTPUT: line and mappings comment
                                const contentLines = outputContent.split('\n');
                                const newContent = contentLines.join('\n');
                                
                                // Delete old content lines
                                for (let i = contentStartIndex - 1; i > outputLineIndex; i--) {
                                    outputEdit.delete(document.uri, new vscode.Range(i, 0, i + 1, 0));
                                }
                                
                                // Insert new content
                                outputEdit.insert(document.uri, new vscode.Position(outputLineIndex + 1, 0), newContent + '\n');
                            } catch (err) {
                                // File doesn't exist yet, that's okay
                                logger.log(`Output file not found: ${message.value}`);
                            }
                        }
                        
                        await vscode.workspace.applyEdit(outputEdit);
                    }
                    break;
                
                case 'browseInput': {
                    const inputFileUri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'All Files': ['*']
                        }
                    });
                    
                    if (inputFileUri && inputFileUri[0]) {
                        const relativePath = path.relative(path.dirname(document.uri.fsPath), inputFileUri[0].fsPath);
                        void webviewPanel.webview.postMessage({
                            type: 'inputSelected',
                            path: relativePath
                        });
                    }
                    break;
                }
                
                case 'browseOutput': {
                    const outputFileUri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'All Files': ['*']
                        }
                    });
                    
                    if (outputFileUri && outputFileUri[0]) {
                        const relativePath = path.relative(path.dirname(document.uri.fsPath), outputFileUri[0].fsPath);
                        void webviewPanel.webview.postMessage({
                            type: 'outputSelected',
                            path: relativePath
                        });
                    }
                    break;
                }
                
                case 'exportSourceMap':
                    if (descFile) {
                        await this.exportToSourceMap(descFile, document.uri, webviewPanel);
                    }
                    break;
                
                case 'openInTextEditor':
                    // Open the current .desc file in text editor
                    await vscode.commands.executeCommand('workbench.action.reopenTextEditor', document.uri);
                    break;
            }
        });

        // Update webview when document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                // Debounce rapid changes to avoid excessive updates
                if ((webviewPanel as any).updateTimer) {
                    clearTimeout((webviewPanel as any).updateTimer);
                }
                (webviewPanel as any).updateTimer = setTimeout(async () => {
                    await updateWebview();
                }, 100);
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Initial update
        await updateWebview();
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const scriptFileName = 'index.js';
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview', 'editor', scriptFileName))
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'styles', 'editor.css'))
        );

        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'))
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
                <link href="${codiconsUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
                <title>Description Editor</title>
            </head>
            <body>
                <div id="app">
                    <div class="loading">
                        <div class="codicon codicon-loading codicon-modifier-spin"></div>
                        <p>Loading description editor...</p>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    
    private async exportToSourceMap(descFile: DescFile, documentUri: vscode.Uri, _webviewPanel: vscode.WebviewPanel) {
        try {
            // Generate source map
            const sourceMap = this.generateSourceMap(descFile);
            
            // Ask user where to save
            const defaultPath = documentUri.fsPath.replace(/\.desc$/, '.map');
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultPath),
                filters: {
                    'Source Maps': ['map'],
                    'All Files': ['*']
                }
            });
            
            if (saveUri) {
                await fs.promises.writeFile(saveUri.fsPath, JSON.stringify(sourceMap, null, 2));
                vscode.window.showInformationMessage(`Source map exported to ${path.basename(saveUri.fsPath)}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export source map: ${error}`);
        }
    }
    
    private generateSourceMap(descFile: DescFile): any {
        // Collect all unique names (semantic types)
        const namesSet = new Set<string>();
        descFile.mappings.forEach(mapping => {
            if (mapping.type === 'mapping' && mapping.semanticType && 
                mapping.semanticType !== 'UNKNOWN') {
                namesSet.add(mapping.semanticType);
            }
        });
        
        // Sort names to get deterministic order
        const names = Array.from(namesSet).sort();
        const nameToIndex = new Map<string, number>();
        names.forEach((name, index) => {
            nameToIndex.set(name, index);
        });
        
        // Process mappings
        let prevGenCol = 0;
        let prevSrcIndex = 0;
        let prevSrcLine = 0;
        let prevSrcCol = 0;
        let prevNameIndex = 0;
        
        const generatedLines: string[] = [];
        let currentLineSegments: string[] = [];
        
        for (const mapping of descFile.mappings) {
            if (mapping.type === 'linebreak') {
                // New line in generated file
                generatedLines.push(currentLineSegments.join(','));
                currentLineSegments = [];
                prevGenCol = 0;  // Reset column for new line
            } else if (mapping.type === 'mapping' && mapping.genCol !== undefined) {
                // Convert from 1-indexed to 0-indexed
                const genCol = mapping.genCol - 1;
                
                // Build the segment
                const segment: number[] = [];
                
                // Always include generated column delta
                segment.push(genCol - prevGenCol);
                prevGenCol = genCol;
                
                // If we have source info (4 or 5 value segment)
                if (mapping.srcLine !== undefined && mapping.srcLine > 0 &&
                    mapping.srcCol !== undefined && mapping.srcIdx !== undefined) {
                    
                    const srcIndex = mapping.srcIdx - 1;
                    const srcLine = mapping.srcLine - 1;
                    const srcCol = mapping.srcCol - 1;
                    
                    segment.push(srcIndex - prevSrcIndex);
                    segment.push(srcLine - prevSrcLine);
                    segment.push(srcCol - prevSrcCol);
                    
                    prevSrcIndex = srcIndex;
                    prevSrcLine = srcLine;
                    prevSrcCol = srcCol;
                    
                    // If we have a name (5 value segment)
                    if (mapping.semanticType && mapping.semanticType !== 'UNKNOWN' &&
                        nameToIndex.has(mapping.semanticType)) {
                        const nameIndex = nameToIndex.get(mapping.semanticType)!;
                        segment.push(nameIndex - prevNameIndex);
                        prevNameIndex = nameIndex;
                    }
                }
                // Otherwise it's a 1-value segment (generated column only)
                
                currentLineSegments.push(encodeVLQArray(segment));
            }
        }
        
        // Add the last line if it has segments
        if (currentLineSegments.length > 0 || generatedLines.length === 0) {
            generatedLines.push(currentLineSegments.join(','));
        }
        
        // Create source map object
        return {
            version: 3,
            file: descFile.output.filename || '',
            sourceRoot: '',
            sources: [descFile.header.input],
            names: names,
            mappings: generatedLines.join(';')
        };
    }
}