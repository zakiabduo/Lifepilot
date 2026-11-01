export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(baseDateKey: string, deltaDays: number): string {
  const [y, m, d] = baseDateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  return toLocalDateKey(dt);
}

export function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

export function formatFriendlyDate(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  if (dateKey === tomorrowKey) return 'Tomorrow';
  const dt = parseLocalDateKey(dateKey);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map(Number);
  const h = Number.isFinite(parts[0]) ? parts[0] : 9;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

export function minutesToTime24(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(hhmm: string): string {
  const mins = timeToMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function greetingForHour(hour24: number): string {
  if (hour24 < 12) return 'Good morning';
  if (hour24 < 17) return 'Good afternoon';
  return 'Good evening';
}
