import * as vscode from 'vscode';

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    
    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Source Map Visualizer');
    }
    
    static getInstance(): Logger {
        if (Logger.instance === undefined) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    
    log(message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        if (args.length > 0) {
            this.outputChannel.appendLine(formattedMessage);
            args.forEach(arg => {
                this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
            });
        } else {
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    error(message: string, error?: unknown): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ERROR: ${message}`;
        this.outputChannel.appendLine(formattedMessage);
        
        if (error !== undefined && error !== null) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`  ${error.message}`);
                if (error.stack !== undefined && error.stack !== null && error.stack !== '') {
                    this.outputChannel.appendLine(`  Stack: ${error.stack}`);
                }
            } else {
                this.outputChannel.appendLine(`  ${JSON.stringify(error, null, 2)}`);
            }
        }
    }
    
    warn(message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] WARN: ${message}`;
        
        if (args.length > 0) {
            this.outputChannel.appendLine(formattedMessage);
            args.forEach(arg => {
                this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
            });
        } else {
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    show(): void {
        this.outputChannel.show();
    }
    
    clear(): void {
        this.outputChannel.clear();
    }
    
    dispose(): void {
        this.outputChannel.dispose();
    }
}