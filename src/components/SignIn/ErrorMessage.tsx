// The web version of qd-mobile src/components/SignIn/ErrorMessage.tsx. It is also what the
// website shows where the app shows an error toast: a message in the page, announced by
// screen readers as soon as it appears.
import { type Ref } from 'react';

interface ErrorMessageProps {
  text: string;
  /** To move the focus to the message when it appears (it is not in the tab order). */
  ref?: Ref<HTMLParagraphElement>;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ text, ref }) => {
  return (
    <p
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-control border border-danger/40 bg-danger/5 px-3.5 py-3 text-[15px] leading-normal font-medium text-danger">
      {text}
    </p>
  );
};

export default ErrorMessage;
