#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { convertImages } from "../lib/converter.js";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";

const configPath = path.resolve(process.cwd(), "image-converter.config.mjs");
const config = (await import(pathToFileURL(configPath).href)).default;

const watcher = chokidar.watch(config.dir || "public", {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false,
});

console.log("👀 Watching for image changes...");

watcher.on("add", async (filePath) => {
  if (/\.(png|jpe?g)$/i.test(filePath)) {
    console.log("➕ New image:", filePath);
    await convertImages(config);
  }
});
