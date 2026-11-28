// Model loading and generation with Transformers.js (RF1, SPEC section 6).
//
// External library: Transformers.js (@huggingface/transformers), version 3.8.1
// of the 3.x series, published on npm on 2025-12-02. It is imported from
// jsDelivr at the exact version below; the import is dynamic so that this
// module stays testable with `node --test` without any network access.
//
// EOS handling (SPEC section 6): the Pile contains EOS tokens between
// documents, so generation must neither stop on EOS nor suppress it.
// In Transformers.js 3.8.1 the EosTokenCriteria stopping criterion is only
// added when `generation_config.eos_token_id !== null`, while `min_new_tokens`
// would set the EOS logits to -inf (suppression, which changes the argmax).
// Therefore generate() is called with `eos_token_id: null` and without
// `min_new_tokens`: the model may still emit EOS naturally and always
// generates exactly 32 new tokens.

export const TRANSFORMERS_VERSION = '3.8.1';
export const TRANSFORMERS_PUBLISHED = '2025-12-02';
export const TRANSFORMERS_URL =
  `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`;

export const MODELS = [
  { key: 'duped', repoId: 'Xenova/pythia-70m', label: 'Pythia 70M (dati originali)' },
  { key: 'deduped', repoId: 'Xenova/pythia-70m-deduped', label: 'Pythia 70M deduplicato' },
];

export const VARIANTS = ['q8', 'fp32'];
export const DEFAULT_VARIANT = 'q8';
export const NEW_TOKENS = 32;

export function generationParams() {
  return {
    do_sample: false,
    num_beams: 1,
    max_new_tokens: NEW_TOKENS,
    eos_token_id: null,
  };
}

let transformersModule = null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import(TRANSFORMERS_URL);
  }
  return transformersModule;
}

export async function loadModel(repoId, { dtype = DEFAULT_VARIANT, onProgress } = {}) {
  const { AutoTokenizer, AutoModelForCausalLM } = await getTransformers();
  const tokenizer = await AutoTokenizer.from_pretrained(repoId, {
    progress_callback: onProgress,
  });
  const model = await AutoModelForCausalLM.from_pretrained(repoId, {
    dtype,
    device: 'wasm',
    progress_callback: onProgress,
  });
  return { repoId, dtype, tokenizer, model };
}

export function buildGenerateArgs(prefixIds, TensorClass) {
  const inputIds = new BigInt64Array(prefixIds.map((id) => BigInt(id)));
  const attentionMask = new BigInt64Array(prefixIds.length).fill(1n);
  return {
    inputs: new TensorClass('int64', inputIds, [1, prefixIds.length]),
    attention_mask: new TensorClass('int64', attentionMask, [1, prefixIds.length]),
    ...generationParams(),
  };
}

export async function generateFromIds(loaded, prefixIds, transformersModule = null) {
  const { model } = loaded;
  const lib = transformersModule ?? (await getTransformers());
  const args = buildGenerateArgs(prefixIds, lib.Tensor);
  const output = await model.generate(args);
  const sequence = typeof output.tolist === 'function' ? output.tolist() : output;
  const row = Array.isArray(sequence) && Array.isArray(sequence[0]) ? sequence[0] : sequence;
  if (row.length !== prefixIds.length + NEW_TOKENS) {
    throw new Error(
      `la generazione ha restituito ${row.length} token, attesi ` +
        `${prefixIds.length + NEW_TOKENS} (prefisso + ${NEW_TOKENS} nuovi)`
    );
  }
  const echo = row.slice(0, prefixIds.length).map((id) => Number(id));
  if (echo.some((id, index) => id !== Number(prefixIds[index]))) {
    throw new Error("l'uscita della generazione non inizia con i token del prefisso");
  }
  return row.slice(-NEW_TOKENS).map((id) => Number(id));
}

export async function tokenizeText(loaded, text) {
  const encoded = await loaded.tokenizer(text);
  const ids = encoded.input_ids?.data ?? encoded.input_ids;
  return Array.from(ids, (id) => Number(id));
}

export function dispose(loaded) {
  loaded?.model?.dispose?.();
  loaded?.tokenizer?.dispose?.();
}
