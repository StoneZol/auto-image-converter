const BRACE_GLOB_RE =
    /^\*\.\{([a-z0-9]+(?:,[a-z0-9]+)*)\}$/i;
const EXT_RE = /^[a-z0-9]+$/;

/**
 * Parse format list used in convertation.converted / resize.targetFormat.
 *
 * Preferred: "png" | "png,jpg,jpeg"
 * Also accepted (legacy): "*.{png}" | "*.{png,jpg}"
 *
 * @param {string} value
 * @param {string} [fieldName]
 * @returns {{ extensions: string[], fastGlob: string, pattern: string }}
 */
export function parseFormats(value, fieldName = "formats") {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(
            `Config error: ${fieldName} must be a non-empty format list ` +
                `like "png" or "png,jpg,jpeg" (legacy "*.{png,jpg}" also ok).`
        );
    }

    const normalized = value.trim().toLowerCase();
    let extensions;

    const brace = normalized.match(BRACE_GLOB_RE);
    if (brace) {
        extensions = brace[1]
            .split(",")
            .map((ext) => ext.trim())
            .filter(Boolean);
    } else {
        extensions = normalized
            .split(",")
            .map((ext) => ext.trim().replace(/^\./, ""))
            .filter(Boolean);
    }

    if (
        extensions.length === 0 ||
        extensions.some((ext) => !EXT_RE.test(ext))
    ) {
        throw new Error(
            `Config error: ${fieldName} must be formats like "png" or "png,jpg,jpeg" ` +
                `(or legacy "*.{png,jpg}"). Got: ${JSON.stringify(value)}`
        );
    }

    return {
        extensions,
        // Canonical display / docs form
        pattern: extensions.join(","),
        // fast-glob: single ext without braces (micromatch quirk)
        fastGlob:
            extensions.length === 1
                ? `*.${extensions[0]}`
                : `*.{${extensions.join(",")}}`,
    };
}

/**
 * Like parseFormats, but null/undefined → fallbackFormat string.
 * @param {string|null|undefined} value
 * @param {string|null|undefined} fallbackFormat
 * @param {string} [fieldName]
 */
export function parseFormatsOrFallback(
    value,
    fallbackFormat,
    fieldName = "formats"
) {
    const raw =
        value === null || value === undefined ? fallbackFormat : value;

    if (typeof raw !== "string" || !raw.trim()) {
        throw new Error(
            `Config error: ${fieldName} is required (e.g. "webp" or "png,jpg"), ` +
                "or set convertation.format as fallback."
        );
    }

    return parseFormats(raw, fieldName);
}

/** @deprecated use parseFormats — kept for older imports */
export function parseBraceGlob(pattern, fieldName = "converted") {
    return parseFormats(pattern, fieldName);
}

/** @deprecated use parseFormatsOrFallback */
export function globFromTargetFormat(targetFormat, fallbackFormat) {
    return parseFormatsOrFallback(
        targetFormat,
        fallbackFormat,
        "resize.targetFormat"
    );
}

/**
 * @param {string} value
 * @returns {string[]}
 */
export function extractExtensions(value) {
    return parseFormats(value).extensions;
}
