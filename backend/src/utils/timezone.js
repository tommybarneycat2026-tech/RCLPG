/** Business timezone for all date filters and reporting. */
export const APP_TIMEZONE = "Asia/Manila";

/** SQL expression for today's calendar date in Asia/Manila. */
export const SQL_TODAY = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** SQL expression for the current timestamp in Asia/Manila. */
export const SQL_NOW = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')`;

/** Convert a timestamptz/timestamp SQL expression to a Manila calendar date. */
export function sqlManilaDate(columnExpr) {
  return `(${columnExpr} AT TIME ZONE '${APP_TIMEZONE}')::date`;
}

/** Start of the current week (Monday) in Manila as a date expression. */
export const SQL_WEEK_START = `DATE_TRUNC('week', ${SQL_TODAY}::timestamp)::date`;

/** Start of the current month in Manila as a date expression. */
export const SQL_MONTH_START = `DATE_TRUNC('month', ${SQL_TODAY}::timestamp)::date`;

/** Start of the current year in Manila as a date expression. */
export const SQL_YEAR_START = `DATE_TRUNC('year', ${SQL_TODAY}::timestamp)::date`;

/** Current calendar year in Asia/Manila (for JS-side range construction). */
export function getManilaYear() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
    }).format(new Date()),
  );
}

/** Today's date as YYYY-MM-DD in Asia/Manila. */
export function getManilaTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(new Date());
}

/** Format an ISO date/timestamp string to YYYY-MM-DD in Asia/Manila. */
export function toManilaDateISO(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(new Date(value));
}
