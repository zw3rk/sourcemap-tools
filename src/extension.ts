import * as vscode from 'vscode';
import { visualizeSourcemapCommand } from './commands/visualizeSourcemap';
import { editDescriptionCommand } from './commands/editDescription';
import { openInTextEditorCommand, openInCustomEditorCommand } from './commands/toggleEditor';
import { DescEditorProvider } from './editor/DescEditorProvider';
import { MapEditorProvider } from './editor/MapEditorProvider';
import { Logger } from './common/logger';

export function activate(context: vscode.ExtensionContext): void {
    // Initialize logger
    const logger = Logger.getInstance();
    logger.log('Source Map Visualizer extension is now active!');
    
    // Show logger output channel
    logger.show();

    // Register visualize sourcemap command
    const visualizeCommand = vscode.commands.registerCommand(
        'sourcemap-visualizer.view',
        () => visualizeSourcemapCommand(context)
    );

    // Register edit description command
    const editCommand = vscode.commands.registerCommand(
        'sourcemap-visualizer.editDesc',
        () => editDescriptionCommand(context)
    );

    // Register toggle commands
    const openInTextEditorCmd = vscode.commands.registerCommand(
        'sourcemap-visualizer.openInTextEditor',
        openInTextEditorCommand
    );

    const openInCustomEditorCmd = vscode.commands.registerCommand(
        'sourcemap-visualizer.openInCustomEditor',
        openInCustomEditorCommand
    );

    // Register the custom editor providers
    const mapEditorProvider = MapEditorProvider.register(context);
    const descEditorProvider = DescEditorProvider.register(context);
    
    // Register command to show logs
    const showLogsCommand = vscode.commands.registerCommand(
        'sourcemap-visualizer.showLogs',
        () => {
            logger.show();
        }
    );

    context.subscriptions.push(
        visualizeCommand, 
        editCommand, 
        openInTextEditorCmd,
        openInCustomEditorCmd,
        mapEditorProvider,
        descEditorProvider, 
        showLogsCommand
    );
}

export function deactivate(): void {
    const logger = Logger.getInstance();
    logger.log('Source Map Visualizer extension deactivated');
    logger.dispose();
}