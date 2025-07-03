import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MessageProtocol } from '../common/MessageProtocol';
import { BaseWebviewProvider, WebviewConfig } from '../common/BaseWebviewProvider';
import { debounce } from '../common/utils';
import { VIEW_TYPES, DEFAULTS, COMMANDS } from '../common/constants';
import { MapToDescConverter } from '../converter/MapToDescConverter';
import { DescParser } from './DescParser';
import { SourceMapV3 } from '../common/DescEditorMessages';

export class MapEditorProvider extends BaseWebviewProvider implements vscode.CustomTextEditorProvider {
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

    public static readonly viewType = VIEW_TYPES.MAP_EDITOR;

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.log('Resolving custom editor for .map file', document.uri.toString());

        webviewPanel.webview.options = this.getWebviewOptions(document.uri);

        const config: WebviewConfig = {
            viewType: MapEditorProvider.viewType,
            scriptPath: 'viewer/index.js',
            stylePath: 'viewer.css',
            title: 'Source Map Visualizer'
        };
        webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview, config);

        const updateWebview = async (): Promise<void> => {
            try {
                // Parse and load the source map
                const sourcemapText = document.getText();
                const data = await this.loadAndParseSourceMap(document.uri, sourcemapText);

                // Send parsed data to webview
                void webviewPanel.webview.postMessage({
                    command: 'loadSourcemap',
                    sourcemapPath: document.uri.fsPath,
                    payload: data
                } as MessageProtocol);
                
                // Set up file watching if auto-reload is enabled
                const config = vscode.workspace.getConfiguration('sourcemap-visualizer');
                const autoReload = config.get<boolean>('autoReload', DEFAULTS.AUTO_RELOAD);
                
                if (autoReload) {
                    this.setupFileWatching(
                        document.uri.fsPath,
                        data.generatedPath,
                        data.sourcePaths.map(sp => sp.resolved),
                        async () => {
                            // Reload the document and update webview
                            try {
                                await vscode.workspace.openTextDocument(document.uri);
                                // Trigger update through the document change event
                                const edit = new vscode.WorkspaceEdit();
                                // Add and immediately remove a space to trigger change event
                                edit.insert(document.uri, new vscode.Position(0, 0), ' ');
                                await vscode.workspace.applyEdit(edit);
                                const edit2 = new vscode.WorkspaceEdit();
                                edit2.delete(document.uri, new vscode.Range(0, 0, 0, 1));
                                await vscode.workspace.applyEdit(edit2);
                            } catch (error) {
                                // If document editing fails, just ignore
                            }
                        }
                    );
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                this.errorHandler.handleError(error, {
                    operation: 'Loading source map in editor',
                    details: { documentUri: document.uri.toString() }
                });
                
                void webviewPanel.webview.postMessage({
                    command: 'error',
                    error: errorMessage
                } as MessageProtocol);
            }
        };

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                await this.handleWebviewMessage(message, document);
            },
            undefined,
            this.context.subscriptions
        );

        // Create debounced update function
        const debouncedUpdate = debounce(updateWebview, DEFAULTS.DEBOUNCE_TIME);

        // Update webview when document changes (if user edits the .map file externally)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                debouncedUpdate();
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            this.fileWatcherDisposable?.dispose();
            this.fileWatcherDisposable = undefined;
        });

        // Initial update
        await updateWebview();
    }

    private async handleWebviewMessage(message: MessageProtocol, document: vscode.TextDocument): Promise<void> {
        this.logger.log('Received message from webview', message.command);
        
        // Handle common messages first
        if (this.handleCommonMessages(message)) {
            return;
        }

        switch (message.command) {
            case 'ready':
                // Webview is ready - initial update already done
                break;
            case 'openFile':
                const openFileMsg = message as any;
                if (openFileMsg.path) {
                    await this.openFileInEditor(openFileMsg.path, openFileMsg.selection);
                }
                break;
            case 'openInTextEditor':
                // Open the current .map file in text editor
                await vscode.commands.executeCommand(COMMANDS.OPEN_IN_TEXT_EDITOR, document.uri);
                break;
            case 'convertToDesc':
                // Convert .map to .desc format
                await this.convertToDesc(document);
                break;
            default:
                console.warn('Unknown message command:', message.command);
        }
    }

    private async convertToDesc(document: vscode.TextDocument): Promise<void> {
        try {
            // Parse the source map
            const sourcemapContent = document.getText();
            const sourceMap: SourceMapV3 = JSON.parse(sourcemapContent);
            
            // Convert to .desc format
            const descFile = MapToDescConverter.convert(sourceMap, document.uri.fsPath);
            
            // Ask user where to save
            const defaultPath = document.uri.fsPath.replace(/\.map$/, '.desc');
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
            this.logger.log('Error converting to desc file', error);
        }
    }

    protected getBodyContent(): string {
        return `<div id="container">
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
    </div>`;
    }
}