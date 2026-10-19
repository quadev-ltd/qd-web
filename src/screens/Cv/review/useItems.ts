import { useEffect, useState } from 'react';

import { type SkillMapItem } from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

/**
 * The profile's items, for "Based on" and "Where it says this": read once for the page. Each
 * item is a billed read, so only a page that names them reads them, as the brief does. `null`
 * while they are read; an empty map when they could not be.
 */
export const useItems = (needed: boolean): Map<string, SkillMapItem> | null => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [items, setItems] = useState<Map<string, SkillMapItem> | null>(null);
  useEffect(() => {
    if (!uid || !needed) {
      return undefined;
    }
    let live = true;
    gateway.getItems(uid).then(
      list => live && setItems(new Map(list.map(item => [item.id, item]))),
      error => {
        logProfileError('getItems', error, uid);
        if (live) {
          setItems(new Map());
        }
      },
    );
    return () => {
      live = false;
    };
  }, [gateway, needed, uid]);
  return items;
};

export default useItems;
