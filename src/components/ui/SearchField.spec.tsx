import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('is a search box named by its label, which also stands in it while it is empty', () => {
    render(
      <SearchField label="Search your skill map" value="" onChange={vi.fn()} />,
    );

    const field = screen.getByRole('searchbox', {
      name: 'Search your skill map',
    });
    expect(field).toHaveAttribute('placeholder', 'Search your skill map');
    expect(field).toHaveValue('');
  });

  it('reports what is typed, as it is typed', async () => {
    const onChange = vi.fn();
    const Search = () => {
      const [value, setValue] = useState('');
      return (
        <SearchField
          label="Search"
          value={value}
          onChange={next => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    };
    render(<Search />);

    await userEvent.type(screen.getByRole('searchbox'), 'go');

    expect(onChange.mock.calls).toEqual([['g'], ['go']]);
    expect(screen.getByRole('searchbox')).toHaveValue('go');
  });
});
