import * as fs from 'fs';
import * as path from 'path';
import { MapToDescConverter } from '../src/converter/MapToDescConverter';
import { DescSerializer } from '../src/converter/DescSerializer';
import { DescParser } from '../src/editor/DescParser';
import { SourceMapV3 } from '../src/common/DescEditorMessages';

// Test the conversion with our multi-source map
const mapPath = path.join(__dirname, 'multi-source.map');
const mapContent = fs.readFileSync(mapPath, 'utf-8');
const sourceMap: SourceMapV3 = JSON.parse(mapContent);

console.log('Original source map:');
console.log(`- Version: ${sourceMap.version}`);
console.log(`- Sources: ${sourceMap.sources.join(', ')}`);
console.log(`- Names: ${sourceMap.names.join(', ')}`);
console.log(`- File: ${sourceMap.file}`);

// Convert to .desc
const descFile = MapToDescConverter.convert(sourceMap, mapPath);
const descContent = DescSerializer.serialize(descFile);

console.log('\nGenerated .desc content:');
console.log('='.repeat(60));
console.log(descContent);
console.log('='.repeat(60));

// Try to parse it back
try {
    const parsedDesc = DescParser.parse(descContent);
    console.log('\n✓ Successfully parsed the generated .desc file');
    console.log(`- Inputs: ${parsedDesc.header.inputs.join(', ')}`);
    console.log(`- Output: ${parsedDesc.output.filename}`);
    console.log(`- Mappings count: ${parsedDesc.mappings.length}`);
    
    // Save for manual inspection
    const outputPath = mapPath.replace('.map', '.generated.desc');
    fs.writeFileSync(outputPath, descContent);
    console.log(`\n✓ Saved to: ${outputPath}`);
} catch (error) {
    console.error('\n✗ Failed to parse generated .desc file:', error);
}