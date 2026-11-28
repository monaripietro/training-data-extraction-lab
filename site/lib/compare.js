// Token-by-token comparison for mode B (RF3, issue #35). Pure module: the
// comparison works on token IDs, never on decoded text.

export function exactMatch(expected, generated) {
  return (
    expected.length === generated.length &&
    expected.every((id, index) => id === generated[index])
  );
}

export function commonPrefixLength(expected, generated) {
  let count = 0;
  while (
    count < expected.length &&
    count < generated.length &&
    expected[count] === generated[count]
  ) {
    count += 1;
  }
  return count;
}

export function segments(expected, generated) {
  return expected.map((expectedId, index) => ({
    index,
    expectedId,
    generatedId: generated[index] ?? null,
    equal: expectedId === generated[index],
  }));
}
