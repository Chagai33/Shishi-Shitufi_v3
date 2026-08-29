// The numbers in src/constants/limits.json and the numbers in
// database.rules.json have to be the same numbers.
//
// They cannot be the same file: a rules file cannot import anything, so every
// ceiling is written out by hand there and read from the JSON on the screens.
// The day the two drift is the day somebody types something the screen accepts
// and the server refuses, with nothing useful said on either side. That is the
// failure this project has spent whole campaigns on, so it gets a test.
//
// It needs no emulator. It runs in the same suite because that is where the
// runner already looks.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

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

const limits = JSON.parse(read('../../src/constants/limits.json'));
const rulesText = read('../../database.rules.json');

describe('the ceilings on the screens and the ceilings in the rules', () => {
  test('an event holds the same number of items in both', () => {
    assert.match(
      rulesText,
      new RegExp(`newData\\.val\\(\\) <= ${limits.itemsPerEvent}"`),
      `database.rules.json does not cap itemCount at ${limits.itemsPerEvent}`,
    );
  });

  test('an organizer has the same number of events in both', () => {
    assert.match(
      rulesText,
      new RegExp(`newData\\.val\\(\\) <= ${limits.eventsPerOrganizer} &&`),
      `database.rules.json does not cap eventCount at ${limits.eventsPerOrganizer}`,
    );
  });

  test('a person has the same number of rides in both', () => {
    const occurrences = rulesText.split(
      `newData.parent().parent().child('rideOfferCounts').child(auth.uid).val() <= ${limits.ridesPerPerson}`,
    ).length - 1;
    assert.equal(occurrences, 1, 'the ride offer ceiling in the rules is not ridesPerPerson');

    const requests = rulesText.split(
      `newData.parent().parent().child('rideRequestCounts').child(auth.uid).val() <= ${limits.ridesPerPerson}`,
    ).length - 1;
    assert.equal(requests, 1, 'the ride request ceiling in the rules is not ridesPerPerson');
  });

  // Every text ceiling, by the shape the rules write it in. A number that
  // appears in limits.json and in no rule is a ceiling the server does not hold,
  // and a rule holding a number that is in no limits.json is one the screens do
  // not know about. Either way somebody types something that is refused with
  // nothing useful said.
  const textFields = [
    'eventTitle', 'eventLocation', 'eventDescription', 'categoryName',
    'itemName', 'itemNote', 'personName', 'phoneNumber', 'pickupLocation',
  ];

  for (const field of textFields) {
    test(`${field} is the same length in both`, () => {
      assert.ok(
        rulesText.includes(`newData.isString() && newData.val().length <= ${limits[field]}"`),
        `no rule in database.rules.json caps a string at ${limits[field]}, which is ${field}`,
      );
    });
  }

  // And no rule caps a string at a number that limits.json has never heard of.
  test('no rule holds a text ceiling the screens do not know about', () => {
    const known = new Set(textFields.map((f) => limits[f]));
    const inRules = [...rulesText.matchAll(/newData\.isString\(\) && newData\.val\(\)\.length <= (\d+)/g)]
      .map((m) => Number(m[1]));
    const strangers = [...new Set(inRules)].filter((n) => !known.has(n));
    assert.deepEqual(strangers, [], `these ceilings are in the rules only: ${strangers.join(', ')}`);
  });

  // And the third place the numbers could split: the input fields. Every
  // maxLength on a screen has to come from the limits module, because a number
  // typed straight into a form is a number nobody will remember to change.
  test('no screen carries a ceiling of its own', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/maxLength=\{([^}]+)\}/g)) {
        const expression = match[1].trim();
        if (/^\d+$/.test(expression)) {
          offenders.push(`${file.split(/[\\/]/).pop()}: maxLength={${expression}}`);
        }
      }
    }
    assert.deepEqual(offenders, [], 'these fields carry a number instead of a limit');
  });

  // And the fourth place, which is not a rule at all. The text sent to the smart
  // import is refused by the cloud function and by nothing else, so the function
  // carries its own copy of the number: a deployed function can read only what
  // is inside functions/, and never src/constants/limits.json. The screens build
  // that text and hold the same number in order to say so before sending it.
  // Three copies of one ceiling is what this file exists to stop drifting.
  test('the smart import text ceiling is the same on the screens and in the function', () => {
    const functionSource = read('../../functions/smartImport.js');
    assert.ok(
      functionSource.includes(`text.length > ${limits.aiTextMax}`),
      `functions/smartImport.js does not refuse text past ${limits.aiTextMax}, which is aiTextMax`,
    );
  });

  // The date table is generated, so what is checked is that it says what it was
  // generated to say: the first month's ceiling is monthsAhead months after the
  // month the table starts in, and the table is still rolling today.
  test('the date table is the one that was generated, and has not run out', () => {
    const dates = [...rulesText.matchAll(/newData\.val\(\) <= '(\d{4}-\d{2}-\d{2})'/g)].map(
      (m) => m[1],
    );
    assert.ok(dates.length > 0, 'no date ceiling found in the rules at all');

    const first = new Date(`${dates[0]}T00:00:00Z`);
    const start = new Date(Date.UTC(2026, 7, 1)); // the table was generated in August 2026
    const monthsBetween =
      (first.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (first.getUTCMonth() - start.getUTCMonth());
    assert.equal(
      monthsBetween,
      limits.monthsAhead,
      `the first clause allows ${monthsBetween} months, not ${limits.monthsAhead}`,
    );

    const last = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    assert.ok(
      last.getTime() > Date.now(),
      'the date table has run out and needs regenerating; see the comment on details.date',
    );
  });
});
