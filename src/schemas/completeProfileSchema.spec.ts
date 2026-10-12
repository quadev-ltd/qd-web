// The names and the optional date of birth follow the sign-up rules (signUpSchema.spec.ts
// covers them in detail); this checks that the profile form applies them.
import {
  CompleteProfileFields,
  completeProfileSchema,
} from './completeProfileSchema';

const messagesOf = (data: unknown) => {
  const result = completeProfileSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map(issue => issue.message);
};

describe('completeProfileSchema', () => {
  const validData = {
    [CompleteProfileFields.firstName]: 'Ada',
    [CompleteProfileFields.lastName]: 'Lovelace',
    [CompleteProfileFields.dob]: '',
  };

  it('accepts the names without a date of birth', () => {
    expect(messagesOf(validData)).toEqual([]);
    expect(
      messagesOf({
        [CompleteProfileFields.firstName]: 'Ada',
        [CompleteProfileFields.lastName]: 'Lovelace',
      }),
    ).toEqual([]);
  });

  it('accepts a real, past date of birth', () => {
    expect(
      messagesOf({ ...validData, [CompleteProfileFields.dob]: '10/12/1815' }),
    ).toEqual([]);
  });

  it('trims the names', () => {
    const result = completeProfileSchema.safeParse({
      ...validData,
      [CompleteProfileFields.firstName]: '  Ada ',
      [CompleteProfileFields.lastName]: ' Lovelace  ',
    });

    expect(result.success && result.data).toMatchObject({
      [CompleteProfileFields.firstName]: 'Ada',
      [CompleteProfileFields.lastName]: 'Lovelace',
    });
  });

  it.each([
    [CompleteProfileFields.firstName, undefined, 'firstNameRequiredError'],
    [CompleteProfileFields.firstName, '   ', 'firstNameRequiredError'],
    [CompleteProfileFields.firstName, 'a'.repeat(31), 'firstNameLengthError'],
    [CompleteProfileFields.lastName, undefined, 'lastNameRequiredError'],
    [CompleteProfileFields.lastName, '', 'lastNameRequiredError'],
    [CompleteProfileFields.lastName, 'a'.repeat(31), 'lastNameLengthError'],
    [CompleteProfileFields.dob, '31/02/2020', 'dobFormatError'],
    [CompleteProfileFields.dob, '1815-12-10', 'dobFormatError'],
    [CompleteProfileFields.dob, '01/01/2999', 'dobFutureError'],
  ])('rejects %s = %j with %s', (field, value, error) => {
    expect(messagesOf({ ...validData, [field]: value })).toEqual([
      `fieldError.${error}`,
    ]);
  });

  it('accepts names of exactly 30 characters', () => {
    expect(
      messagesOf({
        ...validData,
        [CompleteProfileFields.firstName]: 'a'.repeat(30),
        [CompleteProfileFields.lastName]: 'b'.repeat(30),
      }),
    ).toEqual([]);
  });
});
