#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { Pipeline } from "../lib/Pipeline.js";
import { pathToFileURL } from "url";
import { parseFormats } from "../lib/globPattern.js";
import { resolveProjectPath } from "../lib/FileManager.js";

const configPath = path.resolve(
    process.cwd(),
    "image-converter.config.mjs"
);
const config = (await import(pathToFileURL(configPath).href)).default;

const convertation = config.convertation ?? {};
const scanDirRaw =
    convertation.dir ?? config.dir ?? "./public";
const absWatchDir = resolveProjectPath(scanDirRaw);

const convertedRaw =
    convertation.converted ??
    config.converted ??
    "png,jpg,jpeg";
const { extensions } = parseFormats(
    convertedRaw,
    "convertation.converted"
);

const targetFormat = (
    convertation.format ?? config.format ?? "webp"
).toLowerCase();

console.log(
    `👀 Watching for image changes (convert pipeline) on: ${absWatchDir}`
);

const pipeline = new Pipeline(config, "convert");
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
        if (
            (targetFormat === "jpg" && ext === "jpeg") ||
            (targetFormat === "jpeg" && ext === "jpg")
        ) {
            return;
        }

        console.log(`➕ New image: ${filePath}`);
        pendingFiles.add(filePath);

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            const filesToProcess = Array.from(pendingFiles);
            pendingFiles.clear();

            for (const file of filesToProcess) {
                pipeline.enqueueFile(file);
            }
        }, 1000);
    });

process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping watcher...");
    await pipeline.stop();
    process.exit(0);
});
