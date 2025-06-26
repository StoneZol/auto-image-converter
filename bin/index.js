#!/usr/bin/env node
import path from "path";
import { fileURLToPath } from "url";
import { convertImages } from "../lib/converter.js";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.resolve(process.cwd(), "image-converter.config.js");

try {
  const { default: config } = await import(CONFIG_PATH);
  await convertImages(config);
} catch (e) {
  console.error("❌ Ошибка загрузки конфигурации:", e.message);
  process.exit(1);
}
