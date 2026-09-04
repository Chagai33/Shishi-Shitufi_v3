// A preset list is a list of names and quantities.
//
// It belongs to the organiser and not to any one event, and it is used across
// several. So there is no event whose categories it could be carrying, and it
// carried the five of the friday dinner: an organiser of "on the fire" who
// loaded one got twelve items in categories that event does not have, and none
// of them appeared on the board. The dropdown on the preset screen was the same
// five, so a list the organiser built by hand could not carry a category of his
// own event either. That was the source and not the symptom.
//
// The category is decided at import, from the event being imported into, in the
// same way a file import decides it.
// See DOCS/PLANING/79-preset-lists-carry-friday-dinner-categories.md.
//
// The two source scans here guard code inside a .tsx that node cannot import,
// the technique test/rules/limits.test.mjs already uses.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetItemsAsWritten } from '../../src/utils/presetLists.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (relative) => readFileSync(`${SRC}/${relative}`, 'utf8');

// The two files that hold a built-in list. The screen holds the pair an
// organiser sees when creating one from scratch; the service holds them twice
// more, for the account that has some lists and for the account that has none.
const PRESET_SOURCES = ['components/Admin/PresetListsManager.tsx', 'services/firebaseService.ts'];

describe('a built-in preset list', () => {
  test('carries no category', () => {
    const offenders = [];
    for (const file of PRESET_SOURCES) {
      // A preset row is one object literal on one line, with the name first.
      for (const match of read(file).matchAll(/\{\s*name:[^}\n]*\bcategory:\s*'([^']*)'[^}\n]*\}/g)) {
        offenders.push(`${file.split('/').pop()}: ${match[1]}`);
      }
    }
    assert.deepEqual(offenders, [], 'these preset rows still carry a category');
  });
});

describe('the screen that edits a preset list', () => {
  const screen = read(PRESET_SOURCES[0]);

  test('offers no category to choose', () => {
    // It had a list of five, written into the code and unaware of any event, so
    // an organiser could not put a category of his own event on a row even by
    // hand. Removing it is the fix and not a side effect of it.
    assert.ok(!/categoryOptions/.test(screen), 'the preset screen still offers a list of categories');
    assert.ok(!/categories\.starter/.test(screen), 'the preset screen still names the friday dinner categories');
  });

  test('does not put one on a new row either', () => {
    assert.ok(!/category:\s*'/.test(screen), 'a new preset row is still given a category');
  });
});

describe('a preset list saved before the change', () => {
  // The rows in the database still carry the old field. Reading one has to keep
  // working, and re-saving it has to stop carrying the field forward.
  const stored = [
    { name: 'חלה', category: 'main', quantity: 2, isRequired: true },
    { name: 'יין אדום', category: 'drink', quantity: 1, notes: 'יבש', isRequired: false },
  ];

  test('still loads', () => {
    const loaded = presetItemsAsWritten(stored);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].name, 'חלה');
    assert.equal(loaded[0].quantity, 2);
    assert.equal(loaded[0].isRequired, true);
    assert.equal(loaded[1].notes, 'יבש');
  });

  test('and comes back without the category it used to carry', () => {
    for (const item of presetItemsAsWritten(stored)) {
      assert.ok(!('category' in item), `"${item.name}" still carries a category`);
    }
  });

  test('and a list that was never saved at all reads as empty', () => {
    assert.deepEqual(presetItemsAsWritten(undefined), []);
    assert.deepEqual(presetItemsAsWritten(null), []);
  });

  test('and a list the database handed back as numbered keys is still a list', () => {
    // An array is stored as numbered keys, and comes back as an object rather
    // than an array whenever those numbers are not a run from zero. Reading only
    // the array would lose the list instead of migrating it.
    const asKeys = { 0: stored[0], 1: stored[1] };
    assert.deepEqual(
      presetItemsAsWritten(asKeys).map((item) => item.name),
      ['חלה', 'יין אדום'],
    );
  });

  test('and a row with no quantity is still a row', () => {
    const [only] = presetItemsAsWritten([{ name: 'מים' }]);
    assert.equal(only.name, 'מים');
    assert.equal(only.quantity, 1);
    assert.equal(only.isRequired, false);
  });
});
