#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { convertImages } from "../lib/converter.js";
import { pathToFileURL } from "url";

const configPath = path.resolve(process.cwd(), "image-converter.config.mjs");
const config = (await import(pathToFileURL(configPath).href)).default;

const watchDir = config.dir || "public";
const absWatchDir = path.resolve(process.cwd(), watchDir);

// Для chokidar лучше передать просто папку, а не glob
const watchPath = absWatchDir;

console.log(`👀 Watching for image changes on directory: ${watchPath}`);

chokidar
  .watch(watchPath, {
    ignored: /(^|[\/\\])\../, // игнор скрытых файлов и папок
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500, // ждем, пока запись в файл закончится
      pollInterval: 100,
    },
  })
  .on("add", async (filePath) => {
    if (/\.(png|jpe?g)$/i.test(filePath)) {
      console.log(`➕ New image: ${filePath}`);
      try {
        await convertImages({
          dir: watchPath,
          format: config.targetFormat || config.format || "webp",
          quality: config.quality ?? 80,
          recursive: config.recursive ?? true,
          removeOriginal: config.removeOriginal ?? false,
        });
      } catch (err) {
        console.error("Ошибка при конвертации:", err.message);
      }
    }
  });
