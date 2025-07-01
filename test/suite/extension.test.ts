import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('zw3rk.source-map-visualizer'));
    });

    test('Should register all commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(commands.includes('sourcemap-visualizer.view'));
        assert.ok(commands.includes('sourcemap-visualizer.editDesc'));
    });

    test('Should activate successfully', async () => {
        const ext = vscode.extensions.getExtension('zw3rk.source-map-visualizer');
        assert.ok(ext);
        
        await ext.activate();
        assert.ok(ext.isActive);
    });
});