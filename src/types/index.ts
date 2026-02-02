// src/types/index.ts

/**
 * Represents a registered user in the system (event organizer).
 */
export interface User {
  id: string; // Firebase Auth UID
  name: string;
  email?: string;
  createdAt: number;
  isAdmin?: boolean;
}

export enum EventType {
  FRIDAY_DINNER = 'friday_dinner',
  BBQ = 'bbq',
  PICNIC = 'picnic',
  SCHOOL_PARTY = 'school_party',
  PARTY = 'party',
  DAIRY = 'dairy',
  TRIP = 'trip', // NEW: Carpool/Trip
  OTHER = 'other'
}

/**
 * Represents the core details of an event, as stored under event.details.
 */
export interface EventDetails {
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  isActive: boolean;
  allowUserItems?: boolean; // Whether to allow participants to add items
  userItemLimit?: number;   // User item limit
  categories?: CategoryConfig[]; // Custom categories for this event
  eventType?: EventType; // Added EventType
  endDate?: string;
  endTime?: string;
}

/**
 * Configuration for a single category.
 */
export interface CategoryConfig {
  id: string;        // e.g., "meat", "starter"
  name: string;      // Display name
  icon: string;      // Filename e.g., "meat.png"
  color: string;     // Hex code
  order: number;     // For sorting
  rowType?: 'needs' | 'offers'; // 'offers' changes UI to "Join/Reserve" model
}

/**
 * Represents a saved custom template for a user.
 */
export interface CustomTemplate {
  id: string;
  name: string;
  categories: CategoryConfig[];
  createdAt: number;
}

/**
 * Represents a menu item for a specific event.
 * Note that the eventId field is no longer needed, as the item is nested under the event.
 */
// export type MenuCategory = 'starter' | 'main' | 'dessert' | 'drink' | 'other' | 'equipment';
export type MenuCategory = string; // Changed to string to support dynamic categories

export interface MenuItem {
  id: string;
  eventId: string; // Added event ID for convenience
  name: string;
  category: string; // Was MenuCategory

  quantity: number;
  notes?: string;
  isRequired: boolean;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  isSplittable?: boolean; // If true, multiple users can sign up for partial quantities
  // Assignment fields are stored directly on the item for easy access
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: number;
  rowType?: 'needs' | 'offers';
}


/**
 * Represents an assignment of a user to an item.
 */
export interface Assignment {
  id: string;
  eventId: string; // Added event ID
  menuItemId: string;
  userId: string;
  userName: string;
  quantity: number;
  notes?: string;
  status: 'confirmed' | 'pending' | 'completed';
  assignedAt: number;
  updatedAt?: number;
}


/**
 * מייצג משתתף שנרשם לאירוע.
 */
export interface Participant {
  id: string; // Firebase Auth UID (can belong to an anonymous user)
  name: string;
  joinedAt: number;
}

/**
 * Represents the complete event object, as stored in the database.
 * This is the main object that contains all information about a single event in the flat model.
 */
export interface ShishiEvent {
  id: string; // The unique identifier of the event
  organizerId: string;
  organizerName: string;
  createdAt: number;
  updatedAt?: number;
  details: EventDetails;
  menuItems: { [key: string]: Omit<MenuItem, 'id' | 'eventId'> };
  assignments: { [key: string]: Omit<Assignment, 'id' | 'eventId'> };
  participants: { [key: string]: Omit<Participant, 'id'> };
  userItemCounts?: { [key: string]: number };

}

// Types for the global Store (Zustand)
export interface AppState {
  user: User | null; // The logged-in user (always an organizer)
  organizerEvents: ShishiEvent[]; // List of the organizer's events (for the dashboard)
  currentEvent: ShishiEvent | null; // The specific event the user is currently viewing
  isLoading: boolean;
}