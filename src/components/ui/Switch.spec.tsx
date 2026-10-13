import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Switch, type SwitchProps } from './Switch';

const renderSwitch = (props: Partial<SwitchProps> = {}) => {
  const onChange = vi.fn();
  render(
    <Switch
      label="Use this first"
      description="Starred items come first"
      checked={false}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, control: screen.getByRole('switch') };
};

describe('Switch', () => {
  it('is a switch named by its label and described by its description, off or on', () => {
    const { control } = renderSwitch();

    expect(control).toHaveAccessibleName('Use this first');
    expect(control).toHaveAccessibleDescription('Starred items come first');
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('asks for the other value when it is pressed', async () => {
    const { onChange, control } = renderSwitch({ checked: true });

    expect(control).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(control);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('can be flipped with the keyboard', async () => {
    const { onChange, control } = renderSwitch();

    control.focus();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('waits, keeps its value and shows a spinner while its change is on its way', async () => {
    const { onChange, control } = renderSwitch({ checked: false, busy: true });

    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('aria-busy', 'true');
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await userEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can be switched off without being busy', () => {
    const { control } = renderSwitch({ disabled: true });

    expect(control).toBeDisabled();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('works without a description or an icon', () => {
    render(<Switch label="Large text" checked onChange={vi.fn()} />);

    const control = screen.getByRole('switch', { name: 'Large text' });
    expect(control).toBeChecked();
    expect(control).not.toHaveAttribute('aria-describedby');
  });
});
