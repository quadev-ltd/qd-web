// One item of the skill map: what it says (which the candidate can correct), whether it is
// used first or never, the passage it was read from, and "Remove".
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import {
  RESOURCE_TYPE_ICONS,
  RESOURCE_TYPE_KEYS,
} from '../AddResource/resourceTypes';
import { ITEM_KIND_KEYS } from '../ItemRow';

import { useItemActions } from './useItemActions';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Dialog from '@/components/ui/Dialog';
import Switch from '@/components/ui/Switch';
import {
  type ProfileResource,
  SKILL_MAP_ITEM_MAX_CHARS,
  type SkillMapItem,
} from '@/core/profile/contract';
import { resourcePath } from '@/core/profile/paths';
import {
  ItemTextFields,
  itemTextSchema,
  type ItemTextSchemaType,
} from '@/schemas/itemTextSchema';

export interface ItemPanelProps {
  item: SkillMapItem;
  /** The resource the item came from, when the profile still has it. */
  resource?: ProfileResource;
  /** The item was removed: there is nothing left to show here. */
  onRemoved: () => void;
}

export const ItemPanel: React.FC<ItemPanelProps> = ({
  item,
  resource,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const actions = useItemActions(item);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const error = useRef<HTMLDivElement>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemTextSchemaType>({
    resolver: zodResolver(itemTextSchema),
    mode: 'onChange',
    defaultValues: { text: item.text },
  });
  const text = useWatch({ control, name: ItemTextFields.text });

  const { failed, pending } = actions;
  useEffect(() => {
    if (failed) {
      error.current?.focus();
    }
  }, [failed]);

  const startEditing = () => {
    reset({ text: item.text });
    actions.clearFailure();
    setEditing(true);
  };
  const save = handleSubmit(async values => {
    if (values.text === item.text || (await actions.saveText(values.text))) {
      setEditing(false);
    }
  });
  const isSaving = pending === 'text';

  return (
    <div className="flex flex-col gap-4">
      {failed && failed !== 'remove' && (
        <Banner ref={error} tone="danger" role="alert">
          {t('item.saveFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">{t(ITEM_KIND_KEYS[item.kind])}</Chip>
        {item.edited && <Chip tone="neutral">{t('resource.editedChip')}</Chip>}
        {item.hidden && <Chip tone="neutral">{t('resource.hiddenChip')}</Chip>}
      </div>

      <Card elevation="raised" className="gap-3 p-4">
        {editing ? (
          <form noValidate onSubmit={save} className="flex flex-col gap-3">
            <Controller
              name={ItemTextFields.text}
              control={control}
              render={({ field }) => (
                <FormTextArea
                  {...field}
                  rows={5}
                  label={t('item.textLabel')}
                  error={errors.text}
                  disabled={isSaving}
                  counter={{
                    length: text.trim().length,
                    max: SKILL_MAP_ITEM_MAX_CHARS,
                  }}
                />
              )}
            />
            <div className="flex gap-2.5">
              <Button
                type="submit"
                disabled={isSaving || errors.text?.type === 'too_big'}
                aria-busy={isSaving}
                className="flex-1 gap-2.5">
                {isSaving && <Spinner size="small" decorative />}
                {isSaving ? t('item.savingButton') : t('item.saveButton')}
              </Button>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => {
                  actions.clearFailure();
                  setEditing(false);
                }}
                className="flex-1">
                {t('item.cancelButton')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-[18px] leading-normal font-medium wrap-anywhere">
              {item.text}
            </p>
            <Button
              variant="secondary"
              size="small"
              onClick={startEditing}
              className="gap-2 self-start text-[15px]">
              <Icon name="edit" size={18} />
              {t('item.editButton')}
            </Button>
          </>
        )}
      </Card>

      <Card elevation="raised" className="gap-1 p-4">
        <Switch
          icon="star"
          label={t('item.starLabel')}
          description={t('item.starDescription')}
          checked={item.starred}
          busy={pending === 'starred'}
          disabled={Boolean(pending)}
          onChange={actions.setStarred}
        />
        <div className="h-px bg-border-faint" />
        <Switch
          icon="eyeOff"
          label={t('item.hideLabel')}
          description={t('item.hideDescription')}
          checked={item.hidden}
          busy={pending === 'hidden'}
          disabled={Boolean(pending)}
          onChange={actions.setHidden}
        />
      </Card>

      <Card as="section" elevation="raised" className="gap-2.5 p-4">
        <h2 className="font-display text-[18px] leading-tight font-semibold">
          {t('item.sourceTitle')}
        </h2>
        {item.evidence && (
          <>
            <blockquote className="rounded-control bg-background px-3.5 py-3 text-[15px] leading-normal wrap-anywhere">
              {item.evidence}
            </blockquote>
            <p className="text-sm leading-normal text-muted">
              {t('item.evidenceNote')}
            </p>
          </>
        )}
        {resource && (
          <Link
            to={resourcePath(resource.id)}
            className="flex items-center gap-3 border-t border-border-faint pt-3 text-text no-underline hover:text-text">
            <span
              aria-hidden="true"
              className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name={RESOURCE_TYPE_ICONS[resource.type]} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] leading-normal text-muted">
                {t(RESOURCE_TYPE_KEYS[resource.type])}
              </span>
              <span className="text-base leading-normal font-medium wrap-anywhere">
                {resource.title}
              </span>
            </span>
            <span className="flex text-muted">
              <Icon name="right" />
            </span>
          </Link>
        )}
      </Card>

      <Button
        variant="quietDanger"
        size="small"
        disabled={Boolean(pending)}
        onClick={() => {
          actions.clearFailure();
          setRemoving(true);
        }}
        className="gap-2 self-start text-[15px]">
        <Icon name="trash" size={18} />
        {t('item.removeLink')}
      </Button>

      {removing && (
        <Dialog
          title={t('item.removeDialogTitle')}
          icon="trash"
          tone="danger"
          onClose={() => {
            if (pending !== 'remove') {
              setRemoving(false);
            }
          }}>
          <p className="text-[16px] leading-normal text-muted">
            {t('item.removeDialogDescription')}
          </p>
          {failed === 'remove' && (
            <Banner ref={error} tone="danger" role="alert">
              {t('item.removeFailedMessage')}
            </Banner>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              disabled={pending === 'remove'}
              aria-busy={pending === 'remove'}
              onClick={async () => {
                if (await actions.remove()) {
                  onRemoved();
                }
              }}
              className="flex-[1_1_200px] gap-2">
              {pending === 'remove' ? (
                <Spinner size="small" decorative />
              ) : (
                <Icon name="trash" size={18} />
              )}
              {pending === 'remove'
                ? t('item.removingButton')
                : t('item.removeConfirmButton')}
            </Button>
            <Button
              variant="secondary"
              disabled={pending === 'remove'}
              onClick={() => setRemoving(false)}
              className="flex-[1_1_120px]">
              {t('item.cancelButton')}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default ItemPanel;
