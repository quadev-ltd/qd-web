// The mock interview controller for a page (D100): made once with the browser's microphone,
// recorder and player, followed with useSyncExternalStore, and stopped when the page closes.
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  AnswerRecorder,
  blobToBase64,
  LinePlayer,
  openMicrophone,
} from '@/core/mock/audio';
import { mockClient } from '@/core/mock/client';
import { MockInterviewController } from '@/core/mock/MockInterviewController';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';

/** The clock the controller measures with, so the page counts the time down on the same one. */
export const mockNow = () => performance.now();

export const useMockController = (onStarted: (sessionId: string) => void) => {
  const gateway = useProfileGateway();
  const [controller] = useState(
    () =>
      new MockInterviewController({
        gateway,
        openMicrophone,
        createRecorder: stream => new AnswerRecorder(stream, mockNow),
        player: new LinePlayer(mockNow),
        client: mockClient,
        toBase64: blobToBase64,
        uuid: () => crypto.randomUUID(),
        now: mockNow,
        wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
      }),
  );
  useEffect(() => {
    controller.whenStarted(onStarted);
  });
  // Nothing keeps playing, recording or holding the microphone once the page closes.
  useEffect(() => () => controller.dispose(), [controller]);
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
};
