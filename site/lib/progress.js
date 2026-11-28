// Pure tracker for the download progress of a model load (RF1).
//
// Verified against the Transformers.js 3.8.1 source (src/utils/hub.js): the
// progress_callback receives, per file,
//   { status: 'initiate' | 'download' | 'done', name, file }
// and, while the bytes flow,
//   { status: 'progress', name, file, progress, loaded, total }
// where `progress` is already a 0-100 percentage and `loaded`/`total` are
// byte counts (`total` can be 0 when the server sends no Content-Length).
//
// The percentage is computed only over the model files (`file` ending in
// `.onnx` or `.onnx_data`): the tokenizer and configuration files are
// negligible compared to the ONNX weights, and counting them would push the
// percentage to its maximum before the real download even starts. Before the
// first `progress` event of a model file the percentage is null and the
// caller shows a preparation state with the downloaded bytes. Inside the
// model phase the reported value never decreases and stays below 100 until
// the caller confirms that from_pretrained has resolved (`finish()`), which
// also covers the fully cached case where no progress event arrives at all.

export const CAP_WHEN_UNFINISHED = 99;

export function isModelFile(file) {
  return (
    typeof file === 'string' &&
    (file.endsWith('.onnx') || file.endsWith('.onnx_data'))
  );
}

export function createProgressTracker() {
  const files = new Map();
  let floor = 0;
  let finished = false;

  function bytes() {
    let loaded = 0;
    let total = 0;
    let hasUnknownTotal = false;
    for (const entry of files.values()) {
      loaded += entry.loaded;
      if (entry.total > 0) {
        total += entry.total;
      } else if (entry.loaded > 0) {
        hasUnknownTotal = true;
      }
    }
    return { loaded, total, hasUnknownTotal };
  }

  function modelBytes() {
    let loaded = 0;
    let total = 0;
    let started = false;
    for (const entry of files.values()) {
      if (!entry.isModel) {
        continue;
      }
      started = true;
      loaded += entry.loaded;
      total += entry.total;
    }
    return { loaded, total, started };
  }

  function snapshot() {
    const { loaded, total, hasUnknownTotal } = bytes();
    const model = modelBytes();
    let percent = null;
    if (finished) {
      percent = 100;
    } else if (model.started && model.total > 0) {
      percent = Math.min((model.loaded / model.total) * 100, CAP_WHEN_UNFINISHED);
      percent = Math.max(Math.min(Math.round(percent), CAP_WHEN_UNFINISHED), floor);
      floor = percent;
    }
    return {
      percent,
      modelStarted: model.started,
      loadedBytes: loaded,
      totalBytes: total,
      modelLoadedBytes: model.loaded,
      modelTotalBytes: model.total,
      loadedMB: Math.round(loaded / 1_000_000),
      totalMB: total > 0 ? Math.round(total / 1_000_000) : 0,
      hasUnknownTotal,
      complete: finished,
    };
  }

  function update(event) {
    if (event?.status === 'progress' && typeof event.file === 'string') {
      const entry = files.get(event.file) ?? {
        loaded: 0,
        total: 0,
        isModel: isModelFile(event.file),
      };
      if (typeof event.loaded === 'number') {
        entry.loaded = event.loaded;
      }
      if (typeof event.total === 'number' && event.total > 0) {
        entry.total = event.total;
      }
      files.set(event.file, entry);
    }
    return snapshot();
  }

  function finish() {
    finished = true;
    return snapshot();
  }

  return { update, snapshot, finish };
}

export function formatBytes(bytes) {
  const megabytes = bytes / 1_000_000;
  if (megabytes >= 1) {
    return `${Math.round(megabytes)} MB`;
  }
  return `${Math.max(Math.round(bytes / 1000), 0)} kB`;
}
