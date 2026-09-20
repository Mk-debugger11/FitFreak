/** `YYYY-MM-DD` in the device's timezone — used to key target muscle groups. */
export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** `YYYY-MM-DD` in UTC — used to key which dates have been fetched. */
export const toFetchKey = (date: Date): string => date.toISOString().split('T')[0];

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

export const isToday = (date: Date): boolean => isSameDay(date, new Date());

export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

export const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const minutesBetween = (start: Date, end: Date): number =>
  Math.floor((end.getTime() - start.getTime()) / 60000);

export const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
