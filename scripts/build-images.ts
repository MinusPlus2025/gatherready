/**
 * Build responsive WebP derivatives for the local stand-in photography.
 * Source JPEGs stay as the fallback; the UI serves <picture> with WebP srcset.
 * Run: npm run images:build
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images');
const WIDTHS = [480, 800, 1600];
const FILES = [
  'pottery-hands.jpg',
  'pottery-workshop.jpg',
  'pottery-studio.jpg',
  'pottery-terracotta.jpg',
  'pottery-trimming.jpg',
  'pottery-detail.jpg',
];

async function main(): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  for (const file of FILES) {
    const source = path.join(ROOT, file);
    const base = file.replace(/\.jpg$/, '');
    for (const width of WIDTHS) {
      const target = path.join(ROOT, `${base}-${width}.webp`);
      await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(target);
      const info = await stat(target);
      console.log(`${path.basename(target)}  ${Math.round(info.size / 1024)} KiB`);
    }
  }
}

main().catch((error: unknown) => {
  console.error('image build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
