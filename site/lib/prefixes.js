// Reading and validation of prefixes.json and controls.json (RF0, RF5, RF7).
// Pure module: no DOM, no network, no storage.

export const PREFIX_LENGTH = 32;
export const EXPECTED_LENGTH = 32;
export const VALID_TYPES = ['memorized', 'control'];

function isIntegerArray(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((token) => Number.isInteger(token))
  );
}

function isReproducedPytorch(value) {
  if (typeof value === 'boolean') {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.duped === 'boolean' &&
    typeof value.deduped === 'boolean'
  );
}

export function validateEntries(json) {
  const errors = [];
  const entries = [];
  if (!Array.isArray(json)) {
    return { entries, errors: ['il file non contiene un elenco di voci'] };
  }
  json.forEach((raw, position) => {
    const entryErrors = validateEntry(raw, position);
    if (entryErrors.length === 0) {
      entries.push({ ...raw });
    } else {
      errors.push(...entryErrors);
    }
  });
  return { entries, errors };
}

function validateEntry(raw, position) {
  const label =
    raw && typeof raw.id === 'string' && raw.id ? raw.id : `voce ${position + 1}`;
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return [`${label}: la voce non è un oggetto valido`];
  }
  if (typeof raw.id !== 'string' || raw.id === '') {
    errors.push(`${label}: manca l'id originale`);
  }
  if (!VALID_TYPES.includes(raw.type)) {
    errors.push(`${label}: il tipo "${raw.type ?? ''}" non è valido`);
  }
  if (!isIntegerArray(raw.prefix_ids, PREFIX_LENGTH)) {
    errors.push(`${label}: servono ${PREFIX_LENGTH} ID di prefisso interi`);
  }
  if (!isIntegerArray(raw.expected_ids, EXPECTED_LENGTH)) {
    errors.push(`${label}: servono ${EXPECTED_LENGTH} ID di continuazione interi`);
  }
  if (raw.reviewed !== true) {
    errors.push(`${label}: la voce non è riveduta (reviewed diverso da true)`);
  }
  if (typeof raw.prefix_text !== 'string' || typeof raw.expected_text !== 'string') {
    errors.push(`${label}: manca il testo del prefisso o della continuazione`);
  }
  if ('reproduced_pytorch' in raw && !isReproducedPytorch(raw.reproduced_pytorch)) {
    errors.push(
      `${label}: reproduced_pytorch deve essere un booleano o un oggetto {duped, deduped}`
    );
  }
  return errors;
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seedValue) {
  let state = seedValue;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function mergeAndShuffle(memorized, controls, seed) {
  const combined = [...memorized, ...controls];
  const random = mulberry32(hashSeed(seed));
  for (let index = combined.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [combined[index], combined[swap]] = [combined[swap], combined[index]];
  }
  return combined.map((entry, index) => ({
    ...entry,
    visibleId: `p${String(index + 1).padStart(2, '0')}`,
  }));
}
