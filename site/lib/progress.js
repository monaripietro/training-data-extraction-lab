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
// The tracker keeps `loaded` and `total` per file (keyed by `file`) and
// reports the overall percentage as sum(loaded) / sum(total) * 100, rounded
// and clamped to [0, 100]. The reported value never decreases: small files
// that complete before the big ONNX file would otherwise pull it back down.
// While the load is not finished the value is capped at 99; the 100 % state
// is reached only when the caller confirms that from_pretrained has resolved.
// When the current file has no `total`, only its bytes are counted and the
// cap at 99 applies.

export const CAP_WHEN_UNFINISHED = 99;

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

  function snapshot() {
    const { loaded, total, hasUnknownTotal } = bytes();
    let percent;
    if (finished) {
      percent = 100;
    } else {
      percent = total > 0 ? Math.min((loaded / total) * 100, CAP_WHEN_UNFINISHED) : 0;
      percent = Math.max(Math.min(Math.round(percent), CAP_WHEN_UNFINISHED), floor);
      floor = percent;
    }
    return {
      percent,
      loadedBytes: loaded,
      totalBytes: total,
      loadedMB: Math.round(loaded / 1_000_000),
      totalMB: total > 0 ? Math.round(total / 1_000_000) : 0,
      hasUnknownTotal,
      complete: finished,
    };
  }

  function update(event) {
    if (event?.status === 'progress' && typeof event.file === 'string') {
      const entry = files.get(event.file) ?? { loaded: 0, total: 0 };
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
