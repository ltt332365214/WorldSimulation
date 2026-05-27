import { TimeData, CalendarConfig } from '../types';

export class Clock {
  private time: TimeData;
  private calendar: CalendarConfig;
  private tickSize: number; // minutes per tick

  constructor(initialTime: TimeData, calendar: CalendarConfig, tickSize: number) {
    this.time = { ...initialTime };
    this.calendar = calendar;
    this.tickSize = tickSize;
  }

  tick(): TimeData {
    this.time.minute += this.tickSize;
    this.normalize();
    return this.getTime();
  }

  getTime(): TimeData {
    return { ...this.time };
  }

  setTime(time: TimeData): void {
    this.time = { ...time };
    this.normalize();
  }

  getTickCount(): number {
    const daysInMonths = this.calendar.months;
    const daysPerYear = daysInMonths.reduce((sum, m) => sum + (m.days ?? 30), 0);
    let totalDays = (this.time.year - 1) * daysPerYear;
    for (let m = 0; m < this.time.month - 1; m++) {
      totalDays += daysInMonths[m]?.days ?? 30;
    }
    totalDays += this.time.day - 1;
    return totalDays * 24 * 60 + this.time.hour * 60 + this.time.minute;
  }

  getTimeOfDay(): string {
    const hour = this.time.hour;
    if (hour < 5) return '深夜';
    if (hour < 7) return '清晨';
    if (hour < 9) return '早晨';
    if (hour < 12) return '上午';
    if (hour < 14) return '午时';
    if (hour < 17) return '下午';
    if (hour < 19) return '傍晚';
    if (hour < 22) return '夜晚';
    return '深夜';
  }

  getSeason(): string {
    const month = this.time.month;
    for (const season of this.calendar.seasons) {
      if (month >= season.startMonth && month <= season.endMonth) {
        return season.name;
      }
    }
    return '未知';
  }

  getChineseTimeUnit(): string {
    const units = this.calendar.timeUnits;
    if (!units.length) return `${this.time.hour}时`;
    // Each unit spans 2 hours: 子(23-1), 丑(1-3), etc.
    const index = Math.floor((this.time.hour + 1) / 2) % units.length;
    return units[index] + '时';
  }

  isFestival(): string | null {
    for (const f of this.calendar.festivals) {
      if (this.time.month === f.month && this.time.day === f.day) {
        return f.name;
      }
    }
    return null;
  }

  private normalize(): void {
    // Handle negative minutes by borrowing from hours
    while (this.time.minute < 0) {
      this.time.minute += 60;
      this.time.hour -= 1;
    }
    // Handle negative hours by borrowing from days
    while (this.time.hour < 0) {
      this.time.hour += 24;
      this.time.day -= 1;
    }
    // Handle negative days by borrowing from months
    while (this.time.day < 1) {
      const prevMonthIndex = ((this.time.month - 1 - 1) % this.calendar.months.length + this.calendar.months.length) % this.calendar.months.length;
      this.time.day += this.calendar.months[prevMonthIndex].days;
      this.time.month -= 1;
    }
    // Handle negative months by borrowing from years
    while (this.time.month < 1) {
      this.time.month += this.calendar.months.length;
      this.time.year -= 1;
    }

    // Handle overflow
    if (this.time.minute >= 60) {
      this.time.hour += Math.floor(this.time.minute / 60);
      this.time.minute = this.time.minute % 60;
    }
    if (this.time.hour >= 24) {
      this.time.day += Math.floor(this.time.hour / 24);
      this.time.hour = this.time.hour % 24;
    }
    // Use while loop to handle overflow across multiple months
    while (this.time.day > (this.calendar.months[this.time.month - 1]?.days ?? 30)) {
      const daysInCurrentMonth = this.calendar.months[this.time.month - 1]?.days ?? 30;
      this.time.day -= daysInCurrentMonth;
      this.time.month += 1;
    }
    while (this.time.month > this.calendar.months.length) {
      this.time.month -= this.calendar.months.length;
      this.time.year += 1;
    }
  }

  serialize(): TimeData {
    return this.getTime();
  }

  deserialize(data: TimeData): void {
    this.time = { ...data };
    this.normalize();
  }
}