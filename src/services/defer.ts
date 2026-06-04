// Defer date calculation service
// Extracted for testability with controlled dates

export type DeferPreset = "later_today" | "tomorrow" | "weekend" | "next_week";

export function calculateDeferDate(preset: DeferPreset, now: Date): Date {
  let deferUntil: Date;

  switch (preset) {
    case "later_today":
      deferUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      break;
    case "tomorrow":
      deferUntil = new Date(now);
      deferUntil.setDate(deferUntil.getDate() + 1);
      deferUntil.setHours(9, 0, 0, 0);
      break;
    case "weekend": {
      deferUntil = new Date(now);
      const dayOfWeek = deferUntil.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      deferUntil.setDate(deferUntil.getDate() + daysUntilSaturday);
      deferUntil.setHours(10, 0, 0, 0);
      break;
    }
    case "next_week": {
      deferUntil = new Date(now);
      const currentDay = deferUntil.getDay();
      const daysUntilMonday = (8 - currentDay) % 7 || 7;
      deferUntil.setDate(deferUntil.getDate() + daysUntilMonday);
      deferUntil.setHours(9, 0, 0, 0);
      break;
    }
  }

  return deferUntil;
}
