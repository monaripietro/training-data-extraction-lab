// In-memory experiment log with CSV/TSV export (RF6, decision D5). Pure
// module: no DOM, no network, no persistence. Texts are excluded by default.

export const NO_TEXT_COLUMNS = [
  'ora',
  'modalità',
  'modello',
  'variante',
  'id',
  'esatta',
  'token coincidenti',
];

export const TEXT_COLUMNS = [...NO_TEXT_COLUMNS, 'testo', 'output'];

export function addAttempt(log, attempt) {
  log.push({
    time: attempt.time ?? '',
    mode: attempt.mode ?? '',
    model: attempt.model ?? '',
    variant: attempt.variant ?? '',
    id: attempt.id ?? '',
    exactMatch: attempt.exactMatch ?? null,
    commonTokens: attempt.commonTokens ?? null,
    prompt: attempt.prompt ?? '',
    output: attempt.output ?? '',
  });
  return log;
}

export function neutralize(value) {
  const text = String(value);
  if (/^[=+\-@\t\r\n]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function valueOf(attempt, column) {
  switch (column) {
    case 'ora':
      return attempt.time;
    case 'modalità':
      return attempt.mode;
    case 'modello':
      return attempt.model;
    case 'variante':
      return attempt.variant;
    case 'id':
      return attempt.id;
    case 'esatta':
      return attempt.exactMatch === null || attempt.exactMatch === undefined
        ? ''
        : attempt.exactMatch
          ? 'sì'
          : 'no';
    case 'token coincidenti':
      return attempt.commonTokens === null || attempt.commonTokens === undefined
        ? ''
        : String(attempt.commonTokens);
    case 'testo':
      return attempt.prompt;
    case 'output':
      return attempt.output;
    default:
      return '';
  }
}

function csvField(value) {
  return `"${neutralize(value).replaceAll('"', '""')}"`;
}

export function toCSV(log, { includeTexts = false } = {}) {
  const columns = includeTexts ? TEXT_COLUMNS : NO_TEXT_COLUMNS;
  const lines = [columns.map((column) => csvField(column)).join(',')];
  for (const attempt of log) {
    lines.push(columns.map((column) => csvField(valueOf(attempt, column))).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function toTSV(log, { includeTexts = false } = {}) {
  const columns = includeTexts ? TEXT_COLUMNS : NO_TEXT_COLUMNS;
  const lines = [columns.join('\t')];
  for (const attempt of log) {
    lines.push(
      columns
        .map((column) =>
          neutralize(valueOf(attempt, column)).replace(/[\t\r\n]+/g, ' ')
        )
        .join('\t')
    );
  }
  return lines.join('\n');
}
