import * as fs from 'fs';
import * as path from 'path';
import { MapToDescConverter } from '../src/converter/MapToDescConverter';
import { DescSerializer } from '../src/converter/DescSerializer';
import { DescParser } from '../src/editor/DescParser';
import { SourceMapV3 } from '../src/common/DescEditorMessages';
import { encodeVLQArray } from '../src/common/vlq';

// This mimics the generateSourceMap function from DescEditorProvider
function generateSourceMapFromDesc(descFile: any): SourceMapV3 {
    // Collect all unique names (semantic types)
    const namesSet = new Set<string>();
    descFile.mappings.forEach((mapping: any) => {
        if (mapping.type === 'mapping' && mapping.semanticType && 
            mapping.semanticType !== 'UNKNOWN') {
            namesSet.add(mapping.semanticType);
        }
    });
    
    const names = Array.from(namesSet).sort();
    const nameToIndex = new Map<string, number>();
    names.forEach((name, index) => {
        nameToIndex.set(name, index);
    });
    
    // Process mappings
    let prevGenCol = 0;
    let prevSrcIndex = 0;
    let prevSrcLine = 0;
    let prevSrcCol = 0;
    let prevNameIndex = 0;
    
    const generatedLines: string[] = [];
    let currentLineSegments: string[] = [];
    
    for (const mapping of descFile.mappings) {
        if (mapping.type === 'linebreak') {
            generatedLines.push(currentLineSegments.join(','));
            currentLineSegments = [];
            prevGenCol = 0;
        } else if (mapping.type === 'mapping' && mapping.genCol !== undefined) {
            const genCol = mapping.genCol - 1;
            const segment: number[] = [];
            
            segment.push(genCol - prevGenCol);
            prevGenCol = genCol;
            
            if (mapping.srcLine !== undefined && mapping.srcLine > 0 &&
                mapping.srcCol !== undefined && mapping.srcIdx !== undefined) {
                
                const srcIndex = mapping.srcIdx - 1;
                const srcLine = mapping.srcLine - 1;
                const srcCol = mapping.srcCol - 1;
                
                segment.push(srcIndex - prevSrcIndex);
                segment.push(srcLine - prevSrcLine);
                segment.push(srcCol - prevSrcCol);
                
                prevSrcIndex = srcIndex;
                prevSrcLine = srcLine;
                prevSrcCol = srcCol;
                
                if (mapping.semanticType && mapping.semanticType !== 'UNKNOWN' &&
                    nameToIndex.has(mapping.semanticType)) {
                    const nameIndex = nameToIndex.get(mapping.semanticType)!;
                    segment.push(nameIndex - prevNameIndex);
                    prevNameIndex = nameIndex;
                }
            }
            
            currentLineSegments.push(encodeVLQArray(segment));
        }
    }
    
    if (currentLineSegments.length > 0 || generatedLines.length === 0) {
        generatedLines.push(currentLineSegments.join(','));
    }
    
    // Use the inputs array directly
    const sources = descFile.header.inputs;
    
    return {
        version: 3,
        file: descFile.output.filename || '',
        sourceRoot: '',
        sources: sources,
        names: names,
        mappings: generatedLines.join(';')
    };
}

// Test round-trip
async function testRoundTrip(mapPath: string) {
    console.log(`\nTesting: ${path.basename(mapPath)}`);
    console.log('='.repeat(60));
    
    // Step 1: Read original
    const originalContent = fs.readFileSync(mapPath, 'utf-8');
    const original: SourceMapV3 = JSON.parse(originalContent);
    
    // Step 2: Convert to .desc
    const descFile = MapToDescConverter.convert(original, mapPath);
    const descContent = DescSerializer.serialize(descFile);
    
    // Step 3: Parse .desc
    const parsedDesc = DescParser.parse(descContent);
    
    // Step 4: Convert back to .map
    const regenerated = generateSourceMapFromDesc(parsedDesc);
    
    // Step 5: Compare
    console.log('Original:');
    console.log(`  Sources: ${original.sources.join(', ')}`);
    console.log(`  Names: ${original.names.join(', ')}`);
    console.log(`  Mappings length: ${original.mappings.length}`);
    
    console.log('\nRegenerated:');
    console.log(`  Sources: ${regenerated.sources.join(', ')}`);
    console.log(`  Names: ${regenerated.names.join(', ')}`);
    console.log(`  Mappings length: ${regenerated.mappings.length}`);
    
    // Check if they match
    const sourcesMatch = original.sources.length === regenerated.sources.length;
    const namesMatch = JSON.stringify(original.names.sort()) === JSON.stringify(regenerated.names.sort());
    const mappingsMatch = original.mappings === regenerated.mappings;
    
    console.log('\nComparison:');
    console.log(`  Sources match: ${sourcesMatch ? '✓' : '✗'}`);
    console.log(`  Names match: ${namesMatch ? '✓' : '✗'}`);
    console.log(`  Mappings match: ${mappingsMatch ? '✓' : '✗'}`);
    
    if (!mappingsMatch) {
        console.log(`  Original mappings: ${original.mappings.substring(0, 100)}...`);
        console.log(`  Regenerated mappings: ${regenerated.mappings.substring(0, 100)}...`);
    }
    
    return sourcesMatch && namesMatch && mappingsMatch;
}

// Run tests
async function main() {
    const testFiles = [
        path.join(__dirname, 'simple.map'),
        path.join(__dirname, 'fixtures/nested_test.uplc.map')
    ];
    
    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            const success = await testRoundTrip(file);
            console.log(`\nRound-trip test: ${success ? 'PASSED ✓' : 'FAILED ✗'}`);
        }
    }
}

main().catch(console.error);