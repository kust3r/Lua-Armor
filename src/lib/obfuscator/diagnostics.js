class LuaDiagnostic extends Error {
  constructor(code, phase, feature, target, span, astPath = "root") {
    super(`${code} [${phase}${target ? `/${target}` : ""}] ${feature} at ${span ? `${span.line}:${span.column}` : astPath}`);
    this.code = code;
    this.phase = phase;
    this.feature = feature;
    this.target = target;
    this.span = span;
    this.astPath = astPath;
    this.name = "LuaDiagnostic";
  }
}
function serializeDiagnostic(error) {
  if (!(error instanceof LuaDiagnostic)) return void 0;
  return { name: "LuaDiagnostic", message: error.message, code: error.code, phase: error.phase, feature: error.feature, target: error.target, span: error.span ? { ...error.span } : void 0, astPath: error.astPath };
}
function unreachable(node) {
  const value = node;
  throw new LuaDiagnostic("UNKNOWN_NODE", "emit", String(value?.kind), void 0, value?.span);
}
export {
  LuaDiagnostic,
  serializeDiagnostic,
  unreachable
};
