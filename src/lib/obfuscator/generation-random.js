let active;
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967296;
  };
}
function domainRandom(domain) {
  return active?.[domain]() ?? Math.random();
}
let hostRandom = Math.random;
function withRandomDomains(seed, emit) {
  const previous = active;
  const previousHost = hostRandom;
  const original = Math.random;
  if (!previous) hostRandom = original;
  active = { encoding: createRandom(seed ^ 1103515245), transform: createRandom(seed ^ 2654435769) };
  Math.random = active.transform;
  try {
    return emit();
  } finally {
    Math.random = original;
    active = previous;
    hostRandom = previousHost;
  }
}
function suspendGenerationRandom(run) {
  if (!active) return run();
  const previous = active, random = Math.random;
  active = void 0;
  Math.random = hostRandom;
  try {
    return run();
  } finally {
    active = previous;
    Math.random = random;
  }
}
export {
  createRandom,
  domainRandom,
  suspendGenerationRandom,
  withRandomDomains
};
