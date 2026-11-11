// One recording at a time for a page that records now and then: dictating a practice answer (D102,
// research doc 25 §2). The microphone is asked for on the press, the answer recorded with mock
// interviews' recorder (./recording), and the microphone let go once it stops, so the browser's
// recording mark goes off. Mock interviews keep theirs for the whole interview, in their
// controllers.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AnswerRecorder,
  canRecord,
  microphoneFailureOf,
  openMicrophone,
  type Recording,
} from './recording';

/** Asking for the microphone, refused, none found, a browser that can't record, or recording. */
export type RecorderPhase =
  'idle' | 'asking' | 'refused' | 'missing' | 'unsupported' | 'recording';

export interface RecorderOptions {
  /** The longest a recording runs: `onEnd` is called then. */
  maxMs: number;
  /** The recording should end: at `maxMs`, or the microphone was lost (unplugged, or taken). */
  onEnd: () => void;
}

export const useRecorder = ({ maxMs, onEnd }: RecorderOptions) => {
  const [phase, setPhase] = useState<RecorderPhase>(() =>
    canRecord() ? 'idle' : 'unsupported',
  );
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<AnswerRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Goes up with every start, stop and cancel: a microphone given after the press it was asked
  // for is let go at once.
  const generation = useRef(0);
  const ended = useRef(onEnd);
  useEffect(() => {
    ended.current = onEnd;
  });

  const release = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  /** In a press: asks for the microphone (the browser may ask the candidate), then records. */
  const start = useCallback(async () => {
    const mine = ++generation.current;
    setPhase('asking');
    let opened: MediaStream;
    try {
      opened = await openMicrophone();
    } catch (error) {
      if (mine === generation.current) {
        const failure = microphoneFailureOf(error);
        setPhase(
          failure === 'refused'
            ? 'refused'
            : failure === 'unsupported'
              ? 'unsupported'
              : 'missing',
        );
      }
      return;
    }
    if (mine !== generation.current) {
      opened.getTracks().forEach(track => track.stop());
      return;
    }
    stream.current = opened;
    for (const track of opened.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (mine === generation.current) {
          ended.current();
        }
      });
    }
    const next = new AnswerRecorder(opened);
    recorder.current = next;
    next.start();
    timer.current = setTimeout(() => ended.current(), maxMs);
    setPhase('recording');
  }, [maxMs]);

  /** Stops, lets the microphone go, and gives what was recorded: `null` when nothing was. */
  const stop = useCallback(async (): Promise<Recording | null> => {
    const current = recorder.current;
    recorder.current = null;
    ++generation.current;
    const recording = current ? await current.stop() : null;
    release();
    setPhase('idle');
    return recording;
  }, [release]);

  /** Drops what was recorded and lets the microphone go. */
  const cancel = useCallback(() => {
    ++generation.current;
    recorder.current?.discard();
    recorder.current = null;
    release();
    setPhase('idle');
  }, [release]);

  // Nothing records or holds the microphone once the page closes.
  useEffect(
    () => () => {
      ++generation.current;
      recorder.current?.discard();
      recorder.current = null;
      release();
    },
    [release],
  );

  /** How long it has recorded, for "Listening · 0:42". */
  const elapsedMs = useCallback(() => recorder.current?.elapsedMs() ?? 0, []);

  return { phase, start, stop, cancel, elapsedMs };
};
