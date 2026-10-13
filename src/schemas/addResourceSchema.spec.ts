import {
  addFileSchema,
  addLinkSchema,
  addTextSchema,
} from './addResourceSchema';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map(issue => issue.message) ?? [];

describe('the add-a-resource forms', () => {
  describe('a file', () => {
    it('accepts a title and CV or document, and trims the title', () => {
      expect(
        addFileSchema.parse({ title: '  Maya Okafor CV 2026 ', type: 'cv' }),
      ).toEqual({ title: 'Maya Okafor CV 2026', type: 'cv' });
      expect(
        addFileSchema.safeParse({ title: 'Review', type: 'document' }).success,
      ).toBe(true);
    });

    it('asks for a title', () => {
      expect(
        messages(addFileSchema.safeParse({ title: '   ', type: 'cv' })),
      ).toEqual(['addResource.titleRequiredError']);
    });

    it('takes a title of 100 characters and refuses one of 101', () => {
      expect(
        addFileSchema.safeParse({ title: 'a'.repeat(100), type: 'cv' }).success,
      ).toBe(true);
      expect(
        messages(
          addFileSchema.safeParse({ title: 'a'.repeat(101), type: 'cv' }),
        ),
      ).toEqual(['addResource.titleLengthError']);
    });

    it('does not count the spaces around a title', () => {
      expect(
        addFileSchema.safeParse({
          title: `  ${'a'.repeat(100)}  `,
          type: 'cv',
        }).success,
      ).toBe(true);
    });

    it.each(['note', 'link', ''])('refuses the type "%s"', type => {
      expect(addFileSchema.safeParse({ title: 'CV', type }).success).toBe(
        false,
      );
    });
  });

  describe('pasted text', () => {
    const valid = { title: 'Stories', type: 'note', text: 'A launch delay.' };

    it.each(['cv', 'document', 'note'])('accepts the type "%s"', type => {
      expect(addTextSchema.safeParse({ ...valid, type }).success).toBe(true);
    });

    it('refuses a link as a type', () => {
      expect(addTextSchema.safeParse({ ...valid, type: 'link' }).success).toBe(
        false,
      );
    });

    it('asks for the text', () => {
      expect(
        messages(addTextSchema.safeParse({ ...valid, text: ' \n ' })),
      ).toEqual(['addResource.textRequiredError']);
    });

    it('takes 50,000 characters and refuses 50,001', () => {
      expect(
        addTextSchema.safeParse({ ...valid, text: 'a'.repeat(50_000) }).success,
      ).toBe(true);
      expect(
        messages(
          addTextSchema.safeParse({ ...valid, text: 'a'.repeat(50_001) }),
        ),
      ).toEqual(['addResource.textLengthError']);
    });
  });

  describe('a link', () => {
    it('accepts the https address of a public page', () => {
      expect(
        addLinkSchema.parse({
          title: 'Conference talk',
          url: ' https://talks.example/2025/ledgers ',
        }),
      ).toEqual({
        title: 'Conference talk',
        url: 'https://talks.example/2025/ledgers',
      });
    });

    it('asks for the address', () => {
      expect(
        messages(addLinkSchema.safeParse({ title: 'Talk', url: '' })),
      ).toEqual(['addResource.addressRequiredError']);
    });

    it.each([
      'http://talks.example/',
      'talks.example/ledgers',
      'https://wiki.fenwickpay.internal/maya',
      'https://localhost/',
      'https://10.0.0.1/',
    ])('refuses %s', url => {
      expect(messages(addLinkSchema.safeParse({ title: 'Talk', url }))).toEqual(
        ['addResource.addressError'],
      );
    });
  });
});
