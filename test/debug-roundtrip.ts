import * as fs from 'fs';
import * as path from 'path';
import { MapToDescConverter } from '../src/converter/MapToDescConverter';
import { SourceMapV3 } from '../src/common/DescEditorMessages';

// Test with simple.map to debug the difference
const mapPath = path.join(__dirname, 'simple.map');
const mapContent = fs.readFileSync(mapPath, 'utf-8');
const sourceMap: SourceMapV3 = JSON.parse(mapContent);

console.log('Original mappings:');
console.log(sourceMap.mappings);
console.log('\nSplit by semicolons:');
sourceMap.mappings.split(';').forEach((line, i) => {
    console.log(`Line ${i}: "${line}"`);
});

// Convert to .desc
const descFile = MapToDescConverter.convert(sourceMap, mapPath);

console.log('\n\nGenerated .desc mappings:');
let lineNum = 1;
descFile.mappings.forEach((m, i) => {
    if (m.type === 'linebreak') {
        console.log(`${i}: [-] (line break)`);
        lineNum++;
    } else {
        const parts: any[] = [m.genCol];
        if (m.srcIdx !== undefined) parts.push(m.srcIdx);
        if (m.srcLine !== undefined) parts.push(m.srcLine);
        if (m.srcCol !== undefined) parts.push(m.srcCol);
        if (m.semanticType) parts.push(`"${m.semanticType}"`);
        console.log(`${i}: [${parts.join(',')}] on line ${lineNum}`);
    }
});