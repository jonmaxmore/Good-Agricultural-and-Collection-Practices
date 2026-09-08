/**
 * Working Days Calculator (Asia/Bangkok / ICT, UTC+7)
 *
 * คำนวณวันทำการตามปฏิทินราชการไทย (หักเสาร์-อาทิตย์ และวันหยุดราชการ)
 * ใช้ใน Revision Deadline (5 วันทำการ) และ CAR Deadline
 *
 * Canonical business rule: revision deadlines are measured in working days
 * (Mon-Fri) evaluated in the Asia/Bangkok timezone (ICT, UTC+7).
 * Source of truth: apps/backend/config/business-rules.js (PAYMENT.REVISION_DEADLINE_BUSINESS_DAYS).
 *
 * IMPORTANT: All weekday / calendar-date checks must be evaluated in the
 * target timezone. Using `date.getDay()` / `date.getDate()` here would be
 * UTC-relative and would mis-classify edge cases such as Friday 23:00 ICT
 * (which is Saturday in UTC).
 *
 * @module utils/working-days
 */

/**
 * The revision window length, read rather than re-spelled.
 *
 * This module is otherwise dependency-free, and staying that way was worth
 * checking before adding this line: config/business-rules.js itself requires
 * nothing, so no cycle is possible in either direction, and no module-boundary
 * rule in eslint.config.js separates utils/ from config/. The alternative was
 * to leave the day count spelled as a literal default parameter, which is a
 * second definition of a business number that the header above already declares
 * lives in config — a caller who omitted the argument would silently keep the
 * old value after the config moved. Note the direction: only calculateRevisionDeadline,
 * which is named for the business rule, reads this. The calendar primitives
 * (addWorkingDays, isWorkingDay, countWorkingDaysBetween) take their day count
 * from the caller and know nothing about revisions.
 */
const { PAYMENT } = require('../config/business-rules');

const DEFAULT_TIME_ZONE = 'Asia/Bangkok';

/**
 * วันหยุดราชการไทย (recurring yearly — MM-DD format)
 * ไม่รวมวันหยุดที่เลื่อนตามปฏิทินจันทรคติ (ต้องอัปเดตทุกปี)
 */
const RECURRING_HOLIDAYS = [
  '01-01', // วันขึ้นปีใหม่
  '04-06', // วันจักรี
  '04-13', // วันสงกรานต์
  '04-14', // วันสงกรานต์
  '04-15', // วันสงกรานต์
  '05-01', // วันแรงงาน
  '05-04', // วันฉัตรมงคล
  '06-03', // วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี
  '07-28', // วันเฉลิมพระชนมพรรษา ร.10
  '08-12', // วันแม่แห่งชาติ
  '10-13', // วันคล้ายวันสวรรคต ร.9
  '10-23', // วันปิยมหาราช
  '12-05', // วันพ่อแห่งชาติ
  '12-10', // วันรัฐธรรมนูญ
  '12-31', // วันสิ้นปี
];

/**
 * วันหยุดพิเศษเพิ่มเติมตามปี (YYYY-MM-DD format)
 * อัปเดตเมื่อราชกิจจานุเบกษาประกาศ
 */
const EXTRA_HOLIDAYS_BY_YEAR = {
  2025: [
    '2025-02-12', // วันมาฆบูชา
    '2025-05-12', // วันวิสาขบูชา (ชดเชย)
    '2025-07-11', // วันอาสาฬหบูชา
    '2025-07-14', // วันเข้าพรรษา (ชดเชย)
  ],
  2026: [
    '2026-03-03', // วันมาฆบูชา
    '2026-05-01', // วันแรงงาน (overlap)
    '2026-05-31', // วันวิสาขบูชา (ชดเชย)
    '2026-07-01', // วันอาสาฬหบูชา
    '2026-07-02', // วันเข้าพรรษา
  ],
  2027: [
    '2027-02-19', // วันมาฆบูชา
    '2027-05-20', // วันวิสาขบูชา
    '2027-07-19', // วันอาสาฬหบูชา
    '2027-07-20', // วันเข้าพรรษา
  ],
};

/**
 * Format a Date as YYYY-MM-DD evaluated in the target timezone.
 * Uses Intl.DateTimeFormat so we never read UTC-relative fields like getDate().
 *
 * @param {Date} date
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {{ year: number, month: number, day: number, isoDate: string, mmdd: string, weekday: string }}
 */
function getZonedParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const lookup = {};
  for (const p of parts) {
    if (p.type !== 'literal') {lookup[p.type] = p.value;}
  }
  const year = Number(lookup.year);
  const month = Number(lookup.month); // 1-12
  const day = Number(lookup.day);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    year,
    month,
    day,
    isoDate: `${year}-${mm}-${dd}`,
    mmdd: `${mm}-${dd}`,
    weekday: lookup.weekday, // 'Mon', 'Tue', ... 'Sun'
  };
}

// Blocker F follow-through (full-system audit 2026-07-07): the lunar-holiday
// table above ends at a fixed year. Dates for later years come from the Royal
// Gazette (ราชกิจจานุเบกษา) and MUST NOT be guessed — but silently computing a
// deadline into an uncovered year would under-count holidays exactly like the
// bug this module exists to prevent. Warn loudly (once per year per process)
// so ops extend EXTRA_HOLIDAYS_BY_YEAR when the gazette publishes.
const MAX_EXTRA_HOLIDAY_YEAR = Math.max(
  ...Object.keys(EXTRA_HOLIDAYS_BY_YEAR).map(Number),
);
const warnedUncoveredYears = new Set();

function warnIfExtraHolidayCoverageMissing(year) {
  if (year <= MAX_EXTRA_HOLIDAY_YEAR || warnedUncoveredYears.has(year)) {
    return;
  }
  warnedUncoveredYears.add(year);
  console.warn(
    `[working-days] EXTRA_HOLIDAYS_BY_YEAR has no entry for ${year} ` +
    `(coverage ends ${MAX_EXTRA_HOLIDAY_YEAR}). Lunar Thai public holidays for ` +
    `${year} will NOT be excluded from working-day deadlines until the table is ` +
    'extended from the Royal Gazette announcement — deadlines computed into this ' +
    'year may be too short.',
  );
}

/**
 * ตรวจสอบว่าวันนั้นเป็นวันหยุดนักขัตฤกษ์หรือไม่ (เทียบ timezone Asia/Bangkok)
 * @param {Date} date
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {boolean}
 */
function isHoliday(date, timeZone = DEFAULT_TIME_ZONE) {
  const { mmdd, isoDate, year } = getZonedParts(date, timeZone);
  if (RECURRING_HOLIDAYS.includes(mmdd)) {
    return true;
  }
  const extraHolidays = EXTRA_HOLIDAYS_BY_YEAR[year] || [];
  return extraHolidays.includes(isoDate);
}

/**
 * ตรวจสอบว่าวันนั้นเป็นวันทำการหรือไม่
 * (ไม่ใช่เสาร์-อาทิตย์ และไม่ใช่วันหยุดราชการ) — เทียบ timezone Asia/Bangkok
 *
 * Edge case covered: Friday 23:00 ICT is Saturday in UTC; we evaluate in ICT
 * so it still counts as Friday. See business-rules.js for canonical rule.
 *
 * @param {Date} date
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {boolean}
 */
function isWorkingDay(date, timeZone = DEFAULT_TIME_ZONE) {
  const { weekday } = getZonedParts(date, timeZone);
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }
  return !isHoliday(date, timeZone);
}

/**
 * Advance a Date by exactly one calendar day in the target timezone, then
 * return a Date whose UTC instant maps to 00:00 local in that zone for the
 * resulting calendar day. Used to iterate forward across timezone boundaries
 * without UTC drift.
 *
 * @param {Date} date
 * @param {string} timeZone
 * @returns {Date}
 */
function nextLocalDayStart(date, timeZone) {
  const { year, month, day } = getZonedParts(date, timeZone);
  // Construct the next day's midnight UTC then offset back into target zone.
  // We use an Intl-based normalizer: build a UTC date for tomorrow noon
  // (avoids DST issues), then snap back to local midnight of that day.
  const tomorrowUtcNoon = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const nextParts = getZonedParts(tomorrowUtcNoon, timeZone);
  // Compute the UTC offset for that calendar day at noon and subtract to land on local midnight.
  // Using Intl: format `tomorrowUtcNoon` to get the local hour, then back-solve.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(tomorrowUtcNoon);
  const localHour = Number(fmt);
  // localHour at the UTC noon timestamp; offset = localHour - 12 (in hours, may be negative)
  const offsetHours = localHour - 12;
  // Local midnight UTC = tomorrowUtcNoon - 12h - offsetHours
  return new Date(
    Date.UTC(nextParts.year, nextParts.month - 1, nextParts.day, 0, 0, 0) - offsetHours * 3600 * 1000,
  );
}

/**
 * Return the UTC instant that corresponds to 23:59:59.999 local time in the
 * target zone on the same calendar day as `date`.
 *
 * @param {Date} date
 * @param {string} timeZone
 * @returns {Date}
 */
function endOfLocalDay(date, timeZone) {
  const { year, month, day } = getZonedParts(date, timeZone);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(utcNoon);
  const localHour = Number(fmt);
  const offsetHours = localHour - 12;
  // Local midnight UTC for this day
  const localMidnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetHours * 3600 * 1000;
  // 23:59:59.999 = midnight + 86_399_999 ms
  return new Date(localMidnightUtcMs + 24 * 3600 * 1000 - 1);
}

/**
 * เพิ่มจำนวนวันทำการจากวันเริ่มต้น (Asia/Bangkok timezone by default)
 *
 * Canonical: revision deadlines in business-rules.js are measured in working
 * days evaluated in ICT. Returns the end-of-business-day instant (23:59:59.999
 * local) on the resulting working day.
 *
 * @param {Date|string|number} startDate - วันเริ่มนับ
 * @param {number} count - จำนวนวันทำการที่ต้องการเพิ่ม
 * @param {string} [timeZone=DEFAULT_TIME_ZONE] - IANA timezone, default Asia/Bangkok
 * @returns {Date} วันที่ครบกำหนด (end-of-business-day instant)
 */
function addWorkingDays(startDate, count, timeZone = DEFAULT_TIME_ZONE) {
  if (!Number.isFinite(count) || count < 0) {
    throw new Error(`Invalid count: ${count}`);
  }

  let cursor = new Date(startDate);
  // Coverage guard: computing a deadline into a year past the lunar-holiday
  // table would silently under-count holidays. Warn (once per year) so ops
  // extend the table from the Royal Gazette.
  warnIfExtraHolidayCoverageMissing(getZonedParts(cursor, timeZone).year);
  let added = 0;
  while (added < count) {
    cursor = nextLocalDayStart(cursor, timeZone);
    if (isWorkingDay(cursor, timeZone)) {
      added++;
    }
  }
  warnIfExtraHolidayCoverageMissing(getZonedParts(cursor, timeZone).year);
  // Return end of local business day
  return endOfLocalDay(cursor, timeZone);
}

/**
 * นับจำนวนวันทำการที่เหลือระหว่างสองวัน (เทียบใน timezone Asia/Bangkok)
 * @param {Date} from - วันเริ่มต้น
 * @param {Date} to - วันสิ้นสุด (deadline)
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {number} จำนวนวันทำการที่เหลือ (ค่าลบ = เกินกำหนด)
 */
function countWorkingDaysBetween(from, to, timeZone = DEFAULT_TIME_ZONE) {
  const start = new Date(from);
  const end = new Date(to);

  if (end.getTime() === start.getTime()) {return 0;}

  if (end < start) {
    let count = 0;
    let cursor = new Date(end);
    while (cursor < start) {
      cursor = nextLocalDayStart(cursor, timeZone);
      if (isWorkingDay(cursor, timeZone)) {
        count--;
      }
    }
    return count;
  }

  let count = 0;
  let cursor = new Date(start);
  while (cursor < end) {
    cursor = nextLocalDayStart(cursor, timeZone);
    if (cursor > end) {break;}
    if (isWorkingDay(cursor, timeZone)) {
      count++;
    }
  }
  return count;
}

/**
 * คำนวณ revision deadline จากวันที่เริ่มนับ
 * @param {Date} startDate - วันที่เริ่มนับ (วันที่สั่งแก้ไข)
 * @param {number} [businessDays] - จำนวนวันทำการ (default: config/business-rules.js
 *   PAYMENT.REVISION_DEADLINE_BUSINESS_DAYS)
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {{ revisionDue: Date, workingDaysAdded: number }}
 */
function calculateRevisionDeadline(
  startDate,
  businessDays = PAYMENT.REVISION_DEADLINE_BUSINESS_DAYS,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const revisionDue = addWorkingDays(startDate, businessDays, timeZone);
  return {
    revisionDue,
    workingDaysAdded: businessDays,
  };
}

/**
 * ดึงข้อมูล deadline status แบบเข้าใจง่าย
 * @param {Date} deadlineDate - วันครบกำหนด
 * @param {string} [timeZone=DEFAULT_TIME_ZONE]
 * @returns {{ remainingWorkingDays: number, isOverdue: boolean, urgency: string, displayText: string }}
 */
function getDeadlineStatus(deadlineDate, timeZone = DEFAULT_TIME_ZONE) {
  const now = new Date();
  const remaining = countWorkingDaysBetween(now, deadlineDate, timeZone);
  const isOverdue = now > deadlineDate;

  let urgency = 'normal';
  if (isOverdue) {
    urgency = 'expired';
  } else if (remaining <= 1) {
    urgency = 'critical'; // < 24 ชม.ทำการ
  } else if (remaining <= 2) {
    urgency = 'high';
  }

  let displayText;
  if (isOverdue) {
    displayText = 'หมดเขตแล้ว';
  } else if (remaining === 0) {
    displayText = 'วันสุดท้าย';
  } else {
    displayText = `${remaining} วันทำการ`;
  }

  return {
    remainingWorkingDays: remaining,
    isOverdue,
    urgency,
    displayText,
  };
}

module.exports = {
  isHoliday,
  isWorkingDay,
  addWorkingDays,
  countWorkingDaysBetween,
  calculateRevisionDeadline,
  getDeadlineStatus,
  getZonedParts,
  // Exported for the requirement register, which selects DATED LAW by the day of
  // filing (services/requirement-rule-service.js). It needs the same DST-safe
  // zone arithmetic the deadline engine already does; a second implementation
  // over a hardcoded +07:00 would be a second answer to "when does a Thai day end".
  endOfLocalDay,
  RECURRING_HOLIDAYS,
  EXTRA_HOLIDAYS_BY_YEAR,
  DEFAULT_TIME_ZONE,
};
