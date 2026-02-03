import sharp from "sharp";

/**
 * Абстракция для конвертации форматов.
 *
 * Главное правило:
 * - на вход можно дать путь/Buffer ИЛИ уже готовый sharp‑инстанс;
 * - методы конверсии возвращают sharp‑инстанс;
 * - .toBuffer() / .toFile() вызываются уже снаружи (в пайплайне).
 */
export class ConvertImages {
  /**
   * @param {string|Buffer|import("sharp").Sharp} input
   * @param {Object} options
   * @param {number} options.quality
   */
  constructor(input, options) {
    this.quality = options.quality;

    // Если нам уже дали sharp‑инстанс — просто переиспользуем его.
    if (input && typeof input === "object" && typeof input.resize === "function") {
      this.instance = input;
    } else {
      // Иначе считаем, что это путь или Buffer.
      this.instance = sharp(input);
    }
  }

  /**
   * Конвертировать в WebP.
   * @returns {import("sharp").Sharp}
   */
  toWebp() {
    return this.instance.webp({ quality: this.quality });
  }

  /**
   * Конвертировать в AVIF.
   * @returns {import("sharp").Sharp}
   */
  toAvif() {
    return this.instance.avif({ quality: this.quality });
  }

  /**
   * Конвертировать в PNG.
   * @returns {import("sharp").Sharp}
   */
  toPng() {
    return this.instance.png({ quality: this.quality });
  }

  /**
   * Конвертировать в JPEG.
   * @returns {import("sharp").Sharp}
   */
  toJpg() {
    return this.instance.jpeg({ quality: this.quality });
  }

  /**
   * Конвертировать в TIFF.
   * @returns {import("sharp").Sharp}
   */
  toTiff() {
    return this.instance.tiff({ quality: this.quality });
  }
}
