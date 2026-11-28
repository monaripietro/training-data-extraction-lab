// Robust decoding of token fragments (issue #35). Pure module: the tokenizer
// is injected as a `decode` function over ID arrays.
//
// Byte-level BPE tokens can hold partial UTF-8 sequences: decoding a single
// token in isolation can produce a replacement character. Instead of decoding
// tokens one by one, the cumulative decodings of the first i + 1 tokens are
// compared: each visible token text is the difference between two consecutive
// cumulative decodings. When a later decoding rewrites characters produced by
// an earlier fragment (for example a replacement character that becomes the
// real accented letter), the surplus is removed from the earlier tokens.

export function decodePerToken(ids, decode) {
  const cumulative = ids.map((_, index) => decode(ids.slice(0, index + 1)));
  const texts = [];
  for (let index = 0; index < cumulative.length; index += 1) {
    const text = cumulative[index];
    const previous = index === 0 ? '' : cumulative[index - 1];
    let shared = 0;
    while (
      shared < previous.length &&
      shared < text.length &&
      previous[shared] === text[shared]
    ) {
      shared += 1;
    }
    if (previous.length > shared) {
      let surplus = previous.length - shared;
      let token = texts.length - 1;
      while (surplus > 0 && token >= 0) {
        const tokenText = texts[token];
        const cut = Math.min(surplus, tokenText.length);
        texts[token] = tokenText.slice(0, tokenText.length - cut);
        surplus -= cut;
        token -= 1;
      }
    }
    texts.push(text.slice(shared));
  }
  return texts;
}

export function visibleWhitespace(text) {
  return text
    .replace(/\t/g, '→')
    .replace(/\r\n|\r|\n/g, '↵')
    .replace(/ /g, '·');
}
