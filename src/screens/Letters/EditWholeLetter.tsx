// "Edit the whole letter" (Web-L2-EditAll, D98, doc 22 §11.4, §11.5): the body as one text box,
// the heading, the greeting and the sign-off left to be added from the CV details, "To" and
// "Written as". Two ways to keep it: "Save my version", as written and marked "Edited by you", with
// nothing written again; or "Improve my version", polished as a draft into a new letter.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  COVER_LETTER_DRAFT_MAX_CHARS,
  COVER_LETTER_TEXT_MAX_CHARS,
  type CoverLetter,
  coverLetterBody,
} from '@/core/profile/coverLetters';
import { logProfileError } from '@/core/profile/errors';
import { applicationLetterPath } from '@/core/profile/paths';
import {
  useCoverLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';

export const EditWholeLetter: React.FC<{
  letter: CoverLetter;
  onDone: () => void;
}> = ({ letter, onDone }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { saveText, rewrite } = useCoverLetters(letter.applicationId);
  const { left, reread } = useLettersLeft();
  const [text, setText] = useState(() =>
    coverLetterBody(letter.paragraphs ?? []),
  );
  const [busy, setBusy] = useState<'save' | 'improve'>();
  const [failed, setFailed] = useState<'save' | 'improve'>();
  const length = text.trim().length;
  const empty = length === 0;

  const save = async () => {
    setBusy('save');
    setFailed(undefined);
    try {
      await saveText(letter.id, text.trim());
      onDone();
    } catch (error) {
      logProfileError('saveCoverLetterText', error, uid);
      setFailed('save');
      setBusy(undefined);
    }
  };

  const improve = async () => {
    setBusy('improve');
    setFailed(undefined);
    try {
      const written = await rewrite(letter.id, { draft: text.trim() });
      navigate(applicationLetterPath(letter.applicationId, written));
    } catch (error) {
      logProfileError('rewriteCoverLetter', error, uid);
      setFailed('improve');
      setBusy(undefined);
      reread();
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Card
        as="section"
        elevation="raised"
        aria-label={t('letters.editAllTitle')}
        className="min-w-0 flex-[999_1_560px] gap-4 p-6">
        <FormTextArea
          name="letter"
          rows={20}
          label={t('letters.editAllField')}
          hint={t('letters.editAllHint')}
          value={text}
          onChange={event => setText(event.target.value)}
          disabled={busy !== undefined}
          counter={{ length, max: COVER_LETTER_TEXT_MAX_CHARS }}
        />
        {failed && (
          <Banner tone="danger" role="alert">
            {failed === 'save'
              ? t('letters.saveFailedMessage')
              : t('letters.rewriteFailedMessage')}
          </Banner>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button
            disabled={
              busy !== undefined ||
              empty ||
              length > COVER_LETTER_TEXT_MAX_CHARS
            }
            aria-busy={busy === 'save'}
            onClick={save}
            className="gap-2">
            {busy === 'save' ? (
              <Spinner size="small" decorative />
            ) : (
              <Icon name="check" size={18} />
            )}
            {t('letters.saveVersionButton')}
          </Button>
          <Button
            variant="secondary"
            disabled={
              busy !== undefined ||
              empty ||
              length > COVER_LETTER_DRAFT_MAX_CHARS ||
              left?.left === 0
            }
            aria-busy={busy === 'improve'}
            onClick={improve}
            className="gap-2">
            {busy === 'improve' ? (
              <Spinner size="small" decorative />
            ) : (
              <Icon name="refresh" size={18} />
            )}
            {t('letters.improveVersionButton')}
          </Button>
          <Button
            variant="quiet"
            disabled={busy !== undefined}
            onClick={onDone}>
            {t('letters.cancelButton')}
          </Button>
        </div>
        {length > COVER_LETTER_DRAFT_MAX_CHARS && (
          <p className="text-sm leading-normal text-muted">
            {t('letters.improveTooLong', {
              max: COVER_LETTER_DRAFT_MAX_CHARS.toLocaleString('en-GB'),
            })}
          </p>
        )}
      </Card>
      <Card
        as="aside"
        elevation="raised"
        aria-label={t('letters.twoWaysTitle')}
        className="min-w-0 flex-[1_1_300px] gap-3 p-5">
        <h2 className="font-display text-[18px] leading-tight font-semibold">
          {t('letters.twoWaysTitle')}
        </h2>
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold">
            {t('letters.saveVersionButton')}
          </h3>
          <p className="text-sm leading-normal text-muted">
            {t('letters.saveVersionText')}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold">
            {t('letters.improveVersionButton')}
          </h3>
          <p className="text-sm leading-normal text-muted">
            {t('letters.improveVersionHelp', {
              max: left?.max ?? 10,
            })}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default EditWholeLetter;
