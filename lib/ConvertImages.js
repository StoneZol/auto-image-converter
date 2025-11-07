import sharp from "sharp";

export class ConvertImages {
    constructor(source, format, quality) {
        this.source = source; // может быть путь (string) или буфер (Buffer)
        this.format = format;
        this.quality = quality;
    }
    toWebp() {
        return sharp(this.source)
            .webp({ quality: this.quality })
            .toBuffer();
    }
    toAvif() {
        return sharp(this.source)
            .avif({ quality: this.quality })
            .toBuffer();
    }
    toPng() {
        return sharp(this.source)
            .png({ quality: this.quality })
            .toBuffer();
    }
    toJpg() {
        return sharp(this.source)
            .jpeg({ quality: this.quality })
            .toBuffer();
    }
    toTiff() {
        return sharp(this.source)
            .tiff({ quality: this.quality })
            .toBuffer();
    }
}
