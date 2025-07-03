export interface DescHeader {
    inputs: string[];  // Changed from single string to array of strings
    comments: string[];
}

export interface DescOutput {
    filename: string;
    content: string;
}

export interface DescMapping {
    type: 'mapping' | 'linebreak';
    genLine: number;
    genCol?: number;
    srcIdx?: number;
    srcLine?: number;
    srcCol?: number;
    semanticType?: string;
    comment?: string;
}

export interface DescFile {
    header: DescHeader;
    output: DescOutput;
    mappings: DescMapping[];
}

export class DescParser {
    static parse(content: string): DescFile {
        const lines = content.split('\n');
        let i = 0;
        
        // Parse header
        const header: DescHeader = {
            inputs: [],
            comments: []
        };
        
        while (i < lines.length) {
            const line = lines[i]?.trim() || '';
            
            if (line.startsWith('INPUT:')) {
                header.inputs.push(line.substring(6).trim());
            } else if (line.startsWith('--')) {
                header.comments.push(line.substring(2).trim());
            } else if (line.startsWith('OUTPUT:')) {
                break;
            } else if (line === '' || line.startsWith('#')) {
                // Skip empty lines and comment lines starting with #
            } else if (line.startsWith('[')) {
                // If we hit a mapping line, we need to back up
                i--;
                break;
            }
            
            i++;
        }
        
        // Parse output section
        const output: DescOutput = {
            filename: '',
            content: ''
        };
        
        if (i < lines.length && lines[i]?.trim().startsWith('OUTPUT:')) {
            const outputLine = lines[i]!.trim();
            output.filename = outputLine.substring(7).trim();
            i++;
            
            // Collect output content until we hit the mapping comment or mapping lines
            const outputLines: string[] = [];
            while (i < lines.length && lines[i]) {
                const currentLine = lines[i]!;
                if (currentLine.includes('1-based') || currentLine.trim().startsWith('[')) {
                    break;
                }
                outputLines.push(currentLine);
                i++;
            }
            output.content = outputLines.join('\n').trim();
        }
        
        // Skip mapping comment line
        if (i < lines.length && lines[i]?.includes('1-based absolute indices')) {
            i++;
        }
        
        // Parse mappings
        const mappings: DescMapping[] = [];
        let currentGenLine = 1;
        
        while (i < lines.length) {
            const line = lines[i]?.trim() || '';
            
            if (line.startsWith('[')) {
                const comment = line.includes('--') ? line.substring(line.indexOf('--') + 2).trim() : undefined;
                const bracketContent = line.substring(1, line.indexOf(']'));
                
                if (bracketContent === '-') {
                    // Line break
                    mappings.push({
                        type: 'linebreak',
                        genLine: currentGenLine
                    });
                    currentGenLine++;
                } else {
                    // Parse mapping
                    const parts = bracketContent.split(',').map(p => p.trim());
                    if (parts.length === 1) {
                        // No-source mapping: [genCol]
                        mappings.push({
                            type: 'mapping',
                            genLine: currentGenLine,
                            genCol: parseInt(parts[0] || '0'),
                            comment
                        });
                    } else if (parts.length >= 5) {
                        // Full mapping: [genCol, srcIdx, srcLine, srcCol, semanticType]
                        mappings.push({
                            type: 'mapping',
                            genLine: currentGenLine,
                            genCol: parseInt(parts[0] || '0'),
                            srcIdx: parseInt(parts[1] || '0'),
                            srcLine: parseInt(parts[2] || '0'),
                            srcCol: parseInt(parts[3] || '0'),
                            semanticType: parts[4] || '',
                            comment
                        });
                    } else if (parts.length === 4) {
                        // Mapping without semantic type: [genCol, srcIdx, srcLine, srcCol]
                        mappings.push({
                            type: 'mapping',
                            genLine: currentGenLine,
                            genCol: parseInt(parts[0] || '0'),
                            srcIdx: parseInt(parts[1] || '0'),
                            srcLine: parseInt(parts[2] || '0'),
                            srcCol: parseInt(parts[3] || '0'),
                            comment
                        });
                    }
                }
            }
            
            i++;
        }
        
        return { header, output, mappings };
    }
    
    static serialize(desc: DescFile): string {
        const lines: string[] = [];
        
        // Header
        desc.header.inputs.forEach(input => {
            lines.push(`INPUT: ${input}`);
        });
        lines.push('');
        desc.header.comments.forEach(comment => {
            lines.push(`-- ${comment}`);
        });
        lines.push('');
        
        // Output
        lines.push(`OUTPUT: ${desc.output.filename}`);
        lines.push(desc.output.content);
        lines.push('');
        lines.push('# Mappings use 1-based indices');
        
        // Mappings
        desc.mappings.forEach(mapping => {
            if (mapping.type === 'linebreak') {
                lines.push('[-]');
            } else {
                let line: string;
                if (mapping.srcLine === 0 && mapping.srcCol === 0 && mapping.srcIdx === 0) {
                    // No-source mapping: just [genCol]
                    line = `[${mapping.genCol}]`;
                } else {
                    // Regular mapping
                    const parts = [
                        mapping.genCol,
                        mapping.srcIdx,
                        mapping.srcLine,
                        mapping.srcCol,
                        mapping.semanticType
                    ].join(',');
                    line = `[${parts}]`;
                }
                
                if (mapping.comment) {
                    line += ` -- ${mapping.comment}`;
                }
                lines.push(line);
            }
        });
        
        return lines.join('\n');
    }
}