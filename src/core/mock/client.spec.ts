import { browserOf, headphonesOf, osOf } from './client';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0';
const FIREFOX_ANDROID =
  'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0';

describe('what a mock interview says of the browser (D100)', () => {
  it('names the browser and its major version, and the system', () => {
    expect(
      [CHROME_MAC, SAFARI_IPHONE, EDGE_WINDOWS, FIREFOX_ANDROID].map(browserOf),
    ).toEqual(['Chrome 142', 'Safari 26', 'Edge 142', 'Firefox 144']);
    expect(
      [CHROME_MAC, SAFARI_IPHONE, EDGE_WINDOWS, FIREFOX_ANDROID].map(osOf),
    ).toEqual(['macOS', 'iOS', 'Windows', 'Android']);
    expect(browserOf('Something else')).toBe('Other');
  });

  it('guesses headphones from the labels, and says unknown without them', () => {
    expect(headphonesOf([{ label: 'Maya’s AirPods Pro' }])).toBe('yes');
    expect(headphonesOf([{ label: 'MacBook Pro Speakers' }])).toBe('no');
    expect(headphonesOf([{ label: '' }])).toBe('unknown');
    expect(headphonesOf([])).toBe('unknown');
  });
});
