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
import { ref, get, set, update, runTransaction, query, orderByChild, equalTo } from 'firebase/database';
import { clientAs, seed, loadRules, applyRules, denied } from './helpers.mjs';

const A = 'uid-organizer-a';
const B = 'uid-guest-b';
const C = 'uid-other-organizer';
// Somebody who has never added anything to any event, so they have no item
// counter yet. That is every visitor arriving through an invitation link.
const V = 'uid-visitor-no-counter';

const EVENT_A = '-EventOwnedByA000000';
const EVENT_C = '-EventOwnedByC000000';
const EVENT_EMPTY = '-EventWithNoItems000';
// The two events where the organizer switched participant items off but left
// one of the ride switches on. The three switches on the event form are
// independent, so this combination is ordinary - ride offers are even on by
// default. See DOCS/PLANING/29-rides-blocked-by-user-items-setting.md.
const EVENT_OFFERS_ONLY = '-EventOffersOnly0000';
const EVENT_REQUESTS_ONLY = '-EventRequestsOnly00';
// Two ids nobody has used yet. Creating an event is still open to anybody, so
// the first one gets made; the second one is the shape that must not be.
const EVENT_NEW_BY_B = '-EventCreatedByB0000';
// Two junk ids, not one. Against the old rules the first attempt below went
// through, and a second attempt at the same id was then refused for the wrong
// reason: the node already existed. Each attempt needs an id of its own.
const EVENT_JUNK = '-EventJunkNode000000';
const EVENT_JUNK_2 = '-EventJunkNode000001';

let alice, bob, anon, visitor;

before(async () => {
  await applyRules(loadRules());

  // A organises an event and is its only participant. C organises another one,
  // so that "list every event" is a meaningful thing to attempt.
  await seed(`events/${EVENT_A}`, {
    organizerId: A,
    organizerName: 'A',
    createdAt: 1,
    // Both ride switches are on, which is what an event that offers rides
    // looks like in production - the rules read each switch on its own now, so
    // a fixture that leaves them out is an event with no rides, not an event
    // with rides nobody governs.
    details: {
      title: 'Event A',
      allowUserItems: true,
      userItemLimit: 3,
      allowRideOffers: true,
      allowRideRequests: true,
    },
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
  // Participant items off, ride offers on. The item limit is zero because
  // that is what the event form writes when the item switch goes off.
  await seed(`events/${EVENT_OFFERS_ONLY}`, {
    organizerId: A,
    organizerName: 'A',
    createdAt: 4,
    details: {
      title: 'Offers only',
      allowUserItems: false,
      userItemLimit: 0,
      allowRideOffers: true,
      allowRideRequests: false,
    },
  });

  // The mirror image: participant items off, ride requests on.
  await seed(`events/${EVENT_REQUESTS_ONLY}`, {
    organizerId: A,
    organizerName: 'A',
    createdAt: 5,
    details: {
      title: 'Requests only',
      allowUserItems: false,
      userItemLimit: 0,
      allowRideOffers: false,
      allowRideRequests: true,
    },
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
  visitor = clientAs(V);
});

after(async () => {
  await Promise.all([alice?.close(), bob?.close(), anon?.close(), visitor?.close()]);
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
    assert.deepEqual(
      Object.keys(snap.val() || {}).sort(),
      [EVENT_A, EVENT_EMPTY, EVENT_OFFERS_ONLY, EVENT_REQUESTS_ONLY].sort(),
    );
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

// The rule on the event node used to ask whether the data *arriving* named the
// writer as the organizer. Anybody could answer that for themselves simply by
// writing it, and the app hands an identity to every visitor who opens an
// invitation link. One write and the event changed hands: the details, the menu
// and every sign-up went with it, and the real organizer was locked out of
// their own screens. See DOCS/PLANING/63-anyone-can-take-over-an-existing-event.md.
describe('taking over an event that already exists', () => {
  test("B cannot write themselves in as the organizer of A's event", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/organizerId`), B)));
  });

  // The same takeover in one move rather than two: replace the whole event with
  // an object that says B owns it.
  test("B cannot replace A's whole event with one of their own", async () => {
    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_A}`), {
          organizerId: B,
          organizerName: 'B',
          createdAt: 9,
          details: { title: 'Mine now' },
        }),
      ),
    );
  });

  test('and A is still the organizer afterwards', async () => {
    const snap = await get(ref(alice.db, `events/${EVENT_A}/organizerId`));
    assert.equal(snap.val(), A);
  });
});

// Making an event stays open to anybody, because that is the product: you sign
// in and you make one. What it is no longer is a blank cheque to write any node
// under events, with any content, at any id somebody invents.
// See DOCS/PLANING/20-anyone-can-create-an-event-node.md.
describe('creating an event', () => {
  test('B can create an event of their own, registering themselves as its organizer', async () => {
    await set(ref(bob.db, `events/${EVENT_NEW_BY_B}`), {
      organizerId: B,
      organizerName: 'B',
      createdAt: 6,
      details: { title: "B's own event", allowUserItems: true, userItemLimit: 3 },
      menuItems: {},
      assignments: {},
      participants: {},
    });
    const snap = await get(ref(bob.db, `events/${EVENT_NEW_BY_B}/organizerId`));
    assert.equal(snap.val(), B);
  });

  test('but not one that puts somebody else down as the organizer', async () => {
    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_JUNK}`), { organizerId: A, details: { title: 'not mine' } }),
      ),
    );
  });

  test('and not a bare node with no organizer at all', async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_JUNK_2}`), { details: { probe: 1 } })));
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

// A splittable item is never claimed, so its claim fields are empty. Cancelling
// a sign-up on one still writes null over all three of them, and null over an
// empty field is still a write the rules have to allow.
describe('cancelling a sign-up on a splittable item', () => {
  test('B can cancel a seat on a shared item', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-shared`, {
      name: 'Ride with four seats', creatorId: A, quantity: 4, isSplittable: true,
    });
    await seed(`events/${EVENT_A}/assignments/-assignment-shared-b`, {
      menuItemId: '-item-shared', userId: B, userName: 'B', quantity: 1,
    });

    // What cancelAssignment now sends: the claim fields are left alone when the
    // item is not claimed by anybody.
    await update(ref(bob.db), {
      [`events/${EVENT_A}/assignments/-assignment-shared-b`]: null,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/assignments/-assignment-shared-b`));
    assert.ok(!snap.exists());
  });
});

describe('adding items as a participant', () => {
  // Every other test in this block seeds a counter before it writes, so none of
  // them exercise a participant who does not have one yet - which is how the
  // suite missed DOCS/PLANING/28-visitor-cannot-add-own-item.md. These four do.
  const firstItem = (name, category) => ({ name, creatorId: V, category, quantity: 1 });

  test('a participant with no counter yet can add their first item', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-item-by-v`]: firstItem('Quiche', 'main'),
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-item-by-v/name`));
    assert.equal(snap.val(), 'Quiche');
  });

  test('a first ride offer is not refused either', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-offer-by-v`]: firstItem('Ride there', 'ride_offers'),
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-offer-by-v/name`));
    assert.equal(snap.val(), 'Ride there');
  });

  test('nor is a first ride request', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-request-by-v`]: firstItem('Need a lift', 'ride_requests'),
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-request-by-v/name`));
    assert.equal(snap.val(), 'Need a lift');
  });

  // The other half of the same rule: a first counter may only be one. Without
  // this, a fix that simply waves through a missing previous value would let
  // somebody open at any number and skip the quota entirely.
  test('but a first counter may only be one, not any number the client likes', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);

    assert.ok(
      await denied(
        update(ref(visitor.db), {
          [`events/${EVENT_A}/menuItems/-jump-by-v`]: firstItem('Opening high', 'main'),
          [`events/${EVENT_A}/userItemCounts/${V}`]: 5,
        }),
      ),
    );
  });

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

  // A ride is exempt from the quota, so the app no longer sends a counter with
  // it at all - it used to, which is how three rides could use up a quota of
  // three and leave somebody unable to bring food.
  // See DOCS/PLANING/31-rides-consume-the-item-quota.md.
  test('a ride does not count against the quota, exactly as the screen behaves', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 3);

    await set(ref(bob.db, `events/${EVENT_A}/menuItems/-ride-by-b`), {
      name: 'Ride to the event', creatorId: B, category: 'ride_offers', quantity: 3,
    });

    const name = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-ride-by-b/name`));
    assert.equal(name.val(), 'Ride to the event');

    const count = await get(ref(bob.db, `events/${EVENT_A}/userItemCounts/${B}`));
    assert.equal(count.val(), 3, 'the ride moved the item counter');
  });

  // The screens have always treated four category names as rides; the rules
  // knew three of them. An item in the fourth was exempt on screen and counted
  // on the server, so the button was live and the write refused.
  test('the fourth, older ride category is exempt too', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 3);

    await set(ref(bob.db, `events/${EVENT_A}/menuItems/-legacy-ride-by-b`), {
      name: 'Ride, old category', creatorId: B, category: 'rides', quantity: 3,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-legacy-ride-by-b/name`));
    assert.equal(snap.val(), 'Ride, old category');
  });

  // The quota is only worth as much as the counter it is measured against, and
  // until now the counter was optional: an item written on its own was taken
  // as "this person has never added anything", every time. Eight items went
  // into an event with a quota of three that way.
  // See DOCS/PLANING/30-item-rules-trust-the-client.md.
  test('an item written without its counter is refused', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);

    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-with-no-counter`), {
          name: 'Quiche', creatorId: B, category: 'main', quantity: 1,
        }),
      ),
    );
  });

  // Deleting your last item writes the counter down to zero rather than
  // removing it, so "has a counter" and "has items" are not the same question.
  test('a participant whose counter is back at zero can add again', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 0);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-after-zero`]: {
        name: 'Back again', creatorId: B, category: 'main', quantity: 1,
      },
      [`events/${EVENT_A}/userItemCounts/${B}`]: 1,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-after-zero/name`));
    assert.equal(snap.val(), 'Back again');
  });

  // The item says who created it, the screens show that name, and the right to
  // edit or delete the item follows that same field - so an item recorded
  // against somebody else is theirs to delete and not the writer's.
  test('an item recorded against somebody else is refused', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_A}/menuItems/-item-in-another-name`]: {
            name: 'Not mine', creatorId: C, category: 'main', quantity: 1,
          },
          [`events/${EVENT_A}/userItemCounts/${B}`]: 2,
        }),
      ),
    );
  });

  // Checking it only on the way in would be theatre: create it in your own
  // name, then edit the field and hand the item over.
  test('and the creator cannot hand an item over by editing that field', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-to-hand-over`, {
      name: 'Mine', creatorId: B, category: 'main', quantity: 1,
    });

    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-to-hand-over/creatorId`), C)));
  });

  // The three things that must keep working around all of the above. The
  // organizer records items against other people in two live screens - bulk
  // item management writes a fixed name, and turning a participant's one-way
  // ride into a round trip copies that participant's id onto the new leg.
  test('but the organizer still records items against other people', async () => {
    await set(ref(alice.db, `events/${EVENT_A}/menuItems/-item-by-organizer-for-b`), {
      name: 'Added for B', creatorId: B, category: 'main', quantity: 1,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems/-item-by-organizer-for-b/creatorId`));
    assert.equal(snap.val(), B);
  });

  test('an edit that does not resend the creator still works', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-to-edit`, {
      name: 'Mine', creatorId: B, category: 'main', quantity: 1,
    });

    await update(ref(bob.db, `events/${EVENT_A}/menuItems/-item-to-edit`), { quantity: 4 });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-to-edit/quantity`));
    assert.equal(snap.val(), 4);
  });

  test('and deleting your own item is not read as changing its creator', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-to-delete`, {
      name: 'Mine', creatorId: B, category: 'main', quantity: 1,
    });

    await set(ref(bob.db, `events/${EVENT_A}/menuItems/-item-to-delete`), null);

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-to-delete`));
    assert.ok(!snap.exists());
  });

  test("B cannot move somebody else's counter", async () => {
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_A}/userItemCounts/${C}`), 1)));
  });
});

describe('rides follow their own switch, not the item switch', () => {
  const ride = (name, category) => ({ name, creatorId: B, category, quantity: 3 });

  test('B can offer a ride even though participant items are switched off', async () => {
    await set(ref(bob.db, `events/${EVENT_OFFERS_ONLY}/menuItems/-offer-by-b`), ride('Ride there', 'ride_offers'));

    const snap = await get(ref(bob.db, `events/${EVENT_OFFERS_ONLY}/menuItems/-offer-by-b/name`));
    assert.equal(snap.val(), 'Ride there');
  });

  test('B can ask for a ride in the event where that switch is the one left on', async () => {
    await set(ref(bob.db, `events/${EVENT_REQUESTS_ONLY}/menuItems/-request-by-b`), ride('Need a lift', 'ride_requests'));

    const snap = await get(ref(bob.db, `events/${EVENT_REQUESTS_ONLY}/menuItems/-request-by-b/name`));
    assert.equal(snap.val(), 'Need a lift');
  });

  // The other half of the same decoupling: switching rides on must not become
  // a way in for ordinary items, and one ride switch must not open the other.
  test('a plain item is still refused in that same event', async () => {
    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_OFFERS_ONLY}/menuItems/-plain-by-b`]: {
            name: 'Quiche', creatorId: B, category: 'main', quantity: 1,
          },
          [`events/${EVENT_OFFERS_ONLY}/userItemCounts/${B}`]: 1,
        }),
      ),
    );
  });

  test('and a ride request is refused there, because that switch is off', async () => {
    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_OFFERS_ONLY}/menuItems/-request-not-allowed`), ride('Need a lift', 'ride_requests')),
      ),
    );
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

  // The test above writes three scoped paths, which is not the shape the
  // product uses. The migration is a transaction on the whole event node, so
  // what actually reaches the server is the entire event object written back.
  // That is the widest write any screen makes, and therefore the one a tighter
  // rule on the event node is most likely to break.
  // See DOCS/PLANING/51-smart-migration-replaces-every-item.md.
  test('A can run the smart migration in the shape the product actually uses', async () => {
    await runTransaction(ref(alice.db, `events/${EVENT_A}`), (current) => {
      if (current === null) return current;
      current.menuItems = { '-migrated-2': { name: 'Migrated again', creatorId: A, quantity: 1 } };
      current.assignments = {};
      current.userItemCounts = { [B]: 0 };
      return current;
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems`));
    assert.deepEqual(Object.keys(snap.val() || {}), ['-migrated-2']);
  });

  // Bulk item management, which edits items and cancels sign-ups across events.
  // It never writes the event node itself, only scoped paths beneath it.
  test('A can edit items and cancel sign-ups the way bulk item management does', async () => {
    await seed(`events/${EVENT_A}/menuItems/-item-bulk`, { name: 'Rolls', creatorId: B, quantity: 1 });
    await seed(`events/${EVENT_A}/assignments/-assignment-bulk`, {
      menuItemId: '-item-bulk', userId: C, userName: 'C', quantity: 1,
    });

    await update(ref(alice.db), {
      [`events/${EVENT_A}/menuItems/-item-bulk/name`]: 'Rolls, renamed in bulk',
      [`events/${EVENT_A}/menuItems/-item-bulk/category`]: 'dessert',
      [`events/${EVENT_A}/assignments/-assignment-bulk`]: null,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems/-item-bulk/name`));
    assert.equal(snap.val(), 'Rolls, renamed in bulk');
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
