#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { Pipeline } from "../lib/Pipeline.js";
import { pathToFileURL } from "url";
import { globFromTargetFormat } from "../lib/globPattern.js";
import { resolveProjectPath } from "../lib/FileManager.js";

const configPath = path.resolve(
    process.cwd(),
    "image-converter.config.mjs"
);
const config = (await import(pathToFileURL(configPath).href)).default;

if (!config.resize) {
    console.error(
        "❌ Resize config is missing.\n" +
            "   Please add a 'resize' section to your config."
    );
    process.exit(1);
}

const resize = config.resize;
const convertation = config.convertation ?? {};

const scanDirRaw = resize.dir ?? config.dir ?? "./public";
const absWatchDir = resolveProjectPath(scanDirRaw);

const formatFallback = (
    convertation.format ??
    config.format ??
    "webp"
).toLowerCase();
const { extensions } = globFromTargetFormat(
    resize.targetFormat,
    formatFallback
);

const outputDirRaw =
    resize.outputDir === undefined ? null : resize.outputDir;
const absOutputDir =
    outputDirRaw === null || outputDirRaw === undefined
        ? null
        : path.isAbsolute(outputDirRaw)
          ? outputDirRaw
          : path.resolve(process.cwd(), outputDirRaw);

const SIZE_SUFFIX_RE = /-\d+w$|-\d+h$|-\d+x\d+$/i;

console.log(
    `👀 Watching for image changes (resize pipeline) on: ${absWatchDir}`
);
if (absOutputDir) {
    console.log(`   Output: ${absOutputDir}`);
}

const pipeline = new Pipeline(config, "resize");
pipeline.startWorkers();

let debounceTimeout;
let pendingFiles = new Set();

function isUnderDir(filePath, dirPath) {
    if (!dirPath) return false;
    const rel = path.relative(dirPath, filePath);
    return (
        rel === "" ||
        (!rel.startsWith("..") && !path.isAbsolute(rel))
    );
}

function shouldIgnore(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (!extensions.includes(ext)) return true;

    // Avoid loops when writing into a folder under the watch root.
    if (absOutputDir && isUnderDir(filePath, absOutputDir)) {
        return true;
    }

    // Suffix outputs when outputDir is null and removeOriginal is false.
    const base = path.basename(filePath, path.extname(filePath));
    if (SIZE_SUFFIX_RE.test(base)) {
        return true;
    }

    return false;
}

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
        if (shouldIgnore(filePath)) return;

        console.log(`➕ New image (resize): ${filePath}`);
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
    console.log("\n🛑 Stopping resize watcher...");
    await pipeline.stop();
    process.exit(0);
});
