// Mirrors qd-mobile src/schemas/completeProfileSchema.ts: the names and the optional date of
// birth of the sign-up form, with the same rules and error keys.
import { z } from 'zod';

import {
  firstNameSchema,
  lastNameSchema,
  optionalDateOfBirthSchema,
} from './signUpSchema';

export enum CompleteProfileFields {
  firstName = 'firstName',
  lastName = 'lastName',
  dob = 'dateOfBirth',
}

export const completeProfileSchema = z.object({
  [CompleteProfileFields.firstName]: firstNameSchema,
  [CompleteProfileFields.lastName]: lastNameSchema,
  [CompleteProfileFields.dob]: optionalDateOfBirthSchema,
});

export type CompleteProfileSchemaType = z.infer<typeof completeProfileSchema>;
