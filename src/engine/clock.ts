// ============================================================
// WorldSim Engine - Time Engine (Clock)
// ============================================================

import { GameClock, CalendarConfig } from './types';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function createClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): GameClock {
  return {
    year,
    month,
    day,
    hour,
    minute,
    tick: 0,
    season: getSeason(month, day),
    period: getPeriod(hour),
  };
}

function getSeason(month: number, day: number): string {
  // Simplified Chinese seasons
  if ((month === 2 && day >= 4) || month === 3 || month === 4 || (month === 5 && day < 6)) {
    return '春';
  }
  if ((month === 5 && day >= 6) || month === 6 || month === 7 || (month === 8 && day < 8)) {
    return '夏';
  }
  if ((month === 8 && day >= 8) || month === 9 || month === 10 || (month === 11 && day < 8)) {
    return '秋';
  }
  return '冬';
}

function getPeriod(hour: number): GameClock['period'] {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'evening';
  return 'night';
}

export function getFestival(calendar: CalendarConfig, month: number, day: number): string | null {
  for (const festival of calendar.festivals) {
    if (festival.month === month && festival.day === day) {
      return festival.name;
    }
  }
  return null;
}

/**
 * Advance the clock by one tick
 * @param clock Current clock state
 * @param tickSize Minutes per tick
 * @returns Updated clock
 */
export function tick(clock: GameClock, tickSize: number): GameClock {
  let { year, month, day, hour, minute, tick } = clock;

  tick += 1;
  minute += tickSize;

  while (minute >= 60) {
    minute -= 60;
    hour += 1;
  }

  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }

  const daysInMonth = MONTH_DAYS[month - 1];
  while (day > daysInMonth) {
    day -= daysInMonth;
    month += 1;
  }

  while (month > 12) {
    month -= 12;
    year += 1;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    tick,
    season: getSeason(month, day),
    period: getPeriod(hour),
  };
}

/**
 * Format clock as display string
 */
export function formatClock(clock: GameClock): string {
  const periodMap: Record<string, string> = {
    dawn: '黎明',
    morning: '上午',
    noon: '正午',
    afternoon: '下午',
    evening: '傍晚',
    night: '夜间',
  };
  return `${clock.year}年${clock.month}月${clock.day}日 ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')} (${periodMap[clock.period]})`;
}

/**
 * Format clock as short string
 */
export function formatClockShort(clock: GameClock): string {
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
}
