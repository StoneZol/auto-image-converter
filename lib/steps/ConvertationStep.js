import path from "node:path";
import fs from "node:fs/promises";
import crypto from "crypto";
import { ConvertImages } from "../ConvertImages.js";
import { FileManager } from "../FileManager.js";
import { MarkerFile } from "../MarkerFile.js";

export class ConvertationStep {
    constructor(config) {
        this.config = config;
        this.supportedExtensions = this.#parseExtensions(
            config.converted ||
                "*.{png,jpg,jpeg,webp,avif,tiff}"
        );
    }

    // Парсим расширения из паттерна converted
    #parseExtensions(pattern) {
        const match = pattern.match(/\*\.\{(.+?)\}/);
        if (match) {
            return match[1]
                .split(",")
                .map((ext) => `.${ext.trim()}`);
        }

        // Если паттерн типа "*.png"
        const simpleMatch = pattern.match(/\*\.(\w+)/);
        if (simpleMatch) {
            return [`.${simpleMatch[1]}`];
        }

        // Fallback
        return [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".avif",
            ".tiff",
        ];
    }

    // Основной метод - конвертация одного файла
    async execute(filePath) {
        const initialPath = filePath; // сохраняем начальный путь
        let skipOriginalCheck = false; // флаг что мы только что переименовали .processed → .original
        let wasRenamed = false; // флаг что файл был переименован

        try {
            // 1. Проверка маркеров (пропускаем обработанные файлы)
            if (!this.config.force) {
                const marker = new MarkerFile(filePath);

                // Проверяем файлы с маркером .processed
                if (marker.isMarkProcessed()) {
                    const currentFormat = path
                        .extname(filePath)
                        .slice(1)
                        .toLowerCase();
                    const targetFormat = (
                        this.config.format || "webp"
                    ).toLowerCase();

                    // Если формат совпадает - пропускаем
                    if (currentFormat === targetFormat) {
                        return {
                            success: false,
                            skipped: true,
                            reason: "already_processed",
                            originalPath: filePath,
                        };
                    }

                    // Формат не совпадает - нужна переконвертация
                    // Проверяем, есть ли .original файл с таким же именем
                    const cleanName =
                        marker.removeAllMarkers();
                    const dir = path.dirname(filePath);
                    const ext = path.extname(filePath);
                    const originalPath = path.join(
                        dir,
                        `${cleanName}.original${ext}`
                    );

                    const fm = new FileManager(filePath);
                    const originalExists = await fm.exists(
                        originalPath
                    );

                    if (originalExists) {
                        // Есть .original - это устаревший .processed
                        // Просто удаляем и пропускаем (оригинал будет обработан отдельно)
                        await fm.deleteFile(filePath);
                        return {
                            success: false,
                            skipped: true,
                            reason: "outdated_processed_removed",
                            originalPath: filePath,
                        };
                    } else {
                        // Нет .original с таким же расширением
                        // Проверяем, нет ли .original с другим расширением
                        const hasAnyOriginal =
                            await this.#checkAnyOriginalExists(
                                filePath,
                                cleanName
                            );

                        if (hasAnyOriginal) {
                            // Есть другой .original - это устаревший .processed, удаляем
                            await fm.deleteFile(filePath);
                            return {
                                success: false,
                                skipped: true,
                                reason: "outdated_processed_removed_other_original_exists",
                                originalPath: filePath,
                            };
                        }

                        // Нет ни одного .original - этот .processed становится оригиналом
                        const newPath =
                            await marker.addMarker(
                                MarkerFile.MARKERS.ORIGINAL
                            );

                        // Обновляем filePath и marker для продолжения конвертации
                        filePath = newPath;
                        wasRenamed = true; // помечаем что файл был переименован
                        marker.filePath = newPath;
                        marker.dir = path.dirname(newPath);
                        marker.ext = path.extname(newPath);
                        marker.nameWithoutExt =
                            path.basename(
                                newPath,
                                marker.ext
                            );

                        skipOriginalCheck = true; // пропускаем проверку .original ниже
                        // НЕ возвращаем - продолжаем выполнение!
                    }
                }

                // Если файл с маркером .original - проверяем, существует ли результат
                if (
                    !skipOriginalCheck &&
                    this.config.markerOriginal &&
                    marker.isMarkOriginal()
                ) {
                    const targetFormat = (
                        this.config.format || "webp"
                    ).toLowerCase();
                    const cleanName =
                        marker.removeAllMarkers();

                    const fm = new FileManager(filePath, {
                        outputDir: this.config.outputDir,
                    });

                    const expectedOutputPath =
                        fm.resolvePath({
                            name: cleanName, // чистое имя без маркеров
                            ext: `.${targetFormat}`,
                            marker: this.config
                                .markerProcessed
                                ? "processed"
                                : null,
                            outputDir:
                                this.config.outputDir,
                        });

                    // Если результат существует - пропускаем
                    if (
                        await fm.exists(expectedOutputPath)
                    ) {
                        // Если нужно удалять оригинал - удаляем его
                        if (this.config.removeOriginal) {
                            await fm.deleteFile(filePath);
                        }

                        return {
                            success: false,
                            skipped: true,
                            reason: "already_converted_output_exists",
                            originalPath: filePath,
                            outputPath: expectedOutputPath,
                        };
                    }

                    // Результата нет - продолжаем конвертацию
                }
            }

            // 2. Проверка расширения (пропускаем если уже в нужном формате)
            const currentExt = path
                .extname(filePath)
                .slice(1)
                .toLowerCase();
            const targetFormat = (
                this.config.format || "webp"
            ).toLowerCase();

            if (currentExt === targetFormat) {
                // Если это .original файл уже в целевом формате
                const marker = new MarkerFile(filePath);
                if (
                    marker.isMarkOriginal() &&
                    this.config.removeOriginal
                ) {
                    // Удаляем, т.к. результат уже есть
                    const fm = new FileManager(filePath);
                    await fm.deleteFile(filePath);
                    return {
                        success: false,
                        skipped: true,
                        reason: "original_in_target_format_removed",
                        originalPath: filePath,
                    };
                }

                return {
                    success: false,
                    skipped: true,
                    reason: "already_target_format",
                    originalPath: filePath,
                };
            }

            // 3. Конвертация
            const quality = this.config.quality || 80;

            // Читаем файл в буфер сразу, чтобы освободить дескриптор
            const sourceBuffer = await fs.readFile(
                filePath
            );

            const converter = new ConvertImages(
                sourceBuffer, // передаем буфер, а не путь к файлу
                targetFormat,
                quality
            );
            const buffer = await this.#convertByFormat(
                converter,
                targetFormat
            );

            // 4. Подготовка к сохранению
            // Убираем все маркеры из имени файла перед созданием результата
            const originalMarker = new MarkerFile(filePath);
            const cleanName =
                originalMarker.removeAllMarkers();

            const fm = new FileManager(filePath, {
                outputDir: this.config.outputDir,
                outputPattern: this.config.pattern,
            });

            const desiredPath = fm.resolvePath({
                name: cleanName, // используем чистое имя без маркеров
                ext: `.${targetFormat}`,
                marker: this.config.markerProcessed
                    ? "processed"
                    : null,
                outputDir: this.config.outputDir,
            });

            // Проверка: если файл .original и результат уже существует - удаляем оригинал
            if (
                originalMarker.isMarkOriginal() &&
                (await fm.exists(desiredPath))
            ) {
                if (this.config.removeOriginal) {
                    await fm.deleteFile(filePath);
                    return {
                        success: false,
                        skipped: true,
                        reason: "original_removed_result_exists",
                        originalPath: filePath,
                        outputPath: desiredPath,
                    };
                } else {
                    return {
                        success: false,
                        skipped: true,
                        reason: "result_already_exists",
                        originalPath: filePath,
                        outputPath: desiredPath,
                    };
                }
            }

            // 5. Проверка дубликатов
            const { finalPath, duplicate } =
                await this.#checkDuplicate(
                    desiredPath,
                    buffer
                );

            if (duplicate) {
                // Удаляем оригинал-дубликат если нужно
                if (this.config.removeOriginal) {
                    await fm.deleteFile(filePath);
                }
                return {
                    success: false,
                    skipped: true,
                    reason: "duplicate",
                    originalPath: filePath,
                    outputPath: finalPath,
                };
            }

            // 6. Сохранение
            const dir = path.dirname(finalPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(finalPath, buffer);

            // 7. Добавление маркера к оригиналу (если включено)
            if (
                this.config.markerOriginal &&
                !this.config.removeOriginal
            ) {
                const originalMarker = new MarkerFile(
                    filePath
                );
                await originalMarker.markOriginal();
            }

            // 8. Удаление оригинала (если включено)
            if (this.config.removeOriginal) {
                console.log(
                    `[DEBUG] Deleting original: ${filePath}`
                );
                await fm.deleteFile(filePath);
            }

            return {
                success: true,
                skipped: false,
                outputPath: finalPath,
                originalPath: filePath,
                format: targetFormat,
            };
        } catch (error) {
            return {
                success: false,
                skipped: false,
                error: error.message,
                originalPath: filePath,
            };
        }
    }

    // Проверить существование .original файлов с любым расширением
    async #checkAnyOriginalExists(filePath, cleanName) {
        const dir = path.dirname(filePath);

        for (const ext of this.supportedExtensions) {
            const candidatePath = path.join(
                dir,
                `${cleanName}.original${ext}`
            );
            const fm = new FileManager(candidatePath);

            if (await fm.exists(candidatePath)) {
                return true;
            }
        }

        return false;
    }

    // Приватный метод конвертации по формату
    async #convertByFormat(converter, format) {
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
                    `Unsupported format: ${format}`
                );
        }
    }

    // Приватный метод проверки дубликатов (гибридный: размер + хеш)
    async #checkDuplicate(desiredPath, buffer) {
        try {
            const stat = await fs.stat(desiredPath);

            // 1. Быстрая проверка по размеру
            if (stat.size !== buffer.length) {
                // Размеры разные - точно не дубликат
                // Ищем уникальное имя с (N)
                return await this.#findUniqueName(
                    desiredPath,
                    buffer
                );
            }

            // 2. Размеры совпали - проверяем хеш (точная проверка)
            const existingFm = new FileManager(desiredPath);
            const existingHash =
                await existingFm.getFileHash();

            const bufferHash = crypto
                .createHash("sha256")
                .update(buffer)
                .digest("hex");

            if (existingHash === bufferHash) {
                // Хеши совпали - это точно дубликат
                return {
                    finalPath: desiredPath,
                    duplicate: true,
                };
            }

            // Размеры одинаковые, но хеши разные - разные файлы
            return await this.#findUniqueName(
                desiredPath,
                buffer
            );
        } catch {
            // Файл не существует - используем оригинальное имя
            return {
                finalPath: desiredPath,
                duplicate: false,
            };
        }
    }

    // Вспомогательный метод поиска уникального имени
    async #findUniqueName(desiredPath, buffer) {
        const dir = path.dirname(desiredPath);
        const ext = path.extname(desiredPath);
        const name = path.basename(desiredPath, ext);

        const bufferHash = crypto
            .createHash("sha256")
            .update(buffer)
            .digest("hex");

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

                // Проверяем размер
                if (candidateStat.size !== buffer.length) {
                    counter++;
                    continue;
                }

                // Размер совпал - проверяем хеш
                const candidateFm = new FileManager(
                    candidate
                );
                const candidateHash =
                    await candidateFm.getFileHash();

                if (candidateHash === bufferHash) {
                    return {
                        finalPath: candidate,
                        duplicate: true,
                    };
                }

                counter++;
            } catch {
                // Файл не существует - используем это имя
                return {
                    finalPath: candidate,
                    duplicate: false,
                };
            }
        }
    }
}
