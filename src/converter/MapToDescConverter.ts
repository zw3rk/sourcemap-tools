import { SourceMapV3 } from '../common/DescEditorMessages';
import { DescFile, DescHeader, DescOutput, DescMapping } from '../editor/DescParser';
import { decodeVLQ } from '../common/vlq';
import * as path from 'path';

export class MapToDescConverter {
    /**
     * Convert a SourceMapV3 to DescFile format
     * @param sourceMap The source map to convert
     * @param mapFilePath The path to the .map file (used for resolving relative paths)
     * @returns A DescFile representation
     */
    public static convert(sourceMap: SourceMapV3, mapFilePath: string): DescFile {
        // Decode the VLQ mappings
        const decodedMappings = this.decodeMappings(sourceMap.mappings);
        
        // Create header with all source files
        const header: DescHeader = {
            inputs: sourceMap.sources.map(src => {
                // Keep relative paths as-is for better round-trip compatibility
                return src;
            }),
            comments: []
        };
        
        // Create output section
        const output: DescOutput = {
            filename: sourceMap.file || path.basename(mapFilePath, '.map'),
            content: this.generateOutputContent(sourceMap, decodedMappings)
        };
        
        // Convert decoded mappings to DescMapping format
        const mappings: DescMapping[] = this.convertToDescMappings(decodedMappings, sourceMap.names);
        
        return {
            header,
            output,
            mappings
        };
    }
    
    /**
     * Decode VLQ-encoded mappings string into structured mapping data
     */
    private static decodeMappings(encodedMappings: string): DecodedMapping[] {
        const mappings: DecodedMapping[] = [];
        const lines = encodedMappings.split(';');
        
        // State tracking for relative positions
        let previousGeneratedColumn = 0;
        let previousSourceIndex = 0;
        let previousSourceLine = 0;
        let previousSourceColumn = 0;
        let previousNameIndex = 0;
        
        for (let genLine = 0; genLine < lines.length; genLine++) {
            const line = lines[genLine];
            
            // Add line break marker before each new line (except the first)
            if (genLine > 0) {
                mappings.push({
                    genLine: genLine, // This will be on the previous line
                    type: 'linebreak'
                });
            }
            
            if (!line) {
                // Empty line in source map - skip to next line
                continue;
            }
            
            // Reset generated column for new line
            previousGeneratedColumn = 0;
            
            const segments = line.split(',');
            for (const segment of segments) {
                if (!segment) {
                    continue;
                }
                
                const decoded = decodeVLQ(segment);
                if (decoded.length === 0) {
                    continue;
                }
                
                // Decode segment based on VLQ spec
                // [0] Generated column (relative)
                const genCol = previousGeneratedColumn + decoded[0]!;
                previousGeneratedColumn = genCol;
                
                const mapping: DecodedMapping = {
                    genLine: genLine + 1, // Convert to 1-based
                    genCol: genCol + 1, // Convert to 1-based
                    type: 'mapping'
                };
                
                // [1] Source index (relative)
                if (decoded.length > 1) {
                    const srcIdx = previousSourceIndex + decoded[1]!;
                    previousSourceIndex = srcIdx;
                    mapping.srcIdx = srcIdx + 1; // Convert to 1-based
                    
                    // [2] Source line (relative)
                    if (decoded.length > 2) {
                        const srcLine = previousSourceLine + decoded[2]!;
                        previousSourceLine = srcLine;
                        mapping.srcLine = srcLine + 1; // Convert to 1-based
                        
                        // [3] Source column (relative)
                        if (decoded.length > 3) {
                            const srcCol = previousSourceColumn + decoded[3]!;
                            previousSourceColumn = srcCol;
                            mapping.srcCol = srcCol + 1; // Convert to 1-based
                            
                            // [4] Name index (relative)
                            if (decoded.length > 4) {
                                const nameIdx = previousNameIndex + decoded[4]!;
                                previousNameIndex = nameIdx;
                                mapping.nameIdx = nameIdx;
                            }
                        }
                    }
                }
                
                mappings.push(mapping);
            }
        }
        
        return mappings;
    }
    
    /**
     * Generate output content with line numbers
     */
    private static generateOutputContent(_sourceMap: SourceMapV3, mappings: DecodedMapping[]): string {
        // Find the maximum line number to determine content length
        let maxLine = 0;
        for (const mapping of mappings) {
            if (mapping.genLine > maxLine) {
                maxLine = mapping.genLine;
            }
        }
        
        // Generate placeholder content with line numbers
        const lines: string[] = [];
        for (let i = 1; i <= maxLine; i++) {
            lines.push(`// Line ${i}`);
        }
        
        return lines.join('\n');
    }
    
    /**
     * Convert decoded mappings to DescMapping format
     */
    private static convertToDescMappings(decodedMappings: DecodedMapping[], names: string[]): DescMapping[] {
        const descMappings: DescMapping[] = [];
        
        for (const decoded of decodedMappings) {
            if (decoded.type === 'linebreak') {
                descMappings.push({
                    type: 'linebreak',
                    genLine: decoded.genLine
                });
            } else {
                const mapping: DescMapping = {
                    type: 'mapping',
                    genLine: decoded.genLine,
                    genCol: decoded.genCol,
                    srcIdx: decoded.srcIdx,
                    srcLine: decoded.srcLine,
                    srcCol: decoded.srcCol
                };
                
                // Add semantic type if name index exists
                if (decoded.nameIdx !== undefined && names[decoded.nameIdx]) {
                    mapping.semanticType = names[decoded.nameIdx];
                }
                
                descMappings.push(mapping);
            }
        }
        
        return descMappings;
    }
}

interface DecodedMapping {
    type: 'mapping' | 'linebreak';
    genLine: number;
    genCol?: number;
    srcIdx?: number;
    srcLine?: number;
    srcCol?: number;
    nameIdx?: number;
}