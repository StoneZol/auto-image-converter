# 🖼️ Auto Image Converter

Automatically convert and resize images to modern formats (WebP, AVIF, PNG, JPEG, TIFF) with real-time file watching and flexible resize options.

**v3.0.0** — breaking config/path fixes vs 2.2.x. See [Breaking changes](#-breaking-changes-in-30) and [CHANGELOG.md](./CHANGELOG.md).

## 🚀 Features

🔄 **Convert images** to WebP, AVIF, PNG, JPEG, or TIFF

📐 **Resize** inside convert (`needResize`) and/or via a separate resize command (same format, dimensions only)

💾 **`needResizeOriginal`** — also save the resized file in the source format

📁 **Per-command paths** — separate `dir` / `removeOriginal` / `outputDir` for convert and resize

👀 **Watch convert** + **watch resize** — process new files as they arrive (FTP/drop folders friendly)

⚡ **Parallel workers** via `concurrency`

🗂️ **`flat` / `mirror`** output layout

⚙️ **Easy configuration** via `image-converter.config.mjs` (fully commented sample in the repo)

## 📦 Installation

```bash
npm install auto-image-converter --save-dev
```

Or develop in this repo:

```bash
npm install
npm run convert
npm run watch
npm run resize
npm run resize:watch
```

Or use locally via `npm link`:

```bash
cd auto-image-converter
npm link
cd ../your-project
npm link auto-image-converter
```

## ⚙️ Configuration

Create `image-converter.config.mjs` in the **project root** (same folder you run npm scripts from — cwd):

```javascript
export default {
  // Shared
  recursive: true,       // walk subfolders under each command's dir
  concurrency: 4,        // parallel workers
  ignoreOnStart: true,   // watch: skip files that already exist on startup

  // --- convert + watch (auto-convert-images / auto-convert-images-watch) ---
  convertation: {
    dir: "./public/original",          // where to look for sources (cwd-relative or absolute)
    removeOriginal: true,              // delete source from convertation.dir after success
    converted: "png,jpg,jpeg,tiff",    // source formats (comma-separated)
    format: "webp",                    // output codec: webp | avif | png | jpg | jpeg | tiff
    quality: 80,                       // 0–100
    outputDir: "./public/converted",   // null = next to source
    outputDirMode: "flat",             // flat | mirror (mirror keeps subfolders from dir)

    needResize: true,                  // resize once, then encode → outputDir
    needResizeOriginal: false,         // also write resized SOURCE format → resize.outputDir
  },

  // --- resize geometry + resize / resize:watch (no format change) ---
  resize: {
    dir: "./public/converted",         // scan folder for resize CLI / resize:watch
    removeOriginal: false,             // independent from convertation.removeOriginal
    width: 1920,                       // or null if only height
    height: null,                      // or null if only width
    fit: "cover",                      // cover | contain | fill | inside | outside
    position: "center",
    withoutEnlargement: true,          // don't upscale smaller images

    targetFormat: "webp",              // which files to resize: "webp" | "png,jpg" | null → convertation.format
    outputDir: "./public/resized",     // null + removeOriginal true → overwrite; false → -1920w suffix
    outputDirMode: "flat",
  },
};
```

The same file in this repo has longer English comments on every field.

### Who owns what

| | convert / `watch` | resize / `resize:watch` |
| --- | --- | --- |
| Scan folder | `convertation.dir` | `resize.dir` |
| Delete source | `convertation.removeOriginal` | `resize.removeOriginal` |
| Output folder | `convertation.outputDir` | `resize.outputDir` |
| Format change | yes — `convertation.format` | **no** — same extension |
| Which files | `convertation.converted` | `resize.targetFormat` |

Top-level `dir` / `removeOriginal` / `needResize` still work with a deprecation warning; prefer per-section fields.

### Paths

| Value | Meaning |
| --- | --- |
| Relative (`./public/original`) | From **cwd** |
| Absolute | Used as-is |
| `outputDir: null` | Next to the source file |

On Windows prefer `./public/...`. A path like `/public` is absolute from the drive root.

**`outputDirMode`**

- `flat` (default) — `original/tests/cat.png` → `converted/cat.webp`
- `mirror` — keep subfolders from `dir` → `converted/tests/cat.webp`

### Input formats

Same style everywhere — comma-separated extensions (no `*.{…}` required):

```js
converted: "png"
converted: "png,jpg,jpeg,tiff"

targetFormat: "webp"
targetFormat: "png,jpg,webp"
targetFormat: null // → convertation.format
```

Legacy `*.{png,jpg}` still works if you already have it in a config.

### Resize in the convert pipeline

1. **`needResize: true`** — resize once in memory, then encode to `format` → `convertation.outputDir`
2. **`needResizeOriginal: true`** — also write resized **source-format** file → `resize.outputDir`  
   (requires `needResize` + `resize.outputDir`)

⚠️ Don’t also run `resize:watch` on the same files if convert already resized them — you’ll resize twice.

### Resize options

- **By width only**: `width: 1920, height: null`
- **By height only**: `width: null, height: 1080`
- **To a box**: `width: 1920, height: 1080` (uses `fit`)

**`withoutEnlargement: true`** — never upscale; only shrink larger images.

### Fit modes

- `cover` — fill size, crop excess (default)
- `contain` — fit inside, may pad
- `fill` — stretch
- `inside` — fit inside, no enlarge
- `outside` — cover size, may enlarge

## 🛠️ Usage

### Commands

```bash
# One-time convert (+ optional needResize in the same pass)
npx auto-convert-images
npm run convert

# Watch convert — convertation.dir
npx auto-convert-images-watch
npm run watch

# One-time resize (same format, dimensions only)
npx auto-convert-images-resize
npm run resize

# Watch resize — resize.dir
npx auto-convert-images-resize-watch
npm run resize:watch
```

### Package.json scripts

```json
{
  "scripts": {
    "convert": "auto-convert-images",
    "watch": "auto-convert-images-watch",
    "resize": "auto-convert-images-resize",
    "resize:watch": "auto-convert-images-resize-watch"
  }
}
```

### With Next.js

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

Add `resize:watch` only if you use a separate resize stage.

## 📋 Use cases

### 1. One pass — resize + convert

```text
convertation.dir = ./public/original
convertation.outputDir = ./public/converted
convertation.needResize = true
npm run convert   # or npm run watch
```

### 2. Watch drop folder / FTP

```text
FTP → convertation.dir
npm run watch
```

Watch waits for a stable file size before processing.

### 3. Convert first, resize later

```text
# convert with needResize: false
convertation.dir → convertation.outputDir

# then
resize.dir = ./public/converted
resize.targetFormat = "webp"
resize.outputDir = ./public/resized
npm run resize   # or npm run resize:watch
```

- `resize.removeOriginal: false` + `outputDir: null` → size suffix (`image-1920w.webp`)
- `resize.removeOriginal: true` + `outputDir: null` → overwrite source

### 4. Resize only (no convert)

```text
resize.dir = ./public/original
resize.targetFormat = "png,jpg"
npm run resize
```

## 🏗️ Architecture

- **Pipeline** — queue + workers (convert or resize mode)
- **ResizeImages** / **ConvertImages** — Sharp wrappers
- **FileManager** — path resolution (`flat` / `mirror`, cwd-relative)
- **globPattern** — strict `*.{…}` parsing

## 💥 Breaking changes in 3.0

- Relative `outputDir` / `dir` resolve from **cwd** (2.2.x relative `outputDir` was from the source file folder)
- Absolute `outputDir` is **flat** (2.2.x added a per-file name subfolder)
- Prefer `convertation.dir` / `resize.dir` and per-section `removeOriginal`
- `needResize` / `needResizeOriginal` under `convertation`
- Prefer `converted` / `targetFormat` as `"png,jpg"` (legacy `*.{…}` still ok)
- Resize CLI uses `resize.dir` + `targetFormat` (still no format conversion — same as 2.2.x intent)
- New: `auto-convert-images-resize-watch`

Full details: [CHANGELOG.md](./CHANGELOG.md).

## 🐛 Bug reports

Report issues on [GitHub Issues](https://github.com/StoneZol/auto-image-converter/issues). Include description, steps, expected/actual behavior, config, Node.js version, and OS.

## 📄 License

MIT — free to use, modify, and distribute with proper attribution.
