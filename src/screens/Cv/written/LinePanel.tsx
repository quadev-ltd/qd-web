// A line or a role of a written CV, opened (doc 13 §20.1): the line, "Where it says this" with
// the words of each item it cites (or the candidate's answer or words), then "Edit" and "Remove
// this line". Editing a line asks "Your wording" beside "What we wrote"; a role's heading has its
// fields. An edited one can go back to what was written. Every change is one reviseCvLine.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CvReview } from '../review/useCvReview';

import NoteToProfile from './NoteToProfile';
import { type SourceContext } from './writtenMeta';

import FormTextArea from '@/components/FormTextArea';
import FormTextInput from '@/components/FormTextInput';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import {
  CV_SECTION_HEADINGS,
  type CvEntry,
  type CvEntryFields,
  cvEntryHeading,
  type CvLine,
  type CvLineSource,
  type CvSectionKey,
} from '@/core/profile/cvDocument';
import {
  CV_FIELD_MAX_CHARS,
  CV_LINE_MAX_CHARS,
} from '@/core/profile/cvVersions';
import { RESOURCE_TYPE_KEYS } from '@/screens/Profile/AddResource/resourceTypes';

/** What is open beside the CV: a line (with its role, if it is a bullet) or a role's heading. */
export type Opened =
  | { kind: 'line'; line: CvLine; entry?: CvEntry; section: CvSectionKey }
  | { kind: 'entry'; entry: CvEntry; section: CvSectionKey };

const ENTRY_FIELDS: {
  field: keyof CvEntryFields;
  label:
    | 'cv.roleTitle'
    | 'cv.roleOrganisation'
    | 'cv.roleLocation'
    | 'cv.roleFrom'
    | 'cv.roleTo';
}[] = [
  { field: 'title', label: 'cv.roleTitle' },
  { field: 'organisation', label: 'cv.roleOrganisation' },
  { field: 'location', label: 'cv.roleLocation' },
  { field: 'start', label: 'cv.roleFrom' },
  { field: 'end', label: 'cv.roleTo' },
];

/** The lines of what was asked that the line cites (D97), each one to add to the profile. */
const NotesToProfile: React.FC<{
  sources: CvLineSource[];
  context: SourceContext;
  version: { id: string; day: string };
}> = ({ sources, context, version }) => {
  const notes = sources.flatMap(source => {
    if (source.kind !== 'statement') {
      return [];
    }
    const statement = context.statements.find(({ id }) => id === source.id);
    return statement?.kind === 'note' ? [statement] : [];
  });
  if (notes.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3 border-t border-border-faint pt-3">
      {notes.map(statement => (
        <NoteToProfile
          key={statement.id}
          versionId={version.id}
          versionDay={version.day}
          statement={statement}
        />
      ))}
    </div>
  );
};

/** "Where it says this": each source with the words it says. */
const Sources: React.FC<{
  sources: CvLineSource[];
  context: SourceContext;
}> = ({ sources, context }) => {
  const { t } = useTranslation();
  const { items, resources, statements, writtenAgainDay } = context;
  if (items === null) {
    return (
      <span className="flex text-primary">
        <Spinner size="small" />
      </span>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {sources.map(source => {
        const key = source.kind === 'item' ? source.itemId : source.id;
        if (source.kind === 'statement') {
          const statement = statements.find(({ id }) => id === source.id);
          const answer = statement?.kind === 'answer';
          const note = statement?.kind === 'note';
          return (
            <li key={key} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="flex text-primary">
                  <Icon name={answer ? 'help' : 'edit'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  {answer
                    ? writtenAgainDay
                      ? t('cv.yourAnswerOf', { date: writtenAgainDay })
                      : t('cv.yourAnswerTitle')
                    : note
                      ? t('cv.askedSourceTitle')
                      : t('cv.yourWordsTitle')}
                </span>
                {note && (
                  <span className="text-[13px] font-normal text-muted">
                    {t('cv.askedYourWords')}
                  </span>
                )}
              </p>
              {answer && statement.question && (
                <p className="text-sm leading-normal text-muted">
                  {statement.question}
                </p>
              )}
              {statement && (
                <blockquote
                  className={`rounded-[12px] px-3.5 py-3 text-[15px] leading-normal ${
                    note
                      ? // The candidate's words, tinted as "Your words" are elsewhere.
                        'bg-tint shadow-[inset_3px_0_0_var(--color-primary)]'
                      : 'bg-background'
                  }`}>
                  {statement.text}
                </blockquote>
              )}
            </li>
          );
        }
        const item = items.get(source.itemId);
        const resource =
          item && !item.hidden
            ? resources.find(({ id }) => id === item.resourceId)
            : undefined;
        if (!item || item.hidden || !resource) {
          return (
            <li
              key={key}
              className="flex flex-col gap-1 rounded-[12px] border border-dashed border-border px-3.5 py-3">
              <p className="text-sm font-bold">{t('cv.sourceGoneTitle')}</p>
              <p className="text-sm leading-normal text-muted">
                {t('cv.sourceGoneText')}
              </p>
            </li>
          );
        }
        return (
          <li key={key} className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-sm">
              <span className="flex text-primary">
                <Icon name="file" size={16} />
              </span>
              <span className="min-w-0 flex-1 font-bold wrap-anywhere">
                {resource.title}
              </span>
              <span className="text-[13px] text-muted">
                {t(RESOURCE_TYPE_KEYS[resource.type])}
              </span>
            </p>
            <blockquote className="rounded-[12px] bg-background px-3.5 py-3 text-[15px] leading-normal">
              {item.evidence || item.text}
            </blockquote>
          </li>
        );
      })}
    </ul>
  );
};

export interface LinePanelProps {
  opened: Opened;
  context: SourceContext;
  review: CvReview;
}

export const LinePanel: React.FC<LinePanelProps> = ({
  opened,
  context,
  review,
}) => {
  const { t } = useTranslation();
  const isLine = opened.kind === 'line';
  const target = isLine ? opened.line : opened.entry;
  const [editing, setEditing] = useState(false);
  const [wording, setWording] = useState(isLine ? opened.line.text : '');
  const [fields, setFields] = useState<CvEntryFields>(() => ({
    title: opened.entry?.title ?? '',
    organisation: opened.entry?.organisation ?? '',
    location: opened.entry?.location ?? '',
    start: opened.entry?.start ?? '',
    end: opened.entry?.end ?? '',
  }));
  const busy = review.busy === target.id;
  const failed = review.failed === target.id;

  const where = [
    CV_SECTION_HEADINGS[opened.section],
    isLine && opened.entry
      ? [opened.entry.title, opened.entry.organisation]
          .filter(Boolean)
          .join(', ')
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const restore = () => review.revise({ lineId: target.id, action: 'restore' });
  const remove = () => review.revise({ lineId: target.id, action: 'remove' });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLine) {
      const text = wording.trim();
      if (!text || text.length > CV_LINE_MAX_CHARS) {
        return;
      }
      if (text === opened.line.text) {
        setEditing(false);
        return;
      }
      if (await review.revise({ lineId: target.id, action: 'edit', text })) {
        setEditing(false);
      }
      return;
    }
    const changed = Object.fromEntries(
      ENTRY_FIELDS.map(({ field }) => [field, fields[field].trim()]).filter(
        ([field, value]) =>
          value !== opened.entry[field as keyof CvEntryFields],
      ),
    ) as Partial<CvEntryFields>;
    if (Object.keys(changed).length === 0) {
      setEditing(false);
      return;
    }
    if (
      await review.revise({
        lineId: target.id,
        action: 'edit',
        fields: changed,
      })
    ) {
      setEditing(false);
    }
  };

  const failure = failed && (
    <Banner tone="danger" role="alert">
      {t('cv.reviseFailedMessage')}
    </Banner>
  );

  if (editing) {
    return (
      <form noValidate onSubmit={save} className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="brand">
            {isLine ? t('cv.thisLine') : t('cv.thisRole')}
          </Chip>
          <span className="text-[13px] leading-normal text-muted">{where}</span>
        </div>
        {isLine ? (
          <FormTextArea
            name="wording"
            label={t('cv.yourWordingLabel')}
            value={wording}
            onChange={event => setWording(event.target.value)}
            hint={t('cv.yourWordingHint')}
            counter={{ length: wording.trim().length, max: CV_LINE_MAX_CHARS }}
            disabled={busy}
            rows={4}
          />
        ) : (
          ENTRY_FIELDS.map(({ field, label }) => (
            <FormTextInput
              key={field}
              name={field}
              label={t(label)}
              value={fields[field]}
              onChange={event =>
                setFields(current => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
              hint={field === 'end' ? t('cv.roleToHint') : undefined}
              maxLength={CV_FIELD_MAX_CHARS}
              disabled={busy}
            />
          ))
        )}
        <div className="flex flex-col gap-1 rounded-[12px] bg-background px-3.5 py-3">
          <p className="text-[13px] font-medium text-muted">
            {t('cv.whatWeWrote')}
          </p>
          <p className="text-[15px] leading-normal">
            {isLine
              ? opened.line.proposed
              : cvEntryHeading(opened.entry.proposedFields)}
          </p>
        </div>
        {!isLine && (
          <p className="text-sm leading-normal text-muted">
            {t('cv.roleEditedHint')}
          </p>
        )}
        {failure}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="small"
            disabled={
              busy ||
              (isLine &&
                (!wording.trim() || wording.trim().length > CV_LINE_MAX_CHARS))
            }
            aria-busy={busy}
            className="gap-2">
            {busy && <Spinner size="small" decorative />}
            {isLine ? t('cv.saveWordingButton') : t('cv.saveRoleButton')}
          </Button>
          <Button
            variant="secondary"
            size="small"
            disabled={busy}
            onClick={() => setEditing(false)}>
            {t('cv.cancelButton')}
          </Button>
        </div>
      </form>
    );
  }

  const edited = target.state === 'edited';
  const removed = target.state === 'removed';
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="brand">{isLine ? t('cv.thisLine') : t('cv.thisRole')}</Chip>
        {edited && <Chip icon="edit">{t('cv.editedByYouChip')}</Chip>}
        {removed && <Chip tone="neutral">{t('cv.removedByYouChip')}</Chip>}
        <span className="text-[13px] leading-normal text-muted">{where}</span>
      </div>
      <p
        className={`text-base leading-normal font-medium wrap-anywhere ${removed ? 'text-muted line-through' : ''}`}>
        {isLine ? opened.line.text : cvEntryHeading(opened.entry)}
      </p>
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] font-medium tracking-[0.02em] text-muted">
          {t('cv.whereItSays')}
        </p>
        {edited ? (
          <p className="text-[15px] leading-normal text-muted">
            {t('cv.yourWordsText')}
          </p>
        ) : (
          <Sources sources={target.sources} context={context} />
        )}
      </div>
      {failure}
      <div className="flex flex-wrap items-center gap-2">
        {removed ? (
          <Button
            variant="secondary"
            size="small"
            disabled={busy}
            aria-busy={busy}
            onClick={() => {
              restore();
            }}
            className="gap-2">
            {busy ? (
              <Spinner size="small" decorative />
            ) : (
              <Icon name="refresh" size={18} />
            )}
            {t('cv.restoreLineButton')}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="small"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="gap-2">
              <Icon name="edit" size={18} />
              {t('cv.editButton')}
            </Button>
            {edited && (
              <Button
                variant="quiet"
                size="small"
                disabled={busy}
                aria-busy={busy}
                onClick={() => {
                  restore();
                }}
                className="gap-2">
                <Icon name="refresh" size={18} />
                {t('cv.restoreWrittenButton')}
              </Button>
            )}
            <Button
              variant="quietDanger"
              size="small"
              disabled={busy}
              aria-busy={busy}
              onClick={() => {
                remove();
              }}
              className="gap-2">
              {busy ? (
                <Spinner size="small" decorative />
              ) : (
                <Icon name="trash" size={18} />
              )}
              {isLine ? t('cv.removeLineButton') : t('cv.removeRoleButton')}
            </Button>
          </>
        )}
      </div>
      {!edited && !removed && context.version && (
        // D97: what was asked that the line cites, kept only in this CV until added.
        <NotesToProfile
          sources={target.sources}
          context={context}
          version={context.version}
        />
      )}
    </div>
  );
};

export default LinePanel;
