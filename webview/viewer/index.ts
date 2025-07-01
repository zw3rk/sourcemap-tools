// Webview script for the source map visualizer

// Make this a module
export {};

// VSCode API type definition
// @ts-ignore - used by acquireVsCodeApi
interface VSCodeAPI {
    postMessage(message: any): void;
}

interface Mapping {
    generated: { line: number; column: number };
    original: { line: number; column: number };
    source: string;
    name?: string;
}

interface SourcemapPayload {
    parsedMap: {
        version: number;
        sources: string[];
        mappings: Mapping[];
        file?: string;
        sourceRoot?: string;
    };
    generatedPath?: string;
    generatedContent?: string;
    sourcePaths: Array<{
        original: string;
        resolved: string;
        embeddedContent?: string | null;
    }>;
    sourceContent?: string;
    firstSourcePath?: string;
}

const vscode = acquireVsCodeApi();

// DOM elements
let sourceContent: HTMLPreElement;
let generatedContent: HTMLPreElement;
let statusText: HTMLElement;
let connectionsSvg: SVGElement;

// State
let currentMappings: Mapping[] = [];
let tokenElements: Map<string, HTMLElement> = new Map();
let activeConnections: SVGPathElement[] = [];
let colorPalette: string[] = [];
let segmentColorMap: Map<string, string> = new Map();
let persistedSegments: Set<string> = new Set();
let legendPanel: HTMLElement;
let legendContent: HTMLElement;
let mappingStats: HTMLElement;
let lastSourcemapPayload: SourcemapPayload | null = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    initializeColorPalette();

    // Notify extension that webview is ready
    vscode.postMessage({ command: 'ready' });
});

function initializeElements() {
    sourceContent = document.getElementById('source-content') as HTMLPreElement;
    generatedContent = document.getElementById('generated-content') as HTMLPreElement;
    statusText = document.getElementById('status-text') as HTMLElement;
    connectionsSvg = document.getElementById('connections') as unknown as SVGElement;
    legendPanel = document.getElementById('legend-panel') as HTMLElement;
    legendContent = document.getElementById('legend-content') as HTMLElement;
    mappingStats = document.getElementById('mapping-stats') as HTMLElement;
}

function setupEventListeners() {
    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'loadSourcemap':
                handleLoadSourcemap(message);
                break;
            case 'fileContent':
                handleFileContent(message);
                break;
            case 'error':
                showError(message.error);
                break;
        }
    });

    // Legend toggle
    document.querySelector('.legend-header')?.addEventListener('click', toggleLegend);
}

function handleLoadSourcemap(message: any) {
    updateStatus('Loading source map data...');

    try {
        const payload = message.payload as SourcemapPayload;
        lastSourcemapPayload = payload;

        // Store mappings
        currentMappings = payload.parsedMap.mappings;

        // Display content
        if (payload.sourceContent) {
            displaySourceCode(sourceContent, payload.sourceContent, 'source');
        } else {
            sourceContent.textContent = 'Source file not found';
        }

        if (payload.generatedContent) {
            displayGeneratedCode(generatedContent, payload.generatedContent, 'generated');
        } else {
            generatedContent.textContent = 'Generated file not found';
        }

        // Create mapping connections
        if (currentMappings.length > 0) {
            createMappingElements();
            updateLegend();
            updateMappingStats();
            updateStatus(`Loaded ${currentMappings.length} mappings`);
        } else {
            updateStatus('No mappings found');
        }
    } catch (error) {
        showError('Failed to process source map: ' + error);
    }
}

function handleFileContent(message: any) {
    // This function is now handled by handleLoadSourcemap
    // Keeping for backwards compatibility
    console.log('handleFileContent called with:', message.filePath);
}

function showError(error: string) {
    statusText.textContent = 'Error: ' + error;
    statusText.style.color = 'var(--vscode-errorForeground)';
}

function updateStatus(status: string) {
    statusText.textContent = status;
    statusText.style.color = '';
}


/* Unused - export buttons removed
function exportAsSvg() {
    try {
        // Create a clone of the viewer for export
        const viewerClone = document.getElementById('viewer')?.cloneNode(true) as HTMLElement;
        if (!viewerClone) return;

        // Create SVG wrapper
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const viewerRect = document.getElementById('viewer')?.getBoundingClientRect();
        if (!viewerRect) return;

        svg.setAttribute('width', viewerRect.width.toString());
        svg.setAttribute('height', viewerRect.height.toString());
        svg.setAttribute('viewBox', `0 0 ${viewerRect.width} ${viewerRect.height}`);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Add styles
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = getSvgStyles();
        svg.appendChild(style);

        // Create foreign object for HTML content
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('width', '100%');
        foreignObject.setAttribute('height', '100%');

        // Add HTML content
        foreignObject.appendChild(viewerClone);
        svg.appendChild(foreignObject);

        // Copy connection lines
        const connectionsClone = connectionsSvg.cloneNode(true) as SVGElement;
        svg.appendChild(connectionsClone);

        // Convert to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);

        // Send to extension for saving
        vscode.postMessage({
            command: 'export',
            format: 'svg',
            content: svgString,
            filename: `sourcemap-visualization-${Date.now()}.svg`
        });

        updateStatus('SVG export prepared');
    } catch (error) {
        showError('Failed to export SVG: ' + error);
    }
}

function getSvgStyles(): string {
    // Extract relevant styles for SVG export
    return `
        .code-line { display: flex; font-family: monospace; font-size: 12px; }
        .line-number { color: #858585; margin-right: 16px; user-select: none; }
        .code-segment { border-radius: 3px; padding: 0 2px; margin: 0 1px; }
        .code-text-plain { opacity: 0.7; }
        .connection-line { fill: none; stroke-width: 2; opacity: 0.8; }
        .pane-header { font-weight: bold; padding: 8px; background: #252526; }
        .code-pane { flex: 1; overflow: hidden; }
        .code-content { margin: 0; padding: 16px; white-space: pre; }
    `;
}

function exportAsPng() {
    // TODO: Implement PNG export
    vscode.postMessage({ command: 'export', format: 'png' });
}
*/

function initializeColorPalette() {
    // Create a visually distinct color palette
    colorPalette = [
        '#ff6b6b', // red
        '#4ecdc4', // teal
        '#45b7d1', // blue
        '#f7dc6f', // yellow
        '#bb8fce', // purple
        '#52be80', // green
        '#f8b500', // orange
        '#5dade2', // light blue
        '#ec7063', // pink
        '#58d68d', // light green
        '#af7ac5', // lavender
        '#f5b041', // peach
        '#5499c7', // sky blue
        '#cd6155', // terracotta
        '#76d7c4', // mint
        '#f1948a', // salmon
    ];
}

function displaySourceCode(container: HTMLElement, content: string, type: 'source' | 'generated') {
    const lines = content.split('\n');
    container.innerHTML = '';

    // Build segments based on mappings
    const segments = buildSegments(lines, type);

    lines.forEach((line, lineIndex) => {
        const lineNumber = lineIndex + 1;
        const lineElement = document.createElement('div');
        lineElement.className = 'code-line';
        lineElement.setAttribute('data-line', lineNumber.toString());

        // Add line number
        const lineNumberSpan = document.createElement('span');
        lineNumberSpan.className = 'line-number';
        lineNumberSpan.textContent = lineNumber.toString().padStart(4, ' ');
        lineElement.appendChild(lineNumberSpan);

        // Add code content with segments
        const codeSpan = document.createElement('span');
        codeSpan.className = 'code-text';

        const lineSegments = segments.filter(s => s.line === lineNumber);
        if (lineSegments.length > 0) {
            // Sort segments by column
            lineSegments.sort((a, b) => a.startCol - b.startCol);

            let lastEnd = 0;
            lineSegments.forEach(segment => {
                // Add any text before this segment
                if (segment.startCol > lastEnd) {
                    const beforeText = line.substring(lastEnd, segment.startCol);
                    const beforeSpan = document.createElement('span');
                    beforeSpan.textContent = beforeText;
                    beforeSpan.className = 'code-text-plain';
                    codeSpan.appendChild(beforeSpan);
                }

                // Add the segment
                const segmentSpan = document.createElement('span');
                segmentSpan.className = 'code-segment';
                segmentSpan.textContent = line.substring(segment.startCol, segment.endCol);
                segmentSpan.setAttribute('data-type', type);
                segmentSpan.setAttribute('data-line', lineNumber.toString());
                segmentSpan.setAttribute('data-col', segment.startCol.toString());
                segmentSpan.setAttribute('data-segment-id', segment.id);

                // Apply background color if this segment has a mapping
                if (segment.color) {
                    segmentSpan.style.backgroundColor = segment.color + '30'; // 30 = 18% opacity
                }

                const tokenId = `${type}-${lineNumber}-${segment.startCol}`;
                segmentSpan.setAttribute('data-token-id', tokenId);
                tokenElements.set(tokenId, segmentSpan);

                codeSpan.appendChild(segmentSpan);
                lastEnd = segment.endCol;
            });

            // Add any remaining text
            if (lastEnd < line.length) {
                const afterText = line.substring(lastEnd);
                const afterSpan = document.createElement('span');
                afterSpan.textContent = afterText;
                afterSpan.className = 'code-text-plain';
                codeSpan.appendChild(afterSpan);
            }
        } else {
            // No segments on this line, display as plain text
            const plainSpan = document.createElement('span');
            plainSpan.textContent = line;
            plainSpan.className = 'code-text-plain';
            codeSpan.appendChild(plainSpan);
        }

        lineElement.appendChild(codeSpan);
        container.appendChild(lineElement);
    });
}

function displayGeneratedCode(container: HTMLElement, content: string, type: 'generated') {
    displaySourceCode(container, content, type);
}

interface Segment {
    id: string;
    line: number;
    startCol: number;
    endCol: number;
    color?: string;
}

function buildSegments(lines: string[], type: 'source' | 'generated'): Segment[] {
    const segments: Segment[] = [];
    const relevantMappings = type === 'source'
        ? currentMappings
        : currentMappings;

    // Group mappings by line
    const mappingsByLine = new Map<number, Mapping[]>();
    relevantMappings.forEach(mapping => {
        const line = type === 'source' ? mapping.original.line : mapping.generated.line;
        if (!mappingsByLine.has(line)) {
            mappingsByLine.set(line, []);
        }
        mappingsByLine.get(line)!.push(mapping);
    });

    // Create segments for each line
    mappingsByLine.forEach((mappings, lineNum) => {
        // Sort mappings by column
        mappings.sort((a, b) => {
            const colA = type === 'source' ? a.original.column : a.generated.column;
            const colB = type === 'source' ? b.original.column : b.generated.column;
            return colA - colB;
        });

        const lineText = lines[lineNum - 1] || '';

        // Group adjacent mappings with the same source location
        const mergedMappings: Array<{mapping: Mapping, startCol: number, endCol: number}> = [];

        mappings.forEach((mapping, index) => {
            const col = type === 'source' ? mapping.original.column : mapping.generated.column;
            const nextMapping = mappings[index + 1];
            const nextCol = nextMapping
                ? (type === 'source' ? nextMapping.original.column : nextMapping.generated.column)
                : lineText.length;

            // Check if this mapping can be merged with the previous one
            const lastMerged = mergedMappings[mergedMappings.length - 1];
            const mappingKey = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;

            if (lastMerged) {
                const lastKey = `${lastMerged.mapping.source}-${lastMerged.mapping.original.line}-${lastMerged.mapping.original.column}`;

                // Merge if same source location and adjacent columns
                if (lastKey === mappingKey && lastMerged.endCol === col) {
                    lastMerged.endCol = Math.min(nextCol, lineText.length);
                    return;
                }
            }

            mergedMappings.push({
                mapping,
                startCol: col,
                endCol: Math.min(nextCol, lineText.length)
            });
        });

        // Create segments from merged mappings
        mergedMappings.forEach(({mapping, startCol, endCol}) => {
            const mappingKey = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;
            if (!segmentColorMap.has(mappingKey)) {
                const colorIndex = segmentColorMap.size % colorPalette.length;
                segmentColorMap.set(mappingKey, colorPalette[colorIndex]);
            }

            segments.push({
                id: mappingKey,
                line: lineNum,
                startCol,
                endCol,
                color: segmentColorMap.get(mappingKey)
            });
        });
    });

    return segments;
}

function createMappingElements() {
    // Clear existing connections
    clearConnections();

    // Add hover and click listeners to tokens
    tokenElements.forEach((element, tokenId) => {
        element.addEventListener('mouseenter', () => handleTokenHover(tokenId, true));
        element.addEventListener('mouseleave', () => handleTokenHover(tokenId, false));
        element.addEventListener('click', () => handleTokenClick(tokenId));
    });
}

function handleTokenHover(tokenId: string, isEntering: boolean) {
    if (isEntering) {
        highlightMapping(tokenId);
    } else {
        clearHighlights();
    }
}

function highlightMapping(tokenId: string) {
    const element = tokenElements.get(tokenId);
    if (!element) return;

    const segmentId = element.getAttribute('data-segment-id');
    if (!segmentId) return;

    // Find all mappings that match this segment
    const relevantMappings = currentMappings.filter(mapping => {
        const mappingKey = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;
        return mappingKey === segmentId;
    });

    // Highlight all related segments and draw connections
    relevantMappings.forEach(mapping => {
        const sourceElement = findExactToken('source', mapping.original.line, mapping.original.column);
        const generatedElement = findExactToken('generated', mapping.generated.line, mapping.generated.column);

        if (sourceElement && generatedElement) {
            sourceElement.classList.add('highlighted');
            generatedElement.classList.add('highlighted');

            // Emphasize the color on hover
            const color = segmentColorMap.get(segmentId);
            if (color) {
                sourceElement.style.backgroundColor = color + '60'; // 60 = 38% opacity
                generatedElement.style.backgroundColor = color + '60';
            }

            drawConnection(sourceElement, generatedElement, color);
        }
    });
}

function findExactToken(type: string, line: number, column: number): HTMLElement | null {
    // Find the token that contains this line:column position
    for (const [tokenId, element] of tokenElements) {
        if (!tokenId.startsWith(type)) continue;

        const elementLine = parseInt(element.getAttribute('data-line') || '0');
        const elementCol = parseInt(element.getAttribute('data-col') || '0');

        if (elementLine === line && elementCol <= column) {
            // Check if this token contains the column
            const text = element.textContent || '';
            if (elementCol + text.length > column) {
                return element;
            }
        }
    }

    // Fallback to closest token on the line
    const tokenId = `${type}-${line}-${column}`;
    return tokenElements.get(tokenId) || null;
}

function drawConnection(sourceElement: HTMLElement, generatedElement: HTMLElement, color?: string) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const generatedRect = generatedElement.getBoundingClientRect();
    const svgRect = connectionsSvg.getBoundingClientRect();

    // Determine anchor positions based on relative Y coordinates
    const sourceMidY = sourceRect.top + sourceRect.height / 2;
    const generatedMidY = generatedRect.top + generatedRect.height / 2;

    // Decide which anchors to use
    let sourceAnchor: 'top' | 'bottom';
    let generatedAnchor: 'top' | 'bottom';

    if (Math.abs(sourceMidY - generatedMidY) < 5) {
        // Same line - use bottom anchors
        sourceAnchor = 'bottom';
        generatedAnchor = 'bottom';
    } else if (sourceMidY < generatedMidY) {
        // Source is above generated
        sourceAnchor = 'bottom';
        generatedAnchor = 'top';
    } else {
        // Source is below generated
        sourceAnchor = 'top';
        generatedAnchor = 'bottom';
    }

    // Add anchor classes to elements
    sourceElement.classList.add(`anchor-${sourceAnchor}`);
    generatedElement.classList.add(`anchor-${generatedAnchor}`);

    // Set CSS variable for segment color
    if (color) {
        sourceElement.style.setProperty('--segment-color', color);
        generatedElement.style.setProperty('--segment-color', color);
    }

    // Add anchor dots
    if (!sourceElement.querySelector('.anchor-dot')) {
        const sourceDot = document.createElement('span');
        sourceDot.className = 'anchor-dot';
        sourceElement.appendChild(sourceDot);
    }
    if (!generatedElement.querySelector('.anchor-dot')) {
        const generatedDot = document.createElement('span');
        generatedDot.className = 'anchor-dot';
        generatedElement.appendChild(generatedDot);
    }

    // Calculate anchor positions - use middle of elements
    const anchorOffset = 9; // Distance from text to anchor dot (3px to line + 6px to dot center)

    const startX = sourceRect.left + sourceRect.width / 2 - svgRect.left;
    const startY = sourceAnchor === 'bottom'
        ? sourceRect.bottom - svgRect.top + anchorOffset
        : sourceRect.top - svgRect.top - anchorOffset;

    const endX = generatedRect.left + generatedRect.width / 2 - svgRect.left;
    const endY = generatedAnchor === 'bottom'
        ? generatedRect.bottom - svgRect.top + anchorOffset
        : generatedRect.top - svgRect.top - anchorOffset;

    // Create path with adjusted control points for smooth curves
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const d = createAnchoredPathData(startX, startY, endX, endY, sourceAnchor, generatedAnchor);

    path.setAttribute('d', d);
    path.classList.add('connection-line', 'active');

    // Use the segment color if provided
    if (color) {
        path.style.stroke = color;
        path.style.strokeWidth = '0.8'; // Even thinner
    }

    connectionsSvg.appendChild(path);
    activeConnections.push(path);
}


function createAnchoredPathData(
    x1: number, y1: number,
    x2: number, y2: number,
    sourceAnchor: 'top' | 'bottom',
    targetAnchor: 'top' | 'bottom'
): string {
    // Add vertical segments at the anchors to create perpendicular connections
    const verticalExtension = 5; // Reduced to 50% - was 10

    // Calculate vertical directions based on anchor types
    const sourceVerticalDir = sourceAnchor === 'bottom' ? 1 : -1;
    const targetVerticalDir = targetAnchor === 'bottom' ? 1 : -1;

    // Start and end points after vertical segments
    const startY = y1 + (verticalExtension * sourceVerticalDir);
    const endY = y2 + (verticalExtension * targetVerticalDir);

    // Create smooth bezier curves with vertical starts/ends
    const horizontalDistance = Math.abs(x2 - x1);

    // Use cubic bezier for smooth vertical start/end
    // Control points need to be positioned to ensure vertical tangents

    // First control point: vertical from start
    const cp1X = x1;
    const cp1Y = startY + (20 * sourceVerticalDir); // Extended vertically for smooth curve

    // Second control point: vertical from end
    const cp2X = x2;
    const cp2Y = endY + (20 * targetVerticalDir); // Extended vertically for smooth curve

    // For better curves when points are far apart horizontally
    if (horizontalDistance > 100) {
        // If anchors are on opposite sides (S-curve)
        if (sourceAnchor !== targetAnchor) {
            return `M ${x1} ${y1} L ${x1} ${startY} C ${x1} ${startY + 50 * sourceVerticalDir}, ${x2} ${endY + 50 * targetVerticalDir}, ${x2} ${endY} L ${x2} ${y2}`;
        }

        // If anchors are on same side - create loop curve
        const loopHeight = sourceAnchor === 'bottom' ? 40 : -40;
        return `M ${x1} ${y1} L ${x1} ${startY} C ${x1} ${startY + loopHeight}, ${x2} ${endY + loopHeight}, ${x2} ${endY} L ${x2} ${y2}`;
    }

    // For closer points, use simple vertical control points
    return `M ${x1} ${y1} L ${x1} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${x2} ${endY} L ${x2} ${y2}`;
}

function clearHighlights() {
    document.querySelectorAll('.highlighted').forEach(el => {
        el.classList.remove('highlighted');
        // Remove anchor classes
        el.classList.remove('anchor-top', 'anchor-bottom');
        // Remove CSS variable
        (el as HTMLElement).style.removeProperty('--segment-color');
        // Remove anchor dots
        el.querySelectorAll('.anchor-dot').forEach(dot => dot.remove());
        // Reset background color to original
        const segmentEl = el as HTMLElement;
        const segmentId = segmentEl.getAttribute('data-segment-id');
        if (segmentId) {
            const color = segmentColorMap.get(segmentId);
            if (color) {
                segmentEl.style.backgroundColor = color + '30'; // Back to 18% opacity
            }
        }
    });
    clearConnections();
}

function clearConnections() {
    activeConnections.forEach(path => path.remove());
    activeConnections = [];
}

function handleTokenClick(tokenId: string) {
    const element = tokenElements.get(tokenId);
    if (!element) return;

    const segmentId = element.getAttribute('data-segment-id');
    if (!segmentId) return;

    // Toggle persistence
    if (persistedSegments.has(segmentId)) {
        persistedSegments.delete(segmentId);
        removePersistedHighlight(segmentId);
    } else {
        persistedSegments.add(segmentId);
        addPersistedHighlight(segmentId);
    }

    updateLegend();
}

function addPersistedHighlight(segmentId: string) {
    // Find all elements with this segment ID
    document.querySelectorAll(`[data-segment-id="${segmentId}"]`).forEach(el => {
        el.classList.add('persisted');
        const element = el as HTMLElement;
        const color = segmentColorMap.get(segmentId);
        if (color) {
            element.style.backgroundColor = color + '50'; // 31% opacity for persisted
            element.style.border = `2px solid ${color}`;
        }
    });

    // Draw persisted connections
    const relevantMappings = currentMappings.filter(mapping => {
        const mappingKey = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;
        return mappingKey === segmentId;
    });

    relevantMappings.forEach(mapping => {
        const sourceElement = findExactToken('source', mapping.original.line, mapping.original.column);
        const generatedElement = findExactToken('generated', mapping.generated.line, mapping.generated.column);

        if (sourceElement && generatedElement) {
            const color = segmentColorMap.get(segmentId);
            drawPersistedConnection(sourceElement, generatedElement, color);
        }
    });
}

function removePersistedHighlight(segmentId: string) {
    document.querySelectorAll(`[data-segment-id="${segmentId}"]`).forEach(el => {
        el.classList.remove('persisted');
        // Remove anchor classes
        el.classList.remove('anchor-top', 'anchor-bottom');
        // Remove CSS variable
        (el as HTMLElement).style.removeProperty('--segment-color');
        // Remove anchor dots
        el.querySelectorAll('.anchor-dot').forEach(dot => dot.remove());
        const element = el as HTMLElement;
        const color = segmentColorMap.get(segmentId);
        if (color) {
            element.style.backgroundColor = color + '30'; // Back to normal opacity
            element.style.border = 'none';
        }
    });

    // Remove persisted connections
    document.querySelectorAll(`.connection-persisted[data-segment-id="${segmentId}"]`).forEach(el => {
        el.remove();
    });
}

function drawPersistedConnection(sourceElement: HTMLElement, generatedElement: HTMLElement, color?: string) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const generatedRect = generatedElement.getBoundingClientRect();
    const svgRect = connectionsSvg.getBoundingClientRect();

    // Determine anchor positions based on relative Y coordinates
    const sourceMidY = sourceRect.top + sourceRect.height / 2;
    const generatedMidY = generatedRect.top + generatedRect.height / 2;

    // Decide which anchors to use
    let sourceAnchor: 'top' | 'bottom';
    let generatedAnchor: 'top' | 'bottom';

    if (Math.abs(sourceMidY - generatedMidY) < 5) {
        // Same line - use bottom anchors
        sourceAnchor = 'bottom';
        generatedAnchor = 'bottom';
    } else if (sourceMidY < generatedMidY) {
        // Source is above generated
        sourceAnchor = 'bottom';
        generatedAnchor = 'top';
    } else {
        // Source is below generated
        sourceAnchor = 'top';
        generatedAnchor = 'bottom';
    }

    // Add anchor classes to elements
    sourceElement.classList.add(`anchor-${sourceAnchor}`);
    generatedElement.classList.add(`anchor-${generatedAnchor}`);

    // Set CSS variable for segment color
    if (color) {
        sourceElement.style.setProperty('--segment-color', color);
        generatedElement.style.setProperty('--segment-color', color);
    }

    // Add anchor dots
    if (!sourceElement.querySelector('.anchor-dot')) {
        const sourceDot = document.createElement('span');
        sourceDot.className = 'anchor-dot';
        sourceElement.appendChild(sourceDot);
    }
    if (!generatedElement.querySelector('.anchor-dot')) {
        const generatedDot = document.createElement('span');
        generatedDot.className = 'anchor-dot';
        generatedElement.appendChild(generatedDot);
    }

    // Calculate anchor positions - use middle of elements
    const anchorOffset = 9; // Distance from text to anchor dot (3px to line + 6px to dot center)

    const startX = sourceRect.left + sourceRect.width / 2 - svgRect.left;
    const startY = sourceAnchor === 'bottom'
        ? sourceRect.bottom - svgRect.top + anchorOffset
        : sourceRect.top - svgRect.top - anchorOffset;

    const endX = generatedRect.left + generatedRect.width / 2 - svgRect.left;
    const endY = generatedAnchor === 'bottom'
        ? generatedRect.bottom - svgRect.top + anchorOffset
        : generatedRect.top - svgRect.top - anchorOffset;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = createAnchoredPathData(startX, startY, endX, endY, sourceAnchor, generatedAnchor);

    path.setAttribute('d', d);
    path.classList.add('connection-line', 'connection-persisted');
    path.setAttribute('data-segment-id', sourceElement.getAttribute('data-segment-id') || '');

    if (color) {
        path.style.stroke = color;
        path.style.strokeWidth = '1'; // Reduced from 2
        path.style.opacity = '0.5';
    }

    connectionsSvg.appendChild(path);
}

function updateLegend() {
    legendContent.innerHTML = '';

    // Create a map of segment IDs to their mappings for easier lookup
    const segmentMappings = new Map<string, Mapping[]>();
    currentMappings.forEach(mapping => {
        const segmentId = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;
        if (!segmentMappings.has(segmentId)) {
            segmentMappings.set(segmentId, []);
        }
        segmentMappings.get(segmentId)!.push(mapping);
    });

    const segments = Array.from(segmentColorMap.entries());
    segments.forEach(([segmentId, color]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        if (persistedSegments.has(segmentId)) {
            item.classList.add('active');
        }

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = color;

        const text = document.createElement('div');
        text.className = 'legend-text';

        // Get the mappings for this segment
        const mappings = segmentMappings.get(segmentId) || [];
        if (mappings.length > 0) {
            const firstMapping = mappings[0];

            // Extract filenames and locations
            const sourceFile = firstMapping.source.split('/').pop() || firstMapping.source;
            const generatedFile = getGeneratedFileName();

            // Format: generated.ext:line:col -> source.ext:line:col
            const generatedLocations = mappings.map(m => `${m.generated.line}:${m.generated.column}`).join(',');
            const sourceLocation = `${firstMapping.original.line}:${firstMapping.original.column}`;

            text.textContent = `${generatedFile}:${generatedLocations} → ${sourceFile}:${sourceLocation}`;
        } else {
            // Fallback to segment ID if no mapping found
            const parts = segmentId.split('-');
            const sourceFile = parts[0].split('/').pop() || parts[0];
            text.textContent = `${sourceFile}:${parts[1]}:${parts[2]}`;
        }

        item.appendChild(colorBox);
        item.appendChild(text);

        item.addEventListener('click', () => {
            // Find and click the first element with this segment ID
            const element = document.querySelector(`[data-segment-id="${segmentId}"]`);
            if (element) {
                (element as HTMLElement).click();
            }
        });

        legendContent.appendChild(item);
    });
}

// Helper function to get the generated file name
function getGeneratedFileName(): string {
    // Try to get from the parsed source map data
    if (lastSourcemapPayload && lastSourcemapPayload.generatedPath) {
        return lastSourcemapPayload.generatedPath.split('/').pop() || 'generated';
    }
    return 'generated';
}

function updateMappingStats() {
    const uniqueSegments = segmentColorMap.size;
    const totalMappings = currentMappings.length;
    const sourceFiles = new Set(currentMappings.map(m => m.source)).size;

    mappingStats.textContent = `${totalMappings} mappings | ${uniqueSegments} segments | ${sourceFiles} source file${sourceFiles !== 1 ? 's' : ''}`;
}

function toggleLegend() {
    legendPanel.classList.toggle('collapsed');
}

// Unused function - kept for potential future use
// function redrawConnections() {
//     // Clear temporary connections
//     clearConnections();
// 
//     // Redraw persisted connections
//     persistedSegments.forEach(segmentId => {
//         const relevantMappings = currentMappings.filter(mapping => {
//             const mappingKey = `${mapping.source}-${mapping.original.line}-${mapping.original.column}`;
//             return mappingKey === segmentId;
//         });
// 
//         relevantMappings.forEach(mapping => {
//             const sourceElement = findExactToken('source', mapping.original.line, mapping.original.column);
//             const generatedElement = findExactToken('generated', mapping.generated.line, mapping.generated.column);
// 
//             if (sourceElement && generatedElement) {
//                 const color = segmentColorMap.get(segmentId);
//                 drawPersistedConnection(sourceElement, generatedElement, color);
//             }
//         });
//     });
// }