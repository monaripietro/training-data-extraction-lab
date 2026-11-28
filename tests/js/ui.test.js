import test from 'node:test';
import assert from 'node:assert/strict';

import { trainerToolsHidden } from '../../site/lib/ui.js';

test('the trainer tools are hidden unless the trainer view is active', () => {
  assert.equal(trainerToolsHidden(true), false);
  assert.equal(trainerToolsHidden(false), true);
});
