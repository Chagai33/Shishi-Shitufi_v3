// measure-limits.mjs
//
// Counts what the live database actually holds, for planning record 57
// (DOCS/PLANING/57-central-limits-policy.md). Read only: it never writes.
//
// It prints numbers only. No item name, no participant name, no title and no
// address ever reaches the output, so the result can be pasted into a chat.
//
// Usage, from the project root:
//
//   node measure-limits.mjs
//
// That pulls the database with the Firebase CLI you are already logged into.
// If you would rather pull it yourself, or reuse a dump you already have:
//
//   firebase database:get / --project shishi-shitufimt > dump.json
//   node measure-limits.mjs dump.json
//
// The dump is not deleted and is not written anywhere by this script.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT = 'shishi-shitufimt';
const AI_TEXT_CAP = 2000; // functions/smartImport.js rejects text longer than this

function loadDatabase() {
  const fileArg = process.argv[2];
  if (fileArg) {
    console.log(`Reading dump from ${fileArg}`);
    return JSON.parse(readFileSync(fileArg, 'utf8'));
  }
  console.log(`Pulling the database with the Firebase CLI, project ${PROJECT}. This can take a moment.`);
  const raw = execSync(`firebase database:get / --project ${PROJECT}`, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

const len = (value) => (typeof value === 'string' ? [...value].length : 0);

function stats(numbers) {
  if (numbers.length === 0) return { count: 0, max: 0, p95: 0, median: 0, mean: 0, total: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  const total = sorted.reduce((sum, n) => sum + n, 0);
  return {
    count: sorted.length,
    max: sorted[sorted.length - 1],
    p95: at(0.95),
    median: at(0.5),
    mean: Math.round((total / sorted.length) * 10) / 10,
    total,
  };
}

function line(label, s) {
  console.log(
    `${label.padEnd(34)} n=${String(s.count).padStart(5)}  max=${String(s.max).padStart(7)}  p95=${String(
      s.p95
    ).padStart(6)}  median=${String(s.median).padStart(5)}  mean=${String(s.mean).padStart(7)}`
  );
}

function topFive(numbers) {
  return [...numbers].sort((a, b) => b - a).slice(0, 5).join(', ');
}

const db = loadDatabase() || {};
const events = db.events || {};
const users = db.users || {};

const eventIds = Object.keys(events);

// Per event counts
const itemCounts = [];
const participantCounts = [];
const assignmentCounts = [];
const categoryCounts = [];
const migrationBlobLengths = [];
const eventsOverAiCap = [];

// String lengths, by field
const titleLengths = [];
const locationLengths = [];
const descriptionLengths = [];
const itemNameLengths = [];
const itemNoteLengths = [];
const pickupLengths = [];
const categoryNameLengths = [];
const participantNameLengths = [];
const assignmentNoteLengths = [];
const phoneLengths = [];
const userNameLengths = [];

// Events per organizer
const eventsPerOrganizer = new Map();

// Dates. Nothing measured these before the ceiling on them was written, and they
// are the only two fields where an existing record could already be outside a
// new ceiling and would then be readable but not editable.
const MONTHS_AHEAD = 12;
const horizon = new Date();
horizon.setUTCMonth(horizon.getUTCMonth() + MONTHS_AHEAD);
const horizonIso = horizon.toISOString().slice(0, 10);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

let eventsWithEndDate = 0;
const datesBeyondHorizon = [];
const endDatesBeyondHorizon = [];
const endBeforeStart = [];
const malformedDates = [];

for (const eventId of eventIds) {
  const event = events[eventId] || {};
  const details = event.details || {};
  const items = event.menuItems || {};
  const participants = event.participants || {};
  const assignments = event.assignments || {};
  const categories = Array.isArray(details.categories) ? details.categories : [];

  const itemList = Object.values(items);

  itemCounts.push(itemList.length);
  participantCounts.push(Object.keys(participants).length);
  assignmentCounts.push(Object.keys(assignments).length);
  categoryCounts.push(categories.length);

  titleLengths.push(len(details.title));
  locationLengths.push(len(details.location));
  if (details.description) descriptionLengths.push(len(details.description));

  for (const category of categories) categoryNameLengths.push(len(category?.name));

  for (const item of itemList) {
    itemNameLengths.push(len(item?.name));
    if (item?.notes) itemNoteLengths.push(len(item.notes));
    if (item?.pickupLocation) pickupLengths.push(len(item.pickupLocation));
    if (item?.phoneNumber) phoneLengths.push(len(item.phoneNumber));
  }

  for (const participant of Object.values(participants)) participantNameLengths.push(len(participant?.name));
  for (const assignment of Object.values(assignments)) {
    if (assignment?.notes) assignmentNoteLengths.push(len(assignment.notes));
    if (assignment?.phoneNumber) phoneLengths.push(len(assignment.phoneNumber));
  }

  // The exact string the smart migration builds and sends to the AI function.
  // src/components/Admin/EventForm.tsx: `${item.name} ${item.quantity}` joined by newlines.
  const blob = itemList.map((item) => `${item?.name ?? ''} ${item?.quantity ?? ''}`).join('\n');
  migrationBlobLengths.push(blob.length);
  if (blob.length > AI_TEXT_CAP) eventsOverAiCap.push({ items: itemList.length, chars: blob.length });

  const date = details.date;
  const endDate = details.endDate;
  if (endDate) eventsWithEndDate += 1;

  for (const [label, value] of [['date', date], ['endDate', endDate]]) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || !ISO_DATE.test(value)) {
      malformedDates.push(label);
      continue;
    }
    if (value > horizonIso) (label === 'date' ? datesBeyondHorizon : endDatesBeyondHorizon).push(value);
  }
  if (typeof date === 'string' && typeof endDate === 'string' && ISO_DATE.test(date) && ISO_DATE.test(endDate) && endDate < date) {
    endBeforeStart.push(1);
  }

  const organizer = event.organizerId || 'unknown';
  eventsPerOrganizer.set(organizer, (eventsPerOrganizer.get(organizer) || 0) + 1);
}

// The name on the user record, which is copied onto every event that person
// creates as its organizerName. It was declared here and never filled in, so
// this is the one name field in the product that had never been measured.
for (const user of Object.values(users)) {
  if (user?.name) userNameLengths.push(len(user.name));
}

const perOrganizer = [...eventsPerOrganizer.values()];

console.log('');
console.log('=== DATES, AGAINST A TWELVE MONTH CEILING ===================');
console.log(`events with an end date filled in  ${eventsWithEndDate}`);
console.log(`start dates beyond the ceiling     ${datesBeyondHorizon.length}`);
console.log(`end dates beyond the ceiling       ${endDatesBeyondHorizon.length}`);
console.log(`end dates before their start       ${endBeforeStart.length}`);
console.log(`dates that are not YYYY-MM-DD      ${malformedDates.length}`);
if (datesBeyondHorizon.length || endDatesBeyondHorizon.length || endBeforeStart.length || malformedDates.length) {
  console.log('');
  console.log('  ^ any of these above zero means an existing event would be');
  console.log('    readable but not editable once the ceiling is deployed.');
}

console.log('');
console.log('=== SCALE ===================================================');
console.log(`events                             ${eventIds.length}`);
console.log(`user records                       ${Object.keys(users).length}`);
console.log(`organizers with at least one event ${eventsPerOrganizer.size}`);
console.log('');

console.log('=== COUNTS PER EVENT ========================================');
line('items per event', stats(itemCounts));
line('participants per event', stats(participantCounts));
line('assignments per event', stats(assignmentCounts));
line('categories per event', stats(categoryCounts));
line('events per organizer', stats(perOrganizer));
console.log('');
console.log(`five largest events, by items       ${topFive(itemCounts)}`);
console.log(`five busiest organizers, by events  ${topFive(perOrganizer)}`);
console.log('');

console.log('=== TEXT LENGTHS, IN CHARACTERS =============================');
line('event title', stats(titleLengths));
line('event location', stats(locationLengths));
line('event description', stats(descriptionLengths));
line('item name', stats(itemNameLengths));
line('item note', stats(itemNoteLengths));
line('ride pickup location', stats(pickupLengths));
line('category name', stats(categoryNameLengths));
line('participant name', stats(participantNameLengths));
line('assignment note', stats(assignmentNoteLengths));
line('phone number', stats(phoneLengths));
line('user record name', stats(userNameLengths));
console.log('');
console.log(`five longest item names            ${topFive(itemNameLengths)}`);
console.log(`five longest event titles          ${topFive(titleLengths)}`);
console.log('');

console.log('=== THE SMART MIGRATION, AGAINST THE 2000 CHARACTER CAP =====');
line('migration text length per event', stats(migrationBlobLengths));
console.log(`events already over the cap        ${eventsOverAiCap.length}`);
if (eventsOverAiCap.length > 0) {
  for (const over of eventsOverAiCap) {
    console.log(`  broken today: ${over.items} items produce ${over.chars} characters`);
  }
}
const largestBlob = Math.max(0, ...migrationBlobLengths);
const largestEventItems = Math.max(0, ...itemCounts);
if (largestEventItems > 0 && largestBlob > 0) {
  const charsPerItem = largestBlob / largestEventItems;
  console.log(`characters per item, largest event ${Math.round(charsPerItem * 10) / 10}`);
  console.log(`items the cap allows at that rate  ${Math.floor(AI_TEXT_CAP / charsPerItem)}`);
}
console.log('');
