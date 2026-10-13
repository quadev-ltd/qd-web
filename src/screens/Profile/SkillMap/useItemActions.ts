import { useState } from 'react';

import { type SkillMapItem } from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { type ItemChange } from '@/core/profile/gateway';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch } from '@/core/state/hooks';
import {
  itemChanged,
  itemRemoved,
} from '@/core/state/slices/interviewProfileSlice';

/** Which change of an item is on its way to the backend. */
export type PendingItemChange = 'text' | 'starred' | 'hidden' | 'remove';

/**
 * The changes a candidate can make to one item: its text, its star, hiding it, removing it.
 * Each is one call to the backend. Nothing is shown as done before the backend has
 * answered (its first answer after a pause can take ten seconds): the page shows which
 * change is pending, and the item changes when the answer is there.
 */
export const useItemActions = (item: SkillMapItem) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid;
  const [pending, setPending] = useState<PendingItemChange>();
  const [failed, setFailed] = useState<PendingItemChange>();

  const run = async (
    what: PendingItemChange,
    call: () => Promise<void>,
    done: () => void,
  ): Promise<boolean> => {
    setPending(what);
    setFailed(undefined);
    try {
      await call();
    } catch (error) {
      // Removed meanwhile (from the app, or in another tab): there is nothing to change.
      if (getProfileErrorCode(error) === ProfileErrorCode.NotFound) {
        dispatch(itemRemoved(item.id));
        setPending(undefined);
        return what === 'remove';
      }
      logProfileError(
        what === 'remove' ? 'removeItem' : 'updateItem',
        error,
        uid,
      );
      setFailed(what);
      setPending(undefined);
      return false;
    }
    done();
    setPending(undefined);
    return true;
  };

  const change = (what: 'text' | 'starred' | 'hidden', update: ItemChange) =>
    run(
      what,
      () => gateway.updateItem(item.id, update),
      () =>
        dispatch(
          itemChanged({
            id: item.id,
            ...update,
            // As the backend does: a new text marks the item as edited.
            ...(update.text !== undefined && update.text !== item.text
              ? { edited: true }
              : {}),
          }),
        ),
    );

  return {
    /** Resolves true when the text was saved. */
    saveText: (text: string) => change('text', { text: text.trim() }),
    setStarred: (starred: boolean) => change('starred', { starred }),
    setHidden: (hidden: boolean) => change('hidden', { hidden }),
    /** Resolves true when the item is gone. */
    remove: () =>
      run(
        'remove',
        () => gateway.removeItem(item.id),
        () => dispatch(itemRemoved(item.id)),
      ),
    /** The change the backend has not answered yet. */
    pending,
    /** The last change, when the backend did not accept it. */
    failed,
    clearFailure: () => setFailed(undefined),
  };
};

export type ItemActions = ReturnType<typeof useItemActions>;
