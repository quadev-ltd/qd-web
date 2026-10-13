import { useId } from 'react';

import Icon, { type IconName } from '@/components/Icon';
import Spinner from '@/components/Spinner';

export interface SwitchProps {
  label: string;
  /** One line under the label: what "on" means. */
  description?: string;
  icon?: IconName;
  checked: boolean;
  /** The change is on its way to the backend: the switch waits, and shows it. */
  busy?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Something that is on or off, changed at once (no "Save"). It is a button with the switch
 * role: Space or Enter flips it. While `busy` it keeps the value it had: the new one is
 * shown when the backend has accepted it.
 */
export const Switch: React.FC<SwitchProps> = ({
  label,
  description,
  icon,
  checked,
  busy = false,
  disabled = false,
  onChange,
}) => {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control py-1.5 text-left disabled:cursor-not-allowed">
      {icon && (
        <span className="flex text-primary">
          <Icon name={icon} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          id={`${id}-label`}
          className="text-base leading-normal font-medium">
          {label}
        </span>
        {description && (
          <span
            id={`${id}-description`}
            className="text-sm leading-normal text-muted">
            {description}
          </span>
        )}
      </span>
      {busy && (
        <span className="flex text-primary">
          <Spinner size="small" decorative />
        </span>
      )}
      <span
        aria-hidden="true"
        className={`flex h-8 w-[52px] flex-none items-center rounded-full p-[3px] ${
          checked ? 'justify-end bg-primary' : 'justify-start bg-muted'
        } ${disabled || busy ? 'opacity-60' : ''}`}>
        <span className="block size-[26px] rounded-full bg-surface" />
      </span>
    </button>
  );
};

export default Switch;
