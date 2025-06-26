#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { convertImages } from "../lib/converter.js";
import { pathToFileURL } from "url";

const configPath = path.resolve(process.cwd(), "image-converter.config.mjs");
const config = (await import(pathToFileURL(configPath).href)).default;

const watchDir = config.dir || "public";
const absWatchDir = path.resolve(process.cwd(), watchDir);
const extensions = extractExtensions(config.converted ?? "*.{png,jpg,jpeg}");

const watchPath = absWatchDir;

console.log(`👀 Watching for image changes on directory: ${watchPath}`);

let debounceTimeout;

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
    const ext = path.extname(filePath).slice(1).toLowerCase(); // без точки
    if (!extensions.includes(ext)) return;
    if (ext === (config.targetFormat ?? "webp").toLowerCase()) return;

    console.log(`➕ New image: ${filePath}`);
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      try {
        await convertImages({
          dir: watchPath,
          converted: config.converted ?? "*.{png,jpg,jpeg}",
          format: config.format ?? "webp",
          quality: config.quality ?? 80,
          recursive: config.recursive ?? true,
          removeOriginal: config.removeOriginal ?? false,
        });
      } catch (err) {
        console.error("Error covertation:", err.message);
      }
    }, 1000);
  });

function extractExtensions(pattern) {
  const match = pattern.match(/\*\.\{(.+?)\}/);
  return match ? match[1].split(",").map((s) => s.trim().toLowerCase()) : [];
}
