// A category carries its icon as a filename, and the screens turn that filename
// into a path under /Icons/. Nothing checked that the file at the other end of
// the path is actually there.
//
// It was not. The safety net in the category selector, the one that was meant
// to catch an icon that failed to load, pointed at a general.png that is not in
// the folder, so a category with a missing icon showed the participant a broken
// image square on the screen the invitation link lands on. Netlify answers an
// unknown path with index.html at status 200, so nothing anywhere reported a
// failure. See DOCS/PLANING/110-the-fallback-icon-does-not-exist.md.
//
// The same folder is also the heaviest thing on that screen. The GIFs are 640
// by 640 and are drawn at eighty, so each one is rebuilt at 240 as an animated
// WebP and the screens ask for that instead. The stored strings still name the
// GIF, so the pairing below is what keeps the mapping honest: a GIF with no
// converted file beside it is a category that silently falls back to the heavy
// original, and a converted file with no GIF is one nothing will ever ask for.
// See DOCS/PLANING/108-category-icons-are-seven-megabytes-of-gif.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const ICONS = fileURLToPath(new URL('../../public/Icons', import.meta.url));

/** Every .tsx and .ts file under src, so no screen can be missed by hand. */
function sourceFiles(dir = SRC) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

// public/Icons is the only folder that matters. dist/ holds a copy of it and is
// not what Netlify builds from.
const onDisk = readdirSync(ICONS).sort();
const gifs = onDisk.filter((name) => name.endsWith('.gif'));
const converted = onDisk.filter((name) => name.endsWith('.webp'));
const files = sourceFiles();

// A literal path only. `/Icons/${category.icon}` is a value the database
// supplies at run time, not a filename this test can check, and the `$` stops
// the match before it.
const ICON_PATH = /\/Icons\/([A-Za-z0-9_][A-Za-z0-9_.-]*)/g;

// Measured on the built set: the heaviest is meat.webp at 731,964 and the
// seventeen together are 5,401,434. These are ceilings with a little room, not
// the numbers themselves, and they exist so that a rebuild at the wrong size or
// the wrong quality is caught here.
const CEILING_PER_FILE = 800_000;
const CEILING_TOTAL = 5_600_000;

describe('the icon files the source asks for', () => {
  test('the scan reaches the source and the folder', () => {
    // A scan that passes because it found nothing is not a scan.
    assert.ok(files.length > 50, `only ${files.length} source files were read`);
    assert.ok(gifs.length > 0, 'public/Icons was read as holding no GIF at all');
    assert.ok(converted.length > 0, 'public/Icons was read as holding no converted file at all');
  });

  test('every icon path written in the source names a file that is there', () => {
    const offenders = [];
    let found = 0;
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(ICON_PATH)) {
        found += 1;
        if (!onDisk.includes(match[1])) {
          offenders.push(`${file.slice(SRC.length + 1)}: ${match[1]}`);
        }
      }
    }
    assert.ok(found > 0, 'no icon path was found in the source at all');
    assert.deepEqual(offenders, [], 'these icon paths name a file that is not in public/Icons');
  });
});

describe('the icon picker the organiser chooses from', () => {
  const listed = [
    ...readFileSync(`${SRC}/constants/templates.ts`, 'utf8')
      .split('export const AVAILABLE_ICONS = [')[1]
      .split(']')[0]
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);

  test('offers no file that is missing from the folder', () => {
    assert.deepEqual(
      listed.filter((name) => !onDisk.includes(name)),
      [],
      'the picker offers these, and they are not in public/Icons',
    );
  });

  test('offers every original that is in the folder', () => {
    const originals = onDisk.filter((name) => !name.endsWith('.webp'));
    assert.deepEqual(
      originals.filter((name) => !listed.includes(name)),
      [],
      'these are in public/Icons, and the picker does not offer them',
    );
  });
});

describe('the converted icons the screens actually load', () => {
  test('every GIF has one built beside it', () => {
    assert.deepEqual(
      gifs.filter((name) => !converted.includes(name.replace(/\.gif$/, '.webp'))),
      [],
      'these GIFs have no converted file, so they would still be served whole',
    );
  });

  test('none was built for a file that is gone', () => {
    assert.deepEqual(
      converted.filter((name) => !gifs.includes(name.replace(/\.webp$/, '.gif'))),
      [],
      'these converted files have no original, so nothing will ever ask for them',
    );
  });

  test('none of them is heavier than the ceiling', () => {
    const offenders = converted
      .map((name) => [name, statSync(`${ICONS}/${name}`).size])
      .filter(([, size]) => size > CEILING_PER_FILE)
      .map(([name, size]) => `${name}: ${size}`);
    assert.deepEqual(offenders, [], `these are over ${CEILING_PER_FILE} bytes each`);
  });

  test('and together they stay under the ceiling', () => {
    const total = converted.reduce((sum, name) => sum + statSync(`${ICONS}/${name}`).size, 0);
    assert.ok(
      total <= CEILING_TOTAL,
      `the converted icons are ${total} bytes, over the ceiling of ${CEILING_TOTAL}`,
    );
  });
});
