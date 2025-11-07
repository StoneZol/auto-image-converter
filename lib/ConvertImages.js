export class ConvertImages {
    constructor(filePath, format, quality) {
        this.filePath = filePath;
        this.format = format;
        this.quality = quality;
    }
    toWebp() {
        return sharp(this.filePath)
            .webp({ quality: this.quality })
            .toBuffer();
    }
    toAvif() {
        return sharp(this.filePath)
            .avif({ quality: this.quality })
            .toBuffer();
    }
    toPng() {
        return sharp(this.filePath)
            .png({ quality: this.quality })
            .toBuffer();
    }
    toJpg() {
        return sharp(this.filePath)
            .jpeg({ quality: this.quality })
            .toBuffer();
    }
    toTiff() {
        return sharp(this.filePath)
            .tiff({ quality: this.quality })
            .toBuffer();
    }
}
