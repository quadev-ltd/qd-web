import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import AddResourceFooter from './AddResourceFooter';
import FixedType from './FixedType';
import { RESOURCE_TYPE_KEYS } from './resourceTypes';
import { type AddResource } from './useAddResource';

import FormTextArea from '@/components/FormTextArea';
import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import SegmentedControl from '@/components/ui/SegmentedControl';
import {
  PROFILE_TEXT_MAX_CHARS,
  PROFILE_TITLE_MAX_CHARS,
  RESOURCE_TYPES_BY_SOURCE,
} from '@/core/profile/contract';
import {
  AddResourceFields,
  addTextSchema,
  type AddTextSchemaType,
} from '@/schemas/addResourceSchema';

export interface AddTextFormProps {
  adding: AddResource;
  /** The form adds a CV and nothing else ("Add your CV"): there is no type to choose. */
  cvOnly?: boolean;
}

/** "Paste or type text": a title, what kind of text it is, and the text. */
export const AddTextForm: React.FC<AddTextFormProps> = ({
  adding,
  cvOnly = false,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddTextSchemaType>({
    resolver: zodResolver(addTextSchema),
    mode: 'onChange',
    defaultValues: { title: '', type: cvOnly ? 'cv' : 'note', text: '' },
  });
  const title = useWatch({ control, name: AddResourceFields.title });
  const type = useWatch({ control, name: AddResourceFields.type });
  const text = useWatch({ control, name: AddResourceFields.text });

  const onSubmit = handleSubmit(values => {
    adding.add({
      source: 'text',
      type: cvOnly ? 'cv' : values.type,
      title: values.title,
      text: values.text,
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
      {cvOnly ? (
        <FixedType type="cv" />
      ) : (
        <SegmentedControl
          label={t('addResource.typeLabel')}
          options={RESOURCE_TYPES_BY_SOURCE.text.map(value => ({
            value,
            label: t(RESOURCE_TYPE_KEYS[value]),
          }))}
          value={type}
          disabled={adding.isBusy}
          onChange={value => setValue(AddResourceFields.type, value)}
        />
      )}
      <Controller
        name={AddResourceFields.text}
        control={control}
        render={({ field }) => (
          <FormTextArea
            {...field}
            label={t('addResource.textLabel')}
            error={errors.text}
            disabled={adding.isBusy}
            counter={{
              length: text.trim().length,
              max: PROFILE_TEXT_MAX_CHARS,
            }}
          />
        )}
      />
      <AddResourceFooter
        adding={adding}
        blocked={
          errors.title?.type === 'too_big' || errors.text?.type === 'too_big'
        }
      />
    </form>
  );
};

export default AddTextForm;
