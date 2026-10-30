function updateSubmission(entries, id, patch) {
  return entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
}
export {
  updateSubmission
};
