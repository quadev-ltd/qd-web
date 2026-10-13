import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import AddResourceFooter from './AddResourceFooter';
import FixedType from './FixedType';
import { type AddResource } from './useAddResource';

import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import { PROFILE_TITLE_MAX_CHARS } from '@/core/profile/contract';
import {
  addLinkSchema,
  type AddLinkSchemaType,
  AddResourceFields,
} from '@/schemas/addResourceSchema';

/** "Add a link": a title and the address of a public page. */
export const AddLinkForm: React.FC<{ adding: AddResource }> = ({ adding }) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddLinkSchemaType>({
    resolver: zodResolver(addLinkSchema),
    mode: 'onChange',
    defaultValues: { title: '', url: '' },
  });
  const title = useWatch({ control, name: AddResourceFields.title });

  const onSubmit = handleSubmit(values => {
    adding.add({
      source: 'link',
      type: 'link',
      title: values.title,
      url: values.url,
    });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[18px]">
      <HookFormTextInput
        name={AddResourceFields.title}
        control={control}
        label={t('addResource.titleLabel')}
        error={errors.title}
        disabled={adding.isBusy}
        counter={{ length: title.trim().length, max: PROFILE_TITLE_MAX_CHARS }}
      />
      <HookFormTextInput
        name={AddResourceFields.url}
        control={control}
        label={t('addResource.addressLabel')}
        type="url"
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={t('addResource.addressPlaceholder')}
        error={errors.url}
        disabled={adding.isBusy}
        hint={errors.url ? undefined : t('addResource.addressHint')}
      />
      <FixedType type="link" />
      <AddResourceFooter
        adding={adding}
        // An address that is not accepted is a mistake to correct, like a broken limit;
        // an empty one is said when the form is sent.
        blocked={
          errors.title?.type === 'too_big' || errors.url?.type === 'custom'
        }
      />
    </form>
  );
};

export default AddLinkForm;
