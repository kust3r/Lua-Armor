const ENGINE_VERSION = "2026.10.hardened-v4.3";
const byteLength = (source) => new TextEncoder().encode(source).byteLength;
function effectiveSeed(seed) {
  if (seed != null) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Seed must be an integer from 0 to 4294967295");
    return seed;
  }
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}
export {
  ENGINE_VERSION,
  byteLength,
  effectiveSeed
};
