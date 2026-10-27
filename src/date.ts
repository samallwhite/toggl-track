export function dayKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDay(key: string): Date {
  const [year, month, date] = key.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() - weekStartsOn + 7) % 7));
  return result;
}

export function dateAtMinutes(date: Date, minutes: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  );
}

export function minutesOfDay(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getHours() * 60 + date.getMinutes();
}

export function durationMinutes(startAt: string, endAt: string | null): number {
  if (!endAt) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000,
    ),
  );
}

export function focusDurationMinutes(
  session: {
    startAt: string;
    endAt: string | null;
    pausedAt: string | null;
    pausedMs: number;
  },
  now = Date.now(),
): number {
  const end = session.endAt ? Date.parse(session.endAt) : now;
  const currentPause =
    session.pausedAt && !session.endAt
      ? Math.max(0, end - Date.parse(session.pausedAt))
      : 0;
  return Math.max(
    0,
    Math.round(
      (end - Date.parse(session.startAt) - session.pausedMs - currentPause) /
        60000,
    ),
  );
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours}小时${rest ? `${rest}分` : ""}` : `${rest}分钟`;
}

export function formatClock(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function weekLabel(start: Date, count: number): string {
  const end = addDays(start, count - 1);
  const left = `${start.getMonth() + 1}月${start.getDate()}日`;
  const right = `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${left} — ${right}`;
}

export function snapMinutes(value: number, step: number): number {
  return Math.round(value / step) * step;
}
