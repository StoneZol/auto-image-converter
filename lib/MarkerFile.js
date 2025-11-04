import path from "path";
import fs from "fs/promises";

export class MarkerFile {
    static MARKERS = {
        PROCESSED: "processed",
        ORIGINAL: "original",
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
        if (this.hasMarker(marker)) return this.filePath;
        const newPath = this.getMarkedPath(marker);
        await fs.rename(this.filePath, newPath);
        return newPath;
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
        return this.addMarker(this.MARKERS.PROCESSED);
    }
    async markOriginal() {
        return this.addMarker(this.MARKERS.ORIGINAL);
    }
    async markSrcset() {
        return this.addMarker(this.MARKERS.SRCSET);
    }
    isMarkProcessed() {
        return this.hasMarker(this.MARKERS.PROCESSED);
    }
    isMarkOriginal() {
        return this.hasMarker(this.MARKERS.ORIGINAL);
    }
    isMarkSrcset() {
        return this.hasMarker(this.MARKERS.SRCSET);
    }
}
