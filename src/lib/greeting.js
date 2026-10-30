function greetingPeriod(hour) {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}
function localGreeting(date = /* @__PURE__ */ new Date()) {
  const labels = {
    morning: "Bom dia",
    afternoon: "Boa tarde",
    night: "Boa noite"
  };
  return `${labels[greetingPeriod(date.getHours())]}, Kontra!`;
}
export {
  greetingPeriod,
  localGreeting
};
