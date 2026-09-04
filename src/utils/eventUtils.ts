// Both of these are types and nothing else, and spelling them as types is what
// lets a test import this file: node strips a type-only import instead of trying
// to resolve it, and neither '../types' nor 'i18next' resolves under node.
// See test/import/categories.test.mjs.
import type { ShishiEvent, CategoryConfig } from '../types';
import type { TFunction } from 'i18next';

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
 * Where an item goes in this event when nobody chose a category for it.
 *
 * The event's own catch-all if it has one, otherwise its first category. Never
 * an id typed into the code: "on the fire" and "picnic" have no catch-all at
 * all, so a hardcoded value is not even in their list, and a dropdown handed a
 * value none of its options match displays the first option while still holding
 * the value. The organiser then reads one category and the database is given
 * another. That is the defect, and it has now been found on four screens.
 *
 * This is the rule ImportItemsModal has been applying since campaign 17, moved
 * here so that the screens share it rather than each carrying a copy.
 * See DOCS/PLANING/78-bulk-category-change-writes-a-category-the-event-does-not-have.md.
 */
export const getFallbackCategoryId = (categoryIds: string[]): string => {
  const catchAll = categoryIds.find(id => id === 'other' || id === 'general');
  return catchAll || categoryIds[0] || '';
};

/**
 * Which category an item form opens on.
 *
 * The category the screen asked for, when this event actually has it or when it
 * is a ride, and otherwise the event's own catch-all. Never an id typed into
 * the code.
 *
 * The participant item form used to open holding the literal 'main' whenever
 * the screen named no category, and "on the fire" has no such category. Nothing
 * on screen showed it: the grid of category buttons is drawn from the event, so
 * the value the form was holding appeared nowhere in it and simply left every
 * button unmarked. The participant could not have chosen that category and
 * never saw it, filled in a name and a quantity, and saved into a category the
 * event does not have, which is a category the board cannot draw.
 *
 * A ride the screen asks for is always honoured. The ride categories are only
 * added to an event's list while the organiser's ride switches are on, and the
 * older ids `trempim` and `rides` are never added at all, so asking whether the
 * event has one would send an offered lift to the catch-all.
 *
 * And the catch-all is taken over the list with the rides removed, because a
 * ride is not somewhere an ordinary item may start. "Trip" has no catch-all and
 * names ride offers first, so the fallback over its whole list is a lift.
 * See DOCS/PLANING/83-the-trip-template-hands-out-a-ride-category.md.
 * See DOCS/PLANING/82-participant-item-form-starts-from-a-hardcoded-category.md.
 */
export const getStartingCategoryId = (
  requestedCategoryId: string | undefined,
  eventCategoryIds: string[],
): string => {
  const requestIsReal =
    !!requestedCategoryId &&
    (eventCategoryIds.includes(requestedCategoryId) || isRideCategory(requestedCategoryId));
  if (requestIsReal) return requestedCategoryId as string;
  return getFallbackCategoryId(eventCategoryIds.filter(id => !isRideCategory(id)));
};

/**
 * The items of an event that a smart migration is allowed to touch.
 *
 * A migration moves items between the event's categories, and a ride has no
 * category it could be moved to. The ride categories are not stored on the
 * event, they are added to the list when a screen draws it, so the import
 * window, which reads the stored list, never had them in its allowed set. Every
 * ride was therefore unrecognised, and the rule that puts anything unrecognised
 * into the event's catch-all put it there. It stopped being a ride, stopped
 * appearing where people look for a lift, and started taking up its owner's
 * item quota instead of his ride quota, while its pickup point and phone number
 * stayed on a row that was no longer a ride.
 *
 * So a ride is not sent for analysis and not shown in the preview. It is not in
 * the list the write is given either, and the write keeps every item it was not
 * given, which is what leaves the ride in the database exactly as it was, with
 * the people who signed up for it.
 * See DOCS/PLANING/80-smart-migration-turns-rides-into-ordinary-items.md.
 */
export const itemsEnteringMigration = <T extends { category?: string }>(items?: T[]): T[] =>
  (items || []).filter(item => !isRideCategory(item.category));

/** One drawn group of items, and what the event has to say about it. */
export interface ItemCategoryGroup<T> {
  /** The id the items in this group actually hold. Never rewritten. */
  categoryId: string;
  /** The event's entry for that id, or null when the event has no such category. */
  category: CategoryConfig | null;
  /** True when the event does not have this category and it is not a ride. */
  isNotInEvent: boolean;
  items: T[];
}

/**
 * The items of a screen, in the groups it should draw, in the order it should
 * draw them.
 *
 * An item is grouped by the category it actually holds, always. The event's
 * categories decide order, name and colour, and they decide whether a group is
 * one the event has, but they never decide where an item goes. That is the whole
 * of the fix: the bulk items screen used to build its buckets from one list and
 * draw them from another, and anything the first list did not recognise went
 * into a bucket named by the literal 'other'. The second list only ever asked
 * for the event's own categories, so that bucket was drawn only by an event that
 * happened to own a category called 'other'. "On the fire" calls its catch-all
 * 'general' and "party" has none at all, so an item in a category the event does
 * not have was built into a group and never drawn: it could not be ticked, its
 * category could not be changed, and nothing said it was there. That is the only
 * screen where such items can be repaired in bulk. Here the groups that are
 * built and the groups that are drawn are one list, so the two cannot disagree.
 *
 * Two things this deliberately does not do. It does not move a stray item into
 * the event's catch-all, which would say the item sits somewhere it does not,
 * and that is the disease this branch closed in three other places. And it does
 * not merge the strays into one bucket: two foreign categories are two groups,
 * because saying otherwise about two items is a smaller version of the same lie,
 * and because on a wide screen the group header is the only place an item's
 * category is named at all.
 *
 * A ride is never marked as a category the event does not have. The ride
 * categories are not stored on the event, they are added when a screen draws the
 * list and only while the organiser's ride switches are on, and the older ids
 * `trempim` and `rides` are never added. Marking those as foreign would be the
 * other lie, the one the item card in this same screen was taught to avoid.
 *
 * The groups live in a Map and not in an object, which is not decoration: a
 * category called `toString` or `constructor` used to find an inherited value on
 * a plain object literal, take the branch that appends to it, and take the whole
 * screen down with it.
 * See DOCS/PLANING/89-an-item-in-an-unknown-category-is-invisible-in-the-bulk-screen.md.
 */
export const groupItemsByCategory = <T extends { category?: string }>(
  items: T[] | undefined,
  categories: CategoryConfig[] | undefined,
): ItemCategoryGroup<T>[] => {
  const groups = new Map<string, ItemCategoryGroup<T>>();

  const groupFor = (categoryId: string, category?: CategoryConfig): ItemCategoryGroup<T> => {
    const drawn = groups.get(categoryId);
    // Two categories sharing an id are one group, and the first one names it.
    if (drawn) return drawn;
    const group: ItemCategoryGroup<T> = {
      categoryId,
      category: category || null,
      isNotInEvent: !category && !isRideCategory(categoryId),
      items: [],
    };
    groups.set(categoryId, group);
    return group;
  };

  // The event's own categories first, in the order the event gives them, then
  // whatever else the items turn out to hold, in the order it turns up.
  (categories || []).forEach(category => groupFor(category.id, category));
  (items || []).forEach(item => groupFor(item.category || '').items.push(item));

  return [...groups.values()].filter(group => group.items.length > 0);
};

/**
 * The items that are in the event and not in any of its categories, which is
 * to say the items the event page does not show under any tile.
 *
 * The event page draws a tile per category of the event and hides a tile with
 * nothing in it, so an item in a category the event does not have is counted
 * toward no tile and shown under none. It is still in the database, still
 * counted in the heading, still found by search and by the assigned and
 * unassigned chips. It is just not where anybody looks.
 *
 * This is not a second rule. It is the one rule, `groupItemsByCategory` and
 * its `isNotInEvent`, read from the other side: not "which groups are foreign"
 * but "which items are in a foreign group". Three screens ask that question,
 * the dialog that changes an event's categories, the event page and the
 * dashboard card, and they have to agree with each other and with the bulk
 * items screen about which items those are. Handing each of them the grouping
 * function and a filter would be three chances to get the filter wrong.
 *
 * A ride is never left out, for the reason the grouping gives.
 * See DOCS/PLANING/94-the-category-change-dialog-promises-a-display-that-does-not-exist.md
 * and DOCS/PLANING/96-the-organiser-has-no-way-to-know-an-item-fell-out-of-the-event.md.
 */
export const itemsLeftOutOfEvent = <T extends { category?: string }>(
  items: T[] | undefined,
  categories: CategoryConfig[] | undefined,
): T[] =>
  groupItemsByCategory(items, categories)
    .filter(group => group.isNotInEvent)
    .flatMap(group => group.items);

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
