// A category that the event does not have.
//
// One illness, three routes. A screen holds a category id that was typed into
// the code once, the event it is looking at has no such category, and the value
// is written anyway. The item is then in a category the event does not have, and
// the event page, which groups by the event's own categories and has no "other"
// bucket to catch a stray, simply stops showing it.
//
// Campaign 20 closed two of those routes. This file guards the third:
//   DOCS/PLANING/78-bulk-category-change-writes-a-category-the-event-does-not-have.md
//
// What can and cannot be proved here, said plainly. Nothing in this file runs
// React, so nothing here can prove that a dropdown displays the value it is
// holding. That is proved by running the product. What is proved here is the
// decision underneath: which category an event hands out when nobody chose one,
// and that no screen starts a picker from a category typed into the code.
//
// The second of those is a source scan rather than a call, because the code it
// guards lives inside a .tsx that node cannot import. That technique is already
// in this project and already trusted: test/rules/limits.test.mjs uses it to
// keep the ceilings on the screens equal to the ceilings in the rules.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getFallbackCategoryId, getStartingCategoryId } from '../../src/utils/eventUtils.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

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

const shortName = (file) => file.split(/[\\/]/).pop();

/**
 * The categories of the seven templates, as src/constants/templates.ts holds
 * them. They are copied rather than imported because that file reaches an enum
 * and node's type stripping refuses one. Copied ids drift, so the last test in
 * this file reads the real file and checks that these are still its categories.
 */
const TEMPLATES = {
  'ארוחת שישי': ['starter', 'main', 'dessert', 'drink', 'equipment', 'other'],
  'על האש': ['meat', 'salads', 'pitas', 'equipment', 'drinks', 'general'],
  'פיקניק': ['finger_food', 'equipment', 'drinks', 'general'],
  'מסיבת כיתה': ['food', 'healthy', 'drinks', 'equipment'],
  'מסיבה': ['alcohol', 'food', 'atmosphere'],
  'חלבי': ['dairy', 'salads', 'sweets'],
  'טיול': ['ride_offers', 'ride_requests', 'food', 'equipment'],
};

/** Every id any template uses, which is what a hardcoded one would look like. */
const EVERY_TEMPLATE_ID = new Set(Object.values(TEMPLATES).flat());

describe('the category an event hands out when nobody chose one', () => {
  // The rule ImportItemsModal has been using since campaign 17, in one place
  // now rather than copied: the event's own catch-all if it has one, otherwise
  // its first category. Never an id typed into the code, because "on the fire"
  // and "picnic" have no "other" at all.
  test('is always a category that template actually has', () => {
    for (const [template, ids] of Object.entries(TEMPLATES)) {
      const chosen = getFallbackCategoryId(ids);
      assert.ok(
        ids.includes(chosen),
        `${template} hands out "${chosen}", which is not one of its categories`,
      );
    }
  });

  test('is never "main" outside the friday dinner', () => {
    for (const [template, ids] of Object.entries(TEMPLATES)) {
      if (ids.includes('main')) continue;
      assert.notEqual(
        getFallbackCategoryId(ids),
        'main',
        `${template} hands out "main", and it has no such category`,
      );
    }
  });

  test('prefers the catch-all, whichever of the two names it goes by', () => {
    assert.equal(getFallbackCategoryId(TEMPLATES['ארוחת שישי']), 'other');
    assert.equal(getFallbackCategoryId(TEMPLATES['על האש']), 'general');
  });

  test('falls back to the first category when the template has no catch-all', () => {
    // "מסיבה" is the one with nowhere to put a stray, which is why record 78
    // asks for it by name.
    assert.equal(getFallbackCategoryId(TEMPLATES['מסיבה']), 'alcohol');
  });

  test('says nothing rather than guessing when there are no categories at all', () => {
    assert.equal(getFallbackCategoryId([]), '');
  });
});

describe('the category an item form opens on', () => {
  // The rule the participant item form now uses. What the screen asked for when
  // the event has it, otherwise the event's own catch-all, and never an id
  // typed into the code.
  // See DOCS/PLANING/82-participant-item-form-starts-from-a-hardcoded-category.md.

  test('is a category that template has, in every template, when nobody asked', () => {
    for (const [template, ids] of Object.entries(TEMPLATES)) {
      const chosen = getStartingCategoryId(undefined, ids);
      assert.ok(
        ids.includes(chosen),
        `${template} opens on "${chosen}", which is not one of its categories`,
      );
    }
  });

  test('is never "main" in an event that has no such category', () => {
    for (const [template, ids] of Object.entries(TEMPLATES)) {
      if (ids.includes('main')) continue;
      assert.notEqual(
        getStartingCategoryId(undefined, ids),
        'main',
        `${template} opens on "main", and it has no such category`,
      );
    }
    // The literal the form used to hold, and the event the record was opened
    // for. This is the assertion that fails on the source as it was.
    assert.equal(getStartingCategoryId(undefined, TEMPLATES['על האש']), 'general');
  });

  test('is the category the screen asked for, when the event has it', () => {
    assert.equal(getStartingCategoryId('salads', TEMPLATES['על האש']), 'salads');
    assert.equal(getStartingCategoryId('dessert', TEMPLATES['ארוחת שישי']), 'dessert');
  });

  test('and is the event catch-all when the screen asks for something the event does not have', () => {
    // Standing in the "assigned" or "unassigned" filter on the event page and
    // pressing add handed the form the name of the filter as if it were a
    // category. The item was saved in a category called 'assigned', and the
    // organiser's own event grew one by that name.
    assert.equal(getStartingCategoryId('assigned', TEMPLATES['על האש']), 'general');
    assert.equal(getStartingCategoryId('unassigned', TEMPLATES['על האש']), 'general');
    assert.equal(getStartingCategoryId('main', TEMPLATES['על האש']), 'general');
    assert.equal(getStartingCategoryId('custom-1756900000000', TEMPLATES['מסיבה']), 'alcohol');
  });

  test('honours a ride the screen asked for, including the names never added to an event', () => {
    // The ride categories are only added to an event's list while the ride
    // switches are on, and 'trempim' and 'rides' are never added at all. Asking
    // whether the event has one would send an offered lift to the catch-all.
    assert.equal(getStartingCategoryId('ride_offers', TEMPLATES['על האש']), 'ride_offers');
    assert.equal(getStartingCategoryId('ride_requests', TEMPLATES['על האש']), 'ride_requests');
    assert.equal(getStartingCategoryId('trempim', TEMPLATES['על האש']), 'trempim');
    assert.equal(getStartingCategoryId('rides', TEMPLATES['מסיבה']), 'rides');
  });

  test('but never opens an ordinary item on a ride', () => {
    // "Trip" has no catch-all and names ride offers first, so the fallback over
    // its whole list is a lift. Bread and charcoal would land where people look
    // for a driver, and be counted against the ride quota.
    // See DOCS/PLANING/83-the-trip-template-hands-out-a-ride-category.md.
    assert.equal(getStartingCategoryId(undefined, TEMPLATES['טיול']), 'food');
    assert.equal(getStartingCategoryId('assigned', TEMPLATES['טיול']), 'food');
    for (const [template, ids] of Object.entries(TEMPLATES)) {
      const chosen = getStartingCategoryId(undefined, ids);
      assert.ok(
        !['ride_offers', 'ride_requests', 'trempim', 'rides'].includes(chosen),
        `${template} opens an ordinary item on "${chosen}", which is a ride`,
      );
    }
  });

  test('says nothing rather than guessing when the event has nothing to offer', () => {
    // An event whose only categories are rides. Nothing is marked in the grid,
    // and the form refuses to save rather than inventing an answer.
    assert.equal(getStartingCategoryId(undefined, []), '');
    assert.equal(getStartingCategoryId(undefined, ['ride_offers', 'ride_requests']), '');
    assert.equal(getStartingCategoryId('assigned', ['ride_offers']), '');
  });
});

describe('the participant item form', () => {
  // What no test of a pure function can see: the rule can be right and the
  // screen can still hold its own literal. These read the source.
  const screen = () => readFileSync(`${SRC}/components/Events/UserMenuItemForm.tsx`, 'utf8');

  test('opens on the category the rule returns', () => {
    const text = screen();
    assert.match(text, /getStartingCategoryId\(initialCategory,/, 'the form does not use the rule');
    assert.doesNotMatch(text, /initialCategory \|\| 'main'/, "the form still opens on the literal 'main'");
  });

  test('and pins the grid shut only for a category the rule accepted', () => {
    // Otherwise the name of a filter, handed over as though it were a category,
    // hides the grid and is saved as the item's category.
    const text = screen();
    assert.match(text, /const isLocked = defaultCat === initialCategory/, 'the grid is pinned by any request at all');
  });

  test('and refuses to save while no button in the grid is marked', () => {
    const text = screen();
    assert.match(
      text,
      /categoryOptions\.some\(option => option\.value === formData\.category\)/,
      'nothing checks that a category was chosen',
    );
    assert.match(text, /userItemForm\.errors\.categoryRequired/, 'nothing says why the save stopped');
  });

  test('and does not carry a row type onto an ordinary item', () => {
    // The add button on the event page's category screen asks for "offers" and
    // names no category. An ordinary item carrying that row type is read as a
    // lift, and only the old literal 'main' hid it, being one of the six names
    // the reader treats as food.
    const text = screen();
    assert.match(text, /rowType: isRideCategory\(defaultCat\)/, 'the row type still comes from the screen');
    assert.doesNotMatch(
      text,
      /rowType: initialRowType \|\|/,
      'the row type still overrides the category',
    );
  });
});

describe('no screen starts a category picker from a category typed into the code', () => {
  // The four shapes the defect takes. A picker seeded with a literal id shows
  // the first option of a list that does not contain it, and writes the literal.
  const SEEDS = [
    /useState<MenuCategory>\(\s*'([^']*)'/g,
    /const \[\w*[Cc]ategory\w*, set\w+\]\s*=\s*useState<[^>]*>\(\s*'([^']*)'\s*\)/g,
    /category:\s*'([^']*)'\s+as\s+MenuCategory/g,
    /initialCategory\s*\|\|\s*'([^']*)'/g,
  ];

  // The screens that still do it, each named, so that "what is still open" is
  // something this suite answers rather than something a report claims. Remove
  // a line here when its record is closed, and the scan starts guarding it.
  //
  // It is empty. The last two were the participant item form, which opened on
  // the literal 'main' whenever the screen that called it named no category,
  // and a piece of state on the event page seeded with the same literal that
  // was written once and never read. Both closed with record 82, and the scan
  // now guards every screen rather than all but two.
  // See DOCS/PLANING/82-participant-item-form-starts-from-a-hardcoded-category.md.
  const STILL_OPEN = new Set([]);

  test('and the ones that still do are the ones with a record open', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const seed of SEEDS) {
        for (const match of text.matchAll(seed)) {
          const id = match[1];
          // "all" and "" are the sentinels a filter starts from, not categories.
          if (!EVERY_TEMPLATE_ID.has(id)) continue;
          const offender = `${shortName(file)}: ${id}`;
          if (STILL_OPEN.has(offender)) continue;
          offenders.push(offender);
        }
      }
    }
    assert.deepEqual(offenders, [], 'these screens start from a category typed into the code');
  });
});

describe('the copied template categories in this file', () => {
  // Copied ids drift. This is the test that notices.
  test('are still the categories templates.ts holds', () => {
    const text = readFileSync(`${SRC}/constants/templates.ts`, 'utf8');
    const inSource = new Set([...text.matchAll(/\{\s*id:\s*'([^']+)',\s*name:/g)].map((m) => m[1]));
    // The trip template names its two ride categories by spreading a constant
    // rather than writing an id, so those two are read from their own lines.
    inSource.add('ride_offers');
    inSource.add('ride_requests');
    const strangers = [...EVERY_TEMPLATE_ID].filter((id) => !inSource.has(id));
    assert.deepEqual(strangers, [], `this file names categories templates.ts does not: ${strangers.join(', ')}`);
  });
});
