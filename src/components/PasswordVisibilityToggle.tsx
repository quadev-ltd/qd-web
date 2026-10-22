import { useTranslation } from 'react-i18next';

interface PasswordVisibilityToggleProps {
  isPasswordVisible: boolean;
  onToggle: () => void;
  /** In the confirmation field, so its name tells it from the password's button. */
  confirmation?: boolean;
}

/** The "Show" / "Hide" button inside a password field (the `trailing` slot of FormTextInput). */
export const PasswordVisibilityToggle: React.FC<
  PasswordVisibilityToggleProps
> = ({ isPasswordVisible, onToggle, confirmation = false }) => {
  const { t } = useTranslation();
  const label = confirmation
    ? isPasswordVisible
      ? t('password.hideConfirmationAccessibilityLabel')
      : t('password.showConfirmationAccessibilityLabel')
    : isPasswordVisible
      ? t('password.hideAccessibilityLabel')
      : t('password.showAccessibilityLabel');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className="absolute top-0.5 right-1 h-11 min-w-[60px] cursor-pointer rounded-[10px] px-3 text-sm leading-natural font-medium text-link hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60">
      {isPasswordVisible ? t('password.hideButton') : t('password.showButton')}
    </button>
  );
};

export default PasswordVisibilityToggle;
