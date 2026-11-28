import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planRuns,
  modelLabel,
  summarize,
  toMarkdown,
  toTSV,
} from '../../site/lib/batch.js';

function fakeEntries() {
  return [
    {
      id: 'm01',
      type: 'memorized',
      split: 'duped.70m',
      prefix_ids: [1, 2],
      expected_ids: [3, 4],
      prefix_text: 'TESTO-SEGRETO-PREFISSO',
      expected_text: 'TESTO-SEGRETO-CONTINUAZIONE',
    },
    {
      id: 'm02',
      type: 'memorized',
      split: 'deduped.70m',
      prefix_ids: [5, 6],
      expected_ids: [7, 8],
      prefix_text: 'TESTO-SEGRETO-PREFISSO',
      expected_text: 'TESTO-SEGRETO-CONTINUAZIONE',
    },
    {
      id: 'c01',
      type: 'control',
      split: null,
      prefix_ids: [9, 10],
      expected_ids: [11, 12],
      prefix_text: 'TESTO-SEGRETO-PREFISSO',
      expected_text: 'TESTO-SEGRETO-CONTINUAZIONE',
    },
  ];
}

function fakeResults() {
  return [
    { id: 'm01', type: 'memorized', split: 'duped.70m', model: 'pythia-70m', variant: 'q8', exact: true, commonTokens: 32, timeMs: 100 },
    { id: 'm02', type: 'memorized', split: 'deduped.70m', model: 'pythia-70m-deduped', variant: 'q8', exact: false, commonTokens: 4, timeMs: 300 },
    { id: 'c01', type: 'control', split: null, model: 'pythia-70m', variant: 'q8', exact: false, commonTokens: 0, timeMs: 200 },
    { id: 'c01', type: 'control', split: null, model: 'pythia-70m-deduped', variant: 'q8', exact: false, commonTokens: 1, timeMs: 400 },
  ];
}

test('plan with the box off: each split on its own model, controls on both', () => {
  const runs = planRuns(fakeEntries(), { bothModels: false });
  assert.deepEqual(
    runs.map((run) => [run.entry.id, run.modelKey]),
    [
      ['m01', 'duped'],
      ['m02', 'deduped'],
      ['c01', 'duped'],
      ['c01', 'deduped'],
    ]
  );
});

test('plan with the box on: every entry runs on both models', () => {
  const runs = planRuns(fakeEntries(), { bothModels: true });
  assert.deepEqual(
    runs.map((run) => [run.entry.id, run.modelKey]),
    [
      ['m01', 'duped'],
      ['m01', 'deduped'],
      ['m02', 'duped'],
      ['m02', 'deduped'],
      ['c01', 'duped'],
      ['c01', 'deduped'],
    ]
  );
});

test('modelLabel maps keys to repository names', () => {
  assert.equal(modelLabel('duped'), 'pythia-70m');
  assert.equal(modelLabel('deduped'), 'pythia-70m-deduped');
});

test('summarize computes per split and model percentages, controls and times', () => {
  const summary = summarize(fakeResults());
  assert.deepEqual(summary.groups, [
    { split: 'deduped.70m', model: 'pythia-70m-deduped', exact: 0, total: 1 },
    { split: 'duped.70m', model: 'pythia-70m', exact: 1, total: 1 },
  ]);
  assert.equal(summary.controlsExact, 0);
  assert.equal(summary.controlRuns, 2);
  assert.equal(summary.averageMs, 250);
  assert.equal(summary.maxMs, 400);
});

test('toMarkdown includes the rows, the summary and the metadata', () => {
  const summary = summarize(fakeResults());
  const markdown = toMarkdown(fakeResults(), summary, {
    variant: 'q8',
    transformersVersion: '3.8.1',
    userAgent: 'TestBrowser/1.0',
    hardwareConcurrency: 8,
  });
  assert.match(markdown, /\| m01 \| memorized \| duped\.70m \| pythia-70m \| q8 \| sì \| 32\/32 \| 100 \|/);
  assert.match(markdown, /- duped\.70m su pythia-70m: esatte 1\/1 \(100 %\)/);
  assert.match(markdown, /- deduped\.70m su pythia-70m-deduped: esatte 0\/1 \(0 %\)/);
  assert.match(markdown, /- controlli: corrispondenze esatte 0 su 2/);
  assert.match(markdown, /- tempo di generazione: media 250 ms, massimo 400 ms/);
  assert.match(markdown, /- variante q8/);
  assert.match(markdown, /- Transformers\.js 3\.8\.1/);
  assert.match(markdown, /- user agent: TestBrowser\/1\.0/);
  assert.match(markdown, /- core logici: 8/);
});

test('the markdown output contains neither texts nor token id lists', () => {
  const summary = summarize(fakeResults());
  const markdown = toMarkdown(fakeResults(), summary, {});
  assert.ok(!markdown.includes('TESTO-SEGRETO'));
  assert.ok(!markdown.includes('prefix_text'));
  assert.ok(!markdown.includes('expected_text'));
  assert.ok(!/\[\d+,\s*\d+/.test(markdown));
});

test('the TSV output contains neither texts nor token id lists', () => {
  const tsv = toTSV(fakeResults());
  const lines = tsv.split('\n');
  assert.equal(lines.length, 5);
  assert.equal(
    lines[0],
    ['voce', 'tipo', 'split', 'modello', 'variante', 'esatta', 'token coincidenti', 'ms'].join('\t')
  );
  assert.equal(lines[1], ['m01', 'memorized', 'duped.70m', 'pythia-70m', 'q8', 'sì', '32', '100'].join('\t'));
  assert.ok(!tsv.includes('TESTO-SEGRETO'));
  assert.ok(!tsv.includes('prefix_text'));
  assert.ok(!tsv.includes('expected_text'));
  assert.ok(!/\[\d+,\s*\d+/.test(tsv));
});
