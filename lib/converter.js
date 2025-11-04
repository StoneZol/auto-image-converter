import fg from "fast-glob";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

sharp.cache(false);

const supportedExt = [".png", ".jpg", ".jpeg"];

const processingFiles = new Set();

async function safeUnlink(
    file,
    retries = 3,
    delayMs = 200
) {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.unlink(file);
            return;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise((res) =>
                setTimeout(res, delayMs)
            );
        }
    }
}

async function getUniqueOutputPath(outFile, newBufferSize) {
    try {
        const existingStat = await fs.stat(outFile);

        // Если размеры совпадают - скорее всего это дубликат
        if (existingStat.size === newBufferSize) {
            return null; // Сигнал пропустить файл
        }

        // Размеры разные - нужно уникальное имя
        const dir = path.dirname(outFile);
        const ext = path.extname(outFile);
        const nameWithoutExt = path.basename(outFile, ext);

        let counter = 1;
        let uniquePath;

        while (true) {
            uniquePath = path.join(
                dir,
                `${nameWithoutExt}(${counter})${ext}`
            );

            try {
                const stat = await fs.stat(uniquePath);
                // Если файл с таким именем существует и размер совпадает - это дубликат
                if (stat.size === newBufferSize) {
                    return null;
                }
                counter++;
            } catch {
                // Файл не существует - можем использовать это имя
                return uniquePath;
            }
        }
    } catch {
        // Файл не существует - используем оригинальное имя
        return outFile;
    }
}

export async function convertImages({
    dir,
    converted,
    format,
    quality,
    recursive,
    removeOriginal,
}) {
    const rawPattern = recursive
        ? path.join(dir, "**", converted)
        : path.join(dir, converted);

    const pattern = rawPattern
        .split(path.sep)
        .join(path.posix.sep);
    const files = await fg(pattern, {
        caseSensitiveMatch: false,
    });

    for (const file of files) {
        if (processingFiles.has(file)) continue;
        processingFiles.add(file);

        try {
            const ext = path.extname(file);
            let outFile = file.replace(ext, `.${format}`);

            // Игнорируем файлы, которые уже в целевом формате
            if (
                ext.toLowerCase() ===
                `.${format.toLowerCase()}`
            ) {
                processingFiles.delete(file);
                continue;
            }

            const image = sharp(file);
            const buffer =
                format === "webp"
                    ? await image
                          .webp({ quality })
                          .toBuffer()
                    : await image
                          .avif({ quality })
                          .toBuffer();

            // Проверяем, не существует ли уже файл с таким именем
            const finalPath = await getUniqueOutputPath(
                outFile,
                buffer.length
            );

            if (finalPath === null) {
                // Файл с таким же размером уже существует - это дубликат
                console.log(
                    `⊘ ${file} → skipped (duplicate)`
                );

                // Удаляем оригинал-дубликат, если включена опция
                if (removeOriginal) {
                    await safeUnlink(file);
                    console.log(`🗑️  ${file} → deleted`);
                }

                processingFiles.delete(file);
                continue;
            }

            outFile = finalPath;

            await fs.writeFile(outFile, buffer);

            if (removeOriginal) {
                await safeUnlink(file);
            }

            console.log(`✓ ${file} → ${outFile}`);
        } catch (err) {
            console.error(
                "Error covertation:",
                err.message
            );
        } finally {
            processingFiles.delete(file);
        }
    }
}
