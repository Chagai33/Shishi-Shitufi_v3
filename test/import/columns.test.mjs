// Reading a spreadsheet that was not built for us.
//
// Every case here is a real file, built in this file and read back through the
// same two libraries the product uses, because the question is what those
// libraries hand over and not what they are documented to hand over.
//
// The first case is the file a product owner uploaded on 30/08/2026. On the old
// code it imported three items called Chagai, Leah and Elisheva, and lost a
// fourth row without saying so. See
// DOCS/PLANING/73-file-import-assumes-a-fixed-column-order.md.
//
// It needs no emulator. Run it with:
//   node --test test/import/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { mapRows, countRowsWithData, looksMisdecoded } from '../../src/utils/importColumns.ts';

/** A sheet, through the same reader the product uses, as rows. */
function sheetRows(aoa) {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const readBack = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(readBack.Sheets[readBack.SheetNames[0]], { header: 1 });
}

/** The same, through the CSV reader. */
const csvRows = (text) => Papa.parse(text).data;

const names = (result) => result.rows.map((r) => r.name);
const quantities = (result) => result.rows.map((r) => r.quantity);

describe('the file the product owner uploaded', () => {
  // שם, מה מביא, כמות. Three people, three items, three quantities, and a
  // fourth row whose data sits further along with nothing in the first column.
  const AOA = [
    ['שם', 'מה מביא', 'כמות'],
    ['חגי', 'בננות', 10],
    ['לאה', 'אבטיח', 1],
    ['אלישבע', 'תפוחים', 33],
    [, , , , , 'זאת שבצד', 'סלט', 5],
  ];

  const CSV =
    'שם,מה מביא,כמות\n' +
    'חגי,בננות,10\n' +
    'לאה,אבטיח,1\n' +
    'אלישבע,תפוחים,33\n' +
    ',,,,,זאת שבצד,סלט,5\n';

  test('is read as a list of items, not as a list of people', () => {
    const result = mapRows(sheetRows(AOA));
    assert.equal(result.ok, true);
    assert.deepEqual(names(result), ['בננות', 'אבטיח', 'תפוחים']);
    assert.deepEqual(quantities(result), [10, 1, 33]);
  });

  test('the row with no name does not vanish, it is counted', () => {
    const result = mapRows(sheetRows(AOA));
    assert.equal(result.skippedRows, 1, 'the fourth row was dropped without being counted');
  });

  test('the column of people is reported as read and not used', () => {
    const result = mapRows(sheetRows(AOA));
    assert.deepEqual(result.mapping.ignoredColumns, ['שם']);
  });

  test('the same file as csv gives the same answer', () => {
    const fromSheet = mapRows(sheetRows(AOA));
    const fromCsv = mapRows(csvRows(CSV));
    assert.deepEqual(names(fromCsv), names(fromSheet));
    assert.deepEqual(quantities(fromCsv), quantities(fromSheet));
    assert.equal(fromCsv.skippedRows, fromSheet.skippedRows);
  });
});

describe('files that already worked keep working', () => {
  test('the documented order, with a header row', () => {
    const result = mapRows(sheetRows([
      ['שם פריט', 'כמות', 'הערות'],
      ['לחם', 2, 'פרוס'],
      ['חומוס', 1, ''],
    ]));
    assert.equal(result.ok, true);
    assert.equal(result.headerFound, true);
    assert.deepEqual(names(result), ['לחם', 'חומוס']);
    assert.deepEqual(quantities(result), [2, 1]);
    assert.equal(result.rows[0].notes, 'פרוס');
    assert.equal(result.rows[1].notes, undefined);
  });

  test('no header row at all is still read by position', () => {
    const result = mapRows(sheetRows([
      ['לחם', 2, 'פרוס'],
      ['חומוס', 1, ''],
    ]));
    assert.equal(result.ok, true);
    assert.equal(result.headerFound, false);
    assert.deepEqual(names(result), ['לחם', 'חומוס']);
    assert.deepEqual(quantities(result), [2, 1]);
  });

  test('english headers are read, and the header row is not imported as an item', () => {
    const result = mapRows(sheetRows([
      ['Item', 'Quantity', 'Notes'],
      ['Bread', 2, 'sliced'],
      ['Hummus', 1, ''],
    ]));
    assert.equal(result.ok, true);
    assert.deepEqual(names(result), ['Bread', 'Hummus']);
  });
});

describe('when the mapping does not recognise the file', () => {
  test('a header with no item name column stops, and says what it read', () => {
    const result = mapRows(sheetRows([
      ['טלפון', 'עיר', 'סכום'],
      ['050-1111111', 'חיפה', 30],
      ['050-2222222', 'תל אביב', 40],
    ]));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no-name-column');
    assert.deepEqual(result.headerCells, ['טלפון', 'עיר', 'סכום']);
  });

  test('it does not quietly fall back to reading by position', () => {
    // The old code imported the header row itself as an item called "טלפון".
    const result = mapRows(sheetRows([
      ['טלפון', 'עיר', 'סכום'],
      ['050-1111111', 'חיפה', 30],
    ]));
    assert.equal(result.ok, false, 'the file was read by position anyway');
  });
});

describe('choosing between columns that both could be the item', () => {
  test('what they bring beats a bare name', () => {
    const result = mapRows(sheetRows([['שם', 'מה מביא', 'כמות'], ['חגי', 'בננות', 3]]));
    assert.deepEqual(names(result), ['בננות']);
  });

  test('an explicit item column beats what they bring', () => {
    const result = mapRows(sheetRows([
      ['שם', 'מה מביא', 'שם פריט', 'כמות'],
      ['חגי', 'בננות', 'אבטיח', 3],
    ]));
    assert.deepEqual(names(result), ['אבטיח']);
    assert.deepEqual(result.mapping.ignoredColumns, ['שם', 'מה מביא']);
  });

  test('a bare name is the item when nothing better is offered', () => {
    const result = mapRows(sheetRows([['שם', 'כמות', 'הערות'], ['לחם', 2, 'פרוס']]));
    assert.deepEqual(names(result), ['לחם']);
  });
});

describe('the edges that cost an item if they are wrong', () => {
  test('a headerless file whose first item is called פריט keeps that item', () => {
    // One recognised word is not enough to call a row a header, because a row
    // with a bare number in it is data.
    const result = mapRows(sheetRows([['פריט', 2, ''], ['לחם', 1, '']]));
    assert.equal(result.headerFound, false);
    assert.deepEqual(names(result), ['פריט', 'לחם']);
  });

  test('a header wrapped in right to left marks is still recognised', () => {
    const result = mapRows(sheetRows([
      ['‏שם פריט‏', 'כמות ', 'הערות'],
      ['לחם', 2, 'פרוס'],
    ]));
    assert.equal(result.ok, true);
    assert.equal(result.headerFound, true);
    assert.deepEqual(names(result), ['לחם']);
    assert.deepEqual(quantities(result), [2]);
  });

  test('an empty row in the middle is not counted as a loss', () => {
    const result = mapRows(sheetRows([
      ['שם פריט', 'כמות'],
      ['לחם', 2],
      [],
      ['חומוס', 1],
    ]));
    assert.equal(result.skippedRows, 0);
    assert.deepEqual(names(result), ['לחם', 'חומוס']);
  });

  test('a file with no quantity column gives every item a quantity of one', () => {
    const result = mapRows(sheetRows([['שם פריט', 'הערות'], ['לחם', 'פרוס']]));
    assert.deepEqual(quantities(result), [1]);
    assert.equal(result.rows[0].notes, 'פרוס');
  });
});

describe('counting rows for the ceiling', () => {
  test('a stretched sheet range is not counted as thousands of rows', () => {
    // What a sheet looks like after somebody has scrolled and deleted. The
    // library reports the declared range, so a raw row count would refuse a two
    // item file.
    const worksheet = XLSX.utils.aoa_to_sheet([['שם פריט', 'כמות'], ['לחם', 2]]);
    worksheet['!ref'] = 'A1:C5000';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const readBack = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(readBack.Sheets.Sheet1, { header: 1 });

    assert.ok(rows.length > 4000, 'the fixture is not actually a stretched sheet');
    assert.equal(countRowsWithData(rows), 2);
  });
});

describe('a csv that was not saved as utf 8', () => {
  test('is recognised instead of being imported as rubbish', () => {
    // "שם פריט,כמות" and "לחם,2" as Excel writes them in a Hebrew locale.
    const eightBit = Buffer.from([
      0xf9, 0xed, 0x20, 0xf4, 0xf8, 0xe9, 0xe8, 0x2c, 0xeb, 0xee, 0xe5, 0xfa, 0x0a,
      0xec, 0xe7, 0xed, 0x2c, 0x32, 0x0a,
    ]);
    assert.equal(looksMisdecoded(eightBit.toString('utf8')), true);
  });

  test('and an ordinary hebrew file is not mistaken for one', () => {
    assert.equal(looksMisdecoded('שם פריט,כמות\nלחם,2\n'), false);
  });
});
