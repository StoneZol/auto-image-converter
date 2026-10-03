import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Queue } from "./Queue.js";
import { FileManager, resolveProjectPath } from "./FileManager.js";
import { ResizeImages } from "./ResizeImages.js";
import { ConvertImages } from "./ConvertImages.js";
import {
    parseBraceGlob,
    globFromTargetFormat,
} from "./globPattern.js";

const DEFAULT_CONCURRENCY = 4;
const SUPPORTED_FORMATS = new Set([
    "webp",
    "avif",
    "png",
    "jpg",
    "jpeg",
    "tiff",
]);

export class Pipeline {
    /**
     * @param {Object} config
     * @param {"convert"|"resize"} [mode]
     */
    constructor(config, mode = "convert") {
        this.rawConfig = config ?? {};
        this.mode = mode;
        this.queue = new Queue();
        this.processing = new Set();
        this.isRunning = false;
        this.workers = [];
        this.stats = {
            total: 0,
            converted: 0,
            skipped: 0,
            failed: 0,
        };
        this._legacyWarned = false;
        this.resolved = null;
    }

    async run() {
        this.resolved = this.#resolveRuntimeConfig();
        this.#validateConfig();
        const images = await this.collectImages();
        this.enqueueFiles(images);
        await this.processQueue();
        return this.stats;
    }

    async collectImages() {
        if (!this.resolved) {
            this.resolved = this.#resolveRuntimeConfig();
        }

        const { scanDir, inputGlob, recursive } = this.resolved;
        const pattern = recursive
            ? path.join(scanDir, "**", inputGlob)
            : path.join(scanDir, inputGlob);
        const unified = pattern.split(path.sep).join(path.posix.sep);

        return fg(unified, {
            caseSensitiveMatch: false,
            onlyFiles: true,
        });
    }

    enqueueFiles(files) {
        for (const file of files) {
            this.enqueueFile(file);
        }
    }

    enqueueFile(filePath) {
        if (!filePath || this.processing.has(filePath)) {
            return false;
        }

        this.processing.add(filePath);
        this.queue.enqueue((workerId) =>
            this.handleFile(filePath, workerId)
        );
        this.stats.total += 1;
        return true;
    }

    async processQueue() {
        const concurrency =
            this.rawConfig.concurrency ?? DEFAULT_CONCURRENCY;
        const workerCount = Math.max(
            1,
            Number(concurrency) || DEFAULT_CONCURRENCY
        );

        const workers = Array.from(
            { length: workerCount },
            (_, index) => this.#workerLoop(false, index + 1)
        );
        await Promise.all(workers);
    }

    startWorkers() {
        if (this.isRunning) {
            return;
        }

        this.resolved = this.#resolveRuntimeConfig();
        this.#validateConfig();
        this.isRunning = true;

        const concurrency =
            this.rawConfig.concurrency ?? DEFAULT_CONCURRENCY;
        const workerCount = Math.max(
            1,
            Number(concurrency) || DEFAULT_CONCURRENCY
        );

        this.workers = Array.from(
            { length: workerCount },
            (_, index) => this.#workerLoop(true, index + 1)
        );
    }

    async stop() {
        this.isRunning = false;
        await Promise.all(this.workers);
        this.workers = [];
    }

    async #workerLoop(continuous, workerId) {
        while (true) {
            const task = this.queue.dequeue();

            if (!task) {
                if (continuous && this.isRunning) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, 100)
                    );
                    continue;
                }
                break;
            }

            try {
                await task(workerId);
            } catch (err) {
                this.stats.failed += 1;
                this.#logError(err);
            }
        }
    }

    async handleFile(filePath, workerId = null) {
        try {
            if (!this.resolved) {
                this.resolved = this.#resolveRuntimeConfig();
            }

            if (this.mode === "resize") {
                await this.#handleResizeFile(filePath, workerId);
            } else {
                await this.#handleConvertFile(filePath, workerId);
            }
        } catch (err) {
            this.stats.failed += 1;
            this.#logError(err, filePath);
        } finally {
            this.processing.delete(filePath);
        }
    }

    async #handleConvertFile(filePath, workerId) {
        const {
            format,
            quality,
            needResize,
            needResizeOriginal,
            removeOriginal,
            outputDir,
            outputDirMode,
            scanDir,
            resizeGeometry,
            resizeOutputDir,
        } = this.resolved;

        const currentExt = path
            .extname(filePath)
            .slice(1)
            .toLowerCase();

        if (currentExt === format || (format === "jpg" && currentExt === "jpeg") || (format === "jpeg" && currentExt === "jpg")) {
            this.stats.skipped += 1;
            console.log(
                `⊘ ${filePath} → skipped (already ${format})`
            );
            return;
        }

        const sourceBuffer = await fs.readFile(filePath);
        let sharpInstance = sharp(sourceBuffer);

        if (needResize) {
            sharpInstance = this.#applyResize(
                sourceBuffer,
                resizeGeometry
            );
        }

        if (needResizeOriginal) {
            const originalBuffer = await this.#encodeByFormat(
                sharpInstance.clone(),
                currentExt,
                quality
            );
            const originalFm = new FileManager(filePath, {
                scanDir,
                outputDir: resizeOutputDir,
                outputDirMode:
                    this.rawConfig.resize?.outputDirMode || "flat",
            });
            const originalPath = originalFm.resolvePath({
                ext: `.${currentExt}`,
                outputDir: resizeOutputDir,
            });
            await fs.mkdir(path.dirname(originalPath), {
                recursive: true,
            });
            await fs.writeFile(originalPath, originalBuffer);
            console.log(
                `📐 ${filePath} → ${originalPath} (resized original)`
            );
        }

        const converter = new ConvertImages(sharpInstance, {
            quality,
        });
        const convertedSharp = this.#convertByFormat(
            converter,
            format
        );
        const buffer = await convertedSharp.toBuffer();

        const fileManager = new FileManager(filePath, {
            scanDir,
            outputDir,
            outputDirMode,
        });
        const outputPath = fileManager.resolvePath({
            ext: `.${format}`,
            outputDir,
        });

        if (
            path.resolve(outputPath) === path.resolve(filePath) &&
            !needResize
        ) {
            this.stats.skipped += 1;
            console.log(`⊘ ${filePath} → skipped (no-op)`);
            return;
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, buffer);

        if (removeOriginal && path.resolve(outputPath) !== path.resolve(filePath)) {
            await fileManager.deleteFile(filePath);
        }

        this.stats.converted += 1;
        const workerInfo = workerId ? `[Worker #${workerId}]` : "";
        console.log(`✅ ${workerInfo} ${filePath} → ${outputPath}`);
    }

    async #handleResizeFile(filePath, workerId) {
        const {
            quality,
            removeOriginal,
            outputDir,
            outputDirMode,
            scanDir,
            resizeGeometry,
        } = this.resolved;

        const sourceExt = path
            .extname(filePath)
            .slice(1)
            .toLowerCase();
        const sourceBuffer = await fs.readFile(filePath);
        const resizedSharp = this.#applyResize(
            sourceBuffer,
            resizeGeometry
        );
        const buffer = await this.#encodeByFormat(
            resizedSharp,
            sourceExt,
            quality
        );

        let outputPath;
        if (outputDir === null || outputDir === undefined) {
            if (removeOriginal) {
                outputPath = filePath;
            } else {
                const sizeSuffix = this.#sizeSuffix(resizeGeometry);
                const baseName = path.basename(
                    filePath,
                    path.extname(filePath)
                );
                outputPath = path.join(
                    path.dirname(filePath),
                    `${baseName}${sizeSuffix}.${sourceExt}`
                );
            }
        } else {
            const fileManager = new FileManager(filePath, {
                scanDir,
                outputDir,
                outputDirMode,
            });
            outputPath = fileManager.resolvePath({
                ext: `.${sourceExt}`,
                outputDir,
            });
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, buffer);

        if (
            removeOriginal &&
            path.resolve(outputPath) !== path.resolve(filePath)
        ) {
            const fm = new FileManager(filePath);
            await fm.deleteFile(filePath);
        }

        this.stats.converted += 1;
        const workerInfo = workerId ? `[Worker #${workerId}]` : "";
        console.log(`✅ ${workerInfo} ${filePath} → ${outputPath}`);
    }

    #applyResize(sourceBuffer, resizeConfig) {
        const resizeOptions = {
            fit: resizeConfig.fit ?? "cover",
            position: resizeConfig.position ?? "center",
            withoutEnlargement:
                resizeConfig.withoutEnlargement ?? true,
        };
        const resizer = new ResizeImages(sourceBuffer, resizeOptions);

        if (resizeConfig.width && resizeConfig.height) {
            return resizer.toBox(
                resizeConfig.width,
                resizeConfig.height,
                resizeOptions
            );
        }
        if (resizeConfig.width) {
            return resizer.byWidth(resizeConfig.width, resizeOptions);
        }
        if (resizeConfig.height) {
            return resizer.byHeight(
                resizeConfig.height,
                resizeOptions
            );
        }
        throw new Error(
            "Config error: resize needs width and/or height."
        );
    }

    #sizeSuffix(resizeConfig) {
        const { width, height } = resizeConfig;
        if (width && height) return `-${width}x${height}`;
        if (width) return `-${width}w`;
        if (height) return `-${height}h`;
        return "";
    }

    async #encodeByFormat(sharpInstance, format, quality) {
        const normalized = format.toLowerCase();
        switch (normalized) {
            case "webp":
                return sharpInstance.webp({ quality }).toBuffer();
            case "avif":
                return sharpInstance.avif({ quality }).toBuffer();
            case "png":
                return sharpInstance.png({ quality }).toBuffer();
            case "jpg":
            case "jpeg":
                return sharpInstance.jpeg({ quality }).toBuffer();
            case "tiff":
                return sharpInstance.tiff({ quality }).toBuffer();
            default:
                throw new Error(
                    `Unsupported encode format: ${format}`
                );
        }
    }

    #convertByFormat(converter, format) {
        if (!SUPPORTED_FORMATS.has(format)) {
            throw new Error(`Unsupported target format: ${format}`);
        }

        switch (format.toLowerCase()) {
            case "webp":
                return converter.toWebp();
            case "avif":
                return converter.toAvif();
            case "png":
                return converter.toPng();
            case "jpg":
            case "jpeg":
                return converter.toJpg();
            case "tiff":
                return converter.toTiff();
            default:
                throw new Error(
                    `Unsupported target format: ${format}`
                );
        }
    }

    #warnLegacyOnce(message) {
        if (this._legacyWarned) return;
        this._legacyWarned = true;
        console.warn(`⚠️  ${message}`);
    }

    #resolveRuntimeConfig() {
        const cfg = this.rawConfig;
        const convertation = cfg.convertation ?? {};
        const resize = cfg.resize ?? {};
        const recursive = cfg.recursive ?? true;
        const quality = convertation.quality ?? 80;

        if (cfg.dir !== undefined && convertation.dir === undefined) {
            this.#warnLegacyOnce(
                "Top-level `dir` is deprecated. Use convertation.dir and/or resize.dir."
            );
        }
        if (
            cfg.removeOriginal !== undefined &&
            convertation.removeOriginal === undefined &&
            resize.removeOriginal === undefined
        ) {
            this.#warnLegacyOnce(
                "Top-level `removeOriginal` is deprecated. Use convertation.removeOriginal and/or resize.removeOriginal."
            );
        }
        if (
            cfg.needResize !== undefined &&
            convertation.needResize === undefined
        ) {
            this.#warnLegacyOnce(
                "Top-level `needResize` is deprecated. Use convertation.needResize."
            );
        }

        if (this.mode === "resize") {
            const scanDirRaw =
                resize.dir ?? cfg.dir ?? "./public";
            const scanDir = resolveProjectPath(scanDirRaw);
            const formatFallback = (
                convertation.format ??
                cfg.format ??
                "webp"
            ).toLowerCase();
            const { fastGlob: inputGlob } = globFromTargetFormat(
                resize.targetFormat,
                formatFallback
            );

            if (!resize || (!resize.width && !resize.height)) {
                throw new Error(
                    "Config error: resize section with width and/or height is required for the resize command."
                );
            }

            return {
                scanDir,
                inputGlob,
                recursive,
                quality,
                removeOriginal:
                    resize.removeOriginal ??
                    cfg.removeOriginal ??
                    false,
                outputDir:
                    resize.outputDir === undefined
                        ? null
                        : resize.outputDir,
                outputDirMode: resize.outputDirMode || "flat",
                resizeGeometry: resize,
                needResize: true,
                needResizeOriginal: false,
                format: null,
                resizeOutputDir: null,
            };
        }

        // convert / watch
        const scanDirRaw =
            convertation.dir ?? cfg.dir ?? "./public";
        const scanDir = resolveProjectPath(scanDirRaw);
        const convertedRaw =
            convertation.converted ??
            cfg.converted ??
            "*.{png,jpg,jpeg}";
        const parsedConverted = parseBraceGlob(
            convertedRaw,
            "convertation.converted"
        );
        const inputGlob = parsedConverted.fastGlob;

        const format = (
            convertation.format ??
            cfg.format ??
            "webp"
        ).toLowerCase();

        const needResize =
            convertation.needResize ?? cfg.needResize ?? false;
        const needResizeOriginal =
            convertation.needResizeOriginal ?? false;

        const outputDir =
            convertation.outputDir === undefined
                ? null
                : convertation.outputDir;
        const outputDirMode =
            convertation.outputDirMode || "flat";

        const resizeOutputDir =
            resize.outputDir === undefined ? null : resize.outputDir;

        if (
            outputDir === null &&
            parsedConverted.extensions.includes(format)
        ) {
            console.warn(
                `⚠️  convertation.converted includes target format "${format}" and outputDir is null — risk of reprocessing outputs. Prefer a separate outputDir or exclude "${format}" from converted.`
            );
        }

        return {
            scanDir,
            inputGlob,
            recursive,
            quality,
            format,
            needResize,
            needResizeOriginal,
            removeOriginal:
                convertation.removeOriginal ??
                cfg.removeOriginal ??
                false,
            outputDir,
            outputDirMode,
            resizeGeometry: resize,
            resizeOutputDir,
        };
    }

    #validateConfig() {
        if (!this.resolved) {
            this.resolved = this.#resolveRuntimeConfig();
        }

        if (this.mode === "convert") {
            const { format, needResize, needResizeOriginal, resizeOutputDir, resizeGeometry } =
                this.resolved;

            if (!SUPPORTED_FORMATS.has(format)) {
                throw new Error(
                    `Unsupported target format: ${format}. Supported: ${Array.from(SUPPORTED_FORMATS).join(", ")}`
                );
            }

            if (needResizeOriginal && !needResize) {
                throw new Error(
                    "Config error: convertation.needResizeOriginal requires convertation.needResize: true."
                );
            }

            if (needResizeOriginal && (resizeOutputDir === null || resizeOutputDir === undefined)) {
                throw new Error(
                    "Config error: convertation.needResizeOriginal requires resize.outputDir."
                );
            }

            if (needResize) {
                this.#validateResizeGeometry(resizeGeometry);
            }
        } else {
            this.#validateResizeGeometry(this.resolved.resizeGeometry);
        }
    }

    #validateResizeGeometry(resize) {
        if (!resize) {
            throw new Error(
                "Config error: needResize/resize command requires a resize section."
            );
        }

        const { width, height } = resize;

        if (
            (width === null || width === undefined) &&
            (height === null || height === undefined)
        ) {
            throw new Error(
                "Config error: resize.width and/or resize.height must be set."
            );
        }

        if (
            width !== null &&
            width !== undefined &&
            (typeof width !== "number" || width <= 0)
        ) {
            throw new Error(
                `Config error: resize.width must be a positive number, got: ${width}`
            );
        }

        if (
            height !== null &&
            height !== undefined &&
            (typeof height !== "number" || height <= 0)
        ) {
            throw new Error(
                `Config error: resize.height must be a positive number, got: ${height}`
            );
        }
    }

    #logError(err, filePath) {
        if (filePath) {
            console.error(`❌ ${filePath}:`, err.message ?? err);
        } else {
            console.error("❌ Pipeline error:", err.message ?? err);
        }
    }
}
