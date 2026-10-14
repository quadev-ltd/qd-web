import { type ProfileResource } from '@/core/profile/contract';

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "10 Oct 2026". */
export const formatDay = (milliseconds: number): string =>
  DAY.format(new Date(milliseconds));

/**
 * When a resource was added, as the page says it: "just now" in its first minute, the
 * minutes for an hour, then the day. `null` when the backend has set no date yet.
 */
export const addedAt = (
  createdAt: number | null,
  now: number = Date.now(),
):
  | { key: 'resource.addedJustNow' }
  | { key: 'resource.addedMinutesAgo'; count: number }
  | { key: 'resource.addedOn'; date: string }
  | null => {
  if (createdAt === null) {
    return null;
  }
  const minutes = Math.floor((now - createdAt) / 60_000);
  if (minutes < 1) {
    return { key: 'resource.addedJustNow' };
  }
  if (minutes < 60) {
    return { key: 'resource.addedMinutesAgo', count: minutes };
  }
  return { key: 'resource.addedOn', date: formatDay(createdAt) };
};

/** A page's address as the page shows it: no "https://", and no "/" alone at the end. */
export const shortAddress = (address: string): string => {
  try {
    const { host, pathname, search } = new URL(address);
    return `${host}${pathname === '/' ? '' : pathname}${search}`;
  } catch {
    return address;
  }
};

/**
 * What the content of a resource is, in a word: the translation key for a file or a text,
 * or the host of a link's address ("talks.example").
 */
export const contentOf = ({
  source,
  contentType,
  url,
}: Pick<ProfileResource, 'source' | 'contentType' | 'url'>):
  | { key: 'resource.contentPdf' }
  | { key: 'resource.contentWord' }
  | { key: 'resource.contentTextFile' }
  | { key: 'resource.contentText' }
  | { host: string } => {
  if (source === 'link') {
    try {
      return { host: new URL(url ?? '').hostname };
    } catch {
      return { host: url ?? '' };
    }
  }
  if (source === 'text') {
    return { key: 'resource.contentText' };
  }
  if (contentType === 'application/pdf') {
    return { key: 'resource.contentPdf' };
  }
  return contentType.startsWith('text/plain')
    ? { key: 'resource.contentTextFile' }
    : { key: 'resource.contentWord' };
};
