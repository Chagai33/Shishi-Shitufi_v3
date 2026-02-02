import { ShishiEvent, CategoryConfig } from '../types';
import { TFunction } from 'i18next';

/**
 * Regex for detecting carpool/ride sharing keywords in Hebrew and English.
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
  const isRideName = CARPOOL_KEYWORDS_REGEX.test(itemName);
  return rowType === 'offers' || categoryId === 'rides' || isRideName;
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
