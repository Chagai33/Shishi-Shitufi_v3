import { ShishiEvent, CategoryConfig } from '../types';
import { TFunction } from 'i18next';

/**
 * Standard definition for the "Ride Offers" category.
 */
export const RIDE_OFFERS_CATEGORY_ID = 'ride_offers';
export const RIDE_REQUESTS_CATEGORY_ID = 'ride_requests';




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
  _itemName: string = '',
  categoryId: string = '',
  rowType?: 'needs' | 'offers'
): boolean => {
  const rideCategoryIds = ['ride_offers', 'ride_requests', 'trempim', 'rides'];

  // 1. Explicit Ride Category IDs (Highest Priority)
  if (rideCategoryIds.includes(categoryId)) {
    return true;
  }

  // 2. Only consider rowType if it's explicitly 'offers' or 'needs' AND 
  // we don't have a regular food/equipment category ID
  const foodCategoryIds = ['starter', 'main', 'dessert', 'drink', 'equipment', 'other'];
  if (foodCategoryIds.includes(categoryId)) {
    return false;
  }

  // 3. Fallback to rowType for custom categories that aren't food
  if (rowType === 'offers' || rowType === 'needs') {
    return true;
  }

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
  if (categoryId === 'trempim' || categoryId === 'ride_offers') return 'הצעות טרמפ';
  if (categoryId === 'ride_requests') return 'בקשות טרמפ';

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
