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
    const config = configModule.default;

    if (!config) {
        console.error(
            `❌ Config file is empty or doesn't export default config.\n` +
            `   File: ${CONFIG_PATH}`
        );
        process.exit(1);
    }

    const pipeline = new Pipeline(config);
    const stats = await pipeline.run();

    console.log(`\n✅ Processing complete:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Converted: ${stats.converted}`);
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
