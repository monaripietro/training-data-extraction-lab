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
import { exactMatch, commonPrefixLength, segments } from './lib/compare.js';
import { decodePerToken, visibleWhitespace, visibleTokenText } from './lib/tokens.js';

const SHUFFLE_SEED = 20261128;

const loaded = new Map();
const cards = new Map();
let memorizedEntries = [];
let controlEntries = [];
let mergedPrefixes = [];
let selectedPrefix = null;

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
  ui.setModelState(card, 'loading');
  try {
    const instance = await models.loadModel(modelInfo.repoId, {
      dtype: currentVariant(),
      onProgress: (data) => {
        if (typeof data?.progress === 'number') {
          ui.setModelState(card, 'loading', { progress: data.progress * 100 });
        }
      },
    });
    if (instance.dtype !== currentVariant()) {
      models.dispose(instance);
      ui.setModelState(card, 'idle', { message: 'variante cambiata, ricarica il modello' });
      return;
    }
    loaded.set(modelInfo.key, instance);
    ui.setModelState(card, 'ready', { message: `variante ${instance.dtype}` });
    refreshModelSelect();
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

function setModeBStatus(text) {
  document.getElementById('b-status').textContent = text;
}

function refreshModelSelect() {
  const select = document.getElementById('b-model');
  const previous = select.value;
  select.textContent = '';
  if (loaded.size === 0) {
    select.append(ui.el('option', { value: '', text: 'Nessun modello caricato' }));
  } else {
    for (const modelInfo of models.MODELS) {
      if (loaded.has(modelInfo.key)) {
        select.append(ui.el('option', { value: modelInfo.key, text: modelInfo.label }));
      }
    }
  }
  if (previous && loaded.has(previous)) {
    select.value = previous;
  }
  updateGenerateButton();
}

function updateGenerateButton() {
  const button = document.getElementById('b-generate');
  const modelKey = document.getElementById('b-model').value;
  button.disabled = selectedPrefix === null || !loaded.has(modelKey);
}

function continuationTexts(instance, prefixIds, continuationIds) {
  const decode = (ids) => instance.tokenizer.decode(ids);
  return decodePerToken([...prefixIds, ...continuationIds], decode).slice(prefixIds.length);
}

function renderTokenList(container, texts, equalFlags) {
  container.textContent = '';
  texts.forEach((text, index) => {
    const item = ui.el(
      'li',
      {
        class: equalFlags[index] ? 'token-equal' : 'token-different',
        title: equalFlags[index] ? 'token coincidente' : 'token diverso',
      },
      ui.el('span', { text: visibleTokenText(text) })
    );
    container.append(item);
  });
}

function renderModeBResult(entry, generatedIds, instance) {
  const expectedTexts = continuationTexts(instance, entry.prefix_ids, entry.expected_ids);
  const generatedTexts = continuationTexts(instance, entry.prefix_ids, generatedIds);
  const segmentList = segments(entry.expected_ids, generatedIds);
  const equalFlags = segmentList.map((segment) => segment.equal);
  renderTokenList(document.getElementById('b-expected'), expectedTexts, equalFlags);
  renderTokenList(document.getElementById('b-generated'), generatedTexts, equalFlags);
  const isExact = exactMatch(entry.expected_ids, generatedIds);
  const common = commonPrefixLength(entry.expected_ids, generatedIds);
  document.getElementById('b-summary').textContent =
    `Corrispondenza esatta: ${isExact ? 'sì' : 'no'} · ` +
    `Token iniziali coincidenti: ${common}/32`;
  document.getElementById('b-result').hidden = false;
  setModeBStatus(
    `Generazione completata: corrispondenza esatta ${isExact ? 'sì' : 'no'}, ` +
      `${common} token iniziali coincidenti su 32.`
  );
}

async function generateModeB() {
  if (selectedPrefix === null) {
    setModeBStatus('Scegli prima un prefisso dall\u2019elenco.');
    return;
  }
  const modelKey = document.getElementById('b-model').value;
  const instance = loaded.get(modelKey);
  if (!instance) {
    setModeBStatus('Carica prima un modello.');
    return;
  }
  document.getElementById('b-generate').disabled = true;
  setModeBStatus('Generazione in corso…');
  try {
    const generatedIds = await models.generateFromIds(instance, selectedPrefix.prefix_ids);
    renderModeBResult(selectedPrefix, generatedIds, instance);
  } catch (error) {
    setModeBStatus(`Generazione non riuscita: ${error.message}`);
  }
  updateGenerateButton();
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
    const preview = ui.el('span', {
      class: 'prefix-preview',
      text: visibleWhitespace(entry.prefix_text.slice(0, 120)),
    });
    const button = ui.el(
      'button',
      {
        type: 'button',
        class: 'prefix-item-button',
        'aria-pressed': String(entry === selectedPrefix),
      },
      ui.el('strong', { text: entry.visibleId }),
      preview
    );
    button.addEventListener('click', () => {
      selectedPrefix = entry;
      renderPrefixList();
      updateGenerateButton();
      setModeBStatus(
        'Prefisso selezionato: premi «Genera» per creare la continuazione.'
      );
    });
    if (entry === selectedPrefix) {
      button.classList.add('is-selected');
    }
    const item = ui.el('li', { class: 'prefix-item' }, button);
    if (trainerViewActive()) {
      item.append(trainerDetails(entry));
    }
    list.append(item);
  }
}

function rebuildPrefixList() {
  mergedPrefixes = mergeAndShuffle(memorizedEntries, controlEntries, SHUFFLE_SEED);
  if (!mergedPrefixes.some((entry) => entry === selectedPrefix)) {
    selectedPrefix = null;
    document.getElementById('b-result').hidden = true;
  }
  renderPrefixList();
  updateGenerateButton();
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
        refreshModelSelect();
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
  document.getElementById('b-model').addEventListener('change', updateGenerateButton);
  document.getElementById('b-generate').addEventListener('click', generateModeB);
  refreshModelSelect();

  const debugOutput = document.getElementById('debug-output');
  document.getElementById('debug-generate').addEventListener('click', () => {
    runDebugGeneration(debugOutput);
  });

  loadControls().then(rebuildPrefixList);
}

init();
