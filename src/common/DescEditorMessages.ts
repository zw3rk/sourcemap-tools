import { DescFile } from '../editor/DescParser';

// Source Map V3 interface
export interface SourceMapV3 {
    version: number;
    file: string;
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: (string | null)[];
    names: string[];
    mappings: string;
}

// Base message interface for Desc Editor
interface BaseDescMessage {
    type: string;
}

// Extension to Webview Messages
export interface UpdateDescMessage extends BaseDescMessage {
    type: 'update';
    desc: DescFile;
    sourceContent: string;
    outputContent: string;
    documentUri: string;
}

export interface ErrorDescMessage extends BaseDescMessage {
    type: 'error';
    message: string;
}

// Webview to Extension Messages
export interface ReadyDescMessage extends BaseDescMessage {
    type: 'ready';
}

export interface LogDescMessage extends BaseDescMessage {
    type: 'log';
    message: string;
    data?: unknown;
}

export interface AddMappingDescMessage extends BaseDescMessage {
    type: 'addMapping';
    mapping: {
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    };
}

export interface UpdateMappingDescMessage extends BaseDescMessage {
    type: 'updateMapping';
    index: number;
    mapping: {
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    };
}

export interface RemoveMappingDescMessage extends BaseDescMessage {
    type: 'removeMapping';
    index: number;
}

export interface UpdateMappingsDescMessage extends BaseDescMessage {
    type: 'updateMappings';
    mappings: Array<{
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    }>;
}

export interface SourceEditDescMessage extends BaseDescMessage {
    type: 'sourceEdit';
    action: 'set-input' | 'set-output' | 'toggle-output' | 'set-semantic-type';
    path?: string;
    descriptor?: string;
    line?: number;
    value?: string;
}

export interface ExportToSourceMapDescMessage extends BaseDescMessage {
    type: 'exportToSourceMap';
}

export interface GenerateDefaultMappingsDescMessage extends BaseDescMessage {
    type: 'generateDefaultMappings';
}

export interface OpenInTextEditorDescMessage extends BaseDescMessage {
    type: 'openInTextEditor';
}

// Union types for type safety
export type ExtensionToWebviewDescMessage = 
    | UpdateDescMessage
    | ErrorDescMessage;

export type WebviewToExtensionDescMessage = 
    | ReadyDescMessage
    | LogDescMessage
    | AddMappingDescMessage
    | UpdateMappingDescMessage
    | RemoveMappingDescMessage
    | UpdateMappingsDescMessage
    | SourceEditDescMessage
    | ExportToSourceMapDescMessage
    | GenerateDefaultMappingsDescMessage
    | OpenInTextEditorDescMessage;

export type DescWebviewMessage = ExtensionToWebviewDescMessage | WebviewToExtensionDescMessage;