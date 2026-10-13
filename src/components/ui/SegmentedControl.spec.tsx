import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'cv', label: 'CV' },
  { value: 'document', label: 'Document' },
  { value: 'note', label: 'Note' },
] as const;

describe('SegmentedControl', () => {
  it('is a group of radio buttons named by its label', () => {
    render(
      <SegmentedControl
        label="Type"
        options={options}
        value="document"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Type' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('radio').map(radio => radio.getAttribute('value')),
    ).toEqual(['cv', 'document', 'note']);
    expect(screen.getByRole('radio', { name: 'Document' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'CV' })).not.toBeChecked();
  });

  it('reports the option that is chosen', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Type"
        options={options}
        value="cv"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByText('Note'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('note');
  });

  it('can be worked with the arrow keys, like any radio group', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Type"
        options={options}
        value="cv"
        onChange={onChange}
      />,
    );

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'CV' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('document');
  });

  it('can be switched off as a whole', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Type"
        options={options}
        value="cv"
        onChange={onChange}
        disabled
      />,
    );

    await userEvent.click(screen.getByText('Note'));

    expect(onChange).not.toHaveBeenCalled();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('keeps two controls on one page apart', () => {
    render(
      <>
        <SegmentedControl
          label="First"
          options={options}
          value="cv"
          onChange={vi.fn()}
        />
        <SegmentedControl
          label="Second"
          options={options}
          value="note"
          onChange={vi.fn()}
        />
      </>,
    );

    const [first, second] = screen.getAllByRole('radio', { name: 'CV' });
    expect(first.getAttribute('name')).not.toBe(second.getAttribute('name'));
    expect(first).toBeChecked();
    expect(second).not.toBeChecked();
  });
});
