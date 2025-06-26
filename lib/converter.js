import fg from "fast-glob";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { convertPathToPosix } from "fast-glob/out/utils/path";

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

  // Преобразуем \ → /
  const pattern = convertPathToPosix(rawPattern);
  console.log("Ищу файлы по пути:", pattern);
  const files = await fg(pattern, { caseSensitiveMatch: false });
  console.log("Текущая директория:", process.cwd());
  console.log(`нашел файлы, ${files}, количество, ${files.length}`);

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
