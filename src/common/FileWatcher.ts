import * as vscode from 'vscode';
import { debounce } from './utils';
import { Logger } from './logger';

export class FileWatcher implements vscode.Disposable {
    private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private disposables: vscode.Disposable[] = [];
    private logger = Logger.getInstance();
    
    constructor(
        private readonly onChange: () => void,
        debounceTime: number = 500
    ) {
        // Debounce the onChange callback to avoid too many refreshes
        this.onChange = debounce(onChange, debounceTime);
    }
    
    /**
     * Watch a set of files for changes
     */
    public watchFiles(filePaths: string[]): void {
        // Clear existing watchers
        this.clear();
        
        // Create new watchers
        filePaths.forEach(filePath => {
            try {
                const pattern = new vscode.RelativePattern(filePath, '');
                const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);
                
                // Watch for all types of changes
                const changeDisposable = watcher.onDidChange(() => {
                    this.logger.log(`File changed: ${filePath}`);
                    this.onChange();
                });
                
                const createDisposable = watcher.onDidCreate(() => {
                    this.logger.log(`File created: ${filePath}`);
                    this.onChange();
                });
                
                const deleteDisposable = watcher.onDidDelete(() => {
                    this.logger.log(`File deleted: ${filePath}`);
                    this.onChange();
                });
                
                this.watchers.set(filePath, watcher);
                this.disposables.push(watcher, changeDisposable, createDisposable, deleteDisposable);
            } catch (error) {
                this.logger.error(`Failed to watch file: ${filePath}`, error);
            }
        });
    }
    
    /**
     * Watch files based on a source map
     */
    public watchSourceMap(
        mapFilePath: string,
        generatedFilePath: string | undefined,
        sourceFilePaths: string[]
    ): void {
        const filesToWatch: string[] = [mapFilePath];
        
        if (generatedFilePath !== undefined && generatedFilePath !== null && generatedFilePath !== '') {
            filesToWatch.push(generatedFilePath);
        }
        
        filesToWatch.push(...sourceFilePaths);
        
        // Remove duplicates
        const uniqueFiles = [...new Set(filesToWatch)];
        
        this.watchFiles(uniqueFiles);
    }
    
    /**
     * Clear all watchers
     */
    public clear(): void {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables = [];
        this.watchers.clear();
    }
    
    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.clear();
    }
    
    /**
     * Get the list of files being watched
     */
    public getWatchedFiles(): string[] {
        return Array.from(this.watchers.keys());
    }
}