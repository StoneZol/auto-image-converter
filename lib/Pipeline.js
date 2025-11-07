import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { Queue } from "./Queue.js";
import { FileManager } from "./FileManager.js";
import { ConvertImages } from "./ConvertImages.js";
import { CreateSrcSet } from "./CreateSrcSet.js";
import { MarkerFile } from "./MarkerFile.js";

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
    constructor(config) {
        this.config = config ?? {};
        this.queue = new Queue();
        this.processing = new Set();
        this.activeWorkers = 0;
        this.stats = {
            total: 0,
            converted: 0,
            skipped: 0,
            failed: 0,
        };
    }

    async run() {
        const images = await this.collectImages();
        this.enqueueFiles(images);
        await this.processQueue();
        return this.stats;
    }

    async collectImages() {
        const dir = this.config.dir ?? process.cwd();
        const converted =
            this.config.convertation?.converted ??
            this.config.converted ??
            "*.{png,jpg,jpeg}";
        const recursive = this.config.recursive ?? true;

        const absDir = path.resolve(process.cwd(), dir);
        const pattern = recursive
            ? path.join(absDir, "**", converted)
            : path.join(absDir, converted);
        const unified = pattern
            .split(path.sep)
            .join(path.posix.sep);

        return fg(unified, { caseSensitiveMatch: false });
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
        this.queue.enqueue(() => this.handleFile(filePath));
        this.stats.total += 1;
        return true;
    }

    async processQueue() {
        const concurrency =
            this.config.concurrency ?? DEFAULT_CONCURRENCY;
        const workerCount = Math.max(
            1,
            Number(concurrency) || DEFAULT_CONCURRENCY
        );

        const workers = Array.from(
            { length: workerCount },
            () => this.workerLoop()
        );
        await Promise.all(workers);
    }

    async workerLoop() {
        while (true) {
            const task = this.queue.dequeue();
            if (!task) break;

            try {
                await task();
            } catch (err) {
                this.stats.failed += 1;
                this.#logError(err);
            }
        }
    }

    async handleFile(filePath) {
        try {
            const marker = new MarkerFile(filePath);

            if (
                !this.config.force &&
                marker.isMarkProcessed()
            ) {
                this.stats.skipped += 1;
                return;
            }

            if (
                typeof this.config.onFileStart ===
                "function"
            ) {
                await this.config.onFileStart(filePath);
            }

            const format = this.#resolveFormat();
            const quality =
                this.config.convertation?.quality ??
                this.config.quality ??
                80;

            const converter = new ConvertImages(
                filePath,
                format,
                quality
            );
            const buffer = await this.#convertByFormat(
                converter,
                format
            );

            const fileManager = new FileManager(filePath, {
                outputPattern:
                    this.config.convertation?.pattern ||
                    this.config.outputPattern,
                outputDir:
                    this.config.convertation?.outputDir,
            });

            const desiredPath = fileManager.resolvePath({
                ext: `.${format}`,
                marker: this.config.useMarkers
                    ? MarkerFile.MARKERS.PROCESSED
                    : null,
                outputDir:
                    this.config.convertation?.outputDir,
            });

            const { finalPath, duplicate } =
                await this.#determineOutputPath(
                    desiredPath,
                    buffer
                );

            if (duplicate) {
                this.stats.skipped += 1;
                if (this.config.removeOriginal) {
                    await fileManager.deleteFile(filePath);
                }
                if (
                    typeof this.config.onFileSkip ===
                    "function"
                ) {
                    await this.config.onFileSkip(
                        filePath,
                        "duplicate"
                    );
                }
                return;
            }

            await fs.writeFile(finalPath, buffer);

            if (this.config.useMarkers) {
                const processedMarker = new MarkerFile(
                    finalPath
                );
                await processedMarker.markProcessed();
            }

            if (
                this.config.srcset?.enabled &&
                this.config.srcset?.sizes?.length
            ) {
                await this.#generateSrcSet(finalPath);
            }

            if (this.config.removeOriginal) {
                await fileManager.deleteFile(filePath);
            }

            this.stats.converted += 1;

            if (
                typeof this.config.onFileComplete ===
                "function"
            ) {
                await this.config.onFileComplete(
                    filePath,
                    finalPath
                );
            }
        } catch (err) {
            this.stats.failed += 1;
            if (
                typeof this.config.onFileError ===
                "function"
            ) {
                await this.config.onFileError(
                    filePath,
                    err
                );
            } else {
                this.#logError(err, filePath);
            }
        } finally {
            this.processing.delete(filePath);
        }
    }

    async #convertByFormat(converter, format) {
        if (!SUPPORTED_FORMATS.has(format)) {
            throw new Error(
                `Unsupported target format: ${format}`
            );
        }

        switch (format) {
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

    async #determineOutputPath(desiredPath, buffer) {
        try {
            const stat = await fs.stat(desiredPath);

            if (stat.size === buffer.length) {
                return {
                    finalPath: desiredPath,
                    duplicate: true,
                };
            }

            const dir = path.dirname(desiredPath);
            const ext = path.extname(desiredPath);
            const name = path.basename(desiredPath, ext);

            let counter = 1;
            while (true) {
                const candidate = path.join(
                    dir,
                    `${name}(${counter})${ext}`
                );
                try {
                    const candidateStat = await fs.stat(
                        candidate
                    );
                    if (
                        candidateStat.size === buffer.length
                    ) {
                        return {
                            finalPath: candidate,
                            duplicate: true,
                        };
                    }
                    counter += 1;
                } catch {
                    return {
                        finalPath: candidate,
                        duplicate: false,
                    };
                }
            }
        } catch {
            return {
                finalPath: desiredPath,
                duplicate: false,
            };
        }
    }

    async #generateSrcSet(convertedPath) {
        const srcsetConfig = this.config.srcset;
        if (!srcsetConfig?.sizes?.length) return;

        const resizeMode =
            srcsetConfig.resizeMode ??
            CreateSrcSet.RESIZE_MODES.CONTAIN;
        const srcsetQuality =
            srcsetConfig.quality ??
            this.config.convertation?.quality ??
            80;
        const format = path.extname(convertedPath).slice(1);

        const generator = new CreateSrcSet(convertedPath, {
            format,
            quality: srcsetQuality,
            resizeMode,
        });

        const fileManager = new FileManager(convertedPath, {
            outputPattern:
                srcsetConfig.pattern ??
                FileManager.PATTERNS.SRCSET,
            outputDir: srcsetConfig.outputDir,
        });

        for (const size of srcsetConfig.sizes) {
            const width = Number(size.width ?? size.w);
            const height = Number(size.height ?? size.h);

            if (!width || !height) {
                this.#logError(
                    new Error(
                        `Invalid srcset size definition: ${JSON.stringify(
                            size
                        )}`
                    ),
                    convertedPath
                );
                continue;
            }

            const buffer = await generator.create(
                width,
                height
            );
            await fileManager.saveSrcSet(buffer, {
                width,
                height,
                format,
                marker: this.config.useMarkers
                    ? MarkerFile.MARKERS.SRCSET
                    : null,
                outputDir: srcsetConfig.outputDir,
            });
        }
    }

    #resolveFormat() {
        const format = (
            this.config.convertation?.format ??
            this.config.format ??
            "webp"
        ).toLowerCase();
        if (!SUPPORTED_FORMATS.has(format)) {
            throw new Error(
                `Unsupported target format: ${format}`
            );
        }
        return format;
    }

    #logError(err, filePath) {
        if (filePath) {
            console.error(
                `❌ ${filePath}:`,
                err.message ?? err
            );
        } else {
            console.error(
                "❌ Pipeline error:",
                err.message ?? err
            );
        }
    }
}
