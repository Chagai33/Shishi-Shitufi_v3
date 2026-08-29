import { ShishiEvent, CategoryConfig } from '../types';
import { TFunction } from 'i18next';

/**
 * Standard definition for the "Ride Offers" category.
 */
export const RIDE_OFFERS_CATEGORY_ID = 'ride_offers';
export const RIDE_REQUESTS_CATEGORY_ID = 'ride_requests';

/**
 * The category names that count as a ride, in one place.
 *
 * There used to be several copies of this list and they had drifted: some held
 * four names, some three, and the database rules held a fourth combination. An
 * item in a name one list had and another did not was exempt from the item
 * quota on screen and counted against it on the server, so the button was live
 * and the write was refused. `trempim` and `rides` are older names kept because
 * existing events still use them.
 *
 * The split matters: the two ride switches on the event form govern offering a
 * ride and asking for one separately, so the rules ask about them separately
 * and so does the code here. Keep these in step with database.rules.json.
 * See DOCS/PLANING/31-rides-consume-the-item-quota.md.
 */
export const RIDE_OFFER_CATEGORY_IDS = ['ride_offers', 'trempim', 'rides'];
export const RIDE_REQUEST_CATEGORY_IDS = ['ride_requests'];
export const RIDE_CATEGORY_IDS = [...RIDE_OFFER_CATEGORY_IDS, ...RIDE_REQUEST_CATEGORY_IDS];

/** True when the category is one the product treats as a ride. */
export const isRideCategory = (categoryId?: string): boolean =>
  !!categoryId && RIDE_CATEGORY_IDS.includes(categoryId);

/**
 * How many lifts one person may offer, and ask for, in one event.
 *
 * The event screen has always said one of each and enforced it there; the
 * server did not, which is what let an ordinary item take the ride exemption
 * from the item quota without any limit at all.
 *
 * It is two rather than one because a round trip is two items: the ride form
 * writes the outward leg and the return leg as two separate rides, one after
 * the other, so a ceiling of one would create the first and refuse the second.
 *
 * Keep this in step with database.rules.json, the same way the category lists
 * above are. See DOCS/PLANING/64-item-quota-can-be-walked-around.md.
 */
export const RIDES_PER_PERSON = 2;




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
  // 1. Explicit Ride Category IDs (Highest Priority)
  if (isRideCategory(categoryId)) {
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
