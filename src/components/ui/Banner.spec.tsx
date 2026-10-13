import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { Banner } from './Banner';

describe('Banner', () => {
  it('is a quiet warning by default: read out when there is a pause', () => {
    render(<Banner>Your profile has 20 resources.</Banner>);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Your profile has 20 resources.');
    expect(banner).toHaveClass('bg-warning-tint');
  });

  it('can be an alert: read out at once', () => {
    render(
      <Banner tone="danger" role="alert">
        We couldn’t add this.
      </Banner>,
    );

    expect(screen.getByRole('alert')).toHaveClass('bg-danger-tint');
  });

  it.each([
    ['info', 'bg-chip'],
    ['success', 'bg-success-tint'],
  ] as const)('has a %s tone', (tone, surface) => {
    render(<Banner tone={tone}>Message</Banner>);

    expect(screen.getByRole('status')).toHaveClass(surface);
  });

  it('shows one action next to the text', () => {
    render(
      <Banner action={<button type="button">Try again</button>}>
        Could not load.
      </Banner>,
    );

    expect(screen.getByRole('status')).toContainElement(
      screen.getByRole('button', { name: 'Try again' }),
    );
  });

  it('can take the focus, without being in the tab order', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Banner ref={ref} role="alert">
        Something failed.
      </Banner>,
    );

    ref.current?.focus();

    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveAttribute('tabindex', '-1');
  });

  it('hides its icon from assistive technology: the text says it', () => {
    const { container } = render(<Banner>Message</Banner>);

    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
