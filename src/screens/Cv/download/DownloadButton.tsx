import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  cvBlocks,
  cvFileName,
  cvPaper,
  makeDocx,
  makePdf,
  saveFile,
  writtenBlocks,
} from './cvFile';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import {
  type CvVersion,
  cvVersionText,
  isWrittenVersion,
} from '@/core/profile/cvVersions';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import { logProfileError } from '@/core/profile/errors';
import { useSessionUser } from '@/core/session/hooks';

export interface DownloadButtonProps {
  version: CvVersion;
  /** What the file is called, without its extension. */
  fileTitle: string;
}

/**
 * The one download of a version (D75): "Download PDF", with an arrow for Word (.docx). The file
 * is made here: a written version from its structure, its header from the CV's details as they
 * are now; an edit version from its text, once nothing is left to review.
 */
export const DownloadButton: React.FC<DownloadButtonProps> = ({
  version,
  fileTitle,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const { details } = useCvVersions();
  const [busy, setBusy] = useState<'pdf' | 'docx'>();
  const [menu, setMenu] = useState(false);
  const [failed, setFailed] = useState(false);

  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setMenu(false);
    }
  };

  const download = async (format: 'pdf' | 'docx') => {
    setMenu(false);
    setBusy(format);
    setFailed(false);
    try {
      const blocks = isWrittenVersion(version)
        ? writtenBlocks(
            version.document ?? {
              summary: [],
              experience: [],
              projects: [],
              skills: [],
              education: [],
              certifications: [],
              languages: [],
            },
            details,
            version.convention,
          )
        : cvBlocks(cvVersionText(version));
      // A US resume on US Letter; every other CV, and an edit version, on A4.
      const paper = cvPaper(
        isWrittenVersion(version) ? version.convention : undefined,
      );
      const file =
        format === 'pdf'
          ? await makePdf(blocks, { paper })
          : await makeDocx(blocks, paper);
      saveFile(file, cvFileName([fileTitle], format));
    } catch (error) {
      logProfileError(`downloadCv(${format})`, error, uid);
      setFailed(true);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative flex self-start">
        <Button
          disabled={busy !== undefined}
          aria-busy={busy === 'pdf'}
          onClick={() => {
            download('pdf');
          }}
          className="gap-2 rounded-r-none">
          {busy ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="download" size={18} />
          )}
          {busy ? t('cv.makingFile') : t('cv.downloadPdfButton')}
        </Button>
        <Button
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={t('cv.otherFormats')}
          disabled={busy !== undefined}
          onClick={() => setMenu(open => !open)}
          onKeyDown={closeOnEscape}
          className="rounded-l-none border-l border-white/45 px-3">
          <Icon name="down" size={18} />
        </Button>
        {menu && (
          <div
            role="menu"
            aria-label={t('cv.otherFormats')}
            className="absolute top-full left-0 z-10 mt-1 flex min-w-full flex-col rounded-[12px] bg-surface p-1 shadow-card">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                download('docx');
              }}
              onKeyDown={closeOnEscape}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-3 text-left text-[15px] font-medium text-text hover:bg-tint">
              <Icon name="file" size={18} />
              {t('cv.downloadWord')}
            </button>
          </div>
        )}
      </div>
      {failed && (
        <Banner tone="danger" role="alert">
          {t('cv.downloadFailedMessage')}
        </Banner>
      )}
    </div>
  );
};

export default DownloadButton;
