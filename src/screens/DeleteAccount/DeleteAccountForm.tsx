// The confirmation of qd-mobile src/screens/DeleteAccount/DeleteAccountScreen.tsx: the same
// texts and steps. Different on the web (approved with the designs): a Cancel button; while
// the account is being deleted the card stays in place, disabled, and the button shows the
// spinner (the app replaces the screen with a spinner); and a sentence that points to the
// Google window, which the app does not open.
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDeleteAccount } from './useDeleteAccount';

import FormTextInput from '@/components/FormTextInput';
import PasswordVisibilityToggle from '@/components/PasswordVisibilityToggle';
import ErrorMessage from '@/components/SignIn/ErrorMessage';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { ACCOUNT_PATH } from '@/core/auth/paths';

const TEXT = 'text-base leading-[1.55] text-muted';

export const DeleteAccountForm: React.FC = () => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    handleDeleteAccount,
    reauthMethod,
    isDeleting,
    needsPassword,
    errorMessage,
  } = useDeleteAccount();
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // The password step replaces the first question: go on typing in the field. After a
  // wrong password too, so it can be typed again (the message is announced by itself).
  useEffect(() => {
    if (isDeleting) {
      return;
    }
    if (needsPassword) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    } else if (errorMessage) {
      errorRef.current?.focus();
    }
  }, [needsPassword, errorMessage, isDeleting]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleDeleteAccount(needsPassword ? password : undefined);
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className={TEXT}>
        {needsPassword
          ? t('deleteAccount.reauthDescription')
          : t('deleteAccount.description')}
      </p>
      {needsPassword && (
        <FormTextInput
          ref={passwordRef}
          label={t('deleteAccount.passwordLabel')}
          type={isPasswordVisible ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={isDeleting}
          trailing={
            <PasswordVisibilityToggle
              isPasswordVisible={isPasswordVisible}
              onToggle={() => setIsPasswordVisible(visible => !visible)}
            />
          }
        />
      )}
      {errorMessage && <ErrorMessage ref={errorRef} text={errorMessage} />}
      {/* Always in the page, so its text is announced when it appears. */}
      <p role="status" className={isDeleting ? TEXT : 'sr-only'}>
        {isDeleting && (
          <>
            <span className="font-medium text-text">
              {t('deleteAccount.deleting')}
            </span>
            {reauthMethod === 'google' && (
              <> {t('deleteAccount.googleWindowNotice')}</>
            )}
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="danger"
          disabled={isDeleting || (needsPassword && password.length === 0)}
          aria-busy={isDeleting}
          className="flex-[1_1_200px] gap-2.5">
          {isDeleting && <Spinner size="small" decorative />}
          {t('deleteAccount.deleteButton')}
        </Button>
        {isDeleting ? (
          <Button variant="secondary" disabled className="flex-[1_1_140px]">
            {t('deleteAccount.cancelButton')}
          </Button>
        ) : (
          <ButtonLink
            to={ACCOUNT_PATH}
            variant="secondary"
            className="flex-[1_1_140px]">
            {t('deleteAccount.cancelButton')}
          </ButtonLink>
        )}
      </div>
    </form>
  );
};

export default DeleteAccountForm;
