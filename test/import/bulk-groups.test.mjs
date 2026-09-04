// An item in a category the event does not have is drawn in the bulk screen.
//
// The screen built its groups from one list and drew them from another. Anything
// the first list did not recognise went into a bucket named by the literal
// 'other', and the second list only ever asked for the event's own categories,
// so that bucket was drawn only by an event that happened to own a category
// called 'other'. "On the fire" calls its catch-all 'general' and "party" has
// none at all, so the item was built into a group and never drawn: it could not
// be ticked, its category could not be changed, and nothing said it was there.
// That is the only screen where such items can be repaired in bulk.
//
// The measurement below is the reason this file exists: the hiding is in six of
// the eight templates, not the two the record named. And in the two that do draw
// the item, they draw it inside the event's own "אחר", which is the claim the
// branch closed everywhere else.
// See DOCS/PLANING/89-an-item-in-an-unknown-category-is-invisible-in-the-bulk-screen.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  groupItemsByCategory,
  RIDE_CATEGORY_IDS,
  RIDE_OFFER_CATEGORY_IDS,
} from '../../src/utils/eventUtils.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (relative) => readFileSync(`${SRC}/${relative}`, 'utf8');

// The category ids of every template, as templates.ts holds them. The test at
// the end of this file is what notices when that stops being true.
const TEMPLATES = {
  'ארוחת שישי': ['starter', 'main', 'dessert', 'drink', 'equipment', 'other'],
  'על האש': ['meat', 'salads', 'pitas', 'equipment', 'drinks', 'general'],
  'פיקניק': ['finger_food', 'equipment', 'drinks', 'general'],
  'מסיבת כיתה': ['food', 'healthy', 'drinks', 'equipment'],
  'מסיבה': ['alcohol', 'food', 'atmosphere'],
  'ארוחה חלבית': ['dairy', 'salads', 'sweets'],
  'טיול': ['food', 'equipment'],
};

// What a screen hands the function: the event's categories, with a name and a
// colour, in the order the event gives them.
const categoriesOf = (templateName) =>
  TEMPLATES[templateName].map((id, order) => ({
    id,
    name: `שם של ${id}`,
    icon: '1.gif',
    color: '#000000',
    order: order + 1,
  }));

const item = (id, category) => ({ id, name: `פריט ${id}`, category });

const groupOf = (groups, categoryId) => groups.find((g) => g.categoryId === categoryId);
const drawnItemIds = (groups) => groups.flatMap((g) => g.items.map((i) => i.id)).sort();

describe('an item in a category the event does not have', () => {
  test('is drawn in "על האש", the event the record was opened for', () => {
    const groups = groupItemsByCategory(
      [item('a', 'meat'), item('b', 'main')],
      categoriesOf('על האש'),
    );
    const stray = groupOf(groups, 'main');
    assert.ok(stray, 'the item in "מנה עיקרית" was not drawn at all');
    assert.deepEqual(stray.items.map((i) => i.id), ['b']);
    assert.equal(stray.isNotInEvent, true);
    assert.equal(stray.category, null);
  });

  test('and in "מסיבה", which has no catch-all category at all', () => {
    const groups = groupItemsByCategory(
      [item('a', 'alcohol'), item('b', 'main')],
      categoriesOf('מסיבה'),
    );
    assert.deepEqual(drawnItemIds(groups), ['a', 'b']);
    assert.equal(groupOf(groups, 'main').isNotInEvent, true);
  });

  test('and it is not seated in the event catch-all on the way', () => {
    const groups = groupItemsByCategory([item('b', 'main')], categoriesOf('על האש'));
    assert.equal(groupOf(groups, 'general'), undefined, 'the stray was put in "כללי/אחר"');
    assert.equal(groupOf(groups, 'other'), undefined);
  });

  test('and no group ever holds an item that is in a different category', () => {
    // The forbidden move, written as an invariant rather than as a comment: a
    // group is drawn under a name, and every item in it holds that name.
    for (const templateName of Object.keys(TEMPLATES)) {
      const items = [
        ...TEMPLATES[templateName].map((id, i) => item(`known-${i}`, id)),
        item('stray-1', 'main'),
        item('stray-2', 'custom-1756900000000'),
        item('stray-3', ''),
      ];
      const groups = groupItemsByCategory(items, categoriesOf(templateName));
      for (const group of groups) {
        for (const drawn of group.items) {
          assert.equal(
            drawn.category,
            group.categoryId,
            `${templateName}: ${drawn.id} was drawn under ${group.categoryId}`,
          );
        }
      }
    }
  });

  test('and every item handed in comes back out, in exactly one group, in every template', () => {
    // The general form of "invisible", so that a template added later cannot
    // quietly reopen this.
    for (const templateName of Object.keys(TEMPLATES)) {
      const items = [
        ...TEMPLATES[templateName].map((id, i) => item(`known-${i}`, id)),
        item('stray-1', 'main'),
        item('stray-2', 'custom-1756900000000'),
        item('stray-3', undefined),
      ];
      const groups = groupItemsByCategory(items, categoriesOf(templateName));
      assert.deepEqual(
        drawnItemIds(groups),
        items.map((i) => i.id).sort(),
        `${templateName} did not draw every item`,
      );
    }
  });
});

describe('the event whose catch-all is called "other"', () => {
  test('keeps drawing every item it draws today', () => {
    const items = [item('a', 'starter'), item('b', 'other'), item('c', 'meat')];
    const groups = groupItemsByCategory(items, categoriesOf('ארוחת שישי'));
    assert.deepEqual(drawnItemIds(groups), ['a', 'b', 'c']);
  });

  test('and its own "אחר" is its own category and not a bucket for strays', () => {
    // This is the change an organiser of a friday dinner sees. Today the stray
    // is pushed into the array that "אחר" was initialised with and drawn under
    // that header, which says the item is somewhere it is not.
    const items = [item('b', 'other'), item('c', 'meat')];
    const groups = groupItemsByCategory(items, categoriesOf('ארוחת שישי'));
    const catchAll = groupOf(groups, 'other');
    assert.deepEqual(catchAll.items.map((i) => i.id), ['b']);
    assert.equal(catchAll.isNotInEvent, false);
    assert.equal(groupOf(groups, 'meat').isNotInEvent, true);
  });
});

describe('the order the groups are drawn in', () => {
  test('is the event order first, then the strays as they turn up', () => {
    const items = [
      item('a', 'main'),
      item('b', 'dessert'),
      item('c', 'zzz-later'),
      item('d', 'starter'),
    ];
    const groups = groupItemsByCategory(items, categoriesOf('ארוחת שישי'));
    assert.deepEqual(groups.map((g) => g.categoryId), ['starter', 'main', 'dessert', 'zzz-later']);
  });

  test('and an empty group is not drawn', () => {
    const groups = groupItemsByCategory([item('a', 'main')], categoriesOf('ארוחת שישי'));
    assert.deepEqual(groups.map((g) => g.categoryId), ['main']);
  });

  test('and two foreign categories are two groups, in the order they turn up', () => {
    const groups = groupItemsByCategory(
      [item('a', 'dessert'), item('b', 'main'), item('c', 'dessert')],
      categoriesOf('על האש'),
    );
    assert.deepEqual(groups.map((g) => g.categoryId), ['dessert', 'main']);
    assert.deepEqual(groups[0].items.map((i) => i.id), ['a', 'c']);
  });
});

describe('a ride', () => {
  test('is drawn in its own group when the event carries the category', () => {
    const categories = [
      ...categoriesOf('על האש'),
      { id: 'ride_offers', name: 'הצעות טרמפ', icon: 'car.gif', color: '#111111', order: 20 },
    ];
    const groups = groupItemsByCategory([item('r', 'ride_offers')], categories);
    assert.equal(groupOf(groups, 'ride_offers').isNotInEvent, false);
  });

  test('and is never called a category the event does not have, by any of its names', () => {
    // The ride categories are not stored on the event: a screen adds them when
    // it draws the list, and only while the organiser's ride switches are on.
    // The older ids are never added at all. Marking those as foreign is the
    // other lie, the one the item card in this screen was taught to avoid.
    assert.ok(RIDE_OFFER_CATEGORY_IDS.length > 1, 'the older ride ids are gone from the list');
    for (const category of RIDE_CATEGORY_IDS) {
      const groups = groupItemsByCategory([item('r', category)], categoriesOf('על האש'));
      const group = groupOf(groups, category);
      assert.ok(group, `a ride in ${category} was not drawn`);
      assert.equal(group.isNotInEvent, false, `${category} was called a foreign category`);
    }
  });
});

describe('the shapes that used to take the whole screen down', () => {
  test('a category named after something every object already has', () => {
    // On a plain object literal `grouped['toString']` finds an inherited
    // function, takes the branch that appends to it, and throws.
    for (const category of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
      const groups = groupItemsByCategory([item('x', category)], categoriesOf('על האש'));
      assert.deepEqual(drawnItemIds(groups), ['x'], `${category} was not drawn`);
      assert.equal(groupOf(groups, category).isNotInEvent, true);
    }
  });

  test('an item with no category at all is drawn, not dropped', () => {
    const groups = groupItemsByCategory(
      [item('x', undefined), item('y', '')],
      categoriesOf('על האש'),
    );
    assert.deepEqual(drawnItemIds(groups), ['x', 'y']);
    assert.equal(groups.length, 1, 'no category and an empty category are one group');
    assert.equal(groups[0].categoryId, '');
  });

  test('two categories sharing an id are one group, and the first one names it', () => {
    const categories = [
      { id: 'main', name: 'הראשונה', icon: '1.gif', color: '#aaaaaa', order: 1 },
      { id: 'main', name: 'השנייה', icon: '1.gif', color: '#bbbbbb', order: 2 },
    ];
    const groups = groupItemsByCategory([item('a', 'main')], categories);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].category.name, 'הראשונה');
  });

  test('nothing at all is nothing at all', () => {
    assert.deepEqual(groupItemsByCategory([], categoriesOf('על האש')), []);
    assert.deepEqual(groupItemsByCategory(undefined, undefined), []);
    assert.deepEqual(groupItemsByCategory([item('a', 'main')], undefined).length, 1);
  });
});

describe('the screen itself', () => {
  // What no test of a pure function can see: the function can be right and the
  // screen can still draw the old list. These read the source.
  const screen = () => read('components/Admin/BulkItemsManager.tsx');

  test('draws the groups the rule returns', () => {
    const text = screen();
    assert.match(text, /groupItemsByCategory\(/, 'the screen does not use the rule');
    assert.match(text, /itemGroups\.map\(group =>/, 'the screen does not draw what the rule returned');
  });

  test('and no longer builds a bucket of its own named after a category id', () => {
    const text = screen();
    assert.doesNotMatch(text, /grouped\['other'\]/, "the bucket named 'other' is still there");
    assert.doesNotMatch(
      text,
      /activeCategories\.map\(group =>/,
      'the screen still draws the event category list instead of the groups',
    );
  });

  test('and the item card is told what its group is called', () => {
    // Otherwise the badge on the card says "a category not in this event" under
    // a header that names the category, on one phone screen.
    const text = screen();
    assert.match(text, /categoryLabel=\{categoryLabel\}/, 'the card still names the category itself');
  });

  test('and the name of a foreign group is a name and not a machine id', () => {
    // A custom category the organiser deleted resolves to its own id, which is a
    // real string, so a guard that only asks whether a name came back would print
    // "custom-1756900000000" as a header.
    const text = screen();
    assert.match(text, /name !== group\.categoryId/, 'a resolved name equal to the id is not guarded');
  });
});

describe('the copied template categories in this file', () => {
  test('are still the categories templates.ts holds', () => {
    const text = read('constants/templates.ts');
    const inSource = new Set([...text.matchAll(/\{\s*id:\s*'([^']+)',\s*name:/g)].map((m) => m[1]));
    const mine = new Set(Object.values(TEMPLATES).flat());
    const strangers = [...mine].filter((id) => !inSource.has(id));
    assert.deepEqual(strangers, [], `this file names categories templates.ts does not: ${strangers.join(', ')}`);
  });

  test('and the count of templates has not changed underneath it', () => {
    const text = read('constants/templates.ts');
    const lists = [...text.matchAll(/_CATEGORIES: CategoryConfig\[\] = \[/g)].length;
    assert.equal(lists, Object.keys(TEMPLATES).length, 'a template was added or removed');
  });
});
