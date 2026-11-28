import test from 'node:test';
import assert from 'node:assert/strict';

import { createProgressTracker, formatBytes, isModelFile } from '../../site/lib/progress.js';

function feed(tracker, events) {
  return events.map((event) => tracker.update(event));
}

function percents(snapshots) {
  return snapshots.map((snapshot) => snapshot.percent);
}

function modelFileEvents(totalBytes, steps) {
  const events = [];
  for (let step = 1; step <= steps; step += 1) {
    const loaded = Math.round((totalBytes * step) / steps);
    events.push({
      status: 'progress',
      name: 'model',
      file: 'onnx/model_quantized.onnx',
      progress: (step / steps) * 100,
      loaded,
      total: totalBytes,
    });
  }
  return events;
}

test('isModelFile recognises onnx weights only', () => {
  assert.equal(isModelFile('onnx/model_quantized.onnx'), true);
  assert.equal(isModelFile('model.onnx_data'), true);
  assert.equal(isModelFile('config.json'), false);
  assert.equal(isModelFile('tokenizer.json'), false);
  assert.equal(isModelFile(null), false);
});

test('realistic sequence: preparing first, then the download of the onnx file', () => {
  const tracker = createProgressTracker();
  const events = [
    { status: 'initiate', name: 'model', file: 'config.json' },
    { status: 'progress', name: 'model', file: 'config.json', progress: 100, loaded: 700, total: 700 },
    { status: 'done', name: 'model', file: 'config.json' },
    { status: 'progress', name: 'model', file: 'tokenizer.json', progress: 100, loaded: 2_500_000, total: 2_500_000 },
    { status: 'done', name: 'model', file: 'tokenizer.json' },
    { status: 'initiate', name: 'model', file: 'onnx/model_quantized.onnx' },
    ...modelFileEvents(71_000_000, 10),
  ];
  const snapshots = feed(tracker, events);
  const values = percents(snapshots);
  assert.deepEqual(values.slice(0, 5), [null, null, null, null, null]);
  const modelPhase = values.slice(5);
  for (let index = 1; index < modelPhase.length; index += 1) {
    assert.ok(
      modelPhase[index] >= modelPhase[index - 1],
      `la percentuale è scesa: ${modelPhase[index - 1]} -> ${modelPhase[index]}`
    );
  }
  assert.equal(modelPhase[5], 50);
  assert.equal(snapshots.at(-1).percent, 99);
  assert.equal(tracker.finish().percent, 100);
});

test('the percentage follows the onnx file, not the tokenizer files', () => {
  const tracker = createProgressTracker();
  const snapshots = feed(tracker, [
    { status: 'progress', name: 'model', file: 'tokenizer.json', progress: 100, loaded: 2_500_000, total: 2_500_000 },
    { status: 'progress', name: 'model', file: 'onnx/model_quantized.onnx', progress: 10, loaded: 7_100_000, total: 71_000_000 },
  ]);
  assert.equal(snapshots[0].percent, null);
  assert.equal(snapshots[1].percent, 10);
});

test('files already cached: no progress events, finish goes straight to 100', () => {
  const tracker = createProgressTracker();
  assert.equal(tracker.snapshot().percent, null);
  assert.equal(tracker.snapshot().modelStarted, false);
  const finished = tracker.finish();
  assert.equal(finished.percent, 100);
  assert.equal(finished.complete, true);
});

test('onnx events without total keep the preparing state', () => {
  const tracker = createProgressTracker();
  const snapshots = feed(tracker, [
    { status: 'progress', name: 'model', file: 'onnx/model_quantized.onnx', progress: 0, loaded: 1_000, total: 0 },
    { status: 'progress', name: 'model', file: 'onnx/model_quantized.onnx', progress: 0, loaded: 500_000, total: 0 },
  ]);
  assert.equal(snapshots[0].modelStarted, true);
  assert.equal(snapshots[0].percent, null);
  assert.equal(snapshots[1].loadedBytes, 500_000);
  assert.equal(tracker.finish().percent, 100);
});

test('initiate, download and done events do not change the snapshot', () => {
  const tracker = createProgressTracker();
  tracker.update({
    status: 'progress',
    name: 'model',
    file: 'onnx/model_quantized.onnx',
    progress: 50,
    loaded: 35_500_000,
    total: 71_000_000,
  });
  const before = tracker.snapshot();
  feed(tracker, [
    { status: 'initiate', name: 'model', file: 'other.json' },
    { status: 'download', name: 'model', file: 'other.json' },
    { status: 'done', name: 'model', file: 'other.json' },
  ]);
  assert.deepEqual(tracker.snapshot(), before);
});

test('the 100 percent state only comes from finish()', () => {
  const tracker = createProgressTracker();
  const last = tracker.update({
    status: 'progress',
    name: 'model',
    file: 'onnx/model.onnx',
    progress: 100,
    loaded: 71_000_000,
    total: 71_000_000,
  });
  assert.equal(last.percent, 99);
  assert.equal(last.complete, false);
  assert.equal(tracker.finish().percent, 100);
});

test('bytes larger than total are clamped', () => {
  const tracker = createProgressTracker();
  tracker.update({
    status: 'progress',
    name: 'model',
    file: 'onnx/model.onnx',
    progress: 100,
    loaded: 999,
    total: 100,
  });
  tracker.finish();
  assert.equal(tracker.snapshot().percent, 100);
});

test('formatBytes shows MB or kB', () => {
  assert.equal(formatBytes(500), '1 kB');
  assert.equal(formatBytes(29_500_000), '30 MB');
  assert.equal(formatBytes(70_000_000), '70 MB');
});
