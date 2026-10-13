// One resource of the profile: where it is, what it added to the skill map, and "Remove".
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import {
  RESOURCE_TYPE_ICONS,
  RESOURCE_TYPE_KEYS,
} from '../AddResource/resourceTypes';
import ItemRow from '../ItemRow';
import { PROFILE_MAIN } from '../ProfileRoutes';

import RemoveResourceDialog from './RemoveResourceDialog';
import { addedAt, contentOf, formatDay } from './resourceMeta';
import ResourceStatusPanel from './ResourceStatusPanel';
import { useFileUrl } from './useFileUrl';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { buttonClassName } from '@/components/ui/buttonStyles';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type ProfileResource } from '@/core/profile/contract';
import {
  isPending,
  RESOURCE_WATCH_MS,
  useInterviewProfile,
  useInterviewProfileActions,
} from '@/core/profile/InterviewProfileProvider';
import { itemsOfResource } from '@/core/profile/items';
import { PROFILE_PATH } from '@/core/profile/paths';

/** How many items are listed before "Show all". */
const ITEMS_SHOWN = 5;
/** How often the page looks at the clock, for "a minute ago" and "taking longer than usual". */
const CLOCK_MS = 15_000;

const BackLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link
      to={PROFILE_PATH}
      className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
      <Icon name="left" size={18} />
      {t('resource.backLink')}
    </Link>
  );
};

const StatusChip: React.FC<{ resource: ProfileResource }> = ({
  resource: { status, itemCount },
}) => {
  const { t } = useTranslation();
  if (status === 'ready') {
    return (
      <Chip tone="success" icon="check">
        {t('profile.statusReady', { count: itemCount })}
      </Chip>
    );
  }
  if (status === 'failed') {
    return (
      <Chip tone="danger" icon="alert">
        {t('resource.statusFailedChip')}
      </Chip>
    );
  }
  return (
    <Chip>
      <Spinner size="tiny" decorative />
      {t(
        status === 'processing'
          ? 'profile.statusProcessing'
          : 'profile.statusAwaitingUpload',
      )}
    </Chip>
  );
};

export const ResourceScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resourceId = '' } = useParams();
  const { status, resources, items } = useInterviewProfile();
  const { reload } = useInterviewProfileActions();
  const [showAll, setShowAll] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const resource = resources.find(({ id }) => id === resourceId);
  const fileUrl = useFileUrl(resource);
  const pending = resource ? isPending(resource) : false;
  // Only a resource that is still young or unfinished changes with the clock.
  useEffect(() => {
    if (!pending) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [pending]);

  const frame = (children: React.ReactNode) => (
    <SignedInShell
      title={t('resource.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <BackLink />
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
  if (status === 'error') {
    return frame(
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('profile.retryButton')}
          </Button>
        }>
        {t('profile.loadErrorMessage')}
      </Banner>,
    );
  }
  if (!resource) {
    return frame(
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('resource.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('resource.notFoundDescription')}
        </p>
        <ButtonLink to={PROFILE_PATH} variant="secondary" size="small">
          {t('resource.notFoundLink')}
        </ButtonLink>
      </Card>,
    );
  }

  const ownItems = itemsOfResource(items, resource.id);
  const shownItems = showAll ? ownItems : ownItems.slice(0, ITEMS_SHOWN);
  const added = addedAt(resource.createdAt, now);
  const addedText = added
    ? added.key === 'resource.addedOn'
      ? t(added.key, { date: added.date })
      : added.key === 'resource.addedMinutesAgo'
        ? t(added.key, { count: added.count })
        : t(added.key)
    : undefined;
  const content = contentOf(resource);
  const contentText = 'host' in content ? content.host : t(content.key);
  const stuck =
    pending &&
    now - (resource.updatedAt ?? resource.createdAt ?? now) > RESOURCE_WATCH_MS;

  return (
    <SignedInShell
      title={t('resource.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <BackLink />
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Chip tone="brand" icon={RESOURCE_TYPE_ICONS[resource.type]}>
                  {t(RESOURCE_TYPE_KEYS[resource.type])}
                </Chip>
                <StatusChip resource={resource} />
              </div>
              <h1 className="font-display text-[22px] leading-tight font-semibold wrap-anywhere">
                {resource.title}
              </h1>
              <p className="text-sm leading-normal text-muted wrap-anywhere">
                {[addedText, contentText].filter(Boolean).join(' · ')}
              </p>
            </div>

            <ResourceStatusPanel
              resource={resource}
              stuck={stuck}
              onRemove={() => setRemoving(true)}
            />

            {ownItems.length > 0 && (
              <Card as="section" elevation="raised" className="p-5">
                <h2 className="font-display text-[18px] leading-tight font-semibold">
                  {t('resource.itemsTitle', { count: ownItems.length })}
                </h2>
                <ul className="flex flex-col">
                  {shownItems.map(item => (
                    <li
                      key={item.id}
                      className="border-border-faint not-first:border-t">
                      <ItemRow item={item} source={resource.title} showKind />
                    </li>
                  ))}
                </ul>
                {ownItems.length > ITEMS_SHOWN && !showAll && (
                  <Button
                    variant="quiet"
                    size="small"
                    onClick={() => setShowAll(true)}
                    className="self-start text-[15px]">
                    {t('resource.showAllButton', { count: ownItems.length })}
                  </Button>
                )}
              </Card>
            )}
          </div>

          <Card
            as="aside"
            elevation="raised"
            aria-labelledby="resource-details"
            className="min-w-0 flex-[1_1_300px] gap-3 p-4">
            <h2
              id="resource-details"
              className="font-display text-[18px] leading-tight font-semibold">
              {t('resource.detailsTitle')}
            </h2>
            <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-4 gap-y-3">
              <dt className="text-sm leading-normal text-muted">
                {t('resource.typeLabel')}
              </dt>
              <dd className="text-base leading-normal">
                {t(RESOURCE_TYPE_KEYS[resource.type])}
              </dd>
              {resource.createdAt !== null && (
                <>
                  <dt className="text-sm leading-normal text-muted">
                    {t('resource.addedLabel')}
                  </dt>
                  <dd className="text-base leading-normal">
                    {formatDay(resource.createdAt)}
                  </dd>
                </>
              )}
              <dt className="text-sm leading-normal text-muted">
                {t(
                  resource.source === 'link'
                    ? 'resource.addressLabel'
                    : resource.source === 'file'
                      ? 'resource.fileLabel'
                      : 'resource.contentLabel',
                )}
              </dt>
              <dd className="text-base leading-normal wrap-anywhere">
                {resource.source === 'link' && resource.url ? (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium no-underline hover:underline">
                    {resource.url}
                  </a>
                ) : (
                  contentText
                )}
              </dd>
            </dl>
            {fileUrl && (
              // A normal link: the browser fetches the file, the page never reads it.
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'small',
                  className: 'gap-2 text-[15px]',
                })}>
                <Icon name="download" size={18} />
                {t('resource.downloadLink')}
              </a>
            )}
            <Button
              variant="quietDanger"
              size="small"
              onClick={() => setRemoving(true)}
              className="gap-2 self-start text-[15px]">
              <Icon name="trash" size={18} />
              {t('resource.removeLink')}
            </Button>
          </Card>
        </div>
      </div>

      {removing && (
        <RemoveResourceDialog
          resourceId={resource.id}
          itemCount={ownItems.length}
          editedCount={ownItems.filter(item => item.edited).length}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(PROFILE_PATH, { replace: true })}
        />
      )}
    </SignedInShell>
  );
};

export default ResourceScreen;
