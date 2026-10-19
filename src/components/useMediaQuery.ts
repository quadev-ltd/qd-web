import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query matches now, following it as the window changes. Without
 * `matchMedia` (the specs' jsdom), `fallback`.
 */
export const useMediaQuery = (query: string, fallback = true): boolean => {
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : fallback;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const list = window.matchMedia(query);
    const follow = () => setMatches(list.matches);
    follow();
    list.addEventListener('change', follow);
    return () => list.removeEventListener('change', follow);
  }, [query]);
  return matches;
};

export default useMediaQuery;
