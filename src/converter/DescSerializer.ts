import { DescFile } from '../editor/DescParser';

export class DescSerializer {
    /**
     * Serialize a DescFile to .desc format string
     */
    public static serialize(descFile: DescFile): string {
        const lines: string[] = [];
        
        // Add header comments
        if (descFile.header.comments.length > 0) {
            for (const comment of descFile.header.comments) {
                lines.push(`-- ${comment}`);
            }
            lines.push('');
        }
        
        // Add INPUT sections
        for (const input of descFile.header.inputs) {
            lines.push(`INPUT: ${input}`);
        }
        lines.push('');
        
        // Add OUTPUT section
        lines.push(`OUTPUT: ${descFile.output.filename}`);
        lines.push('');
        
        // Add output content with proper indentation
        const contentLines = descFile.output.content.split('\n');
        for (const line of contentLines) {
            lines.push(`  ${line}`);
        }
        lines.push('');
        
        // Add mappings
        for (const mapping of descFile.mappings) {
            if (mapping.type === 'linebreak') {
                lines.push('[-]');
            } else if (mapping.type === 'mapping') {
                // Format: [genCol,srcIdx,srcLine,srcCol,semanticType]
                const parts: (string | number)[] = [];
                
                // Generated column is required for mappings
                if (mapping.genCol !== undefined) {
                    parts.push(mapping.genCol);
                    
                    // Source information is optional
                    if (mapping.srcIdx !== undefined) {
                        parts.push(mapping.srcIdx);
                        
                        if (mapping.srcLine !== undefined) {
                            parts.push(mapping.srcLine);
                            
                            if (mapping.srcCol !== undefined) {
                                parts.push(mapping.srcCol);
                                
                                if (mapping.semanticType) {
                                    parts.push(mapping.semanticType);
                                }
                            }
                        }
                    }
                    
                    let mappingStr = `[${parts.join(',')}]`;
                    
                    // Add comment if present
                    if (mapping.comment) {
                        mappingStr += ` -- ${mapping.comment}`;
                    }
                    
                    lines.push(mappingStr);
                }
            }
        }
        
        return lines.join('\n');
    }
}