import sharp from "sharp";

const MAX_SIZE = 512;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
  base64DataUri: string;
}

/**
 * Process an avatar image: center-crop to square, resize to at most 512×512,
 * output as PNG.
 */
export async function processAvatarImage(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input).metadata();
  const w = metadata.width || MAX_SIZE;
  const h = metadata.height || MAX_SIZE;

  // Center-crop to square (use smallest dimension)
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);

  // Determine final size (at most MAX_SIZE)
  const finalSize = Math.min(side, MAX_SIZE);

  const outputBuffer = await sharp(input)
    .extract({ left, top, width: side, height: side })
    .resize(finalSize, finalSize, { fit: "cover" })
    .png()
    .toBuffer();

  const base64 = outputBuffer.toString("base64");

  return {
    buffer: outputBuffer,
    width: finalSize,
    height: finalSize,
    mimeType: "image/png",
    base64DataUri: `data:image/png;base64,${base64}`,
  };
}
