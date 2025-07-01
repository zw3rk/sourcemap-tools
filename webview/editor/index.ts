// State-based editor entry point
import { StateBasedDescEditor } from './stateEditor';

// Make this a module
export {};

// Initialize the state-based editor
(window as any).descEditor = new StateBasedDescEditor();