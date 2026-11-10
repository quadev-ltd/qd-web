// The mock interview controllers for a page (D100): taking turns, and real time (doc 24 §15), each
// made once with the browser's microphone and sound, followed with useSyncExternalStore, and
// stopped when the page closes. Only the way chosen is ever started.
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  AnswerRecorder,
  blobToBase64,
  LinePlayer,
  openMicrophone,
} from '@/core/mock/audio';
import { mockClient } from '@/core/mock/client';
import { LiveAudio } from '@/core/mock/liveAudio';
import { LiveInterviewController } from '@/core/mock/LiveInterviewController';
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

export const useLiveController = (onStarted: (sessionId: string) => void) => {
  const gateway = useProfileGateway();
  const [controller] = useState(() => {
    const audio = new LiveAudio(mockNow);
    return new LiveInterviewController({
      gateway,
      openMicrophone,
      stream: (stream, onFrame) => audio.stream(stream, onFrame),
      voice: audio,
      client: mockClient,
      uuid: () => crypto.randomUUID(),
      now: mockNow,
      wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    });
  });
  useEffect(() => {
    controller.whenStarted(onStarted);
  });
  // The connection closes once the page does: the relay stops the clock.
  useEffect(() => () => controller.dispose(), [controller]);
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
};
