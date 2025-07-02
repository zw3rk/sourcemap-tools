import * as vscode from 'vscode';
import { MessageProtocol } from '../common/MessageProtocol';
import { BaseWebviewProvider, WebviewConfig } from '../common/BaseWebviewProvider';
import { VIEW_TYPES, DEFAULTS, WEBVIEW_COMMANDS } from '../common/constants';

export class ViewerProvider extends BaseWebviewProvider {
    private static instance: ViewerProvider | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private currentSourcemapUri: vscode.Uri | undefined;

    private constructor(context: vscode.ExtensionContext) {
        super(context);
    }

    public static getInstance(context: vscode.ExtensionContext): ViewerProvider {
        if (!ViewerProvider.instance) {
            ViewerProvider.instance = new ViewerProvider(context);
        }
        return ViewerProvider.instance;
    }

    public async createOrShow(sourcemapUri: vscode.Uri): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel exists, reveal it
        if (this.panel) {
            this.panel.reveal(column);
            await this.updateContent(sourcemapUri);
            return;
        }

        // Create new panel
        this.panel = vscode.window.createWebviewPanel(
            VIEW_TYPES.SOURCE_MAP_VISUALIZER,
            'Source Map Visualizer',
            column ?? vscode.ViewColumn.One,
            {
                ...this.getWebviewOptions(sourcemapUri),
                retainContextWhenHidden: true
            }
        );

        // Set HTML content
        const config: WebviewConfig = {
            viewType: VIEW_TYPES.SOURCE_MAP_VISUALIZER,
            scriptPath: 'viewer/index.js',
            stylePath: 'viewer.css',
            title: 'Source Map Visualizer'
        };
        this.panel.webview.html = this.getHtmlContent(this.panel.webview, config);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message: unknown) => {
                await this.handleWebviewMessage(message as MessageProtocol);
            },
            undefined,
            this.context.subscriptions
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                this.fileWatcherDisposable?.dispose();
                this.fileWatcherDisposable = undefined;
            },
            undefined,
            this.context.subscriptions
        );

        // Load initial content
        await this.updateContent(sourcemapUri);
    }

    private async updateContent(sourcemapUri: vscode.Uri): Promise<void> {
        if (!this.panel) {
            return;
        }

        this.currentSourcemapUri = sourcemapUri;

        try {
            // Read sourcemap file
            const sourcemapContent = await vscode.workspace.fs.readFile(sourcemapUri);
            const sourcemapText = new TextDecoder().decode(sourcemapContent);

            // Load and parse source map using base class method
            const data = await this.loadAndParseSourceMap(sourcemapUri, sourcemapText);

            // Send parsed data to webview
            void this.panel.webview.postMessage({
                command: WEBVIEW_COMMANDS.LOAD_SOURCEMAP,
                sourcemapPath: sourcemapUri.fsPath,
                payload: data
            } as MessageProtocol);
            
            // Set up file watching if auto-reload is enabled
            const config = vscode.workspace.getConfiguration('sourcemap-visualizer');
            const autoReload = config.get<boolean>('autoReload', DEFAULTS.AUTO_RELOAD);
            
            if (autoReload) {
                this.setupFileWatching(
                    sourcemapUri.fsPath,
                    data.generatedPath,
                    data.sourcePaths.map(sp => sp.resolved),
                    () => {
                        if (this.currentSourcemapUri) {
                            void this.updateContent(this.currentSourcemapUri);
                        }
                    }
                );
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            this.errorHandler.handleError(error, {
                operation: 'Loading source map',
                details: { sourcemapUri: sourcemapUri.toString() }
            });
            
            void this.panel.webview.postMessage({
                command: WEBVIEW_COMMANDS.ERROR,
                error: errorMessage
            } as MessageProtocol);
        }
    }

    private async handleWebviewMessage(message: MessageProtocol): Promise<void> {
        // Handle common messages first
        if (this.handleCommonMessages(message)) {
            return;
        }

        switch (message.command) {
            case WEBVIEW_COMMANDS.READY:
                // Webview is ready, can initialize
                break;
            case WEBVIEW_COMMANDS.LOAD_FILE:
                await this.loadFileContent(message.filePath!);
                break;
            case WEBVIEW_COMMANDS.EXPORT:
                await this.handleExport(message);
                break;
            default:
                console.warn('Unknown message command:', message.command);
        }
    }

    private async loadFileContent(filePath: string): Promise<void> {
        if (!this.panel) {
            return;
        }

        try {
            const fileUri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = new TextDecoder().decode(content);

            void this.panel.webview.postMessage({
                command: WEBVIEW_COMMANDS.FILE_CONTENT,
                filePath,
                content: text
            } as MessageProtocol);
        } catch (error) {
            this.errorHandler.logError(error, {
                operation: 'Loading file content',
                details: { filePath }
            });
            
            void this.panel.webview.postMessage({
                command: WEBVIEW_COMMANDS.ERROR,
                error: `Failed to load file: ${filePath}`
            } as MessageProtocol);
        }
    }
    
    private async handleExport(message: MessageProtocol): Promise<void> {
        const payload = message.payload as { format?: string; content?: string; filename?: string };
        if (payload.format === 'svg' && payload.content) {
            try {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(payload.filename || 'visualization.svg'),
                    filters: {
                        'SVG files': ['svg'],
                        'All files': ['*']
                    }
                });
                
                if (saveUri) {
                    const content = Buffer.from(payload.content, 'utf-8');
                    await vscode.workspace.fs.writeFile(saveUri, content);
                    void vscode.window.showInformationMessage(`Exported visualization to ${saveUri.toString()}`);
                }
            } catch (error) {
                this.errorHandler.handleError(error, {
                    operation: 'Exporting visualization',
                    details: { format: payload.format }
                });
            }
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