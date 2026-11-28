import test from 'node:test';
import assert from 'node:assert/strict';

import { exactMatch, commonPrefixLength, segments } from '../../site/lib/compare.js';

const IDENTICAL = Array.from({ length: 32 }, (_, index) => 100 + index);
const FIRST_DIFFERENT = [999, ...IDENTICAL.slice(1)];
const LAST_DIFFERENT = [...IDENTICAL.slice(0, 31), 999];

test('identical sequences match exactly', () => {
  assert.equal(exactMatch(IDENTICAL, [...IDENTICAL]), true);
  assert.equal(commonPrefixLength(IDENTICAL, [...IDENTICAL]), 32);
});

test('a different first token gives no exact match and zero common prefix', () => {
  assert.equal(exactMatch(IDENTICAL, FIRST_DIFFERENT), false);
  assert.equal(commonPrefixLength(IDENTICAL, FIRST_DIFFERENT), 0);
});

test('a different last token gives no exact match and 31 common tokens', () => {
  assert.equal(exactMatch(IDENTICAL, LAST_DIFFERENT), false);
  assert.equal(commonPrefixLength(IDENTICAL, LAST_DIFFERENT), 31);
});

test('different lengths are not an exact match', () => {
  assert.equal(exactMatch(IDENTICAL, IDENTICAL.slice(0, 31)), false);
});

test('common prefix is limited by the shorter sequence', () => {
  assert.equal(commonPrefixLength([1, 2, 3], [1, 2, 3, 4, 5]), 3);
});

test('segments describe every token for the highlight', () => {
  const segmentList = segments(IDENTICAL, LAST_DIFFERENT);
  assert.equal(segmentList.length, 32);
  for (const segment of segmentList) {
    assert.equal(segment.expectedId, IDENTICAL[segment.index]);
    assert.equal(segment.generatedId, LAST_DIFFERENT[segment.index]);
    assert.equal(segment.equal, segment.expectedId === segment.generatedId);
  }
  assert.deepEqual(
    segmentList.filter((segment) => segment.equal).map((segment) => segment.index),
    Array.from({ length: 31 }, (_, index) => index)
  );
});

test('a missing generated token is reported as null and not equal', () => {
  const [segment] = segments(IDENTICAL, IDENTICAL.slice(0, 31)).slice(-1);
  assert.equal(segment.generatedId, null);
  assert.equal(segment.equal, false);
});
