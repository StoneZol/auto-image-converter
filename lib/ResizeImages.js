import sharp from "sharp";

/**
 * Простая обёртка над sharp().resize() под наши кейсы:
 * - уменьшить по ширине;
 * - уменьшить по высоте;
 * - вписать в прямоугольник с нужным соотношением сторон;
 * во всех случаях можно контролировать fit, position, withoutEnlargement.
 *
 * ВНИМАНИЕ: методы возвращают sharp‑инстанс.
 * Снаружи нужно завершать цепочку, например .toBuffer() или .toFile().
 */
export class ResizeImages {
  /**
   * @param {string|Buffer} source - путь к файлу или Buffer с изображением
   * @param {Object} [defaultOptions]
   * @param {"cover"|"contain"|"fill"|"inside"|"outside"} [defaultOptions.fit]
   * @param {string} [defaultOptions.position]
   * @param {boolean} [defaultOptions.withoutEnlargement]
   */
  constructor(source, defaultOptions = {}) {
    this.source = source;

    // Базовые дефолты, чтобы "просто работало" под типичный кейс:
    this.defaultOptions = {
      fit: "inside",
      position: "center",
      withoutEnlargement: true,
      ...defaultOptions,
    };
  }

  /**
   * Внутренний помощник: склеиваем дефолты и конкретные опции.
   * @param {Object} extra
   * @returns {import("sharp").ResizeOptions}
   * @private
   */
  _buildOptions(extra = {}) {
    return {
      ...this.defaultOptions,
      ...extra,
    };
  }

  /**
   * Уменьшить изображение до нужной ширины (высота по пропорциям).
   *
   * @param {number} width
   * @param {Object} [options]
   * @param {"cover"|"contain"|"fill"|"inside"|"outside"} [options.fit]
   * @param {string} [options.position]
   * @param {boolean} [options.withoutEnlargement]
   * @returns {import("sharp").Sharp}
   */
  byWidth(width, options = {}) {
    const resizeOptions = this._buildOptions({
      width,
      ...options,
    });

    return sharp(this.source).resize(resizeOptions);
  }

  /**
   * Уменьшить изображение до нужной высоты (ширина по пропорциям).
   *
   * @param {number} height
   * @param {Object} [options]
   * @param {"cover"|"contain"|"fill"|"inside"|"outside"} [options.fit]
   * @param {string} [options.position]
   * @param {boolean} [options.withoutEnlargement]
   * @returns {import("sharp").Sharp}
   */
  byHeight(height, options = {}) {
    const resizeOptions = this._buildOptions({
      height,
      ...options,
    });

    return sharp(this.source).resize(resizeOptions);
  }

  /**
   * Вписать/кадрировать изображение в прямоугольник (конкретное соотношение сторон).
   * Обычно используется под 16:9, 1:1 и т.п.
   *
   * @param {number} width
   * @param {number} height
   * @param {Object} [options]
   * @param {"cover"|"contain"|"fill"|"inside"|"outside"} [options.fit] - cover (обрезать лишнее) или contain (вписать с полями)
   * @param {string} [options.position] - центр кадрирования при fit: "cover"
   * @param {boolean} [options.withoutEnlargement] - запрещать ли растягивание маленьких исходников
   * @returns {import("sharp").Sharp}
   */
  toBox(width, height, options = {}) {
    const resizeOptions = this._buildOptions({
      width,
      height,
      ...options,
    });

    return sharp(this.source).resize(resizeOptions);
  }
}
