import test from 'node:test';
import assert from 'node:assert/strict';

import { createProgressTracker, formatBytes } from '../../site/lib/progress.js';

function feed(tracker, events) {
  return events.map((event) => tracker.update(event));
}

test('single file: percentage follows loaded/total of that file', () => {
  const tracker = createProgressTracker();
  const snapshots = feed(tracker, [
    { status: 'initiate', name: 'model', file: 'model.onnx' },
    { status: 'progress', name: 'model', file: 'model.onnx', progress: 50, loaded: 500, total: 1000 },
    { status: 'progress', name: 'model', file: 'model.onnx', progress: 100, loaded: 1000, total: 1000 },
    { status: 'done', name: 'model', file: 'model.onnx' },
  ]);
  assert.equal(snapshots[1].percent, 50);
  assert.equal(snapshots[2].percent, 99);
  assert.equal(snapshots[3].percent, 99);
});

test('small files complete before the big file: value never decreases nor exceeds 100', () => {
  const tracker = createProgressTracker();
  const events = [
    { status: 'initiate', name: 'model', file: 'config.json' },
    { status: 'progress', name: 'model', file: 'config.json', progress: 100, loaded: 700, total: 700 },
    { status: 'done', name: 'model', file: 'config.json' },
    { status: 'initiate', name: 'model', file: 'tokenizer.json' },
    { status: 'progress', name: 'model', file: 'tokenizer.json', progress: 100, loaded: 2_500_000, total: 2_500_000 },
    { status: 'done', name: 'model', file: 'tokenizer.json' },
    { status: 'initiate', name: 'model', file: 'model.onnx' },
  ];
  for (let step = 0; step <= 10; step += 1) {
    events.push({
      status: 'progress',
      name: 'model',
      file: 'model.onnx',
      progress: step * 10,
      loaded: (step * 10) * 700_000,
      total: 70_000_000,
    });
  }
  const percents = feed(tracker, events).map((snapshot) => snapshot.percent);
  for (let index = 1; index < percents.length; index += 1) {
    assert.ok(
      percents[index] >= percents[index - 1],
      `percent diminuito: ${percents[index - 1]} -> ${percents[index]}`
    );
  }
  assert.ok(percents.every((percent) => percent <= 100));
  assert.equal(tracker.finish().percent, 100);
});

test('events without total: only bytes are known and percent stays capped at 99', () => {
  const tracker = createProgressTracker();
  const snapshots = feed(tracker, [
    { status: 'progress', name: 'model', file: 'model.onnx', progress: 0, loaded: 1000, total: 0 },
    { status: 'progress', name: 'model', file: 'model.onnx', progress: 0, loaded: 500_000, total: 0 },
    { status: 'done', name: 'model', file: 'model.onnx' },
  ]);
  assert.equal(snapshots[0].hasUnknownTotal, true);
  assert.equal(snapshots[0].totalBytes, 0);
  assert.equal(snapshots[1].loadedBytes, 500_000);
  for (const snapshot of snapshots) {
    assert.ok(snapshot.percent <= 99);
  }
  assert.equal(tracker.finish().percent, 100);
});

test('initiate, download and done events do not change the snapshot', () => {
  const tracker = createProgressTracker();
  tracker.update({ status: 'progress', name: 'model', file: 'model.onnx', progress: 50, loaded: 50, total: 100 });
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
    file: 'model.onnx',
    progress: 100,
    loaded: 70_000_000,
    total: 70_000_000,
  });
  assert.equal(last.percent, 99);
  assert.equal(last.complete, false);
  const finished = tracker.finish();
  assert.equal(finished.percent, 100);
  assert.equal(finished.complete, true);
});

test('bytes larger than total are clamped to 100', () => {
  const tracker = createProgressTracker();
  tracker.update({ status: 'progress', name: 'model', file: 'model.onnx', progress: 100, loaded: 999, total: 100 });
  tracker.finish();
  assert.equal(tracker.snapshot().percent, 100);
});

test('formatBytes shows MB or kB', () => {
  assert.equal(formatBytes(500), '1 kB');
  assert.equal(formatBytes(29_500_000), '30 MB');
  assert.equal(formatBytes(70_000_000), '70 MB');
});

test('snapshot exposes coherent MB fields', () => {
  const tracker = createProgressTracker();
  const snapshot = tracker.update({
    status: 'progress',
    name: 'model',
    file: 'model_quantized.onnx',
    progress: 42,
    loaded: 30_000_000,
    total: 71_000_000,
  });
  assert.equal(snapshot.loadedMB, 30);
  assert.equal(snapshot.totalMB, 71);
  assert.equal(snapshot.percent, 42);
});
