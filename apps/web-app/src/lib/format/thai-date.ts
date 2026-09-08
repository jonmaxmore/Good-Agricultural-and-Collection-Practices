/**
 * Guarded Thai-date formatters.
 *
 * A bare `new Date(x).toLocaleDateString('th-TH')` renders the Buddhist-era
 * epoch "1/1/2513" when x is null / undefined / '' / an invalid string — which
 * leaked onto staff screens (calendar, work inbox, final-approval) AND into
 * exported financial CSVs. These helpers return a fallback ('-' by default,
 * '' for the day-badge) on any falsy / NaN input instead.
 */
const TH_LOCALE = 'th-TH';

/**
 * Every "which day" decision in this product is a Bangkok decision: an issue
 * date, a due date, a harvest day all answer "which day was it here". The
 * machine rendering them may sit anywhere (staging is foreign-hosted), and an
 * instant late in the Thai evening is still the day before almost everywhere
 * west of here — so a formatter that trusts the process clock dates documents
 * one day early. The zone is named here, once.
 */
export const THAI_TIME_ZONE = 'Asia/Bangkok';

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: THAI_TIME_ZONE,
};

/**
 * The options as they actually reach Intl. Bangkok is the floor, not the law:
 * a caller that names its own zone (an export read in UTC, say) still wins,
 * because its `timeZone` lands after the default.
 */
export function thaiDateFormatOptions(
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTS,
): Intl.DateTimeFormatOptions {
  return { timeZone: THAI_TIME_ZONE, ...options };
}

export function formatThaiDate(
  value?: string | number | Date | null,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTS,
  fallback = '-',
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleDateString(TH_LOCALE, thaiDateFormatOptions(options));
}

/**
 * Day-of-month for date-badge widgets; '' on null/invalid (no "1"-from-epoch).
 * Read through the same formatter as the date printed beside it, so the badge
 * and the date can never name two different days for one instant.
 */
export function thaiDayOfMonth(value?: string | number | Date | null): string {
  return formatThaiDate(value, { day: 'numeric' }, '');
}
