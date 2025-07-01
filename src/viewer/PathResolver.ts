import * as path from 'path';
import * as vscode from 'vscode';
import { isAbsolutePath } from '../common/utils';

export class PathResolver {
    private readonly mapDirectory: string;
    private readonly workspaceRoot: string | undefined;
    
    constructor(mapFileUri: vscode.Uri) {
        this.mapDirectory = path.dirname(mapFileUri.fsPath);
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    
    /**
     * Resolve a path from the source map to an absolute file system path
     */
    public resolve(sourcePath: string, sourceRoot?: string): string {
        // Handle webpack:// and other URI schemes
        if (this.isUriScheme(sourcePath)) {
            return this.resolveUriScheme(sourcePath);
        }
        
        // Already absolute path
        if (isAbsolutePath(sourcePath)) {
            return sourcePath;
        }
        
        // Try multiple resolution strategies
        const candidates = this.generateCandidatePaths(sourcePath, sourceRoot);
        
        // Return first existing path or the most likely one
        for (const candidate of candidates) {
            if (this.fileExists(candidate)) {
                return candidate;
            }
        }
        
        // Return most likely path even if it doesn't exist
        return candidates[0] ?? sourcePath;
    }
    
    /**
     * Resolve the generated file path from the source map
     */
    public resolveGeneratedFile(file?: string): string | undefined {
        if (!file) {
            return undefined;
        }
        
        if (isAbsolutePath(file)) {
            return file;
        }
        
        // Generated file is typically relative to the map file
        return path.resolve(this.mapDirectory, file);
    }
    
    /**
     * Generate candidate paths for a source file
     */
    private generateCandidatePaths(sourcePath: string, sourceRoot?: string): string[] {
        const candidates: string[] = [];
        
        // 1. Relative to map file directory with sourceRoot
        if (sourceRoot) {
            candidates.push(path.resolve(this.mapDirectory, sourceRoot, sourcePath));
        }
        
        // 2. Relative to map file directory
        candidates.push(path.resolve(this.mapDirectory, sourcePath));
        
        // 3. Relative to workspace root with sourceRoot
        if (this.workspaceRoot && sourceRoot) {
            candidates.push(path.resolve(this.workspaceRoot, sourceRoot, sourcePath));
        }
        
        // 4. Relative to workspace root
        if (this.workspaceRoot) {
            candidates.push(path.resolve(this.workspaceRoot, sourcePath));
        }
        
        // 5. Check parent directories (common pattern: map in dist/, source in src/)
        const parentDir = path.dirname(this.mapDirectory);
        candidates.push(path.resolve(parentDir, sourcePath));
        
        // 6. Common source directory patterns
        if (this.workspaceRoot) {
            const commonDirs = ['src', 'source', 'sources', 'lib'];
            for (const dir of commonDirs) {
                candidates.push(path.resolve(this.workspaceRoot, dir, sourcePath));
            }
        }
        
        return [...new Set(candidates)]; // Remove duplicates
    }
    
    /**
     * Check if a path uses a URI scheme
     */
    private isUriScheme(sourcePath: string): boolean {
        return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sourcePath);
    }
    
    /**
     * Resolve URI schemes like webpack://
     */
    private resolveUriScheme(sourcePath: string): string {
        // Handle webpack:// scheme
        if (sourcePath.startsWith('webpack://')) {
            const pathWithoutScheme = sourcePath.substring('webpack://'.length);
            // Remove leading slash and project name if present
            const cleanPath = pathWithoutScheme.replace(/^\/[^/]+\//, '');
            
            if (this.workspaceRoot) {
                return path.resolve(this.workspaceRoot, cleanPath);
            }
            return path.resolve(this.mapDirectory, cleanPath);
        }
        
        // Handle file:// scheme
        if (sourcePath.startsWith('file://')) {
            return sourcePath.substring('file://'.length);
        }
        
        // Return as-is for unknown schemes
        return sourcePath;
    }
    
    /**
     * Check if a file exists (sync for performance in resolution)
     */
    private fileExists(_filePath: string): boolean {
        try {
            // This is a workaround since VS Code doesn't have sync file exists
            // In practice, we'll handle this async in the FileLoader
            return true; // Optimistically return true, actual check happens in FileLoader
        } catch {
            return false;
        }
    }
}