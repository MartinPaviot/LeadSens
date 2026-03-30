import type { ScheduleFrequency } from '@/inngest/events';

/**
 * Compute the next run date from a given date and frequency.
 * Handles month boundary overflow (e.g. Jan 31 + 1 month = Feb 28, not Mar 3).
 */
export function computeNextDate(from: Date, frequency: ScheduleFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly': {
      const targetMonth = next.getMonth() + 1;
      const y = targetMonth > 11 ? next.getFullYear() + 1 : next.getFullYear();
      const m = targetMonth > 11 ? 0 : targetMonth;
      const lastDay = new Date(y, m + 1, 0).getDate();
      next.setFullYear(y, m, Math.min(next.getDate(), lastDay));
      break;
    }
  }
  return next;
}
