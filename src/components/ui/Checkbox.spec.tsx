import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('is a checkbox named by its label', () => {
    render(<Checkbox>I agree</Checkbox>);

    const checkbox = screen.getByRole('checkbox', { name: 'I agree' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('aria-invalid');
  });

  it('reports a click on the box or on its label', async () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>I agree</Checkbox>);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByText('I agree'));

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('follows the checked value it is given', () => {
    render(
      <Checkbox checked onChange={() => undefined}>
        I agree
      </Checkbox>,
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('shows the error under the box and ties it to the box', () => {
    render(<Checkbox error="Please agree">I agree</Checkbox>);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAccessibleDescription('Please agree');
  });

  it('keeps a link inside the label reachable', () => {
    render(
      <Checkbox>
        I agree to the <a href="/terms-and-conditions">terms</a>
      </Checkbox>,
    );

    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute(
      'href',
      '/terms-and-conditions',
    );
  });
});
