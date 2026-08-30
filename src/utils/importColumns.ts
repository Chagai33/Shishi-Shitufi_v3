// src/utils/importColumns.ts

/**
 * Reading a spreadsheet of items, when the spreadsheet was not built for us.
 *
 * The import used to assume a fixed column order: name, quantity, notes. A real
 * file arrived on 30/08/2026 built as name, what they are bringing, quantity,
 * and the product read the people as the items. Three items were saved called
 * Chagai, Leah and Elisheva, with notes of 10, 1 and 33. A fourth row, whose
 * data sat further along in the sheet with nothing in the first column, was
 * skipped without a word: the screen said three items had loaded, and there
 * were four.
 *
 * So the columns are matched by what their headers say. This module holds only
 * that decision and nothing about the screen, which is what makes it something
 * a test can run. See DOCS/PLANING/73-file-import-assumes-a-fixed-column-order.md.
 *
 * The product decision this is built on is that the import takes items, not who
 * is bringing them. A "who brings" column is read only far enough to be sure it
 * is not the item name, and is then dropped. The sign-up sheet is still built
 * from the participants afterwards.
 */

export type ImportCell = string | number | null | undefined;
export type ImportRow = ImportCell[];

export interface ColumnMapping {
  /** Index of the column holding the item name. Always found, or there is no mapping. */
  name: number;
  /** Index of the quantity column, or -1 when the file has none. */
  quantity: number;
  /** Index of the notes column, or -1 when the file has none. */
  notes: number;
  /** Header text of every column that was read and then not used. */
  ignoredColumns: string[];
}

export interface MappedRow {
  name: string;
  quantity: number;
  notes?: string;
}

export type MapRowsResult =
  | {
    ok: true;
    /** False when the file had no header row and was read by position, as before. */
    headerFound: boolean;
    mapping: ColumnMapping;
    rows: MappedRow[];
    /** Rows that held something but nothing in the item name column. */
    skippedRows: number;
  }
  | {
    ok: false;
    /** The one thing that can stop the read: a header with no item name in it. */
    reason: 'no-name-column';
    /** What the header row actually said, so the screen can show it back. */
    headerCells: string[];
  };

/**
 * Header text as it is compared, which is not header text as it is displayed.
 *
 * The bidirectional marks matter and are not decoration: a Hebrew header saved
 * out of a spreadsheet regularly carries a right-to-left mark at each end, and
 * without stripping them "item name" does not equal "item name". Measured on a
 * real file, not assumed.
 */
const normalise = (cell: ImportCell): string =>
  String(cell ?? '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/ /g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[:"'״׳]+$/, '');

/**
 * The item name column, in three tiers, because one file can offer more than one
 * candidate and the wrong one costs the whole import.
 *
 * A header that says outright that it is the item wins. A header that says what
 * is being brought comes next, and that is the tier that reads the product
 * owner's file correctly: the column headed "what they bring" holds bananas,
 * watermelon and apples, which are exactly the items. A bare "name" is last,
 * because in a list of who brings what it is the person, and it is only the item
 * when nothing better is on offer.
 */
const NAME_EXPLICIT = new Set([
  'שם פריט', 'שם הפריט', 'פריט', 'הפריט', 'מוצר', 'שם המוצר', 'מנה',
  'item', 'item name', 'items', 'product', 'dish', 'food',
]);

const NAME_BRINGS = new Set([
  'מה מביא', 'מה מביאה', 'מה מביאים', 'מה להביא', 'מה מביאות', 'להביא',
  'what to bring', 'what they bring', 'bringing', 'brings',
]);

const NAME_BARE = new Set([
  'שם', 'תיאור', 'פירוט הפריט',
  'name', 'description',
]);

const QUANTITY = new Set([
  'כמות', 'כמה', 'יחידות', 'מספר', 'מס', 'כמות יחידות',
  'quantity', 'qty', 'amount', 'units', 'count', 'number',
]);

const NOTES = new Set([
  'הערות', 'הערה', 'פירוט', 'הסבר', 'תוספות',
  'notes', 'note', 'comments', 'comment', 'remarks', 'details',
]);

/**
 * Headers that name a person rather than a thing. They are listed so that a row
 * carrying one counts as a header row, and so that the column itself is never
 * mistaken for the item. Nothing is read out of them.
 */
const PERSON = new Set([
  'מי מביא', 'מי מביאה', 'מי מביאים', 'מי אחראי', 'שם מלא', 'שם המשתתף',
  'משתתף', 'משתתפת', 'אחראי', 'אחראית', 'טלפון', 'נייד', 'אימייל', 'מייל', 'דואל',
  'who', 'who brings', 'assigned', 'assignee', 'participant', 'person',
  'full name', 'phone', 'mobile', 'email', 'e mail',
]);

const ALL_KNOWN = [NAME_EXPLICIT, NAME_BRINGS, NAME_BARE, QUANTITY, NOTES, PERSON];

const isKnownHeader = (value: string) => ALL_KNOWN.some(set => set.has(value));

const isBlank = (cell: ImportCell) =>
  cell === null || cell === undefined || String(cell).trim() === '';

const looksNumeric = (cell: ImportCell) =>
  typeof cell === 'number' || /^\d+([.,]\d+)?$/.test(String(cell ?? '').trim());

/**
 * Is the first row a header row.
 *
 * Two conditions, and the second one is not obvious. A row is a header when at
 * least one of its cells is a header we recognise, and when none of its cells is
 * a bare number. Without the second condition a file with no header row at all
 * whose first item happens to be called "item" would lose that item, which is
 * the same class of silent loss this whole change exists to end.
 */
export function readHeader(row: ImportRow | undefined): ColumnMapping | null {
  if (!row || row.length === 0) return null;

  const cells = row.map(normalise);
  if (!cells.some(isKnownHeader)) return null;
  if (row.some(cell => !isBlank(cell) && looksNumeric(cell))) return null;

  const firstIn = (set: Set<string>) => cells.findIndex(cell => set.has(cell));

  const name = [NAME_EXPLICIT, NAME_BRINGS, NAME_BARE]
    .map(firstIn)
    .find(index => index >= 0) ?? -1;
  const quantity = firstIn(QUANTITY);
  const notes = firstIn(NOTES);

  const used = new Set([name, quantity, notes].filter(index => index >= 0));
  const ignoredColumns = row
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell, index }) => !used.has(index) && !isBlank(cell))
    .map(({ cell }) => String(cell).trim());

  return { name, quantity, notes, ignoredColumns };
}

/**
 * Turn the rows of a sheet into items.
 *
 * A file with a header row is read by its headers, and refused outright when
 * none of them looks like an item name. Falling quietly back to position in that
 * case is exactly what happened to the file that started this, so it does not
 * happen: the screen says the file was not read and why.
 *
 * A file with no header row at all is still read by position, name then quantity
 * then notes, exactly as before. Nobody whose file already worked has to do
 * anything.
 */
export function mapRows(rows: ImportRow[]): MapRowsResult {
  const header = readHeader(rows[0]);

  if (header && header.name < 0) {
    return {
      ok: false,
      reason: 'no-name-column',
      headerCells: (rows[0] || []).filter(cell => !isBlank(cell)).map(cell => String(cell).trim()),
    };
  }

  const mapping: ColumnMapping = header || { name: 0, quantity: 1, notes: 2, ignoredColumns: [] };
  const firstDataRow = header ? 1 : 0;

  const mapped: MappedRow[] = [];
  let skippedRows = 0;

  for (let i = firstDataRow; i < rows.length; i++) {
    const row = rows[i] || [];

    // A row with nothing in it is not lost data and is not worth reporting. A row
    // with something in it and nothing in the name column is both.
    if (row.every(isBlank)) continue;

    const rawName = mapping.name >= 0 ? row[mapping.name] : undefined;
    const name = String(rawName ?? '').trim();
    if (!name) {
      skippedRows++;
      continue;
    }

    const rawQuantity = mapping.quantity >= 0 ? row[mapping.quantity] : undefined;
    const quantity = isBlank(rawQuantity) ? 1 : parseInt(String(rawQuantity), 10) || 1;

    const rawNotes = mapping.notes >= 0 ? row[mapping.notes] : undefined;
    const notes = isBlank(rawNotes) ? undefined : String(rawNotes).trim();

    mapped.push({ name, quantity, notes });
  }

  return { ok: true, headerFound: !!header, mapping, rows: mapped, skippedRows };
}

/**
 * How many rows of the sheet actually hold anything.
 *
 * The ceiling counts these and not the rows the library reports, because a sheet
 * whose range was stretched by somebody scrolling reports thousands of rows over
 * two items. Measured: a two item file came back as five thousand rows.
 */
export function countRowsWithData(rows: ImportRow[]): number {
  return rows.filter(row => row && row.length > 0 && !row.every(isBlank)).length;
}

/**
 * Did decoding this text go wrong.
 *
 * Excel in a Hebrew locale saves "CSV" in an eight bit encoding, and only
 * "CSV UTF-8" comes out as UTF-8. The product reads as UTF-8, so the older file
 * arrives as replacement characters and every item name is rubbish. It used to
 * be saved that way in silence. One replacement character can be a stray byte;
 * a scattering of them is the encoding.
 */
export function looksMisdecoded(text: string): boolean {
  const replacements = (text.match(/�/g) || []).length;
  return replacements >= 3;
}
