/** Business timezone — must match backend APP_TIMEZONE. */
export const APP_TIMEZONE = "Asia/Manila";

/** Format a Date (or parseable value) as YYYY-MM-DD in Asia/Manila. */
export function formatDateISO(date) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    value,
  );
}

export function formatDateLocale(date, locale = "en-PH") {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIMEZONE,
  }).format(value);
}

/** Today's date as YYYY-MM-DD in Asia/Manila. */
export function todayISO() {
  return formatDateISO(new Date());
}
