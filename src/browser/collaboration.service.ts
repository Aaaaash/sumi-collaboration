import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ICollaborationService } from 'common';
import { initializeWebRTCProvider, initializeYDoc } from './yjs/binding';

@Injectable()
export class CollaborationServiceImpl extends Disposable implements ICollaborationService {
  private yDoc?: Y.Doc;

  private yWebRTCProvider?: WebrtcProvider;

  private getUserName() {
    return `Aaaaash` + Math.random();
  }

  initializeYDoc(clientId: string): void {
    this.yDoc = initializeYDoc(clientId);
    this.yWebRTCProvider = initializeWebRTCProvider(this.yDoc);

    this.yWebRTCProvider.awareness.setLocalStateField('user', {
      name: this.getUserName(),
    });

    this.yWebRTCProvider.awareness.on('change', this.onDidAwarenessChange.bind(this));
    this.onDispose(() => {
      this.yDoc?.destroy();
      this.yWebRTCProvider?.destroy();
    });
  }

  private onDidAwarenessChange(
    changes: { added: number[]; updated: number[]; removed: number[] },
  ) {
    if (changes.added.length > 0) {
      const states = this.yWebRTCProvider?.awareness.getStates();
      console.log('states', states);
    }
  }
}
