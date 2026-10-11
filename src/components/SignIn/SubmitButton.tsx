import { type ReactNode } from 'react';

import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';

interface SubmitButtonProps {
  isLoading: boolean;
  children: ReactNode;
}

/**
 * The button that sends a sign-in form. While the request runs it is disabled and shows a
 * spinner; the fields stay in place (the app replaces the whole form with a spinner).
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isLoading,
  children,
}) => (
  <Button
    type="submit"
    disabled={isLoading}
    aria-busy={isLoading}
    className="w-full gap-2.5">
    {isLoading && <Spinner size="small" decorative />}
    {children}
  </Button>
);

export default SubmitButton;
