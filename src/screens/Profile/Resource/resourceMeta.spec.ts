import { addedAt, contentOf, formatDay, shortAddress } from './resourceMeta';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const minutes = (count: number) => count * 60_000;

describe('when a resource was added', () => {
  it('says the day in the form of the designs', () => {
    expect(formatDay(Date.parse('2026-10-10T09:30:00Z'))).toBe('10 Oct 2026');
  });

  it.each([
    [0, { key: 'resource.addedJustNow' }],
    [59_999, { key: 'resource.addedJustNow' }],
    [minutes(1), { key: 'resource.addedMinutesAgo', count: 1 }],
    [minutes(6) + 30_000, { key: 'resource.addedMinutesAgo', count: 6 }],
    [minutes(59), { key: 'resource.addedMinutesAgo', count: 59 }],
  ])('%d ms ago', (ago, expected) => {
    expect(addedAt(NOW - ago, NOW)).toEqual(expected);
  });

  it('says the day once an hour has passed', () => {
    expect(addedAt(NOW - minutes(60), NOW)).toEqual({
      key: 'resource.addedOn',
      date: '13 Oct 2026',
    });
    expect(addedAt(Date.parse('2026-10-10T09:30:00Z'), NOW)).toEqual({
      key: 'resource.addedOn',
      date: '10 Oct 2026',
    });
  });

  it('says "just now" for a date slightly ahead of the visitor’s clock', () => {
    expect(addedAt(NOW + 5_000, NOW)).toEqual({ key: 'resource.addedJustNow' });
  });

  it('says nothing before the backend has set a date', () => {
    expect(addedAt(null, NOW)).toBeNull();
  });
});

describe('what the content of a resource is', () => {
  it.each([
    ['file', 'application/pdf', 'resource.contentPdf'],
    [
      'file',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'resource.contentWord',
    ],
    ['file', 'text/plain', 'resource.contentTextFile'],
    ['file', 'text/plain; charset=utf-8', 'resource.contentTextFile'],
    ['text', 'text/plain', 'resource.contentText'],
  ] as const)('%s of type %s', (source, contentType, key) => {
    expect(contentOf({ source, contentType })).toEqual({ key });
  });

  it('is the host of a link’s address', () => {
    expect(
      contentOf({
        source: 'link',
        contentType: 'text/uri-list',
        url: 'https://talks.example/2025/ledgers-without-tears',
      }),
    ).toEqual({ host: 'talks.example' });
  });

  it('shows the address as it is when it cannot be taken apart, and nothing when there is none', () => {
    expect(
      contentOf({ source: 'link', contentType: '', url: 'not an address' }),
    ).toEqual({ host: 'not an address' });
    expect(contentOf({ source: 'link', contentType: '' })).toEqual({
      host: '',
    });
  });
});

describe('shortAddress', () => {
  it.each([
    ['https://talks.example/ledgers', 'talks.example/ledgers'],
    ['https://maya.example/', 'maya.example'],
    ['https://maya.example/posts?page=2', 'maya.example/posts?page=2'],
    ['not an address', 'not an address'],
  ])('shows %s as %s', (address, shown) => {
    expect(shortAddress(address)).toBe(shown);
  });
});
