# Changelog

## [3.0.0] — 2026-10-04

Compared to released **2.2.3** (`main`).

### Breaking changes

**`outputDir` path resolution (bugfix / behavior change)**

In 2.2.3 (`FileManager.resolveOutputDir`):

- relative `outputDir` was joined to the **source file’s folder** (`dirname(file)`), so `./public/s` from `public/og/x.png` became `public/og/public/s`;
- absolute `outputDir` appended a **subfolder named after the file** (`/out` + `matrix.webp` → `/out/matrix/matrix.webp`).

In 3.0.0:

- relative → from **cwd**;
- absolute → that folder, **flat** (filename only, no name subfolder);
- `outputDir: null` still means “next to the source” (unchanged idea).

**Config shape**

2.2.3 sample used top-level `dir`, `removeOriginal`, `needResize`, and a `resize` block with geometry only. `convertation` had `converted` / `format` / `quality` / `outputDir`.

3.0.0 prefers per-command ownership (top-level still accepted with a deprecation warning):

- `convertation.dir`, `convertation.removeOriginal`, `convertation.needResize`
- `resize.dir`, `resize.removeOriginal`, plus geometry
- new: `convertation.needResizeOriginal`, `outputDirMode`, `resize.targetFormat`

**Format lists (`converted` / `targetFormat`)**

- Preferred form: `"png"` or `"png,jpg,jpeg"` (comma-separated).
- Legacy `*.{png,jpg}` from 2.2.3 samples still accepted.
- Internally a single extension is scanned as `*.ext` (fast-glob).

**Resize CLI input**

- 2.2.3: always scanned `dir` for `*.${convertation.format}` (e.g. `*.webp`), same format out; no `resize.format` in the released package.
- 3.0.0: explicit `resize.dir` + `resize.targetFormat` (`"webp"` / `"png,jpg"`). Default fallback still `convertation.format` when `targetFormat` is null.
- Resize still does **not** change codec (same as 2.2.3 intent).

### Migration (2.2.3 → 3.0.0)

| 2.2.3 | 3.0.0 |
| --- | --- |
| `dir: "./public"` | `convertation.dir` (and `resize.dir` if you use resize CLI/watch) |
| `removeOriginal: true` | `convertation.removeOriginal` / `resize.removeOriginal` |
| `needResize: true` | `convertation.needResize: true` |
| `convertation.outputDir: "../s"` hack from source folder | cwd-relative e.g. `./public/converted` |
| Absolute `outputDir` expecting flat files | works flat now (remove reliance on per-file subfolders if you depended on the bug) |
| `converted: "*.{png,jpg}"` | Prefer `converted: "png,jpg"` (old brace form still works) |
| Resize CLI implicit `*.webp` in top-level `dir` | `resize.dir` + `resize.targetFormat: "webp"` (or null → `convertation.format`) |

### Added

- `convertation.needResizeOriginal` — write resized source-format sibling to `resize.outputDir` in the same convert pass
- `outputDirMode: "flat" | "mirror"`
- `resize.targetFormat`, `resize.dir`, `resize.outputDir` for the resize command
- `auto-convert-images-resize-watch` / `npm run resize:watch`
- Repo scripts: `convert`, `watch`, `resize`, `resize:watch`
- Gitignored `public/` playground
- Fully commented English sample config
- CHANGELOG / updated README

### Changed

- Convert watch still = convert pipeline only; resize watch is a separate binary
- Skip sources already in target convert format; warn if glob includes target format and `outputDir` is null
- Worker id in logs for convert and resized-original lines

### Unchanged (same idea as 2.2.3)

- Config file: `image-converter.config.mjs` resolved from **cwd**
- Resize does not convert to another format
- Sharp pipeline, concurrency workers, convert watch with `awaitWriteFinish`
