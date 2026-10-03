import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { FileManager, resolveProjectPath } from "../lib/FileManager.js";
import {
    parseFormats,
    parseFormatsOrFallback,
} from "../lib/globPattern.js";

describe("resolveProjectPath — scan/output dir from config", () => {
    it('./public/og from cwd → <cwd>/public/og (not relative to the image file)', () => {
        const resolved = resolveProjectPath("./public/og");
        assert.equal(resolved, path.resolve(process.cwd(), "./public/og"));
    });

    it("absolute path is kept as-is (no cwd join)", () => {
        const absolute = path.resolve("/tmp/images");
        assert.equal(resolveProjectPath(absolute), absolute);
    });
});

describe("FileManager outputDir — 3.0 path rules", () => {
    const source = path.join(
        process.cwd(),
        "public",
        "og",
        "heroes",
        "cat.png"
    );
    const scanDir = path.join(process.cwd(), "public", "og");

    it("outputDir null → write next to source (…/og/heroes)", () => {
        const fm = new FileManager(source);
        assert.equal(fm.resolveOutputDir(null), path.dirname(source));
    });

    it('relative "./public/converted" → <cwd>/public/converted (flat, NOT …/og/public/converted)', () => {
        const fm = new FileManager(source, {
            scanDir,
            outputDirMode: "flat",
        });
        const dir = fm.resolveOutputDir("./public/converted");
        assert.equal(
            dir,
            path.resolve(process.cwd(), "./public/converted")
        );
        assert.ok(
            !dir.endsWith(`${path.sep}cat`),
            "must not append filename as a subfolder (2.2.x absolute bug)"
        );
    });

    it("absolute outputDir → same folder, flat (no …/converted/cat/ subfolder)", () => {
        const absolute = path.resolve(process.cwd(), "public", "converted");
        const fm = new FileManager(source);
        assert.equal(fm.resolveOutputDir(absolute), absolute);
    });

    it("mirror: og/heroes/cat.png → converted/heroes (keeps subfolder under scanDir)", () => {
        const fm = new FileManager(source, {
            scanDir,
            outputDirMode: "mirror",
        });
        const dir = fm.resolveOutputDir("./public/converted");
        assert.equal(
            dir,
            path.resolve(process.cwd(), "public", "converted", "heroes")
        );
    });

    it("flat resolvePath: og/heroes/cat.png + webp → <cwd>/public/converted/cat.webp", () => {
        const fm = new FileManager(source, {
            scanDir,
            outputDirMode: "flat",
        });
        const out = fm.resolvePath({
            ext: ".webp",
            outputDir: "./public/converted",
        });
        assert.equal(
            out,
            path.resolve(process.cwd(), "public", "converted", "cat.webp")
        );
    });
});

describe("parseFormats — converted / targetFormat (comma list)", () => {
    it('accepts "png" and "png,jpg,jpeg"', () => {
        assert.deepEqual(parseFormats("png").extensions, ["png"]);
        assert.equal(parseFormats("png").fastGlob, "*.png");
        assert.deepEqual(parseFormats("png,jpg,jpeg").extensions, [
            "png",
            "jpg",
            "jpeg",
        ]);
        assert.equal(parseFormats("png,jpg,jpeg").fastGlob, "*.{png,jpg,jpeg}");
    });

    it('legacy "*.{png,jpg}" still works', () => {
        assert.deepEqual(parseFormats("*.{png,jpg}").extensions, [
            "png",
            "jpg",
        ]);
    });

    it('rejects invalid "*.png" glob (use "png" or "*.{png}")', () => {
        assert.throws(() => parseFormats("*.png"), /must be formats/);
    });

    it('targetFormat null → fallback convertation.format "webp" → *.webp', () => {
        assert.equal(
            parseFormatsOrFallback(null, "webp", "resize.targetFormat")
                .fastGlob,
            "*.webp"
        );
        assert.equal(
            parseFormatsOrFallback("png,jpg", "webp").fastGlob,
            "*.{png,jpg}"
        );
    });
});
