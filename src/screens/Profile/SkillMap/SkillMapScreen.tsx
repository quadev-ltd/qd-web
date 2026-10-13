// The skill map: every item the resources added, to search, filter and correct. On a wide
// screen the item that is opened stands beside the list; on a narrow one it takes the page.
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import ItemRow from '../ItemRow';
import { PROFILE_MAIN } from '../ProfileRoutes';

import ItemPanel from './ItemPanel';
import SkillMapFilters, { KIND_GROUP_KEYS } from './SkillMapFilters';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import {
  SKILL_MAP_KINDS,
  type SkillMapItem,
  type SkillMapKind,
} from '@/core/profile/contract';
import {
  isPending,
  useInterviewProfile,
  useInterviewProfileActions,
} from '@/core/profile/InterviewProfileProvider';
import { itemPath, PROFILE_PATH, SKILL_MAP_PATH } from '@/core/profile/paths';
import {
  filterIgnoringKind,
  filterItems,
  isFiltered,
  NO_FILTER,
  type SkillMapFilter,
} from '@/core/profile/skillMapFilter';

/** How many items of each kind are listed before "Show all". */
const GROUP_SHOWN = 3;

const Crumb: React.FC<{
  to: string;
  className?: string;
  children: ReactNode;
}> = ({ to, className = '', children }) => (
  <Link
    to={to}
    className={`flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline ${className}`}>
    <Icon name="left" size={18} />
    {children}
  </Link>
);

const Centered: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Card
    elevation="raised"
    className="mx-auto w-full max-w-[560px] items-center gap-3 px-6 py-10 text-center">
    {children}
  </Card>
);

export const SkillMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams();
  const { status, resources, items } = useInterviewProfile();
  const { reload } = useInterviewProfileActions();
  const [filter, setFilter] = useState<SkillMapFilter>(NO_FILTER);

  const selected = itemId
    ? items.find(candidate => candidate.id === itemId)
    : undefined;
  const titleOf = (resourceId: string) =>
    resources.find(({ id }) => id === resourceId)?.title ?? '';

  // On a narrow screen an opened item takes the page: the list and its heading step aside,
  // and the way back leads to the list instead of the profile.
  const besideItem = itemId ? 'max-[900px]:hidden' : '';

  const frame = (children: ReactNode) => (
    <SignedInShell
      title={t(itemId ? 'item.documentTitle' : 'skillMap.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <Crumb to={PROFILE_PATH} className={besideItem}>
          {t('resource.backLink')}
        </Crumb>
        {itemId && (
          <Crumb to={SKILL_MAP_PATH} className="min-[901px]:hidden">
            {t('skillMap.backLink')}
          </Crumb>
        )}
        {children}
      </div>
    </SignedInShell>
  );
  const heading = (
    <div className={`flex flex-col gap-1 ${besideItem}`}>
      <h1 className="font-display text-[28px] leading-tight font-semibold">
        {t('skillMap.title')}
      </h1>
      {status === 'loaded' && (
        <p className="text-[16px] leading-normal text-muted">
          {t('skillMap.summary', {
            items: t('skillMap.summaryItems', { count: items.length }),
            resources: t('skillMap.summaryResources', {
              count: resources.length,
            }),
          })}
        </p>
      )}
    </div>
  );

  if (status === 'idle' || status === 'loading') {
    return frame(
      <>
        {heading}
        <div className="flex justify-center py-16 text-primary">
          <Spinner />
        </div>
      </>,
    );
  }
  if (status === 'error') {
    return frame(
      <>
        {heading}
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button variant="quiet" size="small" onClick={reload}>
              {t('profile.retryButton')}
            </Button>
          }>
          {t('profile.loadErrorMessage')}
        </Banner>
      </>,
    );
  }
  if (itemId && !selected) {
    return frame(
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('item.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('item.notFoundDescription')}
        </p>
        <ButtonLink to={SKILL_MAP_PATH} variant="secondary" size="small">
          {t('item.notFoundLink')}
        </ButtonLink>
      </Card>,
    );
  }
  if (items.length === 0) {
    const reading = resources.find(isPending);
    return frame(
      <>
        {heading}
        {reading ? (
          <div
            role="status"
            className="flex flex-col items-center gap-3.5 px-2 py-16 text-center text-primary">
            {/* The words beside it say what is happening. */}
            <Spinner decorative />
            <h2 className="font-display text-[20px] leading-tight font-semibold text-text">
              {t('skillMap.readingTitle', { title: reading.title })}
            </h2>
            <p className="max-w-[320px] text-[15px] leading-normal text-muted">
              {t('skillMap.readingDescription')}
            </p>
          </div>
        ) : (
          <Centered>
            <span
              aria-hidden="true"
              className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name="upload" size={28} />
            </span>
            <h2 className="font-display text-[20px] leading-tight font-semibold">
              {t('skillMap.emptyTitle')}
            </h2>
            <p className="max-w-[420px] text-[15px] leading-normal text-muted">
              {t('skillMap.emptyDescription')}
            </p>
            <ButtonLink
              to={PROFILE_PATH}
              state={{ add: 'cv' }}
              className="mt-1 gap-2">
              <Icon name="upload" size={18} />
              {t('profile.addCvButton')}
            </ButtonLink>
          </Centered>
        )}
      </>,
    );
  }

  const withoutKind = filterIgnoringKind(items, filter);
  const counts = Object.fromEntries([
    ['all', withoutKind.length],
    ...SKILL_MAP_KINDS.map(kind => [
      kind,
      withoutKind.filter(item => item.kind === kind).length,
    ]),
  ]) as Record<SkillMapKind | 'all', number>;
  const shown = filterItems(items, filter);
  const filtered = isFiltered(filter);
  const sources = resources.filter(resource =>
    items.some(item => item.resourceId === resource.id),
  );

  const row = (item: SkillMapItem, showKind: boolean) => (
    <li key={item.id} className="border-border-faint not-first:border-t">
      <ItemRow
        item={item}
        source={titleOf(item.resourceId)}
        showKind={showKind}
        to={itemPath(item.id)}
        selected={item.id === itemId}
      />
    </li>
  );

  return frame(
    <>
      {heading}
      <div className="flex flex-wrap items-start gap-6">
        <div className={`min-w-0 flex-[1_1_220px] ${besideItem}`}>
          <SkillMapFilters
            filter={filter}
            counts={counts}
            resources={sources}
            onChange={setFilter}
          />
        </div>

        <div
          className={`flex min-w-0 flex-[999_1_380px] flex-col gap-4 ${besideItem}`}>
          {shown.length === 0 && (
            <Centered>
              <span
                aria-hidden="true"
                className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
                <Icon name="search" size={28} />
              </span>
              <h2 className="font-display text-[20px] leading-tight font-semibold">
                {t('skillMap.noResultTitle')}
              </h2>
              <p className="max-w-[420px] text-[15px] leading-normal text-muted wrap-anywhere">
                {filter.query.trim()
                  ? t('skillMap.noResultSearchDescription', {
                      query: filter.query.trim(),
                    })
                  : t('skillMap.noResultDescription')}
              </p>
              <Button variant="secondary" onClick={() => setFilter(NO_FILTER)}>
                {t('skillMap.clearButton')}
              </Button>
            </Centered>
          )}

          {shown.length > 0 && !filtered && (
            // Everything, by kind: a few of each, and "Show all" narrows to that kind.
            <>
              {SKILL_MAP_KINDS.map(kind => {
                const ofKind = shown.filter(item => item.kind === kind);
                if (ofKind.length === 0) {
                  return null;
                }
                return (
                  <Card
                    key={kind}
                    as="section"
                    elevation="raised"
                    className="p-4">
                    <div className="flex items-baseline gap-2">
                      <h2 className="flex-1 font-display text-[18px] leading-tight font-semibold">
                        {t(KIND_GROUP_KEYS[kind])}
                      </h2>
                      <p className="text-sm leading-normal text-muted">
                        {ofKind.length}
                      </p>
                    </div>
                    <ul className="flex flex-col">
                      {ofKind
                        .slice(0, GROUP_SHOWN)
                        .map(item => row(item, false))}
                    </ul>
                    {ofKind.length > GROUP_SHOWN && (
                      <Button
                        variant="quiet"
                        size="small"
                        onClick={() => setFilter({ ...filter, kind })}
                        className="self-start text-[15px]">
                        {t('skillMap.showAllButton', { count: ofKind.length })}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {shown.length > 0 && filtered && (
            <>
              <p
                aria-live="polite"
                className="text-sm leading-normal text-muted">
                {filter.hidden
                  ? t('skillMap.hiddenCount', { count: shown.length })
                  : t('skillMap.resultCount', { count: shown.length })}
              </p>
              <Card elevation="raised" className="p-4">
                <ul className="flex flex-col">
                  {shown.map(item => row(item, filter.kind === 'all'))}
                </ul>
              </Card>
            </>
          )}
        </div>

        {selected && (
          <aside
            aria-label={t('skillMap.selectedItemAccessibilityLabel')}
            className="min-w-0 flex-[1_1_320px]">
            <ItemPanel
              // A form of its own for each item: nothing typed for one reaches another.
              key={selected.id}
              item={selected}
              resource={resources.find(({ id }) => id === selected.resourceId)}
              onRemoved={() => navigate(SKILL_MAP_PATH, { replace: true })}
            />
          </aside>
        )}
      </div>
    </>,
  );
};

export default SkillMapScreen;
