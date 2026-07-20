export function isNullOrEmpty(value: string | null | undefined): boolean {
    if (value == null) {
        return true;
    }

    const trimExtended = (input: string): string =>
        input
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g, '');

    const normalizedValue = trimExtended(value);
    if (normalizedValue.length === 0) {
        return true;
    }

    const quotedValueMatch = normalizedValue.match(/^(["'])([\s\S]*)\1$/);
    if (!quotedValueMatch) {
        return false;
    }

    const insideQuotes = trimExtended(quotedValueMatch[2]);
    return insideQuotes.length === 0;
}
