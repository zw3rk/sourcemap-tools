/**
 * Constants used throughout the extension
 */

// Extension identifiers
export const EXTENSION_ID = 'sourcemap-visualizer';

// View types for custom editors
export const VIEW_TYPES = {
    MAP_EDITOR: 'src-map-viz.mapEditor',
    DESC_EDITOR: 'src-map-viz.descEditor',
    SOURCE_MAP_VISUALIZER: 'sourcemapVisualizer'
} as const;

// Command identifiers
export const COMMANDS = {
    VISUALIZE_SOURCEMAP: 'sourcemap-visualizer.view',
    EDIT_DESCRIPTION: 'sourcemap-visualizer.editDescription',
    TOGGLE_EDITOR: 'sourcemap-visualizer.toggleEditor',
    OPEN_IN_TEXT_EDITOR: 'workbench.action.reopenTextEditor'
} as const;

// Configuration keys
export const CONFIG_KEYS = {
    AUTO_RELOAD: 'sourcemap-visualizer.autoReload',
    DEBOUNCE_TIME: 'sourcemap-visualizer.debounceTime',
    CACHE_SIZE: 'sourcemap-visualizer.cacheSize'
} as const;

// File extensions
export const FILE_EXTENSIONS = {
    SOURCE_MAP: '.map',
    DESCRIPTION: '.desc',
    JAVASCRIPT: '.js',
    TYPESCRIPT: '.ts',
    UWU: '.uwu',
    UPLC: '.uplc'
} as const;

// File patterns for watchers
export const FILE_PATTERNS = {
    SOURCE_MAPS: '**/*.map',
    DESCRIPTIONS: '**/*.desc',
    JAVASCRIPT: '**/*.js',
    TYPESCRIPT: '**/*.ts',
    UWU: '**/*.uwu',
    UPLC: '**/*.uplc',
    ALL: '**/*'
} as const;

// Webview message commands
export const WEBVIEW_COMMANDS = {
    // Common
    READY: 'ready',
    ERROR: 'error',
    LOG: 'log',
    
    // Viewer specific
    LOAD_SOURCEMAP: 'loadSourcemap',
    FILE_CONTENT: 'fileContent',
    LOAD_FILE: 'loadFile',
    EXPORT: 'export',
    OPEN_FILE: 'openFile',
    OPEN_IN_TEXT_EDITOR: 'openInTextEditor',
    
    // Desc editor specific
    INIT: 'init',
    UPDATE: 'update',
    ADD_MAPPING: 'addMapping',
    UPDATE_MAPPING: 'updateMapping',
    REMOVE_MAPPING: 'removeMapping',
    UPDATE_MAPPINGS: 'updateMappings',
    SOURCE_EDIT: 'sourceEdit',
    TOGGLE_DEBUG: 'toggleDebug',
    EXPORT_TO_SOURCEMAP: 'exportToSourceMap',
    GENERATE_DEFAULT_MAPPINGS: 'generateDefaultMappings'
} as const;

// Desc editor message types (using 'type' instead of 'command')
export const DESC_MESSAGE_TYPES = {
    READY: 'ready',
    ERROR: 'error',
    LOG: 'log',
    UPDATE: 'update',
    ADD_MAPPING: 'addMapping',
    UPDATE_MAPPING: 'updateMapping',
    REMOVE_MAPPING: 'removeMapping',
    UPDATE_MAPPINGS: 'updateMappings',
    SOURCE_EDIT: 'sourceEdit',
    EXPORT_TO_SOURCEMAP: 'exportToSourceMap',
    GENERATE_DEFAULT_MAPPINGS: 'generateDefaultMappings'
} as const;

// Default values
export const DEFAULTS = {
    DEBOUNCE_TIME: 300,
    FILE_WATCHER_DEBOUNCE: 500,
    CACHE_SIZE: 100,
    AUTO_RELOAD: true
} as const;

// Semantic types for mappings
export const SEMANTIC_TYPES = {
    UNKNOWN: 'UNKNOWN',
    IDENTIFIER: 'IDENTIFIER',
    LITERAL: 'LITERAL',
    KEYWORD: 'KEYWORD',
    OPERATOR: 'OPERATOR',
    COMMENT: 'COMMENT',
    PUNCTUATION: 'PUNCTUATION'
} as const;

// Colors for mapping visualization
export const MAPPING_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#48DBFB', '#0ABDE3', '#006BA6', '#FFA502', '#12CBC4',
    '#A29BFE', '#6C5CE7', '#FD79A8', '#636E72', '#F8B500',
    '#6C5B7B'
] as const;