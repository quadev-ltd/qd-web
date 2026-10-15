// "Edit the application" (A1 edit): every field. Only what changed is sent; an optional field
// that is emptied is cleared, and the job description can be changed but not emptied.
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { applicationErrorMessage } from './errorMessages';
import SubmitFooter from './SubmitFooter';

import FormTextArea from '@/components/FormTextArea';
import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import SidePanel from '@/components/ui/SidePanel';
import {
  APPLICATION_NAME_MAX_CHARS,
  APPLICATION_NOTES_MAX_CHARS,
  JOB_DESCRIPTION_MAX_CHARS,
  type JobApplication,
  type UpdateJobApplicationRequest,
} from '@/core/profile/applications';
import { useApplicationsActions } from '@/core/profile/ApplicationsProvider';
import { parseProfileLink } from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import {
  ApplicationFields,
  editApplicationSchema,
  type EditApplicationSchemaType,
} from '@/schemas/applicationSchema';

/** Only the fields that changed; an optional one that was emptied becomes `null` (cleared). */
export const changesOf = (
  application: JobApplication,
  values: EditApplicationSchemaType,
): Omit<UpdateJobApplicationRequest, 'applicationId'> => {
  const changes: Omit<UpdateJobApplicationRequest, 'applicationId'> = {};
  if (values.title !== application.title) {
    changes.title = values.title;
  }
  if (values.jobDescription !== (application.jobDescription ?? '')) {
    changes.jobDescription = values.jobDescription;
  }
  const optional = (
    key: 'company' | 'role' | 'notes' | 'postingUrl',
    value: string,
  ) => {
    if (value !== (application[key] ?? '')) {
      changes[key] = value === '' ? null : value;
    }
  };
  optional('company', values.company);
  optional('role', values.role);
  optional('notes', values.notes);
  // The backend keeps an address in its normal form: compare it that way.
  const posting =
    values.postingUrl === ''
      ? ''
      : (parseProfileLink(values.postingUrl) ?? values.postingUrl);
  optional('postingUrl', posting);
  return changes;
};

export interface EditApplicationPanelProps {
  application: JobApplication;
  onClose: () => void;
}

export const EditApplicationPanel: React.FC<EditApplicationPanelProps> = ({
  application,
  onClose,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const { refreshApplication } = useApplicationsActions();
  const uid = useSessionUser()?.uid;
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditApplicationSchemaType>({
    resolver: zodResolver(editApplicationSchema),
    mode: 'onChange',
    defaultValues: {
      title: application.title,
      company: application.company ?? '',
      role: application.role ?? '',
      jobDescription: application.jobDescription ?? '',
      postingUrl: application.postingUrl ?? '',
      notes: application.notes ?? '',
    },
  });
  const title = useWatch({ control, name: ApplicationFields.title });
  const company = useWatch({ control, name: ApplicationFields.company });
  const role = useWatch({ control, name: ApplicationFields.role });
  const job = useWatch({ control, name: ApplicationFields.jobDescription });
  const notes = useWatch({ control, name: ApplicationFields.notes });

  const onSubmit = handleSubmit(async values => {
    const changes = changesOf(application, values);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await gateway.updateApplication({
        applicationId: application.id,
        ...changes,
      });
      await refreshApplication(application.id).catch(() => null);
      onClose();
    } catch (error) {
      logProfileError('updateApplication', error, uid);
      setErrorMessage(
        applicationErrorMessage(t, error, t('applications.saveFailedMessage')),
      );
      setIsBusy(false);
    }
  });

  const name = (length: string) => ({
    length: length.trim().length,
    max: APPLICATION_NAME_MAX_CHARS,
  });
  const tooBig = Object.values(errors).some(error => error?.type === 'too_big');

  return (
    <SidePanel
      title={t('applications.editTitle')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[18px]">
        <HookFormTextInput
          name={ApplicationFields.title}
          control={control}
          label={t('applications.titleLabel')}
          error={errors.title}
          disabled={isBusy}
          counter={name(title)}
        />
        <HookFormTextInput
          name={ApplicationFields.company}
          control={control}
          label={t('applications.companyField')}
          error={errors.company}
          disabled={isBusy}
          counter={name(company)}
        />
        <HookFormTextInput
          name={ApplicationFields.role}
          control={control}
          label={t('applications.roleField')}
          error={errors.role}
          disabled={isBusy}
          counter={name(role)}
        />
        <Controller
          name={ApplicationFields.jobDescription}
          control={control}
          render={({ field }) => (
            <FormTextArea
              {...field}
              label={t('applications.jobLabel')}
              hint={t('applications.jobEditHint')}
              error={errors.jobDescription}
              disabled={isBusy}
              counter={{
                length: job.trim().length,
                max: JOB_DESCRIPTION_MAX_CHARS,
              }}
            />
          )}
        />
        <HookFormTextInput
          name={ApplicationFields.postingUrl}
          control={control}
          label={t('applications.postingField')}
          error={errors.postingUrl}
          disabled={isBusy}
          inputMode="url"
          placeholder={t('addResource.addressPlaceholder')}
        />
        <Controller
          name={ApplicationFields.notes}
          control={control}
          render={({ field }) => (
            <FormTextArea
              {...field}
              label={t('applications.notesField')}
              error={errors.notes}
              disabled={isBusy}
              counter={{
                length: notes.trim().length,
                max: APPLICATION_NOTES_MAX_CHARS,
              }}
            />
          )}
        />
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={tooBig}
          label={t('applications.saveButton')}
          busyLabel={t('applications.savingButton')}
        />
      </form>
    </SidePanel>
  );
};

export default EditApplicationPanel;
