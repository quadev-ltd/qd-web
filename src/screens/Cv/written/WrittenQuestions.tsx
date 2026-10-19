// The writer's questions (doc 13 §20.1, doc 19 §3.3): facts nobody gave, each answered in the
// candidate's words ("Save the answer") or skipped. An answer changes nothing by itself: "Write
// again with my answers" makes a new version from the profile and the answers, keeping the lines
// edited and leaving out the ones removed. With no answer it writes again from the profile as it
// is now. The version written again from stays.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Badge } from '../review/CvDocument';
import { type CvReview } from '../review/useCvReview';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  CV_LINE_MAX_CHARS,
  CV_VERSIONS_MAX,
  type CvWrittenQuestion,
  type CvWrittenVersion,
} from '@/core/profile/cvVersions';
import {
  useCvDailyLimit,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { cvVersionPath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

const Question: React.FC<{
  question: CvWrittenQuestion;
  number: number;
  review: CvReview;
}> = ({ question, number, review }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(question.status === 'open');
  const [answer, setAnswer] = useState(question.answer ?? '');
  const busy = review.busy === question.id;
  const trimmed = answer.trim();

  const save = async (words?: string) => {
    if (await review.answer(question.id, words)) {
      setOpen(false);
    }
  };

  return (
    <li className="flex flex-col gap-2.5 border-border-faint py-3.5 not-first:border-t">
      <div className="flex flex-wrap items-center gap-2">
        <Badge label={`?${number}`} tone="info" />
        {question.status === 'answered' && (
          <Chip tone="success" icon="check">
            {t('cv.answeredChip')}
          </Chip>
        )}
        {question.status === 'skipped' && (
          <Chip tone="neutral">{t('cv.questionSkipped')}</Chip>
        )}
      </div>
      <h3 className="text-[15px] leading-normal font-semibold">
        <span className="sr-only">{t('cv.questionNumber', { number })} </span>
        {question.text}
      </h3>
      {open ? (
        <form
          noValidate
          onSubmit={event => {
            event.preventDefault();
            if (trimmed && trimmed.length <= CV_LINE_MAX_CHARS) {
              save(trimmed);
            }
          }}
          className="flex flex-col gap-2.5">
          <FormTextArea
            name={`answer-${question.id}`}
            label={t('cv.yourAnswer')}
            placeholder={t('cv.answerPlaceholder')}
            hint={t('cv.writtenAnswerHint')}
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            counter={{ length: trimmed.length, max: CV_LINE_MAX_CHARS }}
            disabled={busy}
            rows={3}
          />
          {review.failed === question.id && (
            <Banner tone="danger" role="alert">
              {t('cv.answerFailedMessage')}
            </Banner>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="small"
              disabled={busy || !trimmed || trimmed.length > CV_LINE_MAX_CHARS}
              aria-busy={busy}
              className="gap-2">
              {busy && <Spinner size="small" decorative />}
              {t('cv.saveAnswerButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => {
                save(undefined);
              }}>
              {t('cv.skipButton')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {question.status === 'answered' && question.answer && (
            <p className="text-sm leading-normal text-muted wrap-anywhere">
              {t('cv.answeredText', { answer: question.answer })}
            </p>
          )}
          <Button
            variant="quiet"
            size="small"
            onClick={() => setOpen(true)}
            className="gap-2 self-start">
            <Icon name="edit" size={18} />
            {t('cv.changeAnswerButton')}
          </Button>
        </>
      )}
    </li>
  );
};

export const WrittenQuestions: React.FC<{
  version: CvWrittenVersion;
  review: CvReview;
}> = ({ version, review }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { refreshVersion, refreshToday } = useCvVersionsActions();
  const max = useCvDailyLimit();
  const [writing, setWriting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const { questions } = version;
  const answered = questions.filter(
    ({ status, answer }) => status === 'answered' && answer,
  ).length;

  const writeAgain = async () => {
    setWriting(true);
    setErrorMessage(undefined);
    try {
      const { versionId } = await gateway.rewriteCvVersion(version.id);
      await refreshVersion(versionId).catch(() => null);
      navigate(cvVersionPath(versionId));
    } catch (error) {
      logProfileError('rewriteCvVersion', error, uid);
      switch (getProfileErrorCode(error)) {
        case ProfileErrorCode.DailyLimit:
          setErrorMessage(
            t('cv.limitMessage', { max, time: dailyLimitResetTime() }),
          );
          break;
        case ProfileErrorCode.MaxCvVersions:
          setErrorMessage(t('cv.maxMessage', { max: CV_VERSIONS_MAX }));
          break;
        default:
          setErrorMessage(t('cv.rewriteFailedMessage'));
      }
      refreshToday();
      setWriting(false);
    }
  };

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="cv-questions"
      className="gap-3 p-5">
      {questions.length > 0 && (
        <>
          <h2
            id="cv-questions"
            className="font-display text-[18px] leading-tight font-semibold">
            {t('cv.writtenQuestionsTitle', { count: questions.length })}
          </h2>
          <p className="text-[15px] leading-normal text-muted">
            {t('cv.writtenQuestionsText')}
          </p>
          <ol className="flex flex-col">
            {questions.map((question, index) => (
              <Question
                key={question.id}
                question={question}
                number={index + 1}
                review={review}
              />
            ))}
          </ol>
        </>
      )}
      <div
        className={`flex flex-col gap-2.5 ${questions.length > 0 ? 'border-t border-border-faint pt-3.5' : ''}`}>
        {questions.length === 0 && (
          <h2 id="cv-questions" className="sr-only">
            {t('cv.writeAgainButton')}
          </h2>
        )}
        {errorMessage && (
          <Banner tone="danger" role="alert">
            {errorMessage}
          </Banner>
        )}
        <Button
          variant={answered > 0 ? 'primary' : 'secondary'}
          disabled={writing}
          aria-busy={writing}
          onClick={() => {
            writeAgain();
          }}
          className="gap-2 self-start">
          {writing ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="refresh" size={18} />
          )}
          {writing
            ? t('cv.writingAgainButton')
            : answered > 0
              ? t('cv.writeAgainWithAnswers', { count: answered })
              : t('cv.writeAgainButton')}
        </Button>
        <p className="text-sm leading-normal text-muted">
          {t(
            answered > 0 ? 'cv.writeAgainWithAnswersText' : 'cv.writeAgainText',
            { max },
          )}
        </p>
      </div>
    </Card>
  );
};

export default WrittenQuestions;
