#!/usr/bin/env node
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { convertImages } from "../lib/converter.js";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(process.cwd(), "image-converter.config.mjs");

try {
  const configModule = await import(pathToFileURL(CONFIG_PATH).href);
  const config = configModule.default;
  await convertImages(config);
} catch (e) {
  console.error("❌ Ошибка загрузки конфигурации:", e.message);
  process.exit(1);
}
