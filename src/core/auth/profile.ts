// Mirrors the pure helpers of qd-mobile src/core/firebase/profile.ts (dates and names).
// The reads and writes of that file are behind the auth gateway on the web.

export const NAME_MAX_LENGTH = 30;

// ---------- Dates: strings only, no Date objects or time zones ----------

const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `DD/MM/YYYY` (the form) → `YYYY-MM-DD` (the profile). Throws on any other format. */
export const displayDateToIso = (value: string): string => {
  const match = DISPLAY_DATE.exec(value.trim());
  if (!match) {
    throw new Error('Invalid date format');
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

/** `YYYY-MM-DD` (the profile) → `DD/MM/YYYY` (the form). Throws on any other format. */
export const isoDateToDisplay = (value: string): string => {
  const match = ISO_DATE.exec(value.trim());
  if (!match) {
    throw new Error('Invalid date format');
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

// ---------- Names ----------

/** Trims and cuts a provider name to what the rules accept; empty becomes undefined. */
export const normaliseName = (name?: string | null): string | undefined => {
  const trimmed = name?.trim().slice(0, NAME_MAX_LENGTH).trim();
  return trimmed ? trimmed : undefined;
};
