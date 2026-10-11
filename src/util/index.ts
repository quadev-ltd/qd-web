// Mirrors qd-mobile src/util/index.ts (the date helpers used by the sign-up schema).

export const stringToDate = (dateString: string): Date => {
  const dobArray = dateString.split('/');
  const year = parseInt(dobArray[2], 10);
  const month = parseInt(dobArray[1], 10) - 1; // Months are zero-indexed in JavaScript
  const day = parseInt(dobArray[0], 10);
  const parsedDate = new Date(year, month, day);
  return parsedDate;
};

export const validateDatePattern = (dateString: string): boolean => {
  const datePattern =
    /^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\/|-|\.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/;
  return datePattern.test(dateString);
};

/** A real calendar date written exactly as DD/MM/YYYY (the date input's mask). */
export const isValidDisplayDate = (dateString: string): boolean =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(dateString) && validateDatePattern(dateString);

/**
 * Web only (the app uses react-native-mask-input's DATE_DDMMYYYY mask): keeps the digits of
 * what was typed, at most eight, and writes them as DD/MM/YYYY.
 */
export const maskDisplayDate = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join('/');
};
