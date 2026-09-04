// A ride does not enter a smart migration.
//
// A migration moves items between the event's categories. A ride has no
// category it could be moved to: the ride categories are not stored on the
// event at all, they are added to the list when a screen draws it, and the
// import window reads the stored list directly. So a ride was not in the
// allowed set, and the rule that puts anything unrecognised into the event's
// catch-all, which is right and was built in campaign 17, put it there. The
// ride stopped being a ride, stopped appearing where people look for a lift,
// and started taking up its owner's item quota instead of his ride quota.
//
// The database rules forbid exactly this crossing, and exempt the organiser
// from it on purpose, because the bulk items screen changes categories as a
// matter of routine. The migration writes as the organiser, so nothing stopped
// it. The fix is in the client, in what is sent.
// See DOCS/PLANING/80-smart-migration-turns-rides-into-ordinary-items.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  itemsEnteringMigration,
  RIDE_CATEGORY_IDS,
  RIDE_OFFER_CATEGORY_IDS,
  RIDE_REQUEST_CATEGORY_IDS,
} from '../../src/utils/eventUtils.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (relative) => readFileSync(`${SRC}/${relative}`, 'utf8');

const food = [
  { id: 'a', name: 'סלט', category: 'salads' },
  { id: 'b', name: 'פיתות', category: 'pitas' },
  { id: 'c', name: 'פחמים', category: 'equipment' },
];

// Every name the product calls a ride, offered and asked for, including the two
// older ids that existing events still use.
const rides = RIDE_CATEGORY_IDS.map((category, i) => ({
  id: `r${i}`,
  name: `טרמפ ${i}`,
  category,
}));

describe('the items a migration may touch', () => {
  test('are the food and the equipment', () => {
    assert.deepEqual(itemsEnteringMigration([...food, ...rides]), food);
  });

  test('and a ride offered and a ride asked for are both left out', () => {
    assert.ok(RIDE_OFFER_CATEGORY_IDS.length > 0 && RIDE_REQUEST_CATEGORY_IDS.length > 0);
    for (const category of RIDE_CATEGORY_IDS) {
      assert.deepEqual(itemsEnteringMigration([{ id: 'x', name: 'טרמפ', category }]), []);
    }
  });

  test('and an event with no rides sends everything it has', () => {
    assert.deepEqual(itemsEnteringMigration(food), food);
  });

  test('and an item whose category was never set is not mistaken for a ride', () => {
    const orphan = [{ id: 'z', name: 'משהו', category: undefined }];
    assert.deepEqual(itemsEnteringMigration(orphan), orphan);
  });

  test('and an event with nothing in it is nothing to migrate', () => {
    assert.deepEqual(itemsEnteringMigration([]), []);
    assert.deepEqual(itemsEnteringMigration(undefined), []);
  });
});

describe('the screens that build a migration', () => {
  // The list sent for analysis and the list the preview is built from are two
  // different lines in two different files. Fixing one and not the other leaves
  // the defect standing, and no test of a pure function can see that.
  test('both ask which items may enter one', () => {
    for (const file of ['components/Admin/EventForm.tsx', 'components/Admin/ImportItemsModal.tsx']) {
      assert.ok(
        read(file).includes('itemsEnteringMigration'),
        `${file} builds a migration list without asking which items may enter one`,
      );
    }
  });

  test('and the form offers one on the same list it would build', () => {
    // An event can hold nothing but rides, and then there is nothing to migrate.
    // Offering a migration on the raw item count and building the list from the
    // filtered one saved the new categories and opened no window at all: the
    // form was left sitting there with the screen behind it holding stale counts.
    assert.ok(
      !/Object\.keys\(event\.menuItems\)\.length > 0/.test(read('components/Admin/EventForm.tsx')),
      'the form decides whether to migrate from every item the event holds, and builds the list from fewer',
    );
  });
});

describe('the write that finishes a migration', () => {
  // An item created while the organiser was migrating is put back afterwards,
  // and its category is checked against the same allowed set, which has no ride
  // in it. A lift offered during the migration was turned into food by that
  // line. The category of a ride is kept as it is.
  test('keeps a ride offered while the migration was running a ride', () => {
    const text = read('services/firebaseService.ts');
    const concurrent = text.slice(text.indexOf('Concurrent Items'), text.indexOf('Clear existing structure'));
    assert.ok(
      /isRideCategory\(/.test(concurrent),
      'an item added during the migration is re-categorised without asking whether it is a ride',
    );
  });
});
