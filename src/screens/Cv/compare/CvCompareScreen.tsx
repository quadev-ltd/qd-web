// "Compare two versions" (C3, FR-28): two versions of the same CV for the same job (or both
// general), what differs between their texts, and "Restore" for the earlier one, which makes a
// copy that becomes the newest (copyCvVersion). Nothing is overwritten.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { versionDay, versionHeading } from '../cvMeta';

import { diffLines, type DiffRow } from './diffLines';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip, { type ChipProps } from '@/components/ui/Chip';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { type CvVersion, cvVersionText } from '@/core/profile/cvVersions';
import {
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import { logProfileError } from '@/core/profile/errors';
import { CV_PATH, cvVersionPath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const KIND_CHIPS = {
  changed: 'brand',
  added: 'success',
  removed: 'danger',
  same: 'neutral',
} as const satisfies Record<DiffRow['kind'], ChipProps['tone']>;

/** The two versions compared, in their order. */
const SIDES = ['earlier', 'later'] as const;

/** What a version is for, so only versions for the same thing are compared. */
const targetOf = ({ target }: Pick<CvVersion, 'target'>) =>
  target.kind === 'job' ? `job:${target.applicationId}` : 'general';

const Cell: React.FC<{
  text?: string;
  side: 'earlier' | 'later';
  tinted: boolean;
}> = ({ text, side, tinted }) => {
  const { t } = useTranslation();
  if (text === undefined) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-sm leading-normal text-muted">
        {t('cv.notInVersion')}
      </p>
    );
  }
  const tint = !tinted
    ? 'bg-background'
    : side === 'earlier'
      ? 'bg-danger-tint'
      : 'bg-success-tint';
  return (
    <p
      className={`rounded-[10px] px-3 py-2.5 text-[15px] leading-normal wrap-anywhere ${tint}`}>
      <span className="sr-only">
        {t(side === 'earlier' ? 'cv.earlierLine' : 'cv.laterLine')}
      </span>
      {text}
    </p>
  );
};

export const CvCompareScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [params, setParams] = useSearchParams();
  const { status, versions } = useCvVersions();
  const { refreshVersion } = useCvVersionsActions();
  const { applications } = useApplications();
  const [onlyDiffers, setOnlyDiffers] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);

  const later = versions.find(({ id }) => id === params.get('later'));
  const choices = later
    ? versions.filter(
        version =>
          version.status === 'ready' && targetOf(version) === targetOf(later),
      )
    : [];
  const earlier =
    choices.find(
      ({ id }) => id === params.get('earlier') && id !== later?.id,
    ) ??
    choices.find(
      version =>
        version.id !== later?.id &&
        (version.createdAt ?? 0) <= (later?.createdAt ?? 0),
    ) ??
    choices.find(({ id }) => id !== later?.id);

  const frame = (children: React.ReactNode) => (
    <SignedInShell
      title={t('cv.compareDocumentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <Link
          to={later ? cvVersionPath(later.id) : CV_PATH}
          className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
          <Icon name="left" size={18} />
          {t('cv.title')}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {t('cv.compareTitle')}
          </h1>
          {later && (
            <p className="text-[16px] leading-normal text-muted wrap-anywhere">
              {versionHeading(t, later, applications)}
            </p>
          )}
        </div>
        {children}
      </div>
    </SignedInShell>
  );

  if (status === 'idle' || status === 'loading') {
    return frame(
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>,
    );
  }
  if (!later || !earlier) {
    return frame(
      <Card elevation="raised" className="items-start gap-3 p-6">
        <p className="text-base leading-normal text-muted">
          {later ? t('cv.compareNeedsTwo') : t('cv.notFoundTitle')}
        </p>
      </Card>,
    );
  }

  const label = (version: CvVersion) =>
    t(version.sentAt ? 'cv.versionOptionSent' : 'cv.versionOption', {
      date: versionDay(version),
    });
  const rows = diffLines(cvVersionText(earlier), cvVersionText(later));
  const differences = rows.filter(({ kind }) => kind !== 'same');
  const shown = onlyDiffers ? differences : rows;
  const choose = (side: 'earlier' | 'later', id: string) => {
    const next = { earlier: earlier.id, later: later.id, [side]: id };
    setParams(next, { replace: true });
  };

  const restore = async () => {
    setRestoring(true);
    setRestoreFailed(false);
    try {
      const { versionId } = await gateway.copyCvVersion(earlier.id);
      await refreshVersion(versionId).catch(() => null);
      navigate(cvVersionPath(versionId));
    } catch (error) {
      logProfileError('copyCvVersion', error, uid);
      setRestoreFailed(true);
      setRestoring(false);
    }
  };

  return frame(
    <>
      <div className="flex flex-wrap items-end gap-4">
        {SIDES.map(side => (
          <label
            key={side}
            className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
            <span className="text-sm leading-normal font-medium">
              {t(side === 'earlier' ? 'cv.earlierLabel' : 'cv.laterLabel')}
            </span>
            <select
              value={side === 'earlier' ? earlier.id : later.id}
              onChange={event => choose(side, event.target.value)}
              className="h-12 w-full rounded-[12px] border border-border bg-surface px-3.5 text-base text-text">
              {choices.map(version => (
                <option key={version.id} value={version.id}>
                  {label(version)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <Card
        as="section"
        elevation="raised"
        aria-labelledby="cv-differences"
        className="gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="cv-differences"
            className="flex-1 font-display text-[18px] leading-tight font-semibold">
            {differences.length === 0
              ? t('cv.noDifferences')
              : t('cv.differences', { count: differences.length })}
          </h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
            <input
              type="checkbox"
              role="switch"
              checked={onlyDiffers}
              onChange={event => setOnlyDiffers(event.target.checked)}
              className="size-[18px] accent-primary"
            />
            {t('cv.onlyDiffers')}
          </label>
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 md:grid">
          <h3 className="font-display text-base leading-tight font-semibold">
            {label(earlier)}
          </h3>
          <h3 className="font-display text-base leading-tight font-semibold">
            {label(later)}
          </h3>
        </div>
        <ul className="flex flex-col">
          {shown.map((row, index) => (
            <li
              key={index}
              className="flex flex-col gap-2.5 border-border-faint py-4 not-first:border-t">
              <span className="flex">
                <Chip tone={KIND_CHIPS[row.kind]}>
                  {t(`cv.diff_${row.kind}`)}
                </Chip>
              </span>
              <div className="grid gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Cell
                  side="earlier"
                  text={'earlier' in row ? row.earlier : undefined}
                  tinted={row.kind !== 'same'}
                />
                <Cell
                  side="later"
                  text={'later' in row ? row.later : undefined}
                  tinted={row.kind !== 'same'}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        as="section"
        elevation="raised"
        aria-labelledby="cv-restore"
        className="gap-3 p-5">
        <h2
          id="cv-restore"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('cv.restoreTitle', { date: versionDay(earlier) })}
        </h2>
        <p className="text-[15px] leading-normal text-muted">
          {t('cv.restoreText')}
        </p>
        {restoreFailed && (
          <Banner tone="danger" role="alert">
            {t('cv.restoreFailedMessage')}
          </Banner>
        )}
        <Button
          variant="secondary"
          size="small"
          disabled={restoring}
          aria-busy={restoring}
          onClick={() => {
            restore();
          }}
          className="gap-2 self-start">
          {restoring ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="refresh" size={18} />
          )}
          {t('cv.restoreButton', { date: versionDay(earlier) })}
        </Button>
      </Card>
    </>,
  );
};

export default CvCompareScreen;
