// Builds the animated WebP that the category screens actually load.
//
// The seventeen GIFs in public/Icons are 640 by 640, and the largest place any
// of them is ever drawn is eighty pixels. So most of every one of those files
// is pixels no screen paints. Measured on the live site, the six a sample event
// pulls came to 6,896,730 bytes, and an event on other categories pulls more.
//
// This rebuilds each one at 240 pixels, which is three times the display size
// and therefore has headroom on the densest phone screen there is. Every frame
// and every millisecond of the loop is kept: the animation is not touched, only
// the pixel count and the encoder.
//
// The GIFs stay where they are on purpose. The screens prefer the WebP and fall
// back to the GIF, so a rollback is a one line change rather than restoring
// seventeen files. See DOCS/PLANING/108-category-icons-are-seven-megabytes-of-gif.md.
//
// sharp is deliberately not a dependency of this project. It is needed to run
// this script and nothing else, so install it for the run and let it go:
//   npm install sharp --no-save
//   node scripts/build-icons.mjs

import sharp from 'sharp';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ICONS = fileURLToPath(new URL('../public/Icons', import.meta.url));

// Three times the eighty pixels of the category card. Quality 85 is high enough
// that the encoder is not the thing anyone would notice; the GIFs it replaces
// are limited to 256 colours and dithered, so this is not a step down.
const SIZE = 240;
const QUALITY = 85;

const sources = readdirSync(ICONS).filter((name) => name.toLowerCase().endsWith('.gif'));
let before = 0;
let after = 0;

for (const name of sources) {
  const from = `${ICONS}/${name}`;
  const to = `${ICONS}/${name.replace(/\.gif$/i, '.webp')}`;

  const built = await sharp(from, { animated: true })
    .resize(SIZE, SIZE, { fit: 'inside' })
    // No frame in any of these uses transparency, so the alpha channel is
    // weight and nothing else.
    .flatten({ background: '#ffffff' })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  writeFileSync(to, built);
  before += statSync(from).size;
  after += built.length;
  console.log(`${name.padEnd(14)} ${String(statSync(from).size).padStart(9)} -> ${String(built.length).padStart(8)}`);
}

console.log('---');
console.log(`${sources.length} files: ${before} -> ${after}, ${(100 * (1 - after / before)).toFixed(1)}% smaller`);
