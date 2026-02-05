export function getToggleValue(toggle, fallback) {
  return toggle ? toggle.checked : fallback;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAbortError(message = "Stopped by user.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}
