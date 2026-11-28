// DOM rendering and accessibility helpers for the models section (RF1).
// All visible texts are in Italian; state changes are announced via aria-live.

export const STATE_LABELS = {
  idle: 'In attesa',
  preparing: 'Preparazione…',
  loading: 'Download in corso',
  ready: 'Pronto',
  error: 'Errore',
};

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'text') {
      node.textContent = value;
    } else if (name === 'class') {
      node.className = value;
    } else {
      node.setAttribute(name, value);
    }
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

export function createModelCard({ key, label, onLoad }) {
  const status = el('p', { class: 'model-status', role: 'status' });
  const button = el('button', {
    type: 'button',
    class: 'model-load',
    'data-model': key,
    text: `Carica ${label}`,
  });
  button.addEventListener('click', onLoad);
  const root = el(
    'article',
    { class: 'model-card' },
    el('h3', { text: label }),
    status,
    button
  );
  return { key, root, status, button };
}

export function setModelState(card, state, { progress = null, message = '' } = {}) {
  const base = STATE_LABELS[state] ?? state;
  let text = base;
  if (state === 'loading' && typeof progress === 'number') {
    text = `${base}: ${Math.round(progress)}%`;
  }
  if (message) {
    text = `${text} — ${message}`;
  }
  card.status.textContent = text;
  card.status.classList.toggle('is-error', state === 'error');
  card.button.disabled =
    state === 'loading' || state === 'preparing' || state === 'ready';
}
