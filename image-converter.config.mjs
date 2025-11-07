export default {
    // Основные настройки
    dir: "./public",
    removeOriginal: true,
    recursive: true,
    ignoreOnStart: true,
    concurrency: 4,
    pipeline: ["convertation", "srcset"], // опционально, будет запускать процессы прописанные в конфиге, отдельной командой
    //Подключаемые модули
    modules: {
        // Настройки конвертации
        convertation: {
            markerOriginal: true, // если true, то будет добавлен маркер original к файлу
            markerProcessed: true, // если true, то будет добавлен маркер processed к файлу
            // null - та же папка где оригинал
            // './converted' - относительный путь (относительно оригинала)
            // 'D:/output' - абсолютный путь (создаст подпапку с именем файла)
            outputDir: null,
            converted: "*.{png,jpg,jpeg,tiff}",
            format: "webp",
            quality: 80,
        },

        // Настройки srcset (опционально)
        srcset: {
            markerSrcset: true, // если true, то будет добавлен маркер srcset к файлу
            // null - та же папка где оригинал
            // './srcset' - относительный путь (относительно оригинала)
            // 'D:/output/srcset' - абсолютный путь (создаст подпапку с именем файла)
            outputDir: null,
            converted: "*.{png,jpg,jpeg,tiff}",
            // Размеры для генерации
            sizes: [
                { width: 320, height: 240 },
                { width: 640, height: 480 },
                { width: 1280, height: 720 },
            ],
            pattern: "{dir}/{w}x{h}-{name}{marker}{ext}",
            format: "webp",
            quality: 80,
            resizeMode: "cover", // 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
        },
    },
};
