import test from 'node:test';
import assert from 'node:assert/strict';

import { decodePerToken, visibleWhitespace, visibleTokenText } from '../../site/lib/tokens.js';

test('each token text is the difference of the cumulative decodings', () => {
  const decode = (ids) => ids.map((id) => ['a', 'b', 'c'][id]).join('');
  const texts = decodePerToken([0, 1, 2], decode);
  assert.deepEqual(texts, ['a', 'b', 'c']);
  assert.equal(texts.join(''), decode([0, 1, 2]));
});

test('a multibyte character split over two tokens does not become a replacement char', () => {
  const decode = (ids) => {
    const table = { 0: 'a', 1: 'é' };
    return ids.map((id) => table[id]).join('');
  };
  const texts = decodePerToken([0, 1], decode);
  assert.deepEqual(texts, ['a', 'é']);
  assert.equal(texts.join(''), 'aé');
});

test('a fragment rewritten by a later token is corrected in place', () => {
  const decode = (ids) => {
    if (ids.length === 0) {
      return '';
    }
    if (ids.length === 1) {
      return 'a\uFFFD';
    }
    return 'aé';
  };
  const texts = decodePerToken([7, 8], decode);
  assert.deepEqual(texts, ['a', 'é']);
  assert.equal(texts.join(''), 'aé');
});

test('an empty id list decodes to no tokens', () => {
  assert.deepEqual(decodePerToken([], () => 'x'), []);
});

test('visible whitespace marks spaces, tabs and newlines', () => {
  assert.equal(visibleWhitespace('a b\tc\nd'), 'a·b→c↵d');
  assert.equal(visibleWhitespace('a\r\nb'), 'a↵b');
});

test('visibleTokenText marks fragments and makes whitespace visible', () => {
  assert.equal(visibleTokenText(''), '◌');
  assert.equal(visibleTokenText(' '), '·');
  assert.equal(visibleTokenText('a\n'), 'a↵');
  assert.equal(visibleTokenText('abc'), 'abc');
});
