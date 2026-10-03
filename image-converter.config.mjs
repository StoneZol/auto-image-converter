export default {
    // Shared by convert/watch and the resize CLI:
    // Walk subfolders under the active command's `dir`.
    recursive: true,

    // How many files to process in parallel.
    concurrency: 4,

    // Ignore existing files when the watcher starts (watch mode only).
    ignoreOnStart: true,

    // --- convert + watch (auto-convert-images / auto-convert-images-watch) ---
    convertation: {
        // Folder to scan for sources. Relative = from cwd, or use an absolute path.
        dir: "./public/og",

        // After a successful convert: delete the source file from convertation.dir?
        // Does not delete outputs in convertation.outputDir or resize.outputDir.
        removeOriginal: true,

        // Input glob. ONLY *.{...} syntax.
        // One type: *.{png}   Several: *.{png,jpg,jpeg,tiff}
        // Invalid: *.png or png — config error.
        converted: "*.{png,jpg,jpeg,tiff}",

        // Output codec for convert/watch: webp | avif | png | jpg | jpeg | tiff
        format: "webp",

        // Encode quality 0–100 (lossy formats).
        quality: 80,

        // Where to write converted files.
        // null = next to the source file.
        // Relative = from cwd; absolute = as-is.
        outputDir: "./public/converted",

        // How to place files INSIDE outputDir when sources live in subfolders.
        // Example: dir ./public/og, file og/heroes/cat.png
        //   flat   → ./public/converted/cat.webp
        //   mirror → ./public/converted/heroes/cat.webp  (keep relative folders from dir)
        outputDirMode: "flat",

        // true: resize the image blob once, then encode to `format` → outputDir.
        // Avoids converting full-size then resizing twice. Needs the resize section below.
        needResize: true,

        // true: ALSO save that same resized blob in the SOURCE format → resize.outputDir
        // (e.g. png→png). Convert to `format` still runs.
        // Requires needResize: true and resize.outputDir set.
        needResizeOriginal: false,
    },

    // --- resize geometry + resize CLI / resize:watch (no format change) ---
    resize: {
        // Folder to scan for resize / resize:watch.
        // Resize-only (no convert): set to ./public/og (or any image folder).
        // After convert: usually ./public/converted (pair with convert watch → this folder).
        dir: "./public/converted",

        // After a successful resize CLI run: delete/overwrite the source in resize.dir?
        // Independent from convertation.removeOriginal.
        removeOriginal: false,

        // Target width in px, or null if only height is set.
        width: 1920,

        // Target height in px, or null if only width (aspect depends on fit).
        height: null,

        // Sharp fit: cover | contain | fill | inside | outside
        fit: "cover",

        // Crop anchor when using cover, etc.: center, top, left, ...
        position: "center",

        // true: never upscale; only shrink images larger than the target.
        // false: small images may be enlarged up to width/height.
        withoutEnlargement: true,

        // Which file format(s) to resize (NOT a convert target — extension stays the same).
        // "webp" → find *.{webp}, write .webp again (new dimensions only).
        // Several: "png,jpg" → *.{png,jpg}.
        // null → use convertation.format (handy after convert to webp).
        // Resize-only png: dir "./public/og", targetFormat: "png".
        targetFormat: "webp",

        // Where to write resize CLI results and needResizeOriginal siblings.
        // null + removeOriginal true → overwrite source;
        // null + removeOriginal false → size suffix next to source (-1920w / -1920x1080).
        outputDir: "./public/resized",

        // Same flat | mirror rules, relative to resize.dir → resize.outputDir.
        outputDirMode: "flat",
    },
};
