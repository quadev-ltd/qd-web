// One resource of the profile: where it is, what it is, the text kept of it (D78), its file to
// download, and "Remove". A link's page can be read again, or tried again after a failure.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import {
  RESOURCE_TYPE_ICONS,
  RESOURCE_TYPE_KEYS,
} from '../AddResource/resourceTypes';
import { PROFILE_MAIN } from '../ProfileRoutes';

import RemoveResourceDialog from './RemoveResourceDialog';
import { addedAt, contentOf, formatDay, shortAddress } from './resourceMeta';
import ResourceStatusPanel from './ResourceStatusPanel';
import ResourceTextCard from './ResourceTextCard';
import { useFileUrl } from './useFileUrl';
import { useReadLinkAgain } from './useReadLinkAgain';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { buttonClassName } from '@/components/ui/buttonStyles';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  parseProfileLink,
  type ProfileResource,
} from '@/core/profile/contract';
import {
  isPending,
  RESOURCE_WATCH_MS,
  useInterviewProfile,
  useInterviewProfileActions,
} from '@/core/profile/InterviewProfileProvider';
import { PROFILE_PATH } from '@/core/profile/paths';

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
  resource: { status },
}) => {
  const { t } = useTranslation();
  if (status === 'ready') {
    return (
      <Chip tone="success" icon="check">
        {t('profile.statusReady')}
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
  const { status, resources } = useInterviewProfile();
  const { reload } = useInterviewProfileActions();
  const [removing, setRemoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const resource = resources.find(({ id }) => id === resourceId);
  const fileUrl = useFileUrl(resource);
  const readAgain = useReadLinkAgain(resourceId);
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
      <div className="mx-auto max-w-[1120px]">
        <div className="flex max-w-[760px] flex-col gap-6">
          <BackLink />
          {children}
        </div>
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

  const isLink = resource.source === 'link';
  // A link's address, when it is one the backend accepts (it never stores another).
  const address = isLink ? parseProfileLink(resource.url ?? '') : undefined;
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
      <div className="mx-auto max-w-[1120px]">
        <div className="flex max-w-[760px] flex-col gap-6">
          <BackLink />
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
            tryAgain={
              isLink
                ? {
                    start: () => {
                      readAgain.start();
                    },
                    busy: readAgain.busy,
                    errorMessage: readAgain.errorMessage,
                  }
                : undefined
            }
          />

          <ResourceTextCard
            resource={resource}
            readAgain={isLink ? readAgain : undefined}
          />

          <Card
            as="section"
            elevation="raised"
            aria-labelledby="resource-details"
            className="gap-3 p-4">
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
                {address ? (
                  <a
                    href={address}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium no-underline hover:underline">
                    {shortAddress(address)}
                    <span className="ml-1 inline-flex align-[-3px]">
                      <Icon name="external" size={16} />
                    </span>
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
                  className: 'gap-2 self-start text-[15px]',
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
              {t(isLink ? 'resource.removeThisLink' : 'resource.removeLink')}
            </Button>
          </Card>
        </div>
      </div>

      {removing && (
        <RemoveResourceDialog
          resourceId={resource.id}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(PROFILE_PATH, { replace: true })}
        />
      )}
    </SignedInShell>
  );
};

export default ResourceScreen;
