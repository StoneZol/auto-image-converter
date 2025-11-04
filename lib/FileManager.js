import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export class FileManager {
    // Предустановленные паттерны
    static PATTERNS = {
        SAME_DIR: "{dir}/{name}{marker}{ext}",
        THUMBS: "{dir}/thumbs/{name}{marker}{ext}",
        ORIGINAL_NAME:
            "{dir}/{original}/{name}{marker}{ext}",
        SRCSET: "{dir}/srcset/{original}/{size}-{name}{marker}{ext}",
        CUSTOM: null,
    };

    constructor(filePath, options = {}) {
        this.filePath = filePath;
        this.outputPattern =
            options.outputPattern ||
            FileManager.PATTERNS.SAME_DIR;

        // Парсим путь
        this.dir = path.dirname(filePath);
        this.ext = path.extname(filePath);
        this.nameWithoutExt = path.basename(
            filePath,
            this.ext
        );
        this.fullName = path.basename(filePath);
    }

    // Заменить плейсхолдеры в паттерне
    resolvePath(customData = {}) {
        const pattern =
            customData.pattern || this.outputPattern;

        // Если абсолютный путь - используем как есть
        if (
            path.isAbsolute(pattern) &&
            !pattern.includes("{")
        ) {
            return pattern;
        }

        // Доступные плейсхолдеры
        const placeholders = {
            "{dir}": this.dir,
            "{name}":
                customData.name || this.nameWithoutExt,
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
                value
            );
        }

        return resolved;
    }

    // Сохранить буфер с учетом всех параметров
    async save(buffer, customData = {}) {
        const outputPath = this.resolvePath(customData);

        // Создаем директорию если не существует
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    // Сохранить результат ConvertImage
    async saveConverted(buffer, format, marker = null) {
        return this.save(buffer, {
            ext: `.${format}`,
            marker: marker,
            format: format,
        });
    }

    // Сохранить srcset элемент
    async saveSrcSet(
        buffer,
        { width, height, format, marker = null }
    ) {
        return this.save(buffer, {
            width,
            height,
            size: `${width}x${height}`,
            ext: `.${format}`,
            marker: marker,
            format: format,
        });
    }

    // Получить хэш файла
    async getFileHash() {
        const buffer = await fs.readFile(this.filePath);
        return crypto
            .createHash("sha256")
            .update(buffer)
            .digest("hex");
    }

    // Получить размер файла
    async getFileSize() {
        const stats = await fs.stat(this.filePath);
        return stats.size;
    }

    // Удалить файл
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
                await new Promise((res) =>
                    setTimeout(res, delayMs)
                );
            }
        }
    }

    // Проверить существование
    async exists(filePath = this.filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Переименовать
    async rename(newPath) {
        await fs.rename(this.filePath, newPath);
        this.filePath = newPath;
        return newPath;
    }
}
