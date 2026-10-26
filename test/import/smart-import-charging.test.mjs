// What the smart import counts, and when.
//
// One sentence, in two halves that pull against each other. An organiser does
// not lose one of their five calls an hour for a typing mistake, and does lose
// one for every call that reached the model, answer or no answer.
//
// The second half is the one somebody will "fix" in good faith one day, on the
// reasonable-sounding grounds that a failure should not cost the caller
// anything. It would reopen the hole the ceiling exists to close: a caller who
// can make the model fail could then call without limit. That is why it is a
// test here and not a sentence in a comment.
//
// These run the decisions rather than read them. functions/smartImport.js
// cannot be loaded outside a deployed function, since its first line reaches
// for firebase-functions and functions/node_modules is not installed in this
// repository, so the decisions live in functions/smartImportPolicy.js, which
// requires nothing at all. The counter and the model are handed in, which is
// the whole reason the order they are used in can be watched from here.
//
// See DOCS/PLANING/125-you-cannot-tell-who-spent-the-credit.md, part B.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ImportRefusal, classifyModelError, runImport } = require('../../functions/smartImportPolicy.js');

// Stands in for chargeOneCall and for the paid call, and counts how many times
// each was reached. The question every test below asks is the same one the
// organiser would ask: did my allowance move.
function spend({ modelFails = false } = {}) {
  const counted = { charged: 0, model: 0 };
  return {
    counted,
    charge: async () => {
      counted.charged += 1;
    },
    callModel: async () => {
      counted.model += 1;
      if (modelFails) throw new Error('503 the model fell over');
      return { items: [{ name: 'חלה', quantity: 1 }] };
    },
  };
}

// runImport logs the raw provider error when the model fails, which is right in
// production and noise here. Swapped out for the one test that reaches it, so
// that a failing run of this suite is readable.
async function withoutErrorLog(body) {
  const real = console.error;
  console.error = () => {};
  try {
    return await body();
  } finally {
    console.error = real;
  }
}

const refusalFrom = async (data) => {
  const { counted, charge, callModel } = spend();
  const error = await runImport({ data, charge, callModel }).then(
    () => null,
    (thrown) => thrown,
  );
  return { counted, error };
};

describe('an organiser does not pay quota for a typing mistake', () => {
  // The three ways the function refuses a request, and the three ways an
  // organiser walks into them: pressing the button with an empty box, pasting
  // more than the ceiling, and photographing a list with a modern phone.
  test('a request with neither text nor an image does not move the counter', async () => {
    const { counted, error } = await refusalFrom({});

    assert.ok(error instanceof ImportRefusal, 'an empty request was not refused');
    assert.equal(error.code, 'invalid-argument');
    assert.equal(counted.charged, 0, 'an empty request cost the organiser one of their calls');
    assert.equal(counted.model, 0, 'an empty request reached the model');
  });

  test('text past the ceiling does not move the counter', async () => {
    const { counted, error } = await refusalFrom({ text: 'א'.repeat(2001) });

    assert.ok(error instanceof ImportRefusal, 'an over long list was not refused');
    assert.equal(error.details?.originalError, 'TEXT_TOO_LONG');
    assert.equal(counted.charged, 0, 'an over long list cost the organiser one of their calls');
    assert.equal(counted.model, 0, 'an over long list reached the model');
  });

  test('an image past the ceiling does not move the counter', async () => {
    const { counted, error } = await refusalFrom({ image: 'a'.repeat(7000001) });

    assert.ok(error instanceof ImportRefusal, 'an over large image was not refused');
    assert.equal(error.code, 'invalid-argument');
    assert.equal(counted.charged, 0, 'an over large image cost the organiser one of their calls');
    assert.equal(counted.model, 0, 'an over large image reached the model');
  });

  // Whitespace only, because an organiser who selects a blank line and pastes
  // it has sent a string that is not empty and means nothing.
  test('a box holding only spaces does not move the counter', async () => {
    const { counted, error } = await refusalFrom({ text: '   \n  ' });

    assert.ok(error instanceof ImportRefusal, 'a blank list was not refused');
    assert.equal(counted.charged, 0, 'a blank list cost the organiser one of their calls');
  });
});

describe('and pays for everything that reached the model', () => {
  test('a list worth sending is counted once, before the model is called', async () => {
    const { counted, charge, callModel } = spend();

    const answer = await runImport({ data: { text: 'חלה, יין, נרות' }, charge, callModel });

    assert.deepEqual(answer.items, [{ name: 'חלה', quantity: 1 }]);
    assert.equal(counted.charged, 1, 'a real call was not counted');
    assert.equal(counted.model, 1, 'the model was not reached');
  });

  // ⚠️ The half that must not be "fixed". A refund on failure is its own way
  // through the ceiling.
  test('a call the model failed is still counted', async () => {
    const { counted, charge, callModel } = spend({ modelFails: true });

    const error = await withoutErrorLog(() =>
      runImport({ data: { text: 'חלה, יין, נרות' }, charge, callModel }).then(
        () => null,
        (thrown) => thrown,
      ),
    );

    assert.ok(error instanceof ImportRefusal, 'a model failure did not become a refusal');
    assert.equal(counted.model, 1, 'the model was not reached');
    assert.equal(
      counted.charged,
      1,
      'a failed call was refunded, which lets a caller who can break the model call without limit',
    );
  });
});

// And the other half of the organiser's bad afternoon: being told the wrong
// thing about why it failed.
//
// Credit that has run out and a quota that has run out look alike in a log and
// are opposites in what an organiser should do. A quota comes back within the
// hour, so trying again is right. Credit does not come back until somebody
// pays, so trying again is advice that cannot work, and the screen used to give
// exactly that advice: it fell through to the general branch and said "שגיאה
// פנימית בשרת. נסה שוב מאוחר יותר".
//
// See DOCS/PLANING/121-the-smart-import-is-down-the-credits-ran-out.md.
describe('credit that has run out is not a quota that has run out', () => {
  // The error as it was measured in the production log on 25/10/2026.
  const depleted = () => {
    const error = new Error('[402 Payment Required] Your prepayment credits are depleted.');
    error.status = 402;
    return error;
  };

  // The two wrong answers, both of which end in advice to try again. The
  // general branch is where this used to land, and it is the one that produced
  // "שגיאה פנימית בשרת. נסה שוב מאוחר יותר".
  test('the measured 402 is neither the quota refusal nor the general one', () => {
    const refusal = classifyModelError(depleted(), 'gemini-3.6-flash');

    assert.notEqual(
      refusal.code,
      'resource-exhausted',
      'credit that ran out was reported as a quota, which tells the organiser to wait an hour for nothing',
    );
    assert.notEqual(
      refusal.details?.originalError,
      'INTERNAL_ERROR',
      'credit that ran out fell through to the general branch, which is the bug this closes',
    );
  });

  test('it is the code the screens answer with "not available, add by hand"', () => {
    const refusal = classifyModelError(depleted(), 'gemini-3.6-flash');

    assert.ok(refusal instanceof ImportRefusal);
    assert.equal(refusal.code, 'unavailable');
    assert.equal(refusal.details?.originalError, 'CREDIT_DEPLETED');
  });

  // Either signal alone is enough, since a provider that changes its wording
  // still answers 402, and one that answers through a wrapper still says
  // depleted.
  test('a 402 with no message, and a depleted message with no status, both land there', () => {
    const statusOnly = Object.assign(new Error(''), { status: 402 });
    const wordOnly = new Error('prepayment credits are depleted');

    for (const error of [statusOnly, wordOnly]) {
      const refusal = classifyModelError(error, 'gemini-3.6-flash');
      assert.equal(refusal.details?.originalError, 'CREDIT_DEPLETED', error.message || '(no message)');
    }
  });

  // The branch it has to stay out of the way of. If the two were ever swapped
  // this is the test that would say so.
  test('a real quota is still the quota refusal', () => {
    const refusal = classifyModelError(new Error('429 Too Many Requests: quota exceeded'), 'x');

    assert.equal(refusal.code, 'resource-exhausted');
    assert.equal(refusal.details?.originalError, 'QUOTA_EXCEEDED');
  });

  // And the rule the whole thing is held to: the organiser is not told why our
  // account is empty. The message above is written for the log, and the screen
  // reaches a sentence of its own from the code. Read as text, because
  // importing that file starts i18n, which this suite has no use for.
  test('no screen is handed the server message, or the word credit', () => {
    const client = readFileSync(
      new URL('../../src/utils/smartImportErrors.ts', import.meta.url),
      'utf8',
    );

    assert.ok(
      /case 'functions\/unavailable':/.test(client),
      'the client no longer answers functions/unavailable, which is where CREDIT_DEPLETED arrives',
    );
    assert.ok(
      !/return[^;]*error\??\.message/.test(client),
      'the client hands a server message to the screen, which the rule at the head of that file forbids',
    );

    const strings = JSON.parse(
      readFileSync(new URL('../../src/locales/he.json', import.meta.url), 'utf8'),
    ).translation.importModal.smart.errors;

    for (const [key, sentence] of Object.entries(strings)) {
      assert.ok(
        !/קרדיט|חיוב|Gemini|402/i.test(sentence),
        `importModal.smart.errors.${key} tells the organiser an operational detail`,
      );
    }
  });
});
