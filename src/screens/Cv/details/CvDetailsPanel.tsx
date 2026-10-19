// "Your CV details" (doc 13 §20.3, doc 19 §3.1, D83): the name and contact lines at the top of
// every CV written for the candidate, filled from the profile and corrected here. Only the fields
// the candidate changes are sent: each one sent is kept from a later reading of a resource.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import FormTextInput from '@/components/FormTextInput';
import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import SidePanel from '@/components/ui/SidePanel';
import {
  CV_DETAILS_MAX_CHARS,
  CV_DETAILS_MAX_LINKS,
  type CvDetails,
  type CvDetailsTextField,
  type UpdateCvDetailsRequest,
} from '@/core/profile/cvDetails';
import {
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** The one-line fields in the order of the form, with what each says under it. */
const FIELDS: {
  field: CvDetailsTextField;
  hint?: 'cv.detailsHeadlineHint' | 'cv.detailsLocationHint';
  example?: 'cv.detailsHeadlineExample' | 'cv.detailsLocationExample';
}[] = [
  { field: 'name' },
  {
    field: 'headline',
    hint: 'cv.detailsHeadlineHint',
    example: 'cv.detailsHeadlineExample',
  },
  { field: 'email' },
  { field: 'phone' },
  {
    field: 'location',
    hint: 'cv.detailsLocationHint',
    example: 'cv.detailsLocationExample',
  },
];

type Values = Record<CvDetailsTextField, string>;

const valuesOf = (details: CvDetails | null): Values => ({
  name: details?.name ?? '',
  headline: details?.headline ?? '',
  email: details?.email ?? '',
  phone: details?.phone ?? '',
  location: details?.location ?? '',
  rightToWork: details?.rightToWork ?? '',
});

/** The fields the candidate changed, as `updateCvDetails` takes them; empty when none. */
export const changesOf = (
  details: CvDetails | null,
  values: Values,
  links: string[],
): UpdateCvDetailsRequest => {
  const request: UpdateCvDetailsRequest = {};
  const before = valuesOf(details);
  for (const field of Object.keys(values) as CvDetailsTextField[]) {
    const value = values[field].trim();
    if (value !== before[field]) {
      request[field] = value;
    }
  }
  const kept = links.map(link => link.trim()).filter(Boolean);
  if (kept.join('\n') !== (details?.links ?? []).join('\n')) {
    request.links = kept;
  }
  return request;
};

export const CvDetailsPanel: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const { details } = useCvVersions();
  const { saveDetails } = useCvVersionsActions();
  const { resources } = useInterviewProfile();
  const [values, setValues] = useState(() => valuesOf(details));
  const [links, setLinks] = useState<string[]>(() => [
    ...(details?.links ?? []),
  ]);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const set = (field: CvDetailsTextField) => (value: string) =>
    setValues(current => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const request = changesOf(details, values, links);
    if (Object.keys(request).length === 0) {
      onClose();
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await saveDetails(request);
      onClose();
    } catch (error) {
      logProfileError('updateCvDetails', error, uid);
      setErrorMessage(
        getProfileErrorCode(error) === ProfileErrorCode.FlagOff
          ? t('cv.notAvailableMessage')
          : t('cv.detailsSaveFailedMessage'),
      );
      setIsBusy(false);
    }
  };

  // Where the details were filled from: the resources still named in `sources`.
  const fromIds = [...new Set(Object.values(details?.sources ?? {}))];
  const from = resources.filter(({ id }) => fromIds.includes(id));
  const filled = Object.values(valuesOf(details)).some(Boolean);
  let note: string;
  if (!filled && !details?.links?.length) {
    note = t('cv.detailsEmpty');
  } else if (from.length === 1) {
    const [resource] = from;
    note = `${
      resource.createdAt === null
        ? t('cv.detailsFilledFromNoDate', { title: resource.title })
        : t('cv.detailsFilledFrom', {
            title: resource.title,
            date: formatDay(resource.createdAt),
          })
    } ${t('cv.detailsKept')}`;
  } else if (from.length > 1) {
    note = `${t('cv.detailsFilledFromMany', {
      titles: from.map(({ title }) => title).join(', '),
    })} ${t('cv.detailsKept')}`;
  } else {
    note = t('cv.detailsKept');
  }

  return (
    <SidePanel
      title={t('cv.detailsTitle')}
      description={t('cv.detailsDescription')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        <p className="rounded-[12px] bg-tint px-3.5 py-3 text-sm leading-normal text-chip-text">
          {note}
        </p>
        {FIELDS.map(({ field, hint, example }) => (
          <FormTextInput
            key={field}
            name={field}
            label={t(`cv.detailsField_${field}`)}
            value={values[field]}
            onChange={event => set(field)(event.target.value)}
            placeholder={example ? t(example) : undefined}
            hint={hint ? t(hint) : undefined}
            maxLength={CV_DETAILS_MAX_CHARS}
            autoComplete={AUTOCOMPLETE[field]}
            type={
              field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'
            }
            disabled={isBusy}
          />
        ))}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-sm leading-natural font-medium">
            {t('cv.detailsLinksLabel', { max: CV_DETAILS_MAX_LINKS })}
          </legend>
          {links.map((link, index) => (
            <FormTextInput
              // The links have no ids of their own.
              key={index}
              name={`link-${index + 1}`}
              label={t('cv.detailsLinkLabel', { number: index + 1 })}
              value={link}
              onChange={event =>
                setLinks(current =>
                  current.map((other, at) =>
                    at === index ? event.target.value : other,
                  ),
                )
              }
              maxLength={CV_DETAILS_MAX_CHARS}
              disabled={isBusy}
              trailing={
                <button
                  type="button"
                  aria-label={t('cv.detailsRemoveLink', { number: index + 1 })}
                  disabled={isBusy}
                  onClick={() =>
                    setLinks(current => current.filter((_, at) => at !== index))
                  }
                  className="absolute top-0 right-0 flex size-12 cursor-pointer items-center justify-center text-muted hover:text-text disabled:cursor-not-allowed">
                  <Icon name="x" size={18} />
                </button>
              }
            />
          ))}
          {links.length < CV_DETAILS_MAX_LINKS && (
            <Button
              variant="quiet"
              size="small"
              disabled={isBusy}
              onClick={() => setLinks(current => [...current, ''])}
              className="gap-2 self-start">
              <Icon name="plus" size={18} />
              {t('cv.detailsAddLink')}
            </Button>
          )}
          <p className="text-sm leading-normal text-muted">
            {t('cv.detailsLinksHint')}
          </p>
        </fieldset>
        <FormTextInput
          name="rightToWork"
          label={t('cv.detailsField_rightToWork')}
          value={values.rightToWork}
          onChange={event => set('rightToWork')(event.target.value)}
          placeholder={t('cv.detailsRightToWorkExample')}
          hint={t('cv.detailsRightToWorkHint')}
          maxLength={CV_DETAILS_MAX_CHARS}
          disabled={isBusy}
        />
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          label={t('cv.detailsSaveButton')}
          busyLabel={t('cv.detailsSavingButton')}
        />
        <Button
          variant="secondary"
          disabled={isBusy}
          onClick={onClose}
          className="-mt-2 w-full">
          {t('cv.cancelButton')}
        </Button>
      </form>
    </SidePanel>
  );
};

const AUTOCOMPLETE: Partial<Record<CvDetailsTextField, string>> = {
  name: 'name',
  email: 'email',
  phone: 'tel',
  location: 'address-level2',
};

export default CvDetailsPanel;
