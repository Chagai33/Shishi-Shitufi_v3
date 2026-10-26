// Which sentence the organiser reads for each way the smart import can fail.
//
// Its own file, and not part of smart-import-charging.test.mjs, because that
// one is about the counter and this one is about the message. They failed for
// different reasons and they would be fixed by different people.
//
// Why it exists at all: the round before this wrote three new sentences and not
// one test, and an independent audit then found that one of the three never
// reached a screen, one blamed the product for the organiser's own connection,
// and one named a list that had never been sent. See
// DOCS/PLANING/127-the-message-half-did-not-land-and-a-new-bug-came-with-it.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyModelError } = require('../../functions/smartImportPolicy.js');

const MODEL = 'gemini-3.6-flash';

// src/utils/smartImportErrors.ts is read as text rather than run, and so are
// the two string files. Running it means importing src/i18n.ts, which reaches
// for i18next, and functions aside this suite is deliberately runnable with
// nothing installed. Product owner's decision, 26/10/2026: a test that proves
// the branch exists and that the sentence it reaches exists in both languages,
// against one manual press after the deploy, since the counter counts presses.
//
// Newlines are normalised because the working copy is checked out with CRLF.
const client = () =>
  readFileSync(new URL('../../src/utils/smartImportErrors.ts', import.meta.url), 'utf8').replace(
    /\r\n/g,
    '\n',
  );

const sentences = (language) =>
  JSON.parse(
    readFileSync(new URL(`../../src/locales/${language}.json`, import.meta.url), 'utf8'),
  ).translation.importModal.smart.errors;

// An answer that stopped in the middle, said the way the runtime says it. The
// number is a character count and nothing else.
const truncated = (position) =>
  new Error(`Unexpected end of JSON input at position ${position}`);

// The number of places an answer can stop at. It is the ceiling the function
// accepts for a reply, and it is written out here so that the count in the
// comments of functions/smartImportPolicy.js can be checked against something.
const TRUNCATION_POINTS = 20772;

describe('an answer that stopped in the middle is not a bill', () => {
  // The claim the whole round turns on, and the one a test that only proves a
  // real 402 is handled would walk straight past.
  test('a truncated answer whose character count holds 402 is a parse failure', () => {
    const refusal = classifyModelError(truncated(1402), MODEL);

    assert.equal(
      refusal.code,
      'data-loss',
      'a truncated answer was read as the account being out of credit, which tells the organiser the service is switched off',
    );
    assert.equal(refusal.details?.originalError, 'JSON_PARSE_ERROR');
  });

  // The same defect one branch further down, which the audit did not reach and
  // which is exactly the same size. Product owner approved closing both,
  // 26/10/2026.
  test('and one whose character count holds 429 is not a quota that ran out', () => {
    const refusal = classifyModelError(truncated(1429), MODEL);

    assert.equal(
      refusal.code,
      'data-loss',
      'a truncated answer was read as a rate limit, which tells the organiser to wait an hour for nothing',
    );
    assert.equal(refusal.details?.originalError, 'JSON_PARSE_ERROR');
  });

  // Exhaustive on purpose rather than a handful of examples, because the two
  // cases above were found by counting and not by thinking of them. 82 of these
  // were classified as money before this commit.
  test('and no place an answer can stop at is read as a code', () => {
    const wrong = [];

    for (let position = 0; position < TRUNCATION_POINTS; position += 1) {
      const refusal = classifyModelError(truncated(position), MODEL);
      if (refusal.details?.originalError !== 'JSON_PARSE_ERROR') {
        wrong.push(`${position} read as ${refusal.details?.originalError}`);
      }
    }

    assert.deepEqual(
      wrong,
      [],
      `truncation points read as something other than an unreadable answer: ${wrong.slice(0, 6).join(', ')}`,
    );
  });

  // And the sentence that reaches the screen for all of them, which is the
  // point of the three tests above. data-loss is the one branch in
  // src/utils/smartImportErrors.ts that says the answer could not be read and
  // suggests wording the list more clearly. Read as text, because importing
  // that file starts i18n.
  test('and data-loss is the branch that says the answer could not be read', () => {
    assert.match(
      client(),
      /case 'functions\/data-loss':\s*\n\s*return i18n\.t\('importModal\.smart\.errors\.parse'\)/,
      'data-loss no longer reaches importModal.smart.errors.parse',
    );
  });
});

describe('and a bill is still a bill', () => {
  // The branch the three tests above must not have broken. The error as it was
  // measured in the production log on 25/10/2026.
  test('the measured credit failure is still credit', () => {
    const error = new Error('[402 Payment Required] Your prepayment credits are depleted.');
    error.status = 402;

    const refusal = classifyModelError(error, MODEL);

    assert.equal(refusal.code, 'unavailable');
    assert.equal(refusal.details?.originalError, 'CREDIT_DEPLETED');
  });

  // Either signal alone, since a wrapper may pass the sentence on and drop the
  // status.
  test('the status alone and the sentence alone both still reach it', () => {
    const statusOnly = Object.assign(new Error('something went wrong upstream'), { status: 402 });
    const sentenceOnly = new Error('Your prepayment credits are depleted.');

    for (const error of [statusOnly, sentenceOnly]) {
      assert.equal(
        classifyModelError(error, MODEL).details?.originalError,
        'CREDIT_DEPLETED',
        error.message,
      );
    }
  });

  test('a real rate limit is still a rate limit, by status and by reason phrase', () => {
    const byStatus = Object.assign(new Error('rate limited upstream'), { status: 429 });
    const byPhrase = new Error('429 Too Many Requests');
    const byWord = new Error('Resource has been exhausted (e.g. check quota).');

    for (const error of [byStatus, byPhrase, byWord]) {
      assert.equal(
        classifyModelError(error, MODEL).details?.originalError,
        'QUOTA_EXCEEDED',
        error.message,
      );
    }
  });

  // The log line the audit caught saying the opposite of what happened. The
  // request reached the provider, and charge() had already run.
  test('and the log no longer says a counted request was never sent', () => {
    const error = Object.assign(new Error(''), { status: 402 });
    const refusal = classifyModelError(error, MODEL);

    assert.doesNotMatch(
      refusal.message,
      /not sent/i,
      'the log says the request was not sent, and it was sent, counted and charged',
    );
    assert.match(refusal.message, /sent and counted/i);
  });
});

// The organiser with no reception, who was being told the product had fallen
// over. The sentence for it was written and then never reached a screen once.
describe('the organiser is told when it is their own connection', () => {
  test('the connection sentence is not reached by a word in a server message', () => {
    assert.doesNotMatch(
      client(),
      /error\??\.message[\s\S]{0,60}'network'/,
      'the dead branch is back: no message the function writes contains the word network, so this never shows',
    );
  });

  test('it is reached from what the browser reports, under functions/internal', () => {
    assert.match(
      client(),
      /case 'functions\/internal':\s*\n\s*return browserSaysOffline\(\)\s*\n\s*\? i18n\.t\('importModal\.smart\.errors\.network'\)\s*\n\s*: i18n\.t\('importModal\.smart\.errors\.internal'\)/,
      'importModal.smart.errors.network is dead code again, or functions/internal lost its default',
    );
  });

  // The constraint the branch is designed around: a browser reporting no
  // connection is right, and a browser reporting one proves nothing, so the
  // check may only ever be read in the negative.
  test('and only in the direction the browser can be trusted', () => {
    assert.match(client(), /navigator\.onLine === false/);
    assert.doesNotMatch(
      client(),
      /navigator\.onLine === true|if \(navigator\.onLine\)|navigator\.onLine \?/,
      'the browser reporting a connection is being treated as proof that the request arrived',
    );
  });

  test('and the sentence it reaches exists in both languages', () => {
    for (const language of ['he', 'en']) {
      assert.ok(
        sentences(language).network,
        `importModal.smart.errors.network is missing from ${language}.json`,
      );
    }
  });
});
