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
import { getFallbackCategoryId } from '../../src/utils/eventUtils.ts';

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
  // See DOCS/PLANING/82-participant-item-form-starts-from-a-hardcoded-category.md.
  const STILL_OPEN = new Set([
    'UserMenuItemForm.tsx: main',
    'EventPage.tsx: main',
  ]);

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
