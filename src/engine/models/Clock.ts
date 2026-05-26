import { TimeData, CalendarConfig } from './types.js';

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
    // total minutes from year start for comparison
    const totalMinutes = this.time.minute + this.time.hour * 60;
    return totalMinutes;
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
    const totalMinutes = this.time.hour * 60 + this.time.minute;
    const daysInMonth = this.calendar.months[this.time.month - 1]?.days ?? 30;

    if (this.time.minute >= 60) {
      this.time.hour += Math.floor(this.time.minute / 60);
      this.time.minute = this.time.minute % 60;
    }
    if (this.time.hour >= 24) {
      this.time.day += Math.floor(this.time.hour / 24);
      this.time.hour = this.time.hour % 24;
    }
    if (this.time.day > daysInMonth) {
      this.time.month += Math.floor((this.time.day - 1) / daysInMonth);
      this.time.day = ((this.time.day - 1) % daysInMonth) + 1;
    }
    if (this.time.month > this.calendar.months.length) {
      this.time.year += Math.floor((this.time.month - 1) / this.calendar.months.length);
      this.time.month = ((this.time.month - 1) % this.calendar.months.length) + 1;
    }
  }

  serialize(): TimeData {
    return this.getTime();
  }

  deserialize(data: TimeData): void {
    this.time = { ...data };
  }
}