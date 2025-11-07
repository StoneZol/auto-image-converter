import path from "node:path";
import fg from "fast-glob";
import { Queue } from "../Queue.js";
import { ConvertationStep } from "../steps/ConvertationStep.js";
import { MarkerFile } from "../MarkerFile.js";

export class ConvertationPipeline {
    constructor(config) {
        this.config = config;

        const stepConfig =
            config.modules?.convertation ||
            config.convertation ||
            config;

        // Добавляем глобальные параметры в step конфиг
        const mergedConfig = {
            ...stepConfig,
            removeOriginal:
                stepConfig.removeOriginal !== undefined
                    ? stepConfig.removeOriginal
                    : config.removeOriginal,
        };

        this.step = new ConvertationStep(mergedConfig);
        this.queue = new Queue();
        this.processing = new Set();
        this.stats = {
            total: 0,
            converted: 0,
            skipped: 0,
            failed: 0,
        };
    }

    // Основной метод - запуск конвертации всех файлов
    async run() {
        console.log("🚀 Starting convertation pipeline...");

        // 1. Собираем файлы
        const files = await this.collectFiles();
        console.log(
            `📁 Found ${files.length} files to process`
        );

        if (files.length === 0) {
            console.log("✅ No files to convert");
            return this.stats;
        }

        // 2. Добавляем в очередь
        this.enqueueFiles(files);

        // 3. Обрабатываем с параллелизмом
        await this.processQueue();

        // 4. Выводим итоговую статистику
        this.printStats();

        return this.stats;
    }

    // Сбор файлов по конфигу
    async collectFiles() {
        const dir = this.config.dir || process.cwd();
        const converted =
            this.config.modules?.convertation?.converted ||
            this.config.convertation?.converted ||
            this.config.converted ||
            "*.{png,jpg,jpeg}";
        const recursive = this.config.recursive !== false;

        const absDir = path.resolve(process.cwd(), dir);
        const pattern = recursive
            ? path.join(absDir, "**", converted)
            : path.join(absDir, converted);

        const unified = pattern
            .split(path.sep)
            .join(path.posix.sep);

        return fg(unified, { caseSensitiveMatch: false });
    }

    // Добавление файлов в очередь
    enqueueFiles(files) {
        for (const file of files) {
            this.enqueueFile(file);
        }
    }

    // Добавление одного файла в очередь
    enqueueFile(filePath) {
        if (!filePath || this.processing.has(filePath)) {
            return false;
        }

        this.processing.add(filePath);
        this.queue.enqueue((workerId) =>
            this.processFile(filePath, workerId)
        );
        this.stats.total++;
        return true;
    }

    // Обработка очереди с параллелизмом
    async processQueue() {
        const concurrency = this.config.concurrency || 4;
        const workers = Array.from(
            { length: concurrency },
            (_, index) => this.workerLoop(index + 1)
        );

        await Promise.all(workers);
    }

    // Рабочий цикл для обработки задач
    async workerLoop(workerId) {
        while (!this.queue.isEmpty()) {
            const task = this.queue.dequeue();
            if (!task) break;

            try {
                await task(workerId);
            } catch (err) {
                console.error(
                    `[Worker ${workerId}] ❌ Error:`,
                    err.message
                );
            }
        }
    }

    // Обработка одного файла
    async processFile(filePath, workerId) {
        const workerPrefix = workerId
            ? `[Worker ${workerId}]`
            : "";

        try {
            const result = await this.step.execute(
                filePath
            );

            if (result.success) {
                this.stats.converted++;
                console.log(
                    `${workerPrefix} ✓ ${result.originalPath} → ${result.outputPath}`
                );
            } else if (result.skipped) {
                this.stats.skipped++;
                console.log(
                    `${workerPrefix} ⊘ ${result.originalPath} → ${result.reason}`
                );
            } else {
                this.stats.failed++;
                console.error(
                    `${workerPrefix} ❌ ${result.originalPath}: ${result.error}`
                );
            }
        } catch (err) {
            this.stats.failed++;
            console.error(
                `${workerPrefix} ❌ ${filePath}:`,
                err.message
            );
        } finally {
            this.processing.delete(filePath);
        }
    }

    // Вывод итоговой статистики
    printStats() {
        console.log("\n📊 Convertation completed:");
        console.log(`   Total:     ${this.stats.total}`);
        console.log(
            `   Converted: ${this.stats.converted}`
        );
        console.log(`   Skipped:   ${this.stats.skipped}`);
        console.log(`   Failed:    ${this.stats.failed}`);
    }
}
