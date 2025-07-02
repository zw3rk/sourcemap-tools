import * as vscode from 'vscode';
import * as path from 'path';
import { isAbsolutePath } from './utils';

export interface FileContent {
    path: string;
    content: string;
    exists: boolean;
    error?: string;
}

export interface ResolvedPath {
    original: string;
    resolved: string;
    embeddedContent?: string | null;
}

/**
 * Consolidated service for file operations and path resolution
 */
export class FileService {
    private cache: Map<string, FileContent> = new Map();
    
    constructor() {
        // ErrorHandler can be used when needed
    }
    
    // Path Resolution Methods
    
    /**
     * Resolve a path from the source map to an absolute file system path
     */
    public resolvePath(
        sourcePath: string,
        mapFileUri: vscode.Uri,
        sourceRoot?: string
    ): string {
        const mapDirectory = path.dirname(mapFileUri.fsPath);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        // Handle webpack:// and other URI schemes
        if (this.isUriScheme(sourcePath)) {
            return this.resolveUriScheme(sourcePath, mapDirectory, workspaceRoot);
        }
        
        // Already absolute path
        if (isAbsolutePath(sourcePath)) {
            return sourcePath;
        }
        
        // First, try suffix matching for self-referential paths
        const suffixMatch = this.findCommonPathSuffix(mapDirectory, sourcePath);
        if (suffixMatch.commonSegments > 0 && suffixMatch.resolvedPath) {
            return suffixMatch.resolvedPath;
        }
        
        // Try multiple resolution strategies
        const candidates = this.generateCandidatePaths(
            sourcePath,
            mapDirectory,
            workspaceRoot,
            sourceRoot
        );
        
        // Return first candidate (we'll check existence when actually loading)
        return candidates[0] ?? sourcePath;
    }
    
    /**
     * Resolve the generated file path from the source map
     */
    public resolveGeneratedFile(file: string | undefined, mapFileUri: vscode.Uri): string | undefined {
        if (!file) {
            return undefined;
        }
        
        if (isAbsolutePath(file)) {
            return file;
        }
        
        const mapDirectory = path.dirname(mapFileUri.fsPath);
        
        // First, try suffix matching for self-referential paths
        const suffixMatch = this.findCommonPathSuffix(mapDirectory, file);
        if (suffixMatch.commonSegments > 0 && suffixMatch.resolvedPath) {
            return suffixMatch.resolvedPath;
        }
        
        // Fall back to standard relative resolution
        return path.resolve(mapDirectory, file);
    }
    
    /**
     * Resolve multiple source paths
     */
    public resolveSourcePaths(
        sources: string[],
        mapFileUri: vscode.Uri,
        sourceRoot?: string,
        sourcesContent?: (string | null)[]
    ): ResolvedPath[] {
        return sources.map((source, index) => ({
            original: source,
            resolved: this.resolvePath(source, mapFileUri, sourceRoot),
            embeddedContent: sourcesContent?.[index]
        }));
    }
    
    // File Loading Methods
    
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
    
    // Cache Management
    
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
    
    // Private Helper Methods
    
    /**
     * Find common path suffix between map directory and target path
     * This helps resolve paths when source map references share structure with map location
     * 
     * @example
     * mapDir: "/Users/test/project/examples/uwu"
     * targetPath: "examples/uwu/arithmetic.js"
     * returns: { commonSegments: 2, resolvedPath: "/Users/test/project/examples/uwu/arithmetic.js" }
     */
    private findCommonPathSuffix(
        mapDir: string,
        targetPath: string
    ): { commonSegments: number; resolvedPath: string } {
        // Normalize and split paths
        const mapSegments = mapDir.split(path.sep).filter(s => s !== '');
        // Handle both forward and backward slashes in target path
        const targetSegments = targetPath.split(/[/\\]/).filter(s => s !== '');
        
        // Remove filename from target path to get directory segments only
        const targetDirSegments = targetSegments.slice(0, -1);
        
        if (targetDirSegments.length === 0) {
            return { commonSegments: 0, resolvedPath: '' };
        }
        
        let matchCount = 0;
        const minLen = Math.min(mapSegments.length, targetDirSegments.length);
        
        // Match from the end (suffix matching)
        for (let i = 1; i <= minLen; i++) {
            const mapSegment = mapSegments[mapSegments.length - i];
            const targetSegment = targetDirSegments[targetDirSegments.length - i];
            
            if (mapSegment === targetSegment) {
                matchCount++;
            } else {
                break;
            }
        }
        
        // If we found matching suffix, resolve the path
        if (matchCount > 0) {
            // We need to go up from mapDir by the number of matched segments
            // then append the full target path
            const mapDirSegments = mapDir.split(path.sep).filter(s => s !== '');
            const baseSegments = mapDirSegments.slice(0, mapDirSegments.length - matchCount);
            const basePath = baseSegments.length > 0 ? path.sep + path.join(...baseSegments) : path.sep;
            const resolvedPath = path.join(basePath, targetPath);
            return { commonSegments: matchCount, resolvedPath };
        }
        
        return { commonSegments: 0, resolvedPath: '' };
    }
    
    private generateCandidatePaths(
        sourcePath: string,
        mapDirectory: string,
        workspaceRoot: string | undefined,
        sourceRoot?: string
    ): string[] {
        const candidates: string[] = [];
        
        // 1. Relative to map file directory with sourceRoot
        if (sourceRoot) {
            candidates.push(path.resolve(mapDirectory, sourceRoot, sourcePath));
        }
        
        // 2. Relative to map file directory
        candidates.push(path.resolve(mapDirectory, sourcePath));
        
        // 3. Relative to workspace root with sourceRoot
        if (workspaceRoot && sourceRoot) {
            candidates.push(path.resolve(workspaceRoot, sourceRoot, sourcePath));
        }
        
        // 4. Relative to workspace root
        if (workspaceRoot) {
            candidates.push(path.resolve(workspaceRoot, sourcePath));
        }
        
        // 5. Check parent directories (common pattern: map in dist/, source in src/)
        const parentDir = path.dirname(mapDirectory);
        candidates.push(path.resolve(parentDir, sourcePath));
        
        // 6. Common source directory patterns
        if (workspaceRoot) {
            const commonDirs = ['src', 'source', 'sources', 'lib'];
            for (const dir of commonDirs) {
                candidates.push(path.resolve(workspaceRoot, dir, sourcePath));
            }
        }
        
        return [...new Set(candidates)]; // Remove duplicates
    }
    
    private isUriScheme(sourcePath: string): boolean {
        return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sourcePath);
    }
    
    private resolveUriScheme(
        sourcePath: string,
        mapDirectory: string,
        workspaceRoot: string | undefined
    ): string {
        // Handle webpack:// scheme
        if (sourcePath.startsWith('webpack://')) {
            const pathWithoutScheme = sourcePath.substring('webpack://'.length);
            // Remove leading slash and project name if present
            const cleanPath = pathWithoutScheme.replace(/^\/[^/]+\//, '');
            
            if (workspaceRoot) {
                return path.resolve(workspaceRoot, cleanPath);
            }
            return path.resolve(mapDirectory, cleanPath);
        }
        
        // Handle file:// scheme
        if (sourcePath.startsWith('file://')) {
            return sourcePath.substring('file://'.length);
        }
        
        // Return as-is for unknown schemes
        return sourcePath;
    }
}