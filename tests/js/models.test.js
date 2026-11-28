import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODELS,
  VARIANTS,
  DEFAULT_VARIANT,
  generationParams,
  TRANSFORMERS_VERSION,
  TRANSFORMERS_URL,
} from '../../site/lib/models.js';

test('generation params follow SPEC section 6', () => {
  const params = generationParams();
  assert.equal(params.do_sample, false);
  assert.equal(params.num_beams, 1);
  assert.equal(params.max_new_tokens, 32);
  assert.equal(params.eos_token_id, null);
  assert.equal('min_new_tokens' in params, false);
});

test('variants expose q8 (default) and fp32 (decision D8)', () => {
  assert.deepEqual(VARIANTS, ['q8', 'fp32']);
  assert.equal(DEFAULT_VARIANT, 'q8');
});

test('both pythia models are available', () => {
  assert.deepEqual(
    MODELS.map((model) => model.repoId),
    ['Xenova/pythia-70m', 'Xenova/pythia-70m-deduped']
  );
});

test('transformers.js is pinned to an exact 3.x version on jsDelivr', () => {
  assert.match(TRANSFORMERS_VERSION, /^3\.\d+\.\d+$/);
  assert.equal(
    TRANSFORMERS_URL,
    `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`
  );
});
