import { v4 as uuid } from "uuid";

/** Unique suffix for throwaway records so parallel/repeat runs don't collide */
export function uniq(prefix: string): string {
  return `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
}

/** Today's date as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tomorrow's date as YYYY-MM-DD (for records editable until the visit date) */
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
