import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SHORT_TEXT_CHARS, TextPreview } from './TextPreview';

describe('TextPreview', () => {
  it('shows a short text whole, with nothing to open', () => {
    render(<TextPreview text="A short note." />);

    expect(screen.getByText('A short note.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a long text with "Show all" and closes it with "Show less"', async () => {
    render(<TextPreview text={'a'.repeat(SHORT_TEXT_CHARS + 1)} />);
    const toggle = screen.getByRole('button', { name: 'textPreview.showAll' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('textPreview.showLess');
  });
});
