import { AppState, Mapping, MappingSegment, CharRange, CharacterPair } from './state';

export class Renderer {
    private generatedContent: string = '';
    private sourceContent: string = '';

    render(state: AppState, _container: HTMLElement): void {
        // Store content for context extraction
        this.generatedContent = state.outputContent || '';
        this.sourceContent = state.sourceContent || '';
        
        // Update header fields
        this.updateHeaderFields(state);
        
        // Render code panels
        this.renderGeneratedCode(state);
        this.renderSourceCode(state);
        
        // Render mappings list
        this.renderMappingsList(state);
        
        // Update connections
        this.updateConnections(state);
        
        // Update UI state indicators
        this.updateEditStatus(state);
        this.updateToolbarState(state);
    }

    private updateHeaderFields(state: AppState): void {
        const inputField = document.getElementById('input-field') as HTMLInputElement;
        const outputField = document.getElementById('output-field') as HTMLInputElement;
        
        if (inputField && state.descFile) {
            // Display all inputs as comma-separated values
            inputField.value = state.descFile.header.inputs.join(', ') || '';
        }
        if (outputField && state.descFile) {
            outputField.value = state.descFile.header.output || '';
        }
        
        // Update filenames
        const sourceFilename = document.getElementById('source-filename');
        const generatedFilename = document.getElementById('generated-filename');
        if (sourceFilename && state.descFile) {
            // Show first input file or "No file selected" if no inputs
            sourceFilename.textContent = state.descFile.header.inputs[0] || 'No file selected';
        }
        if (generatedFilename && state.descFile) {
            generatedFilename.textContent = state.descFile.header.output || 'No file selected';
        }
    }

    private renderGeneratedCode(state: AppState): void {
        const container = document.getElementById('generated-container');
        if (!container || !state.descFile) return;

        const placeholder = document.getElementById('generated-placeholder');
        
        if (!state.outputContent) {
            if (placeholder) placeholder.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        if (placeholder) placeholder.style.display = 'none';

        // Remove leading/trailing whitespace to avoid empty lines
        const content = state.outputContent.trim();
        const lines = content ? content.split('\n') : [];
        const html = lines.map((line, idx) => {
            const lineNum = idx + 1;
            return `<div class="code-line" data-line="${lineNum}">
                <span class="line-number">${lineNum}</span>
                <span class="line-content" id="generated-line-${lineNum}">
                    ${this.renderLineWithCharacters(line, lineNum, 'generated', state)}
                </span>
            </div>`;
        }).join('');

        container.innerHTML = html;
    }

    private renderSourceCode(state: AppState): void {
        const container = document.getElementById('source-container');
        if (!container) return;

        const placeholder = document.getElementById('source-placeholder');
        
        if (!state.sourceContent) {
            if (placeholder) placeholder.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        if (placeholder) placeholder.style.display = 'none';

        // Remove leading/trailing whitespace to avoid empty lines
        const content = state.sourceContent.trim();
        const lines = content ? content.split('\n') : [];
        const html = lines.map((line, idx) => {
            const lineNum = idx + 1;
            return `<div class="code-line" data-line="${lineNum}">
                <span class="line-number">${lineNum}</span>
                <span class="line-content" id="source-line-${lineNum}">
                    ${this.renderLineWithCharacters(line, lineNum, 'source', state)}
                </span>
            </div>`;
        }).join('');

        container.innerHTML = html;
    }

    private renderLineWithCharacters(
        line: string, 
        lineNum: number, 
        type: 'source' | 'generated',
        state: AppState
    ): string {
        let html = '';
        const selection = type === 'generated' ? state.generatedSelection : state.sourceSelection;
        
        for (let col = 0; col < line.length; col++) {
            const char = line[col];
            const colNum = col + 1;
            
            const mapping = this.findMappingForChar(lineNum, colNum, type, state);
            const isInSelection = this.isCharInSelection(lineNum, colNum, selection);
            const isSelected = mapping && mapping.id === state.selectedMappingId;
            
            let classes = ['char'];
            if (mapping && mapping.isVisible) {
                classes.push('in-mapping');
                if (isSelected) {
                    classes.push('selected-mapping');
                }
            }
            if (isInSelection) {
                classes.push('in-selection');
                
                const range = selection.find(r => 
                    r.line === lineNum && colNum >= r.startCol && colNum <= r.endCol
                );
                if (range) {
                    if (range.startCol === range.endCol) {
                        // Single character
                    } else if (colNum === range.startCol) {
                        classes.push('range-start');
                    } else if (colNum === range.endCol) {
                        classes.push('range-end');
                    } else {
                        classes.push('range-middle');
                    }
                }
            }
            
            let style = '';
            if (mapping && mapping.isVisible) {
                // Use rgba for background opacity to preserve text readability
                const opacity = isSelected ? 0.8 : 0.35;
                const color = this.hexToRgba(mapping.color, opacity);
                style = `style="background-color: ${color};"`;
            }
            
            const mappingId = mapping ? mapping.id : '';
            
            html += `<span class="${classes.join(' ')}" 
                data-line="${lineNum}" 
                data-col="${colNum}"
                data-mapping-id="${mappingId}"
                ${style}>${this.escapeHtml(char)}</span>`;
        }
        
        return html;
    }

    private renderMappingsList(state: AppState): void {
        const container = document.getElementById('mappings-container');
        if (!container) return;

        const html = state.mappings.map((mapping) => {
            const selected = mapping.id === state.selectedMappingId;
            const isExpanded = mapping.isExpanded !== false; // Default to expanded
            
            // Get file names
            const genFile = state.descFile?.header.output || 'generated';
            const srcFile = state.descFile?.header.inputs[0] || 'source';
            
            // Collect all pairs from all segments with their original indices
            const allPairs: Array<{pair: CharacterPair, segmentId: string, originalIndex: number}> = [];
            mapping.segments.forEach(segment => {
                if (segment.pairs) {
                    segment.pairs.forEach((pair, idx) => {
                        allPairs.push({ pair, segmentId: segment.id, originalIndex: idx });
                    });
                }
            });
            
            // Sort pairs by generated position
            allPairs.sort((a, b) => {
                if (a.pair.generated.line !== b.pair.generated.line) {
                    return a.pair.generated.line - b.pair.generated.line;
                }
                return a.pair.generated.column - b.pair.generated.column;
            });
            
            return `<div class="mapping-group ${selected ? 'selected' : ''}" 
                data-mapping-id="${mapping.id}">
                <div class="mapping-header">
                    <button class="expand-toggle" data-mapping-id="${mapping.id}">
                        <i class="codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}"></i>
                    </button>
                    <div class="mapping-color" style="background-color: ${mapping.color};">
                        <button class="visibility-toggle" 
                            data-mapping-id="${mapping.id}" 
                            title="${mapping.isVisible ? 'Hide mapping' : 'Show mapping'}">
                            <i class="codicon ${mapping.isVisible ? 'codicon-eye' : 'codicon-eye-closed'}"></i>
                        </button>
                    </div>
                    <div class="mapping-title ${mapping.isVisible ? '' : 'hidden-mapping'}">
                        ${genFile} → ${srcFile}
                        <span class="pair-count">(${allPairs.length} spans)</span>
                    </div>
                    <button class="mapping-delete icon-button" 
                        data-mapping-id="${mapping.id}"
                        title="Delete entire mapping">
                        <i class="codicon codicon-trash"></i>
                    </button>
                </div>
                ${isExpanded ? `
                    <div class="mapping-spans">
                        ${this.renderMappingSpans(allPairs, mapping, state)}
                    </div>
                ` : ''}
            </div>`;
        }).join('');

        container.innerHTML = html;
        
        // Update mapping count
        const countEl = document.getElementById('mapping-count');
        if (countEl) {
            countEl.textContent = `${state.mappings.length} mappings`;
        }
    }
    
    private renderMappingSpans(
        pairs: Array<{pair: CharacterPair, segmentId: string, originalIndex: number}>,
        mapping: Mapping,
        _state: AppState
    ): string {
        return pairs.map((item) => {
            const { pair, segmentId, originalIndex } = item;
            const genPos = `${pair.generated.line}:${pair.generated.column}`;
            const srcPos = pair.source 
                ? `${pair.source.line}:${pair.source.column}` 
                : '(no source)';
            
            // Get context for both sides
            const genContext = this.getSpanContext(
                this.generatedContent, 
                pair.generated.line, 
                pair.generated.column
            );
            const srcContext = pair.source ? this.getSpanContext(
                this.sourceContent,
                pair.source.line,
                pair.source.column
            ) : '';
            
            const semanticType = pair.semanticType || 'UNKNOWN';
            
            return `<div class="span-item" 
                data-mapping-id="${mapping.id}"
                data-segment-id="${segmentId}"
                data-span-index="${originalIndex}">
                <span class="span-arrow">└─</span>
                <span class="span-position">${genPos}</span>
                <span class="span-arrow">→</span>
                <span class="span-position">${srcPos}</span>
                <span class="span-context">-- (${this.escapeHtml(genContext)}${srcContext ? ' → ' + this.escapeHtml(srcContext) : ''})</span>
                <span class="span-type">#</span>
                <input type="text" 
                    class="span-semantic-type" 
                    value="${semanticType}"
                    data-mapping-id="${mapping.id}"
                    data-segment-id="${segmentId}"
                    data-span-index="${originalIndex}"
                    placeholder="UNKNOWN">
                <button class="span-delete icon-button" 
                    title="Delete this span">
                    <i class="codicon codicon-close"></i>
                </button>
            </div>`;
        }).join('');
    }


    private updateConnections(state: AppState): void {
        const svgContainer = document.getElementById('svg-container')?.querySelector('svg');
        if (!svgContainer) return;

        svgContainer.innerHTML = '';

        // Draw connections for visible mappings
        state.mappings.forEach((mapping) => {
            if (!mapping.isVisible) return;

            mapping.segments.forEach(segment => {
                this.drawSegmentConnections(segment, mapping, state, svgContainer);
            });
        });
    }

    private drawSegmentConnections(
        segment: MappingSegment, 
        mapping: Mapping,
        state: AppState,
        svgContainer: SVGElement
    ): void {
        // Use the pairs array if available, otherwise fall back to cartesian product
        if (segment.pairs && segment.pairs.length > 0) {
            // Draw connections based on explicit pairs
            segment.pairs.forEach(pair => {
                const genEl = document.querySelector(
                    `#generated-line-${pair.generated.line} .char[data-col="${pair.generated.column}"]`
                ) as HTMLElement;
                
                if (genEl && pair.source) {
                    const srcEl = document.querySelector(
                        `#source-line-${pair.source.line} .char[data-col="${pair.source.column}"]`
                    ) as HTMLElement;
                    
                    if (srcEl) {
                        this.drawConnection(genEl, srcEl, mapping, state, svgContainer);
                    }
                }
                // Note: For no-source mappings (pair.source === null), we don't draw bezier lines
            });
        } else {
            // Fallback: For each generated location, draw a connection to each source location
            segment.generated.forEach(genLoc => {
                segment.source.forEach(srcLoc => {
                    const genEl = document.querySelector(
                        `#generated-line-${genLoc.line} .char[data-col="${genLoc.column}"]`
                    ) as HTMLElement;
                    const srcEl = document.querySelector(
                        `#source-line-${srcLoc.line} .char[data-col="${srcLoc.column}"]`
                    ) as HTMLElement;

                    if (genEl && srcEl) {
                        this.drawConnection(genEl, srcEl, mapping, state, svgContainer);
                    }
                });
            });
        }
    }

    private drawConnection(
        generatedEl: HTMLElement,
        sourceEl: HTMLElement,
        mapping: Mapping,
        state: AppState,
        svgContainer: SVGElement
    ): void {
        const isSelected = mapping.id === state.selectedMappingId;
        const opacity = isSelected ? 0.9 : 0.1;
        const strokeWidth = isSelected ? '1.5' : '1';

        const generatedRect = generatedEl.getBoundingClientRect();
        const sourceRect = sourceEl.getBoundingClientRect();
        const svgRect = svgContainer.getBoundingClientRect();

        const generatedX = generatedRect.right - svgRect.left;
        const generatedY = generatedRect.top + generatedRect.height / 2 - svgRect.top;
        const sourceX = sourceRect.left - svgRect.left;
        const sourceY = sourceRect.top + sourceRect.height / 2 - svgRect.top;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (generatedX + sourceX) / 2;
        
        const d = `M ${generatedX} ${generatedY} C ${midX} ${generatedY}, ${midX} ${sourceY}, ${sourceX} ${sourceY}`;
        
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', mapping.color);
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-opacity', opacity.toString());
        path.setAttribute('data-mapping-id', mapping.id);
        
        svgContainer.appendChild(path);

        // Add anchor dots
        this.addAnchorDot(generatedX, generatedY, mapping.color, opacity, svgContainer);
        this.addAnchorDot(sourceX, sourceY, mapping.color, opacity, svgContainer);
    }

    private addAnchorDot(
        x: number, 
        y: number, 
        color: string, 
        opacity: number,
        svgContainer: SVGElement
    ): void {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x.toString());
        circle.setAttribute('cy', y.toString());
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', color);
        circle.setAttribute('fill-opacity', opacity.toString());
        svgContainer.appendChild(circle);
    }

    private updateEditStatus(state: AppState): void {
        const statusEl = document.getElementById('edit-status');
        if (!statusEl) return;
        
        let status = '';
        if (state.selectedMappingId) {
            const mapping = state.mappings.find(m => m.id === state.selectedMappingId);
            const idx = state.mappings.indexOf(mapping!);
            status = `Editing mapping #${idx + 1} - Click to toggle characters`;
        } else if (state.editingMode === 'selecting-generated') {
            status = 'Click characters in Generated file or drag to select multiple';
        } else if (state.editingMode === 'selecting-source') {
            const genCount = state.generatedSelection.reduce(
                (sum, r) => sum + (r.endCol - r.startCol + 1), 0
            );
            status = `Now click in Source file (${genCount} chars selected) • Drag between panes to connect`;
        } else {
            status = 'Click in Generated file to start • Drag between panes for quick mapping';
        }
        
        const textEl = statusEl.querySelector('.status-text');
        if (textEl) {
            textEl.textContent = status;
        }
    }

    private updateToolbarState(_state: AppState): void {
        // Toolbar state updates can be added here if needed
    }
    
    private getSpanContext(
        content: string,
        line: number,
        col: number,
        maxChars: number = 6
    ): string {
        const lines = content.split('\n');
        if (line <= 0 || line > lines.length) return '';
        
        const lineContent = lines[line - 1];
        const startIdx = col - 1; // Convert to 0-based
        
        if (startIdx < 0 || startIdx >= lineContent.length) return '';
        
        // Extract up to maxChars or until newline
        let context = '';
        for (let i = 0; i < maxChars && startIdx + i < lineContent.length; i++) {
            const char = lineContent[startIdx + i];
            if (char === '\n') break;
            context += char;
        }
        
        // If we hit the end of line, add the newline marker
        if (startIdx + context.length >= lineContent.length && line < lines.length) {
            context += '↵';
        }
        
        return context;
    }

    private findMappingForChar(
        line: number,
        col: number,
        type: 'source' | 'generated',
        state: AppState
    ): Mapping | null {
        for (const mapping of state.mappings) {
            for (const segment of mapping.segments) {
                const locations = type === 'generated' ? segment.generated : segment.source;
                if (locations.some(loc => loc.line === line && loc.column === col)) {
                    return mapping;
                }
            }
        }
        return null;
    }

    private isCharInSelection(line: number, col: number, selection: CharRange[]): boolean {
        return selection.some(range => 
            range.line === line && col >= range.startCol && col <= range.endCol
        );
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        // Replace spaces with non-breaking spaces to ensure visibility
        return div.innerHTML.replace(/ /g, '&nbsp;');
    }
    
    private hexToRgba(hex: string, opacity: number): string {
        // Convert hex to RGB
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return `rgba(0, 0, 0, ${opacity})`;
    }
}