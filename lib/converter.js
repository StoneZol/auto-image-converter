import fg from "fast-glob";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

sharp.cache(false);

const supportedExt = [".png", ".jpg", ".jpeg"];

const processingFiles = new Set();

async function safeUnlink(file, retries = 3, delayMs = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      await fs.unlink(file);
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

export async function convertImages({
  dir,
  converted,
  format,
  quality,
  recursive,
  removeOriginal,
}) {
  const rawPattern = recursive
    ? path.join(dir, "**", converted)
    : path.join(dir, converted);

  const pattern = rawPattern.split(path.sep).join(path.posix.sep);
  const files = await fg(pattern, { caseSensitiveMatch: false });

  for (const file of files) {
    if (processingFiles.has(file)) continue;
    processingFiles.add(file);

    try {
      const ext = path.extname(file);
      const outFile = file.replace(ext, `.${format}`);

      // Игнорируем файлы, которые уже в целевом формате
      if (ext.toLowerCase() === `.${format.toLowerCase()}`) {
        processingFiles.delete(file);
        continue;
      }

      const image = sharp(file);
      const buffer =
        format === "webp"
          ? await image.webp({ quality }).toBuffer()
          : await image.avif({ quality }).toBuffer();

      await fs.writeFile(outFile, buffer);

      if (removeOriginal) {
        await safeUnlink(file);
      }

      console.log(`✓ ${file} → ${outFile}`);
    } catch (err) {
      console.error("Error covertation:", err.message);
    } finally {
      processingFiles.delete(file);
    }
  }
}
