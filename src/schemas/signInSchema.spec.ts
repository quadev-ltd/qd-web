import { SignInFields, signInSchema } from './signInSchema';

const messagesOf = (data: unknown) => {
  const result = signInSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map(issue => issue.message);
};

describe('signInSchema', () => {
  const validData = {
    [SignInFields.email]: 'test@example.com',
    [SignInFields.password]: 'Password123!',
  };

  it('accepts an email and a password that follows the rules', () => {
    expect(messagesOf(validData)).toEqual([]);
  });

  it('trims the email', () => {
    const result = signInSchema.safeParse({
      ...validData,
      [SignInFields.email]: '  test@example.com ',
    });
    expect(result.success && result.data[SignInFields.email]).toBe(
      'test@example.com',
    );
  });

  it.each([
    [SignInFields.email, undefined, 'fieldError.emailRequiredError'],
    [SignInFields.email, '', 'fieldError.emailFormatError'],
    [SignInFields.email, 'invalid-email', 'fieldError.emailFormatError'],
    [SignInFields.password, undefined, 'fieldError.passwordRequiredError'],
    [SignInFields.password, '', 'fieldError.passwordFormatError'],
    [SignInFields.password, 'password', 'fieldError.passwordFormatError'],
    [SignInFields.password, 'PASSWORD123!', 'fieldError.passwordFormatError'],
    [SignInFields.password, 'Password!!!!', 'fieldError.passwordFormatError'],
  ])('rejects %s = %j with %s', (field, value, message) => {
    expect(messagesOf({ ...validData, [field]: value })).toEqual([message]);
  });

  it('reports both fields when nothing was typed', () => {
    expect(messagesOf({})).toEqual([
      'fieldError.emailRequiredError',
      'fieldError.passwordRequiredError',
    ]);
  });
});
