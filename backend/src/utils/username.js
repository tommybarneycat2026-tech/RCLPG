export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeUsername(username) {
  return username.trim();
}

export function isValidUsername(username) {
  return USERNAME_REGEX.test(username.trim());
}
