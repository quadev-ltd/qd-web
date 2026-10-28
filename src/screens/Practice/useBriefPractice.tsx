// "Practise this question" on the brief's likely questions (D94, doc 15 §25.4 choice 5), with the
// `textPractice` flag: each question's newest practice, found by its text, and the practice calls
// left today under the questions.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  type PracticeFailure,
  PracticeFailureBanner,
  practiceFailureOf,
} from './practiceFailure';

import { useFlag } from '@/core/flags/FlagsProvider';
import { isJobPending, type JobApplication } from '@/core/profile/applications';
import { useApplicationsActions } from '@/core/profile/ApplicationsProvider';
import { logProfileError } from '@/core/profile/errors';
import { applicationPracticePath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import {
  usePractice,
  usePracticeLeft,
  usePracticeMarks,
} from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';
import { type BriefPractice } from '@/screens/Applications/BriefCards';

export const useBriefPractice = (
  application: JobApplication,
): BriefPractice | undefined => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const textPractice = useFlag('textPractice');
  const { refreshApplication } = useApplicationsActions();
  const practice = usePractice();
  const { left, counted } = usePracticeLeft();
  const [failure, setFailure] = useState<{
    failure: PracticeFailure;
    text: string;
  } | null>(null);
  const marks = usePracticeMarks(
    textPractice
      ? reader => gateway.getBriefPracticeTurns(reader, application.id)
      : null,
    turn => turn.question.text,
    application.id,
  );
  // A practice started here opens when it is stored, unless the candidate has left the page.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!textPractice) {
    return undefined;
  }

  const request = (text: string) => ({
    applicationId: application.id,
    question: { source: 'brief' as const, text },
  });
  const disabled =
    practice.anyStarting ||
    isJobPending(application) ||
    left?.left === 0 ||
    failure?.failure === 'limit' ||
    failure?.failure === 'turnLimit';

  const practise = async (text: string) => {
    setFailure(null);
    try {
      const turnId = await practice.start(request(text));
      if (mounted.current) {
        navigate(applicationPracticePath(application.id, turnId));
      }
    } catch (error) {
      logProfileError('startPracticeTurn', error, uid);
      const reason = practiceFailureOf(error);
      // The brief was prepared again elsewhere: show it as it is now.
      if (reason === 'changed') {
        await refreshApplication(application.id).catch(() => null);
      }
      if (mounted.current) {
        setFailure({ failure: reason, text });
      }
      counted();
    }
  };

  return {
    marks,
    isStarting: text => practice.isStarting(request(text)),
    disabled,
    onPractise: practise,
    pathOf: turnId => applicationPracticePath(application.id, turnId),
    footer: (
      <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
        {failure && (
          <PracticeFailureBanner
            failure={failure.failure}
            max={left?.max}
            retryDisabled={disabled}
            onRetry={() => practise(failure.text)}
          />
        )}
        {left && failure?.failure !== 'limit' && (
          <p className="text-sm leading-normal text-muted">
            {t('practice.callsLeft', left)}
          </p>
        )}
      </div>
    ),
  };
};

export default useBriefPractice;
