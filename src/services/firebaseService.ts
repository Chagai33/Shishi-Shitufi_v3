// src/services/firebaseService.ts

import { ref, push, set, get, onValue, off, remove, update, query, equalTo, orderByChild, runTransaction } from 'firebase/database';

import { createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification as sendVerificationMail } from 'firebase/auth';
import type { ActionCodeSettings, User as AuthUser } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions'; // <-- Added import
import { database, auth } from '../lib/firebase';
import { ShishiEvent, MenuItem, Assignment, User, EventDetails, PresetList, PresetItem, CategoryConfig, CustomTemplate } from '../types';

import { RIDE_OFFER_CATEGORY_IDS, RIDE_REQUEST_CATEGORY_IDS, isRideCategory } from '../utils/eventUtils';
import { toast } from 'react-hot-toast';
import i18n from '../i18n';

const functions = getFunctions(); // <-- Functions service initialization

// Firebase sends the password reset and the address verification mails itself,
// in whatever language it was last told to use, so the language of the screen
// has to be handed to it before every send. Hebrew travels under the legacy
// code "iw" and not "he", and a code the service does not recognise falls back
// to the project default rather than failing, so the worst this can cost is a
// mail in the wrong language and never a mail that was not sent.
const MAIL_LANGUAGES: Record<string, string> = { he: 'iw', en: 'en', es: 'es' };

/**
 * Where the link in the mail leaves the person once the service is done.
 *
 * Both destinations correct themselves. Somebody who is not signed in and
 * lands on the dashboard is moved to the login screen, and somebody who is
 * signed in and lands on the login screen is moved to the dashboard. So a mail
 * opened on a phone that is not signed in still ends somewhere that makes
 * sense.
 */
function returnTo(path: string): ActionCodeSettings {
  return { url: `${window.location.origin}${path}`, handleCodeInApp: false };
}

// A return address is only accepted for a domain listed as authorised in the
// console. When it is not - a domain that was renamed, a preview build of the
// site, a setting that was undone - the service does not quietly drop it. It
// refuses the request outright and no mail goes anywhere, which is a silent
// and total failure of the one thing somebody reaches for when they are
// already locked out. A refusal is therefore answered by sending the same mail
// again without a return address, through the service's own page.
const RETURN_ADDRESS_REFUSED = new Set([
  'auth/invalid-continue-uri',
  'auth/unauthorized-continue-uri',
  'auth/missing-continue-uri',
]);

async function sendReturningTo(
  path: string,
  send: (settings?: ActionCodeSettings) => Promise<void>
): Promise<void> {
  const language = (i18n.language || 'he').split('-')[0];
  auth.languageCode = MAIL_LANGUAGES[language] ?? MAIL_LANGUAGES.he;

  try {
    await send(returnTo(path));
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    if (!RETURN_ADDRESS_REFUSED.has(code)) throw error;
    console.warn('The return address was refused, sending without one:', code);
    await send();
  }
}

/**
 * Firebase service adapted for flat model (Flat Model)
 * All operations are performed on global collections with filtering by eventId or organizerId
 */
export class FirebaseService {

  // ===============================
  // Organizer management
  // ===============================

  /**
   * Creates a new organizer in the system
   */
  static async createOrganizer(email: string, password: string, displayName: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // Update profile in Firebase Auth
    await updateProfile(newUser, { displayName });

    // Create user profile in Database
    const userObject: User = {
      id: newUser.uid,
      name: displayName,
      email: newUser.email || '',
      createdAt: Date.now()
    };

    await set(ref(database, `users/${newUser.uid}`), userObject);

    // Nothing up to this line proves the address belongs to the person who
    // typed it, and until somebody opens this mail nothing does. Anyone could
    // register with anyone else's address and hold it, and anyone who mistyped
    // their own would never find out.
    //
    // Registration does not depend on the mail going out. An account that
    // exists and a person already inside it matter more than the mail, and the
    // notice on the dashboard carries a button that sends it again, which is
    // the way back from a send that failed here.
    // See DOCS/PLANING/37-no-email-verification.md.
    try {
      await FirebaseService.sendEmailVerification(newUser);
    } catch (error) {
      console.error('Could not send the address verification mail:', error);
    }

    return userObject;
  }

  /**
   * Sends the mail that proves the address belongs to whoever is signed in.
   *
   * Nothing in the product waits on it. It is what turns an address somebody
   * typed into an address somebody owns, and it is the only thing that lets a
   * person whose address was taken by somebody else get it back, because from
   * here on whoever holds the mailbox can ask for a new password.
   */
  static async sendEmailVerification(user: AuthUser | null = auth.currentUser): Promise<void> {
    // A guest has no address, so there is nothing to verify and nowhere to
    // send it.
    if (!user || user.isAnonymous) return;
    await sendReturningTo('/dashboard', (settings) => sendVerificationMail(user, settings));
  }

  /**
   * Sends the mail that lets somebody choose a new password.
   */
  static async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendReturningTo('/login', (settings) => sendPasswordResetEmail(auth, email, settings));
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';

      // The one answer that is deliberately thrown away: this address has no
      // account. The screen says the same sentence either way, so that asking
      // it about an address tells nobody whether that address is registered
      // here. Every other failure travels on intact, because a mail that was
      // not sent because the network fell over must not be reported as a mail
      // that is on its way.
      //
      // It is dropped here rather than on the screen, which is the opposite of
      // where the wording of a failed deletion was put. That was a choice of
      // words, and only the screen knows whether it is talking to a guest or
      // to an account holder. This is a choice about what the product
      // discloses, and it must not depend on every future screen remembering
      // to make the same one.
      // See DOCS/PLANING/36-no-password-reset.md.
      if (code === 'auth/user-not-found') return;
      throw error;
    }
  }

  /**
   * קורא לפונקציית ענן למחיקת המשתמש וכל הנתונים שלו
   */
  static async deleteCurrentUserAccount(): Promise<void> {
    const deleteUser = httpsCallable(functions, 'deleteUserAccount');
    try {
      await deleteUser();
    } catch (error) {
      // Thrown on exactly as it arrived. It used to be swallowed here and
      // replaced with one fixed Hebrew sentence, which erased the reason the
      // server had gone to the trouble of returning, made the translated key
      // for that sentence unreachable, and put Hebrew in front of every
      // English and Spanish user in the product.
      //
      // The wording lives on the screen instead, because only the screen knows
      // whether it is talking to an account holder or to a guest.
      // See DOCS/PLANING/39-delete-account-never-says-which-account.md.
      console.error("Error calling deleteUserAccount function:", error);
      throw error;
    }
  }

  /**
   * Update user specific fields in Database (e.g. phone number)
   */
  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = ref(database, `users/${userId}`);
      await update(userRef, updates);
    } catch (error) {
      console.error('Error updating user profile:', error);
      // Fail silently or throw based on preference. We'll fail silent for "convenience features"
    }
  }


  // ===============================
  // Event management
  // ===============================

  /**
   * Creates a new event for a specific organizer
   */
  static async createEvent(organizerId: string, eventDetails: EventDetails): Promise<string> {
    try {
      // Get organizer name
      const organizerSnapshot = await get(ref(database, `users/${organizerId}/name`));
      const organizerName = organizerSnapshot.val() || 'מארגן';

      // Create new event in global collection
      const newEventRef = push(ref(database, 'events'));
      const newEventId = newEventRef.key!;

      const fullEventData: Omit<ShishiEvent, 'id'> = {
        organizerId,
        organizerName,
        createdAt: Date.now(),
        details: eventDetails,
        menuItems: {},
        assignments: {},
        participants: {}
      };

      await set(newEventRef, fullEventData);
      return newEventId;
    } catch (error) {
      console.error('❌ Error in createEvent:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * מחזיר את כל האירועים של מארגן ספציפי
   */
  static async getEventsByOrganizer(organizerId: string): Promise<ShishiEvent[]> {
    try {
      const eventsRef = ref(database, 'events');
      const q = query(eventsRef, orderByChild('organizerId'), equalTo(organizerId));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const eventsData = snapshot.val();

        return Object.entries(eventsData)
          .map(([id, event]) => ({
            id,
            ...(event as Omit<ShishiEvent, 'id'>)
          }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  /**
   * מאזין לשינויים באירוע ספציפי
   * @deprecated Use granular subscriptions (subscribeToEventDetails, subscribeToMenuItems, subscribeToAssignments) for better performance
   */
  static subscribeToEvent(
    eventId: string,
    callback: (eventData: ShishiEvent | null) => void
  ): () => void {
    const eventRef = ref(database, `events/${eventId}`);

    const onValueChange = async (snapshot: any) => {
      if (snapshot.exists()) {
        const eventData = snapshot.val();
        const fullEvent: ShishiEvent = {
          id: eventId,
          ...eventData
        };

        callback(fullEvent);
      } else {
        callback(null);
      }
    };

    onValue(eventRef, onValueChange, (error) => {
      console.error(`❌ Error subscribing to event ${eventId}:`, error);
      callback(null);
    });

    return () => {
      off(eventRef, 'value', onValueChange);
    };
  }

  /**
   * 🚀 OPTIMIZATION: מאזין רק לפרטי האירוע (details) - ללא menuItems/assignments.
   * חוסך bandwidth כאשר רק פרטים בסיסיים משתנים.
   * Uses multiple listeners for true granular updates.
   */
  static subscribeToEventDetails(
    eventId: string,
    callback: (details: { organizerId: string; organizerName: string; createdAt: number; details: any; userItemCounts?: any } | null) => void
  ): () => void {
    const eventRef = ref(database, `events/${eventId}`);

    // We need to listen to the full event once to get base fields,
    // but we'll exclude the heavy collections in the callback
    const onValueChange = (snapshot: any) => {
      if (snapshot.exists()) {
        const eventData = snapshot.val();

        // Extract only base fields (no menuItems/assignments/participants)
        const baseData: any = {
          organizerId: eventData.organizerId,
          organizerName: eventData.organizerName,
          createdAt: eventData.createdAt,
          updatedAt: eventData.updatedAt,
          details: eventData.details,
          userItemCounts: eventData.userItemCounts || {}
        };

        callback(baseData);
      } else {
        callback(null);
      }
    };

    onValue(eventRef, onValueChange, (error) => {
      console.error(`❌ Error subscribing to event details ${eventId}:`, error);
      callback(null);
    });

    return () => off(eventRef, 'value', onValueChange);
  }

  /**
   * 🚀 OPTIMIZATION: מאזין רק ל-menuItems של האירוע.
   * עדכון של assignment לא יגרום להורדה מחדש של כל המנות.
   */
  static subscribeToMenuItems(
    eventId: string,
    callback: (menuItems: { [key: string]: any }) => void
  ): () => void {
    const menuItemsRef = ref(database, `events/${eventId}/menuItems`);

    const onValueChange = (snapshot: any) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    };

    onValue(menuItemsRef, onValueChange, (error) => {
      console.error(`❌ Error subscribing to menu items ${eventId}:`, error);
      callback({});
    });

    return () => off(menuItemsRef, 'value', onValueChange);
  }

  /**
   * 🚀 OPTIMIZATION: מאזין רק ל-assignments של האירוע.
   * שינוי של assignment אחד לא יוריד את כל ה-menuItems מחדש.
   */
  static subscribeToAssignments(
    eventId: string,
    callback: (assignments: { [key: string]: any }) => void
  ): () => void {
    const assignmentsRef = ref(database, `events/${eventId}/assignments`);

    const onValueChange = (snapshot: any) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    };

    onValue(assignmentsRef, onValueChange, (error) => {
      console.error(`❌ Error subscribing to assignments ${eventId}:`, error);
      callback({});
    });

    return () => off(assignmentsRef, 'value', onValueChange);
  }

  /**
   * 🚀 OPTIMIZATION: מאזין רק ל-participants של האירוע.
   */
  static subscribeToParticipants(
    eventId: string,
    callback: (participants: { [key: string]: any }) => void
  ): () => void {
    const participantsRef = ref(database, `events/${eventId}/participants`);

    const onValueChange = (snapshot: any) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    };

    onValue(participantsRef, onValueChange, (error) => {
      console.error(`❌ Error subscribing to participants ${eventId}:`, error);
      callback({});
    });

    return () => off(participantsRef, 'value', onValueChange);
  }

  /**
   * מוחק אירוע ספציפי
   */
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      await remove(ref(database, `events/${eventId}`));
    } catch (error) {
      console.error('❌ Error in deleteEvent:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * מוחק את כל הפריטים והשיבוצים של אירוע (עבור איתחול או הגירה)
   *
   * Unused: no screen calls this. It already writes scoped paths, and the
   * organizer may write anywhere under their own event, so it needs no change
   * for the tightened rules. See DOCS/PLANING/14-events-write-cascade.md.
   */
  static async deleteAllEventItems(eventId: string): Promise<void> {
    try {
      const updates: { [key: string]: null } = {};
      updates[`events/${eventId}/menuItems`] = null;
      updates[`events/${eventId}/assignments`] = null;
      updates[`events/${eventId}/userItemCounts`] = null;

      await update(ref(database), updates);
    } catch (error) {
      console.error('❌ Error in deleteAllEventItems:', error);
      throw error;
    }
  }

  /**
   * Safe Migration: Replaces all event items with a new list in a single atomic update.
   * This ensures we don't lose data if the user refreshes mid-process.
   *
   * Deliberately still a whole-event transaction. Only the organizer runs it,
   * and the organizer may write anywhere under their own event, so the
   * tightened rules do not block it. Converting it would lose the protection
   * against items added while the migration is running.
   *
   * An item that carries an id is one the event already holds. It is written back
   * under that id, keeps its creator and its creation time, and keeps the sign-ups
   * pointing at it. Without that, a migration rebuilt every item from scratch and
   * cancelled every sign-up in the event, even for items that came through the
   * classification untouched.
   */
  static async replaceAllMenuItems(
    eventId: string,
    newItems: (Omit<MenuItem, 'id'> & { id?: string })[],
    creatorId: string,
    migrationStartTime: number,
    // The ids the screen actually had when it built the preview. Anything the
    // database holds beyond this set was invisible to the organizer, so it is
    // kept. An empty set means "trust nothing the screen did not send", which
    // is the safe reading.
    knownItemIds: string[] = [],
    // The categories the event has after the change. Without them the only place
    // to put an item added mid-migration is a hardcoded id, and a hardcoded id is
    // not in the list of every template: "on the fire" and "picnic" have no
    // catch-all at all, so the item landed in a category that does not exist and
    // its dropdown came up empty. See 17-ai-classification-after-migration.md.
    categoryRules: { allowedIds: string[]; fallbackId: string } | null = null
  ): Promise<{ concurrentItemCount: number }> {
    const eventRef = ref(database, `events/${eventId}`);
    // Set by the updater, which may run more than once. The last run is the one
    // that commits, so an assignment rather than an increment is what is wanted.
    let concurrentItemCount = 0;

    try {
      await runTransaction(eventRef, (currentEventData: ShishiEvent | null) => {
        if (currentEventData === null) return currentEventData;

        // 1. Identify "Concurrent Items" - items created AFTER we started the migration process
        const allowedIds = categoryRules ? new Set(categoryRules.allowedIds) : null;
        const concurrentItems: MenuItem[] = [];
        if (currentEventData.menuItems) {
          Object.values(currentEventData.menuItems).forEach((item: any) => {
            if ((item.createdAt || 0) > migrationStartTime) {
              // Its own category if the event still has one, and only otherwise the
              // event's catch-all. Nobody chose to move this item, so moving it is
              // a last resort and not the default.
              const category = (!allowedIds || allowedIds.has(item.category))
                ? item.category
                : (categoryRules ? categoryRules.fallbackId : 'other');
              concurrentItems.push({ ...item, category });
            }
          });
        }
        concurrentItemCount = concurrentItems.length;

        // 2. Clear existing structure (Items, Assignments, Counts) for fresh slate
        const newMenuItemsMap: { [key: string]: any } = {};
        const newUserItemCounts: { [key: string]: number } = {};

        // 3. Process the Admin's Migrated Items
        let adminItemCount = 0;
        const keptItemIds = new Set<string>();
        const knownIds = new Set(knownItemIds);
        newItems.forEach((item) => {
          // An item that already exists in the event keeps its id, so everything
          // that points at it keeps pointing at it. Only a genuinely new item gets
          // an id generated here, inside the transaction.
          const isExisting = !!item.id;
          const newItemId = item.id || `migrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // The base is the item as the database holds it right now, not the copy
          // the screen has been carrying since it loaded. A sign-up made after that
          // screen opened lives on the live item and nowhere else, and taking the
          // screen's copy instead is what cancelled it.
          const live: any = (isExisting && currentEventData.menuItems)
            ? (currentEventData.menuItems as any)[newItemId]
            : null;
          const base: any = live || item;

          const itemData: any = {
            ...base,
            id: newItemId,
            // The five fields the preview lets the organizer edit, and nothing else.
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            notes: item.notes || null,
            isRequired: item.isRequired ?? false,
            isSplittable: base.isSplittable ?? item.quantity > 1,
            createdAt: isExisting ? (base.createdAt || Date.now()) : Date.now(),
            creatorId: isExisting ? base.creatorId : creatorId,
            creatorName: isExisting ? base.creatorName : 'Admin'
          };
          Object.keys(itemData).forEach(key => itemData[key] === undefined && delete itemData[key]);

          newMenuItemsMap[newItemId] = itemData;

          if (isExisting) {
            keptItemIds.add(newItemId);
            // The item belongs to whoever created it, so it counts against their
            // own item limit and not against the organizer's. A ride never counts,
            // the same exemption addMenuItem applies when the ride is offered.
            if (itemData.creatorId && !isRideCategory(itemData.category)) {
              newUserItemCounts[itemData.creatorId] = (newUserItemCounts[itemData.creatorId] || 0) + 1;
            }
          } else {
            adminItemCount++;
          }
        });

        // Items the database holds that the screen never had. The screen could not
        // have offered them to the organizer, so their absence from the list is not
        // a decision the organizer made, and they stay exactly as they are. This is
        // the gap a sign-up fell into: the dashboard reads the organizer's events
        // once when it loads, and anything added after that read was invisible to
        // the migration and was wiped by it.
        if (currentEventData.menuItems) {
          Object.entries(currentEventData.menuItems).forEach(([id, liveItem]: [string, any]) => {
            if (newMenuItemsMap[id] || knownIds.has(id)) return;
            newMenuItemsMap[id] = liveItem;
            keptItemIds.add(id);
            if (liveItem?.creatorId && !isRideCategory(liveItem.category)) {
              newUserItemCounts[liveItem.creatorId] = (newUserItemCounts[liveItem.creatorId] || 0) + 1;
            }
          });
        }

        // 4. Re-add Concurrent Items (Preserved)
        concurrentItems.forEach(cItem => {
          const cId = cItem.id;
          // Already counted above if the organizer's list happened to include it.
          const alreadyCounted = keptItemIds.has(cId);
          newMenuItemsMap[cId] = {
            ...cItem,
            notes: cItem.notes ? `${cItem.notes} (נוסף תוך כדי הגירה)` : '(נוסף תוך כדי הגירה)'
          };
          keptItemIds.add(cId);

          if (cItem.creatorId && !alreadyCounted) {
            newUserItemCounts[cItem.creatorId] = (newUserItemCounts[cItem.creatorId] || 0) + 1;
          }
        });

        // Add Admin counts
        if (adminItemCount > 0) {
          newUserItemCounts[creatorId] = (newUserItemCounts[creatorId] || 0) + adminItemCount;
        }

        // Sign-ups survive for every item that survived. An item the organizer
        // dropped from the preview takes its sign-ups with it, which is what
        // dropping it means.
        const keptAssignments: { [key: string]: any } = {};
        if (currentEventData.assignments) {
          Object.entries(currentEventData.assignments).forEach(([assignmentId, assignment]: [string, any]) => {
            if (assignment?.menuItemId && keptItemIds.has(assignment.menuItemId)) {
              keptAssignments[assignmentId] = assignment;
            }
          });
        }

        // 5. Apply New Items to State
        currentEventData.menuItems = newMenuItemsMap;
        currentEventData.assignments = keptAssignments;
        currentEventData.userItemCounts = newUserItemCounts;

        return currentEventData;
      });

      return { concurrentItemCount };
    } catch (error) {
      console.error('❌ Error in replaceAllMenuItems transaction:', error);
      throw error;
    }
  }

  /**
   * מעדכן פרטי אירוע
   */
  static async updateEvent(
    eventId: string,
    updates: Partial<ShishiEvent>
  ): Promise<void> {
    try {
      const eventRef = ref(database, `events/${eventId}`);
      await update(eventRef, updates);
    } catch (error) {
      console.error('❌ Error in updateEvent:', error);
      throw error;
    }
  }

  /**
   * מעדכן פרטי אירוע (פרטים פנימיים)
   */
  static async updateEventDetails(eventId: string, updates: Partial<EventDetails>): Promise<void> {
    try {
      const detailsRef = ref(database, `events/${eventId}/details`);
      await update(detailsRef, updates);
    } catch (error) {
      console.error('❌ Error in updateEventDetails:', error);
      console.groupEnd();
      throw error;
    }
  }

  // ===============================
  // Menu items management
  // ===============================

  /**
   * Adds a new item to the menu
   */
  /**
   * Adds a new item to the menu (Transactional)
   * Updates userItemCounts and enforces limits unless bypassed (admin/organizer)
   */
  static async addMenuItem(
    eventId: string,
    itemData: Omit<MenuItem, 'id'>,
    options?: { bypassLimit?: boolean }
  ): Promise<string> {
    try {
      // Read the two things the decision needs instead of the whole event.
      const [detailsSnapshot, organizerSnapshot] = await Promise.all([
        get(ref(database, `events/${eventId}/details`)),
        get(ref(database, `events/${eventId}/organizerId`))
      ]);

      if (!detailsSnapshot.exists()) {
        throw new Error('האירוע לא נמצא.');
      }

      const details = detailsSnapshot.val();
      const creatorId = itemData.creatorId;
      // Who is writing, not whose name is on the item. The two are not the same
      // and two live organizer screens rely on the difference: bulk item
      // management records a fixed name that belongs to no account, and turning
      // a participant's one-way ride into a round trip copies that participant
      // onto the new leg. Reading the organizer off the item's creator field
      // also meant a participant could claim the organizer's exemptions simply
      // by writing the organizer's id into the item - which the rules now
      // refuse outright. See DOCS/PLANING/30-item-rules-trust-the-client.md.
      const isOrganizer = !!auth.currentUser && auth.currentUser.uid === organizerSnapshot.val();
      const shouldBypassLimit = isOrganizer || options?.bypassLimit;

      const countSnapshot = creatorId
        ? await get(ref(database, `events/${eventId}/userItemCounts/${creatorId}`))
        : null;
      const userItemCount = countSnapshot?.val() || 0;

      // Check 1: Is adding allowed? The event form has three independent
      // switches, so this asks the one that actually governs what is being
      // added. Asking the item switch about a ride is what refused a ride in
      // an event where the organizer had switched items off and left rides on,
      // and it answered with a message about items that the user had never
      // asked for. See DOCS/PLANING/29-rides-blocked-by-user-items-setting.md.
      //
      // A missing switch reads as off, the same way the event screen and the
      // rules read it.
      if (!isOrganizer) {
        const category = itemData.category;
        if (RIDE_OFFER_CATEGORY_IDS.includes(category)) {
          if (details.allowRideOffers !== true) {
            throw new Error(i18n.t('eventPage.category.rideOffersDisabled'));
          }
        } else if (RIDE_REQUEST_CATEGORY_IDS.includes(category)) {
          if (details.allowRideRequests !== true) {
            throw new Error(i18n.t('eventPage.category.rideRequestsDisabled'));
          }
        } else if (details.allowUserItems !== true) {
          throw new Error(i18n.t('eventPage.category.addingDisabled'));
        }
      }

      // Check 2: Limit reached? A ride does not count against the quota - that
      // is what the product promises and what the rules enforce - so it is
      // exempt here by what it is, not by a flag the caller passes in. Callers
      // still pass the flag for the organizer and the admin screens.
      // See DOCS/PLANING/31-rides-consume-the-item-quota.md.
      const isRide = isRideCategory(itemData.category);
      if (!shouldBypassLimit && !isRide && userItemCount >= (details.userItemLimit ?? 3)) {
        throw new Error(i18n.t('eventPage.category.limitReached', { limit: details.userItemLimit ?? 3 }));
      }

      // --- Prepare Data ---
      const newItemRef = push(ref(database, `events/${eventId}/menuItems`));
      const newItemId = newItemRef.key!;

      // Sanitize item data
      const finalItemData: any = {
        ...itemData,
        id: newItemId,
        notes: itemData.notes || null
      };
      Object.keys(finalItemData).forEach(key => {
        if (finalItemData[key] === undefined) delete finalItemData[key];
      });

      // The item and the counter go up together in one atomic update. The
      // counter rule accepts a step of exactly one, which makes it a
      // compare-and-set: a second addition racing this one is refused by the
      // server rather than overwriting the count, and the item is not created
      // either. That is why no transaction is needed here.
      const updates: { [key: string]: any } = {};
      updates[`events/${eventId}/menuItems/${newItemId}`] = finalItemData;
      // A ride is exempt from the quota, so it must not move the counter that
      // the quota is measured against. It used to, which is how three rides
      // could use up a quota of three and grey out the add button for food.
      if (creatorId && !isRide) {
        updates[`events/${eventId}/userItemCounts/${creatorId}`] = userItemCount + 1;
      }

      await update(ref(database), updates);

      return newItemId;

    } catch (error) {
      console.error('❌ Error in addMenuItem:', error);
      throw error;
    }
  }

  /**
   * Adds a new item and assigns it to a user (optional)
   *
   * Unused: no screen calls this. It is still a whole-event transaction and
   * would have to be converted like addMenuItem before anything calls it again.
   * See DOCS/PLANING/14-events-write-cascade.md.
   */
  static async addMenuItemAndAssign(
    eventId: string,
    itemData: Omit<MenuItem, 'id'>,
    assignToUserId: string | null,
    assignToUserName: string
  ): Promise<string> {
    if (!assignToUserId) {
      console.error('❌ Transaction aborted: assignToUserId is null.');
      throw new Error('לא ניתן להוסיף פריט ללא שיבוץ למשתמש.');
    }

    const eventRef = ref(database, `events/${eventId}`);
    let newItemId: string | null = null;

    try {
      await runTransaction(eventRef, (currentEventData: ShishiEvent | null) => {
        if (currentEventData === null) {
          return currentEventData;
        }

        // --- New validation logic ---
        const details = currentEventData.details;
        const userItemCount = currentEventData.userItemCounts?.[assignToUserId] || 0;

        const isOrganizer = assignToUserId === currentEventData.organizerId;
        const shouldBypassLimit = isOrganizer;

        // Check #1: Can the organizer add items
        // (Note: This logic is also enforced in Security Rules)
        if (details.allowUserItems === false && !isOrganizer) {
          throw new Error('המארגן לא איפשר הוספת פריטים באירוע זה.');
        }

        // Check #2: Has the user exceeded the limit
        if (!shouldBypassLimit && userItemCount >= (details.userItemLimit ?? 3)) {
          throw new Error(`הגעת למגבלת ${details.userItemLimit ?? 3} הפריטים שניתן להוסיף.`);
        }

        // --- Preserve original data creation logic ---
        const newItemRef = push(ref(database, `events/${eventId}/menuItems`));
        newItemId = newItemRef.key!; // Store ID outside the transaction

        // Ensure valid data structure (replaces ensureEventStructure)
        if (!currentEventData.menuItems) currentEventData.menuItems = {};
        if (!currentEventData.assignments) currentEventData.assignments = {};
        if (!currentEventData.participants) currentEventData.participants = {};
        if (!currentEventData.userItemCounts) currentEventData.userItemCounts = {};


        // Prepare item object
        const finalItemData: any = {
          ...itemData,
          id: newItemId,
          assignedTo: assignToUserId,
          assignedToName: assignToUserName,
          assignedAt: Date.now()
        };
        if (!finalItemData.notes) {
          delete finalItemData.notes;
        }

        // Prepare assignment object
        const newAssignmentRef = push(ref(database, `events/${eventId}/assignments`));
        const assignmentData: Omit<Assignment, 'id'> = {
          menuItemId: newItemId,
          userId: assignToUserId,
          userName: assignToUserName,
          quantity: itemData.quantity,
          notes: itemData.notes || '',
          status: 'confirmed',
          assignedAt: Date.now()
        };


        // --- Direct data update in transaction ---
        currentEventData.menuItems[newItemId] = finalItemData;
        currentEventData.assignments[newAssignmentRef.key!] = assignmentData;

        // --- Update the new counter ---
        currentEventData.userItemCounts[assignToUserId] = userItemCount + 1;

        return currentEventData;
      });

      if (!newItemId) {
        throw new Error("Failed to generate a new item ID during the transaction.");
      }
      return newItemId;

    } catch (error) {
      console.error('❌ Error in addMenuItemAndAssign Transaction:', error);
      throw error; // Re-throw error so toast displays it
    }
  }
  /**
   * מעדכן פריט תפריט
   */
  static async updateMenuItem(
    eventId: string,
    itemId: string,
    updates: Partial<MenuItem>
  ): Promise<void> {
    try {
      // Validate quantity if being updated
      if (updates.quantity !== undefined) {
        const assignmentsRef = ref(database, `events/${eventId}/assignments`);
        const assignmentsSnapshot = await get(assignmentsRef);
        const assignments = assignmentsSnapshot.val() || {};

        const totalAssigned = Object.values(assignments)
          .filter((a: any) => a.menuItemId === itemId)
          .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

        if (updates.quantity < totalAssigned) {
          throw new Error(`לא ניתן להקטין את הכמות מתחת ל-${totalAssigned} (כמות משובצת)`);
        }
      }

      // Sanitize updates to remove undefined values and convert empty strings to null
      const sanitizedUpdates: { [key: string]: any } = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          sanitizedUpdates[key] = null;
        } else if (value === '') {
          sanitizedUpdates[key] = null;
        } else {
          sanitizedUpdates[key] = value;
        }
      });

      const itemRef = ref(database, `events/${eventId}/menuItems/${itemId}`);
      await update(itemRef, sanitizedUpdates);
    } catch (error) {
      console.error('❌ Error in updateMenuItem:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * מוחק פריט תפריט
   */
  static async deleteMenuItem(eventId: string, itemId: string): Promise<void> {
    console.group('🗑️ FirebaseService.deleteMenuItem');
    console.log('📥 Input parameters:', { eventId, itemId });

    try {
      const [itemSnapshot, assignmentsSnapshot] = await Promise.all([
        get(ref(database, `events/${eventId}/menuItems/${itemId}`)),
        get(ref(database, `events/${eventId}/assignments`))
      ]);

      if (!itemSnapshot.exists()) {
        // If item doesn't exist, nothing to do.
        console.groupEnd();
        return;
      }

      const itemToDelete = itemSnapshot.val();
      const creatorId = itemToDelete.creatorId;
      const assignments = assignmentsSnapshot.val() || {};

      const hasOtherUserAssignments = Object.values(assignments)
        .some((a: any) => a.menuItemId === itemId && a.userId !== creatorId);

      if (hasOtherUserAssignments) {
        console.warn('⚠️ Deleting item with active assignments for other users.');
      }

      const updates: { [key: string]: any } = {};

      // Step 1: Delete the item itself
      updates[`events/${eventId}/menuItems/${itemId}`] = null;

      // Step 2: Update counter (if relevant). It is written down to zero rather
      // than removed, because the counter rule only accepts a step of one in
      // either direction and a zero entry reads the same as a missing one.
      // Both halves of the counter move together or neither does. Lowering it
      // for a ride that never raised it would hand the creator a free slot
      // every time they deleted one.
      if (creatorId && !isRideCategory(itemToDelete.category)) {
        const countSnapshot = await get(ref(database, `events/${eventId}/userItemCounts/${creatorId}`));
        const currentCount = countSnapshot.val() || 0;
        if (currentCount > 0) {
          updates[`events/${eventId}/userItemCounts/${creatorId}`] = currentCount - 1;
          console.log(`📉 Decremented item count for user ${creatorId} to ${currentCount - 1}`);
        }
      }

      // Step 3: Delete all assignments related to the item
      Object.keys(assignments).forEach(assignmentId => {
        if (assignments[assignmentId].menuItemId === itemId) {
          updates[`events/${eventId}/assignments/${assignmentId}`] = null;
          console.log(`🗑️ Marked related assignment ${assignmentId} for deletion.`);
        }
      });

      // One atomic update: the item, its counter and its sign-ups go together.
      await update(ref(database), updates);
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in deleteMenuItem:', error);
      console.groupEnd();
      throw error;
    }
  }

  // ===============================
  // Participant management
  // ===============================

  /**
   * מצרף משתתף לאירוע
   */
  static async joinEvent(
    eventId: string,
    userId: string,
    userName: string
  ): Promise<void> {

    try {
      const participantRef = ref(database, `events/${eventId}/participants/${userId}`);
      const participantData = {
        name: userName,
        joinedAt: Date.now()
      };

      await set(participantRef, participantData);
    } catch (error) {
      console.error('❌ Error in joinEvent:', error);
      throw error;
    }
  }

  /**
   * מסיר משתתף מהאירוע
   */
  static async leaveEvent(eventId: string, userId: string): Promise<void> {

    try {
      const participantRef = ref(database, `events/${eventId}/participants/${userId}`);
      await remove(participantRef);
    } catch (error) {
      console.error('❌ Error in leaveEvent:', error);
      throw error;
    }
  }

  // ===============================
  // Assignment management
  // ===============================

  /**
   * יוצר שיבוץ חדש
   */
  static async createAssignment(
    eventId: string,
    assignmentData: Omit<Assignment, 'id'>
  ): Promise<string> {

    const newAssignmentRef = push(ref(database, `events/${eventId}/assignments`));
    const newAssignmentId = newAssignmentRef.key!;
    let claimedTheItem = false;

    try {
      // Read only what the decision needs, instead of pulling the whole event
      // in for a read-modify-write. The race the old transaction guarded is now
      // guarded by the rule on the item's claim fields: claiming is allowed only
      // while they are empty, so a second claimant is refused by the server and
      // the update below fails as one.
      const itemSnapshot = await get(ref(database, `events/${eventId}/menuItems/${assignmentData.menuItemId}`));
      if (!itemSnapshot.exists()) {
        throw new Error('הפריט לא נמצא.');
      }
      const item = itemSnapshot.val();

      const sanitizedAssignmentData: any = { ...assignmentData };
      // Remove undefined values to prevent "Data returned contains undefined"
      Object.keys(sanitizedAssignmentData).forEach(key => {
        if (sanitizedAssignmentData[key] === undefined) {
          delete sanitizedAssignmentData[key];
        }
      });

      const updates: { [key: string]: any } = {};
      updates[`events/${eventId}/assignments/${newAssignmentId}`] = {
        ...sanitizedAssignmentData,
        id: newAssignmentId,
        assignedAt: Date.now()
      };

      if (item.isSplittable || item.quantity > 1) {
        // Splittable item: several people share it, so the item itself is never
        // claimed and the cap is the only thing to check. It is checked here and
        // nowhere else - the rules cannot add up sibling assignments. The
        // residual race is recorded in DOCS/PLANING/14-events-write-cascade.md.
        const assignmentsSnapshot = await get(ref(database, `events/${eventId}/assignments`));
        const assignments = assignmentsSnapshot.val() || {};

        const currentAssignedQuantity = Object.values(assignments)
          .filter((a: any) => a.menuItemId === assignmentData.menuItemId)
          .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

        if (currentAssignedQuantity + assignmentData.quantity > item.quantity) {
          const remaining = Math.max(0, item.quantity - currentAssignedQuantity);
          throw new Error(`הכמות המבוקשת גדולה מהכמות הפנויה. נותרו: ${remaining}`);
        }

      } else {
        // Non-splittable item: one person takes it, so it carries the claim.
        if (item.assignedTo) {
          throw new Error('מצטערים, מישהו אחר כבר הספיק לשבץ את הפריט הזה');
        }

        const itemPath = `events/${eventId}/menuItems/${assignmentData.menuItemId}`;
        updates[`${itemPath}/assignedTo`] = assignmentData.userId;
        updates[`${itemPath}/assignedToName`] = assignmentData.userName;
        updates[`${itemPath}/assignedAt`] = Date.now();
        claimedTheItem = true;
      }

      await update(ref(database), updates);

      return newAssignmentId;
    } catch (error: any) {
      console.error('❌ Error in createAssignment:', error);
      // A refusal while claiming means somebody got there between the read above
      // and the write. Keep the wording the user already knows.
      if (claimedTheItem && String(error?.code || error?.message).toUpperCase().includes('PERMISSION')) {
        throw new Error('מצטערים, מישהו אחר כבר הספיק לשבץ את הפריט הזה');
      }
      // Improve error message for known issues
      if (error.message && error.message.includes('contains undefined')) {
        throw new Error('שגיאת מערכת: נתונים לא תקינים (undefined). אנא נסה שנית או פנה לתמיכה.');
      }
      throw error;
    }
  }

  // src/services/firebaseService.ts

  /**
   * Updates an existing assignment. If the username changes, the function will update the name across all assignments and items of that user in the current event.
   */
  static async updateAssignment(
    eventId: string,
    assignmentId: string,
    updates: { quantity: number; notes?: string; userName?: string }
  ): Promise<void> {

    try {
      const dbUpdates: { [key: string]: any } = {};
      const assignmentPath = `events/${eventId}/assignments/${assignmentId}`;

      // Step 1: Prepare the basic updates for the specific assignment being edited.
      dbUpdates[`${assignmentPath}/quantity`] = updates.quantity;
      dbUpdates[`${assignmentPath}/notes`] = updates.notes || null; // Use null for empty notes
      dbUpdates[`${assignmentPath}/updatedAt`] = Date.now();

      // Step 2: Check if the user's name needs to be updated across the entire event.
      if (updates.userName) {
        const assignmentRef = ref(database, assignmentPath);
        const assignmentSnapshot = await get(assignmentRef);

        if (assignmentSnapshot.exists()) {
          const assignmentData = assignmentSnapshot.val();
          const currentUserId = assignmentData.userId;
          const currentUserName = assignmentData.userName;

          // Only proceed if the name has actually changed.
          if (currentUserId && updates.userName !== currentUserName) {
            // Fetch all event data to find other instances of this user.
            const eventRef = ref(database, `events/${eventId}`);
            const eventSnapshot = await get(eventRef);

            if (eventSnapshot.exists()) {
              const eventData = eventSnapshot.val();
              const allAssignments = eventData.assignments || {};
              const allMenuItems = eventData.menuItems || {};

              // Iterate through all assignments in the event.
              for (const anId in allAssignments) {
                if (allAssignments[anId].userId === currentUserId) {
                  dbUpdates[`events/${eventId}/assignments/${anId}/userName`] = updates.userName;

                  const menuItemId = allAssignments[anId].menuItemId;
                  // Only touch the item's label when this user is the one the
                  // item is actually claimed by. On a splittable item nobody is,
                  // so the label describes no one and writing it is meaningless.
                  if (menuItemId && allMenuItems[menuItemId]?.assignedTo === currentUserId) {
                    dbUpdates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = updates.userName;
                  }
                }
              }

              // Iterate through all menu items to update creatorName.
              for (const menuItemId in allMenuItems) {
                if (allMenuItems[menuItemId].creatorId === currentUserId) {
                  dbUpdates[`events/${eventId}/menuItems/${menuItemId}/creatorName`] = updates.userName;
                }
              }
            }
          } else {
            // If only quantity/notes changed, or name is the same, update just in case.
            dbUpdates[`${assignmentPath}/userName`] = updates.userName;
            const menuItemId = assignmentData.menuItemId;
            if (menuItemId) {
              // Same restriction as above: the label belongs to whoever claimed
              // the item, and only they may write it.
              const claimSnapshot = await get(ref(database, `events/${eventId}/menuItems/${menuItemId}/assignedTo`));
              if (claimSnapshot.val() === currentUserId) {
                dbUpdates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = updates.userName;
              }
            }
          }
        }
      }

      // Perform a single, atomic update for all changes.
      await update(ref(database), dbUpdates);

    } catch (error) {
      console.error('❌ Error in updateAssignment:', error);
      throw error;
    }
  }

  /**
   * מבטל שיבוץ
   */
  static async cancelAssignment(
    eventId: string,
    assignmentId: string,
    menuItemId: string
  ): Promise<void> {

    try {
      const updates: { [key: string]: null } = {};

      // Delete the assignment
      updates[`events/${eventId}/assignments/${assignmentId}`] = null;

      // Remove assignment from item - but only if the item is actually claimed,
      // and only if the claim belongs to the person whose sign-up is going.
      //
      // An item several people share is never claimed, so those three fields
      // are already empty, and writing null over an empty claim field is still
      // a write, which the rules refuse.
      //
      // And a claim can outlive the arrangement that made it. An item created
      // with a quantity of one is claimed by whoever takes it; raising the
      // quantity afterwards makes it splittable and lets other people sign up,
      // without ever clearing that first claim. Cancelling one of those later
      // sign-ups used to try to release somebody else's claim, which the rules
      // refuse - the release belongs to the holder - and the refusal took the
      // whole write down with it, cancellation included.
      const claimSnapshot = await get(ref(database, `events/${eventId}/menuItems/${menuItemId}/assignedTo`));
      const assignmentSnapshot = await get(ref(database, `events/${eventId}/assignments/${assignmentId}/userId`));
      if (claimSnapshot.exists() && claimSnapshot.val() === assignmentSnapshot.val()) {
        updates[`events/${eventId}/menuItems/${menuItemId}/assignedTo`] = null;
        updates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = null;
        updates[`events/${eventId}/menuItems/${menuItemId}/assignedAt`] = null;
      }

      await update(ref(database), updates);
    } catch (error) {
      console.error('❌ Error in cancelAssignment:', error);
      throw error;
    }
  }

  /**
   * Takes one person out of one event completely: the items they created, the
   * sign-ups they made, and their row on the participant list.
   *
   * This exists because none of the three did it. leaveEvent removes the list
   * row and leaves everything with the person's name and phone number on it
   * still standing, and cancelling a sign-up leaves the list row. Somebody who
   * used what was there would have watched their name disappear from the
   * participants screen while their number stayed on the ride they offered.
   *
   * It is built out of the existing calls rather than one large write, and
   * that is deliberate. Deleting an item steps the person's item counter down
   * by one, and the rules accept a step of one per write - three items have to
   * be three writes or the database refuses all of them. Going through
   * deleteMenuItem also keeps the counter and the cascade in the one place
   * that already gets them right, and avoids the older trap of sending a path
   * and something nested inside it in the same write.
   * See DOCS/PLANING/24-anonymous-visitor-cannot-delete-account.md
   * and DOCS/PLANING/27-cleanup-aborts-before-it-starts.md.
   *
   * Deleting a ride takes the passengers' sign-ups with it. The event screen
   * normally refuses that and tells the driver to empty the ride first, which
   * is right for an ordinary delete - a ride should not vanish under the
   * people in it. Here it has to be allowed, because the alternative is
   * telling somebody they may not withdraw their own phone number. The screen
   * says how many people it affects before it calls this.
   */
  static async removeMyselfFromEvent(eventId: string, userId: string): Promise<void> {
    try {
      const [itemsSnapshot, assignmentsSnapshot] = await Promise.all([
        get(ref(database, `events/${eventId}/menuItems`)),
        get(ref(database, `events/${eventId}/assignments`))
      ]);

      const menuItems = itemsSnapshot.val() || {};
      const assignments = assignmentsSnapshot.val() || {};

      const myItemIds = Object.keys(menuItems).filter(
        itemId => menuItems[itemId].creatorId === userId
      );

      // Sign-ups on other people's items go first, and deliberately so. This
      // half can be refused - it writes to items somebody else owns - whereas
      // deleting your own items cannot. Running the destructible half first
      // meant a refusal here landed after the items were already gone: the
      // person had lost what they created, was still on the participant list,
      // and their phone number was still on somebody else's ride, with every
      // retry hitting the same refusal. Failing before anything is destroyed
      // leaves them exactly where they started, which they can retry or
      // report.
      const myRemainingAssignments = Object.keys(assignments).filter(
        assignmentId =>
          assignments[assignmentId].userId === userId &&
          !myItemIds.includes(assignments[assignmentId].menuItemId)
      );
      for (const assignmentId of myRemainingAssignments) {
        await FirebaseService.cancelAssignment(
          eventId,
          assignmentId,
          assignments[assignmentId].menuItemId
        );
      }

      // Then their own items. Each call takes the sign-ups on it with it,
      // which is what cancels the passengers the confirmation warned about.
      for (const itemId of myItemIds) {
        await FirebaseService.deleteMenuItem(eventId, itemId);
      }

      // The name goes last. If anything above fails the person is still listed,
      // which is the honest state - they are still in the event.
      await FirebaseService.leaveEvent(eventId, userId);
    } catch (error) {
      console.error('❌ Error in removeMyselfFromEvent:', error);
      throw error;
    }
  }

  // ===============================
  // Preset lists management
  // ===============================

  /**
   * מאזין לשינויים באוסף הרשימות המוכנות
   */
  static subscribeToPresetLists(
    callback: (lists: PresetList[]) => void,
    organizerId?: string
  ): () => void {
    // Always use the user's private path
    if (!organizerId) {
      console.warn('No organizerId provided for preset lists subscription');
      callback([]);
      return () => { };
    }

    const listsRef = ref(database, `users/${organizerId}/presetLists`);
    const onValueChange = (snapshot: any) => {
      if (snapshot.exists()) {
        const listsData = snapshot.val();
        const listsArray: PresetList[] = Object.entries(listsData).map(([id, list]) => ({
          id,
          ...(list as Omit<PresetList, 'id'>)
        }));

        // Add default lists if they don't exist
        const hasDefaultParticipants = listsArray.some(list => list.id === 'default-participants');
        const hasDefaultSalon = listsArray.some(list => list.id === 'default-salon');

        if (!hasDefaultParticipants) {
          listsArray.push({
            id: 'default-participants',
            name: 'פריטים בסיסיים למשתתפים',
            type: 'participants',
            items: [
              { name: 'חלה', category: 'main', quantity: 2, isRequired: true },
              { name: 'יין אדום', category: 'drink', quantity: 1, isRequired: true },
              { name: 'יין לבן', category: 'drink', quantity: 1, isRequired: false },
              { name: 'סלט ירוק', category: 'starter', quantity: 1, isRequired: false },
              { name: 'חומוס', category: 'starter', quantity: 1, isRequired: false },
              { name: 'טחינה', category: 'starter', quantity: 1, isRequired: false },
              { name: 'פיתות', category: 'main', quantity: 10, isRequired: false },
              { name: 'גבינות', category: 'starter', quantity: 1, isRequired: false },
              { name: 'פירות', category: 'dessert', quantity: 1, isRequired: false },
              { name: 'עוגה', category: 'dessert', quantity: 1, isRequired: false },
              { name: 'מיץ', category: 'drink', quantity: 2, isRequired: false },
              { name: 'מים', category: 'drink', quantity: 2, isRequired: true }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'system'
          });
        }

        if (!hasDefaultSalon) {
          listsArray.push({
            id: 'default-salon',
            name: 'ציוד סלון בסיסי',
            type: 'salon',
            items: [
              { name: 'שולחנות', category: 'other', quantity: 4, isRequired: true },
              { name: 'כיסאות', category: 'other', quantity: 20, isRequired: true },
              { name: 'מפות שולחן', category: 'other', quantity: 4, isRequired: false },
              { name: 'צלחות', category: 'other', quantity: 25, isRequired: true },
              { name: 'כוסות', category: 'other', quantity: 25, isRequired: true },
              { name: 'סכו"ם', category: 'other', quantity: 25, isRequired: true },
              { name: 'מגשים', category: 'other', quantity: 5, isRequired: false },
              { name: 'קנקני מים', category: 'drink', quantity: 3, isRequired: true },
              { name: 'מפיות', category: 'other', quantity: 50, isRequired: false }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'system'
          });
        }

        callback(listsArray);
      } else {
        // If no lists exist, create the default lists
        const defaultLists: PresetList[] = [
          {
            id: 'default-participants',
            name: 'פריטים בסיסיים למשתתפים',
            type: 'participants',
            items: [
              { name: 'חלה', category: 'main', quantity: 2, isRequired: true },
              { name: 'יין אדום', category: 'drink', quantity: 1, isRequired: true },
              { name: 'יין לבן', category: 'drink', quantity: 1, isRequired: false },
              { name: 'סלט ירוק', category: 'starter', quantity: 1, isRequired: false },
              { name: 'חומוס', category: 'starter', quantity: 1, isRequired: false },
              { name: 'טחינה', category: 'starter', quantity: 1, isRequired: false },
              { name: 'פיתות', category: 'main', quantity: 10, isRequired: false },
              { name: 'גבינות', category: 'starter', quantity: 1, isRequired: false },
              { name: 'פירות', category: 'dessert', quantity: 1, isRequired: false },
              { name: 'עוגה', category: 'dessert', quantity: 1, isRequired: false },
              { name: 'מיץ', category: 'drink', quantity: 2, isRequired: false },
              { name: 'מים', category: 'drink', quantity: 2, isRequired: true }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'system'
          },
          {
            id: 'default-salon',
            name: 'ציוד סלון בסיסי',
            type: 'salon',
            items: [
              { name: 'שולחנות', category: 'other', quantity: 4, isRequired: true },
              { name: 'כיסאות', category: 'other', quantity: 20, isRequired: true },
              { name: 'מפות שולחן', category: 'other', quantity: 4, isRequired: false },
              { name: 'צלחות', category: 'other', quantity: 25, isRequired: true },
              { name: 'כוסות', category: 'other', quantity: 25, isRequired: true },
              { name: 'סכו"ם', category: 'other', quantity: 25, isRequired: true },
              { name: 'מגשים', category: 'other', quantity: 5, isRequired: false },
              { name: 'קנקני מים', category: 'drink', quantity: 3, isRequired: true },
              { name: 'מפיות', category: 'other', quantity: 50, isRequired: false }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'system'
          }
        ];
        callback(defaultLists);
      }
    };

    onValue(listsRef, onValueChange, (error) => {
      console.error('Error subscribing to preset lists:', error);
      callback([]);
    });

    return () => off(listsRef, 'value', onValueChange);
  }

  /**
   * יוצר רשימה מוכנה חדשה
   */
  static async createPresetList(
    listData: { name: string; type: 'salon' | 'participants'; items: PresetItem[] },
    organizerId?: string
  ): Promise<string | null> {
    if (!organizerId) {
      toast.error('אין הרשאה ליצור רשימה');
      return null;
    }

    try {
      // Always save under the specific organizer
      const basePath = `users/${organizerId}/presetLists`;
      const newListRef = push(ref(database, basePath));

      const fullListData = {
        ...listData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: organizerId
      };

      await set(newListRef, fullListData);

      return newListRef.key;
    } catch (error) {
      console.error('Error creating preset list:', error);
      throw error;
    }
  }

  /**
   * מעדכן רשימה מוכנה קיימת
   */
  static async updatePresetList(
    listId: string,
    updates: Partial<PresetList>,
    organizerId: string
  ): Promise<boolean> {
    try {
      const listRef = ref(database, `users/${organizerId}/presetLists/${listId}`);
      await update(listRef, { ...updates, updatedAt: Date.now() });
      return true;
    } catch (error) {
      console.error('Error updating preset list:', error);
      return false;
    }
  }

  /**
   * מוחק רשימה מוכנה
   */
  static async deletePresetList(listId: string, organizerId: string): Promise<void> {
    try {
      await remove(ref(database, `users/${organizerId}/presetLists/${listId}`));
    } catch (error) {
      console.error('Error deleting preset list:', error);
      throw error;
    }
  }

  // ===============================
  // Maintenance and diagnostics functions
  // ===============================

  /**
   * מוודא עקביות נתונים באירוע
   */
  static async validateEventData(eventId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const eventSnapshot = await get(ref(database, `events/${eventId}`));

      if (!eventSnapshot.exists()) {
        return { isValid: false, issues: ['האירוע לא קיים'] };
      }

      const eventData = eventSnapshot.val();

      // Basic structure check
      if (!eventData.details) issues.push('חסרים פרטי האירוע');
      if (!eventData.organizerId) issues.push('חסר מזהה מארגן');
      if (!eventData.organizerName) issues.push('חסר שם מארגן');

      // Assignment consistency check
      const menuItems = eventData.menuItems || {};
      const assignments = eventData.assignments || {};

      Object.entries(assignments).forEach(([assignmentId, assignment]: [string, any]) => {
        const menuItem = menuItems[assignment.menuItemId];
        if (!menuItem) {
          issues.push(`שיבוץ ${assignmentId} מצביע על פריט שלא קיים: ${assignment.menuItemId}`);
        } else if (menuItem.assignedTo !== assignment.userId) {
          issues.push(`אי-עקביות בשיבוץ ${assignmentId}: המשתמש בפריט (${menuItem.assignedTo}) שונה מהמשתמש בשיבוץ (${assignment.userId})`);
        }
      });

      Object.entries(menuItems).forEach(([menuItemId, menuItem]: [string, any]) => {
        if (menuItem.assignedTo) {
          const assignmentExists = Object.values(assignments).some((a: any) => a.menuItemId === menuItemId && a.userId === menuItem.assignedTo);
          if (!assignmentExists) {
            issues.push(`פריט ${menuItemId} משובץ למשתמש ${menuItem.assignedToName} אך אין שיבוץ תואם`);
          }
        }
      });

      return { isValid: issues.length === 0, issues };
    } catch (error) {
      console.error('❌ Error validating event data:', error);
      return { isValid: false, issues: ['שגיאה בבדיקת הנתונים'] };
    }
  }

  // ===============================
  // Custom Templates Management
  // ===============================

  /**
   * Save a custom user template (limit to 5 per user)
   */
  static async saveCustomTemplate(userId: string, name: string, categories: CategoryConfig[]): Promise<string> {
    const templatesRef = ref(database, `users/${userId}/templates`);

    // Check limit
    const snapshot = await get(templatesRef);
    if (snapshot.exists() && snapshot.size >= 5) {
      throw new Error('Limit reached: You can save up to 5 custom templates.');
    }

    const newTemplateRef = push(templatesRef);
    await set(newTemplateRef, {
      id: newTemplateRef.key,
      name,
      categories,
      createdAt: Date.now()
    });

    return newTemplateRef.key as string;
  }

  /**
   * Get all custom templates for a user
   */
  static async getUserTemplates(userId: string): Promise<CustomTemplate[]> {
    const templatesRef = ref(database, `users/${userId}/templates`);
    const snapshot = await get(templatesRef);

    if (!snapshot.exists()) return [];

    const templates: CustomTemplate[] = [];
    snapshot.forEach((child) => {
      templates.push(child.val());
    });

    return templates.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a custom template
   */
  static async deleteCustomTemplate(userId: string, templateId: string): Promise<void> {
    const templateRef = ref(database, `users/${userId}/templates/${templateId}`);
    await remove(templateRef);
  }
}