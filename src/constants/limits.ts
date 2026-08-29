import limits from './limits.json';

/**
 * Every limit the product enforces, in one place.
 *
 * The numbers live in limits.json rather than here because two things have to
 * agree on them and only one of them is TypeScript: the screens read them from
 * this module, and database.rules.json carries the same numbers written out by
 * hand, because a rules file cannot import anything.
 *
 * That is a split waiting to happen, so it is tested. test/rules/limits.test.mjs
 * reads both files and fails if a number appears in one and not the other. The
 * day the two drift is the day a person types something the screen accepts and
 * the server refuses, with no explanation either side.
 *
 * The numbers themselves were set against what the database actually held on
 * 26/08/2026, and every one of them sits clearly above the largest real value,
 * so nothing that exists today is cut off by them. A ceiling is there to stop a
 * flood, not to trim real data.
 * See DOCS/PLANING/57-central-limits-policy.md.
 */

/** How many items one event may hold, whoever adds them. */
export const ITEMS_PER_EVENT = limits.itemsPerEvent;

/** How many events one organizer may have. */
export const EVENTS_PER_ORGANIZER = limits.eventsPerOrganizer;

/**
 * How many lifts one person may offer, and ask for, in one event.
 *
 * Two rather than one because a round trip is two items: the ride form writes
 * the outward leg and the return leg as two separate rides.
 * See DOCS/PLANING/64-item-quota-can-be-walked-around.md.
 */
export const RIDES_PER_PERSON = limits.ridesPerPerson;

/**
 * How far ahead an event may be set, in months, on the start date and on the
 * optional end date alike.
 *
 * It is a limit on what goes in rather than on what is kept, which is why it
 * was chosen over deleting old records: a clock that deletes can come for an
 * event that has not happened yet, and a ceiling on the date cannot.
 * See DOCS/PLANING/65-end-date-is-written-and-never-read.md.
 */
export const MONTHS_AHEAD = limits.monthsAhead;

/**
 * How long each piece of text may be, in characters.
 *
 * Characters and not bytes: that was an open question about the rule language
 * and it was measured, because every Hebrew letter is two bytes and had the
 * answer been bytes then every number here would have meant half of itself for
 * the people who actually use this.
 *
 * These are also the numbers the input fields carry as maxLength, so that
 * nobody can type past a ceiling and be refused by the server afterwards.
 */
export const EVENT_TITLE_MAX = limits.eventTitle;
export const EVENT_LOCATION_MAX = limits.eventLocation;
export const EVENT_DESCRIPTION_MAX = limits.eventDescription;
export const CATEGORY_NAME_MAX = limits.categoryName;
export const ITEM_NAME_MAX = limits.itemName;
export const ITEM_NOTE_MAX = limits.itemNote;
export const PERSON_NAME_MAX = limits.personName;
export const PHONE_NUMBER_MAX = limits.phoneNumber;
export const PICKUP_LOCATION_MAX = limits.pickupLocation;
