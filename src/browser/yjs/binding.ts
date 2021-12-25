import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export function initializeYDoc(
  clientId: string,
) {
  const ydoc = new Y.Doc({
    guid: clientId,
    meta: {
      name: 'Aaaaash' + Math.random() * 10,
    },
  });

  return ydoc;
}

export function initializeWebRTCProvider(doc: Y.Doc) {
  return new WebrtcProvider(doc.guid, doc);
}
