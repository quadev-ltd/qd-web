import { type ComponentProps, type ReactNode } from 'react';

interface SSOButtonProps extends Omit<
  ComponentProps<'button'>,
  'type' | 'className'
> {
  icon: ReactNode;
  text: string;
}

/** The white, outlined button shared by the Google and Apple buttons. */
export const SSOButton: React.FC<SSOButtonProps> = ({
  icon,
  text,
  ...props
}) => (
  <button
    type="button"
    className="flex h-control cursor-pointer items-center justify-center gap-3 rounded-control border border-border bg-surface px-3.5 text-base leading-natural font-medium text-text transition-colors hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60"
    {...props}>
    {icon}
    <span>{text}</span>
  </button>
);

export default SSOButton;
