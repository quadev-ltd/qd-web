// The words for a written CV's convention (D86): its option in the new-version panel, what it
// means, and its tag on the CV. And the name of the job's country, which suggests it.
import { type CvVersionConvention } from '@/core/profile/cvVersions';

export const CONVENTION_OPTION_KEYS = {
  uk: 'cv.conventionOptionUk',
  us: 'cv.conventionOptionUs',
  international: 'cv.conventionOptionInternational',
} as const satisfies Record<CvVersionConvention, string>;

export const CONVENTION_MEANING_KEYS = {
  uk: 'cv.conventionMeaningUk',
  us: 'cv.conventionMeaningUs',
  international: 'cv.conventionMeaningInternational',
} as const satisfies Record<CvVersionConvention, string>;

/** "UK CV · A4", under the written CV's title. */
export const CONVENTION_TAG_KEYS = {
  uk: 'cv.conventionTagUk',
  us: 'cv.conventionTagUs',
  international: 'cv.conventionTagInternational',
} as const satisfies Record<CvVersionConvention, string>;

/** Countries whose English name takes "the": "a job in the United States". */
const WITH_THE = new Set([
  'AE',
  'BS',
  'CF',
  'CK',
  'DO',
  'FK',
  'FO',
  'GB',
  'GM',
  'KM',
  'KY',
  'MH',
  'MV',
  'NL',
  'PH',
  'SB',
  'TC',
  'US',
  'VG',
  'VI',
]);

/**
 * The name of a country from its ISO 3166-1 alpha-2 code, in British English as the site's dates
 * are, as it reads after "in": "the United Kingdom", "Germany". The code itself when the browser
 * has no name for it.
 */
export const countryName = (code: string): string => {
  let name = code;
  try {
    name =
      new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) ?? code;
  } catch {
    // An old browser, or a code it doesn't know.
  }
  return name !== code && WITH_THE.has(code) ? `the ${name}` : name;
};
