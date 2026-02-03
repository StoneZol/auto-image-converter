import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Queue } from "./Queue.js";
import { FileManager } from "./FileManager.js";
import { ResizeImages } from "./ResizeImages.js";
import { ConvertImages } from "./ConvertImages.js";

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
        this.isRunning = false;
        this.workers = [];
        this.stats = {
            total: 0,
            converted: 0,
            skipped: 0,
            failed: 0,
        };
    }

    async run() {
        this.#validateConfig();
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
        this.queue.enqueue((workerId) => this.handleFile(filePath, workerId));
        this.stats.total += 1;
        return true;
    }

    /**
     * Разовый режим: обрабатывает все файлы и завершается.
     */
    async processQueue() {
        const concurrency =
            this.config.concurrency ?? DEFAULT_CONCURRENCY;
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

    /**
     * Постоянный режим: запускает воркеров в фоне, они работают пока не остановить.
     * Для watcher'а.
     */
    startWorkers() {
        if (this.isRunning) {
            return;
        }

        this.#validateConfig();
        this.isRunning = true;

        const concurrency =
            this.config.concurrency ?? DEFAULT_CONCURRENCY;
        const workerCount = Math.max(
            1,
            Number(concurrency) || DEFAULT_CONCURRENCY
        );

        this.workers = Array.from(
            { length: workerCount },
            (_, index) => this.#workerLoop(true, index + 1)
        );
    }

    /**
     * Остановить постоянных воркеров.
     */
    async stop() {
        this.isRunning = false;
        // Ждём завершения всех воркеров
        await Promise.all(this.workers);
        this.workers = [];
    }

    /**
     * Внутренний цикл воркера.
     * @param {boolean} continuous - если true, работает постоянно; если false, завершается когда очередь пуста
     * @param {number} workerId - номер воркера (для логирования)
     */
    async #workerLoop(continuous, workerId) {
        while (true) {
            const task = this.queue.dequeue();

            if (!task) {
                if (continuous && this.isRunning) {
                    // В постоянном режиме ждём немного перед следующей проверкой
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    continue;
                } else {
                    // В разовом режиме завершаемся
                    break;
                }
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
            const format = this.#resolveFormat();
            const quality =
                this.config.convertation?.quality ?? 80;

            // Читаем файл в буфер для корректной обработки путей с кириллицей/спецсимволами
            const sourceBuffer = await fs.readFile(filePath);

            // Шаг 1: Опциональный resize
            let sharpInstance = sharp(sourceBuffer);
            if (this.config.needResize && this.config.resize) {
                const resizeConfig = this.config.resize;
                const resizeOptions = {
                    fit: resizeConfig.fit ?? "cover",
                    position: resizeConfig.position ?? "center",
                    withoutEnlargement:
                        resizeConfig.withoutEnlargement ?? true,
                };

                const resizer = new ResizeImages(sourceBuffer, resizeOptions);

                if (resizeConfig.width && resizeConfig.height) {
                    // Оба размера заданы → toBox
                    sharpInstance = resizer.toBox(
                        resizeConfig.width,
                        resizeConfig.height,
                        resizeOptions
                    );
                } else if (resizeConfig.width) {
                    // Только ширина → byWidth
                    sharpInstance = resizer.byWidth(
                        resizeConfig.width,
                        resizeOptions
                    );
                } else if (resizeConfig.height) {
                    // Только высота → byHeight
                    sharpInstance = resizer.byHeight(
                        resizeConfig.height,
                        resizeOptions
                    );
                }
            }

            // Шаг 2: Конвертация
            const converter = new ConvertImages(sharpInstance, {
                quality,
            });
            const convertedSharp = this.#convertByFormat(
                converter,
                format
            );
            const buffer = await convertedSharp.toBuffer();

            // Шаг 3: Сохранение
            const fileManager = new FileManager(filePath, {
                outputPattern:
                    this.config.convertation?.pattern ||
                    FileManager.PATTERNS.SAME_DIR,
                outputDir: this.config.convertation?.outputDir,
            });

            // В режиме ресайза: если removeOriginal: false, добавляем размер в имя
            // Если removeOriginal: true, перезаписываем файл (тот же путь)
            let outputPath;
            if (this.config.isResizeMode && this.config.resize) {
                if (this.config.removeOriginal) {
                    // Перезапись: используем тот же путь
                    outputPath = filePath;
                } else {
                    // Сохраняем с размером в имени: image.webp → image-1920x1080.webp
                    const resizeConfig = this.config.resize;
                    const width = resizeConfig.width;
                    const height = resizeConfig.height;
                    
                    const baseName = path.basename(filePath, path.extname(filePath));
                    const dir = path.dirname(filePath);
                    let sizeSuffix = "";
                    
                    if (width && height) {
                        sizeSuffix = `-${width}x${height}`;
                    } else if (width) {
                        sizeSuffix = `-${width}w`;
                    } else if (height) {
                        sizeSuffix = `-${height}h`;
                    }
                    
                    outputPath = path.join(dir, `${baseName}${sizeSuffix}.${format}`);
                }
            } else {
                // Обычный режим (не ресайз)
                outputPath = fileManager.resolvePath({
                    ext: `.${format}`,
                    outputDir: this.config.convertation?.outputDir,
                });
            }

            // Создаём директорию если нужно
            const dir = path.dirname(outputPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(outputPath, buffer);

            // Шаг 4: Удаление оригинала (если нужно)
            // Не удаляем, если файл был перезаписан (outputPath === filePath)
            if (this.config.removeOriginal && outputPath !== filePath) {
                await fileManager.deleteFile(filePath);
            }

            this.stats.converted += 1;

            // Логирование успешной конвертации
            const workerInfo = workerId ? `[Worker #${workerId}]` : "";
            console.log(
                `✅ ${workerInfo} ${filePath} → ${outputPath}`
            );
        } catch (err) {
            this.stats.failed += 1;
            this.#logError(err, filePath);
        } finally {
            this.processing.delete(filePath);
        }
    }

    #convertByFormat(converter, format) {
        if (!SUPPORTED_FORMATS.has(format)) {
            throw new Error(
                `Unsupported target format: ${format}`
            );
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

    #validateConfig() {
        // Проверка формата
        const format = this.#resolveFormat();
        if (!SUPPORTED_FORMATS.has(format)) {
            throw new Error(
                `Unsupported target format: ${format}. Supported: ${Array.from(SUPPORTED_FORMATS).join(", ")}`
            );
        }

        // Проверка resize конфига
        if (this.config.needResize) {
            if (!this.config.resize) {
                throw new Error(
                    "Config error: needResize is true, but resize config is missing"
                );
            }

            const { width, height } = this.config.resize;

            // Оба размера null → ошибка
            if (width === null && height === null) {
                throw new Error(
                    "Config error: needResize is true, but both width and height are null. At least one must be specified."
                );
            }

            // Проверка на валидные числовые значения (если заданы)
            if (width !== null && (typeof width !== "number" || width <= 0)) {
                throw new Error(
                    `Config error: resize.width must be a positive number, got: ${width}`
                );
            }

            if (height !== null && (typeof height !== "number" || height <= 0)) {
                throw new Error(
                    `Config error: resize.height must be a positive number, got: ${height}`
                );
            }
        }
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
