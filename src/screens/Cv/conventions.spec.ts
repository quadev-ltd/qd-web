import { countryName } from './conventions';

describe('countryName', () => {
  it('names a country as it reads after "in", with "the" where English puts it', () => {
    expect(countryName('GB')).toBe('the United Kingdom');
    expect(countryName('US')).toBe('the United States');
    expect(countryName('NL')).toBe('the Netherlands');
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('NO')).toBe('Norway');
  });

  it('gives the code back when there is no name for it', () => {
    expect(countryName('QZ')).toBe('QZ');
    expect(countryName('not a code')).toBe('not a code');
  });
});
