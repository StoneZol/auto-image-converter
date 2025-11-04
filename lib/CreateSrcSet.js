export class CreateSrcSet {
    // Resize modes
    static RESIZE_MODES = {
        COVER: "cover", // Fill the entire size, cropping excess
        CONTAIN: "contain", // Contain fully, preserving proportions
        FILL: "fill", // Stretch to size (distortion)
        INSIDE: "inside", // Contain inside size (like contain)
        OUTSIDE: "outside", // Cover outside (like cover)
    };
    constructor(filePath, options = {}) {
        this.filePath = filePath;
        this.format = options.format;
        this.quality = options.quality;
        this.resizeMode = options.resizeMode; // [{w:32,h:32}, {w:64,h:64}, {w:128,h:128}]
        this.w = options.w;
        this.h = options.h;
    }
    getOutputFileName(w, h) {
        return `${this.nameWithoutExt}-${w}x${h}.${this.format}`;
    }
    createCover(w, h) {
        return sharp(this.filePath).resize(w, h).toBuffer();
    }
    createContain(w, h) {
        return sharp(this.filePath).resize(w, h).toBuffer();
    }
    createFill(w, h) {
        return sharp(this.filePath).resize(w, h).toBuffer();
    }
    createInside(w, h) {
        return sharp(this.filePath).resize(w, h).toBuffer();
    }
    createOutside(w, h) {
        return sharp(this.filePath).resize(w, h).toBuffer();
    }

    create(w, h) {
        switch (this.resizeMode) {
            case this.RESIZE_MODES.COVER:
                return this.createCover(w, h);
            case this.RESIZE_MODES.CONTAIN:
                return this.createContain(w, h);
            case this.RESIZE_MODES.FILL:
                return this.createFill(w, h);
            case this.RESIZE_MODES.INSIDE:
                return this.createInside(w, h);
            case this.RESIZE_MODES.OUTSIDE:
                return this.createOutside(w, h);
            default:
                throw new Error(
                    `Invalid resize mode: ${this.resizeMode}`
                );
        }
    }
    createSrcSet() {
        return this.resizeModes.map((mode) => {
            return this.create(mode.w, mode.h);
        });
    }
}
