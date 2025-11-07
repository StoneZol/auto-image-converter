import path from "path";
import fs from "fs/promises";

export class MarkerFile {
    static MARKERS = {
        PROCESSED: "processed",
        ORIGINAL: "original",
        DELETE: "delete",
        SRCSET: "srcset",
    };
    constructor(filePath) {
        this.filePath = filePath;
        this.dir = path.dirname(filePath);
        this.ext = path.extname(filePath);
        this.nameWithoutExt = path.basename(
            filePath,
            this.ext
        );
    }
    getMarkedPath(marker) {
        return path.join(
            this.dir,
            `${this.nameWithoutExt}.${marker}${this.ext}`
        );
    }
    hasMarker(marker) {
        return this.nameWithoutExt.endsWith(`.${marker}`);
    }
    async addMarker(marker) {
        // Если уже есть этот маркер - ничего не делаем
        if (this.hasMarker(marker)) return this.filePath;

        // Убираем все существующие маркеры перед добавлением нового
        const cleanName = this.removeAllMarkers();
        const dir = path.dirname(this.filePath);
        const ext = path.extname(this.filePath);

        const newPath = path.join(
            dir,
            `${cleanName}.${marker}${ext}`
        );
        await fs.rename(this.filePath, newPath);
        return newPath;
    }

    // Удалить все известные маркеры из имени
    removeAllMarkers() {
        let cleanName = this.nameWithoutExt;

        // Удаляем все известные маркеры
        for (const markerValue of Object.values(
            MarkerFile.MARKERS
        )) {
            cleanName = cleanName.replace(
                `.${markerValue}`,
                ""
            );
        }

        return cleanName;
    }

    removeMarker(marker) {
        if (!this.hasMarker(marker)) return this.filePath;
        const cleanedName = this.nameWithoutExt.replace(
            `.${marker}`,
            ""
        );
        return path.join(
            this.dir,
            `${cleanedName}${this.ext}`
        );
    }
    async markProcessed() {
        return this.addMarker(MarkerFile.MARKERS.PROCESSED);
    }
    async markOriginal() {
        return this.addMarker(MarkerFile.MARKERS.ORIGINAL);
    }
    async markSrcset() {
        return this.addMarker(MarkerFile.MARKERS.SRCSET);
    }
    async markDelete() {
        return this.addMarker(MarkerFile.MARKERS.DELETE);
    }
    isMarkProcessed() {
        return this.hasMarker(MarkerFile.MARKERS.PROCESSED);
    }
    isMarkOriginal() {
        return this.hasMarker(MarkerFile.MARKERS.ORIGINAL);
    }
    isMarkSrcset() {
        return this.hasMarker(MarkerFile.MARKERS.SRCSET);
    }
    isMarkDelete() {
        return this.hasMarker(MarkerFile.MARKERS.DELETE);
    }
}
