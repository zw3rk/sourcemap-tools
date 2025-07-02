import * as vscode from 'vscode';
import * as path from 'path';
import { MessageProtocol } from './MessageProtocol';
import { getNonce } from './utils';
import { SourcemapParser } from './SourcemapParser';
import { FileService } from './FileService';
import { WorkspaceFileWatcher } from './WorkspaceFileWatcher';
import { Logger } from './logger';
import { ErrorHandler } from './ErrorHandler';

export interface WebviewConfig {
    viewType: string;
    scriptPath: string;
    stylePath: string;
    title: string;
}

export interface ParsedSourceMapData {
    parsedMap: any;
    generatedPath: string | undefined;
    generatedContent: string | undefined;
    sourcePaths: Array<{
        original: string;
        resolved: string;
        embeddedContent?: string | null;
    }>;
    sourceContent: string | undefined;
    firstSourcePath: string | undefined;
}

export abstract class BaseWebviewProvider {
    protected parser: SourcemapParser;
    protected fileService: FileService;
    protected fileWatcherDisposable: vscode.Disposable | undefined;
    protected logger: Logger;
    protected errorHandler: ErrorHandler;
    protected workspaceWatcher: WorkspaceFileWatcher;

    constructor(
        protected readonly context: vscode.ExtensionContext
    ) {
        this.parser = new SourcemapParser();
        this.fileService = new FileService();
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.workspaceWatcher = WorkspaceFileWatcher.getInstance();
    }

    protected async loadAndParseSourceMap(
        sourcemapUri: vscode.Uri,
        sourcemapText: string
    ): Promise<ParsedSourceMapData> {
        // Clear file service cache for fresh reload
        this.fileService.clearCache();

        // Parse the source map
        const parsedMap = await this.parser.parse(sourcemapText);
        
        // Resolve file paths
        const generatedPath = this.fileService.resolveGeneratedFile(parsedMap.file, sourcemapUri);
        const sourcePaths = this.fileService.resolveSourcePaths(
            parsedMap.sources,
            sourcemapUri,
            parsedMap.sourceRoot,
            parsedMap.sourcesContent
        );
        
        // Load generated file if available
        let generatedContent: string | undefined;
        if (generatedPath) {
            const genFile = await this.fileService.loadFile(generatedPath);
            if (genFile.exists) {
                generatedContent = genFile.content;
            }
        }
        
        // Load first source file
        let sourceContent: string | undefined;
        if (sourcePaths.length > 0) {
            const firstSource = sourcePaths[0];
            if (firstSource) {
                const srcFile = await this.fileService.loadSourceContent(
                    firstSource.resolved,
                    firstSource.embeddedContent
                );
                if (srcFile.exists) {
                    sourceContent = srcFile.content;
                }
            }
        }

        return {
            parsedMap,
            generatedPath,
            generatedContent,
            sourcePaths,
            sourceContent,
            firstSourcePath: sourcePaths[0]?.resolved
        };
    }

    protected setupFileWatching(
        mapFilePath: string,
        generatedFilePath: string | undefined,
        sourceFilePaths: string[],
        onFileChange: () => void
    ): void {
        // Dispose existing watcher
        this.fileWatcherDisposable?.dispose();
        
        // Create new watcher using the workspace watcher
        this.fileWatcherDisposable = this.workspaceWatcher.watchSourceMap(
            mapFilePath,
            generatedFilePath,
            sourceFilePaths,
            onFileChange
        );
        
        // Add to subscriptions for cleanup
        this.context.subscriptions.push(this.fileWatcherDisposable);
    }

    protected getHtmlContent(webview: vscode.Webview, config: WebviewConfig): string {
        const nonce = getNonce();
        
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', ...config.scriptPath.split('/'))
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'styles', config.stylePath)
        );

        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}';
                   font-src ${webview.cspSource};
                   img-src ${webview.cspSource} data:;">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>${config.title}</title>
</head>
<body>
    ${this.getBodyContent()}
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    protected abstract getBodyContent(): string;

    protected handleCommonMessages(message: MessageProtocol): boolean {
        switch (message.command) {
            case 'error':
                this.logger.log('Error from webview', message.error);
                if (message.error) {
                    void vscode.window.showErrorMessage(message.error);
                }
                return true;
            case 'log':
                const logData = (message as any).data;
                const logMessage = (message as any).message;
                if (logData) {
                    this.logger.log(logMessage || '', logData);
                } else {
                    this.logger.log(logMessage || '');
                }
                return true;
            default:
                return false;
        }
    }

    protected async openFileInEditor(path: string, selection?: vscode.Selection): Promise<void> {
        try {
            const fileUri = vscode.Uri.file(path);
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true,
                selection
            });
        } catch (error) {
            this.errorHandler.handleError(error, {
                operation: 'Opening file in editor',
                details: { path, selection }
            });
        }
    }

    protected getWebviewOptions(documentUri: vscode.Uri): vscode.WebviewOptions {
        return {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out'),
                vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
                vscode.Uri.file(path.dirname(documentUri.fsPath))
            ]
        };
    }
}