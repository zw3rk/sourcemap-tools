import {
    AppState,
    StateAction,
    stateReducer,
    createInitialState,
    CharRange,
    Mapping
} from './state';
import { Renderer } from './renderer';

const vscode = acquireVsCodeApi();

export class StateBasedDescEditor {
    private state: AppState;
    private renderer: Renderer;
    private container: HTMLElement;
    private dragState: {
        isDragging: boolean;
        startType: 'source' | 'generated' | null;
        startLine: number;
        startCol: number;
        livePath: SVGPathElement | null;
    } = {
        isDragging: false,
        startType: null,
        startLine: 0,
        startCol: 0,
        livePath: null
    };

    constructor() {
        this.state = createInitialState();
        this.renderer = new Renderer();
        this.container = document.getElementById('app')!;

        this.initializeUI();
        this.setupEventListeners();

        // Signal ready
        vscode.postMessage({ type: 'ready' });
    }

    private dispatch(action: StateAction): void {
        const oldState = this.state;
        this.state = stateReducer(this.state, action);

        // Only re-render if state changed
        if (oldState !== this.state) {
            this.render();
        }
    }

    private render(): void {
        this.renderer.render(this.state, this.container);
        this.attachDynamicEventHandlers();
    }

    private initializeUI(): void {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="desc-editor">
                <div class="header-editor">
                    <div class="header-field">
                        <label for="output-field">OUTPUT:</label>
                        <input type="text" id="output-field" class="header-input" placeholder="generated.js">
                        <button class="browse-button" id="browse-output">
                            <i class="codicon codicon-folder-opened"></i>
                        </button>
                    </div>
                    <div class="header-field">
                        <label for="input-field">INPUT:</label>
                        <input type="text" id="input-field" class="header-input" placeholder="source.js (comma-separated for multiple)" title="Enter one or more source files, separated by commas">
                        <button class="browse-button" id="browse-input" title="Browse for input file">
                            <i class="codicon codicon-folder-opened"></i>
                        </button>
                    </div>
                </div>
                <div class="toolbar">
                    <button class="toolbar-button" id="export">
                        <i class="codicon codicon-export"></i>
                        Export to .map
                    </button>
                    <div class="toolbar-spacer"></div>
                    <div class="save-status" id="save-status">
                        <span class="save-indicator"></span>
                    </div>
                    <div class="edit-status" id="edit-status">
                        <span class="status-text">Select characters to create a mapping (Cmd+Click)</span>
                    </div>
                </div>
                <div class="editor-main">
                    <div class="code-panel generated-panel">
                        <div class="panel-header">
                            <h3>Generated File</h3>
                            <span class="filename" id="generated-filename"></span>
                        </div>
                        <div class="code-container soft-wrap" id="generated-container">
                            <div class="no-content" id="generated-placeholder">No generated content yet. Set the OUTPUT field above.</div>
                        </div>
                    </div>
                    <div class="svg-container" id="svg-container">
                        <svg width="100%" height="100%"></svg>
                    </div>
                    <div class="code-panel source-panel">
                        <div class="panel-header">
                            <h3>Source File</h3>
                            <span class="filename" id="source-filename"></span>
                        </div>
                        <div class="code-container soft-wrap" id="source-container">
                            <div class="no-content" id="source-placeholder">No source file selected. Set the INPUT field above.</div>
                        </div>
                    </div>
                </div>
                <div class="mappings-panel">
                    <div class="panel-header">
                        <h3>Mappings</h3>
                        <div class="mappings-controls">
                            <button class="icon-button" id="show-all-mappings" title="Show all mappings" aria-label="Show all mappings">
                                <i class="codicon codicon-eye"></i>
                                <span class="fallback-text">◉</span>
                            </button>
                            <button class="icon-button" id="hide-all-mappings" title="Hide all mappings" aria-label="Hide all mappings">
                                <i class="codicon codicon-eye-closed"></i>
                                <span class="fallback-text">◎</span>
                            </button>
                            <span class="mapping-count" id="mapping-count">0 mappings</span>
                        </div>
                    </div>
                    <div class="mappings-list" id="mappings-container"></div>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        // Header field handlers
        const inputField = document.getElementById('input-field') as HTMLInputElement;
        const outputField = document.getElementById('output-field') as HTMLInputElement;

        inputField?.addEventListener('change', () => {
            // Parse comma-separated values
            const inputs = inputField.value.split(',').map(s => s.trim()).filter(s => s);
            vscode.postMessage({
                type: 'updateInput',
                value: inputs
            });
        });

        outputField?.addEventListener('change', () => {
            vscode.postMessage({
                type: 'updateOutput',
                value: outputField.value
            });
        });

        document.getElementById('browse-input')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'browseInput' });
        });

        document.getElementById('browse-output')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'browseOutput' });
        });

        // Toolbar buttons
        document.getElementById('export')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'exportToSourceMap' });
        });

        // Show/Hide all mapping buttons
        document.getElementById('show-all-mappings')?.addEventListener('click', () => {
            this.dispatch({ type: 'SHOW_ALL_MAPPINGS' });
            this.syncAllMappings();
        });

        document.getElementById('hide-all-mappings')?.addEventListener('click', () => {
            this.dispatch({ type: 'HIDE_ALL_MAPPINGS' });
            this.syncAllMappings();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.dispatch({ type: 'STOP_EDITING' });
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && e.metaKey) {
                // Cmd+Delete for no-source mappings
                if (this.state.generatedSelection.length > 0) {
                    this.createNoSourceMappings();
                }
            }
        });

        // Window message listener
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'update':
                    this.dispatch({
                        type: 'SET_DESC_FILE',
                        payload: {
                            descFile: message.desc,
                            sourceContent: message.sourceContent,
                            outputContent: message.outputContent || ''
                        }
                    });
                    break;
                case 'error':
                    console.error(message.message);
                    break;
                case 'inputSelected':
                    const inputField = document.getElementById('input-field') as HTMLInputElement;
                    if (inputField) {
                        // Append to existing inputs if any, otherwise set as first input
                        const currentInputs = inputField.value.split(',').map(s => s.trim()).filter(s => s);
                        if (currentInputs.length === 0 || (currentInputs.length === 1 && currentInputs[0] === '')) {
                            inputField.value = message.path;
                        } else {
                            inputField.value = currentInputs.join(', ') + ', ' + message.path;
                        }
                        inputField.dispatchEvent(new Event('change'));
                    }
                    break;
                case 'outputSelected':
                    const outputField = document.getElementById('output-field') as HTMLInputElement;
                    if (outputField) {
                        outputField.value = message.path;
                        outputField.dispatchEvent(new Event('change'));
                    }
                    break;
                case 'saved':
                    this.showSaveStatus();
                    break;
            }
        });

        // Handle window resize and scroll
        window.addEventListener('resize', () => this.render());

        const handleScroll = () => {
            requestAnimationFrame(() => this.render());
        };

        document.getElementById('source-container')?.addEventListener('scroll', handleScroll);
        document.getElementById('generated-container')?.addEventListener('scroll', handleScroll);

        // Global mouse handlers for drag-to-connect
        document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleGlobalMouseUp(e));
    }

    private attachDynamicEventHandlers(): void {
        // Character click handlers
        document.querySelectorAll('.char').forEach(el => {
            el.addEventListener('click', (e) => this.handleCharClick(e as MouseEvent));
            el.addEventListener('mousedown', (e) => this.handleCharMouseDown(e as MouseEvent));
            el.addEventListener('contextmenu', (e) => this.handleContextMenu(e as MouseEvent));
        });

        // Mapping list handlers - handle clicks on mapping headers
        document.querySelectorAll('.mapping-header').forEach(el => {
            el.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const mappingEl = target.closest('.mapping-group') as HTMLElement;
                const mappingId = mappingEl?.dataset.mappingId;

                // Check if we clicked on interactive elements first
                if (target.closest('.visibility-toggle') ||
                    target.closest('.mapping-delete') ||
                    target.closest('.expand-toggle') ||
                    target.closest('.semantic-type-input')) {
                    // Don't handle selection for these elements
                    return;
                }

                // Toggle selection
                if (mappingId) {
                    const newId = this.state.selectedMappingId === mappingId ? null : mappingId;
                    vscode.postMessage({
                        type: 'log',
                        message: `Mapping selection toggled: ${mappingId} -> ${newId}`
                    });
                    this.dispatch({
                        type: 'SELECT_MAPPING',
                        payload: { mappingId: newId }
                    });
                }
            });
        });

        // Separate handlers for interactive elements to prevent bubbling issues
        document.querySelectorAll('.visibility-toggle').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const mappingId = (el as HTMLElement).dataset.mappingId;
                if (mappingId) {
                    this.dispatch({
                        type: 'TOGGLE_MAPPING_VISIBILITY',
                        payload: { mappingId }
                    });
                    // Sync after visibility change
                    this.syncAllMappings();
                }
            });
        });

        document.querySelectorAll('.mapping-delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const mappingId = (el as HTMLElement).dataset.mappingId;
                if (mappingId) {
                    this.dispatch({
                        type: 'DELETE_MAPPING',
                        payload: { mappingId }
                    });
                    this.syncAllMappings();
                }
            });
        });

        // Expand/collapse handlers
        document.querySelectorAll('.expand-toggle').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const mappingId = (el as HTMLElement).dataset.mappingId;
                if (mappingId) {
                    this.dispatch({
                        type: 'TOGGLE_MAPPING_EXPANDED',
                        payload: { mappingId }
                    });
                }
            });
        });

        // Span semantic type input handlers
        document.querySelectorAll('.span-semantic-type').forEach(el => {
            const input = el as HTMLInputElement;
            let updateTimeout: any;

            input.addEventListener('input', () => {
                const mappingId = input.dataset.mappingId;
                const segmentId = input.dataset.segmentId;
                const spanIndex = parseInt(input.dataset.spanIndex || '0');

                if (mappingId && segmentId) {
                    clearTimeout(updateTimeout);

                    updateTimeout = setTimeout(() => {
                        this.dispatch({
                            type: 'UPDATE_PAIR_SEMANTIC_TYPE',
                            payload: {
                                mappingId,
                                segmentId,
                                pairIndex: spanIndex,
                                semanticType: input.value
                            }
                        });
                        this.syncAllMappings();

                        // Visual feedback
                        input.style.borderColor = 'var(--vscode-notificationsInfoIcon-foreground)';
                        setTimeout(() => {
                            input.style.borderColor = '';
                        }, 1000);
                    }, 500);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                }
            });
        });

        // Span delete button handlers
        document.querySelectorAll('.span-delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({
                    type: 'log',
                    message: 'Span delete button clicked'
                });

                const btn = el as HTMLElement;
                const spanEl = btn.closest('.span-item') as HTMLElement;
                if (spanEl) {
                    const mappingId = spanEl.dataset.mappingId;
                    const segmentId = spanEl.dataset.segmentId;
                    const spanIndex = parseInt(spanEl.dataset.spanIndex || '0');

                    vscode.postMessage({
                        type: 'log',
                        message: `Span delete: mappingId=${mappingId}, segmentId=${segmentId}, spanIndex=${spanIndex}`
                    });

                    if (mappingId && segmentId) {
                        this.dispatch({
                            type: 'DELETE_PAIR',
                            payload: { mappingId, segmentId, pairIndex: spanIndex }
                        });
                        this.syncAllMappings();
                    } else {
                        vscode.postMessage({
                            type: 'log',
                            message: 'Missing mappingId or segmentId for span delete'
                        });
                    }
                } else {
                    vscode.postMessage({
                        type: 'log',
                        message: 'Could not find span-item parent'
                    });
                }
            });
        });

        // Context menu for mapping headers
        document.querySelectorAll('.mapping-header').forEach(el => {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const mappingEl = el.closest('.mapping-group') as HTMLElement;
                const mappingId = mappingEl?.dataset.mappingId;

                if (mappingId) {
                    const mouseEvent = e as MouseEvent;
                    this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, [
                        {
                            label: 'Delete Entire Mapping',
                            icon: 'codicon-trash',
                            action: () => {
                                this.dispatch({
                                    type: 'DELETE_MAPPING',
                                    payload: { mappingId }
                                });
                                this.syncAllMappings();
                            }
                        }
                    ]);
                }
            });
        });

        // Context menu for spans
        document.querySelectorAll('.span-item').forEach(el => {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const spanEl = el as HTMLElement;
                const mappingId = spanEl.dataset.mappingId;
                const segmentId = spanEl.dataset.segmentId;
                const spanIndex = parseInt(spanEl.dataset.spanIndex || '0');

                vscode.postMessage({
                    type: 'log',
                    message: `Span context menu: mappingId=${mappingId}, segmentId=${segmentId}, spanIndex=${spanIndex}`
                });

                if (mappingId && segmentId) {
                    const mouseEvent = e as MouseEvent;
                    this.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, [
                        {
                            label: 'Delete This Span',
                            icon: 'codicon-close',
                            action: () => {
                                vscode.postMessage({
                                    type: 'log',
                                    message: `Deleting span: mappingId=${mappingId}, segmentId=${segmentId}, spanIndex=${spanIndex}`
                                });
                                this.dispatch({
                                    type: 'DELETE_PAIR',
                                    payload: { mappingId, segmentId, pairIndex: spanIndex }
                                });
                                this.syncAllMappings();
                            }
                        }
                    ]);
                } else {
                    vscode.postMessage({
                        type: 'log',
                        message: 'Missing mappingId or segmentId for span context menu'
                    });
                }
            });
        });

        // Drag selection
        this.setupDragSelection();
    }

    private setupDragSelection(): void {
        let isDragging = false;
        let dragType: 'source' | 'generated' | null = null;
        let dragStart: { line: number, col: number } | null = null;

        document.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('char') && !e.metaKey && !e.ctrlKey) {
                isDragging = true;
                dragType = target.closest('.generated-panel') ? 'generated' :
                          target.closest('.source-panel') ? 'source' : null;

                if (dragType) {
                    const line = parseInt(target.dataset.line || '0');
                    const col = parseInt(target.dataset.col || '0');
                    dragStart = { line, col };

                    // Clear selection for drag type
                    if (dragType === 'generated') {
                        this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: [] });
                        if (this.state.editingMode === 'none') {
                            this.dispatch({ type: 'START_EDITING', payload: { mode: 'selecting-generated' } });
                        }
                    } else if (this.state.editingMode === 'selecting-source') {
                        this.dispatch({ type: 'SET_SOURCE_SELECTION', payload: [] });
                    }

                    e.preventDefault();
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && dragStart && dragType) {
                const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
                if (target && target.classList.contains('char')) {
                    const panel = dragType === 'generated' ? '.generated-panel' : '.source-panel';
                    if (target.closest(panel)) {
                        const endLine = parseInt(target.dataset.line || '0');
                        const endCol = parseInt(target.dataset.col || '0');

                        // Create selection range
                        const selection: CharRange[] = [];
                        if (dragStart.line === endLine) {
                            selection.push({
                                line: dragStart.line,
                                startCol: Math.min(dragStart.col, endCol),
                                endCol: Math.max(dragStart.col, endCol)
                            });
                        }

                        if (dragType === 'generated') {
                            this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: selection });
                        } else {
                            this.dispatch({ type: 'SET_SOURCE_SELECTION', payload: selection });
                        }
                    }
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;

                // Auto-advance editing mode
                if (dragType === 'generated' && this.state.generatedSelection.length > 0) {
                    this.dispatch({ type: 'START_EDITING', payload: { mode: 'selecting-source' } });
                } else if (dragType === 'source' &&
                          this.state.sourceSelection.length > 0 &&
                          this.state.generatedSelection.length > 0) {
                    this.dispatch({ type: 'CREATE_MAPPING_FROM_STAGED' });
                    this.sendMappingToBackend();
                }

                dragType = null;
                dragStart = null;
            }
        });
    }

    private handleCharClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('char')) return;

        const line = parseInt(target.dataset.line || '0');
        const col = parseInt(target.dataset.col || '0');
        const type = target.closest('.generated-panel') ? 'generated' : 'source';

        vscode.postMessage({
            type: 'log',
            message: `handleCharClick: line=${line}, col=${col}, type=${type}, metaKey=${e.metaKey}, selectedMapping=${this.state.selectedMappingId}`
        });

        // Regular click or Cmd+Click for creating/editing mappings
        e.preventDefault();

        // Special handling for Cmd+Click when not editing a mapping
        if (e.metaKey && !this.state.selectedMappingId && type === 'generated') {
            // Toggle single character selection for Cmd+Delete
            vscode.postMessage({ type: 'log', message: 'Cmd+Click without selected mapping' });
            this.toggleCharInSelection(line, col, 'generated');
            return;
        }

        if (this.state.selectedMappingId) {
            // Editing existing mapping - only toggle locations when Cmd is held
            if (e.metaKey) {
                vscode.postMessage({ type: 'log', message: 'Cmd+Click with selected mapping - toggling location' });
                this.toggleLocationInMapping(line, col, type);
            } else {
                vscode.postMessage({ type: 'log', message: 'Regular click with selected mapping - ignoring' });
            }
        } else {
            // Creating new mapping
            if (type === 'generated') {
                if (this.state.editingMode === 'none' || this.state.editingMode === 'selecting-source') {
                    this.dispatch({ type: 'START_EDITING', payload: { mode: 'selecting-generated' } });
                }
                this.toggleCharInSelection(line, col, 'generated');

                if (this.state.generatedSelection.length > 0) {
                    this.dispatch({ type: 'START_EDITING', payload: { mode: 'selecting-source' } });
                }
            } else if (type === 'source' && this.state.editingMode === 'selecting-source') {
                this.toggleCharInSelection(line, col, 'source');

                if (this.state.sourceSelection.length > 0 && this.state.generatedSelection.length > 0) {
                    this.dispatch({ type: 'CREATE_MAPPING_FROM_STAGED' });
                    this.sendMappingToBackend();
                }
            }
        }
    }

    private toggleCharInSelection(line: number, col: number, type: 'generated' | 'source'): void {
        const selection = type === 'generated' ?
            [...this.state.generatedSelection] :
            [...this.state.sourceSelection];

        // Check if char is already selected
        let found = false;
        for (let i = 0; i < selection.length; i++) {
            const range = selection[i];
            if (range.line === line && col >= range.startCol && col <= range.endCol) {
                // Remove from selection
                if (range.startCol === range.endCol) {
                    selection.splice(i, 1);
                } else if (col === range.startCol) {
                    range.startCol++;
                } else if (col === range.endCol) {
                    range.endCol--;
                } else {
                    // Split range
                    const newRange: CharRange = {
                        line: line,
                        startCol: col + 1,
                        endCol: range.endCol
                    };
                    range.endCol = col - 1;
                    selection.splice(i + 1, 0, newRange);
                }
                found = true;
                break;
            }
        }

        if (!found) {
            // Add new single-character range
            selection.push({ line, startCol: col, endCol: col });
        }

        // Merge adjacent ranges
        this.mergeAdjacentRanges(selection);

        // Update state
        if (type === 'generated') {
            this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: selection });
        } else {
            this.dispatch({ type: 'SET_SOURCE_SELECTION', payload: selection });
        }
    }

    private toggleLocationInMapping(line: number, col: number, type: 'generated' | 'source'): void {
        vscode.postMessage({
            type: 'log',
            message: `toggleLocationInMapping called: line=${line}, col=${col}, type=${type}, selectedMapping=${this.state.selectedMappingId}`
        });

        if (!this.state.selectedMappingId) {
            vscode.postMessage({ type: 'log', message: 'No selected mapping, returning' });
            return;
        }

        const mapping = this.state.mappings.find(m => m.id === this.state.selectedMappingId);
        if (!mapping) {
            vscode.postMessage({ type: 'log', message: 'Selected mapping not found, returning' });
            return;
        }

        // Create a deep copy of the mapping to avoid mutations
        const updatedMapping = JSON.parse(JSON.stringify(mapping));

        // For now, work with first segment (will extend later for multi-segment support)
        if (updatedMapping.segments.length === 0) {
            updatedMapping.segments.push({
                id: this.generateId(),
                generated: [],
                source: [],
                pairs: []
            });
        }

        const segment = updatedMapping.segments[0];

        // Initialize pairs array if it doesn't exist
        if (!segment.pairs) {
            segment.pairs = [];
        }

        if (type === 'generated') {
            // Check if this generated location exists in any pair
            const pairIndex = segment.pairs.findIndex((pair: any) =>
                pair.generated.line === line && pair.generated.column === col
            );

            if (pairIndex >= 0) {
                // Remove all pairs with this generated location
                vscode.postMessage({
                    type: 'log',
                    message: `Removing generated location: ${line}:${col}`,
                    data: { pairsBefore: segment.pairs.length }
                });

                segment.pairs = segment.pairs.filter((pair: any) =>
                    !(pair.generated.line === line && pair.generated.column === col)
                );

                vscode.postMessage({
                    type: 'log',
                    message: `After removal`,
                    data: { pairsAfter: segment.pairs.length }
                });

                // Also remove from generated array
                const genIndex = segment.generated.findIndex((loc: any) =>
                    loc.line === line && loc.column === col
                );
                if (genIndex >= 0) {
                    segment.generated.splice(genIndex, 1);
                }
            } else {
                // Add new generated location
                vscode.postMessage({
                    type: 'log',
                    message: `Adding generated location: ${line}:${col}`
                });
                const newGenLoc = { line, column: col };
                segment.generated.push(newGenLoc);

                // Create pairs with all existing source locations
                if (segment.source.length > 0) {
                    segment.source.forEach((srcLoc: any) => {
                        segment.pairs.push({
                            generated: newGenLoc,
                            source: srcLoc,
                            semanticType: 'UNKNOWN'
                        });
                    });
                } else {
                    // No source - create a no-source pair
                    segment.pairs.push({
                        generated: newGenLoc,
                        source: null,
                        semanticType: 'GENERATED'
                    });
                }
            }
        } else {
            // Source location toggle
            const srcLoc = {
                sourceFile: this.state.descFile?.header.inputs[0] || '',
                line,
                column: col
            };

            // Check if this source location exists in any pair
            const pairIndex = segment.pairs.findIndex((pair: any) =>
                pair.source &&
                pair.source.line === line &&
                pair.source.column === col
            );

            if (pairIndex >= 0) {
                // Remove all pairs with this source location
                segment.pairs = segment.pairs.filter((pair: any) =>
                    !(pair.source && pair.source.line === line && pair.source.column === col)
                );

                // Also remove from source array
                const srcIndex = segment.source.findIndex((loc: any) =>
                    loc.line === line && loc.column === col
                );
                if (srcIndex >= 0) {
                    segment.source.splice(srcIndex, 1);
                }
            } else {
                // Add new source location
                segment.source.push(srcLoc);

                // Create pairs with all existing generated locations
                segment.generated.forEach((genLoc: any) => {
                    // Remove any no-source pairs for this generated location
                    segment.pairs = segment.pairs.filter((pair: any) =>
                        !(pair.generated.line === genLoc.line &&
                          pair.generated.column === genLoc.column &&
                          pair.source === null)
                    );

                    // Add new pair
                    segment.pairs.push({
                        generated: genLoc,
                        source: srcLoc,
                        semanticType: 'UNKNOWN'
                    });
                });
            }
        }

        // Clean up empty segments
        if (segment.pairs.length === 0) {
            const segIndex = updatedMapping.segments.indexOf(segment);
            updatedMapping.segments.splice(segIndex, 1);

            // If no segments left, delete the mapping
            if (updatedMapping.segments.length === 0) {
                this.dispatch({
                    type: 'DELETE_MAPPING',
                    payload: { mappingId: mapping.id }
                });
                this.syncAllMappings();
                return;
            }
        }

        // Update the mapping in state
        this.dispatch({
            type: 'UPDATE_MAPPING',
            payload: {
                mappingId: mapping.id,
                mapping: updatedMapping
            }
        });

        // Sync to backend
        this.syncAllMappings();
    }

    private mergeAdjacentRanges(ranges: CharRange[]): void {
        ranges.sort((a, b) => {
            if (a.line !== b.line) return a.line - b.line;
            return a.startCol - b.startCol;
        });

        for (let i = 0; i < ranges.length - 1; i++) {
            const current = ranges[i];
            const next = ranges[i + 1];

            if (current.line === next.line && current.endCol + 1 >= next.startCol) {
                current.endCol = Math.max(current.endCol, next.endCol);
                ranges.splice(i + 1, 1);
                i--;
            }
        }
    }

    private createNoSourceMappings(): void {
        // Create mappings with no source
        const generatedLocs = this.flattenRangesToLocations(this.state.generatedSelection, 'generated');
        const pairs: any[] = generatedLocs.map(genLoc => ({
            generated: genLoc,
            source: null
        }));

        const mapping: Mapping = {
            id: this.generateId(),
            color: this.getNextColor(),
            isVisible: true,
            segments: [{
                id: this.generateId(),
                generated: generatedLocs,
                source: [],
                pairs: pairs
            }]
        };

        this.state.mappings.push(mapping);
        this.dispatch({ type: 'STOP_EDITING' });
        this.sendMappingToBackend();
    }

    private sendMappingToBackend(): void {
        // Instead of sending individual mappings, sync all mappings
        this.syncAllMappings();
    }

    private syncAllMappings(): void {
        // Convert all mappings to backend format (including invisible ones)
        const backendMappings: any[] = [];

        for (const mapping of this.state.mappings) {
            // Sync all mappings, regardless of visibility
            // This prevents mappings from being lost when toggling visibility

            for (const segment of mapping.segments) {
                if (segment.pairs && segment.pairs.length > 0) {
                    // Use explicit pairs if available
                    segment.pairs.forEach((pair: any) => {
                        if (pair.source) {
                            backendMappings.push({
                                genLine: pair.generated.line,
                                genCol: pair.generated.column,
                                srcLine: pair.source.line,
                                srcCol: pair.source.column,
                                // Use pair-level semantic type if available, fallback to 'UNKNOWN'
                                semanticType: pair.semanticType || 'UNKNOWN'
                            });
                        } else {
                            // No source mapping
                            backendMappings.push({
                                genLine: pair.generated.line,
                                genCol: pair.generated.column,
                                srcLine: 0,
                                srcCol: 0,
                                semanticType: pair.semanticType || 'GENERATED'
                            });
                        }
                    });
                } else {
                    // Fallback to old behavior for segments without pairs
                    // This maintains backward compatibility
                    segment.generated.forEach(genLoc => {
                        if (segment.source.length > 0) {
                            segment.source.forEach(srcLoc => {
                                backendMappings.push({
                                    genLine: genLoc.line,
                                    genCol: genLoc.column,
                                    srcLine: srcLoc.line,
                                    srcCol: srcLoc.column,
                                    semanticType: 'UNKNOWN'
                                });
                            });
                        } else {
                            // No source mapping
                            backendMappings.push({
                                genLine: genLoc.line,
                                genCol: genLoc.column,
                                srcLine: 0,
                                srcCol: 0,
                                semanticType: 'GENERATED'
                            });
                        }
                    });
                }
            }
        }

        // Send full state sync
        vscode.postMessage({
            type: 'syncMappings',
            mappings: backendMappings
        });
    }


    private flattenRangesToLocations(
        ranges: CharRange[],
        type: 'generated' | 'source'
    ): any[] {
        const locations: any[] = [];

        for (const range of ranges) {
            for (let col = range.startCol; col <= range.endCol; col++) {
                if (type === 'generated') {
                    locations.push({ line: range.line, column: col });
                } else {
                    locations.push({
                        sourceFile: this.state.descFile?.header.inputs[0] || '',
                        line: range.line,
                        column: col
                    });
                }
            }
        }

        return locations;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private getNextColor(): string {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#48DBFB', '#0ABDE3', '#006BA6', '#FFA502', '#12CBC4',
            '#A29BFE', '#6C5CE7', '#FD79A8', '#636E72', '#F8B500',
            '#6C5B7B'
        ];
        return colors[this.state.mappings.length % colors.length];
    }

    private handleCharMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return; // Only handle left mouse button

        const target = e.target as HTMLElement;
        if (!target.classList.contains('char')) return;

        // Don't start drag-to-connect if Cmd is held (allow Cmd+Click)
        if (e.metaKey) return;

        const line = parseInt(target.dataset.line || '0');
        const col = parseInt(target.dataset.col || '0');
        const type = target.closest('.generated-panel') ? 'generated' : 'source';

        // Start drag
        this.dragState = {
            isDragging: true,
            startType: type,
            startLine: line,
            startCol: col,
            livePath: null
        };

        // Add dragging class to body
        document.body.classList.add('dragging-mapping');

        e.preventDefault();
    }

    private handleGlobalMouseMove(e: MouseEvent): void {
        if (!this.dragState.isDragging) return;

        // Update live bezier curve
        this.updateLivePath(e);
    }

    private handleGlobalMouseUp(e: MouseEvent): void {
        if (!this.dragState.isDragging) return;

        // Check if we're over a character in the opposite pane
        const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (target && target.classList.contains('char')) {
            const endType = target.closest('.generated-panel') ? 'generated' : 'source';

            // Only create mapping if dropping in opposite pane
            if (endType !== this.dragState.startType) {
                const endLine = parseInt(target.dataset.line || '0');
                const endCol = parseInt(target.dataset.col || '0');

                // Create mapping
                if (this.dragState.startType === 'generated') {
                    this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: [{
                        line: this.dragState.startLine,
                        startCol: this.dragState.startCol,
                        endCol: this.dragState.startCol
                    }] });
                    this.dispatch({ type: 'SET_SOURCE_SELECTION', payload: [{
                        line: endLine,
                        startCol: endCol,
                        endCol: endCol
                    }] });
                } else {
                    this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: [{
                        line: endLine,
                        startCol: endCol,
                        endCol: endCol
                    }] });
                    this.dispatch({ type: 'SET_SOURCE_SELECTION', payload: [{
                        line: this.dragState.startLine,
                        startCol: this.dragState.startCol,
                        endCol: this.dragState.startCol
                    }] });
                }

                // Create the mapping
                this.dispatch({ type: 'CREATE_MAPPING_FROM_STAGED' });
                this.sendMappingToBackend();
            }
        }

        // Clean up
        this.cleanupDrag();
    }

    private updateLivePath(e: MouseEvent): void {
        // Create or get drag overlay
        let dragOverlay = document.querySelector('.drag-overlay') as HTMLElement;
        if (!dragOverlay) {
            dragOverlay = document.createElement('div');
            dragOverlay.className = 'drag-overlay';
            document.body.appendChild(dragOverlay);
        }

        let svg = dragOverlay.querySelector('svg') as SVGElement;
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.pointerEvents = 'none';
            dragOverlay.appendChild(svg);
        }

        // Get start element position
        const startSelector = this.dragState.startType === 'generated'
            ? `#generated-line-${this.dragState.startLine} .char[data-col="${this.dragState.startCol}"]`
            : `#source-line-${this.dragState.startLine} .char[data-col="${this.dragState.startCol}"]`;

        const startEl = document.querySelector(startSelector) as HTMLElement;
        if (!startEl) return;

        const startRect = startEl.getBoundingClientRect();

        // Calculate positions relative to viewport (since overlay is fixed)
        const startX = this.dragState.startType === 'generated'
            ? startRect.right
            : startRect.left;
        const startY = startRect.top + startRect.height / 2;

        const endX = e.clientX;
        const endY = e.clientY;

        console.log('Drag path update:', { startX, startY, endX, endY });

        // Create or update path
        if (!this.dragState.livePath) {
            this.dragState.livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.dragState.livePath.setAttribute('class', 'live-mapping-path');
            this.dragState.livePath.setAttribute('fill', 'none');
            this.dragState.livePath.setAttribute('stroke', this.getNextColor());
            this.dragState.livePath.setAttribute('stroke-width', '1.5');
            this.dragState.livePath.setAttribute('stroke-opacity', '0.8');
            this.dragState.livePath.setAttribute('stroke-dasharray', '5,5');
            this.dragState.livePath.style.pointerEvents = 'none';
            svg.appendChild(this.dragState.livePath);
        }

        // Update path
        const midX = (startX + endX) / 2;
        const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        this.dragState.livePath.setAttribute('d', d);
    }

    private cleanupDrag(): void {
        // Remove live path
        if (this.dragState.livePath) {
            this.dragState.livePath.remove();
        }

        // Remove drag overlay
        const dragOverlay = document.querySelector('.drag-overlay');
        if (dragOverlay) {
            dragOverlay.remove();
        }

        // Reset drag state
        this.dragState = {
            isDragging: false,
            startType: null,
            startLine: 0,
            startCol: 0,
            livePath: null
        };

        // Remove dragging class
        document.body.classList.remove('dragging-mapping');
    }

    private handleContextMenu(e: MouseEvent): void {
        e.preventDefault();
        const target = e.target as HTMLElement;
        if (!target.classList.contains('char')) return;

        const line = parseInt(target.dataset.line || '0');
        const col = parseInt(target.dataset.col || '0');
        const type = target.closest('.generated-panel') ? 'generated' :
                    target.closest('.source-panel') ? 'source' : null;

        if (type === 'generated') {
            this.showContextMenu(e.clientX, e.clientY, [
                {
                    label: 'Map to Nothing',
                    icon: 'codicon-trash',
                    action: () => {
                        this.dispatch({ type: 'SET_GENERATED_SELECTION', payload: [{
                            line, startCol: col, endCol: col
                        }] });
                        this.createNoSourceMappings();
                    }
                }
            ]);
        }
    }

    private showSaveStatus(): void {
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            const indicator = saveStatus.querySelector('.save-indicator');
            if (indicator) {
                indicator.innerHTML = '<i class="codicon codicon-check"></i> Saved';
                saveStatus.classList.add('saved');

                // Remove the saved class after 3 seconds
                setTimeout(() => {
                    saveStatus.classList.remove('saved');
                    indicator.innerHTML = '';
                }, 3000);
            }
        }
    }

    private showContextMenu(x: number, y: number, items: Array<{label: string, icon?: string, action: () => void}>): void {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Add menu items
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';

            if (item.icon) {
                const icon = document.createElement('i');
                icon.className = `codicon ${item.icon}`;
                menuItem.appendChild(icon);
            }

            const label = document.createElement('span');
            label.textContent = item.label;
            menuItem.appendChild(label);

            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });

            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close menu on click outside
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        // Delay adding the listener to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
}