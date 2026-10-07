/**
 * Regenerates the raster brand files in public/brand/ from docs/logo/:
 * favicon PNGs + .ico, apple-touch-icon and the default Open Graph image.
 *
 *   npx tsx scripts/build-brand-assets.ts
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "docs/logo";
const OUT = "public/brand";
const CREAM = { r: 247, g: 243, b: 229, alpha: 1 };

const emblem = (size: number) => sharp(`${OUT}/logo-only.svg`, { density: 600 }).resize(size, size);

/** ICO container holding one PNG per size (supported by every current browser). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size === 256 ? 0 : size, at);
    header.writeUInt8(size === 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

async function main() {
  const png = (size: number) => emblem(size).png({ compressionLevel: 9 }).toBuffer();
  const [p16, p32, p48] = await Promise.all([png(16), png(32), png(48)]);
  writeFileSync("src/app/favicon.ico", ico([{ size: 16, png: p16 }, { size: 32, png: p32 }, { size: 48, png: p48 }]));
  writeFileSync(`${OUT}/icon-32.png`, p32);
  writeFileSync(`${OUT}/icon-192.png`, await png(192));
  writeFileSync(`${OUT}/icon-512.png`, await png(512));

  // iOS fills transparency with black, so the touch icon sits on cream with some padding.
  const inner = await png(140);
  await sharp({ create: { width: 180, height: 180, channels: 4, background: CREAM } })
    .composite([{ input: inner, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/apple-touch-icon.png`);

  // Logo-white-bg.jpg is 3807x2704; fit it inside the 1200x630 share card on its own cream.
  await sharp(`${SRC}/Logo-white-bg.jpg`)
    .resize(1200, 630, { fit: "contain", background: CREAM })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/og-default.jpg`);
}

main();
