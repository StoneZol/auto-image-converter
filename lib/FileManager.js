import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export class FileManager {
    static PATTERNS = {
        SAME_DIR: "{dir}/{name}{marker}{ext}",
        THUMBS: "{dir}/thumbs/{name}{marker}{ext}",
        ORIGINAL_NAME: "{dir}/{original}/{name}{marker}{ext}",
        SRCSET: "{dir}/srcset/{original}/{size}-{name}{marker}{ext}",
        CUSTOM: null,
    };

    /**
     * @param {string} filePath
     * @param {Object} [options]
     * @param {string|null} [options.outputPattern]
     * @param {string|null} [options.outputDir]
     * @param {string|null} [options.scanDir] - resolved scan root (convertation.dir / resize.dir)
     * @param {"flat"|"mirror"} [options.outputDirMode]
     */
    constructor(filePath, options = {}) {
        this.filePath = filePath;
        this.outputPattern =
            options.outputPattern || FileManager.PATTERNS.SAME_DIR;
        this.defaultOutputDir =
            options.outputDir === undefined ? null : options.outputDir;
        this.scanDir = options.scanDir
            ? path.resolve(options.scanDir)
            : null;
        this.outputDirMode = options.outputDirMode || "flat";

        this.dir = path.dirname(filePath);
        this.ext = path.extname(filePath);
        this.nameWithoutExt = path.basename(filePath, this.ext);
        this.fullName = path.basename(filePath);
    }

    /**
     * Resolve directory for output (no filename subfolder).
     * - null → next to source
     * - relative → from process.cwd()
     * - absolute → as-is
     * - mirror → append relative path from scanDir to source's folder
     */
    resolveOutputDir(outputDir) {
        const targetDir =
            outputDir !== undefined ? outputDir : this.defaultOutputDir;

        if (targetDir === null || targetDir === undefined || targetDir === "") {
            return this.dir;
        }

        const base = path.isAbsolute(targetDir)
            ? targetDir
            : path.resolve(process.cwd(), targetDir);

        if (this.outputDirMode === "mirror" && this.scanDir) {
            const relativeDir = path.relative(this.scanDir, this.dir);
            if (
                relativeDir &&
                relativeDir !== "." &&
                !relativeDir.startsWith("..") &&
                !path.isAbsolute(relativeDir)
            ) {
                return path.join(base, relativeDir);
            }
        }

        return base;
    }

    resolvePath(customData = {}) {
        const pattern = customData.pattern || this.outputPattern;

        if (path.isAbsolute(pattern) && !pattern.includes("{")) {
            return pattern;
        }

        const outputDir = this.resolveOutputDir(customData.outputDir);

        const placeholders = {
            "{dir}": outputDir,
            "{name}": customData.name || this.nameWithoutExt,
            "{ext}": customData.ext || this.ext,
            "{original}": this.nameWithoutExt,
            "{marker}": customData.marker
                ? `.${customData.marker}`
                : "",
            "{width}": customData.width || "",
            "{height}": customData.height || "",
            "{size}":
                customData.size ||
                (customData.width && customData.height
                    ? `${customData.width}x${customData.height}`
                    : ""),
            "{format}": customData.format || "",
            "{quality}": customData.quality || "",
        };

        let resolved = pattern;
        for (const [placeholder, value] of Object.entries(
            placeholders
        )) {
            resolved = resolved.replace(
                new RegExp(
                    placeholder.replace(/[{}]/g, "\\$&"),
                    "g"
                ),
                String(value)
            );
        }

        // Patterns use `/`; normalize for the host OS (esp. Windows).
        return path.normalize(resolved);
    }

    async save(buffer, customData = {}) {
        const outputPath = this.resolvePath(customData);
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    async saveConverted(buffer, format, marker = null, options = {}) {
        return this.save(buffer, {
            ext: `.${format}`,
            marker: marker,
            format: format,
            outputDir: options.outputDir,
        });
    }

    async saveSrcSet(
        buffer,
        { width, height, format, marker = null, outputDir }
    ) {
        return this.save(buffer, {
            width,
            height,
            size: `${width}x${height}`,
            ext: `.${format}`,
            marker: marker,
            format: format,
            outputDir: outputDir,
        });
    }

    async getFileHash() {
        const buffer = await fs.readFile(this.filePath);
        return crypto.createHash("sha256").update(buffer).digest("hex");
    }

    async getFileSize() {
        const stats = await fs.stat(this.filePath);
        return stats.size;
    }

    async deleteFile(
        filePath = this.filePath,
        retries = 3,
        delayMs = 200
    ) {
        for (let i = 0; i < retries; i++) {
            try {
                await fs.unlink(filePath);
                return true;
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise((res) => setTimeout(res, delayMs));
            }
        }
    }

    async exists(filePath = this.filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async rename(newPath) {
        await fs.rename(this.filePath, newPath);
        this.filePath = newPath;
        return newPath;
    }
}

/**
 * Resolve scan/output directory: relative from cwd, absolute as-is.
 * @param {string} dir
 * @returns {string}
 */
export function resolveProjectPath(dir) {
    if (typeof dir !== "string" || !dir.trim()) {
        throw new Error("Config error: dir must be a non-empty string.");
    }
    return path.isAbsolute(dir)
        ? dir
        : path.resolve(process.cwd(), dir);
}
