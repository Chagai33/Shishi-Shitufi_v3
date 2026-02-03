// src/store/useStore.ts

import { create } from 'zustand';
import { User, ShishiEvent, MenuItem, Assignment, Participant } from '../types';

// Definition of the global application state - now it's simpler and adapted for Multi-Tenant
interface AppState {
  user: User | null; // The logged-in user (organizer or anonymous guest)
  currentEvent: ShishiEvent | null; // The specific event the user is currently viewing
  isLoading: boolean;
  isDeleteAccountModalOpen: boolean; // New state for account deletion modal

  // Actions to update the state
  setUser: (user: User | null) => void;
  setCurrentEvent: (event: ShishiEvent | null) => void;
  updateCurrentEventPartial: (updates: Partial<ShishiEvent>) => void; // NEW: For granular updates
  setLoading: (loading: boolean) => void;
  clearCurrentEvent: () => void;
  toggleDeleteAccountModal: () => void; // New action for modal management

  // Actions to update data within the current event
  updateMenuItem: (itemId: string, updates: Partial<MenuItem>) => void;
  addMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (itemId: string) => void;

  updateAssignment: (assignmentId: string, updates: Partial<Assignment>) => void;
  addAssignment: (assignment: Assignment) => void;
  deleteAssignment: (assignmentId: string) => void;

  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  currentEvent: null,
  isLoading: true, // Start in loading state
  isDeleteAccountModalOpen: false, // Initial state closed

  // Definition of basic actions
  setUser: (user) => set({ user }),

  // This action will now receive the complete event object from Firebase
  setCurrentEvent: (event) => set({ currentEvent: event, isLoading: false }),

  // NEW: Partial update for granular subscriptions (bandwidth optimization)
  // Safe initialization - creates base event if doesn't exist yet
  updateCurrentEventPartial: (updates) => set((state) => {
    if (!state.currentEvent) {
      // First data arriving - initialize with minimal structure
      return {
        currentEvent: {
          id: (updates as any).id || '',
          organizerId: '',
          organizerName: '',
          createdAt: 0,
          details: {} as any,
          menuItems: {},
          assignments: {},
          participants: {},
          userItemCounts: {},
          ...updates
        },
        isLoading: false
      };
    }
    
    return {
      currentEvent: { ...state.currentEvent, ...updates },
      isLoading: false
    };
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  // Action to clear current event data when leaving the page
  clearCurrentEvent: () => set({ currentEvent: null }),
  
  // New action for modal state management
  toggleDeleteAccountModal: () => set((state) => ({ isDeleteAccountModalOpen: !state.isDeleteAccountModalOpen })),


  // ===============================
  // Menu item update actions
  // ===============================

  updateMenuItem: (itemId, updates) => set((state) => {
    if (!state.currentEvent?.menuItems) return state;

    const updatedMenuItems = {
      ...state.currentEvent.menuItems,
      [itemId]: {
        ...state.currentEvent.menuItems[itemId],
        ...updates
      }
    };

    return {
      currentEvent: {
        ...state.currentEvent,
        menuItems: updatedMenuItems
      }
    };
  }),

  addMenuItem: (item) => set((state) => {
    if (!state.currentEvent) return state;

    const updatedMenuItems = {
      ...state.currentEvent.menuItems,
      [item.id]: {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes,
        isRequired: item.isRequired,
        creatorId: item.creatorId,
        creatorName: item.creatorName,
        createdAt: item.createdAt,
        assignedTo: item.assignedTo,
        assignedToName: item.assignedToName,
        assignedAt: item.assignedAt
      }
    };

    return {
      currentEvent: {
        ...state.currentEvent,
        menuItems: updatedMenuItems
      }
    };
  }),

  deleteMenuItem: (itemId) => set((state) => {
    if (!state.currentEvent?.menuItems) return state;

    const updatedMenuItems = { ...state.currentEvent.menuItems };
    delete updatedMenuItems[itemId];

    // Also delete all assignments related to this item
    const updatedAssignments = { ...state.currentEvent.assignments };
    Object.keys(updatedAssignments).forEach(assignmentId => {
      if (updatedAssignments[assignmentId].menuItemId === itemId) {
        delete updatedAssignments[assignmentId];
      }
    });

    return {
      currentEvent: {
        ...state.currentEvent,
        menuItems: updatedMenuItems,
        assignments: updatedAssignments
      }
    };
  }),

  // ===============================
  // Assignment update actions
  // ===============================

  updateAssignment: (assignmentId, updates) => set((state) => {
    if (!state.currentEvent?.assignments) return state;

    const updatedAssignments = {
      ...state.currentEvent.assignments,
      [assignmentId]: {
        ...state.currentEvent.assignments[assignmentId],
        ...updates
      }
    };

    return {
      currentEvent: {
        ...state.currentEvent,
        assignments: updatedAssignments
      }
    };
  }),

  addAssignment: (assignment) => set((state) => {
    if (!state.currentEvent) return state;

    const updatedAssignments = {
      ...state.currentEvent.assignments,
      [assignment.id]: {
        menuItemId: assignment.menuItemId,
        userId: assignment.userId,
        userName: assignment.userName,
        quantity: assignment.quantity,
        notes: assignment.notes,
        status: assignment.status,
        assignedAt: assignment.assignedAt
      }
    };

    return {
      currentEvent: {
        ...state.currentEvent,
        assignments: updatedAssignments
      }
    };
  }),

  deleteAssignment: (assignmentId) => set((state) => {
    if (!state.currentEvent?.assignments) return state;

    const updatedAssignments = { ...state.currentEvent.assignments };
    delete updatedAssignments[assignmentId];

    return {
      currentEvent: {
        ...state.currentEvent,
        assignments: updatedAssignments
      }
    };
  }),

  // ===============================
  // Participant update actions
  // ===============================

  addParticipant: (participant) => set((state) => {
    if (!state.currentEvent) return state;

    const updatedParticipants = {
      ...state.currentEvent.participants,
      [participant.id]: {
        name: participant.name,
        joinedAt: participant.joinedAt
      }
    };

    return {
      currentEvent: {
        ...state.currentEvent,
        participants: updatedParticipants
      }
    };
  }),

  removeParticipant: (participantId) => set((state) => {
    if (!state.currentEvent?.participants) return state;

    const updatedParticipants = { ...state.currentEvent.participants };
    delete updatedParticipants[participantId];

    return {
      currentEvent: {
        ...state.currentEvent,
        participants: updatedParticipants
      }
    };
  }),
}));

// ===============================
// Selectors - Adapted selectors
// ===============================

/**
 * סלקטור שמחזיר מערך של פריטי תפריט מהאירוע הנוכחי.
 */
export const selectMenuItems = (state: AppState): MenuItem[] => {
  const event = state.currentEvent;
  if (!event?.menuItems) return [];

  // Firebase returns an object, we convert it to an array and add the ID
  return Object.entries(event.menuItems).map(([id, item]) => ({
    ...(item as Omit<MenuItem, 'id'>),
    id,
    eventId: event.id, // Add event ID for convenience
  }));
};

/**
 * סלקטור שמחזיר מערך של שיבוצים מהאירוע הנוכחי.
 */
export const selectAssignments = (state: AppState): Assignment[] => {
  const event = state.currentEvent;
  if (!event?.assignments) return [];

  return Object.entries(event.assignments).map(([id, assignment]) => ({
    ...(assignment as Omit<Assignment, 'id'>),
    id,
  }));
};

/**
 * סלקטור שמחזיר מערך של משתתפים מהאירוע הנוכחי.
 */
export const selectParticipants = (state: AppState): Participant[] => {
    const event = state.currentEvent;
    if (!event?.participants) return [];

    return Object.entries(event.participants).map(([id, participant]) => ({
        ...(participant as Omit<Participant, 'id'>),
        id,
    }));
};

/**
 * 🚀 OPTIMIZATION: סלקטור שמחזיר assignments מאורגנים לפי menuItemId (O(1) lookup).
 * משפר ביצועים עבור רשימות גדולות - במקום O(n) filter לכל פריט.
 */
export const selectAssignmentsByItemId = (state: AppState): Map<string, Assignment[]> => {
  const event = state.currentEvent;
  if (!event?.assignments) return new Map();

  const map = new Map<string, Assignment[]>();
  
  Object.entries(event.assignments).forEach(([id, assignment]) => {
    const fullAssignment = { ...(assignment as Omit<Assignment, 'id'>), id };
    const menuItemId = fullAssignment.menuItemId;
    
    if (!map.has(menuItemId)) {
      map.set(menuItemId, []);
    }
    map.get(menuItemId)!.push(fullAssignment);
  });

  return map;
};