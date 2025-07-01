import * as vscode from 'vscode';
import * as path from 'path';
import { MessageProtocol } from '../common/MessageProtocol';
import { getNonce } from '../common/utils';
import { SourcemapParser } from './SourcemapParser';
import { PathResolver } from './PathResolver';
import { FileLoader } from './FileLoader';
import { FileWatcher } from '../common/FileWatcher';

export class ViewerProvider {
    private static instance: ViewerProvider | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private parser: SourcemapParser;
    private fileLoader: FileLoader;
    private fileWatcher: FileWatcher | undefined;
    private currentSourcemapUri: vscode.Uri | undefined;
    
    private constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.parser = new SourcemapParser();
        this.fileLoader = new FileLoader();
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
            'sourcemapVisualizer',
            'Source Map Visualizer',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'out'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
                    vscode.Uri.file(path.dirname(sourcemapUri.fsPath))
                ]
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getHtmlContent(this.panel.webview);

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
                this.fileWatcher?.dispose();
                this.fileWatcher = undefined;
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
        
        // Clear file loader cache for fresh reload
        this.fileLoader.clearCache();

        try {
            // Read sourcemap file
            const sourcemapContent = await vscode.workspace.fs.readFile(sourcemapUri);
            const sourcemapText = new TextDecoder().decode(sourcemapContent);

            // Parse the source map
            const parsedMap = await this.parser.parse(sourcemapText);
            
            // Create path resolver
            const resolver = new PathResolver(sourcemapUri);
            
            // Resolve file paths
            const generatedPath = resolver.resolveGeneratedFile(parsedMap.file);
            const sourcePaths = parsedMap.sources.map((source, index) => ({
                original: source,
                resolved: resolver.resolve(source, parsedMap.sourceRoot),
                embeddedContent: parsedMap.sourcesContent?.[index]
            }));
            
            // Load generated file if available
            let generatedContent: string | undefined;
            if (generatedPath) {
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
            void this.panel.webview.postMessage({
                command: 'loadSourcemap',
                sourcemapPath: sourcemapUri.fsPath,
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
                    sourcemapUri.fsPath,
                    generatedPath,
                    sourcePaths.map(sp => sp.resolved)
                );
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            void vscode.window.showErrorMessage(`Failed to load sourcemap: ${errorMessage}`);
            
            void this.panel.webview.postMessage({
                command: 'error',
                error: errorMessage
            } as MessageProtocol);
        }
    }
    
    private setupFileWatching(
        mapFilePath: string,
        generatedFilePath: string | undefined,
        sourceFilePaths: string[]
    ): void {
        // Dispose existing watcher
        this.fileWatcher?.dispose();
        
        // Create new watcher
        this.fileWatcher = new FileWatcher(() => {
            if (this.currentSourcemapUri) {
                void this.updateContent(this.currentSourcemapUri);
            }
        });
        
        this.fileWatcher.watchSourceMap(mapFilePath, generatedFilePath, sourceFilePaths);
        
        // Add to subscriptions for cleanup
        this.context.subscriptions.push(this.fileWatcher);
    }

    private async handleWebviewMessage(message: MessageProtocol): Promise<void> {
        switch (message.command) {
            case 'ready':
                // Webview is ready, can initialize
                break;
            case 'error':
                void vscode.window.showErrorMessage(message.error || 'Unknown error in visualizer');
                break;
            case 'loadFile':
                await this.loadFileContent(message.filePath!);
                break;
            case 'export':
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
                command: 'fileContent',
                filePath,
                content: text
            } as MessageProtocol);
        } catch (error) {
            void this.panel.webview.postMessage({
                command: 'error',
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
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                void vscode.window.showErrorMessage(`Failed to export: ${errorMessage}`);
            }
        }
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const nonce = getNonce();
        
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'viewer', 'index.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'styles', 'viewer.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}';">
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