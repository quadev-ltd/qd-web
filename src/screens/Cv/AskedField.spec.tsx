import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import AskedField, { withStarter } from './AskedField';

const Box: React.FC<{ initial?: string; carried?: string }> = ({
  initial = '',
  carried,
}) => {
  const [value, setValue] = useState(initial);
  const [line, setLine] = useState(carried);
  return (
    <AskedField
      value={value}
      onChange={setValue}
      carried={line}
      onClear={() => {
        setValue('');
        setLine(undefined);
      }}
    />
  );
};

describe('withStarter', () => {
  it('starts the box, or adds a line of its own after what is there', () => {
    expect(withStarter('', 'Put first: ')).toBe('Put first: ');
    expect(withStarter('Leave out: Kestrel.\n\n', 'Also: ')).toBe(
      'Leave out: Kestrel.\nAlso: ',
    );
  });
});

describe('AskedField (D97)', () => {
  it('is an optional box of 1,000 characters, with three ways to start', () => {
    render(<Box />);

    const box = screen.getByLabelText('cv.askedField');
    expect(box).toHaveValue('');
    expect(screen.getByText('cv.askedHint')).toBeInTheDocument();
    expect(screen.getByText('cv.askedStartWith')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button').map(button => button.textContent),
    ).toEqual([
      'cv.askedStarterFirst',
      'cv.askedStarterLeaveOut',
      'cv.askedStarterAdd',
    ]);
  });

  it('adds a starter on a new line each time, with the cursor after it', async () => {
    const user = userEvent.setup();
    render(<Box />);
    const box = screen.getByLabelText('cv.askedField');

    await user.click(
      screen.getByRole('button', { name: 'cv.askedStarterFirst' }),
    );
    expect(box).toHaveFocus();
    await user.keyboard('on-call');
    await user.click(
      screen.getByRole('button', { name: 'cv.askedStarterAdd' }),
    );

    expect(box).toHaveValue('cv.askedPrefixFirston-call\ncv.askedPrefixAdd');
    expect(box).toHaveFocus();
  });

  it('carried over: says where it comes from, with "Clear" and no starters', async () => {
    const user = userEvent.setup();
    render(
      <Box initial="Put first: on-call." carried="From your CV of 15 Oct." />,
    );

    expect(screen.getByText('From your CV of 15 Oct.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'cv.askedStarterFirst' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'cv.askedClearButton' }),
    );

    expect(screen.getByLabelText('cv.askedField')).toHaveValue('');
    expect(
      screen.queryByText('From your CV of 15 Oct.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'cv.askedStarterFirst' }),
    ).toBeInTheDocument();
  });
});
