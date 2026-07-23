import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(import.meta.dirname, '..');
const publicDirectory = resolve(root, 'public');
const regularSource = resolve(publicDirectory, 'icon-master.svg');
const maskableSource = resolve(publicDirectory, 'maskable-icon-master.svg');
const regularSvg = await readFile(regularSource, 'utf8');
const maskableSvg = await readFile(maskableSource, 'utf8');

const regularSizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const regularNames = new Map([
  [16, 'favicon-16x16.png'],
  [32, 'favicon-32x32.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192x192.png'],
  [512, 'icon-512x512.png']
]);

for (const size of regularSizes) {
  const filename = regularNames.get(size) ?? `icon-${size}x${size}.png`;
  const image = new Resvg(regularSvg, {
    fitTo: { mode: 'width', value: size }
  }).render().asPng();
  await writeFile(resolve(publicDirectory, filename), image);
}

for (const size of [192, 512]) {
  const image = new Resvg(maskableSvg, {
    fitTo: { mode: 'width', value: size }
  }).render().asPng();
  await writeFile(resolve(publicDirectory, `maskable-icon-${size}x${size}.png`), image);
}

// ICO containers may embed PNG data. One 32px entry is sufficient for modern browsers.
const png = await readFile(resolve(publicDirectory, 'favicon-32x32.png'));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const directory = Buffer.alloc(16);
directory.writeUInt8(32, 0);
directory.writeUInt8(32, 1);
directory.writeUInt8(0, 2);
directory.writeUInt8(0, 3);
directory.writeUInt16LE(1, 4);
directory.writeUInt16LE(32, 6);
directory.writeUInt32LE(png.length, 8);
directory.writeUInt32LE(22, 12);
await writeFile(resolve(publicDirectory, 'favicon.ico'), Buffer.concat([header, directory, png]));

console.log(`Generated ${regularSizes.length + 3} Calm Sky icon files.`);
