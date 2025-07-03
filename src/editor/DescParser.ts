import * as path from 'path';
import * as fs from 'fs';

// @claude: general file description for DESC files:
//
// Desc files are to be easy for humans to read, and construct. As such they
// contain the contents of input and output files, however this is irrelevant
// for parsing, as the truse source is always what's at the filenames location.
//
// INPUT: some_file.ext
// <CONTENTS OF some_file.ext>
//
// INPUT: some_other_file.ext
// <CONTENTS OF some_other_file.ext>
//
// OUTPUT: some_file.other_ext
// <CONTENTS OF some_file.other_ext>
//
// [1,1,1,1]
// [6]
// [-]
// [9,1,3,4]
// ...
//
// For parsing purposes we ONLY look for lines starting with INPUT:,
// for lines starting with OUTPUT:, and those starting with [
//
// We then write a desc file by simply iterating over all input files:
// INPUT: <filename>
// <CONTENTS OF filename>
// ...
//
// Then we write out the OUTPUT:
// OUTPUT: <filename>
// <CONTENTS OF filename>
//
// <MAPPING>
//
// @claude: see above, we NEVER EVER want to try to parse the CONTENT OF any of
// those files, we can always read them from the disk!

export interface DescHeader {
    inputs: string[];
    output: string;  // Just the filename, no content
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
    mappings: DescMapping[];
}

export class DescParser {
    static parse(content: string): DescFile {
        const lines = content.split('\n');
        let i = 0;

        // Parse header
        const header: DescHeader = {
            inputs: [],
            output: ''
        };

        // Collect INPUT filenames
        while (i < lines.length) {
            const line = lines[i]?.trim() || '';

            if (line.startsWith('INPUT:')) {
                header.inputs.push(line.substring(6).trim());
            } else if (line.startsWith('OUTPUT:')) {
                header.output = line.substring(7).trim();
                i++;
                break;
            } else if (line.startsWith('[')) {
                // If we hit a mapping line before OUTPUT, back up
                i--;
                break;
            }
            i++;
        }

        // Skip all content lines until we find a mapping
        while (i < lines.length) {
            const line = lines[i]?.trim() || '';
            if (line.startsWith('[')) {
                break;
            }
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

        return { header, mappings };
    }

    static serialize(desc: DescFile): string {
        const lines: string[] = [];

        // Header
        desc.header.inputs.forEach(input => {
            lines.push(`INPUT: ${input}`);
        });
        lines.push('');

        // Output
        lines.push(`OUTPUT: ${desc.header.output}`);
        lines.push('');
        lines.push('# Mappings use 1-based indices');

        // Mappings
        desc.mappings.forEach(mapping => {
            if (mapping.type === 'linebreak') {
                lines.push('[-]');
            } else {
                let line: string;
                if (!mapping.srcLine || !mapping.srcCol || !mapping.srcIdx ||
                    (mapping.srcLine === 0 && mapping.srcCol === 0 && mapping.srcIdx === 0)) {
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

    static async serializeToFile(desc: DescFile, descFilePath: string): Promise<string> {
        const lines: string[] = [];
        const dir = path.dirname(descFilePath);
        
        // Write INPUT files with their contents
        for (const input of desc.header.inputs) {
            lines.push(`INPUT: ${input}`);
            try {
                const inputPath = path.resolve(dir, input);
                const content = await fs.promises.readFile(inputPath, 'utf-8');
                lines.push(content);
            } catch (err) {
                // File doesn't exist, just skip content
            }
            lines.push('');
        }
        
        // Write OUTPUT file with its content
        lines.push(`OUTPUT: ${desc.header.output}`);
        try {
            const outputPath = path.resolve(dir, desc.header.output);
            const content = await fs.promises.readFile(outputPath, 'utf-8');
            lines.push(content);
        } catch (err) {
            // File doesn't exist, just skip content
        }
        lines.push('');
        lines.push('# Mappings use 1-based indices');
        
        // Write mappings
        desc.mappings.forEach(mapping => {
            if (mapping.type === 'linebreak') {
                lines.push('[-]');
            } else {
                let line: string;
                if (!mapping.srcLine || !mapping.srcCol || !mapping.srcIdx ||
                    (mapping.srcLine === 0 && mapping.srcCol === 0 && mapping.srcIdx === 0)) {
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