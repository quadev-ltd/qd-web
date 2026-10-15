import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AddResourcePanel,
  type AddResourcePanelProps,
} from './AddResourcePanel';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const pdf = new File(['%PDF-1.7 fictional'], 'maya-okafor-cv.pdf', {
  type: 'application/pdf',
});
const target = {
  path: 'users/uid-1/interview-docs/new/document.pdf',
  contentType: 'application/pdf',
  maxBytes: 10 * 1024 * 1024,
} as const;

const setUp = (props: Partial<AddResourcePanelProps> = {}) => {
  const gateway = createMockProfileGateway();
  gateway.getResource.mockResolvedValue(
    resourceFixture({ id: 'new', status: 'processing', itemCount: 0 }),
  );
  const onClose = vi.fn();
  const utils = renderProfilePage(
    <AddResourcePanel onClose={onClose} {...props} />,
    { gateway, interviewProfile: { uid: 'uid-1', status: 'loaded' } },
  );
  return { onClose, ...utils };
};

const option = (name: 'file' | 'text' | 'link') =>
  screen.getByRole('button', {
    name: new RegExp(`addResource\\.${name}OptionTitle`),
  });
const titleField = () => screen.getByLabelText('addResource.titleLabel');
const submit = () =>
  screen.getByRole('button', { name: 'addResource.submitButton' });
const chooseFile = (file: File) =>
  userEvent.upload(screen.getByTestId('file-input'), file, {
    // The checks of the form are what is tested, not the browser's own filter.
    applyAccept: false,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddResourcePanel', () => {
  describe('how to add', () => {
    it('opens straight on pasted text as a note for "Add a story" (D53)', () => {
      setUp({ kind: 'note' });

      const form = screen.getByRole('dialog', {
        name: 'addResource.textTitle',
      });
      expect(
        within(form).getByRole('radio', { name: 'profile.typeNote' }),
      ).toBeChecked();
    });

    it('offers a file, pasted text or a link', () => {
      setUp();

      const panel = screen.getByRole('dialog', {
        name: 'addResource.choiceTitle',
      });
      expect(panel).toHaveTextContent('addResource.choiceDescription');
      expect(option('file')).toHaveTextContent(
        'addResource.fileOptionDescription',
      );
      expect(option('text')).toHaveTextContent(
        'addResource.textOptionDescription',
      );
      expect(option('link')).toHaveTextContent(
        'addResource.linkOptionDescription',
      );
    });

    it.each([
      ['file', 'addResource.fileTitle'],
      ['text', 'addResource.textTitle'],
      ['link', 'addResource.linkTitle'],
    ] as const)(
      'goes on to the %s form, with the focus on its heading',
      async (name, title) => {
        setUp();

        await userEvent.click(option(name));

        expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: title })).toHaveFocus();
        expect(submit()).toBeEnabled();
      },
    );

    it('closes from its close button, and sends nothing', async () => {
      const { gateway, onClose } = setUp();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'sidePanel.closeAccessibilityLabel',
        }),
      );

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(gateway.createResource).not.toHaveBeenCalled();
    });
  });

  describe('a file', () => {
    const openFileForm = async (props: Partial<AddResourcePanelProps> = {}) => {
      const context = setUp(props);
      context.gateway.createResource.mockResolvedValue({
        resourceId: 'new',
        upload: target,
      });
      await userEvent.click(option('file'));
      return context;
    };

    it('says what can be chosen, and proposes the file name as the title', async () => {
      await openFileForm();

      const file = screen.getByRole('group', { name: 'addResource.fileLabel' });
      expect(file).toHaveTextContent('addResource.fileEmptyText');

      await chooseFile(pdf);

      expect(file).toHaveTextContent('maya-okafor-cv.pdf');
      expect(file).toHaveTextContent('18 B');
      expect(titleField()).toHaveValue('maya-okafor-cv');
      expect(
        screen.getByText('addResource.titleFromFileHint'),
      ).toBeInTheDocument();
      expect(screen.getByText('14 / 100')).toBeInTheDocument();
    });

    it('keeps a title the candidate typed, and drops the hint', async () => {
      await openFileForm();
      await chooseFile(pdf);

      await userEvent.clear(titleField());
      await userEvent.type(titleField(), 'Maya Okafor CV 2026');
      expect(
        screen.queryByText('addResource.titleFromFileHint'),
      ).not.toBeInTheDocument();

      await chooseFile(
        new File(['x'], 'another-file.txt', { type: 'text/plain' }),
      );

      expect(titleField()).toHaveValue('Maya Okafor CV 2026');
    });

    it('follows the file with its proposed title while the candidate typed none', async () => {
      await openFileForm();
      await chooseFile(pdf);

      await chooseFile(
        new File(['x'], 'review-2025.txt', { type: 'text/plain' }),
      );

      expect(titleField()).toHaveValue('review-2025');
    });

    it('asks for a file when the form is sent without one', async () => {
      const { gateway } = await openFileForm();
      await userEvent.type(titleField(), 'My CV');

      await userEvent.click(submit());

      expect(
        screen.getByText('addResource.fileRequiredError'),
      ).toBeInTheDocument();
      expect(gateway.createResource).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a type the backend does not read',
        new File(['x'], 'photo.png', { type: 'image/png' }),
        'addResource.fileTypeError',
      ],
      [
        'an empty file',
        new File([], 'empty.pdf', { type: 'application/pdf' }),
        'addResource.fileEmptyError',
      ],
      [
        'a file over 10 MB',
        Object.defineProperty(
          new File(['x'], 'portfolio.pdf', { type: 'application/pdf' }),
          'size',
          { value: 10 * 1024 * 1024 + 1 },
        ),
        'addResource.fileSizeError',
      ],
    ])('refuses %s before anything is sent', async (_name, file, message) => {
      const { gateway } = await openFileForm();

      await chooseFile(file);

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(submit()).toBeDisabled();
      expect(gateway.createResource).not.toHaveBeenCalled();
    });

    it('takes a file of exactly 10 MB', async () => {
      await openFileForm();

      await chooseFile(
        Object.defineProperty(
          new File(['x'], 'portfolio.pdf', { type: 'application/pdf' }),
          'size',
          { value: 10 * 1024 * 1024 },
        ),
      );

      expect(
        screen.queryByText('addResource.fileSizeError'),
      ).not.toBeInTheDocument();
      expect(submit()).toBeEnabled();
    });

    it('says when the title is longer than 100 characters, and waits for it to be shortened', async () => {
      await openFileForm();
      await chooseFile(pdf);

      fireEvent.change(titleField(), { target: { value: 'a'.repeat(101) } });

      expect(
        await screen.findByText('addResource.titleLengthError'),
      ).toBeInTheDocument();
      expect(screen.getByText('101 / 100')).toHaveClass('text-danger');
      expect(submit()).toBeDisabled();

      fireEvent.change(titleField(), { target: { value: 'a'.repeat(100) } });

      await waitFor(() => expect(submit()).toBeEnabled());
      expect(
        screen.queryByText('addResource.titleLengthError'),
      ).not.toBeInTheDocument();
    });

    it('asks for a title when it is empty', async () => {
      const { gateway } = await openFileForm();
      await chooseFile(pdf);
      await userEvent.clear(titleField());

      await userEvent.click(submit());

      expect(
        await screen.findByText('addResource.titleRequiredError'),
      ).toBeInTheDocument();
      expect(gateway.createResource).not.toHaveBeenCalled();
    });

    it('creates the resource as a CV, uploads the file where the backend says and closes', async () => {
      const { gateway, onClose, store } = await openFileForm();
      await chooseFile(pdf);

      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(gateway.createResource).toHaveBeenCalledExactlyOnceWith({
        source: 'file',
        type: 'cv',
        title: 'maya-okafor-cv',
        contentType: 'application/pdf',
      });
      expect(gateway.uploadFile).toHaveBeenCalledExactlyOnceWith(target, pdf, {
        onProgress: expect.any(Function),
      });
      // In the list from the moment it exists, and again once the file is there.
      expect(gateway.getResource).toHaveBeenCalledTimes(2);
      expect(store.getState().interviewProfile.resources).toEqual([
        resourceFixture({ id: 'new', status: 'processing', itemCount: 0 }),
      ]);
    });

    it('can add the file as a document', async () => {
      const { gateway, onClose } = await openFileForm();
      await chooseFile(new File(['x'], 'review.docx', { type: DOCX }));

      await userEvent.click(
        screen.getByRole('radio', { name: 'profile.typeDocument' }),
      );
      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(gateway.createResource).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'document', contentType: DOCX }),
      );
    });

    it('goes by the extension when the browser names no type', async () => {
      const { gateway, onClose } = await openFileForm();
      await chooseFile(new File(['notes'], 'notes.txt', { type: '' }));

      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(gateway.createResource).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'text/plain' }),
      );
    });

    it('shows how far the upload is, with the form held in place', async () => {
      const { gateway, onClose } = await openFileForm();
      let report: (fraction: number) => void = () => undefined;
      let finish: () => void = () => undefined;
      gateway.uploadFile.mockImplementation(
        (_target, _file, options) =>
          new Promise<void>(resolve => {
            report = options?.onProgress ?? report;
            finish = resolve;
          }),
      );
      await chooseFile(pdf);

      await userEvent.click(submit());
      await screen.findByText('addResource.uploadingLabel');
      report(0.62);

      const bar = await screen.findByRole('progressbar', {
        name: 'addResource.uploadAccessibilityLabel',
      });
      await waitFor(() => expect(bar).toHaveAttribute('value', '62'));
      const busy = screen.getByRole('button', {
        name: 'addResource.submittingButton',
      });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      expect(titleField()).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'addResource.changeFileButton' }),
      ).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();

      finish();

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    describe('opened by "Add your CV"', () => {
      it('adds a CV: there is no type to choose', async () => {
        const { gateway, onClose } = await openFileForm({ kind: 'cv' });

        expect(
          screen.getByRole('dialog', { name: 'addResource.cvFileTitle' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.getByText('profile.typeCv')).toBeInTheDocument();

        await chooseFile(pdf);
        await userEvent.click(submit());

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(gateway.createResource).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'file', type: 'cv' }),
        );
      });
    });

    describe('when it cannot be added', () => {
      it.each([
        [ProfileErrorCode.Network, 'addResource.failedMessage'],
        [ProfileErrorCode.Unknown, 'addResource.failedMessage'],
        [ProfileErrorCode.SignedOut, 'addResource.failedMessage'],
        [ProfileErrorCode.DailyLimit, 'profile.dailyLimitMessage'],
        [ProfileErrorCode.MaxResources, 'profile.fullMessage'],
        [ProfileErrorCode.FlagOff, 'addResource.notAvailableMessage'],
      ])(
        'says why (%s), with the focus on the message, and stays open',
        async (code, message) => {
          const { gateway, onClose, store } = await openFileForm();
          gateway.createResource.mockRejectedValue(new ProfileError(code));
          await chooseFile(pdf);

          await userEvent.click(submit());

          const alert = await screen.findByRole('alert');
          expect(alert).toHaveTextContent(message);
          expect(alert).toHaveFocus();
          expect(onClose).not.toHaveBeenCalled();
          expect(gateway.uploadFile).not.toHaveBeenCalled();
          expect(submit()).toBeEnabled();
          expect(store.getState().interviewProfile.dailyLimitRefused).toBe(
            code === ProfileErrorCode.DailyLimit,
          );
          expect(store.getState().interviewProfile.extractionsToday).toBe(0);
        },
      );

      it('logs the refusal with its code and the uid, never the title', async () => {
        const { gateway } = await openFileForm();
        gateway.createResource.mockRejectedValue(
          new ProfileError(ProfileErrorCode.Unknown),
        );
        await chooseFile(pdf);

        await userEvent.click(submit());
        await screen.findByRole('alert');

        expect(mockLogger.logError).toHaveBeenCalledWith(
          new Error('createResource failed: code=profile/unknown uid=uid-1'),
        );
        expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
          'maya',
        );
      });

      it('can be sent again after a failure', async () => {
        const { gateway, onClose } = await openFileForm();
        gateway.createResource.mockRejectedValueOnce(
          new ProfileError(ProfileErrorCode.Network),
        );
        await chooseFile(pdf);
        await userEvent.click(submit());
        await screen.findByRole('alert');

        await userEvent.click(submit());

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(gateway.createResource).toHaveBeenCalledTimes(2);
      });

      it('offers to upload again when only the upload failed, for the same resource', async () => {
        const { gateway, onClose } = await openFileForm();
        gateway.uploadFile.mockRejectedValueOnce(
          new ProfileError(ProfileErrorCode.Network),
        );
        await chooseFile(pdf);
        await userEvent.click(submit());

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('addResource.uploadFailedMessage');
        // The resource exists: sending the form again would create a second one.
        expect(
          screen.queryByRole('button', { name: 'addResource.submitButton' }),
        ).not.toBeInTheDocument();
        expect(titleField()).toBeDisabled();
        expect(onClose).not.toHaveBeenCalled();

        await userEvent.click(
          screen.getByRole('button', { name: 'addResource.retryUploadButton' }),
        );

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(gateway.createResource).toHaveBeenCalledTimes(1);
        expect(gateway.uploadFile).toHaveBeenCalledTimes(2);
        expect(gateway.uploadFile).toHaveBeenLastCalledWith(target, pdf, {
          onProgress: expect.any(Function),
        });
      });

      it('does not offer the same file again when the file store refused it', async () => {
        const { gateway } = await openFileForm();
        gateway.uploadFile.mockRejectedValue(
          new ProfileError(ProfileErrorCode.UploadRefused),
        );
        await chooseFile(pdf);
        await userEvent.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'addResource.uploadRefusedMessage',
        );
        expect(
          screen.queryByRole('button', {
            name: 'addResource.retryUploadButton',
          }),
        ).not.toBeInTheDocument();
        expect(submit()).toBeEnabled();
      });
    });
  });

  describe('pasted text', () => {
    const textField = () => screen.getByLabelText('addResource.textLabel');
    const openTextForm = async (props: Partial<AddResourcePanelProps> = {}) => {
      const context = setUp(props);
      await userEvent.click(option('text'));
      return context;
    };

    it('adds a note by default, trimmed, and closes', async () => {
      const { gateway, onClose } = await openTextForm();

      await userEvent.type(titleField(), ' Stories for interviews ');
      await userEvent.type(textField(), ' A launch delay. ');
      expect(screen.getByText('22 / 100')).toBeInTheDocument();
      expect(screen.getByText('15 / 50,000')).toBeInTheDocument();
      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(gateway.createResource).toHaveBeenCalledExactlyOnceWith({
        source: 'text',
        type: 'note',
        title: 'Stories for interviews',
        text: 'A launch delay.',
      });
      expect(gateway.uploadFile).not.toHaveBeenCalled();
    });

    it.each([
      ['profile.typeCv', 'cv'],
      ['profile.typeDocument', 'document'],
    ])('can add it as %s', async (label, type) => {
      const { gateway, onClose } = await openTextForm();
      await userEvent.type(titleField(), 'Title');
      await userEvent.type(textField(), 'Text');

      await userEvent.click(screen.getByRole('radio', { name: label }));
      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(gateway.createResource).toHaveBeenCalledWith(
        expect.objectContaining({ type }),
      );
    });

    it('asks for a title and a text when the form is sent empty', async () => {
      const { gateway } = await openTextForm();

      await userEvent.click(submit());

      expect(
        await screen.findByText('addResource.titleRequiredError'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('addResource.textRequiredError'),
      ).toBeInTheDocument();
      expect(gateway.createResource).not.toHaveBeenCalled();
    });

    it('says when the text is longer than 50,000 characters, until it is shortened', async () => {
      const { gateway, onClose } = await openTextForm();
      await userEvent.type(titleField(), 'Project write-ups');

      fireEvent.change(textField(), { target: { value: 'a'.repeat(50_001) } });

      expect(
        await screen.findByText('addResource.textLengthError'),
      ).toBeInTheDocument();
      expect(screen.getByText('50,001 / 50,000')).toHaveClass('text-danger');
      expect(submit()).toBeDisabled();

      fireEvent.change(textField(), { target: { value: 'a'.repeat(50_000) } });

      await waitFor(() => expect(submit()).toBeEnabled());
      await userEvent.click(submit());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(gateway.createResource).toHaveBeenCalledTimes(1);
    });

    it('shows a spinner on the button and holds the form while it is sent', async () => {
      const { gateway } = await openTextForm();
      gateway.createResource.mockReturnValue(new Promise(() => {}));
      await userEvent.type(titleField(), 'Title');
      await userEvent.type(textField(), 'Text');

      await userEvent.click(submit());

      const busy = await screen.findByRole('button', {
        name: 'addResource.submittingButton',
      });
      expect(busy).toBeDisabled();
      expect(titleField()).toBeDisabled();
      expect(textField()).toBeDisabled();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('says when it cannot be added, and keeps what was typed', async () => {
      const { gateway, onClose } = await openTextForm();
      gateway.createResource.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );
      await userEvent.type(titleField(), 'Title');
      await userEvent.type(textField(), 'My text');

      await userEvent.click(submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'addResource.failedMessage',
      );
      expect(textField()).toHaveValue('My text');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('adds a CV with no type to choose when opened by "Add your CV"', async () => {
      const { gateway, onClose } = await openTextForm({ kind: 'cv' });

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      await userEvent.type(titleField(), 'My CV');
      await userEvent.type(textField(), 'Maya Okafor. Product designer.');
      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(gateway.createResource).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'text', type: 'cv' }),
      );
    });
  });

  describe('a link', () => {
    const addressField = () =>
      screen.getByLabelText('addResource.addressLabel');
    const openLinkForm = async () => {
      const context = setUp();
      await userEvent.click(option('link'));
      return context;
    };

    it('explains what can be read, and has no type to choose', async () => {
      await openLinkForm();

      expect(screen.getByText('addResource.addressHint')).toBeInTheDocument();
      expect(addressField()).toHaveAttribute(
        'placeholder',
        'addResource.addressPlaceholder',
      );
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('dialog')).getByText('profile.typeLink'),
      ).toBeInTheDocument();
    });

    it('adds the address of a public page and closes', async () => {
      const { gateway, onClose } = await openLinkForm();

      await userEvent.type(titleField(), 'Conference talk');
      await userEvent.type(
        addressField(),
        'https://talks.example/2025/ledgers',
      );
      await userEvent.click(submit());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(gateway.createResource).toHaveBeenCalledExactlyOnceWith({
        source: 'link',
        type: 'link',
        title: 'Conference talk',
        url: 'https://talks.example/2025/ledgers',
      });
    });

    it.each([
      'http://wiki.fenwickpay.internal/maya',
      'talks.example/ledgers',
      'https://localhost/',
    ])(
      'says when %s is not an address it accepts, in place of the hint',
      async address => {
        const { gateway } = await openLinkForm();
        await userEvent.type(titleField(), 'Team wiki page');

        await userEvent.type(addressField(), address);

        expect(
          await screen.findByText('addResource.addressError'),
        ).toBeInTheDocument();
        expect(
          screen.queryByText('addResource.addressHint'),
        ).not.toBeInTheDocument();
        expect(submit()).toBeDisabled();
        expect(gateway.createResource).not.toHaveBeenCalled();
      },
    );

    it('asks for the address when the form is sent without one', async () => {
      const { gateway } = await openLinkForm();
      await userEvent.type(titleField(), 'Talk');

      await userEvent.click(submit());

      expect(
        await screen.findByText('addResource.addressRequiredError'),
      ).toBeInTheDocument();
      expect(gateway.createResource).not.toHaveBeenCalled();
    });
  });
});
