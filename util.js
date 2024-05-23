export function rgba2rgb565(rgba, pixelSize) {
    const output = Buffer.alloc(pixelSize * 2)
    // Convert from RGBA to RGB16_565
    for (let i = 0; i < pixelSize * 4; i += 4) {
        const red = rgba[i]
        const green = rgba[i + 1]
        const blue = rgba[i + 2]
        let color = blue >> 3
        color |= (green & 0xfc) << 3
        color |= (red & 0xf8) << 8
        output.writeUInt16LE(color, i / 2)
    }
    return output
}
