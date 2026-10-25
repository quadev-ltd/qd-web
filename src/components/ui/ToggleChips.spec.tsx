import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import ToggleChips from './ToggleChips';

const Lengths: React.FC<{ initial?: number | null; disabled?: boolean }> = ({
  initial = null,
  disabled,
}) => {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <ToggleChips
        label="Length (optional)"
        options={[
          { value: 30, label: '30 min' },
          { value: 60, label: '60 min' },
        ]}
        value={value}
        onChange={setValue}
        disabled={disabled}
      />
      <p>{`chosen: ${value ?? 'none'}`}</p>
    </>
  );
};

describe('ToggleChips', () => {
  it('is a group named by its label, with one button per option, none pressed at first', () => {
    render(<Lengths />);

    const group = screen.getByRole('group', { name: 'Length (optional)' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('chosen: none')).toBeInTheDocument();
  });

  it('chooses one, moves to another, and clears it when the chosen one is pressed again', async () => {
    const user = userEvent.setup();
    render(<Lengths initial={30} />);
    expect(screen.getByRole('button', { name: '30 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '60 min' }));
    expect(screen.getByRole('button', { name: '60 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '30 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('chosen: 60')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '60 min' }));
    expect(screen.getByText('chosen: none')).toBeInTheDocument();
  });

  it('can be used from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Lengths />);

    await user.tab();
    await user.tab();
    await user.keyboard(' ');

    expect(screen.getByText('chosen: 60')).toBeInTheDocument();
  });

  it('changes nothing while disabled', async () => {
    const user = userEvent.setup();
    render(<Lengths disabled />);

    await user.click(screen.getByRole('button', { name: '30 min' }));

    expect(screen.getByRole('button', { name: '30 min' })).toBeDisabled();
    expect(screen.getByText('chosen: none')).toBeInTheDocument();
  });
});
