import { useEffect, useState } from 'react';

import { type ProfileResource } from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

/**
 * The address that downloads the original file of a resource, for a link; `undefined` while
 * it is not known, and for a resource that has no file (pasted text, a link, or a file that
 * has not arrived yet).
 *
 * It is asked for when the page opens, not at the press on "Download": a link the browser
 * can follow by itself is never blocked as a window the page opened, and the page never
 * reads the file (that would need a rule on the bucket, docs/adr/0007). When the address
 * cannot be had, there is no link.
 */
export const useFileUrl = (
  resource?: Pick<ProfileResource, 'source' | 'status' | 'storagePath'>,
): string | undefined => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [found, setFound] = useState<{ path: string; url: string }>();

  const path =
    resource?.source === 'file' &&
    resource.status !== 'awaitingUpload' &&
    resource.storagePath
      ? resource.storagePath
      : undefined;

  useEffect(() => {
    if (!path) {
      return undefined;
    }
    let active = true;
    gateway.getFileUrl({ storagePath: path }).then(
      url => {
        if (active) {
          setFound({ path, url });
        }
      },
      error => logProfileError('getFileUrl', error, uid),
    );
    return () => {
      active = false;
    };
  }, [gateway, path, uid]);

  return found && found.path === path ? found.url : undefined;
};

export default useFileUrl;
