// The items that fell out of the event, as three screens count them.
//
// The dialog that changes an event's categories used to promise that items in a
// removed category "will be shown under the old category name". They were not
// shown at all: the event page draws a tile per category of the event, hides a
// tile with nothing in it, and an item in a category the event does not have
// is counted toward no tile. The dialog now says how many items that would
// leave out and offers to move them, the event page tells the organiser they
// exist, and the dashboard card marks the event. All three ask the same
// question, and this is the function they ask.
//
// It is not a second rule. It is `groupItemsByCategory` and its `isNotInEvent`
// read from the other side, and the tests below say so: what the grouping marks
// as foreign is exactly what this function returns, no more and no less.
// See DOCS/PLANING/94-the-category-change-dialog-promises-a-display-that-does-not-exist.md
// and DOCS/PLANING/96-the-organiser-has-no-way-to-know-an-item-fell-out-of-the-event.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  groupItemsByCategory,
  itemsLeftOutOfEvent,
  RIDE_CATEGORY_IDS,
} from '../../src/utils/eventUtils.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (relative) => readFileSync(`${SRC}/${relative}`, 'utf8');

const category = (id, order) => ({ id, name: `שם של ${id}`, icon: '1.gif', color: '#000000', order });
const categoriesOf = (...ids) => ids.map((id, i) => category(id, i + 1));
const item = (id, categoryId) => ({ id, name: `פריט ${id}`, category: categoryId });
const idsOf = (items) => items.map((i) => i.id).sort();

describe('the items left out of the event', () => {
  test('are the items in a category the event does not have', () => {
    const left = itemsLeftOutOfEvent(
      [item('a', 'meat'), item('b', 'main'), item('c', 'salads'), item('d', 'dessert')],
      categoriesOf('meat', 'salads', 'general'),
    );
    assert.deepEqual(idsOf(left), ['b', 'd']);
  });

  test('and there are none when every item is in one of the event\'s categories', () => {
    const left = itemsLeftOutOfEvent(
      [item('a', 'meat'), item('b', 'salads')],
      categoriesOf('meat', 'salads'),
    );
    assert.deepEqual(left, []);
  });

  test('and none for an event with no items', () => {
    assert.deepEqual(itemsLeftOutOfEvent([], categoriesOf('meat')), []);
    assert.deepEqual(itemsLeftOutOfEvent(undefined, categoriesOf('meat')), []);
  });

  test('a ride is never left out, whichever id it holds and even with no ride category on the event', () => {
    const rides = RIDE_CATEGORY_IDS.map((id, i) => item(`ride-${i}`, id));
    const left = itemsLeftOutOfEvent([...rides, item('x', 'main')], categoriesOf('meat'));
    assert.deepEqual(idsOf(left), ['x']);
  });

  test('an item with no category at all is left out', () => {
    const left = itemsLeftOutOfEvent([item('a', undefined), item('b', '')], categoriesOf('meat'));
    assert.deepEqual(idsOf(left), ['a', 'b']);
  });

  // The dialog asks this against the categories the organiser is about to save,
  // not the ones the event holds now. Removing a category the items are in is
  // what leaves them out, and putting it back is what brings them home.
  test('is asked against the categories about to be saved, so removing a category leaves its items out', () => {
    const items = [item('a', 'meat'), item('b', 'salads'), item('c', 'salads')];
    assert.deepEqual(itemsLeftOutOfEvent(items, categoriesOf('meat', 'salads')), []);
    assert.deepEqual(idsOf(itemsLeftOutOfEvent(items, categoriesOf('meat'))), ['b', 'c']);
    assert.deepEqual(itemsLeftOutOfEvent(items, categoriesOf('meat', 'salads')), []);
  });

  test('keeps the items themselves, not copies, so the caller can write to them by id', () => {
    const stray = item('b', 'main');
    const left = itemsLeftOutOfEvent([item('a', 'meat'), stray], categoriesOf('meat'));
    assert.equal(left[0], stray);
  });

  test('is exactly what the grouping marks as not in the event, no more and no less', () => {
    const items = [
      item('a', 'meat'), item('b', 'main'), item('c', 'toString'), item('d', 'ride_offers'),
      item('e', undefined), item('f', 'salads'),
    ];
    const categories = categoriesOf('meat', 'salads');
    const fromGroups = groupItemsByCategory(items, categories)
      .filter((g) => g.isNotInEvent)
      .flatMap((g) => g.items);
    assert.deepEqual(idsOf(itemsLeftOutOfEvent(items, categories)), idsOf(fromGroups));
    assert.deepEqual(idsOf(fromGroups), ['b', 'c', 'e']);
  });
});

// A correct function and three screens that count some other way is the one
// failure none of the tests above can see. These fail by name on the source
// from before the campaign.
describe('the three screens ask this function and not a rule of their own', () => {
  test('the category change dialog', () => {
    assert.match(read('components/Admin/EventForm.tsx'), /itemsLeftOutOfEvent\(/);
  });

  test('and the dialog no longer promises a display under the old category name', () => {
    assert.doesNotMatch(read('components/Admin/EventForm.tsx'), /יוצגו תחת שם הקטגוריה הישן/);
  });
});
