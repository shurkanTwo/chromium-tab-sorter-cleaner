export function getToggleValue(toggle, fallback) {
  return toggle ? toggle.checked : fallback;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
