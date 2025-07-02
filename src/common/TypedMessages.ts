import { ParsedSourceMapData } from './BaseWebviewProvider';
import { DescFile } from '../editor/DescParser';

// Base message interface
interface BaseMessage {
    command: string;
    requestId?: string;
}

// Extension to Webview Messages
export interface LoadSourcemapMessage extends BaseMessage {
    command: 'loadSourcemap';
    sourcemapPath: string;
    payload: ParsedSourceMapData;
}

export interface FileContentMessage extends BaseMessage {
    command: 'fileContent';
    filePath: string;
    content: string;
}

export interface ErrorMessage extends BaseMessage {
    command: 'error';
    error: string;
}

export interface InitDescMessage extends BaseMessage {
    command: 'init';
    descFile: DescFile;
    sourceContent: string;
    outputContent: string;
}

export interface UpdateDescMessage extends BaseMessage {
    command: 'update';
    descFile: DescFile;
    sourceContent: string;
    outputContent: string;
}

// Webview to Extension Messages
export interface ReadyMessage extends BaseMessage {
    command: 'ready';
}

export interface LogMessage extends BaseMessage {
    command: 'log';
    message: string;
    data?: unknown;
}

export interface OpenFileMessage extends BaseMessage {
    command: 'openFile';
    path: string;
    selection?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

export interface OpenInTextEditorMessage extends BaseMessage {
    command: 'openInTextEditor';
}

export interface LoadFileMessage extends BaseMessage {
    command: 'loadFile';
    filePath: string;
}

export interface ExportMessage extends BaseMessage {
    command: 'export';
    payload: {
        format: 'svg' | 'png';
        content: string;
        filename?: string;
    };
}

// Desc Editor specific messages
export interface AddMappingMessage extends BaseMessage {
    command: 'addMapping';
    mapping: {
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    };
}

export interface UpdateMappingMessage extends BaseMessage {
    command: 'updateMapping';
    index: number;
    mapping: {
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    };
}

export interface RemoveMappingMessage extends BaseMessage {
    command: 'removeMapping';
    index: number;
}

export interface UpdateMappingsMessage extends BaseMessage {
    command: 'updateMappings';
    mappings: Array<{
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    }>;
}

export interface SourceEditMessage extends BaseMessage {
    command: 'sourceEdit';
    action: 'set-input' | 'set-output' | 'toggle-output' | 'set-semantic-type';
    path?: string;
    descriptor?: string;
    line?: number;
    value?: string;
}

export interface ToggleDebugMessage extends BaseMessage {
    command: 'toggleDebug';
}

export interface ExportToSourceMapMessage extends BaseMessage {
    command: 'exportToSourceMap';
}

export interface GenerateDefaultMappingsMessage extends BaseMessage {
    command: 'generateDefaultMappings';
}

// Union types for type safety
export type ExtensionToWebviewMessage = 
    | LoadSourcemapMessage
    | FileContentMessage
    | ErrorMessage
    | InitDescMessage
    | UpdateDescMessage;

export type WebviewToExtensionMessage = 
    | ReadyMessage
    | LogMessage
    | OpenFileMessage
    | OpenInTextEditorMessage
    | LoadFileMessage
    | ExportMessage
    | AddMappingMessage
    | UpdateMappingMessage
    | RemoveMappingMessage
    | UpdateMappingsMessage
    | SourceEditMessage
    | ToggleDebugMessage
    | ExportToSourceMapMessage
    | GenerateDefaultMappingsMessage;

export type WebviewMessage = ExtensionToWebviewMessage | WebviewToExtensionMessage;

// Type guards
export function isExtensionToWebviewMessage(msg: WebviewMessage): msg is ExtensionToWebviewMessage {
    return ['loadSourcemap', 'fileContent', 'error', 'init', 'update'].includes(msg.command);
}

export function isWebviewToExtensionMessage(msg: WebviewMessage): msg is WebviewToExtensionMessage {
    return !isExtensionToWebviewMessage(msg);
}