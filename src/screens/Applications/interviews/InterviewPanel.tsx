// "Add an interview" and, filled in, "Edit the interview" (A8, D89): its name, date and start time
// in the browser's time zone, length, type and what the candidate knows about it. Editing sends
// only what changed: the date, the time and the zone together, `null` to clear an optional
// field, '' to clear the description.
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { zoneName } from './interviewText';

import FormTextArea from '@/components/FormTextArea';
import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import SidePanel from '@/components/ui/SidePanel';
import ToggleChips from '@/components/ui/ToggleChips';
import { type JobApplication } from '@/core/profile/applications';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import {
  type ApplicationInterview,
  type CreateInterviewRequest,
  INTERVIEW_DESCRIPTION_MAX_CHARS,
  INTERVIEW_LENGTHS,
  INTERVIEW_NAME_MAX_CHARS,
  INTERVIEW_TYPES,
  INTERVIEWS_MAX,
  type UpdateInterviewRequest,
} from '@/core/profile/interviews';
import {
  browserTimeZone,
  middayOf,
  zonedParts,
} from '@/core/profile/interviewTime';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useInterviews } from '@/core/profile/useInterviews';
import { useSessionUser } from '@/core/session/hooks';
import {
  INTERVIEW_FIRST_DATE,
  INTERVIEW_LAST_DATE,
  InterviewFields,
  isInterviewDate,
  interviewSchema,
  type InterviewSchemaInput,
  type InterviewSchemaType,
} from '@/schemas/interviewSchema';
import SubmitFooter from '@/screens/Applications/SubmitFooter';

/**
 * The date and time to show in the form, in the browser's zone: as entered when it is the zone
 * they were entered in, and otherwise when the interview starts there.
 */
export const formWhenOf = (
  interview: Pick<
    ApplicationInterview,
    'date' | 'startTime' | 'timeZone' | 'startsAt'
  >,
  timeZone: string,
) => {
  if (interview.timeZone === timeZone) {
    return { date: interview.date, startTime: interview.startTime };
  }
  const { date, time } = zonedParts(interview.startsAt, timeZone);
  return { date, startTime: time };
};

type Changes = Omit<UpdateInterviewRequest, 'applicationId' | 'interviewId'>;

/** Only the fields that changed. A new date or time is sent with the browser's zone. */
export const interviewChangesOf = (
  interview: ApplicationInterview,
  values: InterviewSchemaType,
  timeZone: string,
): Changes => {
  const changes: Record<string, unknown> = {};
  const when = formWhenOf(interview, timeZone);
  if (values.date !== when.date || values.startTime !== when.startTime) {
    changes.date = values.date;
    changes.startTime = values.startTime;
    changes.timeZone = timeZone;
  }
  if (values.name !== (interview.name ?? '')) {
    changes.name = values.name === '' ? null : values.name;
  }
  if (values.lengthMinutes !== (interview.lengthMinutes ?? null)) {
    changes.lengthMinutes = values.lengthMinutes;
  }
  if (values.type !== (interview.type ?? null)) {
    changes.type = values.type;
  }
  if (values.description !== interview.description) {
    changes.description = values.description;
  }
  return changes as Changes;
};

/** What a new interview sends: the optional fields only when they are given. */
export const newInterviewOf = (
  applicationId: string,
  values: InterviewSchemaType,
  timeZone: string,
): CreateInterviewRequest => ({
  applicationId,
  ...(values.name ? { name: values.name } : {}),
  date: values.date,
  startTime: values.startTime,
  timeZone,
  ...(values.lengthMinutes ? { lengthMinutes: values.lengthMinutes } : {}),
  ...(values.type ? { type: values.type } : {}),
  ...(values.description ? { description: values.description } : {}),
});

export interface InterviewPanelProps {
  application: JobApplication;
  /** The interview to edit; without it, a new one. */
  interview?: ApplicationInterview;
  onClose: () => void;
}

export const InterviewPanel: React.FC<InterviewPanelProps> = ({
  application,
  interview,
  onClose,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const { refresh } = useInterviews(application.id);
  const uid = useSessionUser()?.uid;
  const [timeZone] = useState(browserTimeZone);
  // The zone's short name is the one of the date entered, or of today: 'GMT' or 'BST'.
  const [openedAt] = useState(Date.now);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InterviewSchemaInput, unknown, InterviewSchemaType>({
    resolver: zodResolver(interviewSchema),
    mode: 'onChange',
    defaultValues: {
      name: interview?.name ?? '',
      ...(interview
        ? formWhenOf(interview, timeZone)
        : { date: '', startTime: '' }),
      lengthMinutes: interview?.lengthMinutes ?? null,
      type: interview?.type ?? null,
      description: interview?.description ?? '',
    },
  });
  const name = useWatch({ control, name: InterviewFields.name });
  const description = useWatch({ control, name: InterviewFields.description });
  const date = useWatch({ control, name: InterviewFields.date });

  const messageFor = (error: unknown) => {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.MaxInterviews:
        return t('interviews.limitMessage', { max: INTERVIEWS_MAX });
      case ProfileErrorCode.NotFound:
        return t('interviews.goneMessage');
      case ProfileErrorCode.Invalid:
        return t('interviews.invalidMessage');
      case ProfileErrorCode.FlagOff:
        return t('applications.notAvailableMessage');
      default:
        return t(
          interview
            ? 'interviews.saveFailedMessage'
            : 'interviews.failedMessage',
        );
    }
  };

  const onSubmit = handleSubmit(async values => {
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      if (interview) {
        const changes = interviewChangesOf(interview, values, timeZone);
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        await gateway.updateInterview({
          applicationId: application.id,
          interviewId: interview.id,
          ...changes,
        } as UpdateInterviewRequest);
        await refresh(interview.id);
      } else {
        const { interviewId } = await gateway.createInterview(
          newInterviewOf(application.id, values, timeZone),
        );
        await refresh(interviewId);
      }
      onClose();
    } catch (error) {
      logProfileError(
        interview ? 'updateInterview' : 'createInterview',
        error,
        uid,
      );
      setErrorMessage(messageFor(error));
      setIsBusy(false);
    }
  });

  // A length the form doesn't offer (set elsewhere) is kept, and shown with the others.
  const stored = interview?.lengthMinutes;
  const lengths = [
    ...new Set([
      ...INTERVIEW_LENGTHS,
      ...(stored && !INTERVIEW_LENGTHS.some(length => length === stored)
        ? [stored]
        : []),
    ]),
  ].sort((a, b) => a - b);
  const tooBig = Object.values(errors).some(error => error?.type === 'too_big');
  const subtitle = [application.title, application.company]
    .filter(Boolean)
    .join(' · ');

  return (
    <SidePanel
      title={t(interview ? 'interviews.editTitle' : 'interviews.addTitle')}
      description={subtitle || undefined}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[18px]">
        <HookFormTextInput
          name={InterviewFields.name}
          control={control}
          label={t('interviews.nameField')}
          hint={t('interviews.nameHint')}
          error={errors.name}
          disabled={isBusy}
          counter={{
            length: name.trim().length,
            max: INTERVIEW_NAME_MAX_CHARS,
          }}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-[1_1_170px]">
              <HookFormTextInput
                name={InterviewFields.date}
                control={control}
                type="date"
                min={INTERVIEW_FIRST_DATE}
                max={INTERVIEW_LAST_DATE}
                label={t('interviews.dateField')}
                error={errors.date}
                disabled={isBusy}
              />
            </div>
            <div className="min-w-0 flex-[1_1_120px]">
              <HookFormTextInput
                name={InterviewFields.startTime}
                control={control}
                type="time"
                label={t('interviews.timeField')}
                error={errors.startTime}
                disabled={isBusy}
              />
            </div>
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('interviews.zoneHint', {
              zone: zoneName(
                t,
                timeZone,
                (isInterviewDate(date) && middayOf(date)) || openedAt,
              ),
            })}
          </p>
        </div>
        <Controller
          name={InterviewFields.lengthMinutes}
          control={control}
          render={({ field }) => (
            <ToggleChips
              label={t('interviews.lengthField')}
              options={lengths.map(minutes => ({
                value: minutes,
                label: t('interviews.lengthChip', { minutes }),
              }))}
              value={field.value}
              onChange={field.onChange}
              disabled={isBusy}
            />
          )}
        />
        <Controller
          name={InterviewFields.type}
          control={control}
          render={({ field }) => (
            <ToggleChips
              label={t('interviews.typeField')}
              options={INTERVIEW_TYPES.map(type => ({
                value: type,
                label: t(`interviews.type_${type}`),
              }))}
              value={field.value}
              onChange={field.onChange}
              disabled={isBusy}
            />
          )}
        />
        <Controller
          name={InterviewFields.description}
          control={control}
          render={({ field }) => (
            <FormTextArea
              {...field}
              rows={5}
              label={t('interviews.descriptionField')}
              hint={t('interviews.descriptionHint')}
              error={errors.description}
              disabled={isBusy}
              counter={{
                length: description.trim().length,
                max: INTERVIEW_DESCRIPTION_MAX_CHARS,
              }}
            />
          )}
        />
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={tooBig}
          label={t(
            interview ? 'interviews.saveButton' : 'interviews.addSubmit',
          )}
          busyLabel={t(
            interview ? 'interviews.savingButton' : 'interviews.addingButton',
          )}
        />
      </form>
    </SidePanel>
  );
};

export default InterviewPanel;
