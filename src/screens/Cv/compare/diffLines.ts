// What differs between two versions' texts, line by line (C3 "Compare two versions"): the
// lines both keep, the ones changed (one taken out where another came in), added and removed.
// A longest common subsequence of the lines; a CV is a few hundred lines at most.

export type DiffRow =
  | { kind: 'same'; earlier: string; later: string }
  | { kind: 'changed'; earlier: string; later: string }
  | { kind: 'added'; later: string }
  | { kind: 'removed'; earlier: string };

const linesOf = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

export const diffLines = (
  earlierText: string,
  laterText: string,
): DiffRow[] => {
  const a = linesOf(earlierText);
  const b = linesOf(laterText);
  // common[i][j]: the longest run both keep from a[i..] and b[j..].
  const common = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  // Each run of lines between two kept ones: the first taken out pairs with the first that came
  // in, and so on; what is left over was only removed, or only added.
  const run = { removed: [] as string[], added: [] as string[] };
  const flush = () => {
    const pairs = Math.min(run.removed.length, run.added.length);
    for (let k = 0; k < pairs; k += 1) {
      rows.push({
        kind: 'changed',
        earlier: run.removed[k],
        later: run.added[k],
      });
    }
    for (const earlier of run.removed.slice(pairs)) {
      rows.push({ kind: 'removed', earlier });
    }
    for (const later of run.added.slice(pairs)) {
      rows.push({ kind: 'added', later });
    }
    run.removed = [];
    run.added = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      rows.push({ kind: 'same', earlier: a[i], later: b[j] });
      i += 1;
      j += 1;
    } else if (
      i < a.length &&
      (j === b.length || common[i + 1][j] >= common[i][j + 1])
    ) {
      run.removed.push(a[i]);
      i += 1;
    } else {
      run.added.push(b[j]);
      j += 1;
    }
  }
  flush();
  return rows;
};
