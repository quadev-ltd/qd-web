// What a mock interview tells the backend about the browser it ran in (research doc 24 §6 and
// §13.5): the browser, the system and a guess at headphones. The devices' labels can hold a
// person's name ("Maya's AirPods"), so they stay in the page: only the guess is sent.
import { type MockClient } from '@/core/profile/mockInterviews';

const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, 'Edge'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/CriOS\/(\d+)/, 'Chrome'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari/, 'Safari'],
];

/** "Chrome 142", "Safari 26", or "Other". */
export const browserOf = (userAgent: string): string => {
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      return `${name} ${match[1]}`;
    }
  }
  return 'Other';
};

export const osOf = (userAgent: string): string => {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'iOS';
  }
  if (/Android/.test(userAgent)) {
    return 'Android';
  }
  if (/CrOS/.test(userAgent)) {
    return 'ChromeOS';
  }
  if (/Windows/.test(userAgent)) {
    return 'Windows';
  }
  if (/Mac OS X|Macintosh/.test(userAgent)) {
    return 'macOS';
  }
  return /Linux/.test(userAgent) ? 'Linux' : 'Other';
};

const HEADPHONES =
  /headphone|headset|earphone|earbud|airpods|buds|beats|bluetooth|hands-free/i;

/**
 * A guess from the output devices' labels: headphones when one looks like them, none when every
 * label is known and none does, unknown when the browser gives no labels.
 */
export const headphonesOf = (
  outputs: { label: string }[],
): MockClient['headphones'] => {
  if (outputs.length === 0 || outputs.some(({ label }) => !label)) {
    return 'unknown';
  }
  return outputs.some(({ label }) => HEADPHONES.test(label)) ? 'yes' : 'no';
};

/** Read once the microphone is allowed, when the labels are given. */
export const mockClient = async (): Promise<MockClient> => {
  const userAgent = navigator.userAgent;
  let headphones: MockClient['headphones'] = 'unknown';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // The one in use comes first; without output devices listed (Safari), the inputs say as much.
    const outputs = devices.filter(({ kind }) => kind === 'audiooutput');
    headphones = headphonesOf(
      (outputs.length > 0
        ? outputs
        : devices.filter(({ kind }) => kind === 'audioinput')
      ).slice(0, 1),
    );
  } catch {
    // Unknown.
  }
  return { browser: browserOf(userAgent), os: osOf(userAgent), headphones };
};
