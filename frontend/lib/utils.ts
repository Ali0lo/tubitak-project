import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Mono ledger-stamp time, e.g. "14:30". */
export function formatTimestamp(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

/** Human day label used in section headings: "Today", "Tomorrow", "Jul 20". */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

/** Full ledger date heading, e.g. "Monday, July 20". */
export function formatLongDate(iso: string): string {
  return format(new Date(iso), "EEEE, MMMM d");
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** Converts a <input type="datetime-local"> value to an ISO string, or undefined if empty. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** Converts an ISO string to a value usable by <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
