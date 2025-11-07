#!/usr/bin/env node
import { ConvertationPipeline } from "../lib/pipelines/ConvertationPipeline.js";
import { pathToFileURL } from "url";
import path from "path";

const configPath = path.resolve(
    process.cwd(),
    "image-converter.config.mjs"
);
const config = (
    await import(pathToFileURL(configPath).href)
).default;

const pipeline = new ConvertationPipeline(config);
await pipeline.run();
