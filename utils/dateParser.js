import { add, set, startOfMonth, endOfMonth, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, parse, isValid } from 'date-fns';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';

const TIMEZONE = process.env.TIMEZONE || 'Asia/Tokyo';

/**
 * 日本語の自然言語から日付を解析
 * @param {string} text - 解析する文字列
 * @returns {Object} { date: Date|null, priority: string, title: string }
 */
export function parseJapaneseDate(text) {
  const now = utcToZonedTime(new Date(), TIMEZONE);
  let targetDate = null;
  let priority = 'normal';
  let title = text;

  // 時刻のパターンをマッチング
  const timePatterns = [
    { pattern: /(\d{1,2})時(\d{1,2})?分?/, type: 'hour' },
    { pattern: /午前(\d{1,2})時/, type: 'am' },
    { pattern: /午後(\d{1,2})時/, type: 'pm' },
    { pattern: /(\d{1,2}):(\d{2})/, type: 'colon' },
  ];

  let hour = 23;
  let minute = 59;

  for (const { pattern, type } of timePatterns) {
    const timeMatch = text.match(pattern);
    if (timeMatch) {
      if (type === 'hour') {
        hour = parseInt(timeMatch[1]);
        minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      } else if (type === 'am') {
        hour = parseInt(timeMatch[1]);
        minute = 0;
      } else if (type === 'pm') {
        hour = parseInt(timeMatch[1]) + 12;
        minute = 0;
      } else if (type === 'colon') {
        hour = parseInt(timeMatch[1]);
        minute = parseInt(timeMatch[2]);
      }
      break;
    }
  }

  // 日付パターンのマッチング
  const datePatterns = [
    // 具体的な日付 (YYYY/MM/DD)
    { pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})/, fn: (match) => {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      return new Date(year, month - 1, day);
    }},

    // 具体的な日付 (MM/DD, M/D)
    { pattern: /(\d{1,2})\/(\d{1,2})/, fn: (match) => {
      const month = parseInt(match[1]);
      const day = parseInt(match[2]);
      const currentYear = now.getFullYear();
      let targetDate = new Date(currentYear, month - 1, day);
      // 過去の日付の場合は来年とする
      if (targetDate < now) {
        targetDate = new Date(currentYear + 1, month - 1, day);
      }
      return targetDate;
    }},
    { pattern: /(\d{1,2})月(\d{1,2})日/, fn: (match) => {
      const month = parseInt(match[1]);
      const day = parseInt(match[2]);
      const currentYear = now.getFullYear();
      let targetDate = new Date(currentYear, month - 1, day);
      // 過去の日付の場合は来年とする
      if (targetDate < now) {
        targetDate = new Date(currentYear + 1, month - 1, day);
      }
      return targetDate;
    }},

    // 相対日付
    { pattern: /今日/, fn: () => now },
    { pattern: /明日/, fn: () => add(now, { days: 1 }) },
    { pattern: /明後日/, fn: () => add(now, { days: 2 }) },
    { pattern: /昨日/, fn: () => add(now, { days: -1 }) },

    // 相対期間
    { pattern: /(\d+)日後/, fn: (match) => add(now, { days: parseInt(match[1]) }) },
    { pattern: /(\d+)週間?後/, fn: (match) => add(now, { weeks: parseInt(match[1]) }) },
    { pattern: /(\d+)ヶ?月後/, fn: (match) => add(now, { months: parseInt(match[1]) }) },

    // 月末・月初
    { pattern: /今月末|月末/, fn: () => endOfMonth(now) },
    { pattern: /来月末/, fn: () => endOfMonth(add(now, { months: 1 })) },
    { pattern: /今月初|月初/, fn: () => startOfMonth(now) },
    { pattern: /来月初/, fn: () => startOfMonth(add(now, { months: 1 })) },

    // 曜日指定
    { pattern: /今週の?月曜|月曜/, fn: () => getNextWeekday(now, 'monday', false) },
    { pattern: /今週の?火曜|火曜/, fn: () => getNextWeekday(now, 'tuesday', false) },
    { pattern: /今週の?水曜|水曜/, fn: () => getNextWeekday(now, 'wednesday', false) },
    { pattern: /今週の?木曜|木曜/, fn: () => getNextWeekday(now, 'thursday', false) },
    { pattern: /今週の?金曜|金曜/, fn: () => getNextWeekday(now, 'friday', false) },
    { pattern: /今週の?土曜|土曜/, fn: () => getNextWeekday(now, 'saturday', false) },
    { pattern: /今週の?日曜|日曜/, fn: () => getNextWeekday(now, 'sunday', false) },

    { pattern: /来週の?月曜/, fn: () => getNextWeekday(now, 'monday', true) },
    { pattern: /来週の?火曜/, fn: () => getNextWeekday(now, 'tuesday', true) },
    { pattern: /来週の?水曜/, fn: () => getNextWeekday(now, 'wednesday', true) },
    { pattern: /来週の?木曜/, fn: () => getNextWeekday(now, 'thursday', true) },
    { pattern: /来週の?金曜/, fn: () => getNextWeekday(now, 'friday', true) },
    { pattern: /来週の?土曜/, fn: () => getNextWeekday(now, 'saturday', true) },
    { pattern: /来週の?日曜/, fn: () => getNextWeekday(now, 'sunday', true) },
  ];

  for (const { pattern, fn } of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      targetDate = fn(match);
      break;
    }
  }

  // 日付が見つからない場合は今日をデフォルトに
  if (!targetDate) {
    targetDate = now;
  }

  // 時刻を設定
  targetDate = set(targetDate, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });

  return {
    date: targetDate,
    priority,
    title: title.trim(),
  };
}

/**
 * 次の曜日を取得
 * @param {Date} baseDate - 基準日
 * @param {string} dayName - 曜日名
 * @param {boolean} nextWeek - 来週かどうか
 * @returns {Date}
 */
function getNextWeekday(baseDate, dayName, nextWeek = false) {
  const dayFunctions = {
    monday: nextMonday,
    tuesday: nextTuesday,
    wednesday: nextWednesday,
    thursday: nextThursday,
    friday: nextFriday,
    saturday: nextSaturday,
    sunday: nextSunday,
  };

  let targetDate = dayFunctions[dayName](baseDate);

  if (nextWeek) {
    targetDate = add(targetDate, { weeks: 1 });
  }

  return targetDate;
}

/**
 * 日付を日本語フォーマットで出力
 * @param {Date} date - フォーマットする日付
 * @returns {string}
 */
export function formatJapaneseDate(date) {
  return formatInTimeZone(date, TIMEZONE, 'yyyy年MM月dd日 HH:mm');
}

/**
 * タスク用の簡潔な日付フォーマット
 * @param {Date} date - フォーマットする日付
 * @returns {string}
 */
export function formatTaskDate(date) {
  return formatInTimeZone(date, TIMEZONE, 'MM/dd HH:mm');
}
