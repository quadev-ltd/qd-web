import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddFileForm from './AddFileForm';
import AddLinkForm from './AddLinkForm';
import AddTextForm from './AddTextForm';
import { useAddResource } from './useAddResource';

import Icon, { type IconName } from '@/components/Icon';
import SidePanel from '@/components/ui/SidePanel';

export interface AddResourcePanelProps {
  /**
   * any: every kind of resource. cv: opened by "Add your CV": a file or pasted text, added
   * as a CV (the backend does not take a link as a CV). note: opened by "Add a story" on a
   * gap of a brief: the pasted text form, as a note (D53).
   */
  kind?: 'any' | 'cv' | 'note';
  onClose: () => void;
}

type Step = 'choice' | 'file' | 'text' | 'link';

interface OptionProps {
  icon: IconName;
  title: string;
  description: string;
  onClick: () => void;
}

const Option: React.FC<OptionProps> = ({
  icon,
  title,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-border-strong bg-surface p-3.5 text-left text-text hover:bg-tint">
    <span
      aria-hidden="true"
      className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
      <Icon name={icon} size={20} />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-base leading-normal font-bold">{title}</span>
      <span className="text-sm leading-normal text-muted">{description}</span>
    </span>
    <span className="flex text-muted">
      <Icon name="right" />
    </span>
  </button>
);

/**
 * "Add a resource": first how (a file, pasted text or a link), then the form for it. A side
 * panel over the profile; on a phone it fills the screen. It closes itself when the
 * resource is added: the list behind it then shows it being read.
 */
export const AddResourcePanel: React.FC<AddResourcePanelProps> = ({
  kind = 'any',
  onClose,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(kind === 'note' ? 'text' : 'choice');
  const adding = useAddResource(onClose);
  const cvOnly = kind === 'cv';

  if (step === 'choice') {
    return (
      <SidePanel
        title={t(
          cvOnly ? 'addResource.cvChoiceTitle' : 'addResource.choiceTitle',
        )}
        description={t(
          cvOnly
            ? 'addResource.cvChoiceDescription'
            : 'addResource.choiceDescription',
        )}
        onClose={onClose}>
        <div className="flex flex-col gap-3">
          <Option
            icon="upload"
            title={t('addResource.fileOptionTitle')}
            description={t('addResource.fileOptionDescription')}
            onClick={() => setStep('file')}
          />
          <Option
            icon="text"
            title={t('addResource.textOptionTitle')}
            description={t(
              cvOnly
                ? 'addResource.cvTextOptionDescription'
                : 'addResource.textOptionDescription',
            )}
            onClick={() => setStep('text')}
          />
          {!cvOnly && (
            <Option
              icon="link"
              title={t('addResource.linkOptionTitle')}
              description={t('addResource.linkOptionDescription')}
              onClick={() => setStep('link')}
            />
          )}
        </div>
      </SidePanel>
    );
  }

  const title =
    step === 'file'
      ? t(cvOnly ? 'addResource.cvFileTitle' : 'addResource.fileTitle')
      : step === 'text'
        ? t('addResource.textTitle')
        : t('addResource.linkTitle');
  return (
    <SidePanel title={title} onClose={onClose}>
      {step === 'file' && <AddFileForm adding={adding} cvOnly={cvOnly} />}
      {step === 'text' && <AddTextForm adding={adding} cvOnly={cvOnly} />}
      {step === 'link' && <AddLinkForm adding={adding} />}
    </SidePanel>
  );
};

export default AddResourcePanel;
