// src/utils/presetLists.ts

/**
 * What a preset list is made of.
 *
 * A preset list belongs to the organiser and not to any one event. It is saved
 * once and loaded into several, and those events do not have the same
 * categories: the friday dinner has "main" and "starter", "on the fire" has
 * "meat" and "salads", and neither has the other's. So a preset row cannot
 * carry a category. It carries a name and a quantity, and which category it
 * lands in is decided at import, from the event being imported into, the same
 * way a file import decides it.
 *
 * It used to carry the five categories of the friday dinner. An organiser of
 * "on the fire" who loaded a list of twelve items got twelve items in
 * categories that event does not have, and the event page, which groups by the
 * event's own categories, showed none of them.
 * See DOCS/PLANING/79-preset-lists-carry-friday-dinner-categories.md.
 *
 * This module holds only that shape and nothing about the screen, which is what
 * makes it something a test can run.
 */

export interface PresetItem {
  name: string;
  quantity: number;
  notes?: string;
  isRequired: boolean;
}

/**
 * A preset list as it comes back from the database, read as what a preset list
 * is now.
 *
 * Lists saved before the change still have a category on every row, and they
 * have to keep loading. Reading them through here does two things at once: the
 * old field is left behind rather than carried forward into the next save, and
 * a row missing a quantity or a required flag, which the older screens allowed,
 * comes back with something usable instead of undefined.
 */
export const presetItemsAsWritten = (stored: unknown): PresetItem[] => {
  // A list is written as an array and usually comes back as one, but the
  // database keeps an array as numbered keys and hands back an object whenever
  // the numbers are not a run from zero. Reading only the array would silently
  // turn such a list into an empty one, which is losing somebody's list rather
  // than migrating it.
  const rows = Array.isArray(stored)
    ? stored
    : (stored && typeof stored === 'object' ? Object.values(stored as Record<string, unknown>) : []);
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map(row => {
      const item: PresetItem = {
        name: typeof row.name === 'string' ? row.name : '',
        quantity: typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1,
        isRequired: row.isRequired === true,
      };
      if (typeof row.notes === 'string' && row.notes) item.notes = row.notes;
      return item;
    });
};
