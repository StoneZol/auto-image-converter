# 🖼️ Auto Image Converter

Automatically convert and resize images to modern formats (WebP, AVIF, PNG, JPEG, TIFF) with real-time file watching and flexible resize options.

## 🔗 GitHub repository

<https://github.com/StoneZol/auto-image-converter>

## 🚀 Features

🔄 **Convert images** to WebP, AVIF, PNG, JPEG, or TIFF

📐 **Resize images** by width, height, or to specific aspect ratios

🔍 **Recursive folder support** - process entire directory trees

🗑️ **Optional removal** of original files after conversion

👀 **Watch mode** – automatically converts newly added images in real-time

⚡ **Parallel processing** with configurable concurrency

🎯 **One-time resize** – resize already converted images without re-conversion

⚙️ **Easy configuration** via `image-converter.config.mjs`

## 📦 Installation

```bash
npm install auto-image-converter --save-dev
```

Or use locally via `npm link`:

```bash
cd auto-image-converter
npm link
cd ../your-project
npm link auto-image-converter
```

## ⚙️ Configuration

Create a `image-converter.config.mjs` file in the root of your project:

```javascript
export default {
  // Main settings
  dir: "./public",              // Directory to scan for images
  removeOriginal: true,          // Delete original files after conversion
  recursive: true,               // Recursive search in subdirectories
  ignoreOnStart: true,           // Ignore existing files on watcher startup
  concurrency: 4,                // Number of parallel workers

  // Conversion settings
  convertation: {
    converted: "*.{png,jpg,jpeg,tiff}",  // Source file pattern
    format: "webp",                       // Target format: webp, avif, png, jpg, tiff
    quality: 80,                          // Quality (0-100)
    outputDir: null,                      // null = same folder, or path for output
  },

  // Resize settings (optional)
  needResize: true,              // Enable resize
  resize: {
    width: 1920,                 // Width (or null)
    height: null,                 // Height (or null)
    fit: "cover",                 // cover, contain, fill, inside, outside
    position: "center",           // Cropping position
    withoutEnlargement: true,     // Don't enlarge small images
  },
};
```

### Resize Options

- **By width only**: `width: 1920, height: null` - reduces to width, height scales proportionally
- **By height only**: `width: null, height: 1080` - reduces to height, width scales proportionally
- **To aspect ratio**: `width: 1920, height: 1080` - fits/crops to specific aspect ratio

### Fit Modes

- `cover` - fills entire size, cropping excess (default)
- `contain` - fits fully, may add padding
- `fill` - stretches without preserving aspect ratio
- `inside` - reduces to fit, doesn't enlarge
- `outside` - covers entire size, may enlarge

## 🛠️ Usage

### Commands

```bash
# One-time conversion of all files
npx auto-convert-images

# Watch mode - processes new files as they're added
npx auto-convert-images-watch

# One-time resize of already converted files
npx auto-convert-images-resize
```

### Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "convert": "auto-convert-images",
    "watch": "auto-convert-images-watch",
    "resize": "auto-convert-images-resize"
  }
}
```

Then run:

- `npm run convert` - one-time conversion
- `npm run watch` - watch mode
- `npm run resize` - resize already converted files

### With Next.js

To run the watcher alongside the development server:

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

## 📋 Use Cases

### 1. Initial Conversion

Convert all PNG/JPG files to WebP:

```bash
npx auto-convert-images
```

### 2. Watch Mode

Automatically convert new images as they're added:

```bash
npx auto-convert-images-watch
```

### 3. Resize Already Converted Files

If you converted files without resize, then decided you need resize:

```bash
npx auto-convert-images-resize
```

- If `removeOriginal: false` → creates new files with size suffix: `image.webp` → `image-1920x1080.webp`
- If `removeOriginal: true` → overwrites original files

## 🏗️ Architecture

The tool uses a modular architecture:

- **Pipeline** - main processing engine with queue and workers
- **ResizeImages** - resize operations wrapper
- **ConvertImages** - format conversion wrapper
- **FileManager** - file path resolution and saving

All operations work with Sharp instances in a chainable pipeline pattern.

## 🐛 Bug Reports

Found a bug? Please report it in the [GitHub Issues](https://github.com/StoneZol/auto-image-converter/issues) section of the repository. Include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Configuration file (if relevant)
- Node.js version and OS

This helps improve the tool for everyone!

## 📄 License

This project is open source and available under the MIT License.

You are free to use, modify, and distribute it for personal and commercial purposes with proper attribution.
