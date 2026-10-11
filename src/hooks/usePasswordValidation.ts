// Mirrors qd-mobile src/hooks/usePasswordValidation.ts: the same rules and the same result.
// The hook computes the result while rendering instead of copying it into state in an effect
// (the web lint rules reject that); an empty password still counts as valid with every
// check false, so no hint shows before the user types.
import { useMemo } from 'react';

export const upperCaseRegex = /[A-Z]/;
export const lowerCaseRegex = /[a-z]/;
export const numberRegex = /[0-9]/;
export const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/;
export const passwordLength = 8;

export interface PasswordValidityAttributes {
  isValid: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasLength: boolean;
  [key: string]: boolean;
}

export const isPasswordValid = (
  password: string,
): PasswordValidityAttributes => {
  const checkUpperCase = upperCaseRegex.test(password);
  const checkLowerCase = lowerCaseRegex.test(password);
  const checkNumber = numberRegex.test(password);
  const checkSpecialChar = specialCharRegex.test(password);
  const checkLength = password.length >= passwordLength;
  const isValid =
    checkUpperCase &&
    checkLowerCase &&
    checkNumber &&
    checkSpecialChar &&
    checkLength;
  return {
    isValid,
    hasUpperCase: checkUpperCase,
    hasLowerCase: checkLowerCase,
    hasNumber: checkNumber,
    hasSpecialChar: checkSpecialChar,
    hasLength: checkLength,
  };
};

const NOTHING_TYPED: PasswordValidityAttributes = {
  isValid: true,
  hasUpperCase: false,
  hasLowerCase: false,
  hasNumber: false,
  hasSpecialChar: false,
  hasLength: false,
};

export const usePasswordValidation = (
  password?: string,
): PasswordValidityAttributes =>
  useMemo(
    () => (password ? isPasswordValid(password) : NOTHING_TYPED),
    [password],
  );
