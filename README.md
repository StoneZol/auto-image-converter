# Auto Image Converter

Convert and resize images to modern formats (WebP, AVIF, PNG, JPEG, TIFF) with optional watch mode.

**v3.0.0** — breaking path/config semantics (see below).

## Features

- Convert to WebP, AVIF, PNG, JPEG, or TIFF
- Resize in the convert pipeline (`needResize`) or via a separate resize CLI (same format, dimensions only)
- Per-command `dir` / `removeOriginal` / `outputDir`
- Watch mode = convert pipeline as an observer (not a resize watcher)
- Parallel workers via `concurrency`
- Local playground under `public/` (gitignored)

## Installation

```bash
npm install auto-image-converter --save-dev
```

Or develop in this repo:

```bash
npm install
npm run convert
npm run watch
npm run resize
npm test
```

## Configuration

Create `image-converter.config.mjs` in the project root. The sample in this repo is fully commented in English.

### Path rules (breaking in 3.0)

| Value | Meaning |
| --- | --- |
| Relative (`./public/og`) | Resolved from **cwd** (project root when you `npm run …`) |
| Absolute | Used as-is |
| `outputDir: null` | Write next to the source file |

**Do not** use `/public` on Windows if you mean the project folder — that is an absolute path from the drive root. Prefer `./public/...`.

`outputDirMode`:

- `flat` (default) — `outputDir/name.ext`
- `mirror` — keep subfolders relative to that command’s `dir`

### Convert / watch vs resize CLI

| | convert / watch | resize CLI |
| --- | --- | --- |
| Scan folder | `convertation.dir` | `resize.dir` |
| Delete source | `convertation.removeOriginal` | `resize.removeOriginal` |
| Output | `convertation.outputDir` | `resize.outputDir` |
| Format change | yes (`convertation.format`) | **no** (same extension) |
| Which files | `convertation.converted` (`*.{...}` only) | `resize.targetFormat` (`"webp"` → `*.{webp}`) |

**Watch** (`npm run watch`) uses the **same pipeline as convert**, watching `convertation.dir`. It does not use `resize.dir` / `targetFormat`. A dedicated resize watcher may be added later.

### Input glob

Only `*.{png}` or `*.{png,jpg,jpeg}` in config. Other forms (`*.png`, `png`) are a config error.  
Internally a single extension is scanned as `*.png` (fast-glob does not match `*.{png}` reliably).

### `needResize` / `needResizeOriginal`

Both live under `convertation`:

1. `needResize: true` — resize the blob once, then encode to `format` → `convertation.outputDir`
2. `needResizeOriginal: true` — also write that resized blob in the **source** format → `resize.outputDir` (requires `needResize` and `resize.outputDir`)

### Typical workflows

**Convert with optional resize in one pass**

```text
convertation.dir = ./public/og
convertation.outputDir = ./public/converted
convertation.needResize = true
```

**Convert first, resize converted files later**

```text
# convert
convertation.dir → convertation.outputDir

# then resize CLI
resize.dir = ./public/converted
resize.targetFormat = "webp"
resize.outputDir = ./public/resized
```

**Resize only (no convert)**

```text
resize.dir = ./public/og
resize.targetFormat = "png"
npm run resize
```

## Usage

```bash
# One-shot convert
npx auto-convert-images
# or in this repo:
npm run convert

# Watch (convert pipeline)
npx auto-convert-images-watch
npm run watch

# One-shot resize (same format)
npx auto-convert-images-resize
npm run resize
```

### Package.json scripts (consumer project)

```json
{
  "scripts": {
    "convert": "auto-convert-images",
    "watch": "auto-convert-images-watch",
    "resize": "auto-convert-images-resize"
  }
}
```

### Local playground

This repository uses gitignored `public/og`, `public/converted`, `public/resized`. Drop test images into `public/og` and run `npm run convert` without linking the package into another app.

### Next.js

```bash
npm install concurrently --save-dev
```

```json
{
  "scripts": {
    "dev": "concurrently \"npm run watch\" \"next dev\""
  }
}
```

## Breaking changes in 3.0

- `outputDir` relative paths are from **cwd**, not from the source file folder
- Absolute `outputDir` is **flat** (no per-file name subfolder)
- Prefer `convertation.dir` / `resize.dir` and per-section `removeOriginal` (top-level still works with a deprecation warning)
- `needResize` belongs under `convertation`
- `convertation.converted` must be `*.{...}`
- Resize CLI uses `targetFormat` and does not change image codec

## License

MIT
