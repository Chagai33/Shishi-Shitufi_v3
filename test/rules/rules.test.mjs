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
import { ref, get, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { clientAs, seed, loadRules, applyRules, denied } from './helpers.mjs';

const A = 'uid-organizer-a';
const B = 'uid-guest-b';
const C = 'uid-other-organizer';

const EVENT_A = '-EventOwnedByA000000';
const EVENT_C = '-EventOwnedByC000000';
const EVENT_EMPTY = '-EventWithNoItems000';

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
    menuItems: {
      // Unclaimed, one person takes it - what a guest signs up for.
      '-item-a': { name: 'Salad', creatorId: A, quantity: 1 },
      // Already taken by the organizer, so releasing it is somebody else's act.
      '-item-claimed-by-a': { name: 'Wine', creatorId: A, quantity: 1, assignedTo: A, assignedToName: 'A' },
      // Created by the guest, and somebody else signed up for it.
      '-item-by-b': { name: 'Bread', creatorId: B, quantity: 1 },
    },
    assignments: {
      '-assignment-by-c': { menuItemId: '-item-by-b', userId: C, userName: 'C', quantity: 1 },
    },
    userItemCounts: { [B]: 1 },
  });

  // An event with no items at all - a freshly created one, where the first
  // guests arrive before the organizer has added anything.
  await seed(`events/${EVENT_EMPTY}`, {
    organizerId: A,
    organizerName: 'A',
    createdAt: 3,
    details: { title: 'Empty Event', allowUserItems: true, userItemLimit: 3 },
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
    assert.deepEqual(Object.keys(snap.val() || {}).sort(), [EVENT_A, EVENT_EMPTY].sort());
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

// This block used to record the open write-side gap and assert that B *could*
// write into A's event. DOCS/PLANING/14-events-write-cascade.md closes that gap,
// so it now reads the other way round: every one of these must be refused.
describe('writing into an event you do not own', () => {
  test("B cannot edit the details of A's event", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/details/title`), 'taken over')));
  });

  // Note that event A does allow participant items, so B adding one of their
  // own there is the product working as intended. What B must not be able to do
  // is reach into an item somebody else created.
  test('B cannot edit an item somebody else created', async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-a/name`), 'renamed by B')));
  });

  test('B cannot delete an item somebody else created', async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-a`), null)));
  });

  test("B cannot wipe the whole menu of A's event", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems`), null)));
  });

  test('B cannot delete every event in the system', async () => {
    assert.ok(await denied(set(ref(bob.db, 'events'), null)));
  });

  test('B cannot add an item to an event that does not allow participant items', async () => {
    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_C}/menuItems/-sneaked-in`), {
          name: 'sneaked in',
          creatorId: B,
        }),
      ),
    );
  });
});

describe('claiming an item', () => {
  test('B can sign up for an unclaimed item, in one atomic write', async () => {
    await update(ref(bob.db), {
      [`events/${EVENT_A}/assignments/-assignment-by-b`]: {
        menuItemId: '-item-a',
        userId: B,
        userName: 'B',
        quantity: 1,
      },
      [`events/${EVENT_A}/menuItems/-item-a/assignedTo`]: B,
      [`events/${EVENT_A}/menuItems/-item-a/assignedToName`]: 'B',
      [`events/${EVENT_A}/menuItems/-item-a/assignedAt`]: 10,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-a/assignedTo`));
    assert.equal(snap.val(), B);
  });

  test('somebody else cannot take an item that is already claimed', async () => {
    const carol = clientAs(C);
    try {
      assert.ok(
        await denied(
          update(ref(carol.db), {
            [`events/${EVENT_A}/assignments/-assignment-by-c-2`]: {
              menuItemId: '-item-a',
              userId: C,
              userName: 'C',
              quantity: 1,
            },
            [`events/${EVENT_A}/menuItems/-item-a/assignedTo`]: C,
            [`events/${EVENT_A}/menuItems/-item-a/assignedToName`]: 'C',
            [`events/${EVENT_A}/menuItems/-item-a/assignedAt`]: 11,
          }),
        ),
      );

      // The sign-up must not survive on its own either - the two paths travel
      // together, so the refusal has to take both.
      const snap = await get(ref(carol.db, `events/${EVENT_A}/assignments/-assignment-by-c-2`));
      assert.ok(!snap.exists(), 'the sign-up was written even though the claim was refused');
    } finally {
      await carol.close();
    }
  });

  test('B can release the claim they made', async () => {
    await update(ref(bob.db), {
      [`events/${EVENT_A}/assignments/-assignment-by-b`]: null,
      [`events/${EVENT_A}/menuItems/-item-a/assignedTo`]: null,
      [`events/${EVENT_A}/menuItems/-item-a/assignedToName`]: null,
      [`events/${EVENT_A}/menuItems/-item-a/assignedAt`]: null,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-a/assignedTo`));
    assert.ok(!snap.exists());
  });

  test("B cannot claim an item in somebody else's name", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-a/assignedTo`), C)));
  });

  test('B cannot release a claim that belongs to somebody else', async () => {
    assert.ok(
      await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-claimed-by-a/assignedTo`), null)),
    );
  });

  // The scenario the whole race question was about: two people going for the
  // same item at the same moment. Exactly one of them may get it.
  test('two people going for the same item at once - one wins, one is refused', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-contested`, {
      name: 'Contested', creatorId: A, quantity: 1,
    });

    const first = clientAs('uid-racer-1');
    const second = clientAs('uid-racer-2');
    try {
      const claim = (client, uid) =>
        update(ref(client.db), {
          [`events/${EVENT_A}/assignments/-assignment-${uid}`]: {
            menuItemId: '-item-contested', userId: uid, userName: uid, quantity: 1,
          },
          [`events/${EVENT_A}/menuItems/-item-contested/assignedTo`]: uid,
          [`events/${EVENT_A}/menuItems/-item-contested/assignedToName`]: uid,
          [`events/${EVENT_A}/menuItems/-item-contested/assignedAt`]: 12,
        });

      const results = await Promise.allSettled([
        claim(first, 'uid-racer-1'),
        claim(second, 'uid-racer-2'),
      ]);

      const winners = results.filter((r) => r.status === 'fulfilled');
      assert.equal(winners.length, 1, `expected exactly one winner, got ${winners.length}`);
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
  });
});

describe('adding items as a participant', () => {
  test('B can add an item while under the quota, counter and all', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-by-b-2`]: {
        name: 'Hummus', creatorId: B, category: 'starter', quantity: 1,
      },
      [`events/${EVENT_A}/userItemCounts/${B}`]: 2,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-by-b-2/name`));
    assert.equal(snap.val(), 'Hummus');
  });

  test('B is refused once the quota is used up', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 3);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_A}/menuItems/-item-over-quota`]: {
            name: 'One too many', creatorId: B, category: 'starter', quantity: 1,
          },
          [`events/${EVENT_A}/userItemCounts/${B}`]: 4,
        }),
      ),
    );
  });

  test('a ride does not count against the quota, exactly as the screen behaves', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 3);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-ride-by-b`]: {
        name: 'Ride to the event', creatorId: B, category: 'ride_offers', quantity: 3,
      },
      [`events/${EVENT_A}/userItemCounts/${B}`]: 4,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-ride-by-b/name`));
    assert.equal(snap.val(), 'Ride to the event');
  });

  test("B cannot move somebody else's counter", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/userItemCounts/${C}`), 1)));
  });
});

describe('deleting an item you created', () => {
  test("B can delete their own item together with somebody else's sign-up", async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-by-b`]: null,
      [`events/${EVENT_A}/assignments/-assignment-by-c`]: null,
      [`events/${EVENT_A}/userItemCounts/${B}`]: 0,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-by-b`));
    assert.ok(!snap.exists());
  });

  test('B cannot delete a sign-up on an item they did not create', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-of-a-2`, { name: 'Cake', creatorId: A, quantity: 1 });
    await seed(`events/${EVENT_A}/assignments/-assignment-of-c-2`, {
      menuItemId: '-item-of-a-2', userId: C, userName: 'C', quantity: 1,
    });

    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/assignments/-assignment-of-c-2`), null)));
  });
});

describe('joining an event that has no items yet', () => {
  test('B can join a freshly created event', async () => {
    await set(ref(bob.db, `events/${EVENT_EMPTY}/participants/${B}`), { name: 'B', joinedAt: 4 });
    const snap = await get(ref(bob.db, `events/${EVENT_EMPTY}/participants/${B}`));
    assert.equal(snap.child('name').val(), 'B');
  });
});

describe('the organizer still runs their own event', () => {
  test('A can edit the event details', async () => {
    await set(ref(alice.db, `events/${EVENT_A}/details/title`), 'Event A, renamed');
    const snap = await get(ref(alice.db, `events/${EVENT_A}/details/title`));
    assert.equal(snap.val(), 'Event A, renamed');
  });

  test("A can delete a participant's item and lower that participant's counter", async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-by-b-3`, { name: 'Olives', creatorId: B, quantity: 1 });
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 2);

    await update(ref(alice.db), {
      [`events/${EVENT_A}/menuItems/-item-by-b-3`]: null,
      [`events/${EVENT_A}/userItemCounts/${B}`]: 1,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems/-item-by-b-3`));
    assert.ok(!snap.exists());
  });

  test('A can replace the whole menu in one write - the migration', async () => {
    await update(ref(alice.db), {
      [`events/${EVENT_A}/menuItems`]: { '-migrated-1': { name: 'Migrated', creatorId: A, quantity: 1 } },
      [`events/${EVENT_A}/assignments`]: {},
      [`events/${EVENT_A}/userItemCounts`]: { [A]: 1 },
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems`));
    assert.deepEqual(Object.keys(snap.val() || {}), ['-migrated-1']);
  });

  test('A can wipe the menu of their own event', async () => {
    await set(ref(alice.db, `events/${EVENT_A}/menuItems`), null);
    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems`));
    assert.ok(!snap.exists());
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
