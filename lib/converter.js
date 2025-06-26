import fg from "fast-glob";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const supportedExt = [".png", ".jpg", ".jpeg"];

export async function convertImages({
  dir,
  format,
  quality,
  recursive,
  removeOriginal,
}) {
  const rawPattern = recursive
    ? path.join(dir, "**", "*.{png,jpg,jpeg}")
    : path.join(dir, "*.{png,jpg,jpeg}");

  const pattern = rawPattern.split(path.sep).join(path.posix.sep);
  const files = await fg(pattern, { caseSensitiveMatch: false });

  for (const file of files) {
    const ext = path.extname(file);
    const outFile = file.replace(ext, `.${format}`);

    const image = sharp(file);
    const buffer =
      format === "webp"
        ? await image.webp({ quality }).toBuffer()
        : await image.avif({ quality }).toBuffer();

    await fs.writeFile(outFile, buffer);
    if (removeOriginal) await fs.unlink(file);
    console.log(`✓ ${file} → ${outFile}`);
  }
}
