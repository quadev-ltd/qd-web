// What was read from one resource, by kind, read only (D68: no skill map page for now). The
// skills are tags; each item of the other kinds opens to show the passage it was read from.
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { KIND_TITLE_KEYS } from '../kinds';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  SKILL_MAP_KINDS,
  type SkillMapItem,
  type SkillMapKind,
} from '@/core/profile/contract';

/** How many items of a kind are listed before "Show all". The skills are all shown. */
export const ITEMS_SHOWN = 3;

/** One item, and the passage it was read from when it is opened. */
const ReadRow: React.FC<{ item: SkillMapItem }> = ({ item }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const passageId = useId();
  const text = (
    <span className="min-w-0 flex-1 text-[15px] leading-normal wrap-anywhere">
      {item.text}
    </span>
  );
  // Nothing to open without a passage.
  if (!item.evidence) {
    return <p className="flex py-2.5">{text}</p>;
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={passageId}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full cursor-pointer items-start gap-3 py-2.5 text-left text-text">
        {text}
        <span className="flex pt-0.5 text-muted">
          <Icon name={open ? 'up' : 'down'} size={18} />
        </span>
      </button>
      <div id={passageId} hidden={!open} className="flex flex-col gap-1.5 pb-3">
        <p className="text-[13px] leading-normal font-medium text-muted">
          {t('resource.passageLabel')}
        </p>
        <blockquote className="rounded-control bg-background px-3.5 py-3 text-[15px] leading-normal wrap-anywhere">
          {item.evidence}
        </blockquote>
      </div>
    </>
  );
};

const KindBlock: React.FC<{ kind: SkillMapKind; items: SkillMapItem[] }> = ({
  kind,
  items,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const shown = showAll ? items : items.slice(0, ITEMS_SHOWN);
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 border-border-faint not-first:border-t not-first:pt-4">
      <div className="flex items-baseline gap-2">
        <h3
          id={headingId}
          className="flex-1 font-display text-base leading-tight font-semibold">
          {t(KIND_TITLE_KEYS[kind])}
        </h3>
        <p className="text-sm leading-normal font-medium text-muted">
          {items.length}
        </p>
      </div>
      {kind === 'skill' ? (
        <ul className="flex flex-wrap gap-2">
          {items.map(item => (
            <li
              key={item.id}
              className="rounded-full bg-background px-3 py-1.5 text-sm leading-snug wrap-anywhere">
              {item.text}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map(item => (
              <li
                key={item.id}
                className="border-border-faint not-first:border-t">
                <ReadRow item={item} />
              </li>
            ))}
          </ul>
          {items.length > ITEMS_SHOWN && !showAll && (
            <Button
              variant="quiet"
              size="small"
              onClick={() => setShowAll(true)}
              className="self-start text-[15px]">
              {t('resource.showAllButton', { count: items.length })}
            </Button>
          )}
        </>
      )}
    </section>
  );
};

/** "What we read": the items of one resource, by kind, in the order the profile counts them. */
export const WhatWeRead: React.FC<{ items: SkillMapItem[] }> = ({ items }) => {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <h2
            id={headingId}
            className="flex-1 font-display text-[18px] leading-tight font-semibold">
            {t('resource.readTitle')}
          </h2>
          <p className="text-sm leading-normal text-muted">
            {t('resource.readCount', { count: items.length })}
          </p>
        </div>
        <p className="text-sm leading-normal text-muted">
          {t('resource.readDescription')}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {SKILL_MAP_KINDS.map(kind => {
          const ofKind = items.filter(item => item.kind === kind);
          return (
            ofKind.length > 0 && (
              <KindBlock key={kind} kind={kind} items={ofKind} />
            )
          );
        })}
      </div>
    </Card>
  );
};

export default WhatWeRead;
