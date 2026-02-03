import { CategoryConfig, ShishiEvent, EventType } from '../types';

// ============================================================================
// PRESET DEFINITIONS - ISRAELI EVENT TYPES
// ============================================================================

export const RIDE_OFFERS_CATEGORY: CategoryConfig = {
  id: 'ride_offers',
  name: 'הצעות טרמפ (נהגים)',
  icon: 'car.gif',
  color: '#34495e',
  order: 90,
  rowType: 'offers'
};

export const RIDE_REQUESTS_CATEGORY: CategoryConfig = {
  id: 'ride_requests',
  name: 'בקשות טרמפ (נוסעים)',
  icon: 'car.gif',
  color: '#8e44ad',
  order: 91,
  rowType: 'needs'
};

export const FRIDAY_DINNER_CATEGORIES: CategoryConfig[] = [
  { id: 'starter', name: 'מנה ראשונה', icon: '2.gif', color: '#3498db', order: 1 },
  { id: 'main', name: 'מנה עיקרית', icon: '1.gif', color: '#009688', order: 2 },
  { id: 'dessert', name: 'קינוח', icon: '3.gif', color: '#9b59b6', order: 3 },
  { id: 'drink', name: 'שתייה', icon: '4.gif', color: '#2ecc71', order: 4 },
  { id: 'equipment', name: 'ציוד', icon: 'cutlery.gif', color: '#f39c12', order: 5 },
  { id: 'other', name: 'אחר', icon: '5.gif', color: '#95a5a6', order: 6 },
];

export const BBQ_CATEGORIES: CategoryConfig[] = [
  { id: 'meat', name: 'בשר', icon: 'meat.gif', color: '#e74c3c', order: 1 },
  { id: 'salads', name: 'סלטים', icon: 'salad.gif', color: '#27ae60', order: 2 },
  { id: 'pitas', name: 'פיתות/לחם', icon: 'pitas.gif', color: '#f1c40f', order: 3 },
  { id: 'equipment', name: 'ציוד', icon: 'grill.gif', color: '#d35400', order: 4 },
  { id: 'drinks', name: 'שתייה', icon: 'drinks.gif', color: '#3498db', order: 5 },
  { id: 'general', name: 'כללי/אחר', icon: 'wave.gif', color: '#7f8c8d', order: 6 },
];

export const PICNIC_CATEGORIES: CategoryConfig[] = [
  { id: 'finger_food', name: 'נשנושים/אוכל', icon: 'pitas.gif', color: '#e74c3c', order: 1 },
  { id: 'equipment', name: 'ציוד שטח', icon: 'tent.gif', color: '#27ae60', order: 2 },
  { id: 'drinks', name: 'שתייה', icon: 'drinks.gif', color: '#3498db', order: 3 },
  { id: 'general', name: 'כללי', icon: 'wave.gif', color: '#95a5a6', order: 4 },
];

export const SCHOOL_PARTY_CATEGORIES: CategoryConfig[] = [
  { id: 'food', name: 'אוכל/חטיפים', icon: 'snacks.gif', color: '#e67e22', order: 1 },
  { id: 'healthy', name: 'ירקות/פירות', icon: '2.gif', color: '#27ae60', order: 2 },
  { id: 'drinks', name: 'שתייה', icon: 'drinks.gif', color: '#3498db', order: 3 },
  { id: 'equipment', name: 'ציוד/מתנות', icon: 'gifts.gif', color: '#f39c12', order: 4 },
];

export const PARTY_CATEGORIES: CategoryConfig[] = [
  { id: 'alcohol', name: 'אלכוהול', icon: '4.gif', color: '#8e44ad', order: 1 },
  { id: 'food', name: 'אוכל מהיר', icon: 'pitas.gif', color: '#e74c3c', order: 2 },
  { id: 'atmosphere', name: 'אווירה', icon: 'audience.png', color: '#f1c40f', order: 3 },
];

export const DAIRY_CATEGORIES: CategoryConfig[] = [
  { id: 'dairy', name: 'גבינות/מאפים', icon: '1.gif', color: '#f1c40f', order: 1 }, // Fallback to 1.gif as 'cheeses' likely doesn't exist
  { id: 'salads', name: 'סלטים', icon: 'salad.gif', color: '#27ae60', order: 2 },
  { id: 'sweets', name: 'מתוקים/שתייה', icon: '3.gif', color: '#9b59b6', order: 3 },
];

export const TRIP_CATEGORIES: CategoryConfig[] = [
  { ...RIDE_OFFERS_CATEGORY, order: 1 },
  { ...RIDE_REQUESTS_CATEGORY, order: 2 },
  { id: 'food', name: 'אוכל ושתייה', icon: '1.gif', color: '#e67e22', order: 3 },
  { id: 'equipment', name: 'ציוד', icon: 'tent.gif', color: '#27ae60', order: 4 },
];

// Map EventType to Presets
export const EVENT_PRESETS: Record<EventType, { name: string; categories: CategoryConfig[] }> = {
  [EventType.FRIDAY_DINNER]: { name: 'ארוחת שישי', categories: FRIDAY_DINNER_CATEGORIES },
  [EventType.BBQ]: { name: 'על האש', categories: BBQ_CATEGORIES },
  [EventType.PICNIC]: { name: 'פיקניק/טיול', categories: PICNIC_CATEGORIES },
  [EventType.SCHOOL_PARTY]: { name: 'מסיבת כיתה', categories: SCHOOL_PARTY_CATEGORIES },
  [EventType.PARTY]: { name: 'מסיבה/חברים', categories: PARTY_CATEGORIES },
  [EventType.DAIRY]: { name: 'ארוחה חלבית', categories: DAIRY_CATEGORIES },
  [EventType.TRIP]: { name: 'טיול/נסיעה', categories: TRIP_CATEGORIES },
  [EventType.OTHER]: { name: 'ללא קטגוריות', categories: [] },
};

// Backwards Compatibility Mapping
export const DEFAULT_CATEGORIES = FRIDAY_DINNER_CATEGORIES;
export const TEMPLATES = {
  DEFAULT: EVENT_PRESETS[EventType.FRIDAY_DINNER],
  BBQ: EVENT_PRESETS[EventType.BBQ],
  PICNIC: EVENT_PRESETS[EventType.PICNIC],
};

/**
 * Returns the categories for a specific event.
 * If the event has custom categories (New System), it returns them.
 * If not (Legacy Event), it returns the default Friday Dinner categories.
 */
export const getEventCategories = (event: ShishiEvent | undefined): CategoryConfig[] => {
  let categories: CategoryConfig[] = [];

  if (!event) {
    categories = [...DEFAULT_CATEGORIES];
  } else if (event.details.categories && event.details.categories.length > 0) {
    categories = [...event.details.categories];
  } else {
    categories = [...DEFAULT_CATEGORIES];
  }

  // Inject Ride Categories if enabled but missing (for Card display/Selector)
  if (event) {
    if (event.details.allowRideOffers !== false && !categories.some(c => c.id === 'ride_offers')) {
      categories.push({ ...RIDE_OFFERS_CATEGORY, order: 20 });
    }
    if (event.details.allowRideRequests === true && !categories.some(c => c.id === 'ride_requests')) {
      categories.push({ ...RIDE_REQUESTS_CATEGORY, order: 21 });
    }
  }

  return categories.sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Helper to get category details by ID for a given event
 */
export const getCategoryById = (categoryId: string, event: ShishiEvent): CategoryConfig | undefined => {
  const categories = getEventCategories(event);
  return categories.find(c => c.id === categoryId);
};

export const AVAILABLE_ICONS = [
  '1.gif', '2.gif', '3.gif', '4.gif', '5.gif',
  'apple.png', 'audience.png', 'car.gif', 'cutlery.gif',
  'drinks.gif', 'gifts.gif', 'google-maps.png', 'grill.gif',
  'meat.gif', 'pitas.gif', 'salad.gif', 'snacks.gif',
  'tent.gif', 'trash.gif', 'wave.gif', 'waze.png'
];
