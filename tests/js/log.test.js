import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addAttempt,
  neutralize,
  toCSV,
  toTSV,
  NO_TEXT_COLUMNS,
  TEXT_COLUMNS,
} from '../../site/lib/log.js';

function sampleLog() {
  const log = [];
  addAttempt(log, {
    time: '2026-11-28T14:00:00.000Z',
    mode: 'B',
    model: 'pythia-70m',
    variant: 'q8',
    id: 'm01',
    exactMatch: true,
    commonTokens: 32,
    prompt: 'TESTO-SEGRETO-PREFISSO',
    output: 'TESTO-SEGRETO-CONTINUAZIONE',
  });
  addAttempt(log, {
    time: '2026-11-28T14:01:00.000Z',
    mode: 'A',
    model: 'pythia-70m-deduped',
    variant: 'fp32',
    id: '',
    exactMatch: null,
    commonTokens: null,
    prompt: '=SUM(A1)',
    output: 'prima riga\nseconda riga con "virgolette"',
  });
  return log;
}

test('addAttempt normalizes the attempt fields', () => {
  const log = addAttempt([], { mode: 'A' });
  assert.equal(log.length, 1);
  assert.deepEqual(
    Object.keys(log[0]).sort(),
    ['time', 'mode', 'model', 'variant', 'id', 'exactMatch', 'commonTokens', 'prompt', 'output'].sort()
  );
});

test('neutralize prefixes formula starters only', () => {
  assert.equal(neutralize('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(neutralize('+x'), "'+x");
  assert.equal(neutralize('-x'), "'-x");
  assert.equal(neutralize('@x'), "'@x");
  assert.equal(neutralize('\tx'), "'\tx");
  assert.equal(neutralize('\nx'), "'\nx");
  assert.equal(neutralize('testo normale'), 'testo normale');
  assert.equal(neutralize(32), '32');
});

test('toCSV starts with the BOM and quotes every field', () => {
  const csv = toCSV(sampleLog(), { includeTexts: true });
  assert.ok(csv.startsWith('﻿'));
  const rows = csv.slice(1).split('\r\n');
  assert.equal(
    rows[0],
    TEXT_COLUMNS.map((column) => `"${column}"`).join(',')
  );
  assert.equal(
    rows[2],
    [
      '"2026-11-28T14:01:00.000Z"',
      '"A"',
      '"pythia-70m-deduped"',
      '"fp32"',
      '""',
      '""',
      '""',
      `"'=SUM(A1)"`,
      '"prima riga\nseconda riga con ""virgolette"""',
    ].join(',')
  );
});

test('toCSV keeps newlines inside quoted fields', () => {
  const csv = toCSV(sampleLog(), { includeTexts: true });
  assert.ok(csv.includes('"prima riga\nseconda riga con ""virgolette"""'));
});

test('texts are excluded by default (D5)', () => {
  const csv = toCSV(sampleLog());
  assert.ok(!csv.includes('TESTO-SEGRETO'));
  const header = csv.slice(1).split('\r\n')[0];
  assert.equal(header, NO_TEXT_COLUMNS.map((column) => `"${column}"`).join(','));
  assert.ok(!header.includes('"testo"'));
  assert.ok(!header.includes('"output"'));
  assert.ok(toCSV(sampleLog(), { includeTexts: true }).includes('TESTO-SEGRETO'));
});

test('column order is the declared one', () => {
  assert.deepEqual(NO_TEXT_COLUMNS, [
    'ora',
    'modalità',
    'modello',
    'variante',
    'id',
    'esatta',
    'token coincidenti',
  ]);
  assert.deepEqual(TEXT_COLUMNS.slice(0, 7), NO_TEXT_COLUMNS);
  assert.deepEqual(TEXT_COLUMNS.slice(7), ['testo', 'output']);
});

test('toTSV replaces tabs and newlines with spaces', () => {
  const tsv = toTSV(sampleLog(), { includeTexts: true });
  const rows = tsv.split('\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[0], NO_TEXT_COLUMNS.join('\t') + '\ttesto\toutput');
  const lastRow = rows[2];
  assert.ok(!lastRow.includes('\n'));
  assert.ok(lastRow.includes('prima riga seconda riga con "virgolette"'));
  assert.ok(lastRow.includes("'=SUM(A1)"));
});

test('toTSV without texts keeps the id of the prefix', () => {
  const tsv = toTSV(sampleLog());
  const row = tsv.split('\n')[1];
  assert.ok(row.includes('m01'));
  assert.ok(!tsv.includes('TESTO-SEGRETO'));
  assert.ok(row.includes('sì'));
  assert.ok(row.includes('32'));
});
