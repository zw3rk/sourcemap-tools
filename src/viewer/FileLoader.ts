import * as vscode from 'vscode';

export interface FileContent {
    path: string;
    content: string;
    exists: boolean;
    error?: string;
}

export class FileLoader {
    private cache: Map<string, FileContent> = new Map();
    
    /**
     * Load a file's content
     */
    public async loadFile(filePath: string): Promise<FileContent> {
        // Check cache first
        const cached = this.cache.get(filePath);
        if (cached) {
            return cached;
        }
        
        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(content);
            
            const fileContent: FileContent = {
                path: filePath,
                content: text,
                exists: true
            };
            
            this.cache.set(filePath, fileContent);
            return fileContent;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const fileContent: FileContent = {
                path: filePath,
                content: '',
                exists: false,
                error: `Failed to load file: ${errorMessage}`
            };
            
            // Cache failed attempts too to avoid repeated failures
            this.cache.set(filePath, fileContent);
            return fileContent;
        }
    }
    
    /**
     * Load multiple files in parallel
     */
    public async loadFiles(filePaths: string[]): Promise<FileContent[]> {
        const promises = filePaths.map(path => this.loadFile(path));
        return Promise.all(promises);
    }
    
    /**
     * Try to load content from embedded sourcesContent or from file system
     */
    public async loadSourceContent(
        sourcePath: string,
        embeddedContent: string | null | undefined
    ): Promise<FileContent> {
        // If content is embedded in the source map, use it
        if (embeddedContent !== null && embeddedContent !== undefined && embeddedContent !== '') {
            const fileContent: FileContent = {
                path: sourcePath,
                content: embeddedContent,
                exists: true
            };
            this.cache.set(sourcePath, fileContent);
            return fileContent;
        }
        
        // Otherwise, try to load from file system
        return this.loadFile(sourcePath);
    }
    
    /**
     * Clear the cache for a specific file or all files
     */
    public clearCache(filePath?: string): void {
        if (filePath) {
            this.cache.delete(filePath);
        } else {
            this.cache.clear();
        }
    }
    
    /**
     * Get file statistics for performance monitoring
     */
    public getStats(): { totalCached: number; totalSize: number } {
        let totalSize = 0;
        
        for (const content of this.cache.values()) {
            totalSize += content.content.length;
        }
        
        return {
            totalCached: this.cache.size,
            totalSize
        };
    }
    
    /**
     * Check if a file exists without loading its content
     */
    public async fileExists(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(filePath);
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.File;
        } catch {
            return false;
        }
    }
}