import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from './utils';
import { Logger } from './logger';

interface WatcherCallback {
    pattern: string;
    callback: () => void;
}

/**
 * Improved file watcher that uses workspace-wide patterns for better performance
 */
export class WorkspaceFileWatcher implements vscode.Disposable {
    private static instance: WorkspaceFileWatcher | undefined;
    private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private callbacks: Map<string, Set<WatcherCallback>> = new Map();
    private disposables: vscode.Disposable[] = [];
    private logger = Logger.getInstance();
    
    private constructor() {
        // Initialize with common patterns
        this.initializeWatchers();
    }
    
    public static getInstance(): WorkspaceFileWatcher {
        if (!WorkspaceFileWatcher.instance) {
            WorkspaceFileWatcher.instance = new WorkspaceFileWatcher();
        }
        return WorkspaceFileWatcher.instance;
    }
    
    /**
     * Initialize watchers for common file patterns
     */
    private initializeWatchers(): void {
        const patterns = [
            '**/*.map',      // Source map files
            '**/*.js',       // JavaScript files
            '**/*.ts',       // TypeScript files
            '**/*.desc',     // Description files
            '**/*.uwu',      // Uwu files
            '**/*.uplc'      // UPLC files
        ];
        
        patterns.forEach(pattern => {
            this.createWatcher(pattern);
        });
    }
    
    /**
     * Create a file system watcher for a pattern
     */
    private createWatcher(pattern: string): void {
        if (this.watchers.has(pattern)) {
            return; // Watcher already exists
        }
        
        try {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            
            // Set up event handlers
            const changeHandler = (uri: vscode.Uri) => {
                this.handleFileEvent(uri, 'change');
            };
            
            const createHandler = (uri: vscode.Uri) => {
                this.handleFileEvent(uri, 'create');
            };
            
            const deleteHandler = (uri: vscode.Uri) => {
                this.handleFileEvent(uri, 'delete');
            };
            
            const changeDisposable = watcher.onDidChange(changeHandler);
            const createDisposable = watcher.onDidCreate(createHandler);
            const deleteDisposable = watcher.onDidDelete(deleteHandler);
            
            this.watchers.set(pattern, watcher);
            this.disposables.push(watcher, changeDisposable, createDisposable, deleteDisposable);
            this.callbacks.set(pattern, new Set());
            
        } catch (error) {
            this.logger.error(`Failed to create watcher for pattern: ${pattern}`, error);
        }
    }
    
    /**
     * Handle file system events
     */
    private handleFileEvent(uri: vscode.Uri, eventType: 'change' | 'create' | 'delete'): void {
        const filePath = uri.fsPath;
        this.logger.log(`File ${eventType}: ${filePath}`);
        
        // Find all callbacks that should be triggered
        const triggeredCallbacks = new Set<() => void>();
        
        this.callbacks.forEach((callbackSet) => {
            // Check if the file matches any specific file paths being watched
            callbackSet.forEach(cb => {
                if (this.matchesPattern(filePath, cb.pattern)) {
                    triggeredCallbacks.add(cb.callback);
                }
            });
        });
        
        // Execute unique callbacks
        triggeredCallbacks.forEach(callback => callback());
    }
    
    /**
     * Check if a file path matches a pattern (which could be a specific file path)
     */
    private matchesPattern(filePath: string, filePattern: string): boolean {
        // Normalize paths for comparison
        const normalizedFilePath = path.normalize(filePath);
        const normalizedPattern = path.normalize(filePattern);
        
        // Direct match
        if (normalizedFilePath === normalizedPattern) {
            return true;
        }
        
        // Check if pattern is a glob pattern and file matches
        // For now, we're using exact matches for specific files
        return false;
    }
    
    /**
     * Watch specific files for changes
     */
    public watchFiles(filePaths: string[], onChange: () => void): vscode.Disposable {
        const disposables: vscode.Disposable[] = [];
        const debouncedOnChange = debounce(onChange, 500);
        
        filePaths.forEach(filePath => {
            // Determine which pattern this file matches
            const extension = path.extname(filePath);
            let pattern = `**/*${extension}`;
            
            // Ensure watcher exists for this pattern
            if (!this.watchers.has(pattern)) {
                // Use a more general pattern if specific one doesn't exist
                pattern = '**/*';
                if (!this.watchers.has(pattern)) {
                    this.createWatcher(pattern);
                }
            }
            
            // Add callback for this specific file
            const callbackEntry: WatcherCallback = {
                pattern: filePath,
                callback: debouncedOnChange
            };
            
            const callbackSet = this.callbacks.get(pattern);
            if (callbackSet) {
                callbackSet.add(callbackEntry);
                
                // Create disposable to remove callback
                disposables.push(new vscode.Disposable(() => {
                    callbackSet.delete(callbackEntry);
                }));
            }
        });
        
        // Return a disposable that cleans up all callbacks
        return new vscode.Disposable(() => {
            disposables.forEach(d => d.dispose());
        });
    }
    
    /**
     * Watch files based on a source map
     */
    public watchSourceMap(
        mapFilePath: string,
        generatedFilePath: string | undefined,
        sourceFilePaths: string[],
        onChange: () => void
    ): vscode.Disposable {
        const filesToWatch: string[] = [mapFilePath];
        
        if (generatedFilePath) {
            filesToWatch.push(generatedFilePath);
        }
        
        filesToWatch.push(...sourceFilePaths);
        
        // Remove duplicates
        const uniqueFiles = [...new Set(filesToWatch)];
        
        return this.watchFiles(uniqueFiles, onChange);
    }
    
    /**
     * Get statistics about the watchers
     */
    public getStats(): { watcherCount: number; callbackCount: number } {
        let callbackCount = 0;
        this.callbacks.forEach(set => {
            callbackCount += set.size;
        });
        
        return {
            watcherCount: this.watchers.size,
            callbackCount
        };
    }
    
    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.watchers.clear();
        this.callbacks.clear();
        WorkspaceFileWatcher.instance = undefined;
    }
}