#!/usr/bin/env node
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import { Pipeline } from "../lib/Pipeline.js";

const CONFIG_PATH = path.resolve(
    process.cwd(),
    "image-converter.config.mjs"
);

try {
    // Проверяем существование конфига
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(
            `❌ Config file not found: ${CONFIG_PATH}\n` +
            `   Please create 'image-converter.config.mjs' in the current directory.`
        );
        process.exit(1);
    }

    const configModule = await import(
        pathToFileURL(CONFIG_PATH).href
    );
    const originalConfig = configModule.default;

    if (!originalConfig) {
        console.error(
            `❌ Config file is empty or doesn't export default config.\n` +
            `   File: ${CONFIG_PATH}`
        );
        process.exit(1);
    }

    // Проверяем, что в конфиге есть resize настройки
    if (!originalConfig.resize) {
        console.error(
            `❌ Resize config is missing.\n` +
            `   Please add 'resize' section to your config.`
        );
        process.exit(1);
    }

    // Создаём модифицированный конфиг для ресайза уже сконвертированных файлов
    const targetFormat = (
        originalConfig.convertation?.format ?? originalConfig.format ?? "webp"
    ).toLowerCase();

    const resizeConfig = {
        ...originalConfig,
        // Ищем файлы в целевом формате (уже сконвертированные)
        convertation: {
            ...originalConfig.convertation,
            converted: `*.${targetFormat}`, // только файлы в целевом формате (без фигурных скобок для одного формата)
            format: targetFormat, // оставляем тот же формат (не конвертируем)
        },
        // Принудительно включаем ресайз
        needResize: true,
        resize: originalConfig.resize,
        // Используем removeOriginal из конфига
        removeOriginal: originalConfig.removeOriginal ?? false,
        // Флаг для режима ресайза (чтобы Pipeline знал, что нужно добавлять размер в имя)
        isResizeMode: true,
    };

    console.log(`🔄 Resizing already converted ${targetFormat.toUpperCase()} files...`);
    console.log(`   Resize config: ${JSON.stringify(originalConfig.resize, null, 2)}\n`);

    const pipeline = new Pipeline(resizeConfig);
    const stats = await pipeline.run();

    console.log(`\n✅ Resize complete:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Resized: ${stats.converted}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Failed: ${stats.failed}`);
} catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" && e.message.includes("image-converter.config.mjs")) {
        console.error(
            `❌ Config file not found: ${CONFIG_PATH}\n` +
            `   Please create 'image-converter.config.mjs' in the current directory.`
        );
    } else {
        console.error(
            "❌ Error:",
            e.message
        );
        if (e.stack) {
            console.error(e.stack);
        }
    }
    process.exit(1);
}
