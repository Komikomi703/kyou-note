// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDirectory = resolve(process.cwd(), 'public');

const pngAssets: Array<[string, number]> = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['icon-48x48.png', 48],
  ['icon-72x72.png', 72],
  ['icon-96x96.png', 96],
  ['icon-128x128.png', 128],
  ['icon-144x144.png', 144],
  ['icon-152x152.png', 152],
  ['apple-touch-icon.png', 180],
  ['icon-192x192.png', 192],
  ['icon-384x384.png', 384],
  ['icon-512x512.png', 512],
  ['maskable-icon-192x192.png', 192],
  ['maskable-icon-512x512.png', 512]
];

describe('PWAアイコン', () => {
  it.each(pngAssets)('%s は指定寸法の正常なPNG', async (filename, size) => {
    const png = await readFile(resolve(publicDirectory, filename));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });

  it('favicon.ico は32px PNGを格納したICO', async () => {
    const ico = await readFile(resolve(publicDirectory, 'favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect(ico[6]).toBe(32);
    expect(ico[7]).toBe(32);
    expect([...ico.subarray(22, 30)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('ManifestとHTMLが実在する端末別アイコンを参照する', async () => {
    const config = await readFile(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8');

    for (const filename of [
      'icon-192x192.png',
      'icon-512x512.png',
      'maskable-icon-192x192.png',
      'maskable-icon-512x512.png'
    ]) {
      expect(config).toContain(filename);
    }
    expect(config).toContain("purpose: 'any'");
    expect(config).toContain("purpose: 'maskable'");
    expect(html).toContain('/favicon.ico');
    expect(html).toContain('/apple-touch-icon.png');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('viewport-fit=cover');
  });
});
