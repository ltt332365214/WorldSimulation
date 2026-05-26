import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format a number with Chinese ordinal suffix
 */
export function formatNumberCN(num: number): string {
  return num.toString();
}

/**
 * Get mood color for display
 */
export function getMoodColor(mood: string): string {
  const moodColors: Record<string, string> = {
    '平静': '#6b7280',
    '高兴': '#10b981',
    '兴奋': '#f59e0b',
    '悲伤': '#6366f1',
    '忧郁': '#8b5cf6',
    '愤怒': '#ef4444',
    '焦虑': '#f97316',
    '恐惧': '#dc2626',
    '爱意': '#ec4899',
    '自信': '#06b6d4',
  };
  return moodColors[mood] || '#6b7280';
}

/**
 * Get period display name
 */
export function getPeriodName(period: string): string {
  const periodNames: Record<string, string> = {
    dawn: '黎明',
    morning: '上午',
    noon: '正午',
    afternoon: '下午',
    evening: '傍晚',
    night: '夜间',
  };
  return periodNames[period] || period;
}

/**
 * Get season display name with emoji
 */
export function getSeasonDisplay(season: string): string {
  const seasonMap: Record<string, string> = {
    '春': '春 🌸',
    '夏': '夏 ☀️',
    '秋': '秋 🍂',
    '冬': '冬 ❄️',
  };
  return seasonMap[season] || season;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
