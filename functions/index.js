// The /v1 suffix is load-bearing and not a style choice. Since firebase-functions
// 6.0.0 the package root is the v2 API, where `auth` does not exist at all - so
// onUserDeleted below stops loading outright - and where `https.onCall` builds a
// 2nd Gen callable that hands its handler one argument instead of two, silently
// changing the generation of deleteUserAccount and leaving `context` undefined.
// Dropping the suffix breaks both of them, one loudly and one quietly.
const functions = require("firebase-functions/v1");

// firebase-admin 14 removed the single-namespace export, so admin.auth(),
// admin.database() and admin.apps do not exist any more. These are the same
// three services, reached the way the library now offers them. Nothing about
// what they do changed, only how they are asked for.
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

// Resolved lazily rather than at module scope. The CLI loads this file during
// function discovery and expects exports back within 10s; resolving the database
// handle up front runs inside that window for no benefit, since every caller
// below only needs it once a handler is actually invoked.
const db = () => getDatabase();

// Super-admin UID, from the environment. Trimmed on purpose: a stray space in
// functions/.env would make the comparison below quietly never match, which is
// the exact way this guard already spent months doing nothing.
const SUPER_ADMIN_UID = (process.env.SUPER_ADMIN_UID || "").trim();

/**
 * Deletes a user account and all associated data.
 * This is a callable function invoked from the client-side.
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to delete an account.'
    );
  }

  const uid = context.auth.uid;

  // Protection for the super-admin account. When the variable is not set the
  // comparison can never match, so the guard skips itself - silently, until now.
  // It says so loudly instead, but it must never refuse the deletion itself:
  // this function is the only way any user has to delete their account, and
  // refusing would take that right away from everybody in order to protect one
  // account. See DOCS/PLANING/21-super-admin-guard-inert.md.
  if (!SUPER_ADMIN_UID) {
    console.warn(
      'SUPER_ADMIN_UID is not set, so the super-admin account is NOT protected ' +
      'from deletion. Account deletion continues to work as normal for everyone. ' +
      'Set SUPER_ADMIN_UID in functions/.env and deploy again.'
    );
  } else if (uid === SUPER_ADMIN_UID) {
    console.warn(`Attempt to delete super-admin account (${uid}) was blocked.`);
    throw new functions.https.HttpsError(
      'permission-denied',
      'The super-admin account cannot be deleted.'
    );
  }

  try {
    await getAuth().deleteUser(uid);
    return { result: `Successfully initiated deletion for user ${uid}` };
  } catch (error) {
    console.error(`Error deleting user ${uid}:`, error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while deleting the user.'
    );
  }
});


/**
 * Cleans up user data from the Realtime Database after a user is deleted.
 * This function is triggered by the deletion of a user in Firebase Authentication.
 */
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const updates = {};
  const eventsToDelete = [];

  // 1. Find all events organized by the user
  const eventsRef = db().ref('/events');
  const snapshot = await eventsRef.orderByChild('organizerId').equalTo(uid).once('value');

  if (snapshot.exists()) {
    snapshot.forEach(childSnapshot => {
      const eventId = childSnapshot.key;
      updates[`/events/${eventId}`] = null; // Mark the entire event for deletion
      eventsToDelete.push(eventId);
    });
  }

  // 2. Find all assignments and menu items made by the user in other events
  const allEventsSnapshot = await eventsRef.once('value');
  if (allEventsSnapshot.exists()) {
    allEventsSnapshot.forEach(eventSnapshot => {
      const eventId = eventSnapshot.key;
      if (eventsToDelete.includes(eventId)) {
        // Skip events that are already being deleted
        return;
      }

      // The user's row in this event's participant list, which is what puts
      // their name on the participants screen, and their per-event item
      // counter. Both are keyed by uid, and both are written unconditionally:
      // deleting something that is not there costs nothing and never fails,
      // whereas relying on somebody remembering this later does.
      // Today the participant list holds anonymous visitors almost exclusively,
      // because registered users are never added to it - a bug of its own, and
      // the day it is fixed this cleanup is already in place.
      // See DOCS/PLANING/23-registered-users-never-counted-as-participants.md.
      updates[`/events/${eventId}/participants/${uid}`] = null;
      updates[`/events/${eventId}/userItemCounts/${uid}`] = null;

      // Cleanup user's assignments. The sign-up record and nothing else: what
      // the item itself says about who is bringing it is handled below, by
      // asking the item rather than by trusting the sign-up to point at it.
      const assignments = eventSnapshot.child('assignments').val();
      if (assignments) {
        for (const assignmentId in assignments) {
          if (assignments[assignmentId].userId === uid) {
            updates[`/events/${eventId}/assignments/${assignmentId}`] = null;
          }
        }
      }

      const menuItems = eventSnapshot.child('menuItems').val();

      // The claim written on the item itself, which carries the person's id
      // and their name. Reached by walking the items, because reaching it
      // through a matching sign-up record got both directions wrong.
      //
      // It missed items. An item can say it is claimed with no sign-up record
      // pointing at it, and the product already knows this state exists:
      // validateEventData looks for exactly it and reports it. Those items
      // kept the name of somebody who had asked to be deleted, forever, and
      // nothing could ever find them again, since every route in starts from
      // the id of an account that no longer exists.
      //
      // And it cleared items belonging to other people. An item several
      // people share is claimed by whoever took it first, and a sign-up by
      // anybody else pointed at that same item: one person deleting
      // themselves released a claim that was never theirs, and the item
      // stopped looking taken to everyone.
      //
      // So the question is the one the client already asks before releasing a
      // claim, in FirebaseService.cancelAssignment: is the holder on record
      // this person. The whole event is in hand here, so it costs no reads.
      if (menuItems) {
        for (const menuItemId in menuItems) {
          if (menuItems[menuItemId].assignedTo === uid) {
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedTo`] = null;
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedToName`] = null;
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedAt`] = null;
          }
        }
      }

      // Cleanup user's created menu items (including ride offers with phone numbers)
      if (menuItems) {
        for (const menuItemId in menuItems) {
          if (menuItems[menuItemId].creatorId === uid) {
            updates[`/events/${eventId}/menuItems/${menuItemId}`] = null;

            // Cascade delete any assignments tied to this menu item
            if (assignments) {
              for (const assignmentId in assignments) {
                if (assignments[assignmentId].menuItemId === menuItemId) {
                  updates[`/events/${eventId}/assignments/${assignmentId}`] = null;
                }
              }
            }
          }
        }
      }
    });
  }

  // 3. Delete the user's own record from the /users node, and the admin entry
  // that goes with it. The admins node does not exist in the database today, so
  // this is preparation rather than housekeeping - a guard that waits for some
  // future condition is a guard nobody remembers to add.
  updates[`/users/${uid}`] = null;
  updates[`/admins/${uid}`] = null;

  // 4. Legacy preset lists at the top level. Saved lists moved under each user's
  // own record long ago, but the old node is still there and its records carry
  // an owner id. One such record survives in production and its owner no longer
  // has an account at all, which is what this leaves behind.
  const presetListsSnapshot = await db().ref('/presetLists').once('value');
  presetListsSnapshot.forEach(listSnapshot => {
    if (listSnapshot.child('createdBy').val() === uid) {
      updates[`/presetLists/${listSnapshot.key}`] = null;
    }
  });

  // 5. Drop any path that sits inside another path already being deleted.
  // A multi-path update may not contain both a path and something nested under
  // it: the database refuses the write, and because the refusal happens before
  // any of it is applied, the whole cleanup used to abort while the caller was
  // told the account had been deleted. It happens for real whenever the user
  // both created an item and was assigned to it - one branch above deletes the
  // item, another blanks fields inside it. The item wins, since deleting it
  // takes those fields with it.
  // See DOCS/PLANING/27-cleanup-aborts-before-it-starts.md.
  const paths = Object.keys(updates);
  for (const path of paths) {
    if (paths.some(other => other !== path && path.startsWith(`${other}/`))) {
      delete updates[path];
    }
  }

  // 6. Perform all database updates at once
  if (Object.keys(updates).length > 0) {
    try {
      await db().ref().update(updates);
    } catch (error) {
      console.error(`Error during database cleanup for user ${uid}:`, error);

      // The auth account is already gone by now, so this trigger will never run
      // again and nothing retries it. Without a record of the failure the data
      // simply stays, and no screen anywhere says so. This is deliberately only
      // a record for somebody to act on by hand - no retry, no work queue - and
      // it should be deleted once the leftover data has been cleaned up.
      // No client can read it: the database rules do not define this node, so
      // everything but the server is denied by default.
      try {
        await db().ref(`/deletionFailures/${uid}`).set({
          failedAt: Date.now(),
          error: (error && error.message) || String(error),
          paths: Object.keys(updates)
        });
      } catch (recordError) {
        console.error(`Could not record the cleanup failure for user ${uid}:`, recordError);
      }
    }
  }

  return null;
});

// Import the Smart Import function (Cloud Functions v2)
exports.parseShoppingList = require("./smartImport").parseShoppingList;