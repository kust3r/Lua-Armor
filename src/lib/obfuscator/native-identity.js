const NATIVE_IDENTITY_GROUPS = [2, 6, 8, 11, 15, 20];
function emitNativeIdentity(reads, cache) {
  if (reads.length !== 20) throw new Error("Expected twenty native references");
  let start = 0;
  const declarations = [], calls = [];
  for (const [index, end] of NATIVE_IDENTITY_GROUPS.entries()) {
    const name = `_nativeIdentity${index}`;
    const comparisons = reads.slice(start, end).map((read, offset) => `${read}~=${cache}[${start + offset + 1}]`);
    declarations.push(`local ${name}=function() return ${comparisons.join(" or ")} end;`);
    calls.push(`${name}()`);
    start = end;
  }
  return { declarations: declarations.join(""), mismatch: calls.join(" or ") };
}
export {
  NATIVE_IDENTITY_GROUPS,
  emitNativeIdentity
};
