// Recurrence calculation service
// Handles next occurrence calculation for fixed and completion-based schedules

export type ScheduleType = "fixed" | "completion";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  id: string;
  task_id: string;
  schedule_type: ScheduleType;
  frequency: Frequency | null;
  interval: number;
  days_of_week: number[] | null;
  day_of_month: number | null;
  month_of_year: number | null;
  days_after_completion: number | null;
}

/**
 * Calculate the next occurrence date for a recurrence rule.
 *
 * @param rule - The recurrence rule
 * @param fromDate - The reference date (completion date for completion-based, or current date for fixed)
 * @returns The next occurrence date
 */
export function calculateNextOccurrence(
  rule: RecurrenceRule,
  fromDate: Date,
): Date {
  if (rule.schedule_type === "completion") {
    return calculateCompletionBased(rule, fromDate);
  }
  return calculateFixed(rule, fromDate);
}

/**
 * Calculate next occurrence for completion-based schedules.
 * Simply adds days_after_completion to the completion date.
 */
function calculateCompletionBased(
  rule: RecurrenceRule,
  completionDate: Date,
): Date {
  if (!rule.days_after_completion) {
    throw new Error(
      "days_after_completion is required for completion-based schedules",
    );
  }

  const next = new Date(completionDate);
  next.setDate(next.getDate() + rule.days_after_completion);
  return next;
}

/**
 * Calculate next occurrence for fixed schedules.
 */
function calculateFixed(rule: RecurrenceRule, fromDate: Date): Date {
  if (!rule.frequency) {
    throw new Error("frequency is required for fixed schedules");
  }

  switch (rule.frequency) {
    case "daily":
      return calculateDaily(rule, fromDate);
    case "weekly":
      return calculateWeekly(rule, fromDate);
    case "monthly":
      return calculateMonthly(rule, fromDate);
    case "yearly":
      return calculateYearly(rule, fromDate);
    default:
      throw new Error(`Unknown frequency: ${rule.frequency}`);
  }
}

/**
 * Daily recurrence: add interval days.
 */
function calculateDaily(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + rule.interval);
  return next;
}

/**
 * Weekly recurrence: find next matching weekday.
 * If days_of_week is specified, find the next day that matches.
 * Otherwise, add interval weeks.
 */
function calculateWeekly(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);

  if (rule.days_of_week && rule.days_of_week.length > 0) {
    // Sort days for easier processing
    const sortedDays = [...rule.days_of_week].sort((a, b) => a - b);
    const currentDay = next.getDay();

    // Find next matching day this week
    const nextDayThisWeek = sortedDays.find((d) => d > currentDay);

    if (nextDayThisWeek !== undefined) {
      // Found a matching day later this week
      next.setDate(next.getDate() + (nextDayThisWeek - currentDay));
    } else {
      // No matching day this week, go to first day of next interval week
      const daysUntilFirstDay = 7 - currentDay + sortedDays[0];
      const additionalWeeks = (rule.interval - 1) * 7;
      next.setDate(next.getDate() + daysUntilFirstDay + additionalWeeks);
    }
  } else {
    // Simple weekly: add interval weeks
    next.setDate(next.getDate() + 7 * rule.interval);
  }

  return next;
}

/**
 * Monthly recurrence: find next month with day_of_month.
 * Clamps to month length (e.g., 30th in February becomes 28th/29th).
 */
function calculateMonthly(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);

  // Store target year/month/day before manipulation
  // Set day to 1 first to avoid overflow when changing months
  // (e.g., Jan 31 -> setMonth(Feb) would overflow to Mar 3)
  const targetMonth = next.getMonth() + rule.interval;
  next.setDate(1);
  next.setMonth(targetMonth);

  // Set day of month, clamping to month length
  const targetDay = rule.day_of_month || fromDate.getDate();
  const daysInMonth = getDaysInMonth(next.getFullYear(), next.getMonth());
  next.setDate(Math.min(targetDay, daysInMonth));

  return next;
}

/**
 * Yearly recurrence: find next year with month_of_year and day_of_month.
 */
function calculateYearly(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);

  // Move to next interval year
  next.setFullYear(next.getFullYear() + rule.interval);

  // Set month if specified (1-indexed in rule, 0-indexed in Date)
  if (rule.month_of_year) {
    next.setMonth(rule.month_of_year - 1);
  }

  // Set day of month, clamping to month length
  if (rule.day_of_month) {
    const targetDay = rule.day_of_month;
    const daysInMonth = getDaysInMonth(next.getFullYear(), next.getMonth());
    next.setDate(Math.min(targetDay, daysInMonth));
  }

  return next;
}

/**
 * Get the number of days in a month.
 */
function getDaysInMonth(year: number, month: number): number {
  // Month is 0-indexed, so we go to the 0th day of next month
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Validate a recurrence rule.
 */
export function validateRecurrenceRule(rule: Partial<RecurrenceRule>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!rule.schedule_type) {
    errors.push("schedule_type is required");
  }

  if (rule.schedule_type === "fixed") {
    if (!rule.frequency) {
      errors.push("frequency is required for fixed schedules");
    }

    if (rule.frequency === "weekly" && rule.days_of_week) {
      for (const day of rule.days_of_week) {
        if (day < 0 || day > 6) {
          errors.push(`Invalid day_of_week: ${day}. Must be 0-6.`);
        }
      }
    }

    if (rule.frequency === "monthly" && rule.day_of_month) {
      if (rule.day_of_month < 1 || rule.day_of_month > 31) {
        errors.push(
          `Invalid day_of_month: ${rule.day_of_month}. Must be 1-31.`,
        );
      }
    }

    if (rule.frequency === "yearly") {
      if (
        rule.month_of_year &&
        (rule.month_of_year < 1 || rule.month_of_year > 12)
      ) {
        errors.push(
          `Invalid month_of_year: ${rule.month_of_year}. Must be 1-12.`,
        );
      }
    }
  }

  if (rule.schedule_type === "completion") {
    if (!rule.days_after_completion || rule.days_after_completion < 1) {
      errors.push(
        "days_after_completion is required and must be >= 1 for completion-based schedules",
      );
    }
  }

  if (rule.interval !== undefined && rule.interval < 1) {
    errors.push("interval must be >= 1");
  }

  return { valid: errors.length === 0, errors };
}
