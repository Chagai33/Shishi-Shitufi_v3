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
  // Creating an event now steps the organizer's own event counter with it, so
  // that there is something for a ceiling to be measured against.
  // See DOCS/PLANING/57-central-limits-policy.md.
  test('B can create an event of their own, registering themselves as its organizer', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1 });

    await update(ref(bob.db), {
      [`events/${EVENT_NEW_BY_B}`]: {
        organizerId: B,
        organizerName: 'B',
        createdAt: 6,
        details: { title: "B's own event", allowUserItems: true, userItemLimit: 3 },
        menuItems: {},
        assignments: {},
        participants: {},
      },
      [`users/${B}/eventCount`]: 1,
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
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-item-by-v`]: firstItem('Quiche', 'main'),
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-item-by-v/name`));
    assert.equal(snap.val(), 'Quiche');
  });

  // A ride now moves a counter of its own, which is what holds the one lift
  // each way promise the event screen has always made and the server never did.
  // See DOCS/PLANING/64-item-quota-can-be-walked-around.md.
  test('a first ride offer is not refused either', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);
    await seed(`events/${EVENT_A}/rideOfferCounts/${V}`, null);
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-offer-by-v`]: firstItem('Ride there', 'ride_offers'),
      [`events/${EVENT_A}/rideOfferCounts/${V}`]: 1,
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-offer-by-v/name`));
    assert.equal(snap.val(), 'Ride there');
  });

  test('nor is a first ride request', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);
    await seed(`events/${EVENT_A}/rideRequestCounts/${V}`, null);
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(visitor.db), {
      [`events/${EVENT_A}/menuItems/-first-request-by-v`]: firstItem('Need a lift', 'ride_requests'),
      [`events/${EVENT_A}/rideRequestCounts/${V}`]: 1,
      [`events/${EVENT_A}/userItemCounts/${V}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
    });

    const snap = await get(ref(visitor.db, `events/${EVENT_A}/menuItems/-first-request-by-v/name`));
    assert.equal(snap.val(), 'Need a lift');
  });

  // The other half of the same rule: a first counter may only be one. Without
  // this, a fix that simply waves through a missing previous value would let
  // somebody open at any number and skip the quota entirely.
  test('but a first counter may only be one, not any number the client likes', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${V}`, null);
    await seed(`events/${EVENT_A}/itemCount`, null);

    assert.ok(
      await denied(
        update(ref(visitor.db), {
          [`events/${EVENT_A}/menuItems/-jump-by-v`]: firstItem('Opening high', 'main'),
          [`events/${EVENT_A}/userItemCounts/${V}`]: 5,
          [`events/${EVENT_A}/itemCount`]: 1,
        }),
      ),
    );
  });

  test('B can add an item while under the quota, counter and all', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-by-b-2`]: {
        name: 'Hummus', creatorId: B, category: 'starter', quantity: 1,
      },
      [`events/${EVENT_A}/userItemCounts/${B}`]: 2,
      [`events/${EVENT_A}/itemCount`]: 1,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_A}/menuItems/-item-by-b-2/name`));
    assert.equal(snap.val(), 'Hummus');
  });

  test('B is refused once the quota is used up', async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 3);
    await seed(`events/${EVENT_A}/itemCount`, null);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_A}/menuItems/-item-over-quota`]: {
            name: 'One too many', creatorId: B, category: 'starter', quantity: 1,
          },
          [`events/${EVENT_A}/userItemCounts/${B}`]: 4,
          [`events/${EVENT_A}/itemCount`]: 1,
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
    await seed(`events/${EVENT_A}/rideOfferCounts/${B}`, null);
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-ride-by-b`]: {
        name: 'Ride to the event', creatorId: B, category: 'ride_offers', quantity: 3,
      },
      [`events/${EVENT_A}/rideOfferCounts/${B}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
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
    await seed(`events/${EVENT_A}/rideOfferCounts/${B}`, null);
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-legacy-ride-by-b`]: {
        name: 'Ride, old category', creatorId: B, category: 'rides', quantity: 3,
      },
      [`events/${EVENT_A}/rideOfferCounts/${B}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
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
    await seed(`events/${EVENT_A}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-after-zero`]: {
        name: 'Back again', creatorId: B, category: 'main', quantity: 1,
      },
      [`events/${EVENT_A}/userItemCounts/${B}`]: 1,
      [`events/${EVENT_A}/itemCount`]: 1,
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
          [`events/${EVENT_A}/itemCount`]: 1,
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
    await seed(`events/${EVENT_A}/itemCount`, 4);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-to-delete`]: null,
      [`events/${EVENT_A}/itemCount`]: 3,
      [`events/${EVENT_A}/itemRemovals/${B}`]: '-item-to-delete',
    });

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
    await seed(`events/${EVENT_OFFERS_ONLY}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_OFFERS_ONLY}/menuItems/-offer-by-b`]: ride('Ride there', 'ride_offers'),
      [`events/${EVENT_OFFERS_ONLY}/rideOfferCounts/${B}`]: 1,
      [`events/${EVENT_OFFERS_ONLY}/itemCount`]: 1,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_OFFERS_ONLY}/menuItems/-offer-by-b/name`));
    assert.equal(snap.val(), 'Ride there');
  });

  test('B can ask for a ride in the event where that switch is the one left on', async () => {
    await seed(`events/${EVENT_REQUESTS_ONLY}/itemCount`, null);

    await update(ref(bob.db), {
      [`events/${EVENT_REQUESTS_ONLY}/menuItems/-request-by-b`]: ride('Need a lift', 'ride_requests'),
      [`events/${EVENT_REQUESTS_ONLY}/rideRequestCounts/${B}`]: 1,
      [`events/${EVENT_REQUESTS_ONLY}/itemCount`]: 1,
    });

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
          [`events/${EVENT_OFFERS_ONLY}/itemCount`]: 1,
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

// The quota held against everybody who used the screens and against nobody who
// did not. Two ways round it were measured against these very rules: the
// counter could be walked back down with nothing deleted, and an ordinary item
// that merely called itself a ride was exempt outright. Ten of each went into
// an event whose quota is three.
//
// The counter never could be tied to a deletion, because a rule cannot know
// which item a write removed. It can be told: the write names the item it is
// removing, and the rule then checks that the named item was this person's, was
// not a ride, and is gone once the write lands. Naming an item that is not being
// deleted buys nothing, and the same name cannot be used twice because the
// second time the item is no longer there to vouch for it.
// See DOCS/PLANING/64-item-quota-can-be-walked-around.md.
describe('walking around the item quota', () => {
  const EVENT_Q = '-EventQuotaWalk00000';

  // A participant who has used their three places honestly: three items that
  // are really theirs, and a counter that agrees. Plus one ride, which is
  // exempt from the quota and therefore never raised the counter.
  const atTheQuota = () =>
    seed(`events/${EVENT_Q}`, {
      organizerId: A,
      organizerName: 'A',
      createdAt: 9,
      details: {
        title: 'Quota', allowUserItems: true, userItemLimit: 3,
        allowRideOffers: true, allowRideRequests: true,
      },
      participants: { [B]: { name: 'B', joinedAt: 1 } },
      menuItems: {
        '-q-1': { name: 'One', creatorId: B, category: 'starter', quantity: 1 },
        '-q-2': { name: 'Two', creatorId: B, category: 'main', quantity: 1 },
        '-q-3': { name: 'Three', creatorId: B, category: 'dessert', quantity: 1 },
        '-q-ride': { name: 'A lift', creatorId: B, category: 'ride_offers', quantity: 3 },
        '-q-not-mine': { name: 'Not mine', creatorId: C, category: 'starter', quantity: 1 },
      },
      assignments: {},
      userItemCounts: { [B]: 3 },
      rideOfferCounts: { [B]: 1 },
      itemCount: 5,
    });

  test('the counter cannot be stepped down with nothing deleted', async () => {
    await atTheQuota();
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_Q}/userItemCounts/${B}`), 2)));
  });

  test('nor by naming an item this write is not deleting', async () => {
    await atTheQuota();
    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-1',
          [`events/${EVENT_Q}/userItemCounts/${B}`]: 2,
        }),
      ),
    );
  });

  test("nor by deleting somebody else's item and naming that", async () => {
    await atTheQuota();
    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_Q}/menuItems/-q-not-mine`]: null,
          [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-not-mine',
          [`events/${EVENT_Q}/userItemCounts/${B}`]: 2,
          [`events/${EVENT_Q}/itemCount`]: 4,
        }),
      ),
    );
  });

  // A ride never raised the counter, so letting it lower one would hand out a
  // free place on every ride deleted. The product's own delete already knows
  // this; now the server does too.
  test('nor by deleting a ride, which never raised the counter', async () => {
    await atTheQuota();
    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_Q}/menuItems/-q-ride`]: null,
          [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-ride',
          [`events/${EVENT_Q}/userItemCounts/${B}`]: 2,
          [`events/${EVENT_Q}/itemCount`]: 4,
        }),
      ),
    );
  });

  // And the behaviour that must survive all of it: somebody who deletes one of
  // their own items gets the place back and can use it.
  test('but deleting your own item and stepping down together works', async () => {
    await atTheQuota();
    await update(ref(bob.db), {
      [`events/${EVENT_Q}/menuItems/-q-1`]: null,
      [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-1',
      [`events/${EVENT_Q}/userItemCounts/${B}`]: 2,
      [`events/${EVENT_Q}/itemCount`]: 4,
    });

    await update(ref(bob.db), {
      [`events/${EVENT_Q}/menuItems/-q-replacement`]: {
        name: 'Instead', creatorId: B, category: 'starter', quantity: 1,
      },
      [`events/${EVENT_Q}/userItemCounts/${B}`]: 3,
      [`events/${EVENT_Q}/itemCount`]: 5,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_Q}/menuItems/-q-replacement/name`));
    assert.equal(snap.val(), 'Instead');
  });

  test('and the same deletion cannot be claimed a second time', async () => {
    await atTheQuota();
    await update(ref(bob.db), {
      [`events/${EVENT_Q}/menuItems/-q-1`]: null,
      [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-1',
      [`events/${EVENT_Q}/userItemCounts/${B}`]: 2,
      [`events/${EVENT_Q}/itemCount`]: 4,
    });

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_Q}/itemRemovals/${B}`]: '-q-1',
          [`events/${EVENT_Q}/userItemCounts/${B}`]: 1,
        }),
      ),
    );
  });

  // A floor on its own does not close any of this, which was measured before it
  // was written. It is still worth having: without it the counter goes negative
  // and the quota opens without any round trip at all.
  test('and the counter cannot go below zero', async () => {
    await atTheQuota();
    await seed(`events/${EVENT_Q}/userItemCounts/${B}`, 0);
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_Q}/userItemCounts/${B}`), -1)));
  });
});

// The second way round, and the cheaper one: nothing checked that an item
// claiming the ride exemption was a ride. Ten ordinary items in a row were
// accepted at a full quota because their category said "ride offer".
//
// Requiring the category to be one the organizer defined was the first
// proposal and it cannot be built: the event's category list is stored as an
// array, which the rule language cannot search, and the ride categories are
// added on screen and never stored at all, so every genuine ride in a default
// event would have been refused. What bounds it instead is the promise the
// event screen already makes, that one person offers one lift and asks for one.
//
// The ceiling is two each way and not one, because a round trip is two items:
// the ride form writes the outward leg and the return leg as two separate
// rides, one write after the other. A ceiling of one would have created the
// first leg and refused the second, leaving half a round trip behind.
describe('an item that only says it is a ride', () => {
  const EVENT_R = '-EventRideQuota00000';

  const withRidesOn = () =>
    seed(`events/${EVENT_R}`, {
      organizerId: A,
      organizerName: 'A',
      createdAt: 10,
      details: {
        title: 'Rides', allowUserItems: true, userItemLimit: 3,
        allowRideOffers: true, allowRideRequests: true,
      },
      participants: { [B]: { name: 'B', joinedAt: 1 } },
      menuItems: {},
      assignments: {},
      userItemCounts: { [B]: 3 },
      itemCount: 0,
    });

  const fake = (id, category) => ({
    name: 'An ordinary item', creatorId: B, category, quantity: 1, id,
  });

  // The flow the ride form actually runs when somebody offers a lift both ways.
  const offerLeg = (id, count) =>
    update(ref(bob.db), {
      [`events/${EVENT_R}/menuItems/${id}`]: fake(id, 'ride_offers'),
      [`events/${EVENT_R}/rideOfferCounts/${B}`]: count,
      [`events/${EVENT_R}/itemCount`]: count,
    });

  test('a round trip still goes in, both legs', async () => {
    await withRidesOn();

    await offerLeg('-leg-there', 1);
    await offerLeg('-leg-back', 2);

    const snap = await get(ref(bob.db, `events/${EVENT_R}/menuItems`));
    assert.deepEqual(Object.keys(snap.val() || {}).sort(), ['-leg-back', '-leg-there']);
  });

  test('but a third ride offer does not', async () => {
    await withRidesOn();

    await offerLeg('-leg-there', 1);
    await offerLeg('-leg-back', 2);

    assert.ok(await denied(offerLeg('-leg-too-many', 3)));
  });

  test('and the same holds for ride requests', async () => {
    await withRidesOn();

    const askLeg = (id, count) =>
      update(ref(bob.db), {
        [`events/${EVENT_R}/menuItems/${id}`]: fake(id, 'ride_requests'),
        [`events/${EVENT_R}/rideRequestCounts/${B}`]: count,
        [`events/${EVENT_R}/itemCount`]: count,
      });

    await askLeg('-ask-there', 1);
    await askLeg('-ask-back', 2);

    assert.ok(await denied(askLeg('-ask-too-many', 3)));
  });

  // A ride written without moving its counter is refused outright, the same way
  // an ordinary item written without its counter is. This is the walk-around
  // itself: ten of these were accepted before.
  test('a ride written without its counter is refused', async () => {
    await withRidesOn();
    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_R}/menuItems/-unclaimed`), fake('-unclaimed', 'ride_offers')),
      ),
    );
  });

  test('and a counter that opens above one is refused', async () => {
    await withRidesOn();
    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_R}/menuItems/-opening-high`]: fake('-opening-high', 'ride_offers'),
          [`events/${EVENT_R}/rideOfferCounts/${B}`]: 2,
          [`events/${EVENT_R}/itemCount`]: 1,
        }),
      ),
    );
  });

  // Coming down costs a deletion, exactly as it does for the item counter.
  test('the ride counter cannot be walked back down on its own', async () => {
    await withRidesOn();
    await offerLeg('-standing-ride', 1);

    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_R}/rideOfferCounts/${B}`), 0)));
  });

  test('deleting the ride makes room for another', async () => {
    await withRidesOn();
    await offerLeg('-first-ride', 1);

    await update(ref(bob.db), {
      [`events/${EVENT_R}/menuItems/-first-ride`]: null,
      [`events/${EVENT_R}/itemRemovals/${B}`]: '-first-ride',
      [`events/${EVENT_R}/rideOfferCounts/${B}`]: 0,
      [`events/${EVENT_R}/itemCount`]: 0,
    });

    await offerLeg('-second-ride', 1);

    const snap = await get(ref(bob.db, `events/${EVENT_R}/menuItems/-second-ride/name`));
    assert.equal(snap.val(), 'An ordinary item');
  });

  // And a deletion cannot be spent on the wrong counter: deleting a ride offer
  // must not free a place on the request side, any more than it frees one on
  // the item quota.
  test('deleting a ride offer does not free a ride request place', async () => {
    await withRidesOn();
    await offerLeg('-offer-to-delete', 1);
    await seed(`events/${EVENT_R}/rideRequestCounts/${B}`, 1);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_R}/menuItems/-offer-to-delete`]: null,
          [`events/${EVENT_R}/itemRemovals/${B}`]: '-offer-to-delete',
          [`events/${EVENT_R}/rideRequestCounts/${B}`]: 0,
          [`events/${EVENT_R}/itemCount`]: 0,
        }),
      ),
    );
  });

  // A third way round the quota, found while building the other two and not
  // recorded anywhere before. A ride never touches the item counter, so an item
  // created as a ride and then edited into an ordinary category is an item that
  // never paid for its place. Nothing stopped that: the edit rule only cared
  // that the creator field did not move.
  //
  // Crossing the line in either direction is refused for everybody except the
  // organizer, who re-categorises items in bulk management as a matter of
  // course. Changing an ordinary category for another ordinary one is
  // untouched, which is the correction people actually make.
  // See DOCS/PLANING/66-a-ride-can-be-edited-into-an-ordinary-item.md.
  test('a ride cannot be edited into an ordinary item', async () => {
    await withRidesOn();
    await offerLeg('-ride-to-convert', 1);

    assert.ok(
      await denied(set(ref(bob.db, `events/${EVENT_R}/menuItems/-ride-to-convert/category`), 'main')),
    );
  });

  test('nor can an ordinary item be edited into a ride', async () => {
    await withRidesOn();
    await seed(`events/${EVENT_R}/userItemCounts/${B}`, 1);
    await seed(`events/${EVENT_R}/menuItems/-plain-to-convert`, {
      name: 'Bread', creatorId: B, category: 'starter', quantity: 1,
    });

    assert.ok(
      await denied(
        set(ref(bob.db, `events/${EVENT_R}/menuItems/-plain-to-convert/category`), 'ride_offers'),
      ),
    );
  });

  test('but one ordinary category can still be corrected to another', async () => {
    await withRidesOn();
    await seed(`events/${EVENT_R}/userItemCounts/${B}`, 1);
    await seed(`events/${EVENT_R}/menuItems/-plain-to-fix`, {
      name: 'Bread', creatorId: B, category: 'starter', quantity: 1,
    });

    await set(ref(bob.db, `events/${EVENT_R}/menuItems/-plain-to-fix/category`), 'main');

    const snap = await get(ref(bob.db, `events/${EVENT_R}/menuItems/-plain-to-fix/category`));
    assert.equal(snap.val(), 'main');
  });

  // And the organizer keeps re-categorising anything, which is what bulk item
  // management is for.
  test('the organizer can still move an item across that line', async () => {
    await withRidesOn();
    await seed(`events/${EVENT_R}/menuItems/-ride-of-b`, {
      name: 'A lift', creatorId: B, category: 'ride_offers', quantity: 3,
    });

    await set(ref(alice.db, `events/${EVENT_R}/menuItems/-ride-of-b/category`), 'main');

    const snap = await get(ref(alice.db, `events/${EVENT_R}/menuItems/-ride-of-b/category`));
    assert.equal(snap.val(), 'main');
  });
});

describe('deleting an item you created', () => {
  // The shape deleteMenuItem now sends: the item, the sign-ups on it, the
  // counter coming down, and the name of the item that pays for the step.
  test("B can delete their own item together with somebody else's sign-up", async () => {
    await seed(`events/${EVENT_A}/userItemCounts/${B}`, 1);
    await seed(`events/${EVENT_A}/itemCount`, 1);

    await update(ref(bob.db), {
      [`events/${EVENT_A}/menuItems/-item-by-b`]: null,
      [`events/${EVENT_A}/assignments/-assignment-by-c`]: null,
      [`events/${EVENT_A}/itemRemovals/${B}`]: '-item-by-b',
      [`events/${EVENT_A}/userItemCounts/${B}`]: 0,
      [`events/${EVENT_A}/itemCount`]: 0,
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
      [`events/${EVENT_A}/itemRemovals/${B}`]: '-item-by-b-3',
      [`events/${EVENT_A}/userItemCounts/${B}`]: 1,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/menuItems/-item-by-b-3`));
    assert.ok(!snap.exists());
  });

  // Bulk item management moves items between categories in batches, including
  // out of a ride category. When it does, the ride place that item was holding
  // has to go back to its owner while the item itself carries on existing -
  // which is a release the participant themselves is never allowed to make.
  test("A can release a participant's ride place while the item stays", async () => {
    await seed(`events/${EVENT_A}/menuItems/-ride-of-b-2`, {
      name: 'A lift', creatorId: B, category: 'ride_offers', quantity: 3,
    });
    await seed(`events/${EVENT_A}/rideOfferCounts/${B}`, 1);

    await update(ref(alice.db), {
      [`events/${EVENT_A}/menuItems/-ride-of-b-2/category`]: 'main',
      [`events/${EVENT_A}/rideOfferCounts/${B}`]: 0,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_A}/rideOfferCounts/${B}`));
    assert.equal(snap.val(), 0);
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
// How far ahead an event may be set, and it applies to the end date as well as
// the start. An event three years out is three years of everybody's names and
// phone numbers kept alive by one date field, and there was no ceiling on it.
//
// A rule cannot format the clock as a date, so this is a table: for each month,
// the latest day an event may fall on while that month is the current one. It
// rolls on its own and it is exact to the month.
//
// The end date is the half that is easy to miss. Limiting only the start leaves
// the hole wide open, because an event can begin tomorrow and end in the year
// 3000. See DOCS/PLANING/65-end-date-is-written-and-never-read.md.
describe('how far ahead an event may be set', () => {
  const EVENT_D = '-EventDates000000000';

  // Relative to the clock, so these do not rot: the ceiling itself rolls.
  const inMonths = (n) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };

  const freshEvent = () =>
    seed(`events/${EVENT_D}`, {
      organizerId: A,
      organizerName: 'A',
      createdAt: 11,
      details: {
        title: 'Dates', date: inMonths(1), time: '19:00', location: 'x',
        allowUserItems: true, userItemLimit: 3,
      },
      participants: {},
      menuItems: {},
      assignments: {},
    });

  test('an event six months out is accepted', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/date`), inMonths(6));
    const snap = await get(ref(alice.db, `events/${EVENT_D}/details/date`));
    assert.equal(snap.val(), inMonths(6));
  });

  test('an event eighteen months out is refused', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/date`), inMonths(18))));
  });

  test('and an event in the year 3000 is refused', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/date`), '3000-01-01')));
  });

  test('a date that is not a date is refused', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/date`), 'whenever')));
  });

  // The half that is easy to miss.
  test('an end date beyond the ceiling is refused, even when the start is fine', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/endDate`), '3000-01-01')));
  });

  test('an end date inside the ceiling is accepted', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(2));
    const snap = await get(ref(alice.db, `events/${EVENT_D}/details/endDate`));
    assert.equal(snap.val(), inMonths(2));
  });

  // The rule that lived in the form and therefore did not exist.
  test('an end date before the start is refused, in a direct write', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(0))));
  });

  test('an end date on the same day as the start is accepted', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(1));
    const snap = await get(ref(alice.db, `events/${EVENT_D}/details/endDate`));
    assert.equal(snap.val(), inMonths(1));
  });

  test('and an end time before the start time on that same day is refused', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(1));
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_D}/details/endTime`), '17:00')));
  });

  test('an end time after the start time on that same day is accepted', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(1));
    await set(ref(alice.db, `events/${EVENT_D}/details/endTime`), '23:00');
    const snap = await get(ref(alice.db, `events/${EVENT_D}/details/endTime`));
    assert.equal(snap.val(), '23:00');
  });

  // Both are optional, and clearing them must not be read as writing a bad one.
  test('the optional end date can still be removed', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), inMonths(2));
    await set(ref(alice.db, `events/${EVENT_D}/details/endDate`), null);
    const snap = await get(ref(alice.db, `events/${EVENT_D}/details/endDate`));
    assert.ok(!snap.exists());
  });

  // A whole event created in one write goes through the same check.
  test('a new event cannot be created three years out either', async () => {
    assert.ok(
      await denied(
        set(ref(bob.db, `events/-EventFarFuture00000`), {
          organizerId: B,
          organizerName: 'B',
          createdAt: 12,
          details: { title: 'Far', date: '3000-01-01', time: '19:00', location: 'x' },
        }),
      ),
    );
  });
});

// How many items one event may hold.
//
// The per-participant quota does not bound this, and cannot: the app hands a
// fresh identity to every visitor who opens an invitation link, so three items
// each is three items per identity and identities are free. The ceiling on the
// event is what makes that finite.
//
// It binds participants exactly and the organizer not at all, and that is a
// limit of the rule language rather than a choice. The migration writes the
// whole menu in one go and no rule can count what arrives in it, so the
// organizer's own screens hold the ceiling instead.
describe('how many items an event may hold', () => {
  const EVENT_F = '-EventFullOfItems000';

  const nearlyFull = (count) =>
    seed(`events/${EVENT_F}`, {
      organizerId: A,
      organizerName: 'A',
      createdAt: 13,
      details: {
        title: 'Full', date: '2026-12-01', time: '19:00', location: 'x',
        allowUserItems: true, userItemLimit: 3,
      },
      participants: { [B]: { name: 'B', joinedAt: 1 } },
      menuItems: {},
      assignments: {},
      userItemCounts: {},
      itemCount: count,
    });

  const itemBy = (uid) => ({ name: 'One more', creatorId: uid, category: 'starter', quantity: 1 });

  test('a participant adding an item steps the event counter with it', async () => {
    await nearlyFull(10);

    await update(ref(bob.db), {
      [`events/${EVENT_F}/menuItems/-under-the-line`]: itemBy(B),
      [`events/${EVENT_F}/userItemCounts/${B}`]: 1,
      [`events/${EVENT_F}/itemCount`]: 11,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_F}/itemCount`));
    assert.equal(snap.val(), 11);
  });

  test('an item written without moving the event counter is refused', async () => {
    await nearlyFull(10);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_F}/menuItems/-no-event-counter`]: itemBy(B),
          [`events/${EVENT_F}/userItemCounts/${B}`]: 1,
        }),
      ),
    );
  });

  test('and the item on the ceiling is refused', async () => {
    await nearlyFull(120);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`events/${EVENT_F}/menuItems/-over-the-line`]: itemBy(B),
          [`events/${EVENT_F}/userItemCounts/${B}`]: 1,
          [`events/${EVENT_F}/itemCount`]: 121,
        }),
      ),
    );
  });

  test('the event counter cannot be walked back down on its own', async () => {
    await nearlyFull(10);
    assert.ok(await denied(set(ref(bob.db, `events/${EVENT_F}/itemCount`), 9)));
  });

  test('but a real deletion brings it down', async () => {
    await nearlyFull(10);
    await seed(`events/${EVENT_F}/menuItems/-mine`, {
      name: 'Mine', creatorId: B, category: 'starter', quantity: 1,
    });
    await seed(`events/${EVENT_F}/userItemCounts/${B}`, 1);

    await update(ref(bob.db), {
      [`events/${EVENT_F}/menuItems/-mine`]: null,
      [`events/${EVENT_F}/itemRemovals/${B}`]: '-mine',
      [`events/${EVENT_F}/userItemCounts/${B}`]: 0,
      [`events/${EVENT_F}/itemCount`]: 9,
    });

    const snap = await get(ref(bob.db, `events/${EVENT_F}/itemCount`));
    assert.equal(snap.val(), 9);
  });

  // Nobody, organizer included, may declare a count above the ceiling. This is
  // a validate rule, so the organizer's blanket write over their own event does
  // not get past it.
  test('not even the organizer can declare a count above the ceiling', async () => {
    await nearlyFull(10);
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_F}/itemCount`), 121)));
  });

  // And the gap, stated as a test so that nobody discovers it by accident: the
  // organizer can still put more items in than the counter admits to, because
  // no rule can count the children of a write.
  test('but the organizer can still write more items than the counter says', async () => {
    await nearlyFull(0);

    const items = {};
    for (let i = 0; i < 8; i++) {
      items[`-bulk-${i}`] = { name: `Item ${i}`, creatorId: A, quantity: 1 };
    }
    await update(ref(alice.db), {
      [`events/${EVENT_F}/menuItems`]: items,
      [`events/${EVENT_F}/itemCount`]: 3,
    });

    const snap = await get(ref(alice.db, `events/${EVENT_F}/menuItems`));
    assert.equal(Object.keys(snap.val() || {}).length, 8);
  });
});

// How many events one organizer may create. The counter lives on the
// organizer's own user record, which they already have a blanket write over, so
// the ceiling is a validate rule: those apply whatever granted the write.
describe('how many events one organizer may create', () => {
  const newEvent = (id) => ({
    organizerId: B,
    organizerName: 'B',
    createdAt: 14,
    details: { title: id, date: '2026-12-01', time: '19:00', location: 'x' },
  });

  test('creating an event steps the organizer counter with it', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1 });
    await seed('events/-EventCount0000000a', null);

    await update(ref(bob.db), {
      ['events/-EventCount0000000a']: newEvent('-EventCount0000000a'),
      [`users/${B}/eventCount`]: 1,
    });

    const snap = await get(ref(bob.db, `users/${B}/eventCount`));
    assert.equal(snap.val(), 1);
  });

  test('an event created without moving that counter is refused', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1 });
    await seed('events/-EventCount0000000b', null);

    assert.ok(
      await denied(
        set(ref(bob.db, 'events/-EventCount0000000b'), newEvent('-EventCount0000000b')),
      ),
    );
  });

  test('and the event that would pass the ceiling is refused', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1, eventCount: 50 });
    await seed('events/-EventCount0000000c', null);

    assert.ok(
      await denied(
        update(ref(bob.db), {
          ['events/-EventCount0000000c']: newEvent('-EventCount0000000c'),
          [`users/${B}/eventCount`]: 51,
        }),
      ),
    );
  });

  test('the counter cannot simply be overwritten, blanket write or not', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1, eventCount: 7 });

    assert.ok(await denied(set(ref(bob.db, `users/${B}/eventCount`), 0)));
    assert.ok(await denied(set(ref(bob.db, `users/${B}`), { name: 'B', createdAt: 1, eventCount: 0 })));
  });

  test('nor walked down without deleting an event', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1, eventCount: 3 });
    assert.ok(await denied(set(ref(bob.db, `users/${B}/eventCount`), 2)));
  });

  test('but deleting an event of your own brings it down', async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1, eventCount: 3 });
    await seed('events/-EventCount0000000d', newEvent('-EventCount0000000d'));

    await update(ref(bob.db), {
      ['events/-EventCount0000000d']: null,
      [`users/${B}/eventRemoval`]: '-EventCount0000000d',
      [`users/${B}/eventCount`]: 2,
    });

    const snap = await get(ref(bob.db, `users/${B}/eventCount`));
    assert.equal(snap.val(), 2);
  });

  test("and not by naming somebody else's event", async () => {
    await seed(`users/${B}`, { name: 'B', createdAt: 1, eventCount: 3 });

    assert.ok(
      await denied(
        update(ref(bob.db), {
          [`users/${B}/eventRemoval`]: EVENT_A,
          [`users/${B}/eventCount`]: 2,
        }),
      ),
    );
  });
});

// How long a text field may be.
//
// There was no answer to this anywhere in the product: not one length check in
// the rules and not one maxLength on a screen. Five screens did refuse text for
// being too short, with a clear message, which taught people that input was
// checked while only one direction ever was.
//
// Every ceiling here sits clearly above the longest value the live database
// actually held on 26/08/2026, which is the whole point: a ceiling is there to
// stop a flood, not to cut real data. Three of them were raised from the first
// proposal for exactly that reason, when the numbers first suggested turned out
// to be below values already stored.
// See DOCS/PLANING/57-central-limits-policy.md.
describe('how long a text field may be', () => {
  const EVENT_L = '-EventLengths0000000';
  const x = (n) => 'x'.repeat(n);

  const freshEvent = () =>
    seed(`events/${EVENT_L}`, {
      organizerId: A,
      organizerName: 'A',
      createdAt: 15,
      details: {
        title: 'Lengths', date: '2026-12-01', time: '19:00', location: 'x',
        allowUserItems: true, userItemLimit: 3,
        allowRideOffers: true, allowRideRequests: true,
        categories: [{ id: 'starter', name: 'first', icon: '2.gif', color: '#3498db', order: 1 }],
      },
      participants: { [B]: { name: 'B', joinedAt: 1 } },
      menuItems: {
        '-item-of-b': { name: 'Bread', creatorId: B, category: 'starter', quantity: 1 },
      },
      assignments: {
        '-signup-of-b': { menuItemId: '-item-of-b', userId: B, userName: 'B', quantity: 1 },
      },
      userItemCounts: { [B]: 1 },
      itemCount: 1,
    });

  // Every field, its ceiling, and who writes it. The organizer writes the event
  // and its categories; the participant writes their own item and sign-up.
  const fields = [
    ['event title', () => alice, `events/${EVENT_L}/details/title`, 50],
    ['event location', () => alice, `events/${EVENT_L}/details/location`, 100],
    ['event description', () => alice, `events/${EVENT_L}/details/description`, 500],
    ['category name', () => alice, `events/${EVENT_L}/details/categories/0/name`, 30],
    ['organizer name', () => alice, `events/${EVENT_L}/organizerName`, 40],
    ['item name', () => bob, `events/${EVENT_L}/menuItems/-item-of-b/name`, 50],
    ['item note', () => bob, `events/${EVENT_L}/menuItems/-item-of-b/notes`, 50],
    ['item creator name', () => bob, `events/${EVENT_L}/menuItems/-item-of-b/creatorName`, 40],
    ['ride pickup location', () => bob, `events/${EVENT_L}/menuItems/-item-of-b/pickupLocation`, 100],
    ['item phone number', () => bob, `events/${EVENT_L}/menuItems/-item-of-b/phoneNumber`, 30],
    ['participant name', () => bob, `events/${EVENT_L}/participants/${B}/name`, 40],
    ['sign-up name', () => bob, `events/${EVENT_L}/assignments/-signup-of-b/userName`, 40],
    ['sign-up note', () => bob, `events/${EVENT_L}/assignments/-signup-of-b/notes`, 50],
    ['sign-up phone number', () => bob, `events/${EVENT_L}/assignments/-signup-of-b/phoneNumber`, 30],
  ];

  for (const [label, client, path, ceiling] of fields) {
    test(`${label}: ${ceiling} characters go in`, async () => {
      await freshEvent();
      await set(ref(client().db, path), x(ceiling));
      const snap = await get(ref(client().db, path));
      assert.equal(snap.val().length, ceiling);
    });

    test(`${label}: one character more is refused`, async () => {
      await freshEvent();
      assert.ok(await denied(set(ref(client().db, path), x(ceiling + 1))));
    });
  }

  // The question record 57 left open, and it matters: the rule language says
  // "length" and does not say whether that is characters or bytes. Every Hebrew
  // letter is two bytes, so if it were bytes then every ceiling here would be
  // half of what it says for the people who actually use this product.
  //
  // It is characters. Fifty Hebrew letters go into a field whose ceiling is
  // fifty, and fifty one do not.
  test('and the count is characters, not bytes, so Hebrew is not halved', async () => {
    await freshEvent();

    await set(ref(alice.db, `events/${EVENT_L}/details/title`), 'א'.repeat(50));
    const snap = await get(ref(alice.db, `events/${EVENT_L}/details/title`));
    assert.equal([...snap.val()].length, 50);

    assert.ok(
      await denied(set(ref(alice.db, `events/${EVENT_L}/details/title`), 'א'.repeat(51))),
    );
  });

  test('a value that is not text at all is refused', async () => {
    await freshEvent();
    assert.ok(await denied(set(ref(alice.db, `events/${EVENT_L}/details/title`), 12345)));
  });

  // Optional fields have to stay optional. A validate rule is skipped for a
  // deletion, and this is the proof: clearing the description, the note and the
  // phone number all still work.
  test('the optional fields can still be cleared', async () => {
    await freshEvent();
    await set(ref(alice.db, `events/${EVENT_L}/details/description`), 'something');
    await set(ref(alice.db, `events/${EVENT_L}/details/description`), null);
    assert.ok(!(await get(ref(alice.db, `events/${EVENT_L}/details/description`))).exists());

    await set(ref(bob.db, `events/${EVENT_L}/menuItems/-item-of-b/notes`), 'a note');
    await set(ref(bob.db, `events/${EVENT_L}/menuItems/-item-of-b/notes`), null);
    assert.ok(!(await get(ref(bob.db, `events/${EVENT_L}/menuItems/-item-of-b/notes`))).exists());
  });

  // The widest write the product makes goes through every one of these rules at
  // once, and a validate rule is not waived by the organizer's blanket write
  // over their own event. So this is the write most likely to be broken by a
  // ceiling set too low, and the one that proves none of them is.
  test('the migration, which writes every field at once, still commits', async () => {
    await freshEvent();

    await runTransaction(ref(alice.db, `events/${EVENT_L}`), (current) => {
      if (current === null) return current;
      current.menuItems = {
        '-migrated': {
          name: 'A perfectly ordinary item name',
          notes: 'and a note on it',
          creatorId: A,
          creatorName: 'Admin',
          category: 'starter',
          quantity: 1,
        },
      };
      current.assignments = {};
      current.userItemCounts = {};
      current.itemCount = 1;
      return current;
    });

    const snap = await get(ref(alice.db, `events/${EVENT_L}/menuItems/-migrated/name`));
    assert.equal(snap.val(), 'A perfectly ordinary item name');
  });

  // And it is refused when one field in it is over, organizer or not.
  test('and is refused when one field in it is over the ceiling', async () => {
    await freshEvent();

    assert.ok(
      await denied(
        runTransaction(ref(alice.db, `events/${EVENT_L}`), (current) => {
          if (current === null) return current;
          current.menuItems = {
            '-too-long': { name: x(51), creatorId: A, category: 'starter', quantity: 1 },
          };
          current.itemCount = 1;
          return current;
        }),
      ),
    );
  });
});

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
