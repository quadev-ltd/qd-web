import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormTextArea } from './FormTextArea';

describe('FormTextArea', () => {
  it('names the field with a visible label, eight lines tall by default', () => {
    render(<FormTextArea label="Text" />);

    const field = screen.getByLabelText('Text');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '8');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('reports what is typed and passes the attributes on', async () => {
    const onChange = vi.fn();
    render(
      <FormTextArea
        label="Text"
        rows={3}
        placeholder="Paste here"
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByLabelText('Text'), 'ab');

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Text')).toHaveAttribute('rows', '3');
    expect(screen.getByLabelText('Text')).toHaveAttribute(
      'placeholder',
      'Paste here',
    );
  });

  it('ties the error, the hint and the counter to the field', () => {
    render(
      <FormTextArea
        label="Text"
        error={{ type: 'too_big', message: 'This is too long.' }}
        hint="Up to 50,000 characters."
        counter={{ length: 50_412, max: 50_000 }}
      />,
    );

    const field = screen.getByLabelText('Text');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(
      'This is too long. Up to 50,000 characters. 50,412 / 50,000',
    );
  });

  it('counts with thousands separators, in red once past the limit', () => {
    const { rerender } = render(
      <FormTextArea label="Text" counter={{ length: 262, max: 50_000 }} />,
    );
    expect(screen.getByText('262 / 50,000')).toHaveClass('text-muted');

    rerender(
      <FormTextArea label="Text" counter={{ length: 50_001, max: 50_000 }} />,
    );
    expect(screen.getByText('50,001 / 50,000')).toHaveClass(
      'text-danger',
      'font-bold',
    );

    rerender(
      <FormTextArea label="Text" counter={{ length: 50_000, max: 50_000 }} />,
    );
    expect(screen.getByText('50,000 / 50,000')).toHaveClass('text-muted');
  });
});
