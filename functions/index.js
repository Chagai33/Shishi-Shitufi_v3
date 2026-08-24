const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Resolved lazily rather than at module scope. The CLI loads this file during
// function discovery and expects exports back within 10s; resolving the database
// handle up front runs inside that window for no benefit, since every caller
// below only needs it once a handler is actually invoked.
const db = () => admin.database();

// Super-admin UID definition from environment variable
const SUPER_ADMIN_UID = process.env.SUPER_ADMIN_UID;

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

  // --- New protection layer ---
  if (uid === SUPER_ADMIN_UID) {
    console.warn(`Attempt to delete super-admin account (${uid}) was blocked.`);
    throw new functions.https.HttpsError(
      'permission-denied',
      'The super-admin account cannot be deleted.'
    );
  }
  // -------------------------

  try {
    await admin.auth().deleteUser(uid);
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

      // Cleanup user's assignments
      const assignments = eventSnapshot.child('assignments').val();
      if (assignments) {
        for (const assignmentId in assignments) {
          if (assignments[assignmentId].userId === uid) {
            updates[`/events/${eventId}/assignments/${assignmentId}`] = null;

            // Also un-assign the menu item if currently assigned to this user
            const menuItemId = assignments[assignmentId].menuItemId;
            const menuItem = eventSnapshot.child(`menuItems/${menuItemId}`).val();

            // Only unassign if the assignment actually points to this user's name or is unassigned
            // (Just to be safe, but typically we can blindly set to null since we are deleting the assignment)
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedTo`] = null;
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedToName`] = null;
            updates[`/events/${eventId}/menuItems/${menuItemId}/assignedAt`] = null;
          }
        }
      }

      // Cleanup user's created menu items (including ride offers with phone numbers)
      const menuItems = eventSnapshot.child('menuItems').val();
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
    }
  }

  return null;
});

// Import the Smart Import function (Cloud Functions v2)
exports.parseShoppingList = require("./smartImport").parseShoppingList;