import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FilePicker, type FilePickerProps } from './FilePicker';

const renderPicker = (props: Partial<FilePickerProps> = {}) => {
  const onChange = vi.fn();
  const utils = render(
    <FilePicker
      label="File"
      accept="application/pdf,.pdf"
      emptyText="PDF, up to 10 MB"
      chooseLabel="Choose a file"
      changeLabel="Change"
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, input: screen.getByTestId('file-input'), ...utils };
};

const pdf = new File(['%PDF-1.7'], 'maya-okafor-cv.pdf', {
  type: 'application/pdf',
});

describe('FilePicker', () => {
  it('says what can be chosen while nothing is', () => {
    const { input } = renderPicker();

    expect(screen.getByRole('group', { name: 'File' })).toHaveTextContent(
      'PDF, up to 10 MB',
    );
    expect(
      screen.getByRole('button', { name: 'Choose a file' }),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'application/pdf,.pdf');
    expect(input).toHaveAttribute('hidden');
  });

  it('opens the browser’s file window from its button', async () => {
    const { input } = renderPicker();
    const click = vi.spyOn(input, 'click');

    await userEvent.click(
      screen.getByRole('button', { name: 'Choose a file' }),
    );

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('reports the file that was chosen', async () => {
    const { onChange, input } = renderPicker();

    await userEvent.upload(input, pdf);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(pdf);
  });

  it('lets the same file be chosen again', async () => {
    const { onChange, input } = renderPicker();

    await userEvent.upload(input, pdf);
    await userEvent.upload(input, pdf);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('shows the chosen file by its name and size, and offers to change it', () => {
    renderPicker({ file: { name: 'maya-okafor-cv.pdf', size: '184 KB' } });

    const group = screen.getByRole('group', { name: 'File' });
    expect(group).toHaveTextContent('maya-okafor-cv.pdf');
    expect(group).toHaveTextContent('184 KB');
    expect(group).not.toHaveTextContent('PDF, up to 10 MB');
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('shows what is wrong with the file, tied to the control', () => {
    renderPicker({
      file: { name: 'portfolio.pdf', size: '14.2 MB' },
      error: 'This file is 14.2 MB. The limit is 10 MB.',
    });

    const message = screen.getByText(
      'This file is 14.2 MB. The limit is 10 MB.',
    );
    expect(screen.getByRole('group', { name: 'File' })).toHaveAttribute(
      'aria-describedby',
      message.id,
    );
  });

  it('can be switched off', async () => {
    const { input } = renderPicker({ disabled: true });

    expect(
      screen.getByRole('button', { name: 'Choose a file' }),
    ).toBeDisabled();
    expect(input).toBeDisabled();
  });
});
