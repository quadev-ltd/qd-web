import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import AddResourceFooter from './AddResourceFooter';
import FixedType from './FixedType';
import { RESOURCE_TYPE_KEYS } from './resourceTypes';
import { type AddResource } from './useAddResource';

import HookFormTextInput from '@/components/HookFormInputs/HookFormTextInput';
import FilePicker from '@/components/ui/FilePicker';
import SegmentedControl from '@/components/ui/SegmentedControl';
import {
  PROFILE_TITLE_MAX_CHARS,
  PROFILE_UPLOAD_MAX_BYTES,
  RESOURCE_TYPES_BY_SOURCE,
} from '@/core/profile/contract';
import {
  formatFileSize,
  PROFILE_UPLOAD_ACCEPT,
  titleFromFileName,
  uploadContentTypeOf,
} from '@/core/profile/files';
import {
  addFileSchema,
  type AddFileSchemaType,
  AddResourceFields,
} from '@/schemas/addResourceSchema';

export interface AddFileFormProps {
  adding: AddResource;
  /** The form adds a CV and nothing else ("Add your CV"): there is no type to choose. */
  cvOnly?: boolean;
}

/** Why a chosen file cannot be added, in the order the candidate can act on. */
const fileProblem = (file: File) => {
  if (!uploadContentTypeOf(file)) {
    return 'type' as const;
  }
  if (file.size === 0) {
    return 'empty' as const;
  }
  return file.size > PROFILE_UPLOAD_MAX_BYTES ? ('size' as const) : undefined;
};

/** "Upload a file": the file, a title and whether it is a CV or another document. */
export const AddFileForm: React.FC<AddFileFormProps> = ({
  adding,
  cvOnly = false,
}) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File>();
  const [fileMissing, setFileMissing] = useState(false);
  // The title the form proposed from the file name, while the candidate has not typed another.
  const [proposedTitle, setProposedTitle] = useState<string>();
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AddFileSchemaType>({
    resolver: zodResolver(addFileSchema),
    mode: 'onChange',
    defaultValues: { title: '', type: 'cv' },
  });
  const title = useWatch({ control, name: AddResourceFields.title });
  const type = useWatch({ control, name: AddResourceFields.type });

  const problem = file ? fileProblem(file) : undefined;
  const fileError = problem
    ? t(
        problem === 'type'
          ? 'addResource.fileTypeError'
          : problem === 'empty'
            ? 'addResource.fileEmptyError'
            : 'addResource.fileSizeError',
        { size: file ? formatFileSize(file.size) : '' },
      )
    : fileMissing && !file
      ? t('addResource.fileRequiredError')
      : undefined;

  const onFile = (chosen: File) => {
    setFile(chosen);
    setFileMissing(false);
    const current = getValues(AddResourceFields.title);
    if (!current.trim() || current === proposedTitle) {
      const proposed = titleFromFileName(chosen.name);
      setProposedTitle(proposed);
      setValue(AddResourceFields.title, proposed, { shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(values => {
    const contentType = file && uploadContentTypeOf(file);
    if (!file || !contentType || problem) {
      setFileMissing(!file);
      return;
    }
    adding.add(
      {
        source: 'file',
        type: cvOnly ? 'cv' : values.type,
        title: values.title,
        contentType,
      },
      file,
    );
  });

  const locked = adding.isBusy || adding.hasUnfinishedUpload;
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[18px]">
      <FilePicker
        label={t('addResource.fileLabel')}
        accept={PROFILE_UPLOAD_ACCEPT}
        file={file && { name: file.name, size: formatFileSize(file.size) }}
        emptyText={t('addResource.fileEmptyText')}
        chooseLabel={t('addResource.chooseFileButton')}
        changeLabel={t('addResource.changeFileButton')}
        error={fileError}
        disabled={locked}
        onChange={onFile}
      />
      <HookFormTextInput
        name={AddResourceFields.title}
        control={control}
        label={t('addResource.titleLabel')}
        error={errors.title}
        disabled={locked}
        hint={
          proposedTitle !== undefined && title === proposedTitle
            ? t('addResource.titleFromFileHint')
            : undefined
        }
        counter={{ length: title.trim().length, max: PROFILE_TITLE_MAX_CHARS }}
      />
      {cvOnly ? (
        <FixedType type="cv" />
      ) : (
        <SegmentedControl
          label={t('addResource.typeLabel')}
          options={RESOURCE_TYPES_BY_SOURCE.file.map(value => ({
            value,
            label: t(RESOURCE_TYPE_KEYS[value]),
          }))}
          value={type}
          disabled={locked}
          onChange={value => setValue(AddResourceFields.type, value)}
        />
      )}
      <AddResourceFooter
        adding={adding}
        blocked={Boolean(problem) || errors.title?.type === 'too_big'}
      />
    </form>
  );
};

export default AddFileForm;
