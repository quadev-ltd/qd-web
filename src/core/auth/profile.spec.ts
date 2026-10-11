// Mirrors the date and name cases of qd-mobile src/core/firebase/profile.spec.ts.
import { displayDateToIso, isoDateToDisplay, normaliseName } from './profile';

describe('date conversion (strings only)', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD and back', () => {
    expect(displayDateToIso('29/02/2024')).toBe('2024-02-29');
    expect(isoDateToDisplay('2024-02-29')).toBe('29/02/2024');
    expect(isoDateToDisplay(displayDateToIso('01/12/1990'))).toBe('01/12/1990');
  });

  it('does not shift the day with the time zone', () => {
    expect(displayDateToIso('31/12/1999')).toBe('1999-12-31');
    expect(displayDateToIso('01/01/2000')).toBe('2000-01-01');
  });

  it.each(['1/2/2000', '2000-01-01', '01/01/00', ''])('rejects %s', value => {
    expect(() => displayDateToIso(value)).toThrow('Invalid date format');
  });

  it('rejects malformed ISO dates', () => {
    expect(() => isoDateToDisplay('01/01/2000')).toThrow('Invalid date format');
  });
});

describe('normaliseName', () => {
  it('trims, cuts to 30 characters and drops empty names', () => {
    expect(normaliseName('  Ada ')).toBe('Ada');
    expect(normaliseName('x'.repeat(40))).toHaveLength(30);
    expect(normaliseName('   ')).toBeUndefined();
    expect(normaliseName(null)).toBeUndefined();
  });
});
