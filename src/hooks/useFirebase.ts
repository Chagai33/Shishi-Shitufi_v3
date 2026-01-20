import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, off, push, set, update } from 'firebase/database';
import { database } from '../lib/firebase';
import { MenuItem, ShishiEvent, Assignment } from '../types';

/**
 * Hook למעקב אחר פריטי תפריט של אירוע ספציפי
 * @param eventId - מזהה האירוע
 * @returns רשימת פריטים, סטטוס טעינה ופונקציית cleanup
 */
export function useEventItems(eventId: string | null) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemsRef = ref(database, 'menuItems');
      
      const unsubscribe = onValue(itemsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            // Filter items by eventId
            const allItems: MenuItem[] = Object.values(data);
            const eventItems = allItems.filter(item => item.eventId === eventId);
            setItems(eventItems);
          } else {
            setItems([]);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error processing items data:', err);
          setError('שגיאה בעיבוד נתוני הפריטים');
          setLoading(false);
        }
      }, (err) => {
        console.error('Error listening to items:', err);
        setError('שגיאה בטעינת הפריטים');
        setLoading(false);
      });

      // Cleanup function
      return () => {
        off(itemsRef, 'value', unsubscribe);
      };
    } catch (err) {
      console.error('Error setting up items listener:', err);
      setError('שגיאה באתחול מאזין הפריטים');
      setLoading(false);
    }
  }, [eventId]);

  return { items, loading, error };
}

/**
 * פונקציה לשיבוץ משתמש לפריט
 * @param itemId - מזהה הפריט
 * @param userId - מזהה המשתמש
 * @param userName - שם המשתמש
 * @param note - הערה אופציונלית
 * @param quantity - כמות
 * @returns Promise<boolean> - האם הפעולה הצליחה
 */
export async function assignItem(
  itemId: string, 
  userId: string, 
  userName: string,
  note?: string,
  quantity: number = 1
): Promise<boolean> {
  try {
    const timestamp = Date.now();
    
    // Create new assignment
    const assignmentsRef = ref(database, 'assignments');
    const newAssignmentRef = push(assignmentsRef);
    
    const assignment: Omit<Assignment, 'id'> = {
      eventId: '', // Will be filled from the item
      menuItemId: itemId,
      userId,
      userName,
      quantity,
      notes: note,
      status: 'confirmed',
      assignedAt: timestamp,
      updatedAt: timestamp
    };

    // Save the assignment
    await set(newAssignmentRef, {
      ...assignment,
      id: newAssignmentRef.key
    });

    // Update item as assigned
    const itemRef = ref(database, `menuItems/${itemId}`);
    await update(itemRef, {
      assignedTo: userId,
      assignedToName: userName,
      assignedAt: timestamp
    });

    return true;
  } catch (error) {
    console.error('Error assigning item:', error);
    return false;
  }
}

/**
 * פונקציה ליצירת אירוע חדש
 * @param title - כותרת האירוע
 * @param date - תאריך האירוע (YYYY-MM-DD)
 * @param hostName - שם המארח
 * @param location - מיקום האירוע
 * @param time - שעת האירוע (HH:MM)
 * @returns Promise<string | null> - מזהה האירוע החדש או null במקרה של שגיאה
 */
export async function createEvent(
  title: string,
  date: string,
  hostName: string,
  location: string,
  time: string = '18:00'
): Promise<string | null> {
  try {
    if (!title.trim() || !date || !hostName.trim() || !location.trim()) {
      console.error('Missing required fields for event creation');
      return null;
    }

    const eventsRef = ref(database, 'events');
    const newEventRef = push(eventsRef);
    const timestamp = Date.now();

    const event: Omit<ShishiEvent, 'id'> = {
      title: title.trim(),
      date,
      time,
      location: location.trim(),
      hostId: 'admin', // Default to admin
      hostName: hostName.trim(),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await set(newEventRef, {
      ...event,
      id: newEventRef.key
    });

    return newEventRef.key;
  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
}

/**
 * Hook לטעינת כל האירועים
 * @returns רשימת אירועים, סטטוס טעינה ושגיאה
 */
export function useEvents() {
  const [events, setEvents] = useState<ShishiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const eventsRef = ref(database, 'events');
      
      const unsubscribe = onValue(eventsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const eventsArray: ShishiEvent[] = Object.values(data);
            // Sort by creation date (newest first)
            eventsArray.sort((a, b) => b.createdAt - a.createdAt);
            setEvents(eventsArray);
          } else {
            setEvents([]);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error processing events data:', err);
          setError('שגיאה בעיבוד נתוני האירועים');
          setLoading(false);
        }
      }, (err) => {
        console.error('Error listening to events:', err);
        setError('שגיאה בטעינת האירועים');
        setLoading(false);
      });

      // Cleanup function
      return () => {
        off(eventsRef, 'value', unsubscribe);
      };
    } catch (err) {
      console.error('Error setting up events listener:', err);
      setError('שגיאה באתחול מאזין האירועים');
      setLoading(false);
    }
  }, []);

  return { events, loading, error };
}

/**
 * Hook לטעינת שיבוצים של אירוע ספציפי
 * @param eventId - מזהה האירוע
 * @returns רשימת שיבוצים, סטטוס טעינה ושגיאה
 */
export function useEventAssignments(eventId: string | null) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assignmentsRef = ref(database, 'assignments');
      
      const unsubscribe = onValue(assignmentsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const allAssignments: Assignment[] = Object.values(data);
            const eventAssignments = allAssignments.filter(
              assignment => assignment.eventId === eventId
            );
            setAssignments(eventAssignments);
          } else {
            setAssignments([]);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error processing assignments data:', err);
          setError('שגיאה בעיבוד נתוני השיבוצים');
          setLoading(false);
        }
      }, (err) => {
        console.error('Error listening to assignments:', err);
        setError('שגיאה בטעינת השיבוצים');
        setLoading(false);
      });

      // Cleanup function
      return () => {
        off(assignmentsRef, 'value', unsubscribe);
      };
    } catch (err) {
      console.error('Error setting up assignments listener:', err);
      setError('שגיאה באתחול מאזין השיבוצים');
      setLoading(false);
    }
  }, [eventId]);

  return { assignments, loading, error };
}