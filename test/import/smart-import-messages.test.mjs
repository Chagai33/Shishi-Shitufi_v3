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

// An answer we cannot use is not a fault of ours. Record 128, found by the
// independent pass over the map this suite's first block was written from.
describe('an answer we could not use is not reported as our own fault', () => {
  // functions/smartImport.js cannot be loaded here: its first line reaches for
  // firebase-functions, and functions/node_modules is not installed in this
  // repository. So the marker is read as text at the throw site and run
  // through the branch that answers it. Both halves, because either one alone
  // would pass while the organiser still read the wrong sentence.
  const handler = () =>
    readFileSync(new URL('../../functions/smartImport.js', import.meta.url), 'utf8').replace(
      /\r\n/g,
      '\n',
    );

  test('the answer check marks what it throws, instead of describing it', () => {
    assert.match(
      handler(),
      /if \(!Array\.isArray\(items\)\) \{\s*\n\s*throw Object\.assign\([\s\S]{0,200}unreadableAnswer: true/,
      'the not-an-array throw is unmarked again, and an unmarked one reads as a fault of ours',
    );
  });

  // The claim itself. The message deliberately does not contain the word JSON,
  // which is what used to decide this.
  test('and a marked answer reaches the sentence for an answer we could not read', () => {
    const thrown = Object.assign(
      new Error('The model answered with valid JSON that is not an array of items.'),
      { unreadableAnswer: true },
    );

    const refusal = classifyModelError(thrown, MODEL);

    assert.equal(
      refusal.code,
      'data-loss',
      'an answer we could not use is reported as a fault of ours, which sends the organiser to press the same button again',
    );
    assert.equal(refusal.details?.originalError, 'JSON_PARSE_ERROR');
  });

  // The marker has to carry it on its own, because the wording is the thing
  // that failed last time.
  test('and the marker alone is enough, with no helpful word in the message', () => {
    const wordless = Object.assign(new Error('the answer was the wrong shape'), {
      unreadableAnswer: true,
    });

    assert.equal(classifyModelError(wordless, MODEL).details?.originalError, 'JSON_PARSE_ERROR');
  });

  // What JSON.parse actually throws, rather than a plain Error carrying its
  // wording. This is the truncated answer of record 127 as it arrives in
  // production.
  test('and what JSON.parse really throws lands there by what it is', () => {
    let real;
    try {
      JSON.parse('[{"name":"חלה","quan');
    } catch (error) {
      real = error;
    }

    assert.ok(real instanceof SyntaxError, 'JSON.parse no longer throws a SyntaxError');
    assert.equal(classifyModelError(real, MODEL).details?.originalError, 'JSON_PARSE_ERROR');
  });

  // The branch it must not have swallowed. An unknown failure is still ours.
  test('and a failure nobody recognises is still reported as ours', () => {
    const unknown = new Error('socket hang up');

    const refusal = classifyModelError(unknown, MODEL);

    assert.equal(refusal.code, 'internal');
    assert.equal(refusal.details?.originalError, 'INTERNAL_ERROR');
  });

  // And no operational detail on the way out, for the one sentence this
  // reaches. The rule at the head of src/utils/smartImportErrors.ts.
  test('and the organiser is told to reword the list, not what broke', () => {
    for (const language of ['he', 'en']) {
      assert.doesNotMatch(sentences(language).parse, /JSON|array|מערך|קוד/i);
    }
  });
});

// The organiser whose phone handed over a picture the browser could not open,
// and who was then told that reading his list had failed. No list had been
// sent.
describe('the organiser is told when the picture is the problem', () => {
  // ImportItemsModal.tsx is the live screen. SmartImportModal.tsx is a third
  // call point on the same function that nothing imports, measured on the whole
  // of src and recorded in 06-dead-code.md, so it is deliberately not here.
  const screen = () =>
    readFileSync(
      new URL('../../src/components/Admin/ImportItemsModal.tsx', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');

  test('preparing the picture is marked where it fails, before the call goes out', () => {
    assert.match(
      screen(),
      /try \{\s*\n\s*imageBase64 = await compressImage\(smartImage\);\s*\n\s*\} catch[\s\S]{0,200}code: IMAGE_PREP_FAILED/,
      'compressImage can fail unmarked again, and an unmarked failure reaches the sentence for an unreadable answer',
    );
  });

  // The two halves have to agree on the code, and a test is the only thing that
  // notices when one of them is renamed.
  test('and the code it is marked with is the one the sentences are chosen by', () => {
    assert.match(screen(), /IMAGE_PREP_FAILED/);
    assert.match(client(), /export const IMAGE_PREP_FAILED = 'smartImport\/image-prep-failed'/);
    assert.match(
      client(),
      /case IMAGE_PREP_FAILED:\s*\n\s*return i18n\.t\('importModal\.smart\.errors\.image'\)/,
      'the image failure no longer reaches a sentence of its own',
    );
  });

  test('and the sentence exists in both languages, and names the picture', () => {
    for (const [language, word] of [
      ['he', /תמונה/],
      ['en', /image|photo/i],
    ]) {
      const sentence = sentences(language).image;
      assert.ok(sentence, `importModal.smart.errors.image is missing from ${language}.json`);
      assert.match(sentence, word, `the sentence in ${language}.json does not name the picture`);
    }
  });

  // What it must not say, which is what it used to say.
  test('and does not blame the list, which was never sent', () => {
    assert.doesNotMatch(sentences('he').image, /פענוח|רשימה נכשל/);
    assert.notEqual(sentences('he').image, sentences('he').general);
    assert.notEqual(sentences('en').image, sentences('en').general);
  });

  // The rule at the head of src/utils/smartImportErrors.ts, applied to the one
  // sentence this round adds.
  test('and tells the organiser nothing operational', () => {
    for (const language of ['he', 'en']) {
      assert.doesNotMatch(sentences(language).image, /base64|canvas|jpeg|קנבס|קוד|Gemini/i);
    }
  });
});
