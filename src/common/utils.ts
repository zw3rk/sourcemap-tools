// Utility functions used across the extension

/**
 * Generate a nonce for Content Security Policy
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    
    return function (this: unknown, ...args: Parameters<T>): void {
        const later = (): void => {
            timeout = undefined;
            func.apply(this, args);
        };
        
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filepath: string): boolean {
    if (process.platform === 'win32') {
        // Windows absolute paths
        return /^[a-zA-Z]:[\\/]/.test(filepath) || filepath.startsWith('\\\\');
    }
    // Unix absolute paths
    return filepath.startsWith('/');
}