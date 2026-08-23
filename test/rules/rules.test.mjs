// Acceptance tests for the Realtime Database security rules.
//
// Run them with:
//   firebase emulators:exec --only database --project demo-shishi \
//     "node --test --test-concurrency=1 test/rules/"
//
// Everything lives in one file on purpose: the tests share one emulator and
// one live rule set, and the regression block below swaps the rules out and
// back. Splitting them across files would let node run them in parallel and
// race on that shared state.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ref, get, set, query, orderByChild, equalTo } from 'firebase/database';
import { clientAs, seed, loadRules, applyRules, denied } from './helpers.mjs';

const A = 'uid-organizer-a';
const B = 'uid-guest-b';
const C = 'uid-other-organizer';

const EVENT_A = '-EventOwnedByA000000';
const EVENT_C = '-EventOwnedByC000000';

let alice, bob, anon;

before(async () => {
  await applyRules(loadRules());

  // A organises an event and is its only participant. C organises another one,
  // so that "list every event" is a meaningful thing to attempt.
  await seed(`events/${EVENT_A}`, {
    organizerId: A,
    organizerName: 'A',
    createdAt: 1,
    details: { title: 'Event A', allowUserItems: true, userItemLimit: 3 },
    participants: { [A]: { name: 'A', joinedAt: 1 } },
    menuItems: { '-item-a': { name: 'Salad', creatorId: A } },
    assignments: {},
  });
  await seed(`events/${EVENT_C}`, {
    organizerId: C,
    organizerName: 'C',
    createdAt: 2,
    details: { title: 'Event C' },
    participants: {},
    menuItems: {},
    assignments: {},
  });
  await seed('presetLists/-legacy-list', { name: 'Legacy', createdBy: C, items: {} });

  alice = clientAs(A);
  bob = clientAs(B);
  anon = clientAs(null);
});

after(async () => {
  await Promise.all([alice?.close(), bob?.close(), anon?.close()]);
});

// If the namespace or the rule upload were wrong, the emulator would be serving
// its wide-open default rules and every assertion below would pass for the
// wrong reason. This catches that.
describe('sanity', () => {
  test('the rules under test are actually loaded', async () => {
    assert.ok(
      await denied(get(ref(anon.db, 'events'))),
      'a signed-out read of the whole event list succeeded, so the emulator is ' +
        'not serving database.rules.json - check the namespace',
    );
  });
});

describe('reading events', () => {
  test('B cannot list every event in the system', async () => {
    assert.ok(await denied(get(ref(bob.db, 'events'))));
  });

  test('B cannot list the events belonging to A', async () => {
    const q = query(ref(bob.db, 'events'), orderByChild('organizerId'), equalTo(A));
    assert.ok(await denied(get(q)));
  });

  test("A can list A's own events - this is the organizer screen", async () => {
    const q = query(ref(alice.db, 'events'), orderByChild('organizerId'), equalTo(A));
    const snap = await get(q);
    assert.deepEqual(Object.keys(snap.val() || {}), [EVENT_A]);
  });

  test('B can open a single event by its id - the invitation link flow', async () => {
    const snap = await get(ref(bob.db, `events/${EVENT_A}`));
    assert.equal(snap.child('details/title').val(), 'Event A');
  });

  test('A can read A\'s own event', async () => {
    const snap = await get(ref(alice.db, `events/${EVENT_A}`));
    assert.ok(snap.exists());
  });
});

describe('joining an event', () => {
  test('B can add themselves as a participant and then read the event', async () => {
    await set(ref(bob.db, `events/${EVENT_A}/participants/${B}`), { name: 'B', joinedAt: 3 });
    const snap = await get(ref(bob.db, `events/${EVENT_A}/participants/${B}`));
    assert.equal(snap.child('name').val(), 'B');
  });
});

describe('signed-out visitors', () => {
  test('cannot list events', async () => {
    assert.ok(await denied(get(ref(anon.db, 'events'))));
  });

  test('cannot open a single event', async () => {
    assert.ok(await denied(get(ref(anon.db, `events/${EVENT_A}`))));
  });

  test('cannot read the administrator list', async () => {
    assert.ok(await denied(get(ref(anon.db, 'admins'))));
  });
});

describe('administrator list', () => {
  test('a signed-in non-admin cannot read it either', async () => {
    assert.ok(await denied(get(ref(bob.db, 'admins'))));
  });
});

describe('legacy preset lists', () => {
  test('the owner can read their own record', async () => {
    const carol = clientAs(C);
    try {
      const snap = await get(ref(carol.db, 'presetLists/-legacy-list'));
      assert.equal(snap.child('name').val(), 'Legacy');
    } finally {
      await carol.close();
    }
  });

  test('another signed-in user cannot', async () => {
    assert.ok(await denied(get(ref(bob.db, 'presetLists/-legacy-list'))));
  });
});

// Step 3 of the acceptance scenario in DOCS/PLANING/09-database-permissions.md.
// It cannot pass yet and it is recorded here rather than quietly dropped.
describe('known gap: write access under events', () => {
  test('B can still write into an event owned by A (see DOCS/PLANING/14)', async () => {
    await set(ref(bob.db, `events/${EVENT_A}/menuItems/-planted-by-b`), {
      name: 'planted by B',
      creatorId: B,
    });
    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-planted-by-b`));
    assert.ok(
      snap.exists(),
      'If this assertion fails the write side has been fixed - delete this test ' +
        'and turn it into a "must be denied" assertion.',
    );
  });
});

// Proves the leak was real by putting the previous rule back and watching it
// reopen. Runs last, and restores the real rules afterwards.
describe('regression: the previous rules leaked the whole event list', () => {
  after(async () => {
    await applyRules(loadRules());
  });

  test('with the old events read rule, B can list every event', async () => {
    const old = loadRules();
    old.rules.events['.read'] = 'auth != null';
    await applyRules(old);

    const snap = await get(ref(bob.db, 'events'));
    const ids = Object.keys(snap.val() || {});
    assert.ok(ids.includes(EVENT_A) && ids.includes(EVENT_C),
      'expected the old rule to expose every event to any signed-in user');
  });
});
