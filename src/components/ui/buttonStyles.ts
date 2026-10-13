export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'inverse'
  | 'outline'
  | 'text'
  | 'quiet'
  | 'quietDanger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonStyleProps {
  /**
   * primary: filled, for light surfaces. secondary: outlined, next to a primary button on a
   * light surface. danger: filled red, for an action that cannot be undone.
   * inverse: white, for the brand background. outline and text: white on the brand background.
   * quiet: text only, for a second or third action on a light surface. quietDanger: the
   * same in red, for the way into something that cannot be undone.
   */
  variant?: ButtonVariant;
  /** small 44px, medium 48px (form controls), large 52px (hero). */
  size?: ButtonSize;
  className?: string;
}

const BASE =
  'box-border inline-flex cursor-pointer items-center justify-center leading-natural font-bold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'border border-primary bg-surface text-link hover:bg-tint',
  danger: 'bg-danger text-white hover:bg-danger-dark',
  inverse: 'bg-white text-primary-dark hover:bg-tint',
  outline: 'border-2 border-white text-white hover:bg-white/10',
  text: 'text-white hover:bg-white/10',
  quiet: 'text-link hover:bg-tint',
  quietDanger: 'text-danger hover:bg-danger-tint',
};

const SIZES: Record<ButtonSize, string> = {
  small: 'h-11 rounded-control text-base',
  medium: 'h-control rounded-control text-base',
  large: 'h-[52px] rounded-cta text-[17px]',
};

const PADDING: Record<ButtonSize, string> = {
  small: 'px-[18px]',
  medium: 'px-5',
  large: 'px-[26px]',
};

export const buttonClassName = ({
  variant = 'primary',
  size = 'medium',
  className,
}: ButtonStyleProps) =>
  [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    variant === 'text'
      ? 'px-4'
      : variant === 'quiet' || variant === 'quietDanger'
        ? 'px-1.5'
        : PADDING[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');
