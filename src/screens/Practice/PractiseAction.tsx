// "Practise" on a question (D94, doc 15 §25.4): it starts a practice, which writes the key points
// (a model call, 5 to 15 seconds), then opens it. A question practised already shows "Practised"
// and "Practise again", which opens its newest practice and calls nothing.
import { useTranslation } from 'react-i18next';

import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Chip from '@/components/ui/Chip';
import { type PracticeMark } from '@/core/profile/practice';

/** "Practised", and "Practised · 2 tries" once there are answers (the backend's slice 3). */
export const PractisedChip: React.FC<{ mark: PracticeMark }> = ({ mark }) => {
  const { t } = useTranslation();
  return (
    <Chip tone="success" icon="check">
      {mark.tries > 0
        ? t('practice.practisedTries', { count: mark.tries })
        : t('practice.practisedChip')}
    </Chip>
  );
};

export const PractiseAction: React.FC<{
  /** The question's newest practice, and where it opens. */
  practised?: { mark: PracticeMark; to: string };
  /** This question's practice is being started. */
  starting: boolean;
  /** Another one is being started, or none are left today. */
  disabled: boolean;
  onPractise: () => void;
  /** "Practise", or the brief's "Practise this question". */
  label?: string;
}> = ({ practised, starting, disabled, onPractise, label }) => {
  const { t } = useTranslation();
  if (practised && !starting) {
    return (
      <ButtonLink
        to={practised.to}
        variant="secondary"
        size="small"
        className="self-start text-[15px]">
        {t('practice.practiseAgainButton')}
      </ButtonLink>
    );
  }
  return (
    <Button
      variant="secondary"
      size="small"
      onClick={onPractise}
      disabled={starting || disabled}
      aria-busy={starting}
      className="gap-2 self-start text-[15px]">
      {starting && <Spinner size="small" decorative />}
      {starting
        ? t('practice.startingButton')
        : (label ?? t('practice.practiseButton'))}
    </Button>
  );
};
