const BRACE_GLOB_RE =
    /^\*\.\{([a-z0-9]+(?:,[a-z0-9]+)*)\}$/i;

/**
 * Strict input glob: only `*.{ext}` or `*.{a,b,c}`.
 * @param {string} pattern
 * @param {string} [fieldName]
 * @returns {{ pattern: string, extensions: string[] }}
 */
export function parseBraceGlob(pattern, fieldName = "converted") {
    if (typeof pattern !== "string" || !pattern.trim()) {
        throw new Error(
            `Config error: ${fieldName} must be a non-empty string like "*.{png}" or "*.{png,jpg}".`
        );
    }

    const normalized = pattern.trim().toLowerCase();
    const match = normalized.match(BRACE_GLOB_RE);

    if (!match) {
        throw new Error(
            `Config error: ${fieldName} must use *.{...} syntax (e.g. "*.{png}" or "*.{png,jpg,jpeg}"). ` +
                `Got: ${JSON.stringify(pattern)}`
        );
    }

    const extensions = match[1]
        .split(",")
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean);

    if (extensions.length === 0) {
        throw new Error(
            `Config error: ${fieldName} has no extensions inside braces.`
        );
    }

    return {
        // Keep canonical config form in `pattern`; use `fastGlob` for scanning.
        pattern: `*.{${extensions.join(",")}}`,
        fastGlob:
            extensions.length === 1
                ? `*.${extensions[0]}`
                : `*.{${extensions.join(",")}}`,
        extensions,
    };
}

/**
 * Build a brace glob from targetFormat: "webp" | "png,jpg" | null (+ fallback).
 * @param {string|null|undefined} targetFormat
 * @param {string|null|undefined} fallbackFormat
 * @returns {{ pattern: string, extensions: string[] }}
 */
export function globFromTargetFormat(targetFormat, fallbackFormat) {
    const raw =
        targetFormat === null || targetFormat === undefined
            ? fallbackFormat
            : targetFormat;

    if (typeof raw !== "string" || !raw.trim()) {
        throw new Error(
            'Config error: resize.targetFormat is required (e.g. "webp" or "png,jpg"), ' +
                "or set convertation.format as fallback."
        );
    }

    const extensions = raw
        .split(",")
        .map((ext) => ext.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean);

    if (extensions.length === 0) {
        throw new Error(
            `Config error: resize.targetFormat is empty. Got: ${JSON.stringify(targetFormat)}`
        );
    }

    return parseBraceGlob(`*.{${extensions.join(",")}}`, "resize.targetFormat");
}

/**
 * @param {string} pattern
 * @returns {string[]}
 */
export function extractExtensions(pattern) {
    return parseBraceGlob(pattern).extensions;
}
