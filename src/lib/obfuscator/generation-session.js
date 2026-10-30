import { withTokenCache, withoutTokenCache } from "./token-cache";
import { suspendGenerationRandom } from "./generation-random";
let active;
function assertExternalGenerationAllowed() {
  if (active) throw new Error("E_GENERATION_REENTRANT: nested external generation is unsupported");
}
function withGenerationSession(run) {
  assertExternalGenerationAllowed();
  const session = { id: Symbol("generation"), callbackErrors: [] };
  active = session;
  try {
    return withTokenCache(() => run(session));
  } finally {
    active = void 0;
  }
}
function assertGenerationSession(session) {
  if (active !== session) throw new Error("E_GENERATION_CONTEXT: invalid internal generation context");
}
function observeGeneration(run) {
  if (!run) return;
  try {
    suspendGenerationRandom(() => withoutTokenCache(run));
  } catch (error) {
    if (!active) throw error;
    active.callbackErrors.push(error instanceof Error ? error.message : String(error));
  }
}
export {
  assertExternalGenerationAllowed,
  assertGenerationSession,
  observeGeneration,
  withGenerationSession
};
