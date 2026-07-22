/** Business timezone — must match backend APP_TIMEZONE. */
export const APP_TIMEZONE = "Asia/Manila";

const ISO_DATE_REGEX = /^\s*(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|([+-])(\d{2}):?(\d{2}))?)?\s*$/;

function parseBusinessDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  if (typeof value !== "string") return new Date(value);

  const normalized = value.trim();
  const match = normalized.match(ISO_DATE_REGEX);
  if (!match) return new Date(normalized);

  const [
    ,
    year,
    month,
    day,
    hour = "00",
    minute = "00",
    second = "00",
    fraction = "",
    tzDesignator,
    tzSign,
    tzHour = "00",
    tzMinute = "00",
  ] = match;

  const milliseconds = fraction ? Math.round(Number(fraction) * 1000) : 0;

  if (tzDesignator) {
    return new Date(normalized);
  }

  const manilaLocalUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 8,
    Number(minute),
    Number(second),
    milliseconds,
  );

  return new Date(manilaLocalUtc);
}

/** Format a Date or business timestamp string as YYYY-MM-DD in Asia/Manila. */
export function formatDateISO(date) {
  const value = parseBusinessDate(date);
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    value,
  );
}

export function formatDateLocale(date, locale = "en-PH", options = {}) {
  const value = parseBusinessDate(date);
  if (!value) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIMEZONE,
    ...options,
  }).format(value);
}

/** Today's date as YYYY-MM-DD in Asia/Manila. */
export function todayISO() {
  return formatDateISO(new Date());
}
