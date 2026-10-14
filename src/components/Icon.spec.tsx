import { render, screen } from '@testing-library/react';

import { Icon } from './Icon';

describe('Icon', () => {
  it('is decorative by default: hidden from assistive technology', () => {
    const { container } = render(<Icon name="user" />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('is an image with a name when it says something by itself', () => {
    render(<Icon name="user" size={32} label="Profile" />);

    const image = screen.getByRole('img', { name: 'Profile' });
    expect(image).not.toHaveAttribute('aria-hidden');
    expect(image).toHaveAttribute('width', '32');
    expect(image).toHaveAttribute('height', '32');
  });

  it('is drawn in the current text colour', () => {
    const { container } = render(<Icon name="user" />);

    expect(container.querySelector('svg')).toHaveAttribute(
      'stroke',
      'currentColor',
    );
    expect(container.querySelectorAll('svg > *').length).toBeGreaterThan(0);
  });

  it('is drawn as an outline, or as a solid shape when it is filled', () => {
    const { container, rerender } = render(<Icon name="star" />);
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');

    rerender(<Icon name="star" filled />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'fill',
      'currentColor',
    );
  });
});
