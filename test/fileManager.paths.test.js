import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { FileManager, resolveProjectPath } from "../lib/FileManager.js";
import {
    parseBraceGlob,
    globFromTargetFormat,
} from "../lib/globPattern.js";

describe("resolveProjectPath", () => {
    it("resolves relative paths from cwd", () => {
        const resolved = resolveProjectPath("./public/og");
        assert.equal(resolved, path.resolve(process.cwd(), "./public/og"));
    });

    it("keeps absolute paths", () => {
        const absolute = path.resolve("/tmp/images");
        assert.equal(resolveProjectPath(absolute), absolute);
    });
});

describe("FileManager.resolveOutputDir", () => {
    const source = path.join(
        process.cwd(),
        "public",
        "og",
        "heroes",
        "cat.png"
    );

    it("null outputDir → next to source", () => {
        const fm = new FileManager(source);
        assert.equal(fm.resolveOutputDir(null), path.dirname(source));
    });

    it("relative outputDir → from cwd, flat (no name subfolder)", () => {
        const fm = new FileManager(source, {
            scanDir: path.join(process.cwd(), "public", "og"),
            outputDirMode: "flat",
        });
        const dir = fm.resolveOutputDir("./public/converted");
        assert.equal(
            dir,
            path.resolve(process.cwd(), "./public/converted")
        );
        assert.ok(!dir.endsWith("cat"));
    });

    it("absolute outputDir → flat, no nameWithoutExt folder", () => {
        const absolute = path.resolve(process.cwd(), "public", "converted");
        const fm = new FileManager(source);
        assert.equal(fm.resolveOutputDir(absolute), absolute);
    });

    it("mirror keeps relative subfolders under scanDir", () => {
        const scanDir = path.join(process.cwd(), "public", "og");
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

    it("resolvePath builds flat file path from cwd-relative outputDir", () => {
        const fm = new FileManager(source, {
            scanDir: path.join(process.cwd(), "public", "og"),
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

describe("globPattern", () => {
    it("accepts *.{png} and *.{png,jpg}", () => {
        assert.deepEqual(parseBraceGlob("*.{png}").extensions, ["png"]);
        assert.deepEqual(parseBraceGlob("*.{png,jpg,jpeg}").extensions, [
            "png",
            "jpg",
            "jpeg",
        ]);
    });

    it("rejects *.png", () => {
        assert.throws(() => parseBraceGlob("*.png"), /must use \*\.\{\.\.\.\}/);
    });

    it("builds glob from targetFormat", () => {
        const single = globFromTargetFormat("webp", "avif");
        assert.equal(single.pattern, "*.{webp}");
        assert.equal(single.fastGlob, "*.webp");
        assert.equal(globFromTargetFormat(null, "webp").fastGlob, "*.webp");
        assert.equal(
            globFromTargetFormat("png,jpg", "webp").fastGlob,
            "*.{png,jpg}"
        );
    });
});
