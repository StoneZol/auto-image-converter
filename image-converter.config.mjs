export default {
    // Основные настройки
    dir: "./public",
    removeOriginal: true,
    recursive: true,
    ignoreOnStart: true,
    concurrency: 4,
    convertation: {
      converted: "*.{png,jpg,jpeg,tiff}", // png, jpg, jpeg, tiff, webp, avif
      format: "webp", // png, jpeg, tiff, webp, avif
      quality: 80, // 0-100
  },
    needResize: true, // true or false
  resize: {
      width: 1920, // 100-1000 or null
      height: null, // 100-1000 or null
      fit: "cover", // cover, contain, fill, inside, outside
      position: "center", // center, top, bottom, left, right, top-left, top-right, bottom-left, bottom-right
      withoutEnlargement: true, // true or false
    },
};
