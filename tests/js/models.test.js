import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODELS,
  VARIANTS,
  DEFAULT_VARIANT,
  generationParams,
  buildGenerateArgs,
  generateFromIds,
  TRANSFORMERS_VERSION,
  TRANSFORMERS_URL,
} from '../../site/lib/models.js';

class FakeTensor {
  constructor(type, data, dims) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

const fakeModule = { Tensor: FakeTensor };

function fakeModel(sequence) {
  return {
    generate: async (args) => ({
      args,
      tolist: () => [sequence],
    }),
  };
}

const PREFIX = Array.from({ length: 32 }, (_, index) => 100 + index);
const GENERATED = Array.from({ length: 32 }, (_, index) => 500 + index);

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

test('buildGenerateArgs builds int64 tensors of shape [1, 32] with params', () => {
  const args = buildGenerateArgs(PREFIX, FakeTensor);
  assert.ok(args.inputs instanceof FakeTensor);
  assert.ok(args.attention_mask instanceof FakeTensor);
  assert.equal(args.inputs.type, 'int64');
  assert.equal(args.attention_mask.type, 'int64');
  assert.deepEqual(args.inputs.dims, [1, 32]);
  assert.deepEqual(args.attention_mask.dims, [1, 32]);
  assert.deepEqual(Array.from(args.inputs.data, Number), PREFIX);
  assert.ok(Array.from(args.attention_mask.data).every((value) => value === 1n));
  assert.equal(args.do_sample, false);
  assert.equal(args.num_beams, 1);
  assert.equal(args.max_new_tokens, 32);
  assert.equal(args.eos_token_id, null);
});

test('generateFromIds passes tensors to the model and returns the last 32 ids', async () => {
  const seen = [];
  const model = {
    generate: async (args) => {
      seen.push(args);
      return { tolist: () => [[...PREFIX, ...GENERATED]] };
    },
  };
  const generated = await generateFromIds({ model }, PREFIX, fakeModule);
  assert.deepEqual(generated, GENERATED);
  assert.equal(seen.length, 1);
  assert.ok(seen[0].inputs instanceof FakeTensor);
  assert.deepEqual(seen[0].inputs.dims, [1, 32]);
});

test('generateFromIds rejects an output shorter than prefix + 32', async () => {
  const short = [...PREFIX, ...GENERATED.slice(0, 10)];
  await assert.rejects(
    generateFromIds({ model: fakeModel(short) }, PREFIX, fakeModule),
    /attesi 64/
  );
});

test('generateFromIds rejects an output that does not echo the prefix', async () => {
  const shifted = [...GENERATED, ...GENERATED];
  await assert.rejects(
    generateFromIds({ model: fakeModel(shifted) }, PREFIX, fakeModule),
    /prefisso/
  );
});
