function normalizeToggles(toggles = {}) {
  return Object.fromEntries(Object.entries(toggles).filter(([key]) => key !== "disableLineInfo"));
}
export {
  normalizeToggles
};
