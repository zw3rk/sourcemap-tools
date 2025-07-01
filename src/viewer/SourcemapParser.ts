import { SourceMapConsumer, RawSourceMap, MappingItem } from 'source-map';
import { ParsedSourceMap, MappingData } from '../common/MessageProtocol';

export class SourcemapParser {
    /**
     * Parse a source map from its JSON string representation
     */
    public async parse(mapContent: string): Promise<ParsedSourceMap> {
        try {
            const rawMap = JSON.parse(mapContent) as RawSourceMap;
            
            // Try to initialize SourceMapConsumer without WASM if not already done
            const consumerWithInit = SourceMapConsumer as unknown as { initialize?: (options: unknown) => Promise<void> };
            if (typeof consumerWithInit.initialize === 'function') {
                try {
                    await consumerWithInit.initialize({
                        'lib/mappings.wasm': null
                    });
                } catch (e) {
                    // Ignore initialization errors, will fallback to JS implementation
                }
            }
            
            // Create consumer for detailed mapping extraction
            const consumer = await new SourceMapConsumer(rawMap);
            
            try {
                const mappings = this.extractMappings(consumer);
                
                // Use raw map data for properties that might not be directly accessible
                return {
                    version: rawMap.version,
                    sources: rawMap.sources,
                    sourcesContent: rawMap.sourcesContent || [],
                    mappings,
                    file: rawMap.file ?? undefined,
                    sourceRoot: rawMap.sourceRoot ?? undefined
                };
            } finally {
                // Always destroy consumer to free memory
                consumer.destroy();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse source map: ${message}`);
        }
    }
    
    /**
     * Extract all mappings from the source map consumer
     */
    private extractMappings(consumer: SourceMapConsumer): MappingData[] {
        const mappings: MappingData[] = [];
        
        consumer.eachMapping((mapping: MappingItem) => {
            // Skip mappings without original position
            if (mapping.originalLine === null || mapping.originalColumn === null) {
                return;
            }
            
            mappings.push({
                generated: {
                    line: mapping.generatedLine,
                    column: mapping.generatedColumn
                },
                original: {
                    line: mapping.originalLine,
                    column: mapping.originalColumn
                },
                source: mapping.source ?? '',
                name: mapping.name !== null ? mapping.name : undefined
            });
        });
        
        return mappings;
    }
    
    /**
     * Validate source map structure
     */
    public static isValidSourceMap(content: string): boolean {
        try {
            const parsed = JSON.parse(content) as unknown;
            return (
                typeof parsed === 'object' &&
                parsed !== null &&
                'version' in parsed &&
                'sources' in parsed &&
                'mappings' in parsed
            );
        } catch {
            return false;
        }
    }
}