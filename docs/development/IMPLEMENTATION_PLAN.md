# Source Map Visualizer VSCode Extension - Implementation Plan

## Executive Summary

This document outlines a comprehensive implementation plan for building a VSCode extension that provides advanced source map visualization and visual editing capabilities. The project is divided into two phases: Phase 1 focuses on creating a robust source map viewer, and Phase 2 adds visual editing functionality for `.desc` mapping files.

## Project Architecture

### Technology Stack
- **Language**: TypeScript (strict mode enabled)
- **Runtime**: VSCode Extension API + Node.js
- **UI Framework**: Webview API with vanilla TypeScript/CSS
- **Build System**: Webpack for bundling
- **Testing**: Mocha + VSCode Extension Test Runner
- **Key Libraries**:
  - `source-map`: For parsing source map files
  - `svg.js`: For dynamic SVG generation
  - `monaco-editor`: For code display in webviews

### Project Structure
```
src-map-viz/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── commands/                 # Command handlers
│   │   ├── visualizeSourcemap.ts
│   │   └── editDescription.ts
│   ├── viewer/                   # Source map viewer components
│   │   ├── SourcemapParser.ts   # Handles .map file parsing
│   │   ├── PathResolver.ts       # Resolves relative paths
│   │   ├── FileLoader.ts         # Loads source/generated files
│   │   └── ViewerProvider.ts     # Manages webview lifecycle
│   ├── editor/                   # .desc editor components
│   │   ├── DescParser.ts         # Parses .desc files
│   │   ├── MappingManager.ts     # Manages visual mappings
│   │   └── EditorProvider.ts     # Manages editor webview
│   └── common/                   # Shared utilities
│       ├── MessageProtocol.ts    # Type-safe message passing
│       ├── FileWatcher.ts        # File system monitoring
│       └── Logger.ts             # Logging utilities
├── webview/                      # Frontend code
│   ├── viewer/
│   │   ├── index.ts              # Viewer entry point
│   │   ├── CodePane.ts           # Code display component
│   │   ├── MappingVisualizer.ts  # SVG connection renderer
│   │   └── InteractionManager.ts # Hover/click handling
│   └── editor/
│       ├── index.ts              # Editor entry point
│       ├── MappingCreator.ts     # Visual mapping creation
│       └── DescGenerator.ts      # .desc file generation
├── resources/                    # Static assets
│   ├── styles/
│   └── templates/
└── test/                        # Test suites
```

## Phase 1: Sourcemap Viewer Implementation

### Milestone 1.1: Basic Extension Setup (Week 1)

#### Tasks:
1. **Project Initialization**
   - Use Yeoman generator to scaffold VSCode extension
   - Configure TypeScript with strict mode
   - Set up Webpack for optimal bundling
   - Configure ESLint and Prettier

2. **Command Registration**
   ```typescript
   // package.json
   {
     "contributes": {
       "commands": [{
         "command": "sourcemap-visualizer.view",
         "title": "Visualize Sourcemap",
         "category": "Source Map"
       }],
       "menus": {
         "editor/context": [{
           "command": "sourcemap-visualizer.view",
           "when": "resourceExtname == .map",
           "group": "navigation"
         }]
       }
     }
   }
   ```

3. **Basic Webview Infrastructure**
   - Implement WebviewProvider base class
   - Set up Content Security Policy with nonces
   - Create message passing protocol
   - Implement proper disposal handling

### Milestone 1.2: Source Map Parsing & File Loading (Week 2)

#### Tasks:
1. **Source Map Parser Implementation**
   ```typescript
   class SourcemapParser {
     async parse(mapContent: string): Promise<ParsedSourceMap> {
       const consumer = await new SourceMapConsumer(mapContent);
       return {
         version: consumer.version,
         sources: consumer.sources,
         mappings: this.extractMappings(consumer),
         sourcesContent: consumer.sourcesContent
       };
     }
     
     private extractMappings(consumer: SourceMapConsumer): Mapping[] {
       const mappings: Mapping[] = [];
       consumer.eachMapping(m => {
         mappings.push({
           generated: { line: m.generatedLine, column: m.generatedColumn },
           original: { line: m.originalLine, column: m.originalColumn },
           source: m.source,
           name: m.name
         });
       });
       return mappings;
     }
   }
   ```

2. **Path Resolution Strategy**
   - Handle relative paths from .map file location
   - Support webpack:///, file://, and other URI schemes
   - Implement fallback strategies for missing files
   - Cache resolved paths for performance

3. **File Loading System**
   - Asynchronous file reading with progress indication
   - Support for embedded source content in maps
   - Error handling for missing/inaccessible files
   - Memory-efficient loading for large files

### Milestone 1.3: Interactive Visualization (Week 3-4)

#### Tasks:
1. **Code Display Components**
   - Use Monaco Editor for syntax highlighting
   - Implement line number synchronization
   - Add search functionality within panes
   - Support for various file types (not just JS)

2. **Mapping Visualization**
   ```typescript
   class MappingVisualizer {
     private svg: SVG.Container;
     
     visualizeMapping(mapping: VisualMapping) {
       const path = this.calculateBezierPath(
         mapping.sourceElement,
         mapping.generatedElement
       );
       
       const line = this.svg.path(path)
         .fill('none')
         .stroke({ color: '#3498db', width: 2 })
         .opacity(0.7);
       
       this.animateLineDrawing(line);
     }
     
     private calculateBezierPath(from: Element, to: Element): string {
       const fromRect = from.getBoundingClientRect();
       const toRect = to.getBoundingClientRect();
       // Calculate control points for smooth curve
       return `M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}`;
     }
   }
   ```

3. **Interaction Management**
   - Hover highlighting with debouncing
   - Click-to-persist highlighting
   - Keyboard navigation support
   - Touch device compatibility

### Milestone 1.4: Advanced Features (Week 5)

#### Tasks:
1. **File Watching & Auto-reload**
   ```typescript
   class FileWatcher {
     private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
     
     watch(files: string[], onChange: () => void) {
       files.forEach(file => {
         const watcher = vscode.workspace.createFileSystemWatcher(file);
         watcher.onDidChange(onChange);
         this.watchers.set(file, watcher);
       });
     }
     
     dispose() {
       this.watchers.forEach(w => w.dispose());
       this.watchers.clear();
     }
   }
   ```

2. **Performance Optimizations**
   - Virtual scrolling for large files
   - Lazy loading of mappings
   - WebWorker for heavy computations
   - Efficient diff algorithm for updates

3. **Enhanced UI Features**
   - Split pane resizing
   - Zoom in/out functionality
   - Export visualization as SVG/PNG
   - Dark/light theme support

## Phase 2: Visual .desc Editor Implementation

### Milestone 2.1: Editor Infrastructure (Week 6)

#### Tasks:
1. **Editor Command & UI Setup**
   - New command: "sourcemap-visualizer.editDesc"
   - File picker for source/generated files
   - Two-pane editor layout
   - Toolbar with editing tools

2. **State Management**
   ```typescript
   class MappingState {
     private mappings: Map<string, DescMapping> = new Map();
     
     addMapping(source: Selection, generated: Selection) {
       const id = generateId();
       this.mappings.set(id, {
         id,
         source: { line: source.line, column: source.column },
         generated: { line: generated.line, column: generated.column },
         name: this.inferName(source)
       });
       this.notifyListeners();
     }
   }
   ```

### Milestone 2.2: Visual Mapping Creation (Week 7)

#### Tasks:
1. **Selection Interface**
   - Click-and-drag selection
   - Multi-selection support
   - Visual feedback during selection
   - Undo/redo functionality

2. **Mapping Visualization**
   - Real-time preview of mappings
   - Different colors for different mapping types
   - Hover effects and tooltips
   - Mapping deletion interface

### Milestone 2.3: .desc File Generation (Week 8)

#### Tasks:
1. **Format Generation**
   ```typescript
   class DescGenerator {
     generate(mappings: DescMapping[], files: FileInfo): string {
       let output = `INPUT: ${files.source}\nOUTPUT: ${files.generated}\n`;
       
       const sortedMappings = this.sortByGeneratedPosition(mappings);
       let currentLine = 1;
       
       for (const mapping of sortedMappings) {
         while (currentLine < mapping.generated.line) {
           output += '[-]\n';
           currentLine++;
         }
         output += `[${mapping.generated.column},0,${mapping.source.line},${mapping.source.column},${mapping.name || ''}]\n`;
       }
       
       return output;
     }
   }
   ```

2. **Save & Export**
   - Auto-save functionality
   - Export validation
   - Format verification
   - Integration with source control

## Technical Considerations

### Security
1. **Content Security Policy**
   ```typescript
   const nonce = getNonce();
   return `
     <meta http-equiv="Content-Security-Policy" 
           content="default-src 'none'; 
                    script-src 'nonce-${nonce}'; 
                    style-src ${webview.cspSource} 'unsafe-inline';">
   `;
   ```

2. **Path Sanitization**
   - Never expose absolute system paths
   - Validate all file paths
   - Restrict file access to workspace

### Performance
1. **Large File Handling**
   - Streaming file reader for files > 10MB
   - Virtual rendering for > 10k lines
   - Progressive loading with placeholders

2. **Memory Management**
   - Dispose resources properly
   - Use WeakMap for caching
   - Implement LRU cache for file content

### Testing Strategy
1. **Unit Tests**
   - Parser logic
   - Path resolution
   - Message protocol

2. **Integration Tests**
   - Extension activation
   - Command execution
   - File watching

3. **E2E Tests**
   - Full visualization flow
   - Editor functionality
   - Export verification

## Timeline

### Phase 1: Sourcemap Viewer (5 weeks)
- Week 1: Basic setup and infrastructure
- Week 2: Parsing and file loading
- Week 3-4: Interactive visualization
- Week 5: Advanced features and polish

### Phase 2: Visual Editor (3 weeks)
- Week 6: Editor infrastructure
- Week 7: Mapping creation
- Week 8: File generation and testing

### Buffer & Polish (2 weeks)
- Performance optimization
- Bug fixes
- Documentation
- Marketplace preparation

## Success Criteria

1. **Viewer Success Metrics**
   - Loads any valid .map file within 2 seconds
   - Smooth hover interactions (60 FPS)
   - Handles files up to 100MB
   - Works with all major bundler outputs

2. **Editor Success Metrics**
   - Intuitive mapping creation
   - Accurate .desc file generation
   - Undo/redo functionality
   - Auto-save without data loss

## Risk Mitigation

1. **Technical Risks**
   - **Large file performance**: Implement progressive loading
   - **Complex source maps**: Extensive testing with real-world examples
   - **Cross-platform paths**: Comprehensive path normalization

2. **User Experience Risks**
   - **Learning curve**: Comprehensive tooltips and documentation
   - **Accidental changes**: Confirmation dialogs for destructive actions
   - **Performance expectations**: Clear loading indicators

## Next Steps

1. Set up development environment using flake.nix
2. Initialize VSCode extension project
3. Implement basic webview infrastructure
4. Begin source map parser development
5. Create initial UI mockups for user feedback

This implementation plan provides a clear roadmap for building a professional-grade VSCode extension that surpasses existing solutions while maintaining high code quality and user experience standards.