// What Firebase Hosting sends must let a mock interview use the microphone and play the voices'
// samples (D100). The browser tests can't see it: they are served by Vite, without these
// headers, and their stand-in microphone takes the place of getUserMedia.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface HostingHeader {
  key: string;
  value: string;
}

const headers = (
  JSON.parse(readFileSync(resolve('firebase.json'), 'utf8')) as {
    hosting: { headers: { headers: HostingHeader[] }[] };
  }
).hosting.headers.flatMap(rule => rule.headers);

const headerValue = (key: string) =>
  headers.find(header => header.key === key)?.value ?? '';

/** `microphone=(self)` → { microphone: '(self)' }. */
const permissions = () =>
  Object.fromEntries(
    headerValue('Permissions-Policy')
      .split(',')
      .map(entry => entry.trim().split('=') as [string, string]),
  );

describe('the hosting headers (firebase.json)', () => {
  it('let the site’s own pages use the microphone, and nothing embedded in them', () => {
    expect(permissions().microphone).toBe('(self)');
  });

  it('keep the other features off', () => {
    const { camera, geolocation, payment, usb } = permissions();
    expect([camera, geolocation, payment, usb]).toEqual([
      '()',
      '()',
      '()',
      '()',
    ]);
  });

  it('let the site play its own sounds, in the content policy waiting to be enforced', () => {
    expect(headerValue('Content-Security-Policy-Report-Only')).toContain(
      "media-src 'self';",
    );
  });
});
