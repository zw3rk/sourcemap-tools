// Type-safe message protocol for communication between extension and webview

export interface MessageProtocol {
    command: string;
    requestId?: string;
    
    // For loadSourcemap command
    sourcemapPath?: string;
    sourcemapContent?: string;
    
    // For file operations
    filePath?: string;
    content?: string;
    
    // For errors
    error?: string;
    
    // For mappings
    mappings?: MappingData[];
    
    // Generic payload for future extensions
    payload?: unknown;
}

export interface MappingData {
    generated: Position;
    original: Position;
    source: string;
    name?: string;
}

export interface Position {
    line: number;
    column: number;
}

export interface ParsedSourceMap {
    version: number;
    sources: string[];
    sourcesContent?: (string | null)[];
    mappings: MappingData[];
    file?: string;
    sourceRoot?: string;
}