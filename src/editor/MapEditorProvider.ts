import * as vscode from 'vscode';
import * as path from 'path';
import { MessageProtocol } from '../common/MessageProtocol';
import { getNonce } from '../common/utils';
import { SourcemapParser } from '../viewer/SourcemapParser';
import { PathResolver } from '../viewer/PathResolver';
import { FileLoader } from '../viewer/FileLoader';
import { FileWatcher } from '../common/FileWatcher';
import { Logger } from '../common/logger';

export class MapEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new MapEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            MapEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
        return providerRegistration;
    }

    public static readonly viewType = 'src-map-viz.mapEditor';

    private parser: SourcemapParser;
    private fileLoader: FileLoader;
    private fileWatcher: FileWatcher | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.parser = new SourcemapParser();
        this.fileLoader = new FileLoader();
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const logger = Logger.getInstance();
        logger.log('Resolving custom editor for .map file', document.uri.toString());

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out'),
                vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
                vscode.Uri.file(path.dirname(document.uri.fsPath))
            ]
        };

        webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview);

        const updateWebview = async (): Promise<void> => {
            try {
                // Clear file loader cache for fresh reload
                this.fileLoader.clearCache();

                // Parse the source map
                const sourcemapText = document.getText();
                const parsedMap = await this.parser.parse(sourcemapText);
                
                // Create path resolver
                const resolver = new PathResolver(document.uri);
                
                // Resolve file paths
                const generatedPath = resolver.resolveGeneratedFile(parsedMap.file);
                const sourcePaths = parsedMap.sources.map((source, index) => ({
                    original: source,
                    resolved: resolver.resolve(source, parsedMap.sourceRoot),
                    embeddedContent: parsedMap.sourcesContent?.[index]
                }));
                
                // Load generated file if available
                let generatedContent: string | undefined;
                if (generatedPath !== undefined) {
                    const genFile = await this.fileLoader.loadFile(generatedPath);
                    if (genFile.exists) {
                        generatedContent = genFile.content;
                    }
                }
                
                // Load first source file
                let sourceContent: string | undefined;
                if (sourcePaths.length > 0) {
                    const firstSource = sourcePaths[0];
                    if (firstSource) {
                        const srcFile = await this.fileLoader.loadSourceContent(
                            firstSource.resolved,
                            firstSource.embeddedContent
                        );
                        if (srcFile.exists) {
                            sourceContent = srcFile.content;
                        }
                    }
                }

                // Send parsed data to webview
                void webviewPanel.webview.postMessage({
                    command: 'loadSourcemap',
                    sourcemapPath: document.uri.fsPath,
                    payload: {
                        parsedMap,
                        generatedPath,
                        generatedContent,
                        sourcePaths,
                        sourceContent,
                        firstSourcePath: sourcePaths[0]?.resolved
                    }
                } as MessageProtocol);
                
                // Set up file watching if auto-reload is enabled
                const config = vscode.workspace.getConfiguration('sourcemap-visualizer');
                const autoReload = config.get<boolean>('autoReload', true);
                
                if (autoReload) {
                    this.setupFileWatching(
                        document.uri.fsPath,
                        generatedPath,
                        sourcePaths.map(sp => sp.resolved),
                        webviewPanel,
                        document.uri
                    );
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.log('Failed to load sourcemap', errorMessage);
                
                void webviewPanel.webview.postMessage({
                    command: 'error',
                    error: errorMessage
                } as MessageProtocol);
            }
        };

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                logger.log('Received message from webview', message.command);
                
                switch (message.command) {
                    case 'ready':
                        await updateWebview();
                        break;
                    case 'error':
                        logger.log('Error from webview', message.error);
                        break;
                    case 'log':
                        if (message.data) {
                            logger.log(message.message, message.data);
                        } else {
                            logger.log(message.message);
                        }
                        break;
                    case 'openFile':
                        if (message.path) {
                            try {
                                const fileUri = vscode.Uri.file(message.path);
                                const doc = await vscode.workspace.openTextDocument(fileUri);
                                await vscode.window.showTextDocument(doc, {
                                    viewColumn: vscode.ViewColumn.Two,
                                    preserveFocus: true,
                                    selection: message.selection
                                });
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to open file: ${message.path}`);
                            }
                        }
                        break;
                    case 'openInTextEditor':
                        // Open the current .map file in text editor
                        await vscode.commands.executeCommand('workbench.action.reopenTextEditor', document.uri);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Update webview when document changes (if user edits the .map file externally)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                // Debounce rapid changes
                if ((webviewPanel as any).updateTimer) {
                    clearTimeout((webviewPanel as any).updateTimer);
                }
                (webviewPanel as any).updateTimer = setTimeout(async () => {
                    await updateWebview();
                }, 300);
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            this.fileWatcher?.dispose();
            this.fileWatcher = undefined;
        });

        // Initial update
        await updateWebview();
    }
    
    private setupFileWatching(
        mapFilePath: string,
        generatedFilePath: string | undefined,
        sourceFilePaths: string[],
        _webviewPanel: vscode.WebviewPanel,
        documentUri: vscode.Uri
    ) {
        // Dispose existing watcher
        this.fileWatcher?.dispose();
        
        // Create new watcher
        this.fileWatcher = new FileWatcher(async () => {
            // Reload the document and update webview
            try {
                await vscode.workspace.openTextDocument(documentUri);
                // Trigger update through the document change event
                const edit = new vscode.WorkspaceEdit();
                // Add and immediately remove a space to trigger change event
                edit.insert(documentUri, new vscode.Position(0, 0), ' ');
                await vscode.workspace.applyEdit(edit);
                const edit2 = new vscode.WorkspaceEdit();
                edit2.delete(documentUri, new vscode.Range(0, 0, 0, 1));
                await vscode.workspace.applyEdit(edit2);
            } catch (error) {
                // If document editing fails, just ignore
            }
        });
        
        this.fileWatcher.watchSourceMap(mapFilePath, generatedFilePath, sourceFilePaths);
        
        // Add to subscriptions for cleanup
        this.context.subscriptions.push(this.fileWatcher);
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'viewer', 'index.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'styles', 'viewer.css')
        );

        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
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
                <title>Source Map Visualizer</title>
            </head>
            <body>
                <div id="container">
                    <div id="viewer">
                        <div id="source-pane" class="code-pane">
                            <div class="pane-header">Source</div>
                            <pre id="source-content" class="code-content">Loading source file...</pre>
                        </div>
                        <svg id="connections" class="connection-layer"></svg>
                        <div id="generated-pane" class="code-pane">
                            <div class="pane-header">Generated</div>
                            <pre id="generated-content" class="code-content">Loading generated file...</pre>
                        </div>
                    </div>
                    <div id="legend-panel" class="legend-panel collapsed">
                        <div class="legend-header">
                            <span>Segment Mappings</span>
                            <button id="toggle-legend" class="toggle-button">▼</button>
                        </div>
                        <div id="legend-content" class="legend-content"></div>
                    </div>
                    <div id="status-bar">
                        <span id="status-text">Ready</span>
                        <span id="mapping-stats" class="mapping-stats"></span>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}