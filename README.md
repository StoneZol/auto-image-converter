# 🖼️ Auto Image Converter

Automatically convert PNG, JPG, and JPEG images to WebP or AVIF format with real-time file watching.

### 🔗 GitHub repository: https://github.com/StoneZol/auto-image-converter

## 🚀 Features

🔄 Convert images to .webp or .avif

🔍 Recursive folder support

🗑️ Optional removal of original files

👀 Watch mode – automatically converts newly added images

⚙️ Easy configuration via image-converter.config.mjs

## 📦 Installation

`npm install auto-image-converter --save-dev`

## ⚙️ Configuration

Create a `image-converter.config.mjs` file in the root of your project:

```// Default configuration example
export default {
  dir: "public",            // Directory to scan for images
  converted: "*.{png,jpg,jpeg}", // Glob pattern for source image files to convert
  format: "webp",           // Output image format: 'webp' or 'avif'
  quality: 80,              // Quality of output images (0–100)
  recursive: true,          // Whether to search subdirectories recursively
  removeOriginal: true,     // Delete original files after successful conversion
  ignoreOnStart: false,     // If true, ignore existing files on watcher startup
};
```

## 🛠️ Usage

Add the following to your package.json:

```
"scripts": {
  "aciw": "auto-convert-images-watch"
}
```

To start the image watcher: `npm run aciw`

Or run a one-time conversion: `npx auto-convert-images`

## With Next.js

To run the watcher alongside the development server, install concurrently:

`npm install concurrently --save-dev`

Then update your dev script like so:

```
"scripts": {
  "dev": "concurrently \"npm run aciw\" \"next dev\""
}
```

## 📄 License

This project is open source and available under the MIT License.

You are free to use, modify, and distribute it for personal and commercial purposes with proper attribution.
