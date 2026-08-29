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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

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
