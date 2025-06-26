#!/usr/bin/env node
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { convertImages } from "../lib/converter.js";

const CONFIG_PATH = path.resolve(process.cwd(), "image-converter.config.mjs");

try {
  const configModule = await import(pathToFileURL(CONFIG_PATH).href);
  const config = configModule.default;

  const absDir = path.resolve(
    process.cwd(),
    config.source || config.dir || "."
  );

  await convertImages({
    dir: absDir,
    converted: config.converted ?? "*.{png,jpg,jpeg}",
    targetFormat: config.targetFormat ?? "webp",
    quality: config.quality ?? 80,
    recursive: config.recursive ?? true,
    removeOriginal: config.removeOriginal ?? false,
  });
} catch (e) {
  console.error("❌ Ошибка загрузки конфигурации:", e.message);
  process.exit(1);
}
