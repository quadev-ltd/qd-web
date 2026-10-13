import { render, screen } from '@testing-library/react';

import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('is the native progress element, named and out of 100', () => {
    render(<ProgressBar label="Upload" value={0.62} />);

    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar.tagName).toBe('PROGRESS');
    expect(bar).toHaveAttribute('max', '100');
    expect(bar).toHaveAttribute('value', '62');
  });

  it.each([
    [0, '0'],
    [0.004, '0'],
    [0.999, '100'],
    [1, '100'],
    [-0.5, '0'],
    [7, '100'],
  ])('shows %d as %s', (value, expected) => {
    render(<ProgressBar label="Upload" value={value} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('value', expected);
  });

  it('is drawn without a style attribute, which the Content-Security-Policy forbids', () => {
    render(<ProgressBar label="Upload" value={0.5} />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('style');
  });
});
