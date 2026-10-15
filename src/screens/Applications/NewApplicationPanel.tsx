// "New application" (A1): the job, pasted. Until the backend reads the title from the job
// (research doc 17), the candidate gives it too. On success the application's page opens.
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { applicationErrorMessage } from './errorMessages';
import SubmitFooter from './SubmitFooter';

import FormTextArea from '@/components/FormTextArea';
import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import SidePanel from '@/components/ui/SidePanel';
import {
  APPLICATION_NAME_MAX_CHARS,
  JOB_DESCRIPTION_MAX_CHARS,
} from '@/core/profile/applications';
import { useApplicationsActions } from '@/core/profile/ApplicationsProvider';
import { logProfileError } from '@/core/profile/errors';
import { applicationPath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import {
  ApplicationFields,
  newApplicationSchema,
  type NewApplicationSchemaType,
} from '@/schemas/applicationSchema';

export const NewApplicationPanel: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const { refreshApplication } = useApplicationsActions();
  const uid = useSessionUser()?.uid;
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewApplicationSchemaType>({
    resolver: zodResolver(newApplicationSchema),
    mode: 'onChange',
    defaultValues: { title: '', jobDescription: '' },
  });
  const title = useWatch({ control, name: ApplicationFields.title });
  const job = useWatch({ control, name: ApplicationFields.jobDescription });

  const onSubmit = handleSubmit(async values => {
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      const { applicationId } = await gateway.createApplication(values);
      // Into the list before its page opens; a failed read only means the page reads it.
      await refreshApplication(applicationId).catch(() => null);
      navigate(applicationPath(applicationId));
    } catch (error) {
      logProfileError('createApplication', error, uid);
      setErrorMessage(
        applicationErrorMessage(t, error, t('applications.failedMessage')),
      );
      setIsBusy(false);
    }
  });

  return (
    <SidePanel
      title={t('applications.newTitle')}
      description={t('applications.newDescription')}
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
          hint={t('applications.titleHint')}
          error={errors.title}
          disabled={isBusy}
          counter={{
            length: title.trim().length,
            max: APPLICATION_NAME_MAX_CHARS,
          }}
        />
        <Controller
          name={ApplicationFields.jobDescription}
          control={control}
          render={({ field }) => (
            <FormTextArea
              {...field}
              label={t('applications.jobLabel')}
              error={errors.jobDescription}
              disabled={isBusy}
              counter={{
                length: job.trim().length,
                max: JOB_DESCRIPTION_MAX_CHARS,
              }}
            />
          )}
        />
        <p className="text-sm leading-normal text-muted">
          {t('applications.newHint')}
        </p>
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={
            errors.title?.type === 'too_big' ||
            errors.jobDescription?.type === 'too_big'
          }
          label={t('applications.addButton')}
          busyLabel={t('applications.addingButton')}
        />
      </form>
    </SidePanel>
  );
};

export default NewApplicationPanel;
