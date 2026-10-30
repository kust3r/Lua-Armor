let active;
const MIN_JOB_LENGTH = 65536;
const MIN_SOURCE_LENGTH = 4096;
const MAX_SOURCE_LENGTH = 2e6;
const MAX_ENTRIES = 4;
const MAX_RETAINED_CODE_UNITS = 2e6;
const MAX_RETAINED_TOKENS = 2e5;
const MAX_RETAINED_CONTENT_UNITS = 8e6;
function withTokenCache(run) {
  const previous = active;
  active = { entries: /* @__PURE__ */ new Map(), retainedCodeUnits: 0, retainedTokens: 0, retainedContentUnits: 0, enabled: void 0 };
  try {
    return run();
  } finally {
    active.entries.clear();
    active = previous;
  }
}
function withoutTokenCache(run) {
  const previous = active;
  active = void 0;
  try {
    return run();
  } finally {
    active = previous;
  }
}
function getTokens(source, comments) {
  if (!active) return;
  active.enabled ??= source.length >= MIN_JOB_LENGTH;
  if (!active.enabled || source.length < MIN_SOURCE_LENGTH || source.length > MAX_SOURCE_LENGTH) return;
  return active.entries.get((comments ? "1:" : "0:") + source)?.tokens;
}
function storeTokens(source, comments, tokens) {
  if (!active?.enabled || source.length < MIN_SOURCE_LENGTH || source.length > MAX_SOURCE_LENGTH) return;
  const key = (comments ? "1:" : "0:") + source;
  if (key.length > MAX_RETAINED_CODE_UNITS || tokens.length > MAX_RETAINED_TOKENS || active.entries.has(key)) return;
  let contentUnits = key.length;
  for (const token of tokens) {
    contentUnits += token.value.length + (token.raw?.length ?? 0) + (token.bytes?.length ?? 0);
    if (contentUnits > MAX_RETAINED_CONTENT_UNITS) return;
  }
  for (const trivia of tokens.comments ?? []) {
    contentUnits += trivia.text.length;
    if (contentUnits > MAX_RETAINED_CONTENT_UNITS) return;
  }
  while (active.retainedCodeUnits + key.length > MAX_RETAINED_CODE_UNITS || active.entries.size >= MAX_ENTRIES || active.retainedTokens + tokens.length > MAX_RETAINED_TOKENS || active.retainedContentUnits + contentUnits > MAX_RETAINED_CONTENT_UNITS) {
    const oldest = active.entries.keys().next().value;
    if (oldest === void 0) break;
    const entry = active.entries.get(oldest);
    active.entries.delete(oldest);
    active.retainedCodeUnits -= oldest.length;
    if (entry) {
      active.retainedTokens -= entry.tokens.length;
      active.retainedContentUnits -= entry.contentUnits;
    }
  }
  for (const token of tokens) {
    if (token.span) Object.freeze(token.span);
    if (token.bytes) Object.freeze(token.bytes);
    Object.freeze(token);
  }
  for (const trivia of tokens.comments ?? []) Object.freeze(trivia);
  if (tokens.comments) Object.freeze(tokens.comments);
  Object.freeze(tokens);
  active.entries.set(key, { tokens, contentUnits });
  active.retainedCodeUnits += key.length;
  active.retainedTokens += tokens.length;
  active.retainedContentUnits += contentUnits;
}
export {
  MAX_RETAINED_CONTENT_UNITS,
  MAX_RETAINED_TOKENS,
  getTokens,
  storeTokens,
  withTokenCache,
  withoutTokenCache
};
