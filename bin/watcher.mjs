#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { Pipeline } from "../lib/Pipeline.js";
import { pathToFileURL } from "url";

const configPath = path.resolve(process.cwd(), "image-converter.config.mjs");
const config = (await import(pathToFileURL(configPath).href)).default;

const watchDir = config.dir || "public";
const absWatchDir = path.resolve(process.cwd(), watchDir);
const extensions = extractExtensions(
    config.convertation?.converted ?? config.converted ?? "*.{png,jpg,jpeg}"
);
const targetFormat = (
    config.convertation?.format ?? config.format ?? "webp"
).toLowerCase();

const watchPath = absWatchDir;

console.log(`👀 Watching for image changes on directory: ${watchPath}`);

// Создаём Pipeline и запускаем воркеров в постоянном режиме
const pipeline = new Pipeline(config);
pipeline.startWorkers();

let debounceTimeout;
let pendingFiles = new Set();

chokidar
    .watch(absWatchDir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: config.ignoreOnStart ?? false,
        awaitWriteFinish: {
            stabilityThreshold: 1500,
            pollInterval: 500,
        },
    })
    .on("add", async (filePath) => {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (!extensions.includes(ext)) return;
        if (ext === targetFormat) return;

        console.log(`➕ New image: ${filePath}`);
        pendingFiles.add(filePath);

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            // Обрабатываем все накопленные файлы
            const filesToProcess = Array.from(pendingFiles);
            pendingFiles.clear();

            for (const file of filesToProcess) {
                pipeline.enqueueFile(file);
            }
            // Воркеры уже работают, просто добавляем задачи в очередь
        }, 1000);
    });

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping watcher...");
    await pipeline.stop();
    process.exit(0);
});

function extractExtensions(pattern) {
    const match = pattern.match(/\*\.\{(.+?)\}/);
    return match
        ? match[1].split(",").map((s) => s.trim().toLowerCase())
        : [];
}
