// The browser's WebSocket to the `live-assist` relay (doc 24 §15.2), as the page uses it: binary
// messages as ArrayBuffers, nothing sent before it opens or after it closes.
import { type LiveSocket } from './liveProtocol';

export const openBrowserLiveSocket = (url: string): LiveSocket => {
  const socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  const live: LiveSocket = {
    send: data => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
    close: () => socket.close(1000),
    onopen: null,
    onmessage: null,
    onclose: null,
  };
  socket.onopen = () => live.onopen?.();
  socket.onmessage = event =>
    live.onmessage?.(event.data as string | ArrayBuffer);
  socket.onclose = event => live.onclose?.({ code: event.code });
  return live;
};
