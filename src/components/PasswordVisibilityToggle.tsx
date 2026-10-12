import { useTranslation } from 'react-i18next';

interface PasswordVisibilityToggleProps {
  isPasswordVisible: boolean;
  onToggle: () => void;
}

/** The "Show" / "Hide" button inside a password field (the `trailing` slot of FormTextInput). */
export const PasswordVisibilityToggle: React.FC<
  PasswordVisibilityToggleProps
> = ({ isPasswordVisible, onToggle }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isPasswordVisible
          ? t('password.hideAccessibilityLabel')
          : t('password.showAccessibilityLabel')
      }
      className="absolute top-0.5 right-1 h-11 min-w-[60px] cursor-pointer rounded-[10px] px-3 text-sm leading-natural font-medium text-link hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60">
      {isPasswordVisible ? t('password.hideButton') : t('password.showButton')}
    </button>
  );
};

export default PasswordVisibilityToggle;
