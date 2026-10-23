// The details of an application (A7): what it is, the job (a posting can be read again),
// "Edit" and "Remove".
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import EditApplicationPanel from './EditApplicationPanel';
import JobCard from './JobCard';
import RemoveApplicationDialog from './RemoveApplicationDialog';
import ReplaceEditedTextDialog from './ReplaceEditedTextDialog';
import { useReadPostingAgain } from './useReadPostingAgain';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { type JobApplication } from '@/core/profile/applications';
import { parseProfileLink } from '@/core/profile/contract';
import { APPLICATIONS_PATH } from '@/core/profile/paths';
import { shortAddress } from '@/screens/Profile/Resource/resourceMeta';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <>
    <dt className="text-sm leading-normal text-muted">{label}</dt>
    <dd className="text-base leading-normal whitespace-pre-wrap wrap-anywhere">
      {children}
    </dd>
  </>
);

export const DetailsTab: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const posting = parseProfileLink(application.postingUrl ?? '');
  const readAgain = useReadPostingAgain(
    application.id,
    application.job?.edited ?? false,
  );

  return (
    <>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="application-details"
            className="gap-4">
            <div className="flex items-center gap-3">
              <h2
                id="application-details"
                className="flex-1 font-display text-[18px] leading-tight font-semibold">
                {t('applications.detailsTitle')}
              </h2>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setEditing(true)}
                className="gap-2">
                <Icon name="edit" size={18} />
                {t('applications.editButton')}
              </Button>
            </div>
            <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-4 gap-y-3">
              <Row label={t('applications.titleField')}>
                {application.title}
              </Row>
              {application.company && (
                <Row label={t('applications.companyLabel')}>
                  {application.company}
                </Row>
              )}
              {application.role && (
                <Row label={t('applications.roleLabel')}>
                  {application.role}
                </Row>
              )}
              {posting && (
                <Row label={t('applications.postingLabel')}>
                  <a
                    href={posting}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium no-underline hover:underline">
                    {shortAddress(posting)}
                    <span className="ml-1 inline-flex align-[-3px]">
                      <Icon name="external" size={16} />
                    </span>
                  </a>
                </Row>
              )}
              {application.notes && (
                <Row label={t('applications.notesLabel')}>
                  {application.notes}
                </Row>
              )}
            </dl>
          </Card>
          {application.jobDescription && (
            <JobCard
              application={application}
              readAgain={
                application.job?.source === 'link' && posting
                  ? readAgain
                  : undefined
              }
            />
          )}
        </div>

        <Card
          as="aside"
          elevation="raised"
          aria-labelledby="application-remove"
          className="min-w-0 flex-[1_1_300px] gap-3 p-4">
          <h2
            id="application-remove"
            className="font-display text-[18px] leading-tight font-semibold">
            {t('applications.removeTitle')}
          </h2>
          <p className="text-[15px] leading-normal text-muted">
            {t('applications.removeDescription')}
          </p>
          <Button
            variant="quietDanger"
            size="small"
            onClick={() => setRemoving(true)}
            className="gap-2 self-start text-[15px]">
            <Icon name="trash" size={18} />
            {t('applications.removeLink')}
          </Button>
        </Card>
      </div>

      {editing && (
        <EditApplicationPanel
          application={application}
          onClose={() => setEditing(false)}
        />
      )}
      {readAgain.confirming && <ReplaceEditedTextDialog reread={readAgain} />}
      {removing && (
        <RemoveApplicationDialog
          applicationId={application.id}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(APPLICATIONS_PATH, { replace: true })}
        />
      )}
    </>
  );
};

export default DetailsTab;
