// A category carries its icon as a filename, and the screens turn that filename
// into a path under /Icons/. Nothing checked that the file at the other end of
// the path is actually there.
//
// It was not. The safety net in the category selector, the one that was meant
// to catch an icon that failed to load, pointed at a general.png that is not in
// the folder, so a category with a missing icon showed the participant a broken
// image square on the screen the invitation link lands on. Netlify answers an
// unknown path with index.html at status 200, so nothing anywhere reported a
// failure.
//
// These scans are the guard. The first says every icon path written in the
// source names a file that exists. The second says the picker offers exactly
// the files that are in the folder, no more and no fewer, which is what makes a
// future rename of those files visible here instead of on a participant's phone.
// See DOCS/PLANING/110-the-fallback-icon-does-not-exist.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

// public/Icons is the only folder that matters. dist/ holds a stale copy of it
// and is not what Netlify builds from.
const onDisk = readdirSync(ICONS).sort();

// A literal path only. `/Icons/${category.icon}` is a value the database
// supplies at run time, not a filename this test can check, and the `$` stops
// the match before it.
const ICON_PATH = /\/Icons\/([A-Za-z0-9_][A-Za-z0-9_.-]*)/g;

const files = sourceFiles();

describe('the icon files the source asks for', () => {
  test('the scan reaches the source and the folder', () => {
    // A scan that passes because it found nothing is not a scan.
    assert.ok(files.length > 50, `only ${files.length} source files were read`);
    assert.ok(onDisk.length > 0, 'public/Icons was read as empty');
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

  test('offers every file that is in the folder', () => {
    assert.deepEqual(
      onDisk.filter((name) => !listed.includes(name)),
      [],
      'these are in public/Icons, and the picker does not offer them',
    );
  });
});
