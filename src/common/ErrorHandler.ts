import * as vscode from 'vscode';
import { Logger } from './logger';

export interface ErrorContext {
    operation: string;
    details?: Record<string, unknown>;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with consistent logging and user notification
     */
    public handleError(error: unknown, context: ErrorContext): void {
        const errorMessage = this.extractErrorMessage(error);
        const fullMessage = `${context.operation}: ${errorMessage}`;
        
        // Log the full error with context
        this.logger.log('Error occurred', {
            operation: context.operation,
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            details: context.details
        });

        // Show user-friendly error message
        void vscode.window.showErrorMessage(fullMessage);
    }

    /**
     * Handle an error without showing a notification (for non-critical errors)
     */
    public logError(error: unknown, context: ErrorContext): void {
        const errorMessage = this.extractErrorMessage(error);
        
        this.logger.log('Error occurred (silent)', {
            operation: context.operation,
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            details: context.details
        });
    }

    /**
     * Wrap an async function with error handling
     */
    public async wrapAsync<T>(
        fn: () => Promise<T>,
        context: ErrorContext
    ): Promise<T | undefined> {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }

    /**
     * Wrap a sync function with error handling
     */
    public wrapSync<T>(
        fn: () => T,
        context: ErrorContext
    ): T | undefined {
        try {
            return fn();
        } catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }

    /**
     * Create a wrapped version of an async function that handles errors
     */
    public createAsyncHandler<TArgs extends unknown[], TReturn>(
        fn: (...args: TArgs) => Promise<TReturn>,
        contextGenerator: (...args: TArgs) => ErrorContext
    ): (...args: TArgs) => Promise<TReturn | undefined> {
        return async (...args: TArgs) => {
            const context = contextGenerator(...args);
            return this.wrapAsync(() => fn(...args), context);
        };
    }

    /**
     * Extract a user-friendly error message from an unknown error
     */
    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
        }
        
        return 'Unknown error occurred';
    }

    /**
     * Check if an error is a specific VS Code error type
     */
    public isFileNotFoundError(error: unknown): boolean {
        if (error instanceof Error) {
            return error.message.includes('ENOENT') || 
                   error.message.includes('File not found') ||
                   error.message.includes('Unable to read file');
        }
        return false;
    }

    /**
     * Check if an error is a cancellation error
     */
    public isCancellationError(error: unknown): boolean {
        if (error instanceof Error) {
            return error.name === 'Canceled' || 
                   error.message.includes('Canceled') ||
                   error.message.includes('cancelled');
        }
        return false;
    }
}