// Centralized state management for the desc editor
export interface SourceLocation {
    sourceFile: string;
    line: number;
    column: number;
}

export interface GeneratedLocation {
    line: number;
    column: number;
}

export interface CharacterPair {
    generated: GeneratedLocation;
    source: SourceLocation | null; // null for no-source mappings
    semanticType?: string; // e.g., 'UNKNOWN', 'IDENTIFIER', 'LITERAL', etc.
}

// A "segment" is a single mapping from generated ranges to source ranges
export interface MappingSegment {
    id: string; // Unique ID for this segment
    generated: GeneratedLocation[];
    source: SourceLocation[];
    // Track explicit character pairs to preserve exact mappings
    pairs?: CharacterPair[];
}

// A "mapping" is a collection of segments, visually grouped by a color
export interface Mapping {
    id: string; // Unique ID for the whole mapping group
    color: string; // e.g., '#FF5733'
    isVisible: boolean;
    segments: MappingSegment[];
    isExpanded?: boolean; // For tree view UI state
}

export interface CharRange {
    line: number;
    startCol: number;
    endCol: number;
}

// The single source of truth for the entire UI
export interface AppState {
    // Document data
    descFile: DescFile | null;
    sourceContent: string;
    
    // Mapping data
    mappings: Mapping[];
    selectedMappingId: string | null;
    deletedMappingPositions: Set<string>; // Track deleted mappings by position
    
    // Editing state
    isEditing: boolean;
    editingMode: 'none' | 'selecting-generated' | 'selecting-source';
    stagedSegment: {
        generated: GeneratedLocation[];
        source: SourceLocation[];
    };
    
    // Temporary selections for creating/editing
    generatedSelection: CharRange[];
    sourceSelection: CharRange[];
}

// DescFile interface (matching the backend)
export interface DescFile {
    header: {
        input: string;
        version?: string;
        comments: string[];
    };
    output: {
        filename: string;
        content: string;
    };
    mappings: Array<{
        type: 'mapping' | 'break';
        genLine?: number;
        genCol?: number;
        srcLine?: number;
        srcCol?: number;
        semanticType?: string;
    }>;
}

// Action types for state updates
export type StateAction = 
    | { type: 'SET_DESC_FILE'; payload: { descFile: DescFile | null; sourceContent: string } }
    | { type: 'SELECT_MAPPING'; payload: { mappingId: string | null } }
    | { type: 'TOGGLE_MAPPING_VISIBILITY'; payload: { mappingId: string } }
    | { type: 'DELETE_MAPPING'; payload: { mappingId: string } }
    | { type: 'ADD_SEGMENT'; payload: { mappingId: string; segment: MappingSegment } }
    | { type: 'DELETE_SEGMENT'; payload: { mappingId: string; segmentId: string } }
    | { type: 'START_EDITING'; payload: { mode: 'selecting-generated' | 'selecting-source' } }
    | { type: 'STOP_EDITING' }
    | { type: 'TOGGLE_GENERATED_LOCATION'; payload: GeneratedLocation }
    | { type: 'TOGGLE_SOURCE_LOCATION'; payload: SourceLocation }
    | { type: 'CREATE_MAPPING_FROM_STAGED' }
    | { type: 'SET_GENERATED_SELECTION'; payload: CharRange[] }
    | { type: 'SET_SOURCE_SELECTION'; payload: CharRange[] }
    | { type: 'SHOW_ALL_MAPPINGS' }
    | { type: 'HIDE_ALL_MAPPINGS' }
    | { type: 'UPDATE_MAPPING'; payload: { mappingId: string; mapping: Mapping } }
    | { type: 'UPDATE_PAIR_SEMANTIC_TYPE'; payload: { mappingId: string; segmentId: string; pairIndex: number; semanticType: string } }
    | { type: 'DELETE_PAIR'; payload: { mappingId: string; segmentId: string; pairIndex: number } }
    | { type: 'TOGGLE_MAPPING_EXPANDED'; payload: { mappingId: string } };

// State reducer function
export function stateReducer(state: AppState, action: StateAction): AppState {
    switch (action.type) {
        case 'SET_DESC_FILE':
            return {
                ...state,
                descFile: action.payload.descFile,
                sourceContent: action.payload.sourceContent,
                // Convert existing mappings to new format, preserving visibility and skipping deleted
                mappings: convertDescMappingsToStateMappings(
                    action.payload.descFile?.mappings || [], 
                    state.mappings,
                    state.deletedMappingPositions
                )
            };
            
        case 'SELECT_MAPPING':
            return {
                ...state,
                selectedMappingId: action.payload.mappingId,
                isEditing: action.payload.mappingId !== null,
                editingMode: action.payload.mappingId !== null ? 'none' : state.editingMode
            };
            
        case 'TOGGLE_MAPPING_VISIBILITY':
            return {
                ...state,
                mappings: state.mappings.map(m => 
                    m.id === action.payload.mappingId 
                        ? { ...m, isVisible: !m.isVisible }
                        : m
                )
            };
            
        case 'DELETE_MAPPING':
            const mappingToDelete = state.mappings.find(m => m.id === action.payload.mappingId);
            if (mappingToDelete && mappingToDelete.segments.length > 0) {
                // Track the position of deleted mapping
                const firstSegment = mappingToDelete.segments[0];
                if (firstSegment.generated.length > 0 && firstSegment.source.length > 0) {
                    const posKey = `${firstSegment.generated[0].line}:${firstSegment.generated[0].column}-${firstSegment.source[0].line}:${firstSegment.source[0].column}`;
                    state.deletedMappingPositions.add(posKey);
                }
            }
            
            return {
                ...state,
                mappings: state.mappings.filter(m => m.id !== action.payload.mappingId),
                selectedMappingId: state.selectedMappingId === action.payload.mappingId 
                    ? null 
                    : state.selectedMappingId,
                deletedMappingPositions: new Set(state.deletedMappingPositions)
            };
            
        case 'START_EDITING':
            return {
                ...state,
                isEditing: true,
                editingMode: action.payload.mode,
                stagedSegment: { generated: [], source: [] },
                generatedSelection: [],
                sourceSelection: []
            };
            
        case 'STOP_EDITING':
            return {
                ...state,
                isEditing: false,
                editingMode: 'none',
                stagedSegment: { generated: [], source: [] },
                generatedSelection: [],
                sourceSelection: []
            };
            
        case 'SET_GENERATED_SELECTION':
            return {
                ...state,
                generatedSelection: action.payload
            };
            
        case 'SET_SOURCE_SELECTION':
            return {
                ...state,
                sourceSelection: action.payload
            };
            
        case 'CREATE_MAPPING_FROM_STAGED':
            if (state.generatedSelection.length === 0) return state;
            
            const generatedLocs = flattenRangesToLocations(state.generatedSelection, 'generated') as GeneratedLocation[];
            const sourceLocs = flattenRangesToLocations(state.sourceSelection, 'source', state.descFile?.header.input || '') as SourceLocation[];
            
            // Create pairs
            const pairs: CharacterPair[] = [];
            if (sourceLocs.length > 0) {
                // Create all combinations of generated and source
                generatedLocs.forEach(genLoc => {
                    sourceLocs.forEach(srcLoc => {
                        pairs.push({ generated: genLoc, source: srcLoc });
                    });
                });
            } else {
                // No source - create no-source pairs
                generatedLocs.forEach(genLoc => {
                    pairs.push({ generated: genLoc, source: null });
                });
            }
            
            const newSegment: MappingSegment = {
                id: generateId(),
                generated: generatedLocs,
                source: sourceLocs,
                pairs: pairs
            };
            
            // Find all mappings that connect to this new segment
            const connectedMappings: Mapping[] = [];
            const newGenLocations = newSegment.generated;
            const newSrcLocations = newSegment.source;
            
            for (const mapping of state.mappings) {
                let isConnected = false;
                
                for (const segment of mapping.segments) {
                    // Check if they share any generated location
                    for (const newGen of newGenLocations) {
                        for (const existingGen of segment.generated) {
                            if (newGen.line === existingGen.line && newGen.column === existingGen.column) {
                                isConnected = true;
                                break;
                            }
                        }
                        if (isConnected) break;
                    }
                    
                    // Check if they share any source location
                    if (!isConnected && newSrcLocations.length > 0) {
                        for (const newSrc of newSrcLocations) {
                            for (const existingSrc of segment.source) {
                                if (newSrc.line === existingSrc.line && newSrc.column === existingSrc.column) {
                                    isConnected = true;
                                    break;
                                }
                            }
                            if (isConnected) break;
                        }
                    }
                    
                    if (isConnected) break;
                }
                
                if (isConnected) {
                    connectedMappings.push(mapping);
                }
            }
            
            if (connectedMappings.length === 0) {
                // Create new mapping
                const newMapping: Mapping = {
                    id: generateId(),
                    color: getNextColor(state.mappings.length),
                    isVisible: true,
                    segments: [newSegment]
                };
                
                return {
                    ...state,
                    mappings: [...state.mappings, newMapping],
                    isEditing: false,
                    editingMode: 'none',
                    generatedSelection: [],
                    sourceSelection: [],
                    stagedSegment: { generated: [], source: [] }
                };
            } else if (connectedMappings.length === 1) {
                // Add segment to the single connected mapping
                const targetMapping = connectedMappings[0];
                return {
                    ...state,
                    mappings: state.mappings.map(m => 
                        m.id === targetMapping.id 
                            ? { ...m, segments: [...m.segments, newSegment] }
                            : m
                    ),
                    isEditing: false,
                    editingMode: 'none',
                    generatedSelection: [],
                    sourceSelection: [],
                    stagedSegment: { generated: [], source: [] }
                };
            } else {
                // Multiple mappings connected - merge them all
                const mergedMapping = connectedMappings[0]; // Use first as base
                const allSegments = [newSegment];
                const connectedIds = new Set(connectedMappings.map(m => m.id));
                
                // Collect all segments from connected mappings
                for (const mapping of connectedMappings) {
                    allSegments.push(...mapping.segments);
                }
                
                return {
                    ...state,
                    mappings: [
                        // Keep the first connected mapping with all segments
                        {
                            ...mergedMapping,
                            segments: allSegments
                        },
                        // Filter out all other connected mappings
                        ...state.mappings.filter(m => !connectedIds.has(m.id))
                    ],
                    isEditing: false,
                    editingMode: 'none',
                    generatedSelection: [],
                    sourceSelection: [],
                    stagedSegment: { generated: [], source: [] }
                };
            }
            
        case 'SHOW_ALL_MAPPINGS':
            return {
                ...state,
                mappings: state.mappings.map(m => ({ ...m, isVisible: true }))
            };
            
        case 'HIDE_ALL_MAPPINGS':
            return {
                ...state,
                mappings: state.mappings.map(m => ({ ...m, isVisible: false }))
            };
            
        case 'UPDATE_MAPPING':
            return {
                ...state,
                mappings: state.mappings.map(m => 
                    m.id === action.payload.mappingId 
                        ? action.payload.mapping
                        : m
                )
            };
            
        case 'UPDATE_PAIR_SEMANTIC_TYPE':
            return {
                ...state,
                mappings: state.mappings.map(m => {
                    if (m.id === action.payload.mappingId) {
                        const updatedSegments = m.segments.map(s => {
                            if (s.id === action.payload.segmentId && s.pairs) {
                                const updatedPairs = [...s.pairs];
                                if (updatedPairs[action.payload.pairIndex]) {
                                    updatedPairs[action.payload.pairIndex] = {
                                        ...updatedPairs[action.payload.pairIndex],
                                        semanticType: action.payload.semanticType
                                    };
                                }
                                return { ...s, pairs: updatedPairs };
                            }
                            return s;
                        });
                        return { ...m, segments: updatedSegments };
                    }
                    return m;
                })
            };
            
        case 'DELETE_PAIR':
            console.log('DELETE_PAIR action:', action.payload);
            return {
                ...state,
                mappings: state.mappings.map(m => {
                    if (m.id === action.payload.mappingId) {
                        console.log('Found mapping to update');
                        const updatedSegments = m.segments.map(s => {
                            if (s.id === action.payload.segmentId && s.pairs) {
                                console.log(`Found segment ${s.id}, pairs before: ${s.pairs.length}`);
                                const updatedPairs = [...s.pairs];
                                updatedPairs.splice(action.payload.pairIndex, 1);
                                console.log(`Pairs after deletion: ${updatedPairs.length}`);
                                
                                // Also update generated and source arrays
                                const genSet = new Set<string>();
                                const srcSet = new Set<string>();
                                
                                updatedPairs.forEach(pair => {
                                    genSet.add(`${pair.generated.line}:${pair.generated.column}`);
                                    if (pair.source) {
                                        srcSet.add(`${pair.source.line}:${pair.source.column}`);
                                    }
                                });
                                
                                const generated = Array.from(genSet).map(loc => {
                                    const [line, col] = loc.split(':').map(Number);
                                    return { line, column: col };
                                });
                                
                                const source = Array.from(srcSet).map(loc => {
                                    const [line, col] = loc.split(':').map(Number);
                                    return { 
                                        sourceFile: state.descFile?.header.input || '',
                                        line, 
                                        column: col 
                                    };
                                });
                                
                                return { ...s, pairs: updatedPairs, generated, source };
                            }
                            return s;
                        }).filter(s => s.pairs && s.pairs.length > 0); // Remove empty segments
                        
                        // If no segments left, the mapping will be removed
                        if (updatedSegments.length === 0) {
                            return null!; // Will be filtered out
                        }
                        
                        return { ...m, segments: updatedSegments };
                    }
                    return m;
                }).filter(Boolean) // Remove null mappings
            };
            
        case 'TOGGLE_MAPPING_EXPANDED':
            return {
                ...state,
                mappings: state.mappings.map(m => 
                    m.id === action.payload.mappingId 
                        ? { ...m, isExpanded: !m.isExpanded }
                        : m
                )
            };
            
        default:
            return state;
    }
}

// Helper functions
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getNextColor(index: number): string {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#48DBFB', '#0ABDE3', '#006BA6', '#FFA502', '#12CBC4',
        '#A29BFE', '#6C5CE7', '#FD79A8', '#636E72', '#F8B500',
        '#6C5B7B'
    ];
    return colors[index % colors.length];
}

function flattenRangesToLocations(
    ranges: CharRange[], 
    type: 'generated' | 'source',
    sourceFile: string = ''
): GeneratedLocation[] | SourceLocation[] {
    const locations: (GeneratedLocation | SourceLocation)[] = [];
    
    for (const range of ranges) {
        for (let col = range.startCol; col <= range.endCol; col++) {
            if (type === 'generated') {
                locations.push({ line: range.line, column: col });
            } else {
                locations.push({ sourceFile, line: range.line, column: col });
            }
        }
    }
    
    if (type === 'generated') {
        return locations as GeneratedLocation[];
    } else {
        return locations as SourceLocation[];
    }
}

type DescMapping = {
    type: 'mapping' | 'break';
    genLine?: number;
    genCol?: number;
    srcLine?: number;
    srcCol?: number;
    semanticType?: string;
};

function convertDescMappingsToStateMappings(descMappings: DescMapping[], existingMappings?: Mapping[], deletedPositions?: Set<string>): Mapping[] {
    // First, filter and convert desc mappings to individual pairs
    const pairData: Array<{
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    }> = [];
    
    let noSourceCount = 0;
    
    descMappings.forEach((dm) => {
        if (dm.type !== 'mapping') return;
        
        // Check if this mapping was deleted
        if (deletedPositions && dm.genLine && dm.genCol && dm.srcLine && dm.srcCol) {
            const posKey = `${dm.genLine}:${dm.genCol}-${dm.srcLine}:${dm.srcCol}`;
            if (deletedPositions.has(posKey)) {
                console.log('Skipping deleted mapping:', posKey);
                return; // Skip deleted mappings
            }
        }
        
        if (dm.genLine && dm.genCol) {
            const isNoSource = !dm.srcLine || dm.srcLine === 0;
            if (isNoSource) {
                noSourceCount++;
                console.log(`No-source mapping found: ${dm.genLine}:${dm.genCol}`);
            }
            
            pairData.push({
                genLine: dm.genLine,
                genCol: dm.genCol,
                srcLine: dm.srcLine || 0,
                srcCol: dm.srcCol || 0,
                semanticType: dm.semanticType || 'UNKNOWN'
            });
        }
    });
    
    console.log(`Total no-source mappings: ${noSourceCount}`);
    
    // Group pairs into mappings using connected components
    // But now we only connect pairs that share EXACT pair relationships
    const mappings = groupPairsIntoMappings(pairData, existingMappings);
    
    return mappings;
}

// Group pairs into mappings, preserving the exact pair relationships
function groupPairsIntoMappings(
    pairData: Array<{
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    }>, 
    existingMappings?: Mapping[]
): Mapping[] {
    if (pairData.length === 0) return [];
    
    // Build adjacency list for ALL pairs (not grouped by semantic type)
    const adjacency = new Map<number, Set<number>>();
    
    // Initialize adjacency list
    for (let i = 0; i < pairData.length; i++) {
        adjacency.set(i, new Set<number>());
    }
    
    // Two pairs are connected if they share a generated or source location
    for (let i = 0; i < pairData.length; i++) {
        for (let j = i + 1; j < pairData.length; j++) {
            const p1 = pairData[i];
            const p2 = pairData[j];
            
            // Connected if they share generated location
            if (p1.genLine === p2.genLine && p1.genCol === p2.genCol) {
                adjacency.get(i)!.add(j);
                adjacency.get(j)!.add(i);
            }
            // Connected if they share source location
            // This includes no-source mappings (srcLine=0, srcCol=0) which will group together
            else if (p1.srcLine === p2.srcLine && p1.srcCol === p2.srcCol) {
                adjacency.get(i)!.add(j);
                adjacency.get(j)!.add(i);
            }
        }
    }
    
    // Find connected components using DFS
    const visited = new Set<number>();
    const components: number[][] = [];
    
    function dfs(node: number, component: number[]) {
        visited.add(node);
        component.push(node);
        
        const neighbors = adjacency.get(node) || new Set();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                dfs(neighbor, component);
            }
        }
    }
    
    for (let i = 0; i < pairData.length; i++) {
        if (!visited.has(i)) {
            const component: number[] = [];
            dfs(i, component);
            components.push(component);
        }
    }
    
    // Create a mapping for each connected component
    const mappings: Mapping[] = [];
    let colorIndex = 0;
    
    console.log(`Found ${components.length} connected components`);
    
    components.forEach((component, idx) => {
        const componentPairs = component.map(idx => pairData[idx]);
        
        // Count no-source pairs in this component
        const noSourceInComponent = componentPairs.filter(p => p.srcLine === 0).length;
        if (noSourceInComponent > 0) {
            console.log(`Component ${idx}: ${noSourceInComponent} no-source pairs out of ${componentPairs.length} total`);
            if (noSourceInComponent === componentPairs.length) {
                console.log(`  -> This is a no-source only mapping group`);
            }
        }
        
        // Try to find an existing mapping that contains any of these pairs
        const existingMapping = existingMappings?.find(m => 
            m.segments.some(s => 
                s.pairs?.some(p => 
                    componentPairs.some(cp => 
                        cp.genLine === p.generated.line && 
                        cp.genCol === p.generated.column &&
                        ((cp.srcLine === 0 && !p.source) || 
                         (p.source && cp.srcLine === p.source.line && cp.srcCol === p.source.column))
                    )
                )
            )
        );
        
        // Create segments for this component (all pairs are connected so one segment)
        const segment = createSegmentFromPairs(componentPairs);
        
        mappings.push({
            id: generateId(),
            color: existingMapping?.color || getNextColor(colorIndex++),
            isVisible: existingMapping?.isVisible ?? true,
            segments: [segment]
        });
    });
    
    return mappings;
}

// Helper function to create a segment from a group of pairs
function createSegmentFromPairs(
    pairs: Array<{
        genLine: number;
        genCol: number;
        srcLine: number;
        srcCol: number;
        semanticType: string;
    }>
): MappingSegment {
    // Collect unique locations
    const genSet = new Set<string>();
    const srcSet = new Set<string>();
    const charPairs: CharacterPair[] = [];
    
    pairs.forEach(pair => {
        genSet.add(`${pair.genLine}:${pair.genCol}`);
        if (pair.srcLine > 0) {
            srcSet.add(`${pair.srcLine}:${pair.srcCol}`);
        }
        
        // Create character pair with semantic type
        charPairs.push({
            generated: { line: pair.genLine, column: pair.genCol },
            source: pair.srcLine > 0 ? {
                sourceFile: '', // Will be filled by context
                line: pair.srcLine,
                column: pair.srcCol
            } : null,
            semanticType: pair.semanticType
        });
    });
    
    // Convert sets back to location arrays
    const generated = Array.from(genSet).map(loc => {
        const [line, col] = loc.split(':').map(Number);
        return { line, column: col };
    });
    
    const source = Array.from(srcSet).map(loc => {
        const [line, col] = loc.split(':').map(Number);
        return { 
            sourceFile: '', // Will be filled by context
            line, 
            column: col 
        };
    });
    
    return {
        id: generateId(),
        generated,
        source,
        pairs: charPairs
    };
}




// Initial state factory
export function createInitialState(): AppState {
    return {
        descFile: null,
        sourceContent: '',
        mappings: [],
        selectedMappingId: null,
        deletedMappingPositions: new Set<string>(),
        isEditing: false,
        editingMode: 'none',
        stagedSegment: { generated: [], source: [] },
        generatedSelection: [],
        sourceSelection: []
    };
}