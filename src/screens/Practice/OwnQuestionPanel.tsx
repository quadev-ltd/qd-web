// "Practise a question of your own" (X7, D94): a side panel over the interview's page, with the
// question (up to 300 characters) and "Start practising". Its key points are written from the
// profile like any other's, so it spends one of the day's practice calls.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type PracticeFailure,
  PracticeFailureBanner,
  practiceFailureOf,
} from './practiceFailure';

import FormTextArea from '@/components/FormTextArea';
import SidePanel from '@/components/ui/SidePanel';
import { logProfileError } from '@/core/profile/errors';
import { PRACTICE_QUESTION_MAX_CHARS } from '@/core/profile/practice';
import { usePractice } from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';

export interface OwnQuestionPanelProps {
  applicationId: string;
  interviewId?: string;
  /** "Senior Backend Engineer · Northwind Logistics". */
  description: string;
  /** "38 of 40 practice calls left today", when known. */
  left: { left: number; max: number } | null;
  onClose: () => void;
  /** The practice is stored: open it. */
  onStarted: (turnId: string) => void;
  /** A refusal or a failure was counted: today's calls are read again. */
  onCounted: () => void;
}

export const OwnQuestionPanel: React.FC<OwnQuestionPanelProps> = ({
  applicationId,
  interviewId,
  description,
  left,
  onClose,
  onStarted,
  onCounted,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const { start } = usePractice();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<PracticeFailure | null>(null);
  const length = text.trim().length;
  const tooLong = length > PRACTICE_QUESTION_MAX_CHARS;
  const noneLeft = left?.left === 0 || failure === 'limit';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (length === 0) {
      setError(t('practice.ownRequiredError'));
      return;
    }
    if (tooLong) {
      setError(t('practice.ownLengthError'));
      return;
    }
    setError(undefined);
    setFailure(null);
    setIsBusy(true);
    try {
      const turnId = await start({
        applicationId,
        ...(interviewId ? { interviewId } : {}),
        question: { source: 'typed', text: text.trim() },
      });
      onStarted(turnId);
    } catch (reason) {
      logProfileError('startPracticeTurn', reason, uid);
      setFailure(practiceFailureOf(reason));
      setIsBusy(false);
      onCounted();
    }
  };

  return (
    <SidePanel
      title={t('practice.ownTitle')}
      description={description}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <FormTextArea
          name="question"
          rows={3}
          label={t('practice.ownField')}
          hint={t('practice.ownHint')}
          value={text}
          onChange={event => {
            setText(event.target.value);
            setError(undefined);
          }}
          disabled={isBusy}
          error={error ? { type: 'manual', message: error } : undefined}
          counter={{ length, max: PRACTICE_QUESTION_MAX_CHARS }}
        />
        <p className="text-sm leading-normal text-muted">
          {t('practice.ownNote')}
          {left && !noneLeft && <> {t('practice.callsLeft', left)}.</>}
        </p>
        {failure && failure !== 'model' && (
          <PracticeFailureBanner failure={failure} max={left?.max} />
        )}
        <SubmitFooter
          errorMessage={
            failure === 'model' ? t('practice.failedMessage') : undefined
          }
          isBusy={isBusy}
          blocked={tooLong || noneLeft}
          label={t('practice.ownSubmit')}
          busyLabel={t('practice.startingButton')}
        />
      </form>
    </SidePanel>
  );
};

export default OwnQuestionPanel;
