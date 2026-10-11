// Mirrors qd-mobile src/schemas/signUpSchema.spec.ts (zod 4: `error.issues`), plus the web's
// `terms` field.
import { signUpSchema, SignUpFields } from './signUpSchema';

const messagesOf = (data: unknown) => {
  const result = signUpSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map(issue => issue.message);
};

describe('signUpSchema', () => {
  const validData = {
    [SignUpFields.email]: 'test@example.com',
    [SignUpFields.firstName]: 'John',
    [SignUpFields.lastName]: 'Doe',
    [SignUpFields.dob]: '29/02/2024',
    [SignUpFields.password]: 'Password123!',
    [SignUpFields.passwordConfirmation]: 'Password123!',
    [SignUpFields.terms]: true,
  };

  it('should validate valid data', () => {
    const result = signUpSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail with date in future error', () => {
    const invalidData = { ...validData, [SignUpFields.dob]: '12/12/2050' };
    expect(messagesOf(invalidData)[0]).toBe('fieldError.dobFutureError');
  });

  it('should fail with date invalid error', () => {
    const invalidData = { ...validData, [SignUpFields.dob]: '29/02/2022' };
    expect(messagesOf(invalidData)[0]).toBe('fieldError.dobFormatError');
  });

  it('should fail with invalid email', () => {
    const invalidData = { ...validData, [SignUpFields.email]: 'invalid-email' };
    expect(messagesOf(invalidData)[0]).toBe('fieldError.emailFormatError');
  });

  it('should fail with missing required fields', () => {
    const incompleteData = {
      [SignUpFields.email]: 'test@example.com',
      [SignUpFields.firstName]: undefined,
      [SignUpFields.lastName]: '',
      [SignUpFields.dob]: '',
      [SignUpFields.password]: '',
      [SignUpFields.passwordConfirmation]: '',
      [SignUpFields.terms]: true,
    };

    expect(messagesOf(incompleteData)).toEqual([
      'fieldError.firstNameRequiredError',
      'fieldError.lastNameRequiredError',
      'fieldError.passwordFormatError',
    ]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('accepts a %s date of birth (optional, D16)', (_label, dob) => {
    const result = signUpSchema.safeParse({
      ...validData,
      [SignUpFields.dob]: dob,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a partially typed date of birth', () => {
    const invalidData = { ...validData, [SignUpFields.dob]: '12/0' };
    expect(messagesOf(invalidData)[0]).toBe('fieldError.dobFormatError');
  });

  it('trims names', () => {
    const result = signUpSchema.safeParse({
      ...validData,
      [SignUpFields.firstName]: '  John  ',
    });
    expect(result.success && result.data[SignUpFields.firstName]).toBe('John');
  });

  it('should fail with non-matching passwords', () => {
    const nonMatchingPasswords = {
      ...validData,
      [SignUpFields.passwordConfirmation]: 'differentPassword',
    };
    expect(messagesOf(nonMatchingPasswords)[0]).toBe(
      'fieldError.passwordConfirmationMatchError',
    );
  });

  it.each([
    [SignUpFields.email, undefined, 'fieldError.emailRequiredError'],
    [SignUpFields.email, '', 'fieldError.emailFormatError'],
    [SignUpFields.email, 'a@b', 'fieldError.emailFormatError'],
    [SignUpFields.firstName, '   ', 'fieldError.firstNameRequiredError'],
    [SignUpFields.firstName, 'x'.repeat(31), 'fieldError.firstNameLengthError'],
    [SignUpFields.lastName, undefined, 'fieldError.lastNameRequiredError'],
    [SignUpFields.lastName, 'x'.repeat(31), 'fieldError.lastNameLengthError'],
    [SignUpFields.dob, '2000/12/12', 'fieldError.dobFormatError'],
    [SignUpFields.dob, '31/04/2000', 'fieldError.dobFormatError'],
    [SignUpFields.password, undefined, 'fieldError.passwordRequiredError'],
    [
      SignUpFields.passwordConfirmation,
      undefined,
      'fieldError.passwordConfirmationRequiredError',
    ],
    [SignUpFields.terms, undefined, 'fieldError.termsRequiredError'],
    [SignUpFields.terms, false, 'fieldError.termsRequiredError'],
  ])('rejects %s = %j with %s', (field, value, message) => {
    expect(messagesOf({ ...validData, [field]: value })).toEqual([message]);
  });

  it.each(['password', 'Passw0rd', 'Pa1!', 'PASSWORD123!', ''])(
    'rejects the password %j with fieldError.passwordFormatError',
    password => {
      expect(
        messagesOf({
          ...validData,
          [SignUpFields.password]: password,
          [SignUpFields.passwordConfirmation]: password,
        }),
      ).toEqual(['fieldError.passwordFormatError']);
    },
  );

  // zod 4 runs the confirmation check even when another field is invalid (zod 3, in the
  // app, reports the mismatch only once the other fields are valid).
  it('reports a weak password and a different confirmation together', () => {
    expect(
      messagesOf({ ...validData, [SignUpFields.password]: 'password' }),
    ).toEqual([
      'fieldError.passwordFormatError',
      'fieldError.passwordConfirmationMatchError',
    ]);
  });

  it.each([
    [SignUpFields.firstName, 'x'.repeat(30)],
    [SignUpFields.lastName, 'x'],
    [SignUpFields.email, '  test@example.com  '],
    [SignUpFields.dob, '01/01/1990'],
  ])('accepts %s = %j', (field, value) => {
    expect(messagesOf({ ...validData, [field]: value })).toEqual([]);
  });
});
