// Base64 VLQ encoding for source maps
// Based on https://github.com/mozilla/source-map

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT; // 32
const VLQ_BASE_MASK = VLQ_BASE - 1; // 31
const VLQ_CONTINUATION_BIT = VLQ_BASE; // 32

/**
 * Encode an integer to Base64 VLQ
 */
export function encodeVLQ(value: number): string {
    let encoded = '';
    let digit: number;
    
    // Convert to VLQ signed format
    let vlq = value < 0 ? ((-value) << 1) + 1 : (value << 1);
    
    do {
        digit = vlq & VLQ_BASE_MASK;
        vlq >>>= VLQ_BASE_SHIFT;
        
        if (vlq > 0) {
            // There are still more digits in this value, so we must make sure the
            // continuation bit is marked
            digit |= VLQ_CONTINUATION_BIT;
        }
        
        encoded += BASE64_CHARS[digit];
    } while (vlq > 0);
    
    return encoded;
}

/**
 * Decode a Base64 VLQ string to an array of integers
 */
export function decodeVLQ(encoded: string): number[] {
    const decoded: number[] = [];
    let i = 0;
    
    while (i < encoded.length) {
        let vlq = 0;
        let shift = 0;
        let continuation = true;
        
        while (continuation) {
            const char = encoded[i++];
            if (char === undefined) {
                throw new Error('Unexpected end of VLQ string');
            }
            const digit = BASE64_CHARS.indexOf(char);
            
            if (digit === -1) {
                throw new Error('Invalid Base64 VLQ character');
            }
            
            continuation = (digit & VLQ_CONTINUATION_BIT) !== 0;
            vlq += (digit & VLQ_BASE_MASK) << shift;
            shift += VLQ_BASE_SHIFT;
        }
        
        // Convert from VLQ signed format
        const value = (vlq & 1) === 1 ? -(vlq >> 1) : vlq >> 1;
        decoded.push(value);
    }
    
    return decoded;
}

/**
 * Encode an array of integers as a Base64 VLQ string
 */
export function encodeVLQArray(values: number[]): string {
    return values.map(encodeVLQ).join('');
}