import { itemTextSchema } from './itemTextSchema';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map(issue => issue.message) ?? [];

describe('the text of an item', () => {
  it('is trimmed', () => {
    expect(itemTextSchema.parse({ text: '  Go in production.  ' })).toEqual({
      text: 'Go in production.',
    });
  });

  it('cannot be empty', () => {
    expect(messages(itemTextSchema.safeParse({ text: '  ' }))).toEqual([
      'item.textRequiredError',
    ]);
  });

  it('takes 600 characters and refuses 601', () => {
    expect(itemTextSchema.safeParse({ text: 'a'.repeat(600) }).success).toBe(
      true,
    );
    expect(
      messages(itemTextSchema.safeParse({ text: 'a'.repeat(601) })),
    ).toEqual(['item.textLengthError']);
  });
});
