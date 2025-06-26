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
  const pattern = recursive
    ? `${dir}/**/*.{png,jpg,jpeg}`
    : `${dir}/*.{png,jpg,jpeg}`;
  const files = await fg(pattern);
  console.log("нашел файлы", files);

  for (const file of files) {
    const ext = path.extname(file);
    const outFile = file.replace(ext, `.${format}`);
    console.log(`Записываю файл: ${outFile}`);

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
