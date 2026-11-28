// Expected network hosts (RNF1, CA5):
// - the page domain itself (static files: index.html, style.css, app.js, lib/,
//   controls.json);
// - cdn.jsdelivr.net (Transformers.js 3.8.1 and its ONNX Runtime Web files);
// - huggingface.co and *.hf.co (tokenizer and model files of Xenova/pythia-70m*).
// The app performs no other request: no analytics, cookies, external fonts,
// localStorage, sessionStorage or IndexedDB. prefixes.json is read locally
// with FileReader and never leaves the browser.

import * as models from './lib/models.js';
import * as ui from './lib/ui.js';
import { validateEntries, mergeAndShuffle } from './lib/prefixes.js';
import { createProgressTracker, formatBytes } from './lib/progress.js';

const SHUFFLE_SEED = 20261128;

const loaded = new Map();
const cards = new Map();
let memorizedEntries = [];
let controlEntries = [];
let mergedPrefixes = [];

function variantSelect() {
  return document.getElementById('variant');
}

function currentVariant() {
  return variantSelect().value;
}

async function loadOne(modelInfo) {
  const card = cards.get(modelInfo.key);
  if (loaded.has(modelInfo.key) || card.button.disabled) {
    return;
  }
  ui.setModelState(card, 'preparing', { message: 'nessun dato scaricato' });
  const tracker = createProgressTracker();
  try {
    const instance = await models.loadModel(modelInfo.repoId, {
      dtype: currentVariant(),
      onProgress: (data) => {
        const progress = tracker.update(data);
        const downloaded = formatBytes(progress.loadedBytes);
        if (progress.percent === null) {
          ui.setModelState(card, 'preparing', { message: `${downloaded} scaricati` });
        } else {
          const modelDownloaded = formatBytes(progress.modelLoadedBytes);
          const modelSize = progress.modelTotalBytes > 0
            ? `${modelDownloaded} di ${formatBytes(progress.modelTotalBytes)}`
            : modelDownloaded;
          ui.setModelState(card, 'loading', {
            progress: progress.percent,
            message: modelSize,
          });
        }
      },
    });
    if (instance.dtype !== currentVariant()) {
      models.dispose(instance);
      ui.setModelState(card, 'idle', { message: 'variante cambiata, ricarica il modello' });
      return;
    }
    tracker.finish();
    loaded.set(modelInfo.key, instance);
    ui.setModelState(card, 'ready', { message: `variante ${instance.dtype}` });
  } catch (error) {
    loaded.delete(modelInfo.key);
    ui.setModelState(card, 'error', {
      message: 'impossibile scaricare il modello, controlla la connessione e riprova',
    });
    console.error(error);
  }
}

async function loadAll() {
  for (const modelInfo of models.MODELS) {
    await loadOne(modelInfo);
  }
}

function firstLoaded() {
  for (const modelInfo of models.MODELS) {
    const instance = loaded.get(modelInfo.key);
    if (instance) {
      return { modelInfo, instance };
    }
  }
  return null;
}

function setPrefixStatus(text) {
  document.getElementById('prefix-status').textContent = text;
}

function trainerViewActive() {
  return document.getElementById('trainer-view').checked;
}

function trainerDetails(entry) {
  const reproduced = entry.reproduced_pytorch === undefined
    ? 'assente'
    : JSON.stringify(entry.reproduced_pytorch);
  const matching = entry.matching_tokens === undefined
    ? 'assente'
    : JSON.stringify(entry.matching_tokens);
  return ui.el(
    'dl',
    { class: 'trainer-details' },
    ui.el('div', {}, ui.el('dt', { text: 'Id originale' }), ui.el('dd', { text: entry.id })),
    ui.el('div', {}, ui.el('dt', { text: 'Tipo' }), ui.el('dd', { text: entry.type })),
    ui.el('div', {}, ui.el('dt', { text: 'Split' }), ui.el('dd', { text: entry.split ?? '—' })),
    ui.el('div', {}, ui.el('dt', { text: 'Indice' }), ui.el('dd', { text: String(entry.index ?? '—') })),
    ui.el('div', {}, ui.el('dt', { text: 'Note' }), ui.el('dd', { text: entry.notes || '—' })),
    ui.el('div', {}, ui.el('dt', { text: 'Riproduzione PyTorch' }), ui.el('dd', { text: reproduced })),
    ui.el('div', {}, ui.el('dt', { text: 'Token coincidenti' }), ui.el('dd', { text: matching }))
  );
}

function renderPrefixList() {
  const list = document.getElementById('prefix-list');
  list.textContent = '';
  for (const entry of mergedPrefixes) {
    const item = ui.el(
      'li',
      { class: 'prefix-item' },
      ui.el('strong', { text: entry.visibleId })
    );
    if (trainerViewActive()) {
      item.append(trainerDetails(entry));
    }
    list.append(item);
  }
}

function rebuildPrefixList() {
  mergedPrefixes = mergeAndShuffle(memorizedEntries, controlEntries, SHUFFLE_SEED);
  renderPrefixList();
}

function readPrefixesFile(file) {
  if (!file) {
    return;
  }
  setPrefixStatus(`Lettura di ${file.name}…`);
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    let parsed = null;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch (error) {
      setPrefixStatus('Il file non è un JSON valido.');
      return;
    }
    const { entries, errors } = validateEntries(parsed);
    if (entries.length === 0) {
      setPrefixStatus(`Nessuna voce valida: ${errors.join(' ')}`);
      return;
    }
    memorizedEntries = entries;
    setPrefixStatus(
      errors.length === 0
        ? `Caricate ${entries.length} voci da ${file.name}.`
        : `Caricate ${entries.length} voci; scartate per errori: ${errors.join(' ')}`
    );
    rebuildPrefixList();
  });
  reader.addEventListener('error', () => {
    setPrefixStatus('Impossibile leggere il file.');
  });
  reader.readAsText(file);
}

async function loadControls() {
  try {
    const response = await fetch('controls.json');
    if (!response.ok) {
      throw new Error(`risposta ${response.status}`);
    }
    const { entries, errors } = validateEntries(await response.json());
    if (entries.length === 0) {
      setPrefixStatus(`Controlli non validi: ${errors.join(' ')}`);
      return;
    }
    controlEntries = entries;
    setPrefixStatus(
      errors.length === 0
        ? `Controlli disponibili: ${entries.length}.`
        : `Controlli caricati con avvisi: ${errors.join(' ')}`
    );
  } catch (error) {
    setPrefixStatus(
      'Controlli non disponibili: manca controls.json. Senza il file, ' +
        'carica prefixes.json per usare la lista dei prefissi.'
    );
  }
}

async function runDebugGeneration(output) {
  const entry = firstLoaded();
  if (!entry) {
    output.textContent = 'Carica prima un modello.';
    return;
  }
  output.textContent = 'Generazione in corso…';
  let prefixIds = controlEntries[0]?.prefix_ids ?? null;
  if (!prefixIds) {
    prefixIds = Array.from({ length: 32 }, (_, index) => index + 1);
    output.textContent = 'Controlli non disponibili: uso un prefisso sintetico di 32 ID.\n';
  }
  try {
    const generated = await models.generateFromIds(entry.instance, prefixIds);
    output.textContent =
      `Prefisso (32 ID): ${prefixIds.join(', ')}\n` +
      `Generati (${generated.length} ID): ${generated.join(', ')}`;
  } catch (error) {
    output.textContent = `Generazione non riuscita: ${error.message}`;
  }
}

function init() {
  const cardsContainer = document.getElementById('model-cards');
  for (const modelInfo of models.MODELS) {
    const card = ui.createModelCard({
      key: modelInfo.key,
      label: modelInfo.label,
      onLoad: () => loadOne(modelInfo),
    });
    ui.setModelState(card, 'idle', { message: 'non ancora caricato' });
    cards.set(modelInfo.key, card);
    cardsContainer.append(card.root);
  }
  variantSelect().addEventListener('change', () => {
    for (const [key, instance] of loaded) {
      const card = cards.get(key);
      if (instance.dtype !== currentVariant()) {
        models.dispose(instance);
        loaded.delete(key);
        ui.setModelState(card, 'idle', { message: 'variante cambiata, ricarica il modello' });
      } else {
        ui.setModelState(card, 'ready', { message: `variante ${instance.dtype}` });
      }
    }
  });
  document.getElementById('load-both').addEventListener('click', loadAll);

  document.getElementById('prefix-file').addEventListener('change', (event) => {
    readPrefixesFile(event.target.files[0]);
  });
  const dropzone = document.getElementById('prefix-dropzone');
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragging');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    readPrefixesFile(event.dataTransfer.files[0]);
  });
  document.getElementById('trainer-view').addEventListener('change', renderPrefixList);

  const debugOutput = document.getElementById('debug-output');
  document.getElementById('debug-generate').addEventListener('click', () => {
    runDebugGeneration(debugOutput);
  });

  loadControls().then(rebuildPrefixList);
}

init();
