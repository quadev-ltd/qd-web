// What the "upload a file" form needs to know about a file before anything is sent.
import {
  PROFILE_UPLOAD_CONTENT_TYPES,
  type ProfileUploadContentType,
} from './contract';

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** For a browser that does not name the type of a file: its extension decides. */
const TYPES_BY_EXTENSION: Record<string, ProfileUploadContentType> = {
  pdf: 'application/pdf',
  docx: DOCX,
  txt: 'text/plain',
};

/** What the file picker offers: the three types, by MIME type and by extension. */
export const PROFILE_UPLOAD_ACCEPT = [
  ...PROFILE_UPLOAD_CONTENT_TYPES,
  ...Object.keys(TYPES_BY_EXTENSION).map(extension => `.${extension}`),
].join(',');

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * The content type the backend accepts for this file (PDF, DOCX or plain text), or
 * `undefined` when it is none of them. The browser's own answer comes first; a type with a
 * parameter ("text/plain;charset=utf-8") counts as the type.
 */
export const uploadContentTypeOf = (
  file: Pick<File, 'name' | 'type'>,
): ProfileUploadContentType | undefined => {
  const declared = file.type.split(';')[0].trim().toLowerCase();
  const known = PROFILE_UPLOAD_CONTENT_TYPES.find(type => type === declared);
  if (known) {
    return known;
  }
  // A type the backend does not take is not rescued by its extension.
  return declared ? undefined : TYPES_BY_EXTENSION[extensionOf(file.name)];
};

/** "184 KB", "14.2 MB": the size as a person reads it. */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** A first title for a file: its name without the extension. */
export const titleFromFileName = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
};
