import {
  ForgotPasswordFields,
  forgotPasswordSchema,
} from './forgotPasswordSchema';

const messagesOf = (data: unknown) => {
  const result = forgotPasswordSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map(issue => issue.message);
};

describe('forgotPasswordSchema', () => {
  it('accepts an email and trims it', () => {
    const result = forgotPasswordSchema.safeParse({
      [ForgotPasswordFields.email]: ' test@example.com ',
    });
    expect(result.success && result.data[ForgotPasswordFields.email]).toBe(
      'test@example.com',
    );
  });

  it.each([
    [undefined, 'fieldError.emailRequiredError'],
    ['', 'fieldError.emailFormatError'],
    ['invalid-email', 'fieldError.emailFormatError'],
  ])('rejects %j with %s', (email, message) => {
    expect(messagesOf({ [ForgotPasswordFields.email]: email })).toEqual([
      message,
    ]);
  });
});
