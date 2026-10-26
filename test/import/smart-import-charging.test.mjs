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
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ImportRefusal, runImport } = require('../../functions/smartImportPolicy.js');

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
