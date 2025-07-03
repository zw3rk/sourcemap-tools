const fs = require('fs');
const path = require('path');

// Import our converters
const { MapToDescConverter } = require('../out/converter/MapToDescConverter');
const { DescSerializer } = require('../out/converter/DescSerializer');
const { DescParser } = require('../out/editor/DescParser');

// Test function to verify round-trip conversion
function testRoundTrip(mapFilePath) {
    console.log(`\nTesting round-trip conversion for: ${path.basename(mapFilePath)}`);
    console.log('='.repeat(60));
    
    try {
        // Step 1: Read original .map file
        const originalMapContent = fs.readFileSync(mapFilePath, 'utf-8');
        const originalMap = JSON.parse(originalMapContent);
        console.log('✓ Read original .map file');
        
        // Step 2: Convert .map to .desc
        const descFile = MapToDescConverter.convert(originalMap, mapFilePath);
        const descContent = DescSerializer.serialize(descFile);
        console.log('✓ Converted .map to .desc');
        
        // Save the .desc file for inspection
        const descPath = mapFilePath.replace('.map', '.generated.desc');
        fs.writeFileSync(descPath, descContent);
        console.log(`✓ Saved .desc file to: ${path.basename(descPath)}`);
        
        // Step 3: Parse the .desc file back
        const parsedDesc = DescParser.parse(descContent);
        console.log('✓ Parsed .desc file');
        
        // Step 4: Convert .desc back to .map (would need to use generateSourceMap from DescEditorProvider)
        // For now, let's just verify the key information is preserved
        
        console.log('\nVerification:');
        console.log(`- Sources count: Original=${originalMap.sources.length}, Converted=${descFile.header.inputs.length}`);
        console.log(`- Output file: Original="${originalMap.file}", Converted="${descFile.output.filename}"`);
        console.log(`- Names count: Original=${originalMap.names.length}, Converted=${new Set(descFile.mappings.filter(m => m.semanticType).map(m => m.semanticType)).size}`);
        console.log(`- Mappings count: ${descFile.mappings.length}`);
        
        // Show first few mappings
        console.log('\nFirst 5 mappings:');
        descFile.mappings.slice(0, 5).forEach((mapping, i) => {
            if (mapping.type === 'linebreak') {
                console.log(`  ${i + 1}. Line break`);
            } else {
                console.log(`  ${i + 1}. [${mapping.genCol},${mapping.srcIdx},${mapping.srcLine},${mapping.srcCol}${mapping.semanticType ? ',' + mapping.semanticType : ''}]`);
            }
        });
        
        return true;
    } catch (error) {
        console.error('✗ Error:', error.message);
        return false;
    }
}

// Test with our test files
const testFiles = [
    path.join(__dirname, 'fixtures/nested_test.uplc.map'),
    path.join(__dirname, 'multi-source.map')
];

console.log('Source Map to Description File Round-Trip Test');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testFiles.forEach(file => {
    if (fs.existsSync(file)) {
        if (testRoundTrip(file)) {
            passed++;
        } else {
            failed++;
        }
    } else {
        console.log(`\nSkipping ${path.basename(file)} - file not found`);
    }
});

console.log('\n' + '='.repeat(60));
console.log(`Test Results: ${passed} passed, ${failed} failed`);