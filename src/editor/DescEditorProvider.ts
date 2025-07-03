import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DescParser, DescFile, DescMapping } from './DescParser';
import { encodeVLQArray } from '../common/vlq';
import { Logger } from '../common/logger';
import { getNonce } from '../common/utils';
import {
    UpdateDescMessage,
    ErrorDescMessage,
    SourceMapV3
} from '../common/DescEditorMessages';

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
                            inputs: [],
                            output: ''
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

                // Load source file content if it exists (using first input for now)
                let sourceContent = '';
                if (descFile.header.inputs && descFile.header.inputs.length > 0 && descFile.header.inputs[0]) {
                    const sourcePath = path.resolve(path.dirname(document.uri.fsPath), descFile.header.inputs[0]);
                    try {
                        sourceContent = await fs.promises.readFile(sourcePath, 'utf-8');
                    } catch (err) {
                        console.warn(`Could not load source file: ${sourcePath}`);
                    }
                }

                // Load output file content if it exists
                let outputContent = '';
                if (descFile.header.output) {
                    const outputPath = path.resolve(path.dirname(document.uri.fsPath), descFile.header.output);
                    try {
                        outputContent = await fs.promises.readFile(outputPath, 'utf-8');
                    } catch (err) {
                        console.warn(`Could not load output file: ${outputPath}`);
                    }
                }

                const updateMsg: UpdateDescMessage = {
                    type: 'update',
                    desc: descFile,
                    sourceContent,
                    outputContent,
                    documentUri: document.uri.toString()
                };
                void webviewPanel.webview.postMessage(updateMsg);
            } catch (error) {
                const errorMsg: ErrorDescMessage = {
                    type: 'error',
                    message: `Failed to parse .desc file: ${String(error)}`
                };
                void webviewPanel.webview.postMessage(errorMsg);
            }
        };

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (message: any) => {
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
                            const mappingText = (!newMapping.srcLine || newMapping.srcLine === 0)
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
                            const mappingText = (!newMapping.srcLine || newMapping.srcLine === 0)
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

                        // Convert frontend mappings to DescMapping format
                        const descMappings: DescMapping[] = [];
                        let currentGenLine = 1;
                        
                        // Sort mappings by generated line and column
                        const sortedMappings = [...mappings].sort((a, b) => {
                            if (a.genLine !== b.genLine) {
                                return a.genLine - b.genLine;
                            }
                            return a.genCol - b.genCol;
                        });

                        // Convert to DescMapping format with line breaks
                        for (const mapping of sortedMappings) {
                            // Add line breaks as needed
                            while (currentGenLine < mapping.genLine) {
                                descMappings.push({
                                    type: 'linebreak',
                                    genLine: currentGenLine
                                });
                                currentGenLine++;
                            }
                            
                            // Add the mapping
                            descMappings.push({
                                type: 'mapping',
                                genLine: mapping.genLine,
                                genCol: mapping.genCol,
                                srcIdx: 1, // TODO: Support multiple source files
                                srcLine: mapping.srcLine,
                                srcCol: mapping.srcCol,
                                semanticType: mapping.semanticType
                            });
                        }
                        
                        // Update descFile with new mappings
                        descFile.mappings = descMappings;
                        
                        // Regenerate entire file content
                        const newContent = await DescParser.serializeToFile(descFile, document.uri.fsPath);
                        
                        // Replace entire document
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            0, 0,
                            document.lineCount - 1,
                            document.lineAt(document.lineCount - 1).text.length
                        );
                        edit.replace(document.uri, fullRange, newContent);
                        await vscode.workspace.applyEdit(edit);
                        
                        logger.log('Sync completed');
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
                        // Update the header
                        const inputs: string[] = Array.isArray(message.value) ? message.value as string[] : [message.value as string];
                        descFile.header.inputs = inputs;
                        
                        // Regenerate entire file content
                        const newContent = await DescParser.serializeToFile(descFile, document.uri.fsPath);
                        
                        // Replace entire document
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            0, 0,
                            document.lineCount - 1,
                            document.lineAt(document.lineCount - 1).text.length
                        );
                        edit.replace(document.uri, fullRange, newContent);
                        await vscode.workspace.applyEdit(edit);
                    }
                    break;

                case 'updateOutput':
                    if (descFile) {
                        // Update the header
                        descFile.header.output = message.value || '';
                        
                        // Regenerate entire file content
                        const newContent = await DescParser.serializeToFile(descFile, document.uri.fsPath);
                        
                        // Replace entire document
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            0, 0,
                            document.lineCount - 1,
                            document.lineAt(document.lineCount - 1).text.length
                        );
                        edit.replace(document.uri, fullRange, newContent);
                        await vscode.workspace.applyEdit(edit);
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

                case 'exportToSourceMap':
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
        // Track the update timer
        let updateTimer: NodeJS.Timeout | undefined;

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                // Debounce rapid changes to avoid excessive updates
                if (updateTimer) {
                    clearTimeout(updateTimer);
                }
                updateTimer = setTimeout(() => {
                    void updateWebview();
                }, 100);
            }
        });

        // Listen for save events
        const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(e => {
            if (e.uri.toString() === document.uri.toString()) {
                // Send save notification to webview
                void webviewPanel.webview.postMessage({ type: 'saved' });
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            if (updateTimer) {
                clearTimeout(updateTimer);
            }
            changeDocumentSubscription.dispose();
            saveDocumentSubscription.dispose();
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

        const nonce = getNonce();

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

    private generateSourceMap(descFile: DescFile): SourceMapV3 {
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
            file: descFile.header.output || '',
            sourceRoot: '',
            sources: descFile.header.inputs,
            names: names,
            mappings: generatedLines.join(';')
        };
    }
}