// One clock: the dashboard badge and the event page gate have to say the same
// thing about the same event.
//
// The organiser opened the dashboard on the morning of the event and read
// "הסתיים" on a card for a meal nine hours away. The badge was reading the
// event's date string on its own, and a date string with no hour is read as
// midnight UTC, which is 02:00 in Israel on winter clock and 03:00 on summer
// clock. So the badge flipped in the small hours of the event's own day, while
// the event page kept the event open, because that screen asks a different
// question: `isEventFinished`, which reads the date and the hour together.
//
// The claim these tests make is not that `isEventFinished` works. It worked
// before too. The claim is that both screens now ask it, with the same two
// fields, so there is one calculation and not two.
//
// Two things are pinned, or the result would depend on the machine and on the
// hour the suite happens to run: the zone, to Asia/Jerusalem, and the instant,
// with the test runner's own clock mock.
//
// Node cannot import `src/utils/dateUtils.ts` the way Vite does: the file
// reaches `../constants/limits` with no extension, and that file imports JSON
// with no type attribute. Both are the bundler's job. The resolve hook below
// does those two things and nothing else, so the function under test is the
// shipped one and not a copy.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs
//
// See DOCS/PLANING/114-dashboard-badge-says-ended-from-three-in-the-morning.md
// and DOCS/PLANING/122-the-clock-change-and-what-the-product-does-with-it.md.

process.env.TZ = 'Asia/Jerusalem';

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.json')) {
      return { ...nextResolve(specifier, context), importAttributes: { type: 'json' } };
    }
    if (specifier.startsWith('.') && !/\.(m?[jt]s|json)$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (relative) => readFileSync(`${SRC}/${relative}`, 'utf8');

const { isEventFinished } = await import(new URL('../../src/utils/dateUtils.ts', import.meta.url));

// What the badge used to do: read the date string alone, against the present
// moment. Kept here because the disagreement is the finding, and a test that
// does not run the broken reading cannot show it.
const dateStringAlone = (dateStr) => new Date(dateStr) < new Date();

// The event page's question, as the dashboard now asks it too.
const bothScreens = (dateStr, timeStr) => isEventFinished(dateStr, timeStr);

const at = (localTime, body) => {
  mock.timers.enable({ apis: ['Date'], now: new Date(localTime).getTime() });
  try {
    body();
  } finally {
    mock.timers.reset();
  }
};

// The call each screen makes, reduced to the function and the two fields, so
// `event.details.date` and `currentEvent.details.date` compare equal.
const clockCallIn = (relative) => {
  const match = read(relative).match(/isEventFinished\(([^)]*)\)/);
  assert.ok(match, `${relative} asks no event clock question at all`);
  return `isEventFinished(${match[1].replace(/[A-Za-z]+\.details\./g, 'details.')})`;
};

describe('the badge and the gate ask one question', () => {
  test('and it is the same question, on the same two fields', () => {
    assert.equal(
      clockCallIn('pages/DashboardPage.tsx'),
      clockCallIn('pages/EventPage.tsx'),
      'the dashboard card and the event page have to close an event on the same calculation',
    );
  });

  // Asserted with `ok` and not with `match`: a failing `match` prints the whole
  // file, and the file is eight hundred lines long.
  test('the dashboard imports it instead of carrying its own version', () => {
    const dashboard = read('pages/DashboardPage.tsx');
    assert.ok(
      /import \{[^}]*isEventFinished[^}]*\} from '\.\.\/utils\/dateUtils'/.test(dashboard),
      'DashboardPage.tsx does not import isEventFinished from ../utils/dateUtils',
    );
    assert.ok(
      !/new Date\(event\.details\.date\) < new Date\(\)/.test(dashboard),
      'the badge is back to reading the date string on its own',
    );
  });
});

describe('an event on the day it is held', () => {
  // Winter clock. The hour the organiser opened the dashboard.
  test('is not finished at eight in the morning', () => {
    at('2026-11-20T08:00', () => {
      assert.equal(dateStringAlone('2026-11-20'), true, 'the date string alone calls it finished');
      assert.equal(bothScreens('2026-11-20', '19:00'), false, 'and both screens now say it is not');
    });
  });

  test('is not finished an hour before it starts', () => {
    at('2026-11-20T18:00', () => {
      assert.equal(bothScreens('2026-11-20', '19:00'), false);
    });
  });

  test('is finished six hours after it starts, and not before', () => {
    at('2026-11-21T00:30', () => assert.equal(bothScreens('2026-11-20', '19:00'), false));
    at('2026-11-21T01:30', () => assert.equal(bothScreens('2026-11-20', '19:00'), true));
  });
});

describe('yesterday and tomorrow, where the two readings never disagreed', () => {
  test('yesterday evening is finished', () => {
    at('2026-11-20T08:00', () => {
      assert.equal(dateStringAlone('2026-11-19'), true);
      assert.equal(bothScreens('2026-11-19', '19:00'), true);
    });
  });

  test('tomorrow evening is not', () => {
    at('2026-11-20T08:00', () => {
      assert.equal(dateStringAlone('2026-11-21'), false);
      assert.equal(bothScreens('2026-11-21', '19:00'), false);
    });
  });
});

describe('the hour the old badge flipped, which is why the record was renamed', () => {
  test('winter clock, two in the morning', () => {
    at('2026-11-20T01:30', () => assert.equal(dateStringAlone('2026-11-20'), false));
    at('2026-11-20T02:30', () => assert.equal(dateStringAlone('2026-11-20'), true));
  });

  test('summer clock, three in the morning', () => {
    at('2026-07-15T02:30', () => assert.equal(dateStringAlone('2026-07-15'), false));
    at('2026-07-15T03:30', () => assert.equal(dateStringAlone('2026-07-15'), true));
  });

  test('and the one calculation holds through both of those hours', () => {
    at('2026-11-20T02:30', () => assert.equal(bothScreens('2026-11-20', '19:00'), false));
    at('2026-07-15T03:30', () => assert.equal(bothScreens('2026-07-15', '19:00'), false));
  });
});
