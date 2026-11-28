// Pure planning and reporting for the batch run of mode B (issue #60, RF7).
// The tables produced here contain no model output text and no token ID
// lists (decision D1): they are safe to paste into docs/test-report.md.

export function planRuns(entries, { bothModels = false } = {}) {
  const runs = [];
  for (const entry of entries) {
    let modelKeys;
    if (bothModels || entry.type === 'control') {
      modelKeys = ['duped', 'deduped'];
    } else if (entry.split === 'deduped.70m') {
      modelKeys = ['deduped'];
    } else {
      modelKeys = ['duped'];
    }
    for (const modelKey of modelKeys) {
      runs.push({ entry, modelKey });
    }
  }
  return runs;
}

export function modelLabel(modelKey) {
  return modelKey === 'deduped' ? 'pythia-70m-deduped' : 'pythia-70m';
}

export function summarize(results) {
  const groups = new Map();
  let controlsExact = 0;
  let controlRuns = 0;
  const times = [];
  for (const row of results) {
    times.push(row.timeMs);
    if (row.type === 'control') {
      controlRuns += 1;
      if (row.exact) {
        controlsExact += 1;
      }
    } else {
      const key = `${row.split}|${row.model}`;
      const group = groups.get(key) ?? {
        split: row.split,
        model: row.model,
        exact: 0,
        total: 0,
      };
      group.total += 1;
      if (row.exact) {
        group.exact += 1;
      }
      groups.set(key, group);
    }
  }
  const list = [...groups.values()].sort(
    (first, second) =>
      `${first.split}|${first.model}`.localeCompare(`${second.split}|${second.model}`)
  );
  return {
    groups: list,
    controlsExact,
    controlRuns,
    averageMs: times.length
      ? Math.round(times.reduce((total, value) => total + value, 0) / times.length)
      : 0,
    maxMs: times.length ? Math.max(...times) : 0,
  };
}

export function toMarkdown(results, summary, meta = {}) {
  const lines = [
    '| voce | tipo | split | modello | variante | esatta | token coincidenti | ms |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of results) {
    lines.push(
      `| ${row.id} | ${row.type} | ${row.split ?? '—'} | ${row.model} | ` +
        `${row.variant} | ${row.exact ? 'sì' : 'no'} | ${row.commonTokens}/32 | ${row.timeMs} |`
    );
  }
  lines.push('');
  for (const group of summary.groups) {
    const percent = Math.round((group.exact / group.total) * 100);
    lines.push(
      `- ${group.split} su ${group.model}: esatte ${group.exact}/${group.total} (${percent} %)`
    );
  }
  lines.push(
    `- controlli: corrispondenze esatte ${summary.controlsExact} su ${summary.controlRuns}`
  );
  lines.push(
    `- tempo di generazione: media ${summary.averageMs} ms, massimo ${summary.maxMs} ms`
  );
  if (meta.variant) {
    lines.push(`- variante ${meta.variant}`);
  }
  if (meta.transformersVersion) {
    lines.push(`- Transformers.js ${meta.transformersVersion}`);
  }
  if (meta.userAgent) {
    lines.push(`- user agent: ${meta.userAgent}`);
  }
  if (meta.hardwareConcurrency) {
    lines.push(`- core logici: ${meta.hardwareConcurrency}`);
  }
  return lines.join('\n');
}

export function toTSV(results) {
  const lines = [
    ['voce', 'tipo', 'split', 'modello', 'variante', 'esatta', 'token coincidenti', 'ms'].join('\t'),
  ];
  for (const row of results) {
    lines.push(
      [
        row.id,
        row.type,
        row.split ?? '',
        row.model,
        row.variant,
        row.exact ? 'sì' : 'no',
        row.commonTokens,
        row.timeMs,
      ].join('\t')
    );
  }
  return lines.join('\n');
}
