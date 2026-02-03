import { ShishiEvent, CategoryConfig } from '../types';
import { TFunction } from 'i18next';

/**
 * Standard definition for the "Trempim" (Rides) category.
 */
export const TREMPIM_CATEGORY_DEF: CategoryConfig = {
  id: 'trempim',
  name: 'טרמפים', // Hebrew display name
  icon: 'car.gif',
  color: '#34495e',
  order: 99, // Usually last, or dynamically handled
  rowType: 'offers'
};

/**
 * Regex for detecting carpool/ride sharing keywords in Hebrew and English.
 * @deprecated Ideally rely on category ID 'trempim' or rowType 'offers'
 */
export const CARPOOL_KEYWORDS_REGEX = /טרמפ|הסעה|ride|carpool|יציאה|רכב|מקום|נהג/i;

/**
 * Checks if a menu item or category represents a carpool/ride offer.
 * @param itemName Name of the item
 * @param categoryId ID of the category
 * @param rowType Optional rowType from category config
 */
export const isCarpoolLogic = (
  itemName: string = '',
  categoryId: string = '',
  rowType?: 'needs' | 'offers'
): boolean => {
  // 1. Explicit Category ID or Row Type (Strongest Signal)
  if (categoryId === 'trempim' || categoryId === 'rides' || rowType === 'offers') {
    return true;
  }

  // 2. Return false (Strict Mode - No Magic Regex)
  return false;
};

/**
 * Resolves the display name for a category, handling custom categories,
 * translations, and generic fallbacks.
 */
export const resolveCategoryDisplayName = (
  categoryId: string,
  event: ShishiEvent | undefined,
  eventCategories: CategoryConfig[],
  t: TFunction
): string => {
  // Special case for our internal constant ID, though it should usually be in eventCategories
  if (categoryId === 'trempim') return 'טרמפים';

  // 1. Try to find in the resolved event categories (handles custom names)
  const cat = eventCategories.find(c => c.id === categoryId);
  if (cat) return cat.name;

  // 2. Explicit check for custom IDs that might have been lost in hydration/sync
  if (categoryId && categoryId.startsWith('custom-')) {
    return event?.details?.categories?.find(c => c.id === categoryId)?.name || categoryId;
  }

  // 3. Fallback to standard translations
  const translated = t(`categories.${categoryId}`);
  return translated !== `categories.${categoryId}` ? translated : categoryId;
};
