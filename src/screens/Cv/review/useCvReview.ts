// The candidate's decisions on a version (research doc 18, slice 2): each one is a callable,
// then the version is read again, so the page shows what the backend keeps.
import { useState } from 'react';

import { type CvChangeDecisionRequest } from '@/core/profile/cvVersions';
import { useCvVersionsActions } from '@/core/profile/CvVersionsProvider';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

/** The "sent" mark has no id of its own in the review: it is the version's. */
export const SENT = 'sent';

export interface CvReview {
  /** The change, the question or SENT being saved. */
  busy?: string;
  /** The one whose last save failed. */
  failed?: string;
  decide: (
    changeId: string,
    decision: CvChangeDecisionRequest,
    text?: string,
  ) => Promise<boolean>;
  /** With no answer, the question is skipped. */
  answer: (questionId: string, answer?: string) => Promise<boolean>;
  markSent: (sent: boolean) => Promise<boolean>;
}

export const useCvReview = (versionId: string): CvReview => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { refreshVersion } = useCvVersionsActions();
  const [busy, setBusy] = useState<string>();
  const [failed, setFailed] = useState<string>();

  const run = async (
    id: string,
    operation: string,
    call: () => Promise<unknown>,
  ) => {
    setBusy(id);
    setFailed(undefined);
    try {
      await call();
      await refreshVersion(versionId).catch(() => null);
      return true;
    } catch (error) {
      logProfileError(operation, error, uid);
      setFailed(id);
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  return {
    busy,
    failed,
    decide: (changeId, decision, text) =>
      run(changeId, 'decideCvChange', () =>
        gateway.decideCvChange(versionId, changeId, decision, text),
      ),
    answer: (questionId, answer) =>
      run(questionId, 'answerCvQuestion', () =>
        gateway.answerCvQuestion(versionId, questionId, answer),
      ),
    markSent: sent =>
      run(SENT, 'markCvVersionSent', () =>
        gateway.markCvVersionSent(versionId, sent),
      ),
  };
};
