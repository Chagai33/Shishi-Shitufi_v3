// src/services/firebaseService.ts

import { ref, push, set, get, onValue, off, remove, update, query, equalTo, orderByChild, runTransaction } from 'firebase/database';

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions'; // <-- Added import
import { database, auth } from '../lib/firebase';
import { ShishiEvent, MenuItem, Assignment, User, EventDetails, PresetList, PresetItem } from '../types'; 

import { toast } from 'react-hot-toast'; 

const functions = getFunctions(); // <-- Functions service initialization

/**
 * Firebase service adapted for flat model (Flat Model)
 * All operations are performed on global collections with filtering by eventId or organizerId
 */
export class FirebaseService {
  
  // ===============================
  // Internal helper functions
  // ===============================
  
  /**
   * Ensures the event has all required structures
   */
  private static async ensureEventStructure(eventId: string): Promise<void> {
    try {
      const eventRef = ref(database, `events/${eventId}`);
      const snapshot = await get(eventRef);
      
      if (snapshot.exists()) {
        const eventData = snapshot.val();
        const updates: { [key: string]: any } = {};
        
        // Ensure all required structures exist
        if (!eventData.menuItems) {
          updates[`events/${eventId}/menuItems`] = {};
        }
        if (!eventData.assignments) {
          updates[`events/${eventId}/assignments`] = {};
        }
        if (!eventData.participants) {
          updates[`events/${eventId}/participants`] = {};
        }
        
        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
        }
      } else {
        console.warn('⚠️ Event does not exist:', `events/${eventId}`);
      }
      
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in ensureEventStructure:', error);
      console.groupEnd();
      throw error;
    }
  }

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
    return userObject;
  }
  
  /**
   * קורא לפונקציית ענן למחיקת המשתמש וכל הנתונים שלו
   */
  static async deleteCurrentUserAccount(): Promise<void> {
    const deleteUser = httpsCallable(functions, 'deleteUserAccount');
    try {
        const result = await deleteUser();
    } catch (error) {
        console.error("Error calling deleteUserAccount function:", error);
        throw new Error('שגיאה במחיקת החשבון.');
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
   */
  static subscribeToEvent(
    eventId: string, 
    callback: (eventData: ShishiEvent | null) => void
  ): () => void {
    console.group('📖 FirebaseService.subscribeToEvent');
    console.log('📥 Input parameters:', { eventId });
    console.log('🔗 Event path:', `events/${eventId}`);
    
    const eventRef = ref(database, `events/${eventId}`);
    
    const onValueChange = async (snapshot: any) => {
      if (snapshot.exists()) {
        // Ensure valid structure before returning data
        await this.ensureEventStructure(eventId);

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
   * מעדכן פרטי אירוע
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
  static async addMenuItem(
    eventId: string,
    itemData: Omit<MenuItem, 'id'>
  ): Promise<string> {
    try {
      await this.ensureEventStructure(eventId);
      const newItemRef = push(ref(database, `events/${eventId}/menuItems`));
      const newItemId = newItemRef.key!;
      
      // Clean undefined values before saving
      const finalItemData = {
        ...itemData,
        id: newItemId,
        notes: itemData.notes || null // Convert undefined to null or remove completely
      };
      
      // Remove fields with null/undefined values
      Object.keys(finalItemData).forEach(key => {
        if (finalItemData[key as keyof typeof finalItemData] === undefined) {
          delete finalItemData[key as keyof typeof finalItemData];
        }
      });

      await set(newItemRef, finalItemData);
      return newItemId;
    } catch (error) {
      console.error('❌ Error in addMenuItem:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Adds a new item and assigns it to a user (optional)
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
          // If the event doesn't exist, the transaction will fail and the error will be caught in catch.
          // No need to throw an error from here.
          return; 
        }

        // --- New validation logic ---
        const details = currentEventData.details;
        const userItemCount = currentEventData.userItemCounts?.[assignToUserId] || 0;

        // Check #1: Can the organizer add items
        // (Note: This logic is also enforced in Security Rules)
        if (details.allowUserItems === false) { // Explicit check for false
          throw new Error('המארגן לא איפשר הוספת פריטים באירוע זה.');
        }

        // Check #2: Has the user exceeded the limit
        if (userItemCount >= (details.userItemLimit ?? 3)) {
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
        console.log('✅ Event structure ensured');

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
        console.log('📋 Assignment data:', assignmentData);

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
      console.groupEnd();
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
    console.group('🗑️ FirebaseService.deleteMenuItem (Transactional)');
    console.log('📥 Input parameters:', { eventId, itemId });

    const eventRef = ref(database, `events/${eventId}`);
    
    try {
      await runTransaction(eventRef, (currentEventData: ShishiEvent | null) => {
        if (currentEventData === null || !currentEventData.menuItems?.[itemId]) {
          // If event or item don't exist, nothing to do.
          console.log('Transaction aborted: Event or menu item not found.');
          return; 
        }

        console.log('🔧 Transaction started. Current event data:', currentEventData);
        
        const itemToDelete = currentEventData.menuItems[itemId];
        const creatorId = itemToDelete.creatorId;

        // Step 1: Update counter (if relevant)
        if (creatorId && currentEventData.userItemCounts?.[creatorId]) {
          currentEventData.userItemCounts[creatorId]--;
          console.log(`📉 Decremented item count for user ${creatorId} to ${currentEventData.userItemCounts[creatorId]}`);
          // If counter reaches zero, clean up the entry
          if (currentEventData.userItemCounts[creatorId] <= 0) {
            delete currentEventData.userItemCounts[creatorId];
            console.log(`🧹 Cleaned up zero-count entry for user ${creatorId}`);
          }
        }
        
        // Step 2: Delete the item itself
        delete currentEventData.menuItems[itemId];
        console.log(`🗑️ Marked menu item ${itemId} for deletion.`);

        // Step 3: Delete all assignments related to the item
        if (currentEventData.assignments) {
          Object.keys(currentEventData.assignments).forEach(assignmentId => {
            if (currentEventData.assignments[assignmentId].menuItemId === itemId) {
              delete currentEventData.assignments[assignmentId];
              console.log(`🗑️ Marked related assignment ${assignmentId} for deletion.`);
            }
          });
        }
        
        // Return the updated object so the transaction writes it
        return currentEventData;
      });

      console.log('✅ Menu item and related data deleted successfully via transaction');
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in deleteMenuItem transaction:', error);
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
    console.group('👥 FirebaseService.joinEvent');
    console.log('📥 Input parameters:', { eventId, userId, userName });
    
    try {
      await this.ensureEventStructure(eventId);
      
      const participantRef = ref(database, `events/${eventId}/participants/${userId}`);
      const participantData = {
        name: userName,
        joinedAt: Date.now()
      };
      
      console.log('👤 Participant data:', participantData);
      console.log('💾 Saving participant to Firebase...');
      
      await set(participantRef, participantData);
      console.log('✅ Participant joined successfully!');
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in joinEvent:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * מסיר משתתף מהאירוע
   */
  static async leaveEvent(eventId: string, userId: string): Promise<void> {
    console.group('👋 FirebaseService.leaveEvent');
    console.log('📥 Input parameters:', { eventId, userId });
    
    try {
      const participantRef = ref(database, `events/${eventId}/participants/${userId}`);
      await remove(participantRef);
      console.log('✅ Participant left successfully');
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in leaveEvent:', error);
      console.groupEnd();
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
    console.group('📋 FirebaseService.createAssignment');
    console.log('📥 Input parameters:', { eventId, assignmentData });
    
    try {
      await this.ensureEventStructure(eventId);
      
      // Check that the item is not already assigned
      const menuItemRef = ref(database, `events/${eventId}/menuItems/${assignmentData.menuItemId}`);
      const snapshot = await get(menuItemRef);
      
      if (snapshot.val()?.assignedTo) {
        throw new Error('מצטערים, מישהו אחר כבר הספיק לשבץ את הפריט הזה');
      }
      
      const newAssignmentRef = push(ref(database, `events/${eventId}/assignments`));
      const updates: { [key: string]: any } = {};
      
      // Add the assignment
      updates[`events/${eventId}/assignments/${newAssignmentRef.key}`] = assignmentData;
      
      // Update item as assigned
      updates[`events/${eventId}/menuItems/${assignmentData.menuItemId}/assignedTo`] = assignmentData.userId;
      updates[`events/${eventId}/menuItems/${assignmentData.menuItemId}/assignedToName`] = assignmentData.userName;
      updates[`events/${eventId}/menuItems/${assignmentData.menuItemId}/assignedAt`] = Date.now();
      
      await update(ref(database), updates);
      console.log('✅ Assignment created successfully');
      console.groupEnd();
      
      return newAssignmentRef.key!;
    } catch (error) {
      console.error('❌ Error in createAssignment:', error);
      console.groupEnd();
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
  console.group('📝 FirebaseService.updateAssignment (Enhanced)');
  console.log('📥 Input parameters:', { eventId, assignmentId, updates });
  
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
          console.log(`👤 Name change detected for user ${currentUserId}: "${currentUserName}" -> "${updates.userName}"`);

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
                console.log(`🔄 Queued name update for assignment: ${anId}`);

                const menuItemId = allAssignments[anId].menuItemId;
                if (menuItemId) {
                  dbUpdates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = updates.userName;
                  console.log(`🔗 Queued name update for linked menu item (assignedToName): ${menuItemId}`);
                }
              }
            }

            // *** START OF THE FIX ***
            // Iterate through all menu items to update creatorName.
            for (const menuItemId in allMenuItems) {
              if (allMenuItems[menuItemId].creatorId === currentUserId) {
                dbUpdates[`events/${eventId}/menuItems/${menuItemId}/creatorName`] = updates.userName;
                console.log(`✍️ Queued name update for created menu item (creatorName): ${menuItemId}`);
              }
            }
            // *** END OF THE FIX ***
          }
        } else {
           // If only quantity/notes changed, or name is the same, update just in case.
           dbUpdates[`${assignmentPath}/userName`] = updates.userName;
           const menuItemId = assignmentData.menuItemId;
           if (menuItemId) {
              dbUpdates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = updates.userName;
           }
        }
      }
    }

    console.log('💾 Applying atomic batch updates:', dbUpdates);
    // Perform a single, atomic update for all changes.
    await update(ref(database), dbUpdates);

    console.log('✅ Assignment(s) updated successfully');
    console.groupEnd();
  } catch (error) {
    console.error('❌ Error in updateAssignment:', error);
    console.groupEnd();
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
    console.group('❌ FirebaseService.cancelAssignment');
    console.log('📥 Input parameters:', { eventId, assignmentId, menuItemId });
    
    try {
      const updates: { [key: string]: null } = {};
      
      // Delete the assignment
      updates[`events/${eventId}/assignments/${assignmentId}`] = null;
      
      // Remove assignment from item
      updates[`events/${eventId}/menuItems/${menuItemId}/assignedTo`] = null;
      updates[`events/${eventId}/menuItems/${menuItemId}/assignedToName`] = null;
      updates[`events/${eventId}/menuItems/${menuItemId}/assignedAt`] = null;
      
      console.log('💾 Updates to apply:', updates);
      await update(ref(database), updates);
      console.log('✅ Assignment cancelled successfully');
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error in cancelAssignment:', error);
      console.groupEnd();
      throw error;
    }
  }

  // ===================================
  // Preset lists management
  // ===================================

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
      return () => {};
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
    console.group('🔍 FirebaseService.validateEventData');
    console.log('📥 Input parameters:', { eventId });
    
    const issues: string[] = [];
    
    try {
      const eventSnapshot = await get(ref(database, `events/${eventId}`));
      
      if (!eventSnapshot.exists()) {
        console.log('❌ Event does not exist');
        console.groupEnd();
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
        if(menuItem.assignedTo) {
          const assignmentExists = Object.values(assignments).some((a: any) => a.menuItemId === menuItemId && a.userId === menuItem.assignedTo);
          if (!assignmentExists) {
            issues.push(`פריט ${menuItemId} משובץ למשתמש ${menuItem.assignedToName} אך אין שיבוץ תואם`);
          }
        }
      });
      
      const isValid = issues.length === 0;
      console.log('🔍 Validation result:', { isValid, issues });
      console.groupEnd();
      
      return { isValid, issues };
    } catch (error) {
      console.error('❌ Error validating event data:', error);
      console.groupEnd();
      return { isValid: false, issues: ['שגיאה בבדיקת הנתונים'] };
    }
  }
}