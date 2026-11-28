import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateEntries, mergeAndShuffle } from '../../site/lib/prefixes.js';

const FIXTURES = new URL('../fixtures/', import.meta.url);

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf-8'));
}

function validEntry(overrides = {}) {
  return {
    id: 'm01',
    type: 'memorized',
    split: 'duped.70m',
    index: 10,
    prefix_ids: Array.from({ length: 32 }, (_, i) => 100 + i),
    expected_ids: Array.from({ length: 32 }, (_, i) => 200 + i),
    prefix_text: 'testo inventato',
    expected_text: 'continuazione inventata',
    reviewed: true,
    notes: '',
    ...overrides,
  };
}

test('a valid entry passes validation', () => {
  const { entries, errors } = validateEntries([validEntry()]);
  assert.equal(errors.length, 0);
  assert.equal(entries.length, 1);
});

test('an entry with 31 prefix ids is rejected', () => {
  const { entries, errors } = validateEntries([
    validEntry({ id: 'm31', prefix_ids: validEntry().prefix_ids.slice(0, 31) }),
  ]);
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /m31/);
});

test('an entry with missing ids is rejected', () => {
  const raw = validEntry();
  delete raw.prefix_ids;
  const { errors } = validateEntries([raw]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /prefisso/);
});

test('an entry that is not reviewed is rejected', () => {
  const { errors } = validateEntries([validEntry({ reviewed: false })]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /riveduta/);
});

test('both forms of reproduced_pytorch are accepted', () => {
  const booleanForm = validateEntries([validEntry({ reproduced_pytorch: true })]);
  const objectForm = validateEntries([
    validEntry({ reproduced_pytorch: { duped: true, deduped: false } }),
  ]);
  const invalidForm = validateEntries([validEntry({ reproduced_pytorch: 'si' })]);
  assert.equal(booleanForm.errors.length, 0);
  assert.equal(objectForm.errors.length, 0);
  assert.equal(invalidForm.errors.length, 1);
});

test('an invalid type is rejected', () => {
  const { errors } = validateEntries([validEntry({ type: 'unknown' })]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /tipo/);
});

test('the fixtures from tests/fixtures validate as expected', () => {
  const valid = validateEntries(loadFixture('prefixes_valid.json'));
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.entries.length, 2);
  const invalid = validateEntries(loadFixture('prefixes_invalid.json'));
  assert.deepEqual(invalid.entries.map((entry) => entry.id), ['m01', 'm02']);
  assert.equal(invalid.errors.length, 2);
});

test('mergeAndShuffle is deterministic for the same seed', () => {
  const memorized = loadFixture('prefixes_valid.json');
  const controls = loadFixture('controls_valid.json');
  const first = mergeAndShuffle(memorized, controls, 'seed-di-prova');
  const second = mergeAndShuffle(memorized, controls, 'seed-di-prova');
  assert.deepEqual(first, second);
  const other = mergeAndShuffle(memorized, controls, 'altro-seed');
  assert.notDeepEqual(first, other);
});

test('mergeAndShuffle keeps every entry and assigns uniform visible ids', () => {
  const memorized = loadFixture('prefixes_valid.json');
  const controls = loadFixture('controls_valid.json');
  const merged = mergeAndShuffle(memorized, controls, 42);
  assert.equal(merged.length, memorized.length + controls.length);
  assert.deepEqual(
    merged.map((entry) => entry.visibleId),
    ['p01', 'p02', 'p03', 'p04']
  );
  assert.equal(new Set(merged.map((entry) => entry.id)).size, 4);
});

test('no visible id reveals the entry type', () => {
  const memorized = loadFixture('prefixes_valid.json');
  const controls = loadFixture('controls_valid.json');
  const merged = mergeAndShuffle(memorized, controls, 42);
  for (const entry of merged) {
    assert.match(entry.visibleId, /^p\d\d$/);
    assert.doesNotMatch(entry.visibleId, /m|c|memorized|control/i);
  }
});

test('the original id is preserved for the trainer view', () => {
  const merged = mergeAndShuffle(loadFixture('prefixes_valid.json'), [], 7);
  assert.deepEqual(merged.map((entry) => entry.id), ['m01', 'm02']);
});
