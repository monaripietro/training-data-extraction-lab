// Expected network hosts (RNF1, CA5):
// - the page domain itself (static files: index.html, style.css, app.js, lib/, controls.json);
// - cdn.jsdelivr.net (Transformers.js 3.8.1 and its ONNX Runtime Web files);
// - huggingface.co and *.hf.co (tokenizer and model files of Xenova/pythia-70m*).
// The app performs no other request: no analytics, cookies, external fonts,
// localStorage, sessionStorage or IndexedDB.

import * as models from './lib/models.js';
import * as ui from './lib/ui.js';
import { createProgressTracker, formatBytes } from './lib/progress.js';

const loaded = new Map();
const cards = new Map();

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
  const tracker = createProgressTracker();
  try {
    const instance = await models.loadModel(modelInfo.repoId, {
      dtype: currentVariant(),
      onProgress: (data) => {
        const progress = tracker.update(data);
        const downloaded = formatBytes(progress.loadedBytes);
        const size = progress.totalBytes > 0
          ? `${downloaded} di ${formatBytes(progress.totalBytes)}`
          : `${downloaded} scaricati`;
        ui.setModelState(card, 'loading', {
          progress: progress.percent,
          message: size,
        });
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

async function controlPrefixIds() {
  try {
    const response = await fetch('controls.json');
    if (!response.ok) {
      return null;
    }
    const entries = await response.json();
    if (Array.isArray(entries) && entries.length > 0) {
      return entries[0].prefix_ids;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function runDebugGeneration(output) {
  const entry = firstLoaded();
  if (!entry) {
    output.textContent = 'Carica prima un modello.';
    return;
  }
  output.textContent = 'Generazione in corso…';
  let prefixIds = await controlPrefixIds();
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
  const debugOutput = document.getElementById('debug-output');
  document.getElementById('debug-generate').addEventListener('click', () => {
    runDebugGeneration(debugOutput);
  });
}

init();
